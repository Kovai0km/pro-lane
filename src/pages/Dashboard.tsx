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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Building2, FolderOpen, ArrowRight, Loader2, Calendar, Users, Clock, AlertTriangle, CheckCircle2, Send, Archive, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getStatusLabel, getStatusVariant, getStatusColor } from '@/components/ProjectStatusSelect';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  assigned_to: string | null;
  created_by: string;
  project_code: string | null;
  organizations?: { name: string } | null;
}

const STATUS_SECTIONS = [
  { key: 'my_drafts', label: 'My Drafts', statuses: ['draft'], icon: Archive, description: 'Projects you created but not yet assigned' },
  { key: 'assigned_to_me', label: 'Assigned to Me', statuses: ['assigned'], icon: Users, description: 'Tasks assigned to you awaiting action' },
  { key: 'in_progress', label: 'Active Tasks', statuses: ['on_progress', 'in_progress'], icon: Clock, description: 'Work currently in progress' },
  { key: 'pending_review', label: 'Pending Review', statuses: ['review'], icon: AlertTriangle, description: 'Submitted for review' },
  { key: 'needs_revision', label: 'Needs Revision', statuses: ['revision'], icon: ArrowDown, description: 'Changes requested' },
  { key: 'completed', label: 'Completed', statuses: ['completed'], icon: CheckCircle2, description: 'Completed and ready for approval' },
  { key: 'approved', label: 'Approved', statuses: ['approved'], icon: CheckCircle2, description: 'Approved and ready for delivery' },
  { key: 'delivered', label: 'Delivered', statuses: ['delivered'], icon: Send, description: 'Sent to client' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [totalTeams, setTotalTeams] = useState(0);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user) {
      Promise.all([fetchOrganizations(), fetchAllProjects(), fetchCounts()]).finally(() => setLoading(false));
    }
  }, [user]);

  const fetchOrganizations = async () => {
    const { data } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
    setOrganizations(data || []);
  };

  const fetchAllProjects = async () => {
    const { data } = await supabase
      .from('projects')
      .select('*, organizations(name)')
      .order('updated_at', { ascending: false });
    setAllProjects((data || []) as Project[]);
  };

  const fetchCounts = async () => {
    const { count: teamCount } = await supabase.from('teams').select('*', { count: 'exact', head: true });
    setTotalTeams(teamCount || 0);
  };

  const handleCreateOrganization = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !user) return;
    setCreating(true);
    try {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name: newOrgName.trim(), description: newOrgDescription.trim() || null, owner_id: user.id })
        .select()
        .single();
      if (orgError) throw orgError;
      await supabase.from('organization_members').insert({ organization_id: org.id, user_id: user.id, role: 'admin' });
      setOrganizations([org, ...organizations]);
      setCreateDialogOpen(false);
      setNewOrgName('');
      setNewOrgDescription('');
      toast({ title: 'Organization created', description: `${org.name} has been created successfully.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create organization.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  // Filter projects for each section
  const getProjectsForSection = (section: typeof STATUS_SECTIONS[0]) => {
    return allProjects.filter(p => {
      const matchesStatus = section.statuses.includes(p.status);
      if (section.key === 'my_drafts') return matchesStatus && p.created_by === user?.id;
      if (section.key === 'assigned_to_me') return matchesStatus && p.assigned_to === user?.id;
      return matchesStatus;
    });
  };

  const getOverdueProjects = () => {
    return allProjects.filter(p => 
      p.due_date && new Date(p.due_date) < new Date() && !['completed', 'delivered', 'closed'].includes(p.status)
    );
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return <ArrowUp className="h-3 w-3 text-destructive" />;
      case 'medium': return <Minus className="h-3 w-3 text-muted-foreground" />;
      case 'low': return <ArrowDown className="h-3 w-3 text-muted-foreground" />;
      default: return null;
    }
  };

  if (loading) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Overview' }]}>
        <div className="p-6 lg:p-8">
          <div className="mb-8 space-y-2">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-5 w-64" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const overdueProjects = getOverdueProjects();
  const recentProjects = allProjects.slice(0, 6);

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Overview' }]}>
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Overview</h1>
          <p className="text-muted-foreground">Your workspace at a glance.</p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 border-2 border-foreground flex items-center justify-center shrink-0">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{organizations.length}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Organizations</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 border-2 border-foreground flex items-center justify-center shrink-0">
                <FolderOpen className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{allProjects.length}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Projects</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="h-10 w-10 border-2 border-foreground flex items-center justify-center shrink-0">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{totalTeams}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Teams</div>
              </div>
            </CardContent>
          </Card>
          <Card className={overdueProjects.length > 0 ? 'border-destructive/50' : ''}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`h-10 w-10 border-2 flex items-center justify-center shrink-0 ${overdueProjects.length > 0 ? 'border-destructive text-destructive' : 'border-foreground'}`}>
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <div className="text-2xl font-bold font-mono">{overdueProjects.length}</div>
                <div className="text-xs text-muted-foreground uppercase tracking-wider">Overdue</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Overview / Workflow Board */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="workflow">Workflow Board</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            {/* Overdue Alert */}
            {overdueProjects.length > 0 && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2 text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Overdue Projects ({overdueProjects.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {overdueProjects.slice(0, 5).map(project => (
                      <Link key={project.id} to={`/project/${project.id}`} className="flex items-center justify-between p-2 rounded hover:bg-destructive/10 transition-colors">
                        <div className="flex items-center gap-2">
                          {getPriorityIcon(project.priority)}
                          <span className="text-sm font-medium">{project.title}</span>
                          {project.project_code && <span className="text-xs font-mono text-muted-foreground">{project.project_code}</span>}
                        </div>
                        <span className="text-xs text-destructive">Due {new Date(project.due_date!).toLocaleDateString()}</span>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Organizations */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Organizations</h2>
                <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm"><Plus className="mr-2 h-4 w-4" />New Organization</Button>
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
                          {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
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
                    <Button onClick={() => setCreateDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Create Organization</Button>
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
            <div>
              <h2 className="text-xl font-semibold mb-4">Recent Projects</h2>
              {recentProjects.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <FolderOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                    <p className="text-muted-foreground">No projects yet.</p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {recentProjects.map((project) => (
                    <Link key={project.id} to={`/project/${project.id}`}>
                      <Card className="h-full hover:bg-secondary/50 transition-colors cursor-pointer">
                        <CardHeader className="pb-2">
                          <div className="flex items-center gap-2">
                            <Badge variant={getStatusVariant(project.status)}>{getStatusLabel(project.status)}</Badge>
                          </div>
                          <CardTitle className="text-lg mt-2">{project.title}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-3">{project.description || 'No description'}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            {project.organizations?.name && <Badge variant="outline">{project.organizations.name}</Badge>}
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
          </TabsContent>

          {/* Workflow Board Tab */}
          <TabsContent value="workflow" className="space-y-6">
            <p className="text-sm text-muted-foreground">Projects automatically appear here based on their status. No manual sorting needed.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {STATUS_SECTIONS.map(section => {
                const projects = getProjectsForSection(section);
                const Icon = section.icon;
                return (
                  <Card key={section.key} className="flex flex-col">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {section.label}
                        <Badge variant="secondary" className="ml-auto">{projects.length}</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">{section.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1">
                      {projects.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">No projects</p>
                      ) : (
                        <ScrollArea className="max-h-[300px]">
                          <div className="space-y-2">
                            {projects.map(project => (
                              <Link key={project.id} to={`/project/${project.id}`}>
                                <div className="p-2 rounded border hover:bg-secondary/50 transition-colors cursor-pointer">
                                  <div className="flex items-center gap-2 mb-1">
                                    {getPriorityIcon(project.priority)}
                                    <span className="text-sm font-medium truncate">{project.title}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    {project.project_code && <span className="font-mono">{project.project_code}</span>}
                                    {project.organizations?.name && <span>• {project.organizations.name}</span>}
                                    {project.due_date && (
                                      <span className={new Date(project.due_date) < new Date() ? 'text-destructive' : ''}>
                                        • Due {new Date(project.due_date).toLocaleDateString()}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
