-- Fix infinite recursion in project_members RLS policy by creating a security definer function

-- Create a security definer function to check if user is project owner
CREATE OR REPLACE FUNCTION public.is_project_owner(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    WHERE p.id = _project_id
      AND p.created_by = _user_id
  )
$$;

-- Create a security definer function to check if user has a specific role on project
CREATE OR REPLACE FUNCTION public.has_project_role(_project_id uuid, _user_id uuid, _role project_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    WHERE pm.project_id = _project_id
      AND pm.user_id = _user_id
      AND pm.role = _role
  )
$$;

-- Drop existing problematic RLS policies on project_members
DROP POLICY IF EXISTS "Project owners can manage members" ON public.project_members;
DROP POLICY IF EXISTS "Users can view project members" ON public.project_members;

-- Create new RLS policies without recursion
CREATE POLICY "Project owners and admins can manage members"
ON public.project_members
FOR ALL
USING (
  is_project_owner(project_id, auth.uid()) OR
  has_project_role(project_id, auth.uid(), 'owner')
);

CREATE POLICY "Project members can view members"
ON public.project_members
FOR SELECT
USING (
  is_project_owner(project_id, auth.uid()) OR
  has_project_role(project_id, auth.uid(), 'owner') OR
  has_project_role(project_id, auth.uid(), 'editor') OR
  has_project_role(project_id, auth.uid(), 'viewer')
);

-- Add unique constraint for upsert to work if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'project_members_project_user_unique'
  ) THEN
    ALTER TABLE public.project_members 
    ADD CONSTRAINT project_members_project_user_unique 
    UNIQUE (project_id, user_id);
  END IF;
END $$;