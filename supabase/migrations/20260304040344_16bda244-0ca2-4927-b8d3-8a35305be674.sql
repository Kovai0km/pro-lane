
-- Set default reviewer_id and approver_id to created_by on project creation
CREATE OR REPLACE FUNCTION public.set_default_workflow_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.reviewer_id IS NULL THEN
    NEW.reviewer_id := NEW.created_by;
  END IF;
  IF NEW.approver_id IS NULL THEN
    NEW.approver_id := NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_default_workflow_roles_trigger
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_default_workflow_roles();

-- Update existing projects that have NULL reviewer_id or approver_id
UPDATE public.projects SET reviewer_id = created_by WHERE reviewer_id IS NULL;
UPDATE public.projects SET approver_id = created_by WHERE approver_id IS NULL;
