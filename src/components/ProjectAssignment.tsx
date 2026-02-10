import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail, Loader2, Search, User } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

interface ProjectAssignmentProps {
  projectId: string;
  currentAssignee?: string | null;
  onAssigned?: () => void;
  allowSelfAssign?: boolean;
}

export function ProjectAssignment({ projectId, currentAssignee, onAssigned, allowSelfAssign = false }: ProjectAssignmentProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [mode, setMode] = useState<'assign' | 'invite' | 'self'>('assign');
  const [loading, setLoading] = useState(false);
  const [currentUserProfile, setCurrentUserProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (open) {
      fetchUsers();
      if (user) {
        fetchCurrentUserProfile();
      }
    }
  }, [open, user]);

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');

    if (!error && data) {
      setUsers(data);
    }
  };

  const fetchCurrentUserProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (data) {
      setCurrentUserProfile(data);
    }
  };

  const filteredUsers = users.filter(
    (u) =>
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAssign = async () => {
    if (!selectedUserId) return;
    setLoading(true);

    try {
      // Update project assigned_to
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          assigned_to: selectedUserId,
          assigned_date: new Date().toISOString(),
          status: 'assigned'
        })
        .eq('id', projectId);

      if (updateError) throw updateError;

      // Add as project member if not already
      const { error: memberError } = await supabase
        .from('project_members')
        .upsert({
          project_id: projectId,
          user_id: selectedUserId,
          role: 'editor',
        }, { onConflict: 'project_id,user_id' });

      if (memberError) throw memberError;

      toast({ title: 'Project assigned successfully' });
      setOpen(false);
      onAssigned?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSelfAssign = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { error: updateError } = await supabase
        .from('projects')
        .update({ 
          assigned_to: user.id,
          assigned_date: new Date().toISOString(),
          status: 'assigned'
        })
        .eq('id', projectId);

      if (updateError) throw updateError;

      // Add as project member if not already
      await supabase
        .from('project_members')
        .upsert({
          project_id: projectId,
          user_id: user.id,
          role: 'owner',
        }, { onConflict: 'project_id,user_id' });

      toast({ title: 'Project assigned to yourself' });
      setOpen(false);
      onAssigned?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !user) return;

    // Validate email format
    if (!isValidEmail(inviteEmail.trim())) {
      toast({ 
        title: 'Invalid email', 
        description: 'Please enter a valid email address.',
        variant: 'destructive' 
      });
      return;
    }

    setLoading(true);

    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', inviteEmail.trim())
        .single();

      if (existingUser) {
        // User exists, assign directly
        const { error } = await supabase
          .from('projects')
          .update({ 
            assigned_to: existingUser.id,
            assigned_date: new Date().toISOString(),
            status: 'assigned'
          })
          .eq('id', projectId);

        if (error) throw error;

        await supabase
          .from('project_members')
          .upsert({
            project_id: projectId,
            user_id: existingUser.id,
            role: 'editor',
          }, { onConflict: 'project_id,user_id' });

        toast({ title: 'Project assigned to existing user' });
      } else {
        // Get project name for email
        const { data: projectData } = await supabase
          .from('projects')
          .select('title')
          .eq('id', projectId)
          .single();

        // Get inviter profile
        const { data: inviterProfile } = await supabase
          .from('profiles')
          .select('full_name, email')
          .eq('id', user.id)
          .single();

        // Create invitation
        const { data: invitation, error } = await supabase
          .from('project_invitations')
          .insert({
            project_id: projectId,
            email: inviteEmail.trim(),
            invited_by: user.id,
            role: 'editor',
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
              type: 'project',
              itemName: projectData?.title || 'Project',
              inviteToken: invitation?.token,
            },
          });
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
        }

        toast({ 
          title: 'Invitation sent',
          description: `An invitation has been sent to ${inviteEmail}`
        });
      }

      setOpen(false);
      onAssigned?.();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="default" className="h-10 px-4">
          <UserPlus className="mr-2 h-4 w-4" />
          Assign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign Project</DialogTitle>
          <DialogDescription>
            Assign this project to a team member or invite someone new.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 mb-4 flex-wrap">
          {allowSelfAssign && (
            <Button
              variant={mode === 'self' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('self')}
            >
              <User className="mr-2 h-4 w-4" />
              Assign to Me
            </Button>
          )}
          <Button
            variant={mode === 'assign' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('assign')}
          >
            Existing User
          </Button>
          <Button
            variant={mode === 'invite' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('invite')}
          >
            <Mail className="mr-2 h-4 w-4" />
            Invite by Email
          </Button>
        </div>

        {mode === 'self' && allowSelfAssign ? (
          <div className="space-y-4">
            <div className="p-4 border-2 border-foreground bg-secondary">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 border-2 border-foreground flex items-center justify-center text-sm font-bold">
                  {(currentUserProfile?.full_name || currentUserProfile?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="text-left">
                  <div className="font-medium">{currentUserProfile?.full_name || 'No name'}</div>
                  <div className="text-sm text-muted-foreground">{currentUserProfile?.email}</div>
                </div>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              As the project owner, you can assign this project to yourself.
            </p>
          </div>
        ) : mode === 'assign' ? (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <ScrollArea className="h-[200px] border-2 border-foreground">
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full flex items-center gap-3 p-3 hover:bg-secondary transition-colors ${
                    selectedUserId === u.id ? 'bg-secondary' : ''
                  }`}
                >
                  <div className="h-8 w-8 border-2 border-foreground flex items-center justify-center text-sm font-bold">
                    {(u.full_name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-sm">{u.full_name || 'No name'}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                </button>
              ))}
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                If the user doesn't have an account, they'll receive an invitation to sign up.
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            onClick={mode === 'self' ? handleSelfAssign : mode === 'assign' ? handleAssign : handleInvite}
            disabled={loading || (mode === 'assign' ? !selectedUserId : mode === 'invite' ? !inviteEmail.trim() : false)}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === 'self' ? 'Assign to Me' : mode === 'assign' ? 'Assign' : 'Send Invitation'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
