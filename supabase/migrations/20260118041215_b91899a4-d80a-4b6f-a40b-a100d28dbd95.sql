-- Enable trigram extension for fuzzy search FIRST
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add username field to profiles with unique constraint
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text UNIQUE;

-- Create indexes for username and email search
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_email_search ON public.profiles USING gin(email gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_username_search ON public.profiles USING gin(username gin_trgm_ops);

-- Create plans table
CREATE TABLE IF NOT EXISTS public.plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  display_name text NOT NULL,
  description text,
  price_monthly integer NOT NULL DEFAULT 0,
  price_yearly integer NOT NULL DEFAULT 0,
  features jsonb DEFAULT '[]'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on plans
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Anyone can view active plans
CREATE POLICY "Anyone can view active plans" ON public.plans FOR SELECT USING (is_active = true);

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.plans(id),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'pending')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  current_period_start timestamp with time zone NOT NULL DEFAULT now(),
  current_period_end timestamp with time zone NOT NULL,
  cancelled_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions" ON public.subscriptions FOR SELECT USING (auth.uid() = user_id);

-- Create payments table for Razorpay transactions
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.subscriptions(id),
  razorpay_order_id text,
  razorpay_payment_id text,
  razorpay_signature text,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users can view their own payments
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);

-- Insert default plans
INSERT INTO public.plans (name, display_name, description, price_monthly, price_yearly, features) VALUES
('free', 'Free', 'Basic features for individuals', 0, 0, '["Up to 3 projects", "Basic file uploads", "Community support"]'::jsonb),
('pro', 'Pro Orbit', 'Advanced features for professionals', 499, 4999, '["Unlimited projects", "Unlimited direct messages", "Threaded replies", "Priority support", "Higher upload limits", "Advanced analytics"]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Add parent_id to messages for thread replies
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.messages(id);

-- Create index for thread queries
CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON public.messages(parent_id);

-- Trigger to update subscription updated_at
CREATE OR REPLACE FUNCTION public.update_subscription_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_subscription_updated_at();