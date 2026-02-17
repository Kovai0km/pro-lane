-- Allow users to insert themselves as members (for accepting invitations)
CREATE POLICY "Users can add themselves as members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'member'::org_role);