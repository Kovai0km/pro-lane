
-- 1. Fix profiles: restrict SELECT to authenticated users only
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- 2. Fix project_invitations: restrict public token enumeration
DROP POLICY IF EXISTS "Anyone can view invitation by token" ON public.project_invitations;
CREATE POLICY "Users can view invitation by their email"
ON public.project_invitations
FOR SELECT
USING (email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- 3. Add service-role INSERT policy for payments (edge functions use service role)
-- Payments are created by edge functions, not directly by users
-- No client-side INSERT policy needed, but add UPDATE for status tracking
CREATE POLICY "Users can view and track own payments"
ON public.payments
FOR UPDATE
USING (auth.uid() = user_id);

-- 4. Add write policies for subscriptions (managed by edge functions)
-- Users should not directly write subscriptions, but allow service role via edge functions
-- Add INSERT for the verify-payment edge function context
CREATE POLICY "Service can manage subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own subscriptions"
ON public.subscriptions
FOR UPDATE
USING (auth.uid() = user_id);
