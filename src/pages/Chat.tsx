import { useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ChatLayout } from '@/components/chat';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

export default function ChatPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user, loading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <DashboardLayout title="Chat">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!user) {
    return null;
  }

  if (!orgId) {
    return (
      <DashboardLayout title="Chat">
        <div className="flex items-center justify-center h-96">
          <p className="text-muted-foreground">Please select an organization to access chat.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: 'Organization', href: `/org/${orgId}` },
        { label: 'Chat' },
      ]}
    >
      <ChatLayout orgId={orgId} />
    </DashboardLayout>
  );
}
