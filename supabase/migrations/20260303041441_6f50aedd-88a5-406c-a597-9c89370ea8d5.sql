
-- Add 'approved' to project_status enum
ALTER TYPE public.project_status ADD VALUE IF NOT EXISTS 'approved';

-- Add reviewer_id and approver_id columns to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS reviewer_id uuid;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS approver_id uuid;

-- Update the notify_status_change trigger function with role-based logic
CREATE OR REPLACE FUNCTION public.notify_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  project_title TEXT;
  new_status_label TEXT;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    project_title := NEW.title;
    
    new_status_label := CASE NEW.status
      WHEN 'draft' THEN 'Draft'
      WHEN 'assigned' THEN 'Assigned'
      WHEN 'on_progress' THEN 'On Progress'
      WHEN 'review' THEN 'Review'
      WHEN 'revision' THEN 'Revision'
      WHEN 'completed' THEN 'Completed'
      WHEN 'approved' THEN 'Approved'
      WHEN 'delivered' THEN 'Delivered'
      WHEN 'closed' THEN 'Closed'
      ELSE NEW.status
    END;

    -- DRAFT: No notifications
    IF NEW.status = 'draft' THEN
      RETURN NEW;
    END IF;

    -- ASSIGNED: Notify assignee
    IF NEW.status = 'assigned' THEN
      IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.assigned_to, 'assignment', 'New Task Assigned', 'You have been assigned to "' || project_title || '"', '/project/' || NEW.id);
      END IF;
      RETURN NEW;
    END IF;

    -- ON_PROGRESS: Notify owner
    IF NEW.status = 'on_progress' THEN
      IF NEW.created_by != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.created_by, 'status_change', 'Work Started', '"' || project_title || '" is now in progress', '/project/' || NEW.id);
      END IF;
      RETURN NEW;
    END IF;

    -- REVIEW: Notify reviewer (or owner if no reviewer set)
    IF NEW.status = 'review' THEN
      IF NEW.reviewer_id IS NOT NULL AND NEW.reviewer_id != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.reviewer_id, 'status_change', 'Ready for Review', '"' || project_title || '" has been submitted for your review', '/project/' || NEW.id);
      ELSIF NEW.created_by != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.created_by, 'status_change', 'Ready for Review', '"' || project_title || '" has been submitted for review', '/project/' || NEW.id);
      END IF;
      RETURN NEW;
    END IF;

    -- REVISION: Notify assignee
    IF NEW.status = 'revision' THEN
      IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.assigned_to, 'status_change', 'Changes Requested', 'Revisions needed on "' || project_title || '"', '/project/' || NEW.id);
      END IF;
      RETURN NEW;
    END IF;

    -- COMPLETED: Notify owner
    IF NEW.status = 'completed' THEN
      IF NEW.created_by != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.created_by, 'status_change', 'Work Completed', '"' || project_title || '" has been completed', '/project/' || NEW.id);
      END IF;
      RETURN NEW;
    END IF;

    -- APPROVED: Notify approver (or owner if no approver)
    IF NEW.status = 'approved' THEN
      IF NEW.approver_id IS NOT NULL AND NEW.approver_id != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.approver_id, 'status_change', 'Approved - Ready for Delivery', '"' || project_title || '" has been approved and is ready for delivery', '/project/' || NEW.id);
      ELSIF NEW.created_by != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.created_by, 'status_change', 'Approved', '"' || project_title || '" has been approved', '/project/' || NEW.id);
      END IF;
      RETURN NEW;
    END IF;

    -- DELIVERED: Notify owner
    IF NEW.status = 'delivered' THEN
      IF NEW.created_by != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.created_by, 'status_change', 'Project Delivered', '"' || project_title || '" has been delivered', '/project/' || NEW.id);
      END IF;
      RETURN NEW;
    END IF;

    -- CLOSED: Notify all relevant roles
    IF NEW.status = 'closed' THEN
      IF NEW.assigned_to IS NOT NULL AND NEW.assigned_to != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.assigned_to, 'status_change', 'Project Closed', '"' || project_title || '" has been closed', '/project/' || NEW.id);
      END IF;
      IF NEW.reviewer_id IS NOT NULL AND NEW.reviewer_id != auth.uid() AND NEW.reviewer_id != NEW.assigned_to THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.reviewer_id, 'status_change', 'Project Closed', '"' || project_title || '" has been closed', '/project/' || NEW.id);
      END IF;
      IF NEW.approver_id IS NOT NULL AND NEW.approver_id != auth.uid() AND NEW.approver_id != NEW.assigned_to AND NEW.approver_id != NEW.reviewer_id THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.approver_id, 'status_change', 'Project Closed', '"' || project_title || '" has been closed', '/project/' || NEW.id);
      END IF;
      IF NEW.created_by != auth.uid() THEN
        INSERT INTO public.notifications (user_id, type, title, message, link)
        VALUES (NEW.created_by, 'status_change', 'Project Closed', '"' || project_title || '" has been closed', '/project/' || NEW.id);
      END IF;
      RETURN NEW;
    END IF;

  END IF;
  RETURN NEW;
END;
$function$;
