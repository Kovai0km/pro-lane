import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, UserCheck, Eye, Shield, Loader2, X } from 'lucide-react';

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

interface WorkflowRolesProps {
  project: {
    id: string;
    assigned_to: string | null;
    reviewer_id: string | null;
    approver_id: string | null;
  };
  onUpdated: () => void;
}

function RoleAssignButton({
  label,
  icon: Icon,
  currentUserId,
  projectId,
  column,
  onUpdated,
}: {
  label: string;
  icon: typeof Eye;
  currentUserId: string | null;
  projectId: string;
  column: 'reviewer_id' | 'approver_id';
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<Profile[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<Profile | null>(null);

  useEffect(() => {
    if (open) {
      supabase.from('profiles').select('id, email, full_name').order('full_name').then(({ data }) => {
        setUsers(data || []);
      });
    }
  }, [open]);

  useEffect(() => {
    if (currentUserId) {
      supabase.from('profiles').select('id, email, full_name').eq('id', currentUserId).single().then(({ data }) => {
        setCurrentProfile(data);
      });
    } else {
      setCurrentProfile(null);
    }
  }, [currentUserId]);

  const filtered = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleAssign = async (userId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ [column]: userId })
        .eq('id', projectId);
      if (error) throw error;

      // Add as project member
      await supabase.from('project_members').upsert({
        project_id: projectId,
        user_id: userId,
        role: 'editor',
      }, { onConflict: 'project_id,user_id' });

      toast({ title: `${label} assigned` });
      setOpen(false);
      onUpdated();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('projects')
        .update({ [column]: null })
        .eq('id', projectId);
      if (error) throw error;
      toast({ title: `${label} removed` });
      onUpdated();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">{label}:</span>
      {currentProfile ? (
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium">{currentProfile.full_name || currentProfile.email.split('@')[0]}</span>
          <button onClick={handleRemove} className="text-muted-foreground hover:text-destructive transition-colors">
            <X className="h-3 w-3" />
          </button>
        </div>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
              Assign
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign {label}</DialogTitle>
              <DialogDescription>Choose a team member for the {label.toLowerCase()} role.</DialogDescription>
            </DialogHeader>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
            </div>
            <ScrollArea className="h-[200px] border rounded-md">
              {filtered.map(u => (
                <button
                  key={u.id}
                  onClick={() => handleAssign(u.id)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 p-3 hover:bg-secondary transition-colors text-left"
                >
                  <div className="h-7 w-7 border rounded flex items-center justify-center text-xs font-bold">
                    {(u.full_name || u.email).charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{u.full_name || 'No name'}</div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </div>
                </button>
              ))}
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export function WorkflowRoles({ project, onUpdated }: WorkflowRolesProps) {
  return (
    <div className="flex flex-wrap gap-4 mt-2">
      <RoleAssignButton
        label="Reviewer"
        icon={Eye}
        currentUserId={project.reviewer_id}
        projectId={project.id}
        column="reviewer_id"
        onUpdated={onUpdated}
      />
      <RoleAssignButton
        label="Approver"
        icon={Shield}
        currentUserId={project.approver_id}
        projectId={project.id}
        column="approver_id"
        onUpdated={onUpdated}
      />
    </div>
  );
}
