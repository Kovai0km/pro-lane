import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Hash, Search, Loader2, Users, ArrowLeft, MessageSquare } from 'lucide-react';

interface Channel {
  id: string;
  name: string;
  description?: string | null;
  memberCount?: number;
  lastMessageAt?: string;
}

export default function ChannelList() {
  const { orgId } = useParams<{ orgId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user && orgId) {
      fetchChannels();
    }
  }, [user, orgId]);

  const fetchChannels = async () => {
    if (!orgId) return;
    setLoading(true);

    try {
      const { data: teams, error } = await supabase
        .from('teams')
        .select('id, name, description')
        .eq('organization_id', orgId)
        .order('name');

      if (error) throw error;

      // Enrich with last message time and member count
      const enrichedChannels: Channel[] = [];
      for (const team of teams || []) {
        const { count: memberCount } = await supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id);

        const { data: lastMsg } = await supabase
          .from('messages')
          .select('created_at')
          .eq('team_id', team.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        enrichedChannels.push({
          ...team,
          memberCount: memberCount || 0,
          lastMessageAt: lastMsg?.created_at,
        });
      }

      // Sort by last activity
      enrichedChannels.sort((a, b) => {
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });

      setChannels(enrichedChannels);
    } catch (error) {
      console.error('Error fetching channels:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectChannel = (id: string) => {
    navigate(`/org/${orgId}?tab=chat&channel=team&id=${id}`);
  };

  const filteredChannels = channels.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (date?: string) => {
    if (!date) return 'No messages';
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Organization', href: `/org/${orgId}` },
        { label: 'Channels' },
      ]}
    >
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/org/${orgId}?tab=chat`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">All Channels</h1>
            <p className="text-sm text-muted-foreground">
              Browse and join team channels
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search channels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Channel List */}
        <div className="space-y-2">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1">
                    <Skeleton className="h-5 w-32 mb-1" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                </div>
              </div>
            ))
          ) : filteredChannels.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {searchQuery ? 'No channels found' : 'No channels yet'}
              </p>
            </div>
          ) : (
            filteredChannels.map((channel) => (
              <button
                key={channel.id}
                onClick={() => selectChannel(channel.id)}
                className="w-full p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Hash className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{channel.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Users className="h-3.5 w-3.5" />
                      <span>{channel.memberCount} members</span>
                      <span>•</span>
                      <span>{formatTime(channel.lastMessageAt)}</span>
                    </div>
                  </div>
                </div>
                {channel.description && (
                  <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                    {channel.description}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
