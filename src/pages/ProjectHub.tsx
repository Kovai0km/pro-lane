import { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { FolderOpen, Search, Filter, Calendar, ArrowRight, Loader2, Plus, ArrowUp, ArrowDown, Minus, HardDrive, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { getStatusLabel, getStatusVariant } from '@/components/ProjectStatusSelect';
import { formatStorageSize } from '@/hooks/useStorageUsage';

interface Project {
  id: string;
  title: string;
  description: string | null;
  job_type: string;
  status: string;
  priority: 'high' | 'medium' | 'low';
  project_code: string | null;
  due_date: string | null;
  created_at: string;
  organization_id: string | null;
  organizations?: { name: string } | null;
  storage_bytes?: number;
}

interface Organization {
  id: string;
  name: string;
}

interface Team {
  id: string;
  name: string;
  organization_id: string;
}

type JobType = 'video_editing' | 'design' | 'website' | 'other';
type Priority = 'high' | 'medium' | 'low';

const PAGE_SIZE = 12;

const JOB_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: 'video_editing', label: 'Video Editing' },
  { value: 'design', label: 'Design' },
  { value: 'website', label: 'Website' },
  { value: 'other', label: 'Other' },
];

const STATUSES = [
  { value: 'all', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'on_progress', label: 'On Progress' },
  { value: 'review', label: 'Review' },
  { value: 'revision', label: 'Revision' },
  { value: 'completed', label: 'Completed' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'closed', label: 'Closed' },
];

const PRIORITIES = [
  { value: 'all', label: 'All Priorities' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function ProjectHub() {
  const { orgId } = useParams<{ orgId?: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState<Organization | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [jobTypeFilter, setJobTypeFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'created_at' | 'due_date' | 'title' | 'priority'>('created_at');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => (localStorage.getItem('projectHubView') as 'grid' | 'list') || 'grid');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Project dialog state
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [newProject, setNewProject] = useState({
    title: '',
    description: '',
    job_type: 'other' as JobType,
    job_type_custom: '',
    priority: 'medium' as Priority,
    team_id: '',
    due_date: '',
  });

  useEffect(() => {
    localStorage.setItem('projectHubView', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (user) {
      setLoading(true);
      const fetches: Promise<void>[] = [fetchProjects(), fetchTeams()];
      if (orgId) fetches.push(fetchOrganization());
      Promise.all(fetches).finally(() => setLoading(false));
    }
  }, [user, orgId, currentPage, statusFilter, jobTypeFilter, priorityFilter, sortBy, searchQuery]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, jobTypeFilter, priorityFilter, searchQuery]);

  const fetchOrganization = async () => {
    if (!orgId) return;
    const { data } = await supabase.from('organizations').select('id, name').eq('id', orgId).single();
    if (data) setOrganization(data);
  };

  const fetchProjects = async () => {
    try {
      let query = supabase.from('projects').select('*, organizations(name)', { count: 'exact' });
      if (orgId) query = query.eq('organization_id', orgId);
      
      // Apply filters
      if (statusFilter !== 'all') query = query.eq('status', statusFilter as any);
      if (jobTypeFilter !== 'all') query = query.eq('job_type', jobTypeFilter as any);
      if (priorityFilter !== 'all') query = query.eq('priority', priorityFilter as any);
      if (searchQuery.trim()) {
        query = query.or(`title.ilike.%${searchQuery}%,project_code.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`);
      }

      // Sort
      const ascending = sortBy === 'title' || sortBy === 'due_date';
      query = query.order(sortBy === 'priority' ? 'priority' : sortBy, { ascending });

      // Paginate
      const from = (currentPage - 1) * PAGE_SIZE;
      query = query.range(from, from + PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      
      setTotalCount(count || 0);
      const projectsData = (data || []) as Project[];
      
      if (projectsData.length > 0) {
        const projectIds = projectsData.map(p => p.id);
        const [{ data: outputs }, { data: attachments }] = await Promise.all([
          supabase.from('project_outputs').select('project_id, file_size').in('project_id', projectIds),
          supabase.from('project_attachments').select('project_id, file_size').in('project_id', projectIds),
        ]);
        const storageTotals: Record<string, number> = {};
        outputs?.forEach(o => { storageTotals[o.project_id] = (storageTotals[o.project_id] || 0) + (o.file_size || 0); });
        attachments?.forEach(a => { storageTotals[a.project_id] = (storageTotals[a.project_id] || 0) + (a.file_size || 0); });
        projectsData.forEach(p => { p.storage_bytes = storageTotals[p.id] || 0; });
      }
      setProjects(projectsData);
    } catch (error: any) {
      toast({ title: 'Error', description: 'Failed to load projects.', variant: 'destructive' });
    }
  };

  const fetchTeams = async () => {
    let query = supabase.from('teams').select('id, name, organization_id').order('name');
    if (orgId) query = query.eq('organization_id', orgId);
    const { data } = await query;
    if (data) setTeams(data);
  };

  const resetProjectDialog = () => {
    setNewProject({ title: '', description: '', job_type: 'other', job_type_custom: '', priority: 'medium', team_id: '', due_date: '' });
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.title.trim() || !orgId || !user) return;
    setCreatingProject(true);
    try {
      const { data, error } = await supabase
        .from('projects')
        .insert({
          organization_id: orgId,
          team_id: newProject.team_id || null,
          title: newProject.title.trim(),
          description: newProject.description.trim() || null,
          job_type: newProject.job_type,
          job_type_custom: newProject.job_type === 'other' ? newProject.job_type_custom : null,
          priority: newProject.priority,
          due_date: newProject.due_date || null,
          created_by: user.id,
        })
        .select('*, organizations(name)')
        .single();
      if (error) throw error;
      await supabase.from('project_members').insert({ project_id: data.id, user_id: user.id, role: 'owner' });
      setProjectDialogOpen(false);
      resetProjectDialog();
      toast({ title: 'Project created', description: `${data.title} has been created.` });
      navigate(`/project/${data.id}`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create project.', variant: 'destructive' });
    } finally {
      setCreatingProject(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'high': return <Badge variant="destructive" className="gap-1"><ArrowUp className="h-3 w-3" />High</Badge>;
      case 'medium': return <Badge variant="secondary" className="gap-1"><Minus className="h-3 w-3" />Medium</Badge>;
      case 'low': return <Badge variant="outline" className="gap-1"><ArrowDown className="h-3 w-3" />Low</Badge>;
      default: return null;
    }
  };

  const getJobTypeLabel = (type: string) => {
    const labels: Record<string, string> = { video_editing: 'Video Editing', design: 'Design', website: 'Website', other: 'Other' };
    return labels[type] || type;
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const canCreateProject = !!orgId;

  if (loading) {
    return (
      <DashboardLayout title="Project Hub">
        <div className="p-6 lg:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <Skeleton className="h-8 w-64 mb-2" />
              <Skeleton className="h-4 w-96" />
            </div>
            <Skeleton className="h-10 w-32" />
          </div>
          <Card><CardContent className="p-4"><Skeleton className="h-10 w-full" /></CardContent></Card>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => (
              <Card key={i}><CardContent className="p-6 space-y-3">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent></Card>
            ))}
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const breadcrumbs = orgId && organization
    ? [{ label: organization.name, href: `/org/${orgId}` }, { label: 'Projects' }]
    : [{ label: 'All Projects' }];

  return (
    <DashboardLayout breadcrumbs={breadcrumbs}>
      <div className="p-6 lg:p-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">{organization ? `${organization.name} Projects` : 'All Projects'}</h1>
            <p className="text-muted-foreground">
              {organization ? 'View and manage projects for this organization.' : 'View all your projects across organizations.'}
              {totalCount > 0 && <span className="ml-2 text-sm">({totalCount} total)</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button variant={viewMode === 'grid' ? 'default' : 'ghost'} size="icon" className="rounded-none h-9 w-9" onClick={() => setViewMode('grid')}>
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="icon" className="rounded-none h-9 w-9" onClick={() => setViewMode('list')}>
                <List className="h-4 w-4" />
              </Button>
            </div>
            {canCreateProject && (
              <Dialog open={projectDialogOpen} onOpenChange={(open) => { setProjectDialogOpen(open); if (!open) resetProjectDialog(); }}>
                <DialogTrigger asChild>
                  <Button><Plus className="mr-2 h-4 w-4" />New Project</Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <form onSubmit={handleCreateProject}>
                    <DialogHeader>
                      <DialogTitle>Create New Project</DialogTitle>
                      <DialogDescription>Fill in the details to create a new project.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Title</Label>
                        <Input id="title" placeholder="Brand Video Campaign" value={newProject.title} onChange={(e) => setNewProject({ ...newProject, title: e.target.value })} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" placeholder="Project details..." value={newProject.description} onChange={(e) => setNewProject({ ...newProject, description: e.target.value })} rows={3} />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Job Type</Label>
                          <Select value={newProject.job_type} onValueChange={(value: JobType) => setNewProject({ ...newProject, job_type: value })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="video_editing">Video Editing</SelectItem>
                              <SelectItem value="design">Design</SelectItem>
                              <SelectItem value="website">Website</SelectItem>
                              <SelectItem value="other">Other</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Priority</Label>
                          <Select value={newProject.priority} onValueChange={(value: Priority) => setNewProject({ ...newProject, priority: value })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="high"><div className="flex items-center gap-2"><ArrowUp className="h-4 w-4 text-destructive" />High</div></SelectItem>
                              <SelectItem value="medium"><div className="flex items-center gap-2"><Minus className="h-4 w-4" />Medium</div></SelectItem>
                              <SelectItem value="low"><div className="flex items-center gap-2"><ArrowDown className="h-4 w-4 text-muted-foreground" />Low</div></SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      {newProject.job_type === 'other' && (
                        <div className="space-y-2">
                          <Label>Custom Type</Label>
                          <Input placeholder="e.g., Animation" value={newProject.job_type_custom} onChange={(e) => setNewProject({ ...newProject, job_type_custom: e.target.value })} />
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Team (optional)</Label>
                          <Select value={newProject.team_id || "none"} onValueChange={(value) => setNewProject({ ...newProject, team_id: value === "none" ? "" : value })}>
                            <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No team</SelectItem>
                              {teams.map((team) => (<SelectItem key={team.id} value={team.id}>{team.name}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Due Date</Label>
                          <Input type="date" value={newProject.due_date} onChange={(e) => setNewProject({ ...newProject, due_date: e.target.value })} />
                        </div>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setProjectDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={creatingProject || !newProject.title.trim()}>
                        {creatingProject && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create Project
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search projects by name or ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[140px]"><Filter className="mr-2 h-4 w-4" /><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>{STATUSES.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}</SelectContent>
                </Select>
                <Select value={jobTypeFilter} onValueChange={setJobTypeFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Job Type" /></SelectTrigger>
                  <SelectContent>{JOB_TYPES.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}</SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => (<SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>))}</SelectContent>
                </Select>
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                  <SelectTrigger className="w-[140px]"><SelectValue placeholder="Sort by" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at">Newest First</SelectItem>
                    <SelectItem value="due_date">Due Date</SelectItem>
                    <SelectItem value="title">Title (A-Z)</SelectItem>
                    <SelectItem value="priority">Priority</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Projects */}
        {projects.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-semibold mb-2">No projects found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery || statusFilter !== 'all' || jobTypeFilter !== 'all' || priorityFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first project to get started'}
              </p>
              {canCreateProject && (
                <Button onClick={() => setProjectDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />New Project</Button>
              )}
            </CardContent>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map((project) => (
              <Link key={project.id} to={`/project/${project.id}`}>
                <Card className="h-full hover:bg-secondary/50 transition-colors cursor-pointer group">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={getStatusVariant(project.status)}>{getStatusLabel(project.status)}</Badge>
                        {getPriorityBadge(project.priority)}
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-1 transition-transform" />
                    </div>
                    <CardTitle className="text-lg mt-2">{project.title}</CardTitle>
                    {project.project_code && <p className="text-xs font-mono text-muted-foreground">{project.project_code}</p>}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-4">{project.description || 'No description'}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline">{getJobTypeLabel(project.job_type)}</Badge>
                      {project.organizations?.name && <Badge variant="outline">{project.organizations.name}</Badge>}
                      {project.due_date && (
                        <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /><span>Due {new Date(project.due_date).toLocaleDateString()}</span></div>
                      )}
                      {(project.storage_bytes || 0) > 0 && (
                        <div className="flex items-center gap-1"><HardDrive className="h-3 w-3" /><span>{formatStorageSize(project.storage_bytes || 0)}</span></div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="cursor-pointer" onClick={() => setSortBy('title')}>Project {sortBy === 'title' && '↑'}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="cursor-pointer" onClick={() => setSortBy('due_date')}>Due Date {sortBy === 'due_date' && '↑'}</TableHead>
                  <TableHead>Storage</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/project/${project.id}`)}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{project.title}</div>
                        {project.project_code && <div className="text-xs font-mono text-muted-foreground">{project.project_code}</div>}
                        {project.organizations?.name && <div className="text-xs text-muted-foreground">{project.organizations.name}</div>}
                      </div>
                    </TableCell>
                    <TableCell><Badge variant={getStatusVariant(project.status)}>{getStatusLabel(project.status)}</Badge></TableCell>
                    <TableCell>{getPriorityBadge(project.priority)}</TableCell>
                    <TableCell><span className="text-sm text-muted-foreground">{getJobTypeLabel(project.job_type)}</span></TableCell>
                    <TableCell>
                      {project.due_date ? (
                        <div className="flex items-center gap-1 text-sm"><Calendar className="h-3 w-3 text-muted-foreground" />{new Date(project.due_date).toLocaleDateString()}</div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {(project.storage_bytes || 0) > 0 ? (
                        <div className="flex items-center gap-1 text-sm"><HardDrive className="h-3 w-3 text-muted-foreground" />{formatStorageSize(project.storage_bytes || 0)}</div>
                      ) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell><ArrowRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <p className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages} ({totalCount} projects)
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page: number;
                if (totalPages <= 5) {
                  page = i + 1;
                } else if (currentPage <= 3) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  page = totalPages - 4 + i;
                } else {
                  page = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    className="w-9"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
