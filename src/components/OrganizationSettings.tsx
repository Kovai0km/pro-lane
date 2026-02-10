import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrgStorageUsage, formatStorageSize } from '@/hooks/useStorageUsage';
import { Loader2, Save, Trash2, Mail, ShieldAlert, HardDrive } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { useAuth } from '@/hooks/useAuth';

interface Organization {
  id: string;
  name: string;
  description: string | null;
  owner_id: string;
}

interface OrganizationSettingsProps {
  organization: Organization;
  isOwner: boolean;
  onUpdate: (org: Organization) => void;
  onDelete: () => void;
}

export function OrganizationSettings({ organization, isOwner, onUpdate, onDelete }: OrganizationSettingsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [name, setName] = useState(organization.name);
  const [description, setDescription] = useState(organization.description || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [otpStep, setOtpStep] = useState<'initial' | 'otp'>('initial');
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if user is admin
  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) return;
      
      // Owner is always admin
      if (organization.owner_id === user.id) {
        setIsAdmin(true);
        return;
      }

      // Check organization_members for admin role
      const { data } = await supabase
        .from('organization_members')
        .select('role')
        .eq('organization_id', organization.id)
        .eq('user_id', user.id)
        .single();

      setIsAdmin(data?.role === 'admin');
    };

    checkAdminRole();
  }, [user, organization]);

  // Realtime sync
  useEffect(() => {
    const channel = supabase
      .channel(`org-settings-${organization.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'organizations',
          filter: `id=eq.${organization.id}`,
        },
        (payload) => {
          const newData = payload.new as Organization;
          setName(newData.name);
          setDescription(newData.description || '');
          onUpdate(newData);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organization.id, onUpdate]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: 'Name required',
        description: 'Organization name cannot be empty.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from('organizations')
        .update({
          name: name.trim(),
          description: description.trim() || null,
        })
        .eq('id', organization.id)
        .select()
        .single();

      if (error) throw error;

      onUpdate(data);
      toast({
        title: 'Settings saved',
        description: 'Organization settings have been updated.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSendOtp = async () => {
    if (!user?.email) {
      toast({
        title: 'Error',
        description: 'User email not found.',
        variant: 'destructive',
      });
      return;
    }

    setSendingOtp(true);
    try {
      const response = await supabase.functions.invoke('send-delete-otp', {
        body: {
          organizationId: organization.id,
          userId: user.id,
          email: user.email,
          organizationName: organization.name,
        },
      });

      if (response.error) throw response.error;

      setOtpStep('otp');
      toast({
        title: 'Verification code sent',
        description: 'Please check your email for the 6-digit code.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send verification code.',
        variant: 'destructive',
      });
    } finally {
      setSendingOtp(false);
    }
  };

  const handleVerifyAndDelete = async () => {
    if (otpCode.length !== 6) {
      toast({
        title: 'Invalid code',
        description: 'Please enter the 6-digit verification code.',
        variant: 'destructive',
      });
      return;
    }

    setVerifying(true);
    try {
      // Verify OTP
      const { data: otpData, error: otpError } = await supabase
        .from('org_delete_otp')
        .select('*')
        .eq('organization_id', organization.id)
        .eq('user_id', user!.id)
        .eq('code', otpCode)
        .gt('expires_at', new Date().toISOString())
        .single();

      if (otpError || !otpData) {
        toast({
          title: 'Invalid or expired code',
          description: 'Please request a new verification code.',
          variant: 'destructive',
        });
        setVerifying(false);
        return;
      }

      // Delete organization
      setDeleting(true);
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', organization.id);

      if (error) throw error;

      // Clean up OTP
      await supabase
        .from('org_delete_otp')
        .delete()
        .eq('id', otpData.id);

      toast({
        title: 'Organization deleted',
        description: 'The organization has been permanently deleted.',
      });
      setDeleteDialogOpen(false);
      onDelete();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete organization.',
        variant: 'destructive',
      });
    } finally {
      setVerifying(false);
      setDeleting(false);
    }
  };

  const resetDeleteDialog = () => {
    setOtpStep('initial');
    setOtpCode('');
  };

  const canModify = isOwner || isAdmin;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
          <CardDescription>Update your organization details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Organization"
              disabled={!canModify}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orgDescription">Description</Label>
            <Textarea
              id="orgDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your organization..."
              rows={3}
              disabled={!canModify}
            />
          </div>
          {canModify && (
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Changes
            </Button>
          )}
        </CardContent>
      </Card>

      {canModify && (
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <ShieldAlert className="h-5 w-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions that will permanently affect your organization. Only admins can perform these actions.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => {
              setDeleteDialogOpen(open);
              if (!open) resetDeleteDialog();
            }}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={deleting}>
                  {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete Organization
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Organization?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This action cannot be undone. This will permanently delete the
                    organization "{organization.name}" and all associated data including
                    teams and projects.
                  </AlertDialogDescription>
                </AlertDialogHeader>

                {otpStep === 'initial' ? (
                  <div className="space-y-4 py-4">
                    <div className="flex items-center gap-3 p-4 bg-destructive/10 rounded-lg">
                      <Mail className="h-5 w-5 text-destructive" />
                      <div className="text-sm">
                        <p className="font-medium">Email verification required</p>
                        <p className="text-muted-foreground">
                          We'll send a 6-digit code to <strong>{user?.email}</strong> to confirm this action.
                        </p>
                      </div>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <Button 
                        variant="destructive" 
                        onClick={handleSendOtp}
                        disabled={sendingOtp}
                      >
                        {sendingOtp && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Mail className="mr-2 h-4 w-4" />
                        Send Verification Code
                      </Button>
                    </AlertDialogFooter>
                  </div>
                ) : (
                  <div className="space-y-4 py-4">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-4">
                        Enter the 6-digit code sent to your email
                      </p>
                      <InputOTP
                        maxLength={6}
                        value={otpCode}
                        onChange={setOtpCode}
                        className="justify-center"
                      >
                        <InputOTPGroup>
                          <InputOTPSlot index={0} />
                          <InputOTPSlot index={1} />
                          <InputOTPSlot index={2} />
                          <InputOTPSlot index={3} />
                          <InputOTPSlot index={4} />
                          <InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    <div className="flex justify-center">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleSendOtp}
                        disabled={sendingOtp}
                      >
                        {sendingOtp ? 'Sending...' : 'Resend code'}
                      </Button>
                    </div>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={resetDeleteDialog}>Cancel</AlertDialogCancel>
                      <Button 
                        variant="destructive" 
                        onClick={handleVerifyAndDelete}
                        disabled={verifying || deleting || otpCode.length !== 6}
                      >
                        {(verifying || deleting) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Trash2 className="mr-2 h-4 w-4" />
                        Verify & Delete
                      </Button>
                    </AlertDialogFooter>
                  </div>
                )}
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function OrgStorageCard({ orgId }: { orgId: string }) {
  const { totalBytes, loading } = useOrgStorageUsage(orgId);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <HardDrive className="h-4 w-4" />
          Storage Usage
        </CardTitle>
        <CardDescription>Storage used by all projects in this organization</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
        ) : (
          <div className="space-y-2">
            <p className="text-2xl font-bold font-mono">{formatStorageSize(totalBytes)}</p>
            <p className="text-xs text-muted-foreground">
              This counts towards the admin's storage quota.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
