import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Send,
  Loader2,
  Clock,
  MessageSquare,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface Comment {
  id: string;
  content: string;
  timecode: string | null;
  created_at: string;
  user_id: string;
  output_id: string | null;
  profiles?: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

interface FileCommentsPanelProps {
  projectId: string;
  outputId: string;
  currentTimecode?: string | null;
  onTimecodeClick?: (timecode: string) => void;
  hasMediaPlayer?: boolean;
}

export function FileCommentsPanel({
  projectId,
  outputId,
  currentTimecode,
  onTimecodeClick,
  hasMediaPlayer = false,
}: FileCommentsPanelProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timecodeEnabled, setTimecodeEnabled] = useState(false);

  const fetchComments = useCallback(async () => {
    if (!outputId) return;
    
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          content,
          timecode,
          created_at,
          user_id,
          output_id
        `)
        .eq('project_id', projectId)
        .eq('output_id', outputId)
        .is('parent_id', null)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(c => c.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds);
        
        const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
        
        const commentsWithProfiles = data.map(c => ({
          ...c,
          profiles: profilesMap.get(c.user_id) || undefined,
        }));
        
        setComments(commentsWithProfiles);
      } else {
        setComments([]);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoading(false);
    }
  }, [projectId, outputId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Realtime subscription
  useEffect(() => {
    if (!outputId) return;

    const channel = supabase
      .channel(`file-comments-${outputId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
          filter: `output_id=eq.${outputId}`,
        },
        () => {
          fetchComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [outputId, fetchComments]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments]);

  // When timecode toggle is enabled, auto-insert current timecode into content
  useEffect(() => {
    if (timecodeEnabled && hasMediaPlayer && currentTimecode && !content.startsWith(`[${currentTimecode}]`)) {
      // Only auto-update the timecode prefix when content is empty or starts with a previous timecode
      const timecodeRegex = /^\[\d{1,2}:\d{2}(:\d{2})?\]\s*/;
      if (!content.trim() || timecodeRegex.test(content)) {
        setContent(`[${currentTimecode}] ${content.replace(timecodeRegex, '')}`);
      }
    }
  }, [currentTimecode, timecodeEnabled, hasMediaPlayer]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || !user) return;

    setSubmitting(true);
    try {
      // Auto-attach timecode if enabled and available
      const tc = (timecodeEnabled && hasMediaPlayer && currentTimecode) ? currentTimecode : null;
      
      const { error } = await supabase.from('comments').insert({
        project_id: projectId,
        output_id: outputId,
        user_id: user.id,
        content: content.trim(),
        timecode: tc,
      });

      if (error) throw error;

      setContent('');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to post comment',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getUserName = (comment: Comment) => {
    if (comment.profiles) {
      return comment.profiles.full_name || comment.profiles.email?.split('@')[0] || 'User';
    }
    return 'User';
  };

  const getUserAvatar = (comment: Comment) => {
    return comment.profiles?.avatar_url || null;
  };

  const renderTimecode = (timecode: string) => {
    return (
      <button
        onClick={() => onTimecodeClick?.(timecode)}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono hover:bg-primary/20 transition-colors"
      >
        <Clock className="h-3 w-3" />
        {timecode}
      </button>
    );
  };

  // Parse content for timecodes
  const renderContent = (content: string, timecode: string | null) => {
    const timecodeRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
    const parts = content.split(timecodeRegex);
    
    return (
      <span>
        {parts.map((part, i) => {
          if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(part)) {
            return <span key={i}>{renderTimecode(part)}</span>;
          }
          return <span key={i}>{part}</span>;
        })}
      </span>
    );
  };

  return (
    <div className="flex flex-col h-full bg-background border-l">
      {/* Header */}
      <div className="p-4 border-b">
        <h3 className="font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4" />
          Comments
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          {comments.length} comment{comments.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Comments List */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-12 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No comments yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Be the first to comment on this file
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={getUserAvatar(comment) || ''} />
                  <AvatarFallback className="text-xs">
                    {getUserName(comment).charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium">
                      {getUserName(comment)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(comment.created_at)}
                    </span>
                  </div>
                  <div className={cn(
                    "rounded-lg px-3 py-2 text-sm",
                    comment.user_id === user?.id
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-muted"
                  )}>
                    {renderContent(comment.content, comment.timecode)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="p-4 border-t">
        {/* Timecode toggle for media files */}
        {hasMediaPlayer && (
          <div className="flex items-center gap-3 mb-2 pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <Switch
                id="file-timecode-toggle"
                checked={timecodeEnabled}
                onCheckedChange={setTimecodeEnabled}
                className="scale-75"
              />
              <Label htmlFor="file-timecode-toggle" className="text-xs text-muted-foreground cursor-pointer">
                Capture Time
              </Label>
            </div>
            {timecodeEnabled && currentTimecode && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-xs font-mono">
                <Clock className="h-3 w-3" />
                {currentTimecode}
              </span>
            )}
          </div>
        )}
        
        <div className="flex gap-2">
          <Textarea
            placeholder={hasMediaPlayer && timecodeEnabled ? "Timestamped comment... ⌘+Enter to send" : "Add a comment..."}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="min-h-[60px] resize-none"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <Button
            type="submit"
            size="icon"
            className="flex-shrink-0 self-end"
            disabled={submitting || !content.trim()}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Press ⌘+Enter to send
        </p>
      </form>
    </div>
  );
}