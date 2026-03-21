import type { Enums } from "@/integrations/supabase/types";

export type ProjectStatus = Enums<"project_status">;
export type ProjectPriority = Enums<"project_priority">;
export type ProjectRole = Enums<"project_role">;
export type OrgRole = Enums<"org_role">;
export type JobType = Enums<"job_type">;

// ✅ Use ONLY these values — they exactly match the Supabase enum
export const PROJECT_STATUSES: {
  value: ProjectStatus;
  label: string;
  color: string;
}[] = [
  { value: "pending",     label: "Pending",     color: "bg-gray-400" },
  { value: "draft",       label: "Draft",       color: "bg-slate-400" },
  { value: "assigned",    label: "Assigned",    color: "bg-blue-400" },
  { value: "in_progress", label: "In Progress", color: "bg-yellow-400" },
  { value: "on_progress", label: "On Progress", color: "bg-orange-400" },
  { value: "review",      label: "Review",      color: "bg-purple-400" },
  { value: "revision",    label: "Revision",    color: "bg-red-400" },
  { value: "delivered",   label: "Delivered",   color: "bg-teal-400" },
  { value: "approved",    label: "Approved",    color: "bg-green-400" },
  { value: "completed",   label: "Completed",   color: "bg-green-600" },
  { value: "closed",      label: "Closed",      color: "bg-gray-600" },
];

export const PROJECT_PRIORITIES: {
  value: ProjectPriority;
  label: string;
  color: string;
}[] = [
  { value: "high",   label: "High",   color: "text-red-500" },
  { value: "medium", label: "Medium", color: "text-yellow-500" },
  { value: "low",    label: "Low",    color: "text-green-500" },
];

export const JOB_TYPES: {
  value: JobType;
  label: string;
}[] = [
  { value: "video_editing", label: "Video Editing" },
  { value: "design",        label: "Design" },
  { value: "website",       label: "Website" },
  { value: "other",         label: "Other" },
];
