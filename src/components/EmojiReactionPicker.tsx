import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Smile, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const EMOJI_OPTIONS = ['👍', '👎', '❤️', '🎉', '😄', '😢', '🔥', '👀', '💯', '🚀'];

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
}

interface EmojiReactionPickerProps {
  messageId?: string;
  commentId?: string;
  reactions: Reaction[];
  onReactionChange: () => void;
  compact?: boolean;
}

export function EmojiReactionPicker({
  messageId,
  commentId,
  reactions,
  onReactionChange,
  compact = false,
}: EmojiReactionPickerProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Group reactions by emoji
  const groupedReactions = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) {
      acc[r.emoji] = [];
    }
    acc[r.emoji].push(r);
    return acc;
  }, {} as Record<string, Reaction[]>);

  const handleAddReaction = async (emoji: string) => {
    if (!user) return;

    setLoading(true);
    try {
      // Check if user already reacted with this emoji
      const existingReaction = reactions.find(
        (r) => r.emoji === emoji && r.user_id === user.id
      );

      if (existingReaction) {
        // Remove reaction
        const { error } = await supabase
          .from('reactions')
          .delete()
          .eq('id', existingReaction.id);

        if (error) throw error;
      } else {
        // Add reaction
        const { error } = await supabase.from('reactions').insert({
          user_id: user.id,
          emoji,
          message_id: messageId || null,
          comment_id: commentId || null,
        });

        if (error) throw error;
      }

      onReactionChange();
      setOpen(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update reaction',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const hasUserReacted = (emoji: string) => {
    return reactions.some((r) => r.emoji === emoji && r.user_id === user?.id);
  };

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {/* Display existing reactions */}
      {Object.entries(groupedReactions).map(([emoji, emojiReactions]) => (
        <button
          key={emoji}
          onClick={() => handleAddReaction(emoji)}
          disabled={loading}
          className={cn(
            'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors',
            hasUserReacted(emoji)
              ? 'bg-primary/20 border border-primary/50'
              : 'bg-muted hover:bg-muted/80 border border-transparent'
          )}
        >
          <span>{emoji}</span>
          <span className="text-muted-foreground">{emojiReactions.length}</span>
        </button>
      ))}

      {/* Add reaction button */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn('h-6 w-6', compact && 'opacity-0 group-hover:opacity-100')}
          >
            {compact ? <Plus className="h-3 w-3" /> : <Smile className="h-3.5 w-3.5" />}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="flex gap-1 flex-wrap max-w-[200px]">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => handleAddReaction(emoji)}
                disabled={loading}
                className={cn(
                  'p-1.5 rounded hover:bg-muted transition-colors text-lg',
                  hasUserReacted(emoji) && 'bg-primary/20'
                )}
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
