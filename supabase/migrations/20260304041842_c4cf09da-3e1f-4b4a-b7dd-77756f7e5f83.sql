
-- Create mentions table for tracking @username mentions
CREATE TABLE public.mentions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  mentioned_user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT mentions_has_reference CHECK (comment_id IS NOT NULL OR message_id IS NOT NULL)
);

ALTER TABLE public.mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mentions for accessible content"
ON public.mentions FOR SELECT
USING (
  (comment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM comments c WHERE c.id = mentions.comment_id AND has_project_access(auth.uid(), c.project_id)
  )) OR
  (message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM messages m WHERE m.id = mentions.message_id AND (m.sender_id = auth.uid() OR m.receiver_id = auth.uid())
  ))
);

CREATE POLICY "Authenticated users can create mentions"
ON public.mentions FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can view own mentions"
ON public.mentions FOR SELECT
USING (mentioned_user_id = auth.uid());

-- Update notify_mentions to prioritize username matching and insert mention records
CREATE OR REPLACE FUNCTION public.notify_mentions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  mention TEXT;
  mentioned_user_record RECORD;
  project_title TEXT;
BEGIN
  SELECT title INTO project_title FROM public.projects WHERE id = NEW.project_id;

  FOR mention IN SELECT unnest(extract_mentions(NEW.content))
  LOOP
    SELECT id INTO mentioned_user_record
    FROM public.profiles
    WHERE LOWER(username) = LOWER(mention)
       OR LOWER(full_name) = LOWER(mention)
       OR LOWER(SPLIT_PART(email, '@', 1)) = LOWER(mention)
    LIMIT 1;

    IF mentioned_user_record.id IS NOT NULL AND mentioned_user_record.id != NEW.user_id THEN
      -- Insert mention record
      INSERT INTO public.mentions (comment_id, mentioned_user_id)
      VALUES (NEW.id, mentioned_user_record.id);

      INSERT INTO public.notifications (user_id, type, title, message, link)
      VALUES (
        mentioned_user_record.id,
        'mention',
        'You were mentioned',
        'You were mentioned in a comment on "' || project_title || '"',
        '/project/' || NEW.project_id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;
