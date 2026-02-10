CREATE EXTENSION IF NOT EXISTS "pg_graphql";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "plpgsql";
CREATE EXTENSION IF NOT EXISTS "supabase_vault";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";
BEGIN;

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--



--
-- Name: job_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.job_type AS ENUM (
    'video_editing',
    'design',
    'website',
    'other'
);


--
-- Name: org_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.org_role AS ENUM (
    'admin',
    'member'
);


--
-- Name: project_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_role AS ENUM (
    'owner',
    'editor',
    'viewer'
);


--
-- Name: project_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.project_status AS ENUM (
    'pending',
    'in_progress',
    'review',
    'completed',
    'draft',
    'assigned',
    'on_progress',
    'revision',
    'delivered',
    'closed'
);


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$;


--
-- Name: has_project_access(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_project_access(_user_id uuid, _project_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members
    WHERE user_id = _user_id AND project_id = _project_id
  ) OR EXISTS (
    SELECT 1 FROM public.projects
    WHERE id = _project_id AND created_by = _user_id
  )
$$;


--
-- Name: is_org_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id AND organization_id = _org_id
  ) OR EXISTS (
    SELECT 1 FROM public.organizations
    WHERE id = _org_id AND owner_id = _user_id
  )
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


SET default_table_access_method = heap;

--
-- Name: comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    output_id uuid,
    user_id uuid NOT NULL,
    content text NOT NULL,
    timecode text,
    parent_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid NOT NULL,
    receiver_id uuid NOT NULL,
    content text NOT NULL,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text,
    link text,
    read boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: organization_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.org_role DEFAULT 'member'::public.org_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    owner_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text NOT NULL,
    full_name text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    file_size bigint,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    email text NOT NULL,
    invited_by uuid NOT NULL,
    role public.project_role DEFAULT 'viewer'::public.project_role NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    CONSTRAINT project_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'expired'::text])))
);


--
-- Name: project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.project_role DEFAULT 'viewer'::public.project_role NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_outputs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_outputs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    file_name text NOT NULL,
    file_url text NOT NULL,
    file_type text,
    file_size bigint,
    is_video boolean DEFAULT false,
    uploaded_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: project_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    job_type public.job_type DEFAULT 'other'::public.job_type NOT NULL,
    default_title text,
    default_description text,
    icon text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    team_id uuid,
    title text NOT NULL,
    description text,
    job_type public.job_type DEFAULT 'other'::public.job_type NOT NULL,
    job_type_custom text,
    status public.project_status DEFAULT 'pending'::public.project_status NOT NULL,
    created_by uuid NOT NULL,
    assigned_to uuid,
    due_date timestamp with time zone,
    assigned_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: team_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_invitations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    email text NOT NULL,
    invited_by uuid NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    expires_at timestamp with time zone DEFAULT (now() + '7 days'::interval) NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    accepted_at timestamp with time zone,
    CONSTRAINT team_invitations_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'expired'::text])))
);


--
-- Name: team_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: organization_members organization_members_organization_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_user_id_key UNIQUE (organization_id, user_id);


--
-- Name: organization_members organization_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: project_attachments project_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attachments
    ADD CONSTRAINT project_attachments_pkey PRIMARY KEY (id);


--
-- Name: project_invitations project_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invitations
    ADD CONSTRAINT project_invitations_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_project_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_user_id_key UNIQUE (project_id, user_id);


--
-- Name: project_outputs project_outputs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_outputs
    ADD CONSTRAINT project_outputs_pkey PRIMARY KEY (id);


--
-- Name: project_templates project_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_templates
    ADD CONSTRAINT project_templates_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: team_invitations team_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT team_invitations_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_pkey PRIMARY KEY (id);


--
-- Name: team_members team_members_team_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_user_id_key UNIQUE (team_id, user_id);


--
-- Name: teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: comments update_comments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: organizations update_organizations_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: profiles update_profiles_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: projects update_projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: teams update_teams_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_teams_updated_at BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: comments comments_output_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_output_id_fkey FOREIGN KEY (output_id) REFERENCES public.project_outputs(id) ON DELETE CASCADE;


--
-- Name: comments comments_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.comments(id) ON DELETE CASCADE;


--
-- Name: comments comments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_receiver_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_receiver_id_fkey FOREIGN KEY (receiver_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: organization_members organization_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: organizations organizations_owner_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_attachments project_attachments_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attachments
    ADD CONSTRAINT project_attachments_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_attachments project_attachments_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_attachments
    ADD CONSTRAINT project_attachments_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_invitations project_invitations_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_invitations
    ADD CONSTRAINT project_invitations_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: project_outputs project_outputs_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_outputs
    ADD CONSTRAINT project_outputs_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_outputs project_outputs_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_outputs
    ADD CONSTRAINT project_outputs_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_assigned_to_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_assigned_to_fkey FOREIGN KEY (assigned_to) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: projects projects_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE SET NULL;


--
-- Name: team_invitations team_invitations_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_invitations
    ADD CONSTRAINT team_invitations_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: team_members team_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_members
    ADD CONSTRAINT team_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: teams teams_organization_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;


--
-- Name: teams Admins can create teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can create teams" ON public.teams FOR INSERT WITH CHECK (public.is_org_member(auth.uid(), organization_id));


--
-- Name: organization_members Admins can delete org members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete org members" ON public.organization_members FOR DELETE USING (((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_members.organization_id) AND (om.user_id = auth.uid()) AND (om.role = 'admin'::public.org_role)))) OR (EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.owner_id = auth.uid()))))));


--
-- Name: teams Admins can delete teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete teams" ON public.teams FOR DELETE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: organization_members Admins can insert org members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can insert org members" ON public.organization_members FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_members.organization_id) AND (om.user_id = auth.uid()) AND (om.role = 'admin'::public.org_role)))) OR (EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.owner_id = auth.uid()))))));


--
-- Name: team_members Admins can manage team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage team members" ON public.team_members USING ((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = team_members.team_id) AND public.is_org_member(auth.uid(), t.organization_id)))));


--
-- Name: organization_members Admins can update org members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update org members" ON public.organization_members FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM public.organization_members om
  WHERE ((om.organization_id = organization_members.organization_id) AND (om.user_id = auth.uid()) AND (om.role = 'admin'::public.org_role)))) OR (EXISTS ( SELECT 1
   FROM public.organizations o
  WHERE ((o.id = organization_members.organization_id) AND (o.owner_id = auth.uid()))))));


--
-- Name: teams Admins can update teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update teams" ON public.teams FOR UPDATE USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: project_invitations Anyone can view invitation by token; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view invitation by token" ON public.project_invitations FOR SELECT USING (true);


--
-- Name: project_templates Anyone can view templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view templates" ON public.project_templates FOR SELECT USING (true);


--
-- Name: projects Creator can delete projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creator can delete projects" ON public.projects FOR DELETE TO authenticated USING ((auth.uid() = created_by));


--
-- Name: organization_members Members can view org members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view org members" ON public.organization_members FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: team_members Members can view team members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view team members" ON public.team_members FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = team_members.team_id) AND public.is_org_member(auth.uid(), t.organization_id)))));


--
-- Name: teams Members can view teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Members can view teams" ON public.teams FOR SELECT USING (public.is_org_member(auth.uid(), organization_id));


--
-- Name: team_invitations Org members can create team invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can create team invitations" ON public.team_invitations FOR INSERT TO authenticated WITH CHECK ((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = team_invitations.team_id) AND public.is_org_member(auth.uid(), t.organization_id)))));


--
-- Name: team_invitations Org members can delete team invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can delete team invitations" ON public.team_invitations FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = team_invitations.team_id) AND public.is_org_member(auth.uid(), t.organization_id)))));


--
-- Name: team_invitations Org members can view team invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Org members can view team invitations" ON public.team_invitations FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.teams t
  WHERE ((t.id = team_invitations.team_id) AND public.is_org_member(auth.uid(), t.organization_id)))));


--
-- Name: organizations Owners can delete orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can delete orgs" ON public.organizations FOR DELETE TO authenticated USING ((auth.uid() = owner_id));


--
-- Name: organizations Owners can update orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Owners can update orgs" ON public.organizations FOR UPDATE TO authenticated USING ((auth.uid() = owner_id));


--
-- Name: project_invitations Project members can view invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project members can view invitations" ON public.project_invitations FOR SELECT TO authenticated USING (public.has_project_access(auth.uid(), project_id));


--
-- Name: project_invitations Project owners can create invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project owners can create invitations" ON public.project_invitations FOR INSERT TO authenticated WITH CHECK (public.has_project_access(auth.uid(), project_id));


--
-- Name: project_invitations Project owners can delete invitations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project owners can delete invitations" ON public.project_invitations FOR DELETE TO authenticated USING (public.has_project_access(auth.uid(), project_id));


--
-- Name: project_members Project owners can manage members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Project owners can manage members" ON public.project_members USING (((EXISTS ( SELECT 1
   FROM public.projects p
  WHERE ((p.id = project_members.project_id) AND (p.created_by = auth.uid())))) OR (EXISTS ( SELECT 1
   FROM public.project_members pm
  WHERE ((pm.project_id = pm.project_id) AND (pm.user_id = auth.uid()) AND (pm.role = 'owner'::public.project_role))))));


--
-- Name: notifications System can create notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "System can create notifications" ON public.notifications FOR INSERT WITH CHECK (true);


--
-- Name: project_attachments Uploaders can delete attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Uploaders can delete attachments" ON public.project_attachments FOR DELETE USING ((auth.uid() = uploaded_by));


--
-- Name: project_outputs Uploaders can delete outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Uploaders can delete outputs" ON public.project_outputs FOR DELETE USING ((auth.uid() = uploaded_by));


--
-- Name: organizations Users can create orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create orgs" ON public.organizations FOR INSERT TO authenticated WITH CHECK ((auth.uid() = owner_id));


--
-- Name: projects Users can create projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can create projects" ON public.projects FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: comments Users can delete own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own comments" ON public.comments FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can delete own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can insert own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: messages Users can send messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can send messages" ON public.messages FOR INSERT WITH CHECK ((auth.uid() = sender_id));


--
-- Name: comments Users can update own comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own comments" ON public.comments FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can update own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: profiles Users can update own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id));


--
-- Name: messages Users can update own sent messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own sent messages" ON public.messages FOR UPDATE USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));


--
-- Name: projects Users can view accessible projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view accessible projects" ON public.projects FOR SELECT TO authenticated USING (((created_by = auth.uid()) OR public.has_project_access(auth.uid(), id)));


--
-- Name: profiles Users can view all profiles; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);


--
-- Name: messages Users can view own messages; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own messages" ON public.messages FOR SELECT USING (((auth.uid() = sender_id) OR (auth.uid() = receiver_id)));


--
-- Name: notifications Users can view own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: project_members Users can view project members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view project members" ON public.project_members FOR SELECT USING (public.has_project_access(auth.uid(), project_id));


--
-- Name: organizations Users can view their orgs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their orgs" ON public.organizations FOR SELECT TO authenticated USING (((owner_id = auth.uid()) OR public.is_org_member(auth.uid(), id)));


--
-- Name: comments Users with access can create comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with access can create comments" ON public.comments FOR INSERT WITH CHECK (public.has_project_access(auth.uid(), project_id));


--
-- Name: projects Users with access can update projects; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with access can update projects" ON public.projects FOR UPDATE TO authenticated USING (((created_by = auth.uid()) OR public.has_project_access(auth.uid(), id)));


--
-- Name: project_attachments Users with access can upload attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with access can upload attachments" ON public.project_attachments FOR INSERT WITH CHECK (public.has_project_access(auth.uid(), project_id));


--
-- Name: project_outputs Users with access can upload outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with access can upload outputs" ON public.project_outputs FOR INSERT WITH CHECK (public.has_project_access(auth.uid(), project_id));


--
-- Name: project_attachments Users with access can view attachments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with access can view attachments" ON public.project_attachments FOR SELECT USING (public.has_project_access(auth.uid(), project_id));


--
-- Name: comments Users with access can view comments; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with access can view comments" ON public.comments FOR SELECT USING (public.has_project_access(auth.uid(), project_id));


--
-- Name: project_outputs Users with access can view outputs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users with access can view outputs" ON public.project_outputs FOR SELECT USING (public.has_project_access(auth.uid(), project_id));


--
-- Name: comments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

--
-- Name: messages; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: organization_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

--
-- Name: organizations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: project_attachments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_attachments ENABLE ROW LEVEL SECURITY;

--
-- Name: project_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: project_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

--
-- Name: project_outputs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_outputs ENABLE ROW LEVEL SECURITY;

--
-- Name: project_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.project_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

--
-- Name: team_invitations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_invitations ENABLE ROW LEVEL SECURITY;

--
-- Name: team_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




COMMIT;