-- Fix the overly permissive notifications INSERT policy
-- System notifications should be created by authenticated users or service role
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications"
ON public.notifications FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);