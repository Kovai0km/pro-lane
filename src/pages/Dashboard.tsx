import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, FolderOpen, ArrowRight, Loader2, Calendar, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getStatusLabel, getStatusVariant } from '@/components/ProjectStatusSelect';
import { Skeleton } from '@/components/ui/skeleton';

interface Organization {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  owner_id: string;
}

interface Project {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  job_type: string;
  organization_id: string | null;
  organizations?: { name: string } | null;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [recentProjects, setRecentProjects] = useState<Project[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [totalTeams, setTotalTeams] = useState(0);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');

  useEffect(() => {
    if (user) {
      Promise.all([fetchOrganizations(), fetchRecentProjects(), fetchCounts()]).finally(() => setLoading(false));
    }
  }, [user]);

  const fetchOrganizations = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('*')
      .order('created_at', { ascending: false });
    setOrganizations(data || []);
  };

  const fetchRecentProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*, organizations(name)')
      .order('created_at', { ascending: false })
      .limit(6);
    setRecentProjects((data || []) as Project[]);
  };

  const fetchCounts = async () => {
    const [{ count: projectCount }, { count: teamCount }] = await Promise.all([
      supabase.from('projects').select('*', { count: 'exact', head: true }),
      supabase.from('teams').select('*', { count: 'exact', head: true }),
    ]);
    setTotalProjects(projectCount || 0);
    setTotalTeams(teamCount || 0);
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !user) return;

    setCreating(true);
    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: newOrgName.trim(),
          description: newOrgDescription.trim() || null,
          owner_id: user.id,
        })
        .select()
        .single();

      if (orgError) throw orgError;

      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          organization_id: org.id,
          user_id: user.id,
          role: 'admin',
        });

      if (memberError) throw memberError;

      setOrganizations([org, ...organizations]);
      setCreateDialogOpen(false);
      setNewOrgName('');
      setNewOrgDescription('');

      toast({
        title: 'Organization created',
        description: `${org.name} has been created successfully.`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create organization.',
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
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
      <DashboardLayout breadcrumbs={[{ label: 'Overview' }]}>
        <div className="p-6 lg:p-8">
          <div className="mb-8 space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            {[...Array(3)].map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6 flex items-center gap-4">
                  <Skeleton className="h-12 w-12" />
                  <div className="space-y-2">
                    <Skeleton className="h-8 w-12" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="mb-8 space-y-4">
            <Skeleton className="h-6 w-32" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <Card key={i}>
                  <CardHeader className="space-y-3">
                    <Skeleton className="h-10 w-10" />
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Overview' }]}>
      <div className="p-6 lg:p-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Overview</h1>
          <p className="text-muted-foreground">A quick look at your workspace.</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 border-2 border-foreground flex items-center justify-center">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="text-3xl font-bold font-mono">{organizations.length}</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider">Organizations</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 border-2 border-foreground flex items-center justify-center">
                <FolderOpen className="h-6 w-6" />
              </div>
              <div>
                <div className="text-3xl font-bold font-mono">{totalProjects}</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider">Projects</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 border-2 border-foreground flex items-center justify-center">
                <Users className="h-6 w-6" />
              </div>
              <div>
                <div className="text-3xl font-bold font-mono">{totalTeams}</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider">Teams</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Organizations */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Organizations</h2>
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Organization
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleCreateOrganization}>
                  <DialogHeader>
                    <DialogTitle>Create Organization</DialogTitle>
                    <DialogDescription>Organizations help you group teams and projects together.</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input id="name" placeholder="Acme Agency" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description (optional)</Label>
                      <Textarea id="description" placeholder="A brief description..." value={newOrgDescription} onChange={(e) => setNewOrgDescription(e.target.value)} rows={3} />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
                    <Button type="submit" disabled={creating || !newOrgName.trim()}>
                      {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Create
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {organizations.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
                <p className="text-muted-foreground mb-4">Create your first organization to start managing projects.</p>
                <Button onClick={() => setCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> Create Organization
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {organizations.map((org) => (
                <Link key={org.id} to={`/org/${org.id}`}>
                  <Card className="h-full hover:bg-secondary/50 transition-colors cursor-pointer group">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="h-10 w-10 border-2 border-foreground flex items-center justify-center text-lg font-bold">
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                      </div>
                      <CardTitle className="mt-4">{org.name}</CardTitle>
                      <CardDescription className="line-clamp-2">{org.description || 'No description'}</CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Projects */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Recent Projects</h2>
          </div>

          {recentProjects.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center">
                <FolderOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No projects yet. Create one from an organization.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentProjects.map((project) => (
                <Link key={project.id} to={`/project/${project.id}`}>
                  <Card className="h-full hover:bg-secondary/50 transition-colors cursor-pointer group">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(project.status)}>
                          {getStatusLabel(project.status)}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg mt-2">{project.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {project.description || 'No description'}
                      </p>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">{getJobTypeLabel(project.job_type)}</Badge>
                        {project.organizations?.name && (
                          <Badge variant="outline">{project.organizations.name}</Badge>
                        )}
                        {project.due_date && (
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Due {new Date(project.due_date).toLocaleDateString()}</span>
                          </div>
                        )}
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
