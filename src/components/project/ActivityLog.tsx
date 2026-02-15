import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Badge } from '@/components/ui/badge';
import { Activity, FileUp, MessageSquare, UserPlus, RefreshCw, Paperclip } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivityEntry {
  id: string;
  action: string;
  details: any;
  created_at: string;
  user_id: string;
  profile?: { full_name: string | null; email: string; avatar_url: string | null };
}

const ACTION_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  status_changed: { icon: RefreshCw, label: 'Status changed', color: 'text-blue-500' },
  assigned: { icon: UserPlus, label: 'Assigned', color: 'text-green-500' },
  comment_added: { icon: MessageSquare, label: 'Comment added', color: 'text-purple-500' },
  feedback_added: { icon: MessageSquare, label: 'Feedback added', color: 'text-orange-500' },
  output_uploaded: { icon: FileUp, label: 'Deliverable uploaded', color: 'text-emerald-500' },
  attachment_uploaded: { icon: Paperclip, label: 'Attachment uploaded', color: 'text-cyan-500' },
};

export function ActivityLog({ projectId }: { projectId: string }) {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [projectId]);

  const fetchActivities = async () => {
    try {
      const { data, error } = await supabase
        .from('project_activity_log')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      if (data && data.length > 0) {
        const userIds = [...new Set(data.map(a => a.user_id))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, email, avatar_url')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
        setActivities(data.map(a => ({
          ...a,
          profile: profileMap.get(a.user_id),
        })));
      } else {
        setActivities([]);
      }
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

  const getActionDetails = (entry: ActivityEntry) => {
    const details = entry.details as any;
    switch (entry.action) {
      case 'status_changed':
        return `from ${details?.old_status || '?'} to ${details?.new_status || '?'}`;
      case 'output_uploaded':
      case 'attachment_uploaded':
        return details?.file_name || '';
      default:
        return '';
    }
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

  if (loading) {
    return (
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="h-5 w-5" />Activity</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/4" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          Activity ({activities.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No activity yet</p>
        ) : (
          <ScrollArea className="max-h-[400px]">
            <div className="space-y-4">
              {activities.map((entry) => {
                const config = ACTION_CONFIG[entry.action] || { icon: Activity, label: entry.action, color: 'text-muted-foreground' };
                const Icon = config.icon;
                const extraDetails = getActionDetails(entry);

                return (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div className={`mt-0.5 ${config.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">
                          {entry.profile?.full_name || entry.profile?.email?.split('@')[0] || 'Unknown'}
                        </span>
                        {' '}
                        <span className="text-muted-foreground">{config.label}</span>
                        {extraDetails && (
                          <span className="text-muted-foreground"> — {extraDetails}</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{formatTime(entry.created_at)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
