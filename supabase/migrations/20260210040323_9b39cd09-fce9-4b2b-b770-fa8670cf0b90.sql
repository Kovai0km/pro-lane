-- Insert plan rows into the plans table with proper UUIDs
INSERT INTO public.plans (name, display_name, description, price_monthly, price_yearly, features, is_active)
VALUES
  ('free', 'Free', 'Perfect for individuals getting started', 0, 0, '["1 Organization", "3 Teams", "10 Projects", "1GB Storage"]'::jsonb, true),
  ('pro', 'Pro', 'For growing teams and agencies', 999, 9999, '["5 Organizations", "10 Teams", "100 Projects", "50GB Storage", "Priority Support"]'::jsonb, true),
  ('business', 'Business', 'For large organizations with advanced needs', 1999, 19999, '["Unlimited Organizations", "50 Teams", "100 Projects", "100GB Storage", "Priority Support", "Custom Branding"]'::jsonb, true),
  ('enterprise', 'Enterprise', 'For enterprises with unlimited scale', 3999, 39999, '["Unlimited Organizations", "Unlimited Teams", "Unlimited Projects", "200GB Storage", "24/7 Support", "Custom Branding", "Dedicated Account Manager"]'::jsonb, true)
ON CONFLICT (name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  price_monthly = EXCLUDED.price_monthly,
  price_yearly = EXCLUDED.price_yearly,
  features = EXCLUDED.features,
  is_active = EXCLUDED.is_active;