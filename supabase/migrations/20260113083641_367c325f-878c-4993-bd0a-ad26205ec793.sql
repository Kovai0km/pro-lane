-- Create function to extract mentioned users from content
CREATE OR REPLACE FUNCTION public.extract_mentions(content TEXT)
RETURNS TEXT[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mentions TEXT[];
  match_result TEXT;
BEGIN
  mentions := ARRAY[]::TEXT[];
  FOR match_result IN 
    SELECT (regexp_matches(content, '@(\w+)', 'g'))[1]
  LOOP
    mentions := array_append(mentions, match_result);
  END LOOP;
  RETURN mentions;
END;
$$;

-- Create function to create notification for mentions
CREATE OR REPLACE FUNCTION public.notify_mentions()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  mention TEXT;
  mentioned_user_id UUID;
  project_title TEXT;
BEGIN
  -- Get project title
  SELECT title INTO project_title FROM public.projects WHERE id = NEW.project_id;

  -- Extract mentions and notify each user
  FOR mention IN SELECT unnest(extract_mentions(NEW.content))
  LOOP
    -- Find user by full_name or email prefix
    SELECT id INTO mentioned_user_id
    FROM public.profiles
    WHERE LOWER(full_name) = LOWER(mention) 
       OR LOWER(SPLIT_PART(email, '@', 1)) = LOWER(mention)
    LIMIT 1;

    IF mentioned_user_id IS NOT NULL AND mentioned_user_id != NEW.user_id THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        mentioned_user_id,
        'mention',
        'You were mentioned',
        'You were mentioned in a comment on project "' || project_title || '"',
        '/project/' || NEW.project_id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger for comment mentions
DROP TRIGGER IF EXISTS on_comment_mention ON public.comments;
CREATE TRIGGER on_comment_mention
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_mentions();

-- Create function to notify on project assignment
CREATE OR REPLACE FUNCTION public.notify_project_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_title TEXT;
  assigner_name TEXT;
BEGIN
  -- Only trigger when assigned_to changes and is set
  IF (OLD.assigned_to IS DISTINCT FROM NEW.assigned_to) AND NEW.assigned_to IS NOT NULL THEN
    -- Get project title
    SELECT title INTO project_title FROM public.projects WHERE id = NEW.id;
    
    -- Get assigner name (the person who made the change)
    SELECT COALESCE(full_name, email) INTO assigner_name 
    FROM public.profiles 
    WHERE id = auth.uid();

    -- Create notification for the assignee
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
      NEW.assigned_to,
      'assignment',
      'Project Assigned',
      'You have been assigned to project "' || project_title || '"',
      '/project/' || NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for project assignment
DROP TRIGGER IF EXISTS on_project_assignment ON public.projects;
CREATE TRIGGER on_project_assignment
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_project_assignment();

-- Create function to notify on project status change
CREATE OR REPLACE FUNCTION public.notify_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_title TEXT;
  member_id UUID;
BEGIN
  -- Only trigger when status changes
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    project_title := NEW.title;

    -- Notify project creator
    IF NEW.created_by != auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        NEW.created_by,
        'status_change',
        'Project Status Updated',
        'Project "' || project_title || '" status changed to ' || NEW.status,
        '/project/' || NEW.id
      );
    END IF;

    -- Notify assignee if different from creator and updater
    IF NEW.assigned_to IS NOT NULL 
       AND NEW.assigned_to != auth.uid() 
       AND NEW.assigned_to != NEW.created_by THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        NEW.assigned_to,
        'status_change',
        'Project Status Updated',
        'Project "' || project_title || '" status changed to ' || NEW.status,
        '/project/' || NEW.id
      );
    END IF;

    -- Notify all project members
    FOR member_id IN 
      SELECT pm.user_id FROM public.project_members pm
      WHERE pm.project_id = NEW.id 
        AND pm.user_id != auth.uid()
        AND pm.user_id != NEW.created_by
        AND (NEW.assigned_to IS NULL OR pm.user_id != NEW.assigned_to)
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        member_id,
        'status_change',
        'Project Status Updated',
        'Project "' || project_title || '" status changed to ' || NEW.status,
        '/project/' || NEW.id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for status change notifications
DROP TRIGGER IF EXISTS on_project_status_change ON public.projects;
CREATE TRIGGER on_project_status_change
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_status_change();

-- Create function to log project activity
CREATE OR REPLACE FUNCTION public.log_project_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log status changes
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.project_activity_log (project_id, user_id, action, details)
    VALUES (
      NEW.id,
      auth.uid(),
      'status_changed',
      jsonb_build_object('old_status', OLD.status, 'new_status', NEW.status)
    );
  END IF;

  -- Log assignment changes
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    INSERT INTO public.project_activity_log (project_id, user_id, action, details)
    VALUES (
      NEW.id,
      auth.uid(),
      'assigned',
      jsonb_build_object('assigned_to', NEW.assigned_to)
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for activity logging
DROP TRIGGER IF EXISTS on_project_activity ON public.projects;
CREATE TRIGGER on_project_activity
  AFTER UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_activity();

-- Log comment activity
CREATE OR REPLACE FUNCTION public.log_comment_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_activity_log (project_id, user_id, action, details)
  VALUES (
    NEW.project_id,
    NEW.user_id,
    CASE WHEN NEW.output_id IS NULL THEN 'comment_added' ELSE 'feedback_added' END,
    jsonb_build_object('comment_id', NEW.id, 'output_id', NEW.output_id)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for comment activity
DROP TRIGGER IF EXISTS on_comment_activity ON public.comments;
CREATE TRIGGER on_comment_activity
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_comment_activity();

-- Log file upload activity
CREATE OR REPLACE FUNCTION public.log_output_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_activity_log (project_id, user_id, action, details)
  VALUES (
    NEW.project_id,
    NEW.uploaded_by,
    'output_uploaded',
    jsonb_build_object('file_name', NEW.file_name, 'output_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_output_activity ON public.project_outputs;
CREATE TRIGGER on_output_activity
  AFTER INSERT ON public.project_outputs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_output_activity();

-- Log attachment upload activity
CREATE OR REPLACE FUNCTION public.log_attachment_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_activity_log (project_id, user_id, action, details)
  VALUES (
    NEW.project_id,
    NEW.uploaded_by,
    'attachment_uploaded',
    jsonb_build_object('file_name', NEW.file_name, 'attachment_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_attachment_activity ON public.project_attachments;
CREATE TRIGGER on_attachment_activity
  AFTER INSERT ON public.project_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.log_attachment_activity();