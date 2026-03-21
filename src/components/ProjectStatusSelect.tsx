import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

const PROJECT_STATUSES = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-400' },
  { value: 'draft', label: 'Draft', color: 'bg-gray-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-yellow-400' },
  { value: 'assigned', label: 'Assigned', color: 'bg-blue-500' },
  { value: 'on_progress', label: 'On Progress', color: 'bg-yellow-500' },
  { value: 'review', label: 'Review', color: 'bg-purple-500' },
  { value: 'revision', label: 'Revision', color: 'bg-orange-500' },
  { value: 'approved', label: 'Approved', color: 'bg-teal-500' },
  { value: 'delivered', label: 'Delivered', color: 'bg-emerald-500' },
  { value: 'closed', label: 'Closed', color: 'bg-slate-500' },
] as const;

interface ProjectStatusSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function ProjectStatusSelect({ value, onValueChange, disabled }: ProjectStatusSelectProps) {
  const currentStatus = PROJECT_STATUSES.find((s) => s.value === value);
  
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select status">
          {currentStatus && (
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", currentStatus.color)} />
              {currentStatus.label}
            </div>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {PROJECT_STATUSES.map((status) => (
          <SelectItem key={status.value} value={status.value}>
            <div className="flex items-center gap-2">
              <span className={cn("h-2 w-2 rounded-full", status.color)} />
              {status.label}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function getStatusLabel(status: string): string {
  const found = PROJECT_STATUSES.find((s) => s.value === status);
  return found?.label || status.replace('_', ' ');
}

export function getStatusColor(status: string): string {
  const found = PROJECT_STATUSES.find((s) => s.value === status);
  return found?.color || 'bg-gray-500';
}

export function getStatusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'outline',
    draft: 'outline',
    assigned: 'secondary',
    on_progress: 'default',
    review: 'secondary',
    revision: 'destructive',
    approved: 'default',
    delivered: 'default',
    closed: 'outline',
  };
  return variants[status] || 'outline';
}
