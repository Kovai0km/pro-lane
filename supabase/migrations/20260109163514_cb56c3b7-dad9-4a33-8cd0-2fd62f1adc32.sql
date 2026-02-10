-- Phase 1.1: Add team_id to messages table for team channel support
ALTER TABLE public.messages ADD COLUMN team_id uuid REFERENCES public.teams(id) ON DELETE CASCADE;

-- Create index for better performance
CREATE INDEX idx_messages_team_id ON public.messages(team_id) WHERE team_id IS NOT NULL;

-- Update RLS policies for messages to include team channel support
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update own sent messages" ON public.messages;

-- Users can view messages they sent/received OR team messages they have access to
CREATE POLICY "Users can view messages"
ON public.messages FOR SELECT
USING (
  (auth.uid() = sender_id) OR 
  (auth.uid() = receiver_id) OR
  (team_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = messages.team_id 
    AND is_org_member(auth.uid(), t.organization_id)
  ))
);

-- Users can send DMs or team messages if they're org members
CREATE POLICY "Users can send messages"
ON public.messages FOR INSERT
WITH CHECK (
  auth.uid() = sender_id AND (
    -- DM: receiver_id is set
    (receiver_id IS NOT NULL AND team_id IS NULL) OR
    -- Team message: team_id is set and user is org member
    (team_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = team_id
      AND is_org_member(auth.uid(), t.organization_id)
    ))
  )
);

-- Users can update messages they sent or received (for marking as read)
CREATE POLICY "Users can update messages"
ON public.messages FOR UPDATE
USING (
  (auth.uid() = sender_id) OR 
  (auth.uid() = receiver_id) OR
  (team_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = messages.team_id
    AND is_org_member(auth.uid(), t.organization_id)
  ))
);

-- Phase 1.2: Create project_activity_log table for activity timeline
CREATE TABLE public.project_activity_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action text NOT NULL,
  details jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on project_activity_log
ALTER TABLE public.project_activity_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for activity log
CREATE POLICY "Users with project access can view activity"
ON public.project_activity_log FOR SELECT
USING (has_project_access(auth.uid(), project_id));

CREATE POLICY "Users with project access can create activity"
ON public.project_activity_log FOR INSERT
WITH CHECK (has_project_access(auth.uid(), project_id) AND auth.uid() = user_id);

-- Create index for performance
CREATE INDEX idx_activity_log_project_id ON public.project_activity_log(project_id);
CREATE INDEX idx_activity_log_created_at ON public.project_activity_log(created_at DESC);

-- Phase 1.3: Create reactions table for emoji reactions
CREATE TABLE public.reactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  emoji text NOT NULL,
  message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT reaction_target CHECK (
    (message_id IS NOT NULL AND comment_id IS NULL) OR
    (message_id IS NULL AND comment_id IS NOT NULL)
  ),
  UNIQUE(user_id, emoji, message_id),
  UNIQUE(user_id, emoji, comment_id)
);

-- Enable RLS on reactions
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for reactions
CREATE POLICY "Users can view reactions on accessible content"
ON public.reactions FOR SELECT
USING (
  (message_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.messages m WHERE m.id = message_id AND (
      m.sender_id = auth.uid() OR 
      m.receiver_id = auth.uid() OR
      (m.team_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.teams t WHERE t.id = m.team_id AND is_org_member(auth.uid(), t.organization_id)
      ))
    )
  )) OR
  (comment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.comments c WHERE c.id = comment_id AND has_project_access(auth.uid(), c.project_id)
  ))
);

CREATE POLICY "Users can add reactions"
ON public.reactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove own reactions"
ON public.reactions FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for reactions
CREATE INDEX idx_reactions_message_id ON public.reactions(message_id) WHERE message_id IS NOT NULL;
CREATE INDEX idx_reactions_comment_id ON public.reactions(comment_id) WHERE comment_id IS NOT NULL;

-- Phase 1.4: Add notification preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN notification_email boolean DEFAULT true,
ADD COLUMN notification_mentions boolean DEFAULT true,
ADD COLUMN notification_assignments boolean DEFAULT true,
ADD COLUMN notification_comments boolean DEFAULT true,
ADD COLUMN notification_status_changes boolean DEFAULT true;

-- Enable realtime for messages table (for team channels)
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;