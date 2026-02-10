import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { User, Moon, Sun, Shield, Bell, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NotificationSettings {
  notification_email: boolean;
  notification_comments: boolean;
  notification_mentions: boolean;
  notification_assignments: boolean;
  notification_status_changes: boolean;
}

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<NotificationSettings>({
    notification_email: true,
    notification_comments: true,
    notification_mentions: true,
    notification_assignments: true,
    notification_status_changes: true,
  });

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('notification_email, notification_comments, notification_mentions, notification_assignments, notification_status_changes')
        .eq('id', user!.id)
        .single();

      if (error) throw error;

      setSettings({
        notification_email: data.notification_email ?? true,
        notification_comments: data.notification_comments ?? true,
        notification_mentions: data.notification_mentions ?? true,
        notification_assignments: data.notification_assignments ?? true,
        notification_status_changes: data.notification_status_changes ?? true,
      });
    } catch (error) {
      console.error('Error fetching settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: keyof NotificationSettings, value: boolean) => {
    const previousSettings = { ...settings };
    setSettings(prev => ({ ...prev, [key]: value }));
    setSaving(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ [key]: value })
        .eq('id', user!.id);

      if (error) throw error;

      toast({
        title: 'Settings updated',
        description: 'Your notification preferences have been saved.',
      });
    } catch (error: any) {
      setSettings(previousSettings);
      toast({
        title: 'Error',
        description: 'Failed to update settings.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <DashboardLayout breadcrumbs={[{ label: 'Settings' }]}>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
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
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Profile
                </CardTitle>
                <CardDescription>Manage your profile information</CardDescription>
              </CardHeader>
              <CardContent>
                <Link to="/profile">
                  <Button variant="outline" className="w-full">
                    Edit Profile
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Appearance */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
                  Appearance
                </CardTitle>
                <CardDescription>Customize how ProOrbit looks</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Dark Mode</Label>
                    <p className="text-sm text-muted-foreground">
                      Switch between light and dark themes
                    </p>
                  </div>
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={toggleTheme}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notifications */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Notifications
                </CardTitle>
                <CardDescription>Configure notification preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Receive email updates about your projects
                    </p>
                  </div>
                  <Switch
                    checked={settings.notification_email}
                    onCheckedChange={(value) => updateSetting('notification_email', value)}
                    disabled={saving}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Comment Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone comments on your projects
                    </p>
                  </div>
                  <Switch
                    checked={settings.notification_comments}
                    onCheckedChange={(value) => updateSetting('notification_comments', value)}
                    disabled={saving}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Mention Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when someone mentions you
                    </p>
                  </div>
                  <Switch
                    checked={settings.notification_mentions}
                    onCheckedChange={(value) => updateSetting('notification_mentions', value)}
                    disabled={saving}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Assignment Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when you're assigned to a project
                    </p>
                  </div>
                  <Switch
                    checked={settings.notification_assignments}
                    onCheckedChange={(value) => updateSetting('notification_assignments', value)}
                    disabled={saving}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Status Change Notifications</Label>
                    <p className="text-sm text-muted-foreground">
                      Get notified when project status changes
                    </p>
                  </div>
                  <Switch
                    checked={settings.notification_status_changes}
                    onCheckedChange={(value) => updateSetting('notification_status_changes', value)}
                    disabled={saving}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Security */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Security
                </CardTitle>
                <CardDescription>Manage your account security</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-muted rounded-md">
                  <p className="text-sm text-muted-foreground">
                    You are signed in as <span className="font-medium text-foreground">{user?.email}</span>
                  </p>
                </div>
                <Button variant="destructive" onClick={handleSignOut} className="w-full">
                  Sign Out
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
