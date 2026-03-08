import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Users, FolderOpen, Loader2, UserPlus, ArrowRight } from 'lucide-react';

import { OrganizationSettings } from '@/components/OrganizationSettings';
import ChatPage from './Chat';
import TeamPage from './Team';

interface Organization {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
  created_at: string;
}

interface Team {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  job_type: string;
  status: string;
  due_date: string | null;
  created_at: string;
  team_id: string | null;
}



export default function OrganizationPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const tab = searchParams.get('tab');

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  // Team dialog state
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');

  useEffect(() => {
    if (user && orgId) {
      setLoading(true);
      Promise.all([fetchOrganization(), fetchTeams(), fetchProjects()]).finally(() => setLoading(false));
    }
  }, [user, orgId]);

  const fetchOrganization = async () => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgId)
        .single();

      if (error) throw error;
      setOrganization(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Organization not found or access denied.',
        variant: 'destructive',
      });
      navigate('/dashboard');
    }
  };

  const fetchTeams = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTeams(data || []);
    } catch (error: any) {
      console.error('Error fetching teams:', error);
    }
  };

  const fetchProjects = async () => {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('organization_id', orgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProjects(data || []);
    } catch (error: any) {
      console.error('Error fetching projects:', error);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTeamName.trim() || !orgId) return;

    setCreatingTeam(true);
    try {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          organization_id: orgId,
          name: newTeamName.trim(),
          description: newTeamDescription.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setTeams([data, ...teams]);
      setTeamDialogOpen(false);
      setNewTeamName('');
      setNewTeamDescription('');

      toast({
        title: 'Team created',
        description: `${data.name} has been created.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create team.',
        variant: 'destructive',
      });
    } finally {
      setCreatingTeam(false);
    }
  };

  const getStatusVariant = (status: string) => {
    const variants: Record<string, 'pending' | 'in-progress' | 'review' | 'completed'> = {
      pending: 'pending',
      on_progress: 'in-progress',
      review: 'review',
      completed: 'completed',
    };
    return variants[status] || 'outline';
  };

  const getJobTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      video_editing: 'Video Editing',
      design: 'Design',
      website: 'Website',
      other: 'Other',
    };
    return labels[type] || type;
  };

  if (loading) {
    return (
      <DashboardLayout title="Organization">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!organization) {
    return null;
  }

  // Handle different tabs
  if (tab === 'chat') {
    return <ChatPage />;
  }

  if (tab === 'teams') {
    return (
      <DashboardLayout
        breadcrumbs={[
          { label: organization.name, href: `/org/${orgId}` },
          { label: 'Teams' }
        ]}
      >
        <div className="p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">Teams</h1>
            <Dialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Team
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreateTeam}>
                  <DialogHeader>
                    <DialogTitle>Create Team</DialogTitle>
                    <DialogDescription>
                      Teams help organize members working on related projects.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="teamName">Name</Label>
                      <Input
                        id="teamName"
                        placeholder="Video Production"
                        value={newTeamName}
                        onChange={(e) => setNewTeamName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="teamDescription">Description (optional)</Label>
                      <Textarea
                        id="teamDescription"
                        placeholder="What does this team do?"
                        value={newTeamDescription}
                        onChange={(e) => setNewTeamDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setTeamDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={creatingTeam || !newTeamName.trim()}>
                      {creatingTeam && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {teams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No teams yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create teams to organize your members.
                </p>
                <Button onClick={() => setTeamDialogOpen(true)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Create Team
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teams.map((team) => (
                <Link key={team.id} to={`/team/${team.id}`}>
                  <Card className="hover:bg-secondary/50 transition-colors cursor-pointer group">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 border-2 border-foreground flex items-center justify-center">
                            <Users className="h-5 w-5" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{team.name}</CardTitle>
                            <CardDescription className="line-clamp-1">
                              {team.description || 'No description'}
                            </CardDescription>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  if (tab === 'settings') {
    return (
      <DashboardLayout
        breadcrumbs={[
          { label: organization.name, href: `/org/${orgId}` },
          { label: 'Settings' }
        ]}
      >
        <div className="p-6 lg:p-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Organization Settings</h1>
            <p className="text-muted-foreground">Manage your organization settings and members.</p>
          </div>
          
          <OrganizationSettings
              organization={organization}
              isOwner={organization.owner_id === user?.id}
              onUpdate={(updated) => setOrganization(updated as Organization)}
              onDelete={() => navigate('/dashboard')}
            />
        </div>
      </DashboardLayout>
    );
  }

  // Default: Overview page (projects)
  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: organization.name }
      ]}
    >
      <div className="p-6 lg:p-8">
        {/* Organization Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 border-2 border-foreground flex items-center justify-center text-xl font-bold">
                {organization.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{organization.name}</h1>
                <p className="text-muted-foreground text-sm">{organization.description || 'No description'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 border-2 border-foreground flex items-center justify-center">
                  <FolderOpen className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{projects.length}</p>
                  <p className="text-sm text-muted-foreground">Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 border-2 border-foreground flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{teams.length}</p>
                  <p className="text-sm text-muted-foreground">Teams</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 border-2 border-foreground flex items-center justify-center">
                  <FolderOpen className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {projects.filter(p => p.status === 'on_progress' || p.status === 'on_progress').length}
                  </p>
                  <p className="text-sm text-muted-foreground">Active</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Projects */}
        <div>
          <div className="flex items-center justify-between mb-4">
  <h2 className="text-lg font-semibold">Recent Projects</h2>
</div>
          
          {projects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                <p className="text-muted-foreground mb-4">
                  Go to the Project Hub to create your first project.
                </p>
                <Button asChild>
                  <Link to="/projects">
                    <Plus className="mr-2 h-4 w-4" />
                    Go to Project Hub
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {projects.slice(0, 5).map((project) => (
                <Link key={project.id} to={`/project/${project.id}`}>
                  <Card className="hover:bg-secondary/50 transition-colors cursor-pointer group">
                    <CardContent className="p-6">
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <h3 className="font-semibold">{project.title}</h3>
                            <Badge variant={getStatusVariant(project.status)}>
                              {project.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {project.description || 'No description'}
                          </p>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="font-mono">{getJobTypeLabel(project.job_type)}</span>
                            {project.due_date && (
                              <span>Due: {new Date(project.due_date).toLocaleDateString()}</span>
                            )}
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
