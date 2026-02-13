import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Hash,
  Send,
  Loader2,
  MessageSquare,
  Plus,
  ChevronDown,
  Users,
  MoreVertical,
  Search,
  ArrowLeft,
  ChevronRight,
  Filter,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { NewMessageDialog } from '@/components/NewMessageDialog';
import { ThreadReplies } from '@/components/ThreadReplies';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
  username?: string | null;
}

interface Team {
  id: string;
  name: string;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string | null;
  team_id: string | null;
  content: string;
  read: boolean;
  created_at: string;
  parent_id: string | null;
  sender_profile?: Profile;
}

interface DirectMessage {
  user: Profile;
  unreadCount: number;
  lastMessageTime?: string;
}

interface ChatLayoutProps {
  orgId: string;
}

export function ChatLayout({ orgId }: ChatLayoutProps) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [teams, setTeams] = useState<Team[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [activeChannel, setActiveChannel] = useState<{ type: 'team' | 'dm'; id: string } | null>(null);
  const [channelName, setChannelName] = useState('');
  const [channelAvatar, setChannelAvatar] = useState<string | null>(null);
  const [channelsOpen, setChannelsOpen] = useState(true);
  const [dmsOpen, setDmsOpen] = useState(true);
  const [newMessageOpen, setNewMessageOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAllChannels, setShowAllChannels] = useState(false);
  const [showAllDMs, setShowAllDMs] = useState(false);
  const [messageSearchQuery, setMessageSearchQuery] = useState('');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  // @mention state
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [orgMembers, setOrgMembers] = useState<Profile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get active channel from URL
  useEffect(() => {
    const channelType = searchParams.get('channel');
    const channelId = searchParams.get('id');
    if (channelType && channelId) {
      setActiveChannel({ type: channelType as 'team' | 'dm', id: channelId });
    } else {
      setActiveChannel(null);
    }
  }, [searchParams]);

  // Fetch initial data
  useEffect(() => {
    if (user && orgId) {
      Promise.all([fetchTeams(), fetchDirectMessages(), fetchOrgMembers()]).finally(() => setLoading(false));
    }
  }, [user, orgId]);

  // Fetch org members for @mention
  const fetchOrgMembers = async () => {
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', orgId);
    if (members && members.length > 0) {
      const userIds = members.map(m => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, username')
        .in('id', userIds);
      if (profiles) setOrgMembers(profiles);
    }
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch messages when channel changes
  useEffect(() => {
    if (activeChannel && user) {
      fetchMessages();
      fetchChannelInfo();

      // Real-time subscription for messages
      const channel = supabase
        .channel(`chat-${activeChannel.type}-${activeChannel.id}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          async (payload) => {
            const newMsg = payload.new as Message;
            if (activeChannel.type === 'dm') {
              if (
                (newMsg.sender_id === user.id && newMsg.receiver_id === activeChannel.id) ||
                (newMsg.sender_id === activeChannel.id && newMsg.receiver_id === user.id)
              ) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('id, email, full_name, avatar_url, username')
                  .eq('id', newMsg.sender_id)
                  .single();
                setMessages((prev) => [...prev, { ...newMsg, sender_profile: profile || undefined }]);
                // Auto mark as read if from other user
                if (newMsg.sender_id !== user.id) {
                  await supabase.from('messages').update({ read: true }).eq('id', newMsg.id);
                }
              }
            } else if (activeChannel.type === 'team') {
              if (newMsg.team_id === activeChannel.id) {
                const { data: profile } = await supabase
                  .from('profiles')
                  .select('id, email, full_name, avatar_url, username')
                  .eq('id', newMsg.sender_id)
                  .single();
                setMessages((prev) => [...prev, { ...newMsg, sender_profile: profile || undefined }]);
              }
            }
            // Refresh DM list for unread counts
            fetchDirectMessages();
          }
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages' },
          () => {
            // Refresh unread counts when messages are marked as read
            fetchDirectMessages();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [activeChannel, user]);

  const fetchTeams = async () => {
    if (!orgId) return;
    const { data } = await supabase
      .from('teams')
      .select('id, name')
      .eq('organization_id', orgId)
      .order('name');
    if (data) setTeams(data);
  };

  const fetchDirectMessages = async () => {
    if (!user) return;
    const { data: sentMessages } = await supabase
      .from('messages')
      .select('receiver_id, created_at')
      .eq('sender_id', user.id)
      .is('team_id', null);

    const { data: receivedMessages } = await supabase
      .from('messages')
      .select('sender_id, read, created_at')
      .eq('receiver_id', user.id)
      .is('team_id', null);

    const userMap = new Map<string, { unreadCount: number; lastMessageTime: string }>();

    sentMessages?.forEach((m) => {
      if (m.receiver_id) {
        const existing = userMap.get(m.receiver_id);
        if (!existing || new Date(m.created_at) > new Date(existing.lastMessageTime)) {
          userMap.set(m.receiver_id, {
            unreadCount: existing?.unreadCount || 0,
            lastMessageTime: m.created_at,
          });
        }
      }
    });

    receivedMessages?.forEach((m) => {
      const existing = userMap.get(m.sender_id);
      const unreadCount = (existing?.unreadCount || 0) + (!m.read ? 1 : 0);
      const lastMessageTime = existing?.lastMessageTime
        ? new Date(m.created_at) > new Date(existing.lastMessageTime)
          ? m.created_at
          : existing.lastMessageTime
        : m.created_at;
      userMap.set(m.sender_id, { unreadCount, lastMessageTime });
    });

    if (userMap.size > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, avatar_url, username')
        .in('id', Array.from(userMap.keys()));

      if (profiles) {
        const dms: DirectMessage[] = profiles.map((p) => ({
          user: p,
          unreadCount: userMap.get(p.id)?.unreadCount || 0,
          lastMessageTime: userMap.get(p.id)?.lastMessageTime,
        }));
        
        // Sort by last message time (most recent first)
        dms.sort((a, b) => {
          if (!a.lastMessageTime) return 1;
          if (!b.lastMessageTime) return -1;
          return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
        });
        
        setDirectMessages(dms);
      }
    }
  };

  const fetchChannelInfo = async () => {
    if (!activeChannel) {
      setChannelName('');
      setChannelAvatar(null);
      return;
    }
    if (activeChannel.type === 'dm') {
      const { data } = await supabase
        .from('profiles')
        .select('full_name, email, avatar_url, username')
        .eq('id', activeChannel.id)
        .single();
      setChannelName(data?.full_name || data?.username || data?.email?.split('@')[0] || 'Direct Message');
      setChannelAvatar(data?.avatar_url || null);
    } else if (activeChannel.type === 'team') {
      const { data } = await supabase
        .from('teams')
        .select('name')
        .eq('id', activeChannel.id)
        .single();
      setChannelName(data?.name || 'Channel');
      setChannelAvatar(null);
    }
  };

  const fetchMessages = async () => {
    if (!activeChannel || !user) return;
    setMessagesLoading(true);

    try {
      if (activeChannel.type === 'dm') {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .is('team_id', null)
          .or(
            `and(sender_id.eq.${user.id},receiver_id.eq.${activeChannel.id}),and(sender_id.eq.${activeChannel.id},receiver_id.eq.${user.id})`
          )
          .order('created_at', { ascending: true });

        if (data) {
          const senderIds = [...new Set(data.map((m) => m.sender_id))];
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, full_name, avatar_url, username')
            .in('id', senderIds);

          const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
          const messagesWithProfiles = data.map((m) => ({
            ...m,
            sender_profile: profileMap.get(m.sender_id),
          }));
          setMessages(messagesWithProfiles);

          // Mark as read and refresh unread counts
          await supabase
            .from('messages')
            .update({ read: true })
            .eq('sender_id', activeChannel.id)
            .eq('receiver_id', user.id)
            .eq('read', false);
          
          // Refresh DM list to update unread badges
          fetchDirectMessages();
        }
      } else if (activeChannel.type === 'team') {
        const { data } = await supabase
          .from('messages')
          .select('*')
          .eq('team_id', activeChannel.id)
          .order('created_at', { ascending: true });

        if (data) {
          const senderIds = [...new Set(data.map((m) => m.sender_id))];
          if (senderIds.length > 0) {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, email, full_name, avatar_url, username')
              .in('id', senderIds);

            const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
            const messagesWithProfiles = data.map((m) => ({
              ...m,
              sender_profile: profileMap.get(m.sender_id),
            }));
            setMessages(messagesWithProfiles);
          } else {
            setMessages(data);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setMessagesLoading(false);
    }
  };

  const detectMentions = (content: string): string[] => {
    const mentionRegex = /@(\w+(?:\s\w+)?)/g;
    const mentions: string[] = [];
    let match;
    while ((match = mentionRegex.exec(content)) !== null) {
      mentions.push(match[1]);
    }
    return mentions;
  };

  const createMentionNotifications = async (content: string, messageId?: string) => {
    if (!user) return;
    const mentionNames = detectMentions(content);
    if (mentionNames.length === 0) return;

    const senderName = user.user_metadata?.full_name || user.email?.split('@')[0] || 'Someone';

    for (const name of mentionNames) {
      const mentioned = orgMembers.find(
        m => m.full_name?.toLowerCase() === name.toLowerCase() ||
             m.username?.toLowerCase() === name.toLowerCase() ||
             m.email.split('@')[0].toLowerCase() === name.toLowerCase()
      );
      if (mentioned && mentioned.id !== user.id) {
        await supabase.from('notifications').insert({
          user_id: mentioned.id,
          type: 'mention',
          title: 'You were mentioned',
          message: `${senderName} mentioned you in chat: "${content.slice(0, 80)}${content.length > 80 ? '...' : ''}"`,
          link: `/org/${orgId}?tab=chat&channel=${activeChannel?.type}&id=${activeChannel?.id}`,
        });
      }
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeChannel || !user) return;

    setSending(true);
    const content = newMessage.trim();
    try {
      if (activeChannel.type === 'dm') {
        const { error } = await supabase.from('messages').insert({
          sender_id: user.id,
          receiver_id: activeChannel.id,
          content,
        });
        if (error) throw error;
      } else if (activeChannel.type === 'team') {
        const { error } = await supabase.from('messages').insert({
          sender_id: user.id,
          team_id: activeChannel.id,
          receiver_id: user.id,
          content,
        });
        if (error) throw error;
      }
      setNewMessage('');
      setMentionOpen(false);
      // Create mention notifications in background
      createMentionNotifications(content);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  const handleMessageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewMessage(value);
    const cursorPos = e.target.selectionStart || 0;
    const textBeforeCursor = value.slice(0, cursorPos);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionSearch(atMatch[1]);
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
    }
  };

  const handleMentionSelect = (member: Profile) => {
    const cursorPos = inputRef.current?.selectionStart || newMessage.length;
    const textBefore = newMessage.slice(0, cursorPos);
    const textAfter = newMessage.slice(cursorPos);
    const atIndex = textBefore.lastIndexOf('@');
    const name = member.full_name || member.username || member.email.split('@')[0];
    setNewMessage(textBefore.slice(0, atIndex) + `@${name} ` + textAfter);
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const filteredMentionMembers = orgMembers.filter(m => {
    if (m.id === user?.id) return false;
    const search = mentionSearch.toLowerCase();
    return m.full_name?.toLowerCase().includes(search) ||
           m.username?.toLowerCase().includes(search) ||
           m.email.toLowerCase().includes(search);
  });

  const renderContentWithMentions = (content: string, isOwn: boolean) => {
    const mentionRegex = /@(\w+(?:\s\w+)?)/g;
    const parts = content.split(mentionRegex);
    return parts.map((part, i) => {
      if (i % 2 === 1) return <span key={i} className={cn("font-semibold underline", isOwn ? "text-accent-foreground" : "text-primary")}>@{part}</span>;
      return part;
    });
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();

    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return (
      d.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
      ' ' +
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  };

  const selectChannel = (type: 'team' | 'dm', id: string) => {
    navigate(`/org/${orgId}?tab=chat&channel=${type}&id=${id}`);
  };

  const handleNewConversation = (userId: string) => {
    const existing = directMessages.find((dm) => dm.user.id === userId);
    if (existing) {
      selectChannel('dm', userId);
    } else {
      selectChannel('dm', userId);
    }
    setNewMessageOpen(false);
  };

  const filteredTeams = teams.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  const filteredDMs = directMessages.filter(
    (dm) => {
      const matchesSearch = dm.user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dm.user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        dm.user.username?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesUnread = showUnreadOnly ? dm.unreadCount > 0 : true;
      return matchesSearch && matchesUnread;
    }
  );

  const filteredMessages = messageSearchQuery
    ? messages.filter(m => m.content.toLowerCase().includes(messageSearchQuery.toLowerCase()))
    : messages;

  const isMobile = useIsMobile();
  const [showSidebar, setShowSidebar] = useState(!isMobile);

  useEffect(() => {
    if (isMobile && activeChannel) {
      setShowSidebar(false);
    } else if (!isMobile) {
      setShowSidebar(true);
    }
  }, [isMobile, activeChannel]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const displayedChannels = showAllChannels ? filteredTeams : filteredTeams.slice(0, 5);
  const displayedDMs = showAllDMs ? filteredDMs : filteredDMs.slice(0, 5);

  return (
    <div className="flex h-[calc(100vh-8rem)] border border-border rounded-lg overflow-hidden bg-card">
      {/* Sidebar */}
      <div className={cn(
        "border-r border-border flex flex-col bg-background/50",
        isMobile ? (showSidebar ? "absolute inset-0 z-10 w-full" : "hidden") : "w-64"
      )}>
        {/* Search & Filter */}
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
          <Button
            variant={showUnreadOnly ? 'default' : 'outline'}
            size="sm"
            className="w-full h-7 text-xs"
            onClick={() => setShowUnreadOnly(!showUnreadOnly)}
          >
            <Filter className="h-3 w-3 mr-1" />
            {showUnreadOnly ? 'Show All' : 'Unread Only'}
          </Button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2">
            {/* Channels */}
            <Collapsible open={channelsOpen} onOpenChange={setChannelsOpen}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <span className="uppercase tracking-wider text-xs">Channels</span>
                  <ChevronDown
                    className={cn('h-4 w-4 transition-transform', channelsOpen && 'rotate-180')}
                  />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 mt-1">
                {filteredTeams.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No channels</p>
                ) : (
                  <>
                    {displayedChannels.map((team) => {
                      const isActive =
                        activeChannel?.type === 'team' && activeChannel.id === team.id;
                      return (
                        <button
                          key={team.id}
                          onClick={() => selectChannel('team', team.id)}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                            isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                          )}
                        >
                          <Hash className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{team.name}</span>
                        </button>
                      );
                    })}
                    {filteredTeams.length > 5 && (
                      <button
                        onClick={() => setShowAllChannels(!showAllChannels)}
                        className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showAllChannels ? (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-3 w-3" />
                            Show All ({filteredTeams.length})
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>

            <Separator className="my-3" />

            {/* Direct Messages */}
            <Collapsible open={dmsOpen} onOpenChange={setDmsOpen}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between px-2 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                  <span className="uppercase tracking-wider text-xs">Direct Messages</span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={(e) => {
                        e.stopPropagation();
                        setNewMessageOpen(true);
                      }}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <ChevronDown
                      className={cn('h-4 w-4 transition-transform', dmsOpen && 'rotate-180')}
                    />
                  </div>
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-0.5 mt-1">
                {filteredDMs.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">No conversations</p>
                ) : (
                  <>
                    {displayedDMs.map((dm) => {
                      const isActive =
                        activeChannel?.type === 'dm' && activeChannel.id === dm.user.id;
                      const hasUnread = dm.unreadCount > 0;
                      return (
                        <button
                          key={dm.user.id}
                          onClick={() => selectChannel('dm', dm.user.id)}
                          className={cn(
                            'w-full flex items-center justify-start gap-2 px-3 py-2 rounded-md text-sm transition-colors',
                            isActive 
                              ? 'bg-primary text-primary-foreground' 
                              : hasUnread 
                                ? 'bg-muted/50 hover:bg-muted font-medium' 
                                : 'hover:bg-muted'
                          )}
                        >
                          <div className="relative flex-shrink-0">
                            <UserAvatar
                              src={dm.user.avatar_url}
                              name={dm.user.full_name}
                              email={dm.user.email}
                              size="xs"
                            />
                            {hasUnread && !isActive && (
                              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-primary rounded-full" />
                            )}
                          </div>
                          <span className="truncate flex-1 text-left">
                            {dm.user.full_name || dm.user.username || dm.user.email.split('@')[0]}
                          </span>
                          {dm.unreadCount > 0 && (
                            <Badge variant="default" className="h-5 min-w-5 text-[10px] px-1 flex-shrink-0">
                              {dm.unreadCount}
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                    {filteredDMs.length > 5 && (
                      <button
                        onClick={() => setShowAllDMs(!showAllDMs)}
                        className="w-full flex items-center justify-center gap-1 px-3 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showAllDMs ? (
                          <>
                            <ChevronDown className="h-3 w-3" />
                            Show Less
                          </>
                        ) : (
                          <>
                            <ChevronRight className="h-3 w-3" />
                            Show All ({filteredDMs.length})
                          </>
                        )}
                      </button>
                    )}
                  </>
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </ScrollArea>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeChannel ? (
          <>
            {/* Channel Header */}
            <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-background flex-shrink-0">
              <div className="flex items-center gap-3">
                {isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 mr-1"
                    onClick={() => {
                      setShowSidebar(true);
                      navigate(`/org/${orgId}?tab=chat`);
                    }}
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                )}
                {activeChannel.type === 'team' ? (
                  <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center">
                    <Hash className="h-4 w-4 text-primary" />
                  </div>
                ) : (
                  <UserAvatar
                    src={channelAvatar}
                    name={channelName}
                    size="sm"
                  />
                )}
                <div>
                  <span className="font-semibold">{channelName}</span>
                  <p className="text-xs text-muted-foreground">
                    {activeChannel.type === 'team' ? 'Channel' : 'Direct message'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Users className="h-4 w-4" />
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      if (activeChannel?.type === 'dm') {
                        const dmUser = directMessages.find(dm => dm.user.id === activeChannel.id)?.user;
                        const profilePath = dmUser?.username ? `/user/${dmUser.username}` : `/user/${dmUser?.email?.split('@')[0] || activeChannel.id}`;
                        navigate(profilePath);
                      }
                    }}>View profile</DropdownMenuItem>
                    <DropdownMenuItem>Mute conversation</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Message Search */}
            <div className="px-4 py-2 border-b border-border bg-background">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search messages..."
                  value={messageSearchQuery}
                  onChange={(e) => setMessageSearchQuery(e.target.value)}
                  className="pl-8 h-8 text-xs"
                />
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 p-4 bg-background">
              {messagesLoading ? (
                <div className="space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex gap-3">
                      <Skeleton className="h-9 w-9 rounded-full" />
                      <div className="space-y-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-3/4" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                      <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
                      <h3 className="font-semibold text-lg mb-1">No messages yet</h3>
                      <p className="text-sm text-muted-foreground">
                        Start the conversation by sending a message below.
                      </p>
                    </div>
                  ) : (
                    filteredMessages
                      .filter((msg) => !msg.parent_id)
                      .map((msg) => {
                        const isOwn = msg.sender_id === user?.id;
                        const replies = filteredMessages.filter((m) => m.parent_id === msg.id);

                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              'flex gap-3 px-2 py-1',
                              isOwn ? 'justify-end' : 'justify-start'
                            )}
                          >
                            <div className={cn(
                              'flex gap-3 max-w-[70%]',
                              isOwn && 'flex-row-reverse'
                            )}>
                              <UserAvatar
                                src={msg.sender_profile?.avatar_url}
                                name={msg.sender_profile?.full_name}
                                email={msg.sender_profile?.email}
                                size="md"
                                className="mt-0.5 flex-shrink-0"
                              />
                              <div className={cn('flex-1 min-w-0', isOwn && 'flex flex-col items-end')}>
                                <div className={cn(
                                  'flex items-baseline gap-2 mb-0.5',
                                  isOwn && 'flex-row-reverse'
                                )}>
                                  <span className="font-semibold text-sm">
                                    {isOwn
                                      ? 'You'
                                      : msg.sender_profile?.full_name ||
                                        msg.sender_profile?.username ||
                                        msg.sender_profile?.email?.split('@')[0]}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTime(msg.created_at)}
                                  </span>
                                </div>
                                <div className={cn(
                                  'rounded-lg px-4 py-2',
                                  isOwn 
                                    ? 'bg-secondary text-secondary-foreground' 
                                    : 'bg-muted'
                                )}>
                                  <p className="text-sm leading-relaxed break-words">{renderContentWithMentions(msg.content, isOwn)}</p>
                                </div>

                                {/* Thread Replies */}
                                <div className={cn('mt-2 w-full', isOwn && 'flex justify-end')}>
                                  <div className={cn(isOwn && 'w-full flex justify-end')}>
                                    <ThreadReplies
                                      parentMessage={msg}
                                      replies={replies}
                                      onReplyAdded={(reply) => {
                                        setMessages((prev) => [...prev, reply as Message]);
                                      }}
                                      type="message"
                                      teamId={activeChannel?.type === 'team' ? activeChannel.id : undefined}
                                      receiverId={activeChannel?.type === 'dm' ? activeChannel.id : undefined}
                                    />
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-background">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <div className="flex-1 relative">
                  {mentionOpen && filteredMentionMembers.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border border-border rounded-md shadow-lg z-50 max-h-48 overflow-y-auto">
                      <div className="p-1">
                        {filteredMentionMembers.slice(0, 6).map((member) => (
                          <button
                            key={member.id}
                            type="button"
                            onClick={() => handleMentionSelect(member)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                          >
                            <UserAvatar
                              src={member.avatar_url}
                              name={member.full_name}
                              email={member.email}
                              size="xs"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate text-sm">
                                {member.full_name || member.username || member.email.split('@')[0]}
                              </div>
                              {member.full_name && (
                                <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <Input
                    ref={inputRef}
                    placeholder={`Message ${activeChannel.type === 'team' ? '#' : ''}${channelName} — type @ to mention`}
                    value={newMessage}
                    onChange={handleMessageInputChange}
                    className="pr-12"
                  />
                </div>
                <Button type="submit" disabled={sending || !newMessage.trim()}>
                  {sending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-background">
            <MessageSquare className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-xl font-semibold mb-2">Welcome to Chat</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Select a channel or direct message to start chatting, or start a new conversation.
            </p>
            <Button onClick={() => setNewMessageOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Conversation
            </Button>
          </div>
        )}
      </div>

      <NewMessageDialog
        open={newMessageOpen}
        onOpenChange={setNewMessageOpen}
        onSelectUser={handleNewConversation}
      />
    </div>
  );
}
