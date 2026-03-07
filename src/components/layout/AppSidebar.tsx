import { useState, useEffect, useCallback } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { supabase } from '@/integrations/supabase/client';
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarSeparator, useSidebar } from '@/components/ui/sidebar';
import { UserAvatar } from '@/components/ui/user-avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Building2, FolderOpen, Users, Settings, LogOut, Plus, LayoutDashboard, Moon, Sun, Hash, MessageSquare, ChevronDown, Crown, Loader2, AlertCircle, Activity, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { NewMessageDialog } from '@/components/NewMessageDialog';
import { useToast } from '@/hooks/use-toast';
import { getPlanLimits } from '@/lib/plans';
import logoDark from '@/assets/logo-dark.jpg';
import logoLight from '@/assets/logo-light.jpg';

interface Organization { id: string; name: string; }
interface Team { id: string; name: string; }
interface DirectMessage { user: { id: string; email: string; full_name: string | null }; unreadCount: number; }
interface Profile { avatar_url: string | null; plan: string; full_name: string | null; username: string | null; }
interface RecentProject { id: string; title: string; project_code: string | null; }

export function AppSidebar() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const { orgId } = useParams();
  const { state } = useSidebar();
  const { toast } = useToast();
  const isCollapsed = state === 'collapsed';
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [currentOrg, setCurrentOrg] = useState<Organization | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [newMessageDialogOpen, setNewMessageDialogOpen] = useState(false);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDescription, setNewOrgDescription] = useState('');
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [planLimitReached, setPlanLimitReached] = useState(false);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => { if (user) { fetchOrganizations(); fetchProfile(); } }, [user]);
  useEffect(() => {
    if (orgId && organizations.length > 0) {
      const org = organizations.find(o => o.id === orgId) || null;
      setCurrentOrg(org);
      if (org) localStorage.setItem('lastOrgId', org.id);
    } else if (organizations.length > 0 && !orgId) {
      // Preserve current org when navigating away from org routes (e.g., to /project/:id)
      if (!currentOrg) {
        const lastOrgId = localStorage.getItem('lastOrgId');
        const lastOrg = lastOrgId ? organizations.find(o => o.id === lastOrgId) : null;
        setCurrentOrg(lastOrg || organizations[0]);
      }
    }
  }, [orgId, organizations]);
  useEffect(() => { if (currentOrg && user) { fetchTeams(); fetchDirectMessages(); fetchRecentProjects(); checkAdmin(); } }, [currentOrg, user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('sidebar-profile').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
      const d = payload.new as any;
      setProfile({ avatar_url: d.avatar_url, plan: d.plan, full_name: d.full_name, username: d.username });
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  useEffect(() => {
    const channel = supabase.channel('sidebar-orgs').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'organizations' }, (payload) => {
      const updated = payload.new as Organization;
      setOrganizations(prev => prev.map(o => o.id === updated.id ? { ...o, name: updated.name } : o));
      if (currentOrg?.id === updated.id) setCurrentOrg(prev => prev ? { ...prev, name: updated.name } : prev);
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentOrg?.id]);

  const fetchOrganizations = async () => { const { data } = await supabase.from('organizations').select('id, name').order('name'); if (data) setOrganizations(data); };
  const fetchProfile = async () => { if (!user) return; const { data } = await supabase.from('profiles').select('avatar_url, plan, full_name, username').eq('id', user.id).single(); if (data) setProfile(data); };
  const fetchTeams = async () => { if (!currentOrg) return; const { data } = await supabase.from('teams').select('id, name').eq('organization_id', currentOrg.id).order('name'); if (data) setTeams(data); };
  const fetchDirectMessages = async () => {
    if (!user) return;
    const [{ data: sentMessages }, { data: receivedMessages }] = await Promise.all([
      supabase.from('messages').select('receiver_id').eq('sender_id', user.id),
      supabase.from('messages').select('sender_id, read').eq('receiver_id', user.id),
    ]);
    const userIds = new Set<string>();
    sentMessages?.forEach(m => userIds.add(m.receiver_id));
    receivedMessages?.forEach(m => userIds.add(m.sender_id));
    if (userIds.size > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('id', Array.from(userIds));
      if (profiles) setDirectMessages(profiles.map(p => ({ user: p, unreadCount: receivedMessages?.filter(m => m.sender_id === p.id && !m.read).length || 0 })));
    }
  };
  const fetchRecentProjects = async () => {
    if (!currentOrg) return;
    const { data } = await supabase.from('projects').select('id, title, project_code').eq('organization_id', currentOrg.id).order('updated_at', { ascending: false }).limit(5);
    if (data) setRecentProjects(data);
  };
  const checkAdmin = async () => {
    if (!currentOrg || !user) return;
    const { data } = await supabase.from('organization_members').select('role').eq('organization_id', currentOrg.id).eq('user_id', user.id).single();
    setIsAdmin(data?.role === 'admin');
  };

  const handleOrgChange = (newOrgId: string) => { if (newOrgId === 'new') handleOpenCreateOrg(); else navigate(`/org/${newOrgId}`); };

  const handleOpenCreateOrg = useCallback(async () => {
    const limits = getPlanLimits(profile?.plan || 'free');
    const { count } = await supabase.from('organizations').select('id', { count: 'exact', head: true }).eq('owner_id', user!.id);
    setPlanLimitReached((count || 0) >= limits.organizations);
    setCreateOrgOpen(true);
  }, [profile?.plan, user]);

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgName.trim() || !user || planLimitReached) return;
    setCreatingOrg(true);
    try {
      const { data: org, error: orgError } = await supabase.from('organizations').insert({ name: newOrgName.trim(), description: newOrgDescription.trim() || null, owner_id: user.id }).select().single();
      if (orgError) throw orgError;
      await supabase.from('organization_members').insert({ organization_id: org.id, user_id: user.id, role: 'admin' });
      setOrganizations(prev => [...prev, { id: org.id, name: org.name }]);
      setCreateOrgOpen(false);
      setNewOrgName('');
      setNewOrgDescription('');
      toast({ title: 'Organization created', description: `${org.name} has been created successfully.` });
      navigate(`/org/${org.id}`);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to create organization.', variant: 'destructive' });
    } finally { setCreatingOrg(false); }
  };

  const isActiveTab = (tab: string) => {
    const searchParams = new URLSearchParams(location.search);
    const currentTab = searchParams.get('tab');
    if (tab === 'projects') return location.pathname.startsWith(`/org/${currentOrg?.id}`) && !currentTab;
    return currentTab === tab;
  };

  const isActiveChat = (type: 'team' | 'dm', id: string) => {
    const searchParams = new URLSearchParams(location.search);
    return searchParams.get('channel') === type && searchParams.get('id') === id;
  };

  const handleSignOut = async () => { await signOut(); };
  const selectChannel = (type: 'team' | 'dm', id: string) => { navigate(`/org/${currentOrg?.id}?tab=chat&channel=${type}&id=${id}`); };

  return (
    <>
      <Sidebar collapsible="icon">
        <SidebarHeader className="border-b border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild tooltip="PROORBIT">
                <Link to="/dashboard" className="flex items-center gap-3">
                  <img src={theme === 'dark' ? logoDark : logoLight} alt="PROORBIT" className="h-8 w-8 object-contain rounded" />
                  {!isCollapsed && <span className="font-bold text-lg tracking-tight">PROORBIT</span>}
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {/* Organization Switcher */}
          <SidebarGroup>
            <div className="px-2 py-2">
              {!isCollapsed ? (
                <Select value={currentOrg?.id || ''} onValueChange={handleOrgChange}>
                  <SelectTrigger className="w-full bg-sidebar-accent/50 border-sidebar-border">
                    <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-muted-foreground" /><SelectValue placeholder="Select Organization" /></div>
                  </SelectTrigger>
                  <SelectContent className="z-50">
                    {organizations.map(org => (<SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>))}
                    <SelectItem value="new" className="text-primary cursor-pointer">
                      <div className="flex items-center gap-2"><Plus className="h-4 w-4" />New Organization</div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="w-full p-2 rounded-md hover:bg-sidebar-accent flex justify-center"><Building2 className="h-5 w-5" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent side="right" align="start" className="z-50 bg-popover">
                    {organizations.map(org => (
                      <DropdownMenuItem key={org.id} onClick={() => handleOrgChange(org.id)} className={cn("cursor-pointer", currentOrg?.id === org.id && 'bg-accent')}>{org.name}</DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleOpenCreateOrg()} className="cursor-pointer text-primary"><Plus className="h-4 w-4 mr-2" />New Organization</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </SidebarGroup>

          <SidebarSeparator />

          {currentOrg && (
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActiveTab('projects')} tooltip="Overview">
                      <Link to={`/org/${currentOrg.id}`}><LayoutDashboard className="h-4 w-4" /><span>Overview</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={location.pathname === `/org/${currentOrg.id}/projects`} tooltip="Project Hub">
                      <Link to={`/org/${currentOrg.id}/projects`}><FolderOpen className="h-4 w-4" /><span>Project Hub</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActiveTab('teams')} tooltip="Teams">
                      <Link to={`/org/${currentOrg.id}?tab=teams`}><Users className="h-4 w-4" /><span>Teams</span></Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          {/* Recent Projects */}
          {currentOrg && !isCollapsed && recentProjects.length > 0 && (
            <>
              <SidebarSeparator />
              <SidebarGroup>
                <Collapsible open={projectsOpen} onOpenChange={setProjectsOpen}>
                  <CollapsibleTrigger className="w-full">
                    <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 rounded px-2 py-1">
                      <div className="flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        <span>Recent Projects</span>
                      </div>
                      {projectsOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent className="mt-1">
                      <SidebarMenu>
                        {recentProjects.map(project => (
                          <SidebarMenuItem key={project.id}>
                            <SidebarMenuButton asChild isActive={location.pathname === `/project/${project.id}`} className="text-xs">
                              <Link to={`/project/${project.id}`} onClick={(e) => { e.preventDefault(); navigate(`/project/${project.id}`); }}>
                                <span className="text-muted-foreground font-mono text-[10px]">{project.project_code || '—'}</span>
                                <span className="truncate">{project.title}</span>
                              </Link>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            </>
          )}

          {/* Chat Section */}
          {currentOrg && !isCollapsed && (
            <>
              <SidebarSeparator />
              <SidebarGroup>
                <Collapsible open={chatOpen} onOpenChange={setChatOpen}>
                  <CollapsibleTrigger className="w-full">
                    <SidebarGroupLabel className="flex items-center justify-between cursor-pointer hover:bg-sidebar-accent/50 rounded px-2 py-1">
                      <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /><span>Chat</span></div>
                      <ChevronDown className={cn("h-4 w-4 transition-transform", chatOpen && "rotate-180")} />
                    </SidebarGroupLabel>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarGroupContent className="mt-2">
                      <div className="px-2 mb-2"><span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Channels</span></div>
                      <SidebarMenu>
                        {teams.map(team => (
                          <SidebarMenuItem key={team.id}>
                            <SidebarMenuButton isActive={isActiveChat('team', team.id)} onClick={() => selectChannel('team', team.id)} className="cursor-pointer">
                              <Hash className="h-4 w-4" /><span className="truncate">{team.name}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                        {teams.length === 0 && <div className="px-3 py-1 text-xs text-muted-foreground">No channels</div>}
                      </SidebarMenu>
                      <div className="px-2 mt-3 mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Direct Messages</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setNewMessageDialogOpen(true)} title="New message"><Plus className="h-3 w-3" /></Button>
                      </div>
                      <SidebarMenu>
                        {directMessages.map(dm => (
                          <SidebarMenuItem key={dm.user.id}>
                            <SidebarMenuButton isActive={isActiveChat('dm', dm.user.id)} onClick={() => selectChannel('dm', dm.user.id)} className="cursor-pointer">
                              <UserAvatar name={dm.user.full_name} email={dm.user.email} size="xs" />
                              <span className="truncate flex-1">{dm.user.full_name || dm.user.email.split('@')[0]}</span>
                              {dm.unreadCount > 0 && <Badge variant="default" className="h-5 min-w-5 text-[10px] px-1">{dm.unreadCount}</Badge>}
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        ))}
                        {directMessages.length === 0 && <div className="px-3 py-1 text-xs text-muted-foreground">No conversations</div>}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </Collapsible>
              </SidebarGroup>
            </>
          )}

          {!currentOrg && organizations.length === 0 && (
            <SidebarGroup>
              <SidebarGroupContent>
                <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                  {!isCollapsed && (<><p>No organizations yet</p><button onClick={() => handleOpenCreateOrg()} className="text-primary hover:underline mt-1 inline-block">Create one</button></>)}
                </div>
              </SidebarGroupContent>
            </SidebarGroup>
          )}

          <div className="flex-1" />

          {currentOrg && (
            <>
              <SidebarSeparator />
              <SidebarGroup>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={isActiveTab('settings')} tooltip="Organization Settings">
                        <Link to={`/org/${currentOrg.id}?tab=settings`}><Settings className="h-4 w-4" /><span>Org's Settings</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild isActive={location.pathname === `/org/${currentOrg.id}/members`} tooltip="Members">
                        <Link to={`/org/${currentOrg.id}/members`}><Users className="h-4 w-4" /><span>Members</span></Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                    {isAdmin && (
                      <SidebarMenuItem>
                        <SidebarMenuButton asChild isActive={location.pathname === `/org/${currentOrg.id}/activity`} tooltip="Activity">
                          <Link to={`/org/${currentOrg.id}/activity`}><Activity className="h-4 w-4" /><span>Activity</span></Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </>
          )}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border">
          <SidebarMenu>
            <SidebarMenuItem>
              <div className="flex items-center gap-2 w-full px-2 py-1.5">
                <Link to={profile?.username ? `/u/${profile.username}` : '/profile'} className="flex items-center gap-3 flex-1 min-w-0">
                  <UserAvatar src={profile?.avatar_url} name={profile?.full_name} email={user?.email} size="xs" fallbackClassName="bg-sidebar-accent text-sidebar-accent-foreground" />
                  {!isCollapsed && (
                    <div className="flex flex-col items-start text-left flex-1 min-w-0">
                      <span className="text-sm font-medium truncate max-w-[100px]">{profile?.full_name || user?.email?.split('@')[0]}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground truncate">{profile?.username ? `@${profile.username}` : user?.email?.split('@')[0]}</span>
                        {profile?.plan && profile.plan !== 'free' && (
                          <Badge variant="default" className="h-4 text-[8px] px-1 bg-amber-500 hover:bg-amber-500">
                            <Crown className="h-2 w-2 mr-0.5" />
                            {profile.plan.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
                {!isCollapsed && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground" asChild title="Settings">
                      <Link to="/settings"><Settings className="h-4 w-4" /></Link>
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive" onClick={handleSignOut} title="Sign Out">
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      {currentOrg && (
        <NewMessageDialog open={newMessageDialogOpen} onOpenChange={setNewMessageDialogOpen} orgId={currentOrg.id} onSelectUser={(userId) => { setNewMessageDialogOpen(false); selectChannel('dm', userId); }} />
      )}

      {/* Create Organization Dialog */}
      <Dialog open={createOrgOpen} onOpenChange={setCreateOrgOpen}>
        <DialogContent>
          <form onSubmit={handleCreateOrg}>
            <DialogHeader>
              <DialogTitle>Create Organization</DialogTitle>
              <DialogDescription>Organizations help you group teams and projects together.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              {planLimitReached && (
                <div className="flex items-start gap-3 p-4 bg-destructive/10 rounded-lg border border-destructive/20">
                  <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">Plan limit reached</p>
                    <p className="text-sm text-muted-foreground mt-1">Your current plan limit has been reached. Upgrade to create more organizations.</p>
                    <Button asChild size="sm" className="mt-2"><Link to="/billing">Upgrade Plan</Link></Button>
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="orgName">Organization Name</Label>
                <Input id="orgName" placeholder="Acme Agency" value={newOrgName} onChange={(e) => setNewOrgName(e.target.value)} required disabled={planLimitReached} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="orgDesc">Description (optional)</Label>
                <Textarea id="orgDesc" placeholder="A brief description..." value={newOrgDescription} onChange={(e) => setNewOrgDescription(e.target.value)} rows={3} disabled={planLimitReached} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOrgOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={creatingOrg || !newOrgName.trim() || planLimitReached}>
                {creatingOrg && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
