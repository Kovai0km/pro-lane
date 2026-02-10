-- Add priority enum type
CREATE TYPE public.project_priority AS ENUM ('high', 'medium', 'low');

-- Add priority and project_code columns to projects table
ALTER TABLE public.projects
ADD COLUMN priority public.project_priority NOT NULL DEFAULT 'medium',
ADD COLUMN project_code TEXT UNIQUE;

-- Create a function to generate unique readable project codes
CREATE OR REPLACE FUNCTION public.generate_project_code()
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
  attempts INTEGER := 0;
BEGIN
  LOOP
    -- Generate a code like "PRJ-A1B2C3"
    new_code := 'PRJ-' || upper(substring(md5(random()::text) from 1 for 6));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM projects WHERE project_code = new_code) INTO code_exists;
    
    -- If code doesn't exist, return it
    IF NOT code_exists THEN
      RETURN new_code;
    END IF;
    
    attempts := attempts + 1;
    IF attempts > 100 THEN
      -- Fallback to longer code
      RETURN 'PRJ-' || upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));
    END IF;
  END LOOP;
END;
$$;

-- Create a trigger to auto-generate project_code on insert
CREATE OR REPLACE FUNCTION public.set_project_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.project_code IS NULL THEN
    NEW.project_code := generate_project_code();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_project_code_trigger
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.set_project_code();

-- Update existing projects with project codes
UPDATE public.projects
SET project_code = 'PRJ-' || upper(substring(id::text from 1 for 6))
WHERE project_code IS NULL;