import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/ui/user-avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, User, Calendar, Camera, Shield, Crown, CreditCard, Sparkles, Phone, Globe, Twitter, Linkedin, Github } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  created_at: string | null;
  plan: string;
  plan_expires_at: string | null;
  phone: string | null;
  social_links: any;
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
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [socialLinks, setSocialLinks] = useState<{ website?: string; twitter?: string; linkedin?: string; github?: string }>({});
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);

  useEffect(() => {
    if (user) {
      fetchProfile();
      fetchCurrentPlan();
      const channel = supabase.channel('profile-changes').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, (payload) => {
        const newData = payload.new as Profile;
        setProfile(newData);
        setFullName(newData.full_name || '');
        setUsername(newData.username || '');
        setAvatarUrl(newData.avatar_url || '');
        setPhone(newData.phone || '');
        setSocialLinks(newData.social_links || {});
      }).subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', user!.id).single();
      if (error) throw error;
      setProfile(data as Profile);
      setFullName(data.full_name || '');
      setUsername(data.username || '');
      setAvatarUrl(data.avatar_url || '');
      setPhone((data as any).phone || '');
      setSocialLinks((data as any).social_links || {});
    } catch (error: any) {
      console.error('Error fetching profile:', error);
    } finally { setLoading(false); }
  };

  const fetchCurrentPlan = async () => {
    try {
      const { data: profileData } = await supabase.from('profiles').select('plan').eq('id', user!.id).single();
      if (profileData?.plan) {
        const { data: planData } = await supabase.from('plans').select('*').eq('name', profileData.plan).single();
        if (planData) setCurrentPlan(planData);
      }
    } catch (error) { console.error('Error fetching plan:', error); }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) { toast({ title: 'Invalid file type', description: 'Please upload an image file.', variant: 'destructive' }); return; }
    if (file.size > 2 * 1024 * 1024) { toast({ title: 'File too large', description: 'Please upload an image smaller than 2MB.', variant: 'destructive' }); return; }
    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('project-files').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      setAvatarUrl(filePath);
      toast({ title: 'Image uploaded', description: 'Your profile image has been uploaded. Click Save to apply.' });
    } catch (error: any) {
      toast({ title: 'Upload failed', description: error.message || 'Failed to upload image.', variant: 'destructive' });
    } finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!user) return;
    if (username && !/^[a-zA-Z0-9_]{3,30}$/.test(username)) {
      toast({ title: 'Invalid username', description: 'Username must be 3-30 characters and contain only letters, numbers, and underscores.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: fullName.trim() || null,
        username: username.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        phone: phone.trim() || null,
        social_links: socialLinks,
      } as any).eq('id', user.id);
      if (error) {
        if (error.code === '23505') throw new Error('This username is already taken. Please choose another.');
        throw error;
      }
      toast({ title: 'Profile updated', description: 'Your profile has been saved successfully.' });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to update profile.', variant: 'destructive' });
    } finally { setSaving(false); }
  };

  if (loading) {
    return (
      <DashboardLayout title="Profile">
        <div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div>
      </DashboardLayout>
    );
  }

  const memberSince = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown';

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Profile' }]}>
      <div className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">My Profile</h1>
            <p className="text-muted-foreground">View and manage your profile information</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Avatar & Quick Info */}
            <div className="lg:col-span-1 space-y-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center text-center">
                    <div className="relative group mb-4">
                      <UserAvatar src={avatarUrl || profile?.avatar_url} name={fullName} email={profile?.email} size="xl" className="border-4 border-background shadow-xl" />
                      <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                        {uploading ? <Loader2 className="h-8 w-8 animate-spin text-white" /> : <Camera className="h-8 w-8 text-white" />}
                      </button>
                      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
                    </div>
                    <h2 className="text-xl font-semibold">{fullName || 'No Name Set'}</h2>
                    {profile?.username && <p className="text-sm text-muted-foreground">@{profile.username}</p>}
                    <p className="text-sm text-muted-foreground">{profile?.email}</p>
                    <div className="flex gap-2 mt-4 flex-wrap justify-center">
                      <Badge variant="secondary" className="gap-1"><Shield className="h-3 w-3" />Verified</Badge>
                      {profile?.plan === 'pro' && <Badge className="gap-1 bg-amber-500 hover:bg-amber-500"><Crown className="h-3 w-3" />PRO</Badge>}
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Current Plan */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Current Plan</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-3">
                    {profile?.plan === 'pro' ? <Crown className="h-5 w-5 text-amber-500" /> : <Sparkles className="h-5 w-5 text-muted-foreground" />}
                    <div className="flex-1">
                      <p className="font-medium">{currentPlan?.display_name || 'Free'}</p>
                      <p className="text-xs text-muted-foreground">{profile?.plan === 'pro' ? 'Active subscription' : 'Basic features'}</p>
                    </div>
                  </div>
                  {profile?.plan !== 'pro' && (
                    <Button asChild size="sm" className="w-full mt-3"><Link to="/billing"><CreditCard className="h-4 w-4 mr-2" />Upgrade to Pro</Link></Button>
                  )}
                </CardContent>
              </Card>

              {/* Account Info */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Account Info</CardTitle>
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

            {/* Right Column - Editable Fields */}
            <div className="lg:col-span-2 space-y-6">
              {/* Personal Information */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2"><User className="h-5 w-5" /><CardTitle>Personal Information</CardTitle></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name</Label>
                      <Input id="fullName" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="username">Username</Label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">@</span>
                        <Input id="username" placeholder="johndoe" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))} className="pl-8" maxLength={30} />
                      </div>
                      <p className="text-xs text-muted-foreground">{username ? `Your profile: /u/${username}` : 'Set a unique username for your public profile'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" value={profile?.email || ''} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="phone" placeholder="+1 (555) 000-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="pl-9" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Social Links */}
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2"><Globe className="h-5 w-5" /><CardTitle>Social Profiles</CardTitle></div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="website">Website</Label>
                      <div className="relative">
                        <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="website" placeholder="https://yoursite.com" value={socialLinks.website || ''} onChange={(e) => setSocialLinks(prev => ({ ...prev, website: e.target.value }))} className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="twitter">Twitter / X</Label>
                      <div className="relative">
                        <Twitter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="twitter" placeholder="@username" value={socialLinks.twitter || ''} onChange={(e) => setSocialLinks(prev => ({ ...prev, twitter: e.target.value }))} className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="linkedin">LinkedIn</Label>
                      <div className="relative">
                        <Linkedin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="linkedin" placeholder="linkedin.com/in/username" value={socialLinks.linkedin || ''} onChange={(e) => setSocialLinks(prev => ({ ...prev, linkedin: e.target.value }))} className="pl-9" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="github">GitHub</Label>
                      <div className="relative">
                        <Github className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input id="github" placeholder="github.com/username" value={socialLinks.github || ''} onChange={(e) => setSocialLinks(prev => ({ ...prev, github: e.target.value }))} className="pl-9" />
                      </div>
                    </div>
                  </div>
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
