
-- Enhanced status change notification trigger with role-based routing
CREATE OR REPLACE FUNCTION public.notify_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  project_title TEXT;
  member_record RECORD;
  new_status_label TEXT;
  notification_msg TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    project_title := NEW.title;
    
    -- Map status to label
    new_status_label := CASE NEW.status
      WHEN 'draft' THEN 'Draft'
      WHEN 'assigned' THEN 'Assigned'
      WHEN 'on_progress' THEN 'On Progress'
      WHEN 'review' THEN 'Review'
      WHEN 'revision' THEN 'Revision'
      WHEN 'completed' THEN 'Completed'
      WHEN 'delivered' THEN 'Delivered'
      WHEN 'closed' THEN 'Closed'
      ELSE NEW.status
    END;

    -- DRAFT: No notifications (only visible to creator)
    IF NEW.status = 'draft' THEN
      RETURN NEW;
    END IF;

    -- ASSIGNED: Notify the assignee
    IF NEW.status = 'assigned' THEN
      IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          NEW.assigned_to,
          'assignment',
          'New Task Assigned',
          'You have been assigned to "' || project_title || '"',
          '/project/' || NEW.id
        );
      END IF;
      RETURN NEW;
    END IF;

    -- ON_PROGRESS: Notify creator that work has started
    IF NEW.status = 'on_progress' THEN
      IF NEW.created_by != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          NEW.created_by,
          'status_change',
          'Work Started',
          '"' || project_title || '" is now in progress',
          '/project/' || NEW.id
        );
      END IF;
      RETURN NEW;
    END IF;

    -- REVIEW: Notify creator/manager that work is ready for review
    IF NEW.status = 'review' THEN
      IF NEW.created_by != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          NEW.created_by,
          'status_change',
          'Ready for Review',
          '"' || project_title || '" has been submitted for review',
          '/project/' || NEW.id
        );
      END IF;
      -- Also notify all project members with owner role
      FOR member_record IN 
        SELECT pm.user_id FROM public.project_members pm
        WHERE pm.project_id = NEW.id 
          AND pm.role = 'owner'
          AND pm.user_id != auth.uid()
          AND pm.user_id != NEW.created_by
      LOOP
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          member_record.user_id,
          'status_change',
          'Ready for Review',
          '"' || project_title || '" has been submitted for review',
          '/project/' || NEW.id
        );
      END LOOP;
      RETURN NEW;
    END IF;

    -- REVISION: Notify assignee that changes are requested
    IF NEW.status = 'revision' THEN
      IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          NEW.assigned_to,
          'status_change',
          'Changes Requested',
          'Revisions needed on "' || project_title || '"',
          '/project/' || NEW.id
        );
      END IF;
      RETURN NEW;
    END IF;

    -- COMPLETED: Notify creator
    IF NEW.status = 'completed' THEN
      IF NEW.created_by != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          NEW.created_by,
          'status_change',
          'Work Completed',
          '"' || project_title || '" has been completed and is ready for delivery',
          '/project/' || NEW.id
        );
      END IF;
      RETURN NEW;
    END IF;

    -- DELIVERED: Notify creator/admin
    IF NEW.status = 'delivered' THEN
      IF NEW.created_by != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          NEW.created_by,
          'status_change',
          'Project Delivered',
          '"' || project_title || '" has been delivered',
          '/project/' || NEW.id
        );
      END IF;
      RETURN NEW;
    END IF;

    -- CLOSED: Notify all members
    IF NEW.status = 'closed' THEN
      FOR member_record IN 
        SELECT pm.user_id FROM public.project_members pm
        WHERE pm.project_id = NEW.id AND pm.user_id != auth.uid()
      LOOP
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          member_record.user_id,
          'status_change',
          'Project Closed',
          '"' || project_title || '" has been closed and archived',
          '/project/' || NEW.id
        );
      END LOOP;
      -- Notify assignee too
      IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          NEW.assigned_to,
          'status_change',
          'Project Closed',
          '"' || project_title || '" has been closed and archived',
          '/project/' || NEW.id
        );
      END IF;
      -- Notify creator
      IF NEW.created_by != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (
          NEW.created_by,
          'status_change',
          'Project Closed',
          '"' || project_title || '" has been closed and archived',
          '/project/' || NEW.id
        );
      END IF;
      RETURN NEW;
    END IF;

    -- Default: generic notification for other statuses
    notification_msg := 'Project "' || project_title || '" status changed to ' || new_status_label;
    
    IF NEW.created_by != auth.uid() THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.created_by, 'status_change', 'Status Updated', notification_msg, '/project/' || NEW.id);
    END IF;
    
    IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() AND NEW.assigned_to != NEW.created_by THEN
      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (NEW.assigned_to, 'status_change', 'Status Updated', notification_msg, '/project/' || NEW.id);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Log project creation in activity log
CREATE OR REPLACE FUNCTION public.log_project_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.project_activity_log (project_id, user_id, action, details)
  VALUES (
    NEW.id,
    NEW.created_by,
    'project_created',
    jsonb_build_object('title', NEW.title, 'job_type', NEW.job_type)
  );
  RETURN NEW;
END;
$function$;

-- Create trigger for project creation logging
DROP TRIGGER IF EXISTS on_project_created ON public.projects;
CREATE TRIGGER on_project_created
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.log_project_creation();

-- Log member additions in activity log
CREATE OR REPLACE FUNCTION public.log_member_added()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  member_name TEXT;
  proj_id UUID;
BEGIN
  -- Get member name
  SELECT COALESCE(full_name, email) INTO member_name FROM public.profiles WHERE id = NEW.user_id;
  
  INSERT INTO public.project_activity_log (project_id, user_id, action, details)
  VALUES (
    NEW.project_id,
    NEW.user_id,
    'member_added',
    jsonb_build_object('member_name', member_name, 'role', NEW.role)
  );
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS on_project_member_added ON public.project_members;
CREATE TRIGGER on_project_member_added
  AFTER INSERT ON public.project_members
  FOR EACH ROW
  EXECUTE FUNCTION public.log_member_added();
