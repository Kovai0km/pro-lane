import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserPlus, Users, Mail, Trash2, UserCheck } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Team {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
}

interface TeamMember {
  id: string;
  user_id: string;
  profiles?: { full_name: string | null; email: string };
}

interface TeamInvitation {
  id: string;
  email: string;
  status: string;
  created_at: string;
}

interface OrgMember {
  id: string;
  email: string;
  full_name: string | null;
}

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [team, setTeam] = useState<Team | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [addMemberDialogOpen, setAddMemberDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user && teamId) {
      fetchTeam();
      fetchMembers();
      fetchInvitations();
    }
  }, [user, teamId]);

  useEffect(() => {
    if (team?.organization_id) {
      fetchOrgMembers();
    }
  }, [team?.organization_id]);

  const fetchTeam = async () => {
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .eq('id', teamId)
        .single();

      if (error) throw error;
      setTeam(data);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: 'Team not found or access denied.',
        variant: 'destructive',
      });
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .eq('team_id', teamId);

    if (!error && data) {
      // Fetch profiles for members
      const userIds = data.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);
      const membersWithProfiles = data.map((m) => ({
        ...m,
        profiles: profilesMap.get(m.user_id),
      }));
      setMembers(membersWithProfiles);
    }
  };

  const fetchInvitations = async () => {
    const { data, error } = await supabase
      .from('team_invitations')
      .select('*')
      .eq('team_id', teamId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setInvitations(data);
    }
  };

  const fetchOrgMembers = async () => {
    if (!team?.organization_id) return;

    const { data: orgMembersData } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', team.organization_id);

    if (orgMembersData) {
      const userIds = orgMembersData.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name')
        .in('id', userIds);
      
      if (profiles) setOrgMembers(profiles);
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleAddMember = async (memberId: string) => {
    if (!teamId) return;

    // Check if already a member
    if (members.some(m => m.user_id === memberId)) {
      toast({ title: 'Already a member', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('team_members')
      .insert({
        team_id: teamId,
        user_id: memberId,
      });

    if (!error) {
      toast({ title: 'Member added to team' });
      fetchMembers();
      setAddMemberDialogOpen(false);
    } else {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !user || !teamId) return;

    // Validate email format
    if (!isValidEmail(inviteEmail.trim())) {
      toast({ 
        title: 'Invalid email', 
        description: 'Please enter a valid email address.',
        variant: 'destructive' 
      });
      return;
    }

    setInviting(true);
    try {
      // Check if user exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail.trim())
        .single();

      if (existingUser) {
        // User exists - check if they're an org member
        const isOrgMember = orgMembers.some(m => m.id === existingUser.id);
        
        if (isOrgMember) {
          // Add directly to team
          const { error } = await supabase
            .from('team_members')
            .insert({
              team_id: teamId,
              user_id: existingUser.id,
            });

          if (error) throw error;
          toast({ title: 'Member added to team' });
          fetchMembers();
        } else {
          // Send team invitation
          await sendInvitation();
        }
      } else {
        // Send invitation to external user
        await sendInvitation();
      }

      setInviteDialogOpen(false);
      setInviteEmail('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const sendInvitation = async () => {
    if (!user || !teamId) return;

    // Get inviter profile
    const { data: inviterProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    // Create invitation
    const { data: invitation, error } = await supabase
      .from('team_invitations')
      .insert({
        team_id: teamId,
        email: inviteEmail.trim(),
        invited_by: user.id,
      })
      .select()
      .single();

    if (error) throw error;

    // Send invitation email
    try {
      await supabase.functions.invoke('send-invitation-email', {
        body: {
          to: inviteEmail.trim(),
          inviterName: inviterProfile?.full_name || '',
          inviterEmail: inviterProfile?.email || user.email || '',
          type: 'team',
          itemName: team?.name || 'Team',
          inviteToken: invitation?.token,
        },
      });
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
    }

    toast({
      title: 'Invitation sent',
      description: `An invitation has been sent to ${inviteEmail}`,
    });
    fetchInvitations();
  };

  const handleRemoveMember = async (memberId: string) => {
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', memberId);

    if (!error) {
      toast({ title: 'Member removed' });
      fetchMembers();
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    const { error } = await supabase
      .from('team_invitations')
      .delete()
      .eq('id', invitationId);

    if (!error) {
      toast({ title: 'Invitation cancelled' });
      fetchInvitations();
    }
  };

  // Filter org members that aren't already team members
  const availableOrgMembers = orgMembers.filter(
    m => m.id !== user?.id && !members.some(tm => tm.user_id === m.id)
  ).filter(
    m => m.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         m.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <DashboardLayout title="Team">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!team) return null;

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Organization', href: `/org/${team.organization_id}` },
        { label: team.name }
      ]}
    >
      <div className="p-6 lg:p-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 border-2 border-foreground flex items-center justify-center text-xl font-bold">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{team.name}</h1>
              <p className="text-muted-foreground text-sm">{team.description || 'No description'}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {/* Add existing org member */}
            <Dialog open={addMemberDialogOpen} onOpenChange={setAddMemberDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <UserCheck className="mr-2 h-4 w-4" />
                  Add Member
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Organization Member</DialogTitle>
                  <DialogDescription>
                    Select an existing organization member to add to this team.
                  </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                  <div className="relative mb-4">
                    <Input
                      placeholder="Search members..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-64">
                    {availableOrgMembers.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground">
                          {searchQuery ? 'No members found' : 'All organization members are already in this team'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {availableOrgMembers.map((member) => (
                          <button
                            key={member.id}
                            onClick={() => handleAddMember(member.id)}
                            className="w-full flex items-center justify-between p-3 rounded-md hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback className="text-xs">
                                  {(member.full_name || member.email).charAt(0).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div className="text-left">
                                <div className="font-medium text-sm">{member.full_name || 'No name'}</div>
                                <div className="text-xs text-muted-foreground">{member.email}</div>
                              </div>
                            </div>
                            <UserPlus className="h-4 w-4 text-muted-foreground" />
                          </button>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </div>
              </DialogContent>
            </Dialog>

            {/* Invite external guest */}
            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Mail className="mr-2 h-4 w-4" />
                  Invite Guest
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleInvite}>
                  <DialogHeader>
                    <DialogTitle>Invite Guest Member</DialogTitle>
                    <DialogDescription>
                      Invite someone outside your organization. They'll receive an email invitation to join.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="py-4 space-y-4">
                    <div className="space-y-2">
                      <Label>Email Address</Label>
                      <Input
                        type="email"
                        placeholder="guest@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        required
                      />
                      <p className="text-xs text-muted-foreground">
                        If they don't have an account, they'll be invited to sign up.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={inviting}>
                      {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Send Invitation
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider">
                Team Members ({members.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No team members yet
                  </p>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 border-2 border-foreground/20"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {(member.profiles?.full_name || member.profiles?.email || 'U').charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium text-sm">
                              {member.profiles?.full_name || 'No name'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {member.profiles?.email}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm uppercase tracking-wider">
                Pending Invitations ({invitations.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {invitations.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No pending invitations
                  </p>
                ) : (
                  <div className="space-y-2">
                    {invitations.map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex items-center justify-between p-3 border-2 border-foreground/20"
                      >
                        <div className="flex items-center gap-3">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium text-sm">{invitation.email}</div>
                            <div className="text-xs text-muted-foreground">
                              Sent {new Date(invitation.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCancelInvitation(invitation.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
