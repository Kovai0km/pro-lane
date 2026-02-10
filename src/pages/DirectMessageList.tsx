import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, ArrowLeft, MessageSquare, Plus, Circle } from 'lucide-react';
import { NewMessageDialog } from '@/components/NewMessageDialog';

interface DirectMessage {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  username?: string | null;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
  isOnline?: boolean;
}

export default function DirectMessageList() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [conversations, setConversations] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [newMessageOpen, setNewMessageOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchConversations();
    }
  }, [user]);

  const fetchConversations = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { data: sentMessages } = await supabase
        .from('messages')
        .select('receiver_id, content, created_at')
        .eq('sender_id', user.id)
        .is('team_id', null)
        .order('created_at', { ascending: false });

      const { data: receivedMessages } = await supabase
        .from('messages')
        .select('sender_id, read, content, created_at')
        .eq('receiver_id', user.id)
        .is('team_id', null)
        .order('created_at', { ascending: false });

      const userMap = new Map<string, {
        lastMessage?: string;
        lastMessageAt?: string;
        unreadCount: number;
      }>();

      sentMessages?.forEach((m) => {
        const existing = userMap.get(m.receiver_id);
        if (!existing || (m.created_at && (!existing.lastMessageAt || new Date(m.created_at) > new Date(existing.lastMessageAt)))) {
          userMap.set(m.receiver_id, {
            lastMessage: m.content,
            lastMessageAt: m.created_at,
            unreadCount: existing?.unreadCount || 0,
          });
        }
      });

      receivedMessages?.forEach((m) => {
        const existing = userMap.get(m.sender_id);
        const unreadCount = (existing?.unreadCount || 0) + (!m.read ? 1 : 0);
        if (!existing || (m.created_at && (!existing.lastMessageAt || new Date(m.created_at) > new Date(existing.lastMessageAt)))) {
          userMap.set(m.sender_id, {
            lastMessage: m.content,
            lastMessageAt: m.created_at,
            unreadCount,
          });
        } else if (!m.read) {
          userMap.set(m.sender_id, { ...existing, unreadCount });
        }
      });

      if (userMap.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, username')
          .in('id', Array.from(userMap.keys()));

        if (profiles) {
          const dms: DirectMessage[] = profiles.map((p) => {
            const data = userMap.get(p.id);
            return {
              id: p.id,
              name: p.full_name || p.username || p.email.split('@')[0],
              email: p.email,
              avatar: p.avatar_url,
              username: p.username,
              lastMessage: data?.lastMessage,
              lastMessageAt: data?.lastMessageAt,
              unreadCount: data?.unreadCount || 0,
            };
          });

          // Sort by unread first, then by last message time
          dms.sort((a, b) => {
            if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
            if (b.unreadCount > 0 && a.unreadCount === 0) return 1;
            const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
            const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
            return bTime - aTime;
          });

          setConversations(dms);
        }
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectConversation = (id: string) => {
    navigate(`/org/${orgId}?tab=chat&channel=dm&id=${id}`);
  };

  const handleNewConversation = (userId: string) => {
    selectConversation(userId);
    setNewMessageOpen(false);
  };

  const filteredConversations = conversations.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (date?: string) => {
    if (!date) return '';
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Organization', href: `/org/${orgId}` },
        { label: 'Direct Messages' },
      ]}
    >
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/org/${orgId}?tab=chat`)}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Direct Messages</h1>
              <p className="text-sm text-muted-foreground">
                Your private conversations
              </p>
            </div>
          </div>
          <Button onClick={() => setNewMessageOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Message
          </Button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Conversation List */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              </div>
            ))
          ) : filteredConversations.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground mb-4">
                {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </p>
              <Button onClick={() => setNewMessageOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Start a Conversation
              </Button>
            </div>
          ) : (
            filteredConversations.map((dm) => (
              <button
                key={dm.id}
                onClick={() => selectConversation(dm.id)}
                className={cn(
                  'w-full p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left',
                  dm.unreadCount > 0 && 'border-primary/50 bg-primary/5'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={dm.avatar || ''} />
                      <AvatarFallback>
                        {dm.name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {dm.isOnline && (
                      <Circle className="h-3 w-3 absolute bottom-0 right-0 fill-green-500 text-green-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        'font-medium',
                        dm.unreadCount > 0 && 'font-semibold'
                      )}>
                        {dm.name}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        {formatTime(dm.lastMessageAt)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn(
                        'text-sm truncate',
                        dm.unreadCount > 0 ? 'text-foreground' : 'text-muted-foreground'
                      )}>
                        {dm.lastMessage || 'No messages yet'}
                      </p>
                      {dm.unreadCount > 0 && (
                        <Badge variant="default" className="h-5 min-w-5 text-[10px] px-1">
                          {dm.unreadCount}
                        </Badge>
                      )}
                    </div>
                    {dm.username && (
                      <p className="text-xs text-muted-foreground">@{dm.username}</p>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      <NewMessageDialog
        isOpen={newMessageOpen}
        onClose={() => setNewMessageOpen(false)}
        orgId={orgId}
        onSelectUser={handleNewConversation}
      />
    </DashboardLayout>
  );
}
