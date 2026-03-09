
## Analysis Summary

### Issues Found

**1. Build Errors:**
- `src/pages/Project.tsx` line 111: Duplicate `on_progress` key in `STATUS_ROLE_MAP` (lines 104 and 111)
- Edge function `send-payment-success`: Import error for `npm:resend` - needs proper Deno import syntax

**2. ENUM Error (Console):**
- Error: `"invalid input value for enum project_status: \"Draft\""`
- The label "Draft" (capitalized) is being sent instead of the value "draft" (lowercase)

**3. Code Redundancy in Dashboard:**
- Line 46 has `['on_progress', 'on_progress']` - redundant duplicate

---

## Implementation Plan

### 1. Fix Build Error - Duplicate Key in Project.tsx

**File:** `src/pages/Project.tsx` (lines 101-112)

Remove the duplicate `on_progress` entry at line 111. The correct map should be:

```typescript
const STATUS_ROLE_MAP: Record<string, { allowedBy: WorkflowRole; transitions: string[] }> = {
  draft: { allowedBy: 'owner', transitions: ['assigned'] },
  assigned: { allowedBy: 'assignee', transitions: ['on_progress'] },
  on_progress: { allowedBy: 'assignee', transitions: ['review'] },
  review: { allowedBy: 'reviewer', transitions: ['revision', 'approved'] },
  revision: { allowedBy: 'assignee', transitions: ['on_progress', 'review'] },
  approved: { allowedBy: 'approver', transitions: ['delivered'] },
  delivered: { allowedBy: 'owner', transitions: ['closed'] },
  closed: { allowedBy: 'owner', transitions: [] },
  pending: { allowedBy: 'owner', transitions: ['assigned', 'draft'] },
};
```

### 2. Fix ENUM Error - Enhanced Status Change Handler

**File:** `src/pages/Project.tsx`

Update `handleStatusChange` to show specific database error messages and ensure lowercase:

```typescript
const handleStatusChange = async (newStatus: string) => {
  if (!project) return;

  // Validate and normalize status
  const safeStatus = newStatus.toLowerCase();
  const validStatuses = ['draft', 'assigned', 'on_progress', 'review', 'revision', 'approved', 'delivered', 'closed', 'pending'];
  
  if (!validStatuses.includes(safeStatus)) {
    toast({
      title: 'Invalid Status',
      description: `"${newStatus}" is not a valid status. Please select a valid status.`,
      variant: 'destructive',
    });
    return;
  }

  setStatusUpdating(true);
  try {
    const { error } = await supabase
      .from('projects')
      .update({ status: safeStatus as any })
      .eq('id', project.id);

    if (error) {
      // Show specific database error
      toast({
        title: 'Database Error',
        description: `Status update failed: ${error.message}`,
        variant: 'destructive',
      });
      return;
    }

    setProject({ ...project, status: safeStatus });
    toast({
      title: `Status → ${getStatusLabel(safeStatus)}`,
      description: workflowMessages[safeStatus] || 'Status updated successfully.',
    });
  } catch (error: any) {
    toast({
      title: 'Error',
      description: error.message || 'Failed to update status.',
      variant: 'destructive',
    });
  } finally {
    setStatusUpdating(false);
  }
};
```

### 3. Fix Dashboard Duplicate Status

**File:** `src/pages/Dashboard.tsx` (line 46)

Change from:
```typescript
{ key: 'on_progress', label: 'Active Tasks', statuses: ['on_progress', 'on_progress'], ...}
```

To:
```typescript
{ key: 'on_progress', label: 'Active Tasks', statuses: ['on_progress'], ...}
```

### 4. Fix Edge Function Import

**File:** `supabase/functions/send-payment-success/index.ts`

Change the import from:
```typescript
import { Resend } from "npm:resend@2.0.0";
```

To the proper JSR import:
```typescript
import { Resend } from "https://esm.sh/resend@2.0.0";
```

---

## Technical Details

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Project.tsx` | Remove duplicate `on_progress` key, enhance error handling |
| `src/pages/Dashboard.tsx` | Fix duplicate status in array |
| `supabase/functions/send-payment-success/index.ts` | Fix Resend import syntax |

### Validation Flow
1. User clicks status dropdown
2. `handleStatusChange(status.value)` called with lowercase value
3. Function validates against whitelist
4. If invalid → show error toast with details
5. If Supabase error → show database error message
6. If success → update UI and show success toast
