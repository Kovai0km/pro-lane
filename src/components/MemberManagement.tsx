import { useState, useEffect } from 'react';
import { UserPlus, Trash2, Loader2, Mail, Shield, User, Users, AlertCircle, Check, X, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface MemberManagementProps {
  organizationId: string;
  isOwner: boolean;
}

interface Member {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  created_at: string;
  profile?: {
    email: string;
    full_name: string | null;
  };
}

interface Invitation {
  id: string;
  email: string;
  status: string;
  created_at: string;
  expires_at: string;
}

const MAX_BULK_INVITES = 50;

export function MemberManagement({ organizationId, isOwner }: MemberManagementProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteTab, setInviteTab] = useState<'single' | 'bulk'>('single');
  const [inviteEmail, setInviteEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteNonUser, setInviteNonUser] = useState(false);

  useEffect(() => {
    fetchMembers();
    fetchInvitations();
  }, [organizationId]);

  const fetchMembers = async () => {
    try {
      const { data: membersData, error } = await supabase
        .from('organization_members')
        .select('*')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (membersData && membersData.length > 0) {
        const userIds = membersData.map((m) => m.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('id', userIds);

        const profilesMap = new Map(profilesData?.map((p) => [p.id, p]) || []);
        const membersWithProfiles = membersData.map((m) => ({
          ...m,
          profile: profilesMap.get(m.user_id),
        }));
        setMembers(membersWithProfiles);
      } else {
        setMembers([]);
      }
    } catch (error: any) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchInvitations = async () => {
    try {
      const { data } = await supabase
        .from('team_invitations')
        .select('id, email, status, created_at, expires_at')
        .eq('team_id', organizationId)
        .order('created_at', { ascending: false });
      // Note: we reuse team_invitations for org invites, or use a different approach
      // For now show pending invitations from notifications
    } catch (err) {
      console.error('Error fetching invitations:', err);
    }
  };

  const isValidEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSingleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    if (!isValidEmail(inviteEmail.trim())) {
      toast({ title: 'Invalid email', description: 'Please enter a valid email address.', variant: 'destructive' });
      return;
    }

    setInviting(true);
    try {
      await inviteUserByEmail(inviteEmail.trim().toLowerCase());
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteNonUser(false);
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to invite.', variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const handleBulkInvite = async () => {
    const rawEmails = bulkEmails
      .split(/[,\n\s]+/)
      .map(e => e.trim().toLowerCase())
      .filter(Boolean);

    // Deduplicate
    const uniqueEmails = [...new Set(rawEmails)];

    // Validate
    const validEmails = uniqueEmails.filter(isValidEmail);
    const invalidCount = uniqueEmails.length - validEmails.length;

    if (validEmails.length === 0) {
      toast({ title: 'No valid emails', description: 'Please enter valid email addresses.', variant: 'destructive' });
      return;
    }

    if (validEmails.length > MAX_BULK_INVITES) {
      toast({ title: 'Too many emails', description: `Maximum ${MAX_BULK_INVITES} emails per batch.`, variant: 'destructive' });
      return;
    }

    setInviting(true);
    let invited = 0;
    let skipped = 0;
    let alreadyMembers = 0;

    try {
      for (const email of validEmails) {
        try {
          const result = await inviteUserByEmail(email, true);
          if (result === 'invited') invited++;
          else if (result === 'already_member') alreadyMembers++;
          else skipped++;
        } catch {
          skipped++;
        }
      }

      toast({
        title: 'Bulk invite complete',
        description: `${invited} invited, ${alreadyMembers} already members, ${skipped} skipped, ${invalidCount} invalid emails.`,
      });
      setInviteDialogOpen(false);
      setBulkEmails('');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setInviting(false);
    }
  };

  const inviteUserByEmail = async (email: string, silent = false): Promise<'invited' | 'already_member' | 'email_sent'> => {
    // Check if user exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .single();

    if (profile) {
      // Check if already a member
      const existingMember = members.find((m) => m.user_id === profile.id);
      if (existingMember) {
        if (!silent) toast({ title: 'Already a member', variant: 'destructive' });
        return 'already_member';
      }

      // Get org name for notification
      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      // Send invitation notification - do NOT add as member yet
      // User will be added only when they accept via the notification
      await supabase.from('notifications').insert({
        user_id: profile.id,
        type: 'org_invitation',
        title: 'Organization Invitation',
        message: `You've been invited to join "${orgData?.name || 'an organization'}". Accept or decline this invitation.`,
        link: `/accept-org-invite/${organizationId}`,
      });

      if (!silent) toast({ title: 'Invitation sent', description: `Invitation sent to ${profile.full_name || profile.email}. They need to accept it.` });
      return 'invited';
    } else {
      // Send invitation email for non-existing users
      const { data: inviterProfile } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', user!.id)
        .single();

      const { data: orgData } = await supabase
        .from('organizations')
        .select('name')
        .eq('id', organizationId)
        .single();

      await supabase.functions.invoke('send-invitation-email', {
        body: {
          to: email,
          inviterName: inviterProfile?.full_name || inviterProfile?.email || 'Someone',
          inviterEmail: inviterProfile?.email || user!.email,
          type: 'organization',
          itemName: orgData?.name || 'an organization',
          inviteToken: crypto.randomUUID(),
        },
      });

      if (!silent) toast({ title: 'Invitation sent', description: `Email sent to ${email}` });
      return 'email_sent';
    }
  };

  const handleRemoveMember = async (memberId: string, memberUserId: string) => {
    if (memberUserId === user?.id) {
      toast({ title: 'Cannot remove yourself', variant: 'destructive' });
      return;
    }

    try {
      const { error } = await supabase
        .from('organization_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      setMembers(members.filter((m) => m.id !== memberId));
      toast({ title: 'Member removed' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Members ({members.length})</h3>
        <Dialog open={inviteDialogOpen} onOpenChange={(open) => {
            setInviteDialogOpen(open);
            if (!open) { setInviteNonUser(false); setInviteEmail(''); setBulkEmails(''); }
          }}>
            <DialogTrigger asChild>
              <Button size="sm">
                <UserPlus className="mr-2 h-4 w-4" />
                Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Invite Members</DialogTitle>
                <DialogDescription>
                  Add members to this organization. All new members are added as Members. Only the owner is Admin.
                </DialogDescription>
              </DialogHeader>

              <Tabs value={inviteTab} onValueChange={(v) => setInviteTab(v as 'single' | 'bulk')}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="single">
                    <User className="mr-2 h-4 w-4" />
                    Single Invite
                  </TabsTrigger>
                  <TabsTrigger value="bulk">
                    <Users className="mr-2 h-4 w-4" />
                    Bulk Invite
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="single" className="space-y-4 mt-4">
                  <form onSubmit={handleSingleInvite}>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="user@example.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter className="mt-4">
                      <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                      <Button type="submit" disabled={inviting || !inviteEmail.trim()}>
                        {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Mail className="mr-2 h-4 w-4" />
                        Send Invite
                      </Button>
                    </DialogFooter>
                  </form>
                </TabsContent>

                <TabsContent value="bulk" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Email Addresses</Label>
                    <Textarea
                      placeholder={`Enter emails separated by comma, space, or newline:\nuser1@example.com\nuser2@example.com\nuser3@example.com`}
                      value={bulkEmails}
                      onChange={(e) => setBulkEmails(e.target.value)}
                      rows={6}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum {MAX_BULK_INVITES} emails per batch. Paste from spreadsheets supported.
                    </p>

                    {/* Preview */}
                    {bulkEmails.trim() && (() => {
                      const parsed = bulkEmails.split(/[,\n\s]+/).map(e => e.trim()).filter(Boolean);
                      const unique = [...new Set(parsed)];
                      const valid = unique.filter(isValidEmail);
                      const invalid = unique.length - valid.length;
                      return (
                        <div className="flex gap-3 text-xs mt-2">
                          <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                            <Check className="h-3 w-3" /> {valid.length} valid
                          </span>
                          {invalid > 0 && (
                            <span className="flex items-center gap-1 text-destructive">
                              <X className="h-3 w-3" /> {invalid} invalid
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setInviteDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleBulkInvite} disabled={inviting || !bulkEmails.trim()}>
                      {inviting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Users className="mr-2 h-4 w-4" />
                      Send Bulk Invites
                    </Button>
                  </DialogFooter>
                </TabsContent>
              </Tabs>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-2">
        {members.map((member) => (
          <div
            key={member.id}
            className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                {member.role === 'admin' ? (
                  <Shield className="h-5 w-5" />
                ) : (
                  <User className="h-5 w-5" />
                )}
              </div>
              <div>
                <div className="font-medium">
                  {member.profile?.full_name || 'No name'}
                </div>
                <div className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {member.profile?.email}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                {member.role === 'admin' ? 'Admin (Owner)' : 'Member'}
              </Badge>
              {isOwner && member.user_id !== user?.id && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => handleRemoveMember(member.id, member.user_id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
