
-- Update generate_project_code to use org name prefix instead of PRJ
CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code text;
  random_part text;
BEGIN
  random_part := upper(substr(md5(random()::text), 1, 5));
  new_code := 'PRJ-' || random_part;
  RETURN new_code;
END;
$$;

-- Create a new function that generates org-based project codes
CREATE OR REPLACE FUNCTION public.generate_org_project_code(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  org_name text;
  prefix text;
  random_part text;
  new_code text;
BEGIN
  -- Get org name
  SELECT name INTO org_name FROM public.organizations WHERE id = org_id;
  
  IF org_name IS NULL THEN
    prefix := 'PRJ';
  ELSE
    -- Take first 3 chars of org name, uppercase, remove non-alpha
    prefix := upper(regexp_replace(substr(org_name, 1, 3), '[^A-Za-z]', '', 'g'));
    IF length(prefix) < 2 THEN
      prefix := 'PRJ';
    END IF;
  END IF;
  
  random_part := upper(substr(md5(random()::text), 1, 5));
  new_code := prefix || '-' || random_part;
  RETURN new_code;
END;
$$;

-- Update the trigger to use org-based code
CREATE OR REPLACE FUNCTION public.set_project_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_code IS NULL THEN
    IF NEW.organization_id IS NOT NULL THEN
      NEW.project_code := generate_org_project_code(NEW.organization_id);
    ELSE
      NEW.project_code := generate_project_code();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS set_project_code_trigger ON public.projects;
CREATE TRIGGER set_project_code_trigger
  BEFORE INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.set_project_code();
