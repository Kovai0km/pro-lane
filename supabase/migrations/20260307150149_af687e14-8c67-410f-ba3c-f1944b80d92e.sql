
DROP POLICY IF EXISTS "Admins can insert org members" ON public.organization_members;

CREATE POLICY "Org members can invite members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  is_org_member(auth.uid(), organization_id)
  OR (EXISTS (
    SELECT 1 FROM organizations o WHERE o.id = organization_members.organization_id AND o.owner_id = auth.uid()
  ))
  OR (auth.uid() = user_id AND role = 'member'::org_role)
);
