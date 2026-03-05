import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { User, Moon, Sun, Shield, Bell, Loader2, Key, Eye, EyeOff, HardDrive, Save, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserStorageUsage, formatStorageSize } from '@/hooks/useStorageUsage';
import { getPlanByName } from '@/lib/plans';
import { UserAvatar } from '@/components/ui/user-avatar';
import { useRef } from 'react';

interface NotificationSettings {
  notification_email: boolean;
  notification_comments: boolean;
  notification_mentions: boolean;
  notification_assignments: boolean;
  notification_status_changes: boolean;
}

export default function SettingsPage() {
  const { user, signOut, updatePassword } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    notification_email: true,
    notification_comments: true,
    notification_mentions: true,
    notification_assignments: true,
    notification_status_changes: true,
  });

  // Profile settings state
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [designation, setDesignation] = useState('');
  const [address, setAddress] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [plan, setPlan] = useState('free');

  // Password change state
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (user) { fetchSettings(); fetchProfileData(); }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('notification_email, notification_comments, notification_mentions, notification_assignments, notification_status_changes').eq('id', user!.id).single();
      if (error) throw error;
      setSettings({
        notification_email: data.notification_email ?? true,
        notification_comments: data.notification_comments ?? true,
        notification_mentions: data.notification_mentions ?? true,
        notification_assignments: data.notification_assignments ?? true,
        notification_status_changes: data.notification_status_changes ?? true,
      });
    } catch (error) { console.error('Error fetching settings:', error); }
    finally { setLoading(false); }
  };

  const fetchProfileData = async () => {
    const { data } = await supabase.from('profiles').select('full_name, username, avatar_url, plan').eq('id', user!.id).single();
    if (data) {
      setFullName(data.full_name || '');
      setUsername(data.username || '');
      setAvatarUrl(data.avatar_url || '');
      setPlan(data.plan || 'free');
    }
  };

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    const previousSettings = { ...settings };
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ [key]: value }).eq('id', user!.id);
      if (error) throw error;
      toast({ title: 'Settings updated', description: 'Your notification preferences have been saved.' });
    } catch (error: any) {
      setSettings(previousSettings);
      toast({ title: 'Error', description: 'Failed to update settings.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const handleProfileSave = async () => {
    if (!user) return;
    if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      toast({ title: 'Invalid username', description: 'Username must be 3-30 characters.', variant: 'destructive' });
      return;
    }
    setProfileSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({ full_name: fullName.trim() || null, username: username.trim() || null, avatar_url: avatarUrl.trim() || null }).eq('id', user.id);
      if (error) { if (error.code === '23505') throw new Error('Username already taken.'); throw error; }
      toast({ title: 'Profile updated' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally { setProfileSaving(false); }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Invalid file', variant: 'destructive' }); return; }
    if (file.size > 2 * 1024 * 1024) { toast({ title: 'File too large', variant: 'destructive' }); return; }
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${user.id}-${Date.now()}.${fileExt}`;
      const { error } = await supabase.storage.from('project-files').upload(filePath, file, { upsert: true });
      if (error) throw error;
      setAvatarUrl(filePath);
      toast({ title: 'Image uploaded', description: 'Click Save Profile to apply.' });
    } catch (error: any) { toast({ title: 'Upload failed', description: error.message, variant: 'destructive' }); }
    finally { setUploading(false); }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast({ title: 'Password too short', variant: 'destructive' }); return; }
    if (newPassword !== confirmPassword) { toast({ title: 'Passwords do not match', variant: 'destructive' }); return; }
    setPasswordSaving(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;
      toast({ title: 'Password updated' });
      setNewPassword(''); setConfirmPassword(''); setChangingPassword(false);
    } catch (error: any) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); }
    finally { setPasswordSaving(false); }
  };

  const handleSignOut = async () => { await signOut(); navigate('/'); };

  if (loading) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Settings' }]}>
        <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Settings' }]}>
      <div className="p-6 lg:p-8">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-3xl font-bold mb-8">Settings</h1>

          <div className="space-y-6">
            {/* Profile Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />Profile Settings</CardTitle>
                <CardDescription>Update your name, username, and profile picture</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="relative group">
                    <UserAvatar src={avatarUrl} name={fullName} email={user?.email} size="lg" className="border-2 border-background shadow" />
                    <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                      {uploading ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
                    </button>
                    <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                  </div>
                  <div className="flex-1 space-y-3">
                    <div className="space-y-1">
                      <Label htmlFor="settingsFullName">Full Name</Label>
                      <Input id="settingsFullName" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="settingsUsername">Username</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                        <Input id="settingsUsername" placeholder="johndoe" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className="pl-7" maxLength={30} />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button onClick={handleProfileSave} disabled={profileSaving} size="sm">
                    {profileSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Save className="mr-2 h-4 w-4" />Save Profile
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">{theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}Appearance</CardTitle>
                <CardDescription>Customize how ProOrbit looks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5"><Label>Dark Mode</Label><p className="text-sm text-muted-foreground">Switch between light and dark themes</p></div>
                  <Switch checked={theme === 'dark'} onCheckedChange={toggleTheme} />
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />Notifications</CardTitle>
                <CardDescription>Configure notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {([
                  { key: 'notification_email' as const, label: 'Email Notifications', desc: 'Receive email updates about your projects' },
                  { key: 'notification_comments' as const, label: 'Comment Notifications', desc: 'Get notified when someone comments on your projects' },
                  { key: 'notification_mentions' as const, label: 'Mention Notifications', desc: 'Get notified when someone mentions you' },
                  { key: 'notification_assignments' as const, label: 'Assignment Notifications', desc: 'Get notified when you\'re assigned to a project' },
                  { key: 'notification_status_changes' as const, label: 'Status Change Notifications', desc: 'Get notified when project status changes' },
                ]).map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div className="space-y-0.5"><Label>{item.label}</Label><p className="text-sm text-muted-foreground">{item.desc}</p></div>
                    <Switch checked={settings[item.key]} onCheckedChange={(value) => updateSetting(item.key, value)} disabled={saving} />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Storage Usage */}
            <StorageUsageCard userId={user?.id} plan={plan} />

            {/* Security */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Security</CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!changingPassword ? (
                  <div className="flex items-center justify-between py-2">
                    <div><p className="font-medium">Password</p><p className="text-sm text-muted-foreground">Change your password</p></div>
                    <Button variant="outline" onClick={() => setChangingPassword(true)}><Key className="mr-2 h-4 w-4" />Change Password</Button>
                  </div>
                ) : (
                  <form onSubmit={handlePasswordChange} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <div className="relative">
                        <Input id="newPassword" type={showNewPassword ? 'text' : 'password'} placeholder="Enter new password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={6} />
                        <button type="button" onClick={() => setShowNewPassword(!showNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm Password</Label>
                      <div className="relative">
                        <Input id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                        <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                          {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" onClick={() => { setChangingPassword(false); setNewPassword(''); setConfirmPassword(''); }}>Cancel</Button>
                      <Button type="submit" disabled={passwordSaving}>{passwordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Update Password</Button>
                    </div>
                  </form>
                )}
                <div className="pt-2 border-t">
                  <div className="p-4 bg-muted rounded-md">
                    <p className="text-sm text-muted-foreground">Signed in as <span className="font-medium text-foreground">{user?.email}</span></p>
                  </div>
                  <Button variant="destructive" onClick={handleSignOut} className="w-full mt-3">Sign Out</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StorageUsageCard({ userId, plan }: { userId: string | undefined; plan: string }) {
  const { totalBytes, loading } = useUserStorageUsage(userId);
  const planConfig = getPlanByName(plan);
  const storageLimitStr = planConfig?.storage || '1GB';
  const storageLimitBytes = parseStorageLimit(storageLimitStr);
  const percentage = storageLimitBytes > 0 ? Math.min((totalBytes / storageLimitBytes) * 100, 100) : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2"><HardDrive className="h-5 w-5" />Storage Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            {loading ? <div className="h-4 w-24 bg-muted animate-pulse rounded" /> : (
              <>
                <p className="text-sm font-medium">{formatStorageSize(totalBytes)} / {storageLimitStr}</p>
                <Progress value={percentage} className="h-2 mt-1" />
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function parseStorageLimit(str: string): number {
  const match = str.match(/^(\d+)\s*(GB|MB|TB)/i);
  if (!match) return 1024 * 1024 * 1024;
  const num = parseInt(match[1]);
  const unit = match[2].toUpperCase();
  if (unit === 'TB') return num * 1024 * 1024 * 1024 * 1024;
  if (unit === 'GB') return num * 1024 * 1024 * 1024;
  if (unit === 'MB') return num * 1024 * 1024;
  return num;
}
