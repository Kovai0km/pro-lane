import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Send, ChevronDown, ChevronRight, Reply, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
}

interface ThreadMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id?: string;
  user_id?: string;
  parent_id: string | null;
  sender_profile?: Profile;
  profiles?: { full_name: string | null; email: string };
}

interface ThreadRepliesProps {
  parentMessage: ThreadMessage;
  replies: ThreadMessage[];
  onReplyAdded: (reply: ThreadMessage) => void;
  type: 'message' | 'comment';
  projectId?: string;
  teamId?: string;
  receiverId?: string;
}

export function ThreadReplies({
  parentMessage,
  replies,
  onReplyAdded,
  type,
  projectId,
  teamId,
  receiverId,
}: ThreadRepliesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyContent.trim() || !user) return;

    setSubmitting(true);
    try {
      if (type === 'message') {
        const insertData: any = {
          sender_id: user.id,
          content: replyContent.trim(),
          parent_id: parentMessage.id,
        };

        if (teamId) {
          insertData.team_id = teamId;
          insertData.receiver_id = user.id; // For team messages
        } else if (receiverId) {
          insertData.receiver_id = receiverId;
        }

        const { data, error } = await supabase
          .from('messages')
          .insert(insertData)
          .select('*')
          .single();

        if (error) throw error;

        // Fetch profile for the new reply
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url')
          .eq('id', user.id)
          .single();

        onReplyAdded({ ...data, sender_profile: profile });
      } else if (type === 'comment' && projectId) {
        const { data, error } = await supabase
          .from('comments')
          .insert({
            project_id: projectId,
            user_id: user.id,
            content: replyContent.trim(),
            parent_id: parentMessage.id,
          })
          .select('*')
          .single();

        if (error) throw error;

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .eq('id', user.id)
          .single();

        onReplyAdded({
          ...data,
          profiles: profile || { full_name: null, email: user.email || 'Unknown' },
        });
      }

      setReplyContent('');
      setShowReplyInput(false);
      setIsExpanded(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send reply',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getUserName = (msg: ThreadMessage) => {
    if (msg.sender_profile) {
      return msg.sender_profile.full_name || msg.sender_profile.email?.split('@')[0];
    }
    if (msg.profiles) {
      return msg.profiles.full_name || msg.profiles.email?.split('@')[0];
    }
    return 'Unknown';
  };

  const getUserAvatar = (msg: ThreadMessage) => {
    if (msg.sender_profile?.avatar_url) {
      return msg.sender_profile.avatar_url;
    }
    return null;
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

  return (
    <div className="mt-2">
      {/* Reply count & toggle */}
      {replies.length > 0 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1 text-xs text-primary hover:underline mb-2"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <MessageSquare className="h-3 w-3" />
          {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
        </button>
      )}

      {/* Reply button */}
      {!showReplyInput && (
        <button
          onClick={() => setShowReplyInput(true)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Reply className="h-3 w-3" />
          Reply
        </button>
      )}

      {/* Replies list */}
      {isExpanded && replies.length > 0 && (
        <div className="ml-4 pl-4 border-l-2 border-muted space-y-3 mt-2">
          {replies.map((reply) => (
            <div key={reply.id} className="flex gap-2">
              <Avatar className="h-6 w-6">
                <AvatarImage src={getUserAvatar(reply) || ''} />
                <AvatarFallback className="text-[10px]">
                  {getUserName(reply).charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium">{getUserName(reply)}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {formatTime(reply.created_at)}
                  </span>
                </div>
                <p className="text-sm">{reply.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply input */}
      {showReplyInput && (
        <form onSubmit={handleSubmitReply} className="flex gap-2 mt-2 ml-4">
          <Input
            placeholder="Write a reply..."
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            className="h-8 text-sm"
            autoFocus
          />
          <Button type="submit" size="sm" className="h-8" disabled={submitting || !replyContent.trim()}>
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8"
            onClick={() => {
              setShowReplyInput(false);
              setReplyContent('');
            }}
          >
            Cancel
          </Button>
        </form>
      )}
    </div>
  );
}
