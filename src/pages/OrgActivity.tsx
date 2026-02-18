import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Activity, FileUp, MessageSquare, UserPlus, RefreshCw, Paperclip, ShieldAlert, Loader2, FolderPlus, Users, Settings } from 'lucide-react';

interface ActivityEntry {
  id: string;
  action: string;
  details: any;
  created_at: string;
  user_id: string;
  project_id: string;
  project_title?: string;
  profile?: { full_name: string | null; email: string; avatar_url: string | null };
}

const ACTION_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  status_changed: { icon: RefreshCw, label: 'Changed project status', color: 'text-blue-500' },
  assigned: { icon: UserPlus, label: 'Assigned project', color: 'text-green-500' },
  comment_added: { icon: MessageSquare, label: 'Added a comment', color: 'text-purple-500' },
  feedback_added: { icon: MessageSquare, label: 'Added feedback', color: 'text-orange-500' },
  output_uploaded: { icon: FileUp, label: 'Uploaded deliverable', color: 'text-emerald-500' },
  attachment_uploaded: { icon: Paperclip, label: 'Uploaded attachment', color: 'text-cyan-500' },
  project_created: { icon: FolderPlus, label: 'Created a project', color: 'text-primary' },
  member_added: { icon: Users, label: 'Added a member', color: 'text-green-500' },
  member_removed: { icon: Users, label: 'Removed a member', color: 'text-destructive' },
  settings_updated: { icon: Settings, label: 'Updated settings', color: 'text-muted-foreground' },
};

export default function OrgActivityPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [orgName, setOrgName] = useState('');

  useEffect(() => { if (user && orgId) checkAdminAndFetch(); }, [user, orgId]);

  const checkAdminAndFetch = async () => {
    const { data: membership } = await supabase.from('organization_members').select('role').eq('organization_id', orgId!).eq('user_id', user!.id).single();
    if (!membership || membership.role !== 'admin') { setIsAdmin(false); setLoading(false); return; }
    setIsAdmin(true);

    const { data: org } = await supabase.from('organizations').select('name').eq('id', orgId!).single();
    if (org) setOrgName(org.name);

    const { data: projects } = await supabase.from('projects').select('id, title').eq('organization_id', orgId!);
    if (!projects || projects.length === 0) { setLoading(false); return; }

    const projectIds = projects.map(p => p.id);
    const projectMap = new Map(projects.map(p => [p.id, p.title]));

    const { data: activityData } = await supabase.from('project_activity_log').select('*').in('project_id', projectIds).order('created_at', { ascending: false }).limit(200);
    if (activityData && activityData.length > 0) {
      const userIds = [...new Set(activityData.map(a => a.user_id))];
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, email, avatar_url').in('id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      setActivities(activityData.map(a => ({ ...a, project_title: projectMap.get(a.project_id) || 'Unknown', profile: profileMap.get(a.user_id) })));
    }
    setLoading(false);
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  const getActionDetails = (entry: ActivityEntry) => {
    const details = entry.details as any;
    switch (entry.action) {
      case 'status_changed': return `from "${details?.old_status}" to "${details?.new_status}"`;
      case 'output_uploaded': case 'attachment_uploaded': return details?.file_name || '';
      case 'assigned': return details?.assigned_to_name || '';
      case 'member_added': return details?.member_name || '';
      default: return '';
    }
  };

  const getNavigationLink = (entry: ActivityEntry) => {
    return `/project/${entry.project_id}`;
  };

  if (loading) {
    return (<DashboardLayout title="Activity"><div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>);
  }

  if (!isAdmin) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Activity' }]}>
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <ShieldAlert className="h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">Admin Only</h1>
          <p className="text-muted-foreground">Only organization admins can view the activity log.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: orgName, href: `/org/${orgId}` }, { label: 'Activity' }]}>
      <div className="p-6 lg:p-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Organization Activity ({activities.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No activity yet</p>
            ) : (
              <ScrollArea className="max-h-[600px]">
                <div className="space-y-3">
                  {activities.map((entry) => {
                    const config = ACTION_CONFIG[entry.action] || { icon: Activity, label: entry.action, color: 'text-muted-foreground' };
                    const Icon = config.icon;
                    const extraDetails = getActionDetails(entry);

                    return (
                      <button key={entry.id} onClick={() => navigate(getNavigationLink(entry))} className="flex items-start gap-3 w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <div className={`mt-0.5 ${config.color}`}><Icon className="h-4 w-4" /></div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <UserAvatar src={entry.profile?.avatar_url} name={entry.profile?.full_name} email={entry.profile?.email} size="xs" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm">
                            <span className="font-medium">{entry.profile?.full_name || entry.profile?.email?.split('@')[0] || 'Unknown'}</span>
                            {' '}
                            <span className="text-muted-foreground">{config.label}</span>
                            {extraDetails && <span className="text-muted-foreground"> — {extraDetails}</span>}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="text-primary">{entry.project_title}</span>
                            {' · '}
                            {formatTime(entry.created_at)}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
