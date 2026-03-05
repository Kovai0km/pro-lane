import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, UserPlus, LayoutGrid, List, Mail, Shield, User, Users, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { UserAvatar } from '@/components/ui/user-avatar';
import { MemberManagement } from '@/components/MemberManagement';

interface Member {
  id: string;
  user_id: string;
  role: 'admin' | 'member';
  created_at: string;
  profile?: {
    id: string;
    email: string;
    full_name: string | null;
    avatar_url: string | null;
    username: string | null;
  };
}

export default function MembersPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orgName, setOrgName] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [search, setSearch] = useState('');
  const [showInvite, setShowInvite] = useState(false);

  useEffect(() => {
    if (orgId && user) {
      fetchData();
    }
  }, [orgId, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [orgRes, membersRes] = await Promise.all([
        supabase.from('organizations').select('name, owner_id').eq('id', orgId!).single(),
        supabase.from('organization_members').select('*').eq('organization_id', orgId!).order('created_at', { ascending: true }),
      ]);

      if (orgRes.data) {
        setOrgName(orgRes.data.name);
        setIsOwner(orgRes.data.owner_id === user!.id);
      }

      if (membersRes.data && membersRes.data.length > 0) {
        const userIds = membersRes.data.map((m) => m.user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, email, full_name, avatar_url, username')
          .in('id', userIds);

        const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);
        setMembers(
          membersRes.data.map((m) => ({
            ...m,
            profile: profileMap.get(m.user_id),
          }))
        );
      } else {
        setMembers([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = members.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      m.profile?.full_name?.toLowerCase().includes(q) ||
      m.profile?.email?.toLowerCase().includes(q) ||
      m.profile?.username?.toLowerCase().includes(q)
    );
  });

  const handleMemberClick = (member: Member) => {
    const username = member.profile?.username || member.profile?.email?.split('@')[0];
    if (username) navigate(`/u/${username}`);
  };

  if (loading) {
    return (
      <DashboardLayout title="Members">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout breadcrumbs={[{ label: orgName, href: `/org/${orgId}` }, { label: 'Members' }]}>
      <div className="p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div>
              <h1 className="text-3xl font-bold mb-1">Members</h1>
              <p className="text-muted-foreground">{members.length} member{members.length !== 1 ? 's' : ''} in {orgName}</p>
            </div>
            <Button onClick={() => setShowInvite(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Invite Member
            </Button>
          </div>

          {/* Search & View Toggle */}
          <div className="flex items-center gap-3 mb-6">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-r-none"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-l-none"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* List View */}
          {viewMode === 'list' && (
            <div className="space-y-2">
              {filtered.map((member) => (
                <div
                  key={member.id}
                  onClick={() => handleMemberClick(member)}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      src={member.profile?.avatar_url}
                      name={member.profile?.full_name}
                      email={member.profile?.email}
                      size="md"
                    />
                    <div>
                      <div className="font-medium">{member.profile?.full_name || 'No name'}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {member.profile?.email}
                      </div>
                    </div>
                  </div>
                  <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                    {member.role === 'admin' ? 'Admin (Owner)' : 'Member'}
                  </Badge>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-muted-foreground">
                  {search ? 'No members match your search.' : 'No members yet.'}
                </div>
              )}
            </div>
          )}

          {/* Grid View */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((member) => (
                <Card
                  key={member.id}
                  onClick={() => handleMemberClick(member)}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <CardContent className="p-6 flex flex-col items-center text-center">
                    <UserAvatar
                      src={member.profile?.avatar_url}
                      name={member.profile?.full_name}
                      email={member.profile?.email}
                      size="lg"
                      className="mb-3"
                    />
                    <div className="font-medium mb-1">{member.profile?.full_name || 'No name'}</div>
                    <div className="text-sm text-muted-foreground mb-3">{member.profile?.email}</div>
                    <Badge variant={member.role === 'admin' ? 'default' : 'secondary'}>
                      {member.role === 'admin' ? 'Admin (Owner)' : 'Member'}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
              {filtered.length === 0 && (
                <div className="col-span-full text-center py-12 text-muted-foreground">
                  {search ? 'No members match your search.' : 'No members yet.'}
                </div>
              )}
            </div>
          )}

          {/* Invite Dialog - reuse MemberManagement for invite functionality */}
          {showInvite && orgId && (
            <div className="fixed inset-0 z-50 bg-background/80 flex items-center justify-center p-4" onClick={() => setShowInvite(false)}>
              <div className="bg-background border rounded-lg shadow-lg max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold">Invite Members</h2>
                  <Button variant="ghost" size="sm" onClick={() => setShowInvite(false)}>✕</Button>
                </div>
                <MemberManagement organizationId={orgId} isOwner={isOwner} />
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
