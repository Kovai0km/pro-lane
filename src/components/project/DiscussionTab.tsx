import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Send, MessageSquare, Paperclip, X, FolderOpen, FileOutput, Clock, User, Upload, GitCommit, MessageCircle, Trash2 } from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { EmojiReactionPicker } from '@/components/EmojiReactionPicker';
import { ThreadReplies } from '@/components/ThreadReplies';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url?: string | null;
  username?: string | null;
}

interface Comment {
  id: string;
  content: string;
  timecode: string | null;
  created_at: string;
  user_id: string;
  output_id: string | null;
  parent_id: string | null;
  profiles?: { full_name: string | null; email: string; avatar_url?: string | null };
}

interface ActivityLog {
  id: string;
  action: string;
  details: any;
  created_at: string;
  user_id: string;
  user_profile?: Profile;
}

interface Reaction {
  id: string;
  emoji: string;
  user_id: string;
  comment_id: string | null;
}

interface DiscussionTabProps {
  projectId: string;
  comments: Comment[];
  submittingComment: boolean;
  onSubmitComment: (content: string, timecode?: string | null) => Promise<void>;
  onAttachmentUploaded: () => void;
  user: { id: string } | null;
  projectMembers?: Profile[];
  currentTimecode?: string | null;
  onCaptureTimecode?: () => void;
  hasMediaPlayer?: boolean;
}

export function DiscussionTab({
  projectId,
  comments,
  submittingComment,
  onSubmitComment,
  onAttachmentUploaded,
  user,
}: DiscussionTabProps) {
  const [showAttachment, setShowAttachment] = useState(false);
  const [classifyDialogOpen, setClassifyDialogOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ type: 'asset' | 'output'; uploading: boolean } | null>(null);
  const [selectedType, setSelectedType] = useState<'asset' | 'output'>('asset');
  const [newComment, setNewComment] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPosition, setCursorPosition] = useState(0);
  const [members, setMembers] = useState<Profile[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityLog[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchProjectMembers();
    fetchActivityLog();
    fetchReactions();
  }, [projectId]);

  // Realtime subscription for comments
  useEffect(() => {
    const channel = supabase
      .channel(`discussion-comments-${projectId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'comments', filter: `project_id=eq.${projectId}` },
        () => { onSubmitComment('__refetch__', null).catch(() => {}); }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [projectId]);

  const fetchProjectMembers = async () => {
    try {
      // First try to get org members if project has an org
      const { data: project } = await supabase.from('projects').select('created_by, organization_id').eq('id', projectId).single();
      
      if (project?.organization_id) {
        // Fetch all org members
        const { data: orgMembers } = await supabase.from('organization_members').select('user_id').eq('organization_id', project.organization_id);
        const userIds = new Set<string>();
        orgMembers?.forEach(m => userIds.add(m.user_id));
        if (project.created_by) userIds.add(project.created_by);
        
        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, full_name, username, avatar_url')
            .in('id', Array.from(userIds));
          if (profiles) setMembers(profiles);
        }
      } else {
        // Fallback: project members + creator
        const { data: projectMembers } = await supabase.from('project_members').select('user_id').eq('project_id', projectId);
        const userIds = new Set<string>();
        projectMembers?.forEach(m => userIds.add(m.user_id));
        if (project?.created_by) userIds.add(project.created_by);
        if (userIds.size > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, email, full_name, username, avatar_url')
            .in('id', Array.from(userIds));
          if (profiles) setMembers(profiles);
        }
      }
    } catch (error) { console.error('Error fetching project members:', error); }
  };

  const fetchActivityLog = async () => {
    try {
      const { data: activities } = await supabase.from('project_activity_log').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50);
      if (activities && activities.length > 0) {
        const userIds = [...new Set(activities.map(a => a.user_id))];
        const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('id', userIds);
        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        setActivityLog(activities.map(a => ({ ...a, user_profile: profileMap.get(a.user_id) })));
      }
    } catch (error) { console.error('Error fetching activity log:', error); }
  };

  const fetchReactions = async () => {
    try {
      const commentIds = comments.map(c => c.id);
      if (commentIds.length === 0) return;
      const { data } = await supabase.from('reactions').select('*').in('comment_id', commentIds);
      if (data) setReactions(data);
    } catch (error) { console.error('Error fetching reactions:', error); }
  };

  const handleAttachClick = () => { setClassifyDialogOpen(true); };

  const handleClassifyConfirm = () => {
    setPendingFile({ type: selectedType, uploading: false });
    setClassifyDialogOpen(false);
    setShowAttachment(true);
  };

  const handleUploadComplete = () => {
    setShowAttachment(false);
    setPendingFile(null);
    onAttachmentUploaded();
    fetchActivityLog();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const position = e.target.selectionStart || 0;
    setNewComment(value);
    setCursorPosition(position);
    const textBeforeCursor = value.slice(0, position);
    const atMatch = textBeforeCursor.match(/@(\w*)$/);
    if (atMatch) {
      setMentionSearch(atMatch[1]);
      setMentionOpen(true);
      setSelectedMentionIndex(0);
    } else {
      setMentionOpen(false);
    }
  };

  const getMentionDisplayName = (member: Profile) => {
    // Always prefer username for mentions (single word, no spaces)
    return member.username || member.email.split('@')[0];
  };

  const handleMentionSelect = (member: Profile) => {
    const textBeforeCursor = newComment.slice(0, cursorPosition);
    const textAfterCursor = newComment.slice(cursorPosition);
    const atIndex = textBeforeCursor.lastIndexOf('@');
    const mentionName = getMentionDisplayName(member);
    setNewComment(textBeforeCursor.slice(0, atIndex) + `@${mentionName} ` + textAfterCursor);
    setMentionOpen(false);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const commentContent = newComment.trim();
    await onSubmitComment(commentContent, null);
    // Trigger notifications for mentioned users
    await triggerMentionNotifications(commentContent);
    setNewComment('');
    fetchActivityLog();
  };

  const triggerMentionNotifications = async (content: string) => {
    if (!user) return;
    const mentionRegex = /@(\w+)/g;
    let match;
    const mentionedUsernames = new Set<string>();
    while ((match = mentionRegex.exec(content)) !== null) {
      mentionedUsernames.add(match[1].toLowerCase());
    }
    if (mentionedUsernames.size === 0) return;

    // Find mentioned users from members list
    for (const username of mentionedUsernames) {
      const mentionedMember = members.find(m =>
        m.username?.toLowerCase() === username ||
        m.email.split('@')[0].toLowerCase() === username
      );
      if (mentionedMember && mentionedMember.id !== user.id) {
        // Get current user profile for the notification
        const { data: myProfile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', user.id)
          .single();
        const senderName = myProfile?.full_name || myProfile?.username || 'Someone';
        
        // Create notification
        await supabase.from('notifications').insert({
          user_id: mentionedMember.id,
          type: 'mention',
          title: `${senderName} mentioned you`,
          message: content.length > 100 ? content.slice(0, 100) + '...' : content,
          link: `/project/${projectId}`,
        });

        // Create mention record
        // We need the comment id — fetch the latest comment by this user
        const { data: latestComment } = await supabase
          .from('comments')
          .select('id')
          .eq('project_id', projectId)
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (latestComment) {
          await supabase.from('mentions').insert({
            comment_id: latestComment.id,
            mentioned_user_id: mentionedMember.id,
          });
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => Math.min(prev + 1, filteredMembers.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        handleMentionSelect(filteredMembers[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        setMentionOpen(false);
        return;
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  const filteredMembers = members.filter(m => {
    if (m.id === user?.id) return false;
    const search = mentionSearch.toLowerCase();
    return (
      m.username?.toLowerCase().includes(search) ||
      m.full_name?.toLowerCase().includes(search) ||
      m.email.toLowerCase().includes(search)
    );
  });

  const renderContentWithMentions = (content: string) => {
    const mentionRegex = /@(\w+)/g;
    const parts = content.split(mentionRegex);
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        const isSelf = members.find(m =>
          m.username?.toLowerCase() === part.toLowerCase() ||
          m.full_name?.toLowerCase() === part.toLowerCase()
        )?.id === user?.id;
        return (
          <span key={i} className={cn(
            "text-primary font-medium italic",
            isSelf && "bg-primary/10 px-0.5 rounded"
          )}>
            @{part}
          </span>
        );
      }
      return part;
    });
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'status_changed': return GitCommit;
      case 'assigned': return User;
      case 'comment_added': case 'feedback_added': return MessageCircle;
      case 'output_uploaded': case 'attachment_uploaded': return Upload;
      default: return Clock;
    }
  };

  const getActionText = (activity: ActivityLog) => {
    const userName = activity.user_profile?.full_name || activity.user_profile?.email || 'Someone';
    switch (activity.action) {
      case 'status_changed': return `${userName} changed status from "${activity.details?.old_status}" to "${activity.details?.new_status}"`;
      case 'assigned': return `${userName} assigned the project`;
      case 'comment_added': return `${userName} added a comment`;
      case 'feedback_added': return `${userName} added feedback on a deliverable`;
      case 'output_uploaded': return `${userName} uploaded "${activity.details?.file_name}"`;
      case 'attachment_uploaded': return `${userName} attached "${activity.details?.file_name}"`;
      default: return `${userName} performed an action`;
    }
  };

  type TimelineItem =
    | { type: 'comment'; data: Comment; timestamp: string }
    | { type: 'activity'; data: ActivityLog; timestamp: string };

  const timelineItems: TimelineItem[] = [
    ...comments.filter(c => !c.output_id).map(c => ({ type: 'comment' as const, data: c, timestamp: c.created_at })),
    ...activityLog.filter(a => a.action !== 'comment_added' && a.action !== 'feedback_added').map(a => ({ type: 'activity' as const, data: a, timestamp: a.created_at })),
  ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <>
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="relative">
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <textarea
                      ref={inputRef}
                      placeholder="Start a discussion... Use @ to mention someone"
                      value={newComment}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      className="w-full min-h-[60px] px-3 py-2 text-sm rounded-md border border-input bg-background resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                      rows={2}
                    />
                    {mentionOpen && filteredMembers.length > 0 && (
                      <div className="absolute bottom-full left-0 mb-1 w-64 bg-popover border border-border rounded-md shadow-lg z-50">
                        <div className="p-1">
                          {filteredMembers.slice(0, 5).map((member, idx) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => handleMentionSelect(member)}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left",
                                idx === selectedMentionIndex && "bg-muted"
                              )}
                            >
                              <UserAvatar src={member.avatar_url} name={member.full_name} email={member.email} size="xs" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">
                                  {member.username ? `@${member.username}` : (member.full_name || member.email.split('@')[0])}
                                </div>
                                <div className="text-xs text-muted-foreground truncate">
                                  {member.full_name && member.username ? member.full_name : member.email}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button type="button" variant="outline" size="icon" onClick={handleAttachClick} title="Attach file">
                      <Paperclip className="h-4 w-4" />
                    </Button>
                    <Button type="submit" size="icon" disabled={submittingComment || !newComment.trim()}>
                      {submittingComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 block text-right">⌘+Enter to send</span>
              </div>

              {showAttachment && pendingFile && (
                <div className="border-2 border-dashed border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm">
                      {pendingFile.type === 'asset' ? (
                        <><FolderOpen className="h-4 w-4" /><span>Uploading as <strong>Resource</strong></span></>
                      ) : (
                        <><FileOutput className="h-4 w-4" /><span>Uploading as <strong>Deliverable</strong></span></>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setShowAttachment(false); setPendingFile(null); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <FileUpload projectId={projectId} type={pendingFile.type === 'asset' ? 'attachment' : 'output'} onUploadComplete={handleUploadComplete} compact />
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>

      {timelineItems.length === 0 ? (
        <div className="max-w-2xl mx-auto mt-4">
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No activity yet</h3>
              <p className="text-muted-foreground">Be the first to start a discussion about this project.</p>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto space-y-2 mt-4">
          {timelineItems.map((item) => {
            if (item.type === 'comment') {
              const comment = item.data;
              const commentReactions = reactions.filter(r => r.comment_id === comment.id);
              const commentReplies = comments.filter(c => c.parent_id === comment.id);
              return (
                <div key={`comment-${comment.id}`} className="group px-3 py-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <UserAvatar src={comment.profiles?.avatar_url} name={comment.profiles?.full_name} email={comment.profiles?.email} size="sm" className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{comment.profiles?.full_name || comment.profiles?.email}</span>
                        <span className="text-xs text-muted-foreground">{new Date(comment.created_at).toLocaleString()}</span>
                        <EmojiReactionPicker commentId={comment.id} reactions={commentReactions} onReactionChange={fetchReactions} compact />
                        {user && comment.user_id === user.id && (
                          <button
                            onClick={async () => {
                              try {
                                await supabase.from('comments').delete().eq('id', comment.id);
                                onSubmitComment('__refetch__', null).catch(() => {});
                              } catch (e) { console.error(e); }
                            }}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                            title="Delete comment"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <p className="text-sm mt-1">{renderContentWithMentions(comment.content)}</p>
                      <ThreadReplies parentMessage={comment} replies={commentReplies} onReplyAdded={() => { onSubmitComment('', null); }} type="comment" projectId={projectId} />
                    </div>
                  </div>
                </div>
              );
            } else {
              const activity = item.data;
              const ActionIcon = getActionIcon(activity.action);
              return (
                <div key={`activity-${activity.id}`} className="flex items-center gap-3 px-3 py-1.5 text-muted-foreground">
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                    <ActionIcon className="h-3 w-3" />
                  </div>
                  <span className="text-xs flex-1">{getActionText(activity)}</span>
                  <span className="text-xs whitespace-nowrap">{new Date(activity.created_at).toLocaleString()}</span>
                </div>
              );
            }
          })}
        </div>
      )}

      {/* Classify File Dialog */}
      <Dialog open={classifyDialogOpen} onOpenChange={setClassifyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Classify Your File</DialogTitle>
            <DialogDescription>Choose how to classify this file for better organization.</DialogDescription>
          </DialogHeader>
          <RadioGroup value={selectedType} onValueChange={(v) => setSelectedType(v as 'asset' | 'output')}>
            <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => setSelectedType('asset')}>
              <RadioGroupItem value="asset" id="asset" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="asset" className="cursor-pointer font-medium">Resource</Label>
                <p className="text-sm text-muted-foreground">Reference materials, briefs, source files, or supporting documents</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50" onClick={() => setSelectedType('output')}>
              <RadioGroupItem value="output" id="output" className="mt-1" />
              <div className="flex-1">
                <Label htmlFor="output" className="cursor-pointer font-medium">Deliverable</Label>
                <p className="text-sm text-muted-foreground">Final outputs, drafts, or work products for review</p>
              </div>
            </div>
          </RadioGroup>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClassifyDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleClassifyConfirm}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
