import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Check, Crown, Wrench, Eye, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

const WORKFLOW_STEPS = [
  { status: 'draft', label: 'Draft', role: 'owner', icon: Crown },
  { status: 'assigned', label: 'Assigned', role: 'owner', icon: Crown },
  { status: 'on_progress', label: 'In Progress', role: 'assignee', icon: Wrench },
  { status: 'review', label: 'Review', role: 'reviewer', icon: Eye },
  { status: 'completed', label: 'Completed', role: 'reviewer', icon: Eye },
  { status: 'approved', label: 'Approved', role: 'approver', icon: Shield },
  { status: 'delivered', label: 'Delivered', role: 'owner', icon: Crown },
  { status: 'closed', label: 'Closed', role: 'owner', icon: Crown },
] as const;

const REVISION_STATUS = 'revision';

// Map pending/in_progress to their workflow equivalents
const STATUS_ALIAS: Record<string, string> = {
  pending: 'draft',
  in_progress: 'on_progress',
};

interface WorkflowStepperProps {
  project: {
    status: string;
    created_by: string;
    assigned_to: string | null;
    reviewer_id: string | null;
    approver_id: string | null;
  };
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  assignee: 'Assignee',
  reviewer: 'Reviewer',
  approver: 'Approver',
};

export function WorkflowStepper({ project }: WorkflowStepperProps) {
  const [roleNames, setRoleNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const ids = [project.created_by, project.assigned_to, project.reviewer_id, project.approver_id].filter(Boolean) as string[];
    const uniqueIds = [...new Set(ids)];
    if (uniqueIds.length > 0) {
      supabase.from('profiles').select('id, full_name, email').in('id', uniqueIds).then(({ data }) => {
        const map: Record<string, string> = {};
        data?.forEach(p => { map[p.id] = p.full_name || p.email.split('@')[0]; });
        setRoleNames(map);
      });
    }
  }, [project.created_by, project.assigned_to, project.reviewer_id, project.approver_id]);

  const effectiveStatus = STATUS_ALIAS[project.status] || project.status;
  const currentIndex = WORKFLOW_STEPS.findIndex(s => s.status === effectiveStatus);
  const isRevision = project.status === REVISION_STATUS;

  const getRoleUserId = (role: string) => {
    switch (role) {
      case 'owner': return project.created_by;
      case 'assignee': return project.assigned_to;
      case 'reviewer': return project.reviewer_id;
      case 'approver': return project.approver_id;
      default: return null;
    }
  };

  return (
    <div className="w-full">
      {isRevision && (
        <div className="mb-3 px-3 py-1.5 bg-destructive/10 border border-destructive/20 rounded-md text-xs text-destructive font-medium">
          🔁 Revision requested — Assignee needs to rework and resubmit for review
        </div>
      )}
      <div className="flex items-center w-full overflow-x-auto pb-2">
        {WORKFLOW_STEPS.map((step, index) => {
          const isCompleted = !isRevision && currentIndex > index;
          const isCurrent = !isRevision && currentIndex === index;
          const isFuture = isRevision || currentIndex < index;
          const StepIcon = step.icon;
          const userId = getRoleUserId(step.role);
          const userName = userId ? roleNames[userId] : null;

          return (
            <div key={step.status} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center min-w-[60px]">
                <div
                  className={cn(
                    'h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all',
                    isCompleted && 'bg-primary border-primary text-primary-foreground',
                    isCurrent && 'border-primary bg-primary/10 text-primary ring-2 ring-primary/30',
                    isFuture && 'border-muted-foreground/30 text-muted-foreground/40'
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <StepIcon className="h-3.5 w-3.5" />
                  )}
                </div>
                <span className={cn(
                  'text-[10px] mt-1 text-center leading-tight font-medium',
                  isCurrent && 'text-primary',
                  isCompleted && 'text-muted-foreground',
                  isFuture && 'text-muted-foreground/40'
                )}>
                  {step.label}
                </span>
                {isCurrent && userName && (
                  <span className="text-[9px] text-primary/70 truncate max-w-[70px]">
                    {userName}
                  </span>
                )}
                {isCurrent && !userName && (
                  <span className="text-[9px] text-muted-foreground">
                    {ROLE_LABELS[step.role]}
                  </span>
                )}
              </div>
              {index < WORKFLOW_STEPS.length - 1 && (
                <div className={cn(
                  'flex-1 h-0.5 mx-1 min-w-[12px]',
                  isCompleted ? 'bg-primary' : 'bg-muted-foreground/20'
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
