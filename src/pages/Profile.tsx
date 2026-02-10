import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useUserStorageUsage, formatStorageSize } from '@/hooks/useStorageUsage';
import { getPlanByName } from '@/lib/plans';
import { Loader2, Save, User, Calendar, Camera, Shield, Key, Eye, EyeOff, Crown, CreditCard, Sparkles, HardDrive } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string | null;
  plan: string;
  plan_expires_at: string | null;
}

interface Plan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: any;
}

export default function ProfilePage() {
  const { user, updatePassword } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);

  // Password change state
  const [changingPassword, setChangingPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchCurrentPlan();

      // Set up realtime subscription
      const channel = supabase
        .channel('profile-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'profiles',
            filter: `id=eq.${user.id}`,
          },
          (payload) => {
            const newData = payload.new as Profile;
            setProfile(newData);
            setFullName(newData.full_name || '');
            setUsername(newData.username || '');
            setAvatarUrl(newData.avatar_url || '');
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user!.id)
        .single();

      if (error) throw error;
      setProfile(data);
      setFullName(data.full_name || '');
      setUsername(data.username || '');
      setAvatarUrl(data.avatar_url || '');
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurrentPlan = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('plan')
        .eq('id', user!.id)
        .single();

      if (profileData?.plan) {
        const { data: planData } = await supabase
          .from('plans')
          .select('*')
          .eq('name', profileData.plan)
          .single();
        
        if (planData) setCurrentPlan(planData);
      }
    } catch (error) {
      console.error('Error fetching plan:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an image file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Please upload an image smaller than 2MB.',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('project-files')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Store the path instead of public URL (bucket is private)
      const storagePath = filePath;

      // Generate a signed URL for immediate display
      const { data: signedData } = await supabase.storage
        .from('project-files')
        .createSignedUrl(storagePath, 3600);
      
      // Store the path in the database, use signed URL for display
      setAvatarUrl(storagePath);
      if (signedData?.signedUrl) {
        // We'll use the signed URL for display via the useSignedUrl hook
      }
      toast({
        title: 'Image uploaded',
        description: 'Your profile image has been uploaded. Click Save to apply.',
      });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message || 'Failed to upload image.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;

    // Validate username
    if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      toast({
        title: 'Invalid username',
        description: 'Username must be 3-30 characters and contain only letters, numbers, and underscores.',
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim() || null,
          username: username.trim() || null,
          avatar_url: avatarUrl.trim() || null,
        })
        .eq('id', user.id);

      if (error) {
        if (error.code === '23505') {
          throw new Error('This username is already taken. Please choose another.');
        }
        throw error;
      }

      setProfile(prev => prev ? { ...prev, full_name: fullName, username, avatar_url: avatarUrl } : null);
      toast({
        title: 'Profile updated',
        description: 'Your profile has been saved successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 6 characters.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure both passwords match.',
        variant: 'destructive',
      });
      return;
    }

    setPasswordSaving(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;

      toast({
        title: 'Password updated',
        description: 'Your password has been changed successfully.',
      });
      setNewPassword('');
      setConfirmPassword('');
      setChangingPassword(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update password.',
        variant: 'destructive',
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Profile">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const memberSince = profile?.created_at 
    ? new Date(profile.created_at).toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    : 'Unknown';

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Profile' }]}>
      <div className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          {/* Profile Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Profile Settings</h1>
            <p className="text-muted-foreground">Manage your account settings and preferences</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Avatar & Quick Info */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    {/* Avatar Upload */}
                    <div className="relative group mb-4">
                      <UserAvatar
                        src={avatarUrl || profile?.avatar_url}
                        name={fullName}
                        email={profile?.email}
                        size="xl"
                        className="border-4 border-background shadow-xl"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      >
                        {uploading ? (
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        ) : (
                          <Camera className="h-8 w-8 text-white" />
                        )}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </div>
                    
                    <h2 className="text-xl font-semibold">{fullName || 'No Name Set'}</h2>
                    {profile?.username && (
                      <p className="text-sm text-muted-foreground">@{profile.username}</p>
                    )}
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                    
                    <div className="flex gap-2 mt-4 flex-wrap justify-center">
                      <Badge variant="secondary" className="gap-1">
                        <Shield className="h-3 w-3" />
                        Verified
                      </Badge>
                      {profile?.plan === 'pro' && (
                        <Badge className="gap-1 bg-amber-500 hover:bg-amber-500">
                          <Crown className="h-3 w-3" />
                          PRO
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Plan */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Current Plan
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    {profile?.plan === 'pro' ? (
                      <Crown className="h-5 w-5 text-amber-500" />
                    ) : (
                      <Sparkles className="h-5 w-5 text-muted-foreground" />
                    )}
                    <div className="flex-1">
                      <p className="font-medium">{currentPlan?.display_name || 'Free'}</p>
                      <p className="text-xs text-muted-foreground">
                        {profile?.plan === 'pro' ? 'Active subscription' : 'Basic features'}
                      </p>
                    </div>
                  </div>
                  
                  {currentPlan?.features && Array.isArray(currentPlan.features) && (
                    <div className="pt-2 border-t">
                      <p className="text-xs font-medium text-muted-foreground mb-2">Features:</p>
                      <ul className="text-xs space-y-1">
                        {(currentPlan.features as string[]).slice(0, 4).map((feature, idx) => (
                          <li key={idx} className="flex items-center gap-2">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {profile?.plan !== 'pro' && (
                    <Button asChild size="sm" className="w-full mt-3">
                      <Link to="/billing">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Upgrade to Pro
                      </Link>
                    </Button>
                  )}
                </CardContent>
              </Card>

              {/* Storage Usage */}
              <StorageUsageCard userId={user?.id} plan={profile?.plan || 'free'} />

              {/* Quick Stats */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Account Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Member since</span>
                    <span className="ml-auto font-medium">{memberSince}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Settings Forms */}
            <div className="lg:col-span-2 space-y-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    <CardTitle>Personal Information</CardTitle>
                  </div>
                  <CardDescription>Update your personal details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input
                        id="fullName"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                        <Input
                          id="username"
                          placeholder="johndoe"
                          value={username}
                          onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                          className="pl-8"
                          maxLength={30}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {username ? `Your profile: /u/${username}` : 'Set a unique username for your public profile'}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={profile?.email || ''}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                  </div>
                </CardContent>
              </Card>

              {/* Security */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    <CardTitle>Security</CardTitle>
                  </div>
                  <CardDescription>Manage your account security</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!changingPassword ? (
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <p className="font-medium">Password</p>
                        <p className="text-sm text-muted-foreground">Change your password</p>
                      </div>
                      <Button variant="outline" onClick={() => setChangingPassword(true)}>
                        <Key className="mr-2 h-4 w-4" />
                        Change Password
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handlePasswordChange} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPassword">New Password</Label>
                        <div className="relative">
                          <Input
                            id="newPassword"
                            type={showNewPassword ? 'text' : 'password'}
                            placeholder="Enter new password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            minLength={6}
                          />
                          <button
                            type="button"
                            onClick={() => setShowNewPassword(!showNewPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword">Confirm Password</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setChangingPassword(false);
                            setNewPassword('');
                            setConfirmPassword('');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={passwordSaving}>
                          {passwordSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Update Password
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>

              {/* Save Button */}
              <div className="flex justify-end pt-4">
                <Button onClick={handleSave} disabled={saving} size="lg">
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </Button>
              </div>
            </div>
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
        <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Storage Usage
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-3">
          <HardDrive className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1">
            {loading ? (
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
            ) : (
              <>
                <p className="text-sm font-medium">
                  {formatStorageSize(totalBytes)} / {storageLimitStr}
                </p>
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
