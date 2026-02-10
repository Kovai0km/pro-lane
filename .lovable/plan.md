
# ProOrbit Application Analysis

## Errors Found

### 1. Console Warning: DialogFooter ref issue
The `DialogFooter` component in `dialog.tsx` is a plain function component (not wrapped in `React.forwardRef`), but something is trying to pass a ref to it in the Dashboard page. This causes a React warning in the console.

**Fix:** Wrap `DialogFooter` (and `DialogHeader`) with `React.forwardRef` in `src/components/ui/dialog.tsx`.

### 2. Razorpay SDK not loaded
The Billing page calls `new (window as any).Razorpay(options)` but there is no `<script>` tag loading the Razorpay checkout SDK (`https://checkout.razorpay.com/v1/checkout.js`). This will crash at runtime when a user tries to upgrade.

**Fix:** Add the Razorpay script tag to `index.html`, or dynamically load it before opening the payment modal.

### 3. Avatar upload uses private bucket with `getPublicUrl`
The `project-files` storage bucket is **not public**, yet the Profile page uses `getPublicUrl()` to generate avatar URLs. These URLs will return 400/403 errors, so avatars will never display.

**Fix:** Either make the bucket public, create a dedicated public `avatars` bucket, or use signed URLs for avatar display.

### 4. Missing `Chat` page import
`App.tsx` imports `const Chat = lazy(() => import("./pages/Chat"))` but there is no `src/pages/Chat.tsx` file listed -- it exists as the default export of `ChatPage` in the file. The import path should work, but the component exports as `ChatPage` not as a default. Need to verify this doesn't cause issues at runtime.

---

## Security Issues (from scan)

### Critical
1. **Profiles table publicly readable** -- The RLS policy `Users can view all profiles` uses condition `true`, exposing all user emails to anyone. Restrict SELECT to authenticated users within the same organizations.
2. **Project invitation tokens exposed** -- `Anyone can view invitation by token` policy with condition `true` allows attackers to enumerate and steal invitation tokens. Restrict to checking by specific token value or invited email.

### Warnings
3. **Leaked password protection disabled** -- Enable leaked password protection in auth settings.
4. **Extension in public schema** -- The `pg_trgm` extension is installed in the `public` schema instead of a dedicated `extensions` schema.
5. **Payments table missing INSERT policy** -- Could allow forged payment records.
6. **Subscriptions table missing write policies** -- No INSERT/UPDATE/DELETE policies for subscriptions.

---

## Features to Implement / Improvements

### High Priority
1. **Protected routes** -- There is no route guard redirecting unauthenticated users away from `/dashboard`, `/profile`, `/billing`, etc. Any unauthenticated user can navigate to these routes directly and see broken states.
2. **Email verification flow** -- Signup appears to auto-confirm and immediately redirect to dashboard. Users should verify their email first, or at minimum a confirmation message should be shown.
3. **Error boundaries** -- No React error boundaries exist. A crash in any component takes down the entire app.

### Medium Priority
4. **Razorpay script loading** -- As noted in errors above.
5. **Storage bucket access** -- Fix avatar URLs with proper signed URL approach.
6. **Mobile sidebar** -- The sidebar (`AppSidebar`) has chat sections hidden when collapsed, but no mobile drawer/sheet for navigation on small screens beyond the basic mobile menu in the Header.
7. **Org deletion cleanup** -- The `org_delete_otp` table and `send-delete-otp` edge function exist, but need to verify the full deletion flow works end-to-end.

### Low Priority
8. **Search functionality** -- `GlobalSearch` component exists but would benefit from debouncing and better empty-state handling.
9. **Notification real-time updates** -- Notifications are fetched once; consider adding realtime subscriptions.
10. **Pagination** -- Recent projects on dashboard are limited to 6, but there is no "View All" or pagination for large datasets.

---

## Technical Details

### Files to modify:
| File | Change |
|------|--------|
| `src/components/ui/dialog.tsx` | Wrap `DialogFooter` and `DialogHeader` with `React.forwardRef` |
| `index.html` | Add Razorpay checkout.js script tag |
| `src/pages/Profile.tsx` | Replace `getPublicUrl` with signed URL approach for avatars |
| `src/App.tsx` | Add a `ProtectedRoute` wrapper component for authenticated routes |
| Database migration | Fix RLS policies on `profiles` and `project_invitations` tables |
| Database migration | Add write policies for `payments` and `subscriptions` tables |

### Implementation order:
1. Fix DialogFooter ref warning (quick fix)
2. Fix RLS security issues (critical)
3. Add protected routes (high priority)
4. Fix avatar URL handling (functional bug)
5. Add Razorpay script loading (payment flow)
6. Add error boundaries (stability)
7. Remaining improvements as needed
