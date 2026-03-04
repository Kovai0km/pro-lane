import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Loader2, FileUp, MessageSquare, Video, Image, FileText, 
  Clock, User, Calendar, Edit2, Save, X, Send, Paperclip, ChevronDown,
  Download, Trash2, ArrowUp, ArrowDown, Minus, Copy, Check, Eye
} from 'lucide-react';
import { FileUpload } from '@/components/FileUpload';
import { FilePreview } from '@/components/FilePreview';
import { FileManager } from '@/components/file-manager';
import { ProjectStatusSelect, getStatusLabel, getStatusVariant, getStatusColor } from '@/components/ProjectStatusSelect';
import { ProjectAssignment } from '@/components/ProjectAssignment';
import { VideoPlayer, VideoPlayerRef } from '@/components/VideoPlayer';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DiscussionTab } from '@/components/project/DiscussionTab';
import { WorkflowRoles } from '@/components/project/WorkflowRoles';
import { WorkflowStepper } from '@/components/project/WorkflowStepper';

const PROJECT_STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'on_progress', label: 'On Progress' },
  { value: 'review', label: 'Review' },
  { value: 'revision', label: 'Revision' },
  { value: 'completed', label: 'Completed' },
  { value: 'approved', label: 'Approved' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'closed', label: 'Closed' },
] as const;

interface Project {
  id: string;
  title: string;
  description: string | null;
  job_type: string;
  job_type_custom: string | null;
  status: string;
  priority: 'high' | 'medium' | 'low';
  project_code: string | null;
  due_date: string | null;
  assigned_date: string | null;
  created_at: string;
  organization_id: string | null;
  team_id: string | null;
  created_by: string;
  assigned_to: string | null;
  reviewer_id: string | null;
  approver_id: string | null;
}

interface ProjectOutput {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  is_video: boolean;
  created_at: string;
  uploaded_by: string;
}

interface ProjectAttachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
  uploaded_by: string;
}

interface Comment {
  id: string;
  content: string;
  timecode: string | null;
  created_at: string;
  user_id: string;
  output_id: string | null;
  parent_id: string | null;
  profiles?: { full_name: string | null; email: string };
}


type ProjectStatus = 'draft' | 'pending' | 'assigned' | 'on_progress' | 'in_progress' | 'review' | 'revision' | 'completed' | 'approved' | 'delivered' | 'closed';

// Role-based workflow: which role controls which status transition
type WorkflowRole = 'owner' | 'assignee' | 'reviewer' | 'approver';

const STATUS_ROLE_MAP: Record<string, { allowedBy: WorkflowRole; transitions: string[] }> = {
  draft: { allowedBy: 'owner', transitions: ['assigned'] },
  assigned: { allowedBy: 'assignee', transitions: ['on_progress'] },
  on_progress: { allowedBy: 'assignee', transitions: ['review'] },
  review: { allowedBy: 'reviewer', transitions: ['revision', 'completed'] },
  revision: { allowedBy: 'assignee', transitions: ['on_progress', 'review'] },
  completed: { allowedBy: 'reviewer', transitions: ['approved'] },
  approved: { allowedBy: 'approver', transitions: ['delivered'] },
  delivered: { allowedBy: 'owner', transitions: ['closed'] },
  closed: { allowedBy: 'owner', transitions: [] },
  pending: { allowedBy: 'owner', transitions: ['assigned', 'draft'] },
  in_progress: { allowedBy: 'assignee', transitions: ['review'] },
};

// Helper Components
const PriorityBadge = ({ priority }: { priority: string }) => {
  switch (priority) {
    case 'high':
      return (
        <Badge variant="destructive" className="gap-1">
          <ArrowUp className="h-3 w-3" />
          High
        </Badge>
      );
    case 'medium':
      return (
        <Badge variant="secondary" className="gap-1">
          <Minus className="h-3 w-3" />
          Medium
        </Badge>
      );
    case 'low':
      return (
        <Badge variant="outline" className="gap-1">
          <ArrowDown className="h-3 w-3" />
          Low
        </Badge>
      );
    default:
      return null;
  }
};

const ProjectCodeBadge = ({ code }: { code: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 px-2 py-0.5 border border-border rounded text-xs font-mono text-muted-foreground hover:bg-muted transition-colors"
      title="Click to copy"
    >
      {code}
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
};

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const videoPlayerRef = useRef<VideoPlayerRef>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [outputs, setOutputs] = useState<ProjectOutput[]>([]);
  const [attachments, setAttachments] = useState<ProjectAttachment[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedProject, setEditedProject] = useState<Partial<Project>>({});
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // Comment state
  const [newComment, setNewComment] = useState('');
  const [selectedOutput, setSelectedOutput] = useState<string | null>(null);
  const [currentTimecode, setCurrentTimecode] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);
  const [hasVideoOutput, setHasVideoOutput] = useState(false);

  // File preview state
  const [previewFile, setPreviewFile] = useState<{
    fileName: string;
    fileUrl: string;
    fileType: string | null;
  } | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && projectId) {
      fetchProject();
      fetchOutputs();
      fetchAttachments();
      fetchComments();
    }
  }, [user, projectId]);

  const fetchProject = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (error) throw error;
      setProject(data);
      setEditedProject(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Project not found or access denied.',
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchOutputs = async () => {
    try {
      const { data, error } = await supabase
        .from('project_outputs')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOutputs(data || []);
    } catch (error: any) {
      console.error('Error fetching outputs:', error);
    }
  };

  const fetchAttachments = async () => {
    try {
      const { data, error } = await supabase
        .from('project_attachments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAttachments(data || []);
    } catch (error: any) {
      console.error('Error fetching attachments:', error);
    }
  };

  const fetchComments = async () => {
    try {
      const { data: commentsData, error } = await supabase
        .from('comments')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Fetch profile data for comments
      if (commentsData && commentsData.length > 0) {
        const userIds = [...new Set(commentsData.map(c => c.user_id))];
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        
        const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
        const commentsWithProfiles = commentsData.map(c => ({
          ...c,
          profiles: profilesMap.get(c.user_id) || { full_name: null, email: 'Unknown' }
        }));
        setComments(commentsWithProfiles);
      } else {
        setComments([]);
      }
    } catch (error: any) {
      console.error('Error fetching comments:', error);
    }
  };


  const handleSaveProject = async () => {
    if (!project) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({
          title: editedProject.title,
          description: editedProject.description,
          status: editedProject.status as ProjectStatus,
          due_date: editedProject.due_date,
        })
        .eq('id', project.id);

      if (error) throw error;

      setProject({ ...project, ...editedProject });
      setEditing(false);
      toast({
        title: 'Saved',
        description: 'Project updated successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save project.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Role-based workflow enforcement
  const getUserWorkflowRole = (): WorkflowRole | null => {
    if (!project || !user) return null;
    if (project.created_by === user.id) return 'owner';
    if (project.assigned_to === user.id) return 'assignee';
    if (project.reviewer_id === user.id) return 'reviewer';
    if (project.approver_id === user.id) return 'approver';
    return null;
  };

  const getNextStatuses = (currentStatus: string): string[] => {
    const userRole = getUserWorkflowRole();
    // Owner can always override
    if (userRole === 'owner') {
      return PROJECT_STATUSES.map(s => s.value).filter(s => s !== currentStatus);
    }
    const config = STATUS_ROLE_MAP[currentStatus];
    if (!config) return [];
    // Only allow if user has the right role
    if (userRole === config.allowedBy) return config.transitions;
    return [];
  };

  const canChangeStatus = (): boolean => {
    if (!project || project.status === 'closed') return false;
    const userRole = getUserWorkflowRole();
    if (!userRole) return false;
    if (userRole === 'owner') return true;
    const config = STATUS_ROLE_MAP[project.status];
    return config?.allowedBy === userRole && config.transitions.length > 0;
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!project) return;

    setStatusUpdating(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ status: newStatus as ProjectStatus })
        .eq('id', project.id);

      if (error) throw error;

      setProject({ ...project, status: newStatus });

      // Workflow-aware toast messages
      const workflowMessages: Record<string, string> = {
        assigned: 'Task has been assigned. The assignee will be notified.',
        on_progress: 'Work has started. The owner will be notified.',
        review: 'Submitted for review. The reviewer will be notified.',
        revision: 'Changes requested. The assignee will be notified.',
        completed: 'Work completed! The reviewer can now approve.',
        approved: 'Approved! The approver can now deliver.',
        delivered: 'Project delivered. The owner will be notified.',
        closed: 'Project closed and archived.',
      };

      toast({
        title: `Status → ${getStatusLabel(newStatus)}`,
        description: workflowMessages[newStatus] || `Project status changed to ${getStatusLabel(newStatus)}`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status.',
        variant: 'destructive',
      });
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDeleteOutput = async (outputId: string, fileUrl: string) => {
    try {
      // Delete from database
      const { error } = await supabase
        .from('project_outputs')
        .delete()
        .eq('id', outputId);

      if (error) throw error;

      setOutputs(outputs.filter(o => o.id !== outputId));
      if (selectedOutput === outputId) {
        setSelectedOutput(null);
      }
      toast({ title: 'Output deleted' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      const { error } = await supabase
        .from('project_attachments')
        .delete()
        .eq('id', attachmentId);

      if (error) throw error;

      setAttachments(attachments.filter(a => a.id !== attachmentId));
      toast({ title: 'Attachment deleted' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleDownload = (fileUrl: string, fileName: string) => {
    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const captureTimecode = () => {
    if (videoPlayerRef.current) {
      const time = videoPlayerRef.current.getCurrentTime();
      const hours = Math.floor(time / 3600);
      const minutes = Math.floor((time % 3600) / 60);
      const seconds = Math.floor(time % 60);
      const timecode = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      setCurrentTimecode(timecode);
    }
  };

  // Listen for seek-to-timecode events from clickable timestamps in comments
  useEffect(() => {
    const handleSeek = (e: CustomEvent) => {
      const tc = e.detail?.timecode;
      if (tc && videoPlayerRef.current) {
        const parts = tc.split(':').map(Number);
        let seconds = 0;
        if (parts.length === 3) seconds = parts[0] * 3600 + parts[1] * 60 + parts[2];
        else if (parts.length === 2) seconds = parts[0] * 60 + parts[1];
        videoPlayerRef.current.seekTo(seconds);
      }
    };
    window.addEventListener('seek-to-timecode', handleSeek as EventListener);
    return () => window.removeEventListener('seek-to-timecode', handleSeek as EventListener);
  }, []);

  // Update currentTimecode continuously from video player
  const handleTimeUpdate = (time: number) => {
    const hours = Math.floor(time / 3600);
    const minutes = Math.floor((time % 3600) / 60);
    const seconds = Math.floor(time % 60);
    setCurrentTimecode(`${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
  };

  // Check if any output is a video
  useEffect(() => {
    setHasVideoOutput(outputs.some(o => o.is_video || o.file_type?.startsWith('video') || o.file_type?.startsWith('audio')));
  }, [outputs]);

  // handleSubmitComment removed - now handled inline in each tab

  const getJobTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      video_editing: 'Video Editing',
      design: 'Design',
      website: 'Website',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const getFileIcon = (fileType: string | null, isVideo: boolean) => {
    if (isVideo) return Video;
    if (fileType?.startsWith('image')) return Image;
    return FileText;
  };

  if (authLoading || loading) {
    return (
      <DashboardLayout title="Project">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return null;
  }

  const selectedOutputData = outputs.find(o => o.id === selectedOutput);
  const isOwner = project.created_by === user?.id;

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        ...(project.organization_id ? [{ label: 'Organization', href: `/org/${project.organization_id}` }] : []),
        { label: project.title }
      ]}
    >
      <div className="p-6 lg:p-8">

        {/* Project Header */}
        <Card className="mb-8">
          <CardContent className="p-6">
            {editing ? (
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1 space-y-4">
                    <Input
                      value={editedProject.title || ''}
                      onChange={(e) => setEditedProject({ ...editedProject, title: e.target.value })}
                      className="text-xl font-bold"
                    />
                    <Textarea
                      value={editedProject.description || ''}
                      onChange={(e) => setEditedProject({ ...editedProject, description: e.target.value })}
                      rows={3}
                    />
                      <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <ProjectStatusSelect
                          value={editedProject.status || 'draft'}
                          onValueChange={(value) => setEditedProject({ ...editedProject, status: value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Due Date</Label>
                        <Input
                          type="date"
                          value={editedProject.due_date?.split('T')[0] || ''}
                          onChange={(e) => setEditedProject({ ...editedProject, due_date: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Button variant="outline" size="icon" onClick={() => setEditing(false)}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button size="icon" onClick={handleSaveProject} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex justify-between items-start">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-2xl font-bold">{project.title}</h1>
                    {/* Project Code */}
                    {project.project_code && (
                      <ProjectCodeBadge code={project.project_code} />
                    )}
                    {/* Priority Badge */}
                    <PriorityBadge priority={project.priority} />
                    {/* Status Dropdown - role-based workflow */}
                    {canChangeStatus() ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" disabled={statusUpdating} className="gap-2">
                            <span className={`h-2 w-2 rounded-full ${getStatusColor(project.status)}`} />
                            {getStatusLabel(project.status)}
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="bg-background border-2 border-foreground min-w-[180px]">
                          {(() => {
                            const nextStatuses = getNextStatuses(project.status);
                            return PROJECT_STATUSES.filter(s => nextStatuses.includes(s.value)).map((status) => (
                              <DropdownMenuItem
                                key={status.value}
                                onClick={() => handleStatusChange(status.value)}
                                className="gap-2 cursor-pointer"
                              >
                                <span className={`h-2 w-2 rounded-full ${getStatusColor(status.value)}`} />
                                {status.label}
                              </DropdownMenuItem>
                            ));
                          })()}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <Badge variant="outline" className="gap-2">
                        <span className={`h-2 w-2 rounded-full ${getStatusColor(project.status)}`} />
                        {getStatusLabel(project.status)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap break-words">
                    {project.description || 'No description'}
                  </p>
                  <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>{getJobTypeLabel(project.job_type)}</span>
                      {project.job_type_custom && <span>({project.job_type_custom})</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                    </div>
                    {project.due_date && (
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>Due {new Date(project.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                  {/* Workflow Role Assignments */}
                  {isOwner && (
                    <WorkflowRoles
                      project={project}
                      onUpdated={fetchProject}
                    />
                  )}
                </div>
                <div className="flex gap-2">
                  {isOwner && (
                    <Button variant="outline" size="default" className="h-10 px-4" onClick={() => setEditing(true)}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="discussion" className="space-y-6">
          <TabsList className="border-2 border-foreground p-1 bg-transparent">
            <TabsTrigger value="discussion" className="data-[state=active]:bg-foreground data-[state=active]:text-background">
              <MessageSquare className="mr-2 h-4 w-4" />
              Discussion ({comments.filter(c => !c.output_id).length})
            </TabsTrigger>
            <TabsTrigger value="attachments" className="data-[state=active]:bg-foreground data-[state=active]:text-background">
              <Paperclip className="mr-2 h-4 w-4" />
              Resources ({attachments.length})
            </TabsTrigger>
            <TabsTrigger value="deliverables" className="data-[state=active]:bg-foreground data-[state=active]:text-background">
              <FileUp className="mr-2 h-4 w-4" />
              Deliverables ({outputs.length})
            </TabsTrigger>
          </TabsList>

          {/* Discussion Tab */}
          <TabsContent value="discussion" className="space-y-4">
            <DiscussionTab
              projectId={projectId!}
              comments={comments.filter(c => !c.output_id)}
              submittingComment={submittingComment}
              onSubmitComment={async (content: string, timecode?: string | null) => {
                if (content === '__refetch__') { fetchComments(); return; }
                if (!content.trim() || !user || !projectId) return;
                setSubmittingComment(true);
                try {
                  const { data, error } = await supabase
                    .from('comments')
                    .insert({
                      project_id: projectId,
                      output_id: null,
                      user_id: user.id,
                      content: content.trim(),
                      timecode: timecode || null,
                    })
                    .select('*')
                    .single();
                  if (error) throw error;
                  const { data: profileData } = await supabase
                    .from('profiles')
                    .select('full_name, email')
                    .eq('id', user.id)
                    .single();
                  const newCommentWithProfile: Comment = {
                    ...data,
                    profiles: profileData || { full_name: null, email: user.email || 'Unknown' }
                  };
                  setComments([...comments, newCommentWithProfile]);
                  toast({ title: 'Comment added' });
                } catch (error: any) {
                  toast({ title: 'Error', description: error.message, variant: 'destructive' });
                } finally {
                  setSubmittingComment(false);
                }
              }}
              onAttachmentUploaded={() => { fetchAttachments(); fetchOutputs(); }}
              user={user}
              currentTimecode={currentTimecode}
              onCaptureTimecode={captureTimecode}
              hasMediaPlayer={hasVideoOutput}
            />
          </TabsContent>

          {/* Deliverables Tab */}
          <TabsContent value="deliverables" className="space-y-6">
            <FileManager projectId={projectId!} type="deliverables" />
          </TabsContent>

          {/* Resources Tab */}
          <TabsContent value="attachments" className="space-y-4">
            <FileManager projectId={projectId!} type="resources" />
          </TabsContent>
        </Tabs>

        {/* File Preview Modal */}
        {previewFile && (
          <FilePreview
            isOpen={!!previewFile}
            onClose={() => setPreviewFile(null)}
            fileName={previewFile.fileName}
            fileUrl={previewFile.fileUrl}
            fileType={previewFile.fileType}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
