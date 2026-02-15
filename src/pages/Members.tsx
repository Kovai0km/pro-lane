import { useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { MemberManagement } from '@/components/MemberManagement';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function MembersPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();
  const [orgName, setOrgName] = useState('');
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (orgId && user) {
      Promise.all([
        supabase.from('organizations').select('name, owner_id').eq('id', orgId).single(),
      ]).then(([{ data }]) => {
        if (data) {
          setOrgName(data.name);
          setIsOwner(data.owner_id === user.id);
        }
        setLoading(false);
      });
    }
  }, [orgId, user]);

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
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-2">Members</h1>
          <p className="text-muted-foreground mb-8">Manage members of {orgName}</p>
          {orgId && <MemberManagement organizationId={orgId} isOwner={isOwner} />}
        </div>
      </div>
    </DashboardLayout>
  );
}
