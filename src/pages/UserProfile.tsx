import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Calendar, Crown, Mail, MessageSquare, User, Phone, Globe, Twitter, Linkedin, Github } from 'lucide-react';

interface UserProfileData {
  id: string;
  username: string | null;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  plan: string;
  created_at: string | null;
  phone: string | null;
  social_links: any;
}

export default function UserProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => { if (username) fetchProfile(); }, [username]);

  const fetchProfile = async () => {
    try {
      let { data, error } = await supabase.from('profiles').select('id, username, email, full_name, avatar_url, plan, created_at, phone, social_links').eq('username', username).single();
      if (error || !data) {
        const { data: emailData, error: emailError } = await supabase.from('profiles').select('id, username, email, full_name, avatar_url, plan, created_at, phone, social_links').ilike('email', `${username}@%`).single();
        if (emailError || !emailData) { setNotFound(true); setLoading(false); return; }
        data = emailData;
      }
      setProfile(data as UserProfileData);
    } catch { setNotFound(true); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (<DashboardLayout title="Profile"><div className="flex items-center justify-center h-96"><Loader2 className="h-8 w-8 animate-spin" /></div></DashboardLayout>);
  }

  if (notFound || !profile) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'User Not Found' }]}>
        <div className="flex flex-col items-center justify-center h-96 text-center">
          <User className="h-16 w-16 text-muted-foreground mb-4" />
          <h1 className="text-2xl font-bold mb-2">User Not Found</h1>
          <p className="text-muted-foreground mb-6">The user "{username}" doesn't exist.</p>
          <Button asChild><Link to="/dashboard">Go to Dashboard</Link></Button>
        </div>
      </DashboardLayout>
    );
  }

  const isOwnProfile = user?.id === profile.id;
  const memberSince = profile.created_at ? new Date(profile.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'Unknown';
  const socialLinks = profile.social_links || {};

  return (
    <DashboardLayout breadcrumbs={[{ label: profile.full_name || profile.username || 'User' }]}>
      <div className="p-6 lg:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card>
            <CardContent className="pt-8 pb-6">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                <UserAvatar src={profile.avatar_url} name={profile.full_name} email={profile.email} size="xl" className="border-4 border-background shadow-xl" />
                <div className="flex-1 text-center md:text-left">
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-2 mb-2">
                    <h1 className="text-2xl font-bold">{profile.full_name || 'No Name'}</h1>
                    {profile.plan === 'pro' && <Badge className="bg-amber-500 hover:bg-amber-500"><Crown className="h-3 w-3 mr-1" />PRO</Badge>}
                  </div>
                  {profile.username && <p className="text-muted-foreground mb-4">@{profile.username}</p>}
                  <div className="flex flex-wrap justify-center md:justify-start gap-4 text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1"><Calendar className="h-4 w-4" /><span>Joined {memberSince}</span></div>
                    <div className="flex items-center gap-1"><Mail className="h-4 w-4" /><span>{profile.email}</span></div>
                    {profile.phone && <div className="flex items-center gap-1"><Phone className="h-4 w-4" /><span>{profile.phone}</span></div>}
                  </div>
                  <div className="flex flex-wrap justify-center md:justify-start gap-2">
                    {isOwnProfile ? (
                      <Button asChild><Link to="/profile">Edit Profile</Link></Button>
                    ) : (
                      <Button onClick={() => navigate(`/org/${''}`)}><MessageSquare className="h-4 w-4 mr-2" />Send Message</Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social Links */}
          {(socialLinks.website || socialLinks.twitter || socialLinks.linkedin || socialLinks.github) && (
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" />Social Profiles</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {socialLinks.website && (
                    <a href={socialLinks.website.startsWith('http') ? socialLinks.website : `https://${socialLinks.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Globe className="h-4 w-4" /><span className="truncate">{socialLinks.website}</span>
                    </a>
                  )}
                  {socialLinks.twitter && (
                    <a href={`https://twitter.com/${socialLinks.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Twitter className="h-4 w-4" /><span>{socialLinks.twitter}</span>
                    </a>
                  )}
                  {socialLinks.linkedin && (
                    <a href={socialLinks.linkedin.startsWith('http') ? socialLinks.linkedin : `https://${socialLinks.linkedin}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Linkedin className="h-4 w-4" /><span className="truncate">{socialLinks.linkedin}</span>
                    </a>
                  )}
                  {socialLinks.github && (
                    <a href={socialLinks.github.startsWith('http') ? socialLinks.github : `https://${socialLinks.github}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                      <Github className="h-4 w-4" /><span className="truncate">{socialLinks.github}</span>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
