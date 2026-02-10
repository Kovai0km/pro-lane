-- Add plan column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free';

-- Add plan_expires_at column
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMP WITH TIME ZONE;

-- Create index for plan lookup
CREATE INDEX IF NOT EXISTS idx_profiles_plan ON public.profiles(plan);

-- Create OTP codes table for organization deletion verification
CREATE TABLE IF NOT EXISTS public.org_delete_otp (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '10 minutes'),
  verified BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS on OTP table
ALTER TABLE public.org_delete_otp ENABLE ROW LEVEL SECURITY;

-- RLS policies for OTP table
CREATE POLICY "Users can view own OTP" ON public.org_delete_otp
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create OTP for their orgs" ON public.org_delete_otp
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own OTP" ON public.org_delete_otp
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own OTP" ON public.org_delete_otp
  FOR DELETE USING (auth.uid() = user_id);

-- Function to generate OTP code
CREATE OR REPLACE FUNCTION public.generate_otp_code()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;