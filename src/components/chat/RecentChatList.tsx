import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Hash, ChevronRight, MessageSquare, Pin } from 'lucide-react';
import { Link } from 'react-router-dom';

interface RecentChat {
  id: string;
  type: 'team' | 'dm';
  name: string;
  avatar?: string | null;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  isPinned?: boolean;
}

interface RecentChatListProps {
  orgId: string;
  limit?: number;
  showViewAll?: boolean;
  activeChannel?: { type: 'team' | 'dm'; id: string } | null;
}

export function RecentChatList({ 
  orgId, 
  limit = 5, 
  showViewAll = true,
  activeChannel 
}: RecentChatListProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [recentChats, setRecentChats] = useState<RecentChat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && orgId) {
      fetchRecentChats();
    }
  }, [user, orgId]);

  const fetchRecentChats = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const chats: RecentChat[] = [];

      // Fetch teams (channels)
      const { data: teams } = await supabase
        .from('teams')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name')
        .limit(limit);

      if (teams) {
        // Get last message for each team
        for (const team of teams) {
          const { data: lastMsg } = await supabase
            .from('messages')
            .select('content, created_at')
            .eq('team_id', team.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();

          chats.push({
            id: team.id,
            type: 'team',
            name: team.name,
            lastMessage: lastMsg?.content,
            lastMessageAt: lastMsg?.created_at,
            unreadCount: 0, // Team messages don't have individual read status
          });
        }
      }

      // Fetch DMs
      const { data: sentMessages } = await supabase
        .from('messages')
        .select('receiver_id, created_at')
        .eq('sender_id', user.id)
        .is('team_id', null);

      const { data: receivedMessages } = await supabase
        .from('messages')
        .select('sender_id, read, created_at, content')
        .eq('receiver_id', user.id)
        .is('team_id', null);

      const userIds = new Set<string>();
      const lastMessageMap = new Map<string, { content?: string; createdAt: string }>();
      const unreadMap = new Map<string, number>();

      sentMessages?.forEach((m) => {
        userIds.add(m.receiver_id);
        const existing = lastMessageMap.get(m.receiver_id);
        if (!existing || new Date(m.created_at) > new Date(existing.createdAt)) {
          lastMessageMap.set(m.receiver_id, { createdAt: m.created_at });
        }
      });

      receivedMessages?.forEach((m) => {
        userIds.add(m.sender_id);
        const existing = lastMessageMap.get(m.sender_id);
        if (!existing || new Date(m.created_at) > new Date(existing.createdAt)) {
          lastMessageMap.set(m.sender_id, { content: m.content, createdAt: m.created_at });
        }
        if (!m.read) {
          unreadMap.set(m.sender_id, (unreadMap.get(m.sender_id) || 0) + 1);
        }
      });

      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, username')
          .in('id', Array.from(userIds));

        if (profiles) {
          profiles.forEach((p) => {
            const lastMsg = lastMessageMap.get(p.id);
            chats.push({
              id: p.id,
              type: 'dm',
              name: p.full_name || p.username || p.email.split('@')[0],
              avatar: p.avatar_url,
              lastMessage: lastMsg?.content,
              lastMessageAt: lastMsg?.createdAt,
              unreadCount: unreadMap.get(p.id) || 0,
            });
          });
        }
      }

      // Sort by last message time (most recent first), then by unread
      chats.sort((a, b) => {
        // Prioritize unread
        if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
        if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
        
        // Then by last message time
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });

      setRecentChats(chats.slice(0, limit));
    } catch (error) {
      console.error('Error fetching recent chats:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectChannel = (type: 'team' | 'dm', id: string) => {
    navigate(`/org/${orgId}?tab=chat&channel=${type}&id=${id}`);
  };

  const formatTime = (date?: string) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-2 p-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (recentChats.length === 0) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No recent conversations</p>
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {recentChats.map((chat) => {
        const isActive = activeChannel?.type === chat.type && activeChannel.id === chat.id;
        const hasUnread = chat.unreadCount > 0;

        return (
          <button
            key={`${chat.type}-${chat.id}`}
            onClick={() => selectChannel(chat.type, chat.id)}
            className={cn(
              'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
              isActive 
                ? 'bg-primary text-primary-foreground' 
                : hasUnread 
                  ? 'bg-muted/50 hover:bg-muted' 
                  : 'hover:bg-muted'
            )}
          >
            {chat.type === 'team' ? (
              <Hash className={cn(
                'h-4 w-4 flex-shrink-0',
                hasUnread && !isActive && 'text-primary'
              )} />
            ) : (
              <UserAvatar
                src={chat.avatar}
                name={chat.name}
                size="xs"
                className="flex-shrink-0"
              />
            )}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-1">
                <span className={cn(
                  'truncate',
                  hasUnread && !isActive && 'font-semibold'
                )}>
                  {chat.name}
                </span>
                {hasUnread && !isActive && (
                  <span className="h-2 w-2 rounded-full bg-primary flex-shrink-0" />
                )}
              </div>
              {chat.lastMessage && (
                <p className={cn(
                  'text-xs truncate',
                  isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}>
                  {chat.lastMessage}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {chat.lastMessageAt && (
                <span className={cn(
                  'text-xs',
                  isActive ? 'text-primary-foreground/70' : 'text-muted-foreground'
                )}>
                  {formatTime(chat.lastMessageAt)}
                </span>
              )}
              {chat.unreadCount > 0 && (
                <Badge 
                  variant="default" 
                  className="h-5 min-w-5 text-[10px] px-1"
                >
                  {chat.unreadCount}
                </Badge>
              )}
            </div>
          </button>
        );
      })}
      
      {showViewAll && (
        <Link
          to={`/org/${orgId}/chat`}
          className="flex items-center justify-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          View All
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
