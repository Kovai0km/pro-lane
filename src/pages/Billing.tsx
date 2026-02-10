import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Crown, Star, Calendar, CreditCard, CheckCircle, Check } from 'lucide-react';
import { PLANS, formatPrice, formatLimit } from '@/lib/plans';
import { cn } from '@/lib/utils';

interface DBPlan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: string[];
}

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  current_period_start: string;
  current_period_end: string;
}

interface Profile {
  plan: string;
  plan_expires_at: string | null;
}

export default function BillingPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dbPlans, setDbPlans] = useState<DBPlan[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [plansRes, profileRes, subRes] = await Promise.all([
        supabase.from('plans').select('*').eq('is_active', true).order('price_monthly'),
        supabase.from('profiles').select('plan, plan_expires_at').eq('id', user!.id).single(),
        supabase.from('subscriptions').select('*').eq('user_id', user!.id).eq('status', 'active').order('created_at', { ascending: false }).limit(1).single(),
      ]);

      if (plansRes.data) {
        setDbPlans(plansRes.data.map((p) => ({
          ...p,
          features: Array.isArray(p.features) ? p.features : JSON.parse(p.features as string || '[]'),
        })));
      }
      if (profileRes.data) setProfile(profileRes.data);
      if (subRes.data) setSubscription(subRes.data);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (planName: string) => {
    if (planName === 'free') {
      toast({ title: 'Downgrade Request', description: 'Please contact support to downgrade your plan.' });
      return;
    }

    const dbPlan = dbPlans.find(p => p.name === planName);
    if (!dbPlan) {
      toast({ title: 'Error', description: 'Plan not found in database.', variant: 'destructive' });
      return;
    }

    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-razorpay-order', {
        body: { planId: dbPlan.id, billingCycle },
      });
      if (error) throw error;

      const options = {
        key: data.razorpayKeyId,
        amount: data.amount,
        currency: data.currency,
        name: 'PROORBIT',
        description: `${dbPlan.display_name} - ${billingCycle === 'monthly' ? 'Monthly' : 'Yearly'}`,
        order_id: data.orderId,
        handler: async function (response: any) {
          const { error: verifyError } = await supabase.functions.invoke('verify-razorpay-payment', {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            },
          });
          if (verifyError) {
            toast({ title: 'Payment Failed', description: 'Could not verify payment. Please contact support.', variant: 'destructive' });
          } else {
            toast({ title: 'Payment Successful!', description: 'Your subscription has been activated.' });
            fetchData();
          }
        },
        prefill: { email: user?.email },
        theme: { color: '#000000' },
      };

      const razorpay = new (window as any).Razorpay(options);
      razorpay.open();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to initiate payment', variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout title="Billing">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  const currentPlanName = profile?.plan || 'free';

  return (
    <DashboardLayout breadcrumbs={[{ label: 'Billing' }]}>
      <div className="p-6 lg:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Billing & Plans</h1>
            <p className="text-muted-foreground">Manage your subscription and billing information</p>
          </div>

          {/* Current Plan Card */}
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    Current Plan
                    {currentPlanName !== 'free' && (
                      <Badge className="bg-amber-500/90 hover:bg-amber-500">
                        <Crown className="h-3 w-3 mr-1" />
                        {currentPlanName.toUpperCase()}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    You're currently on the {PLANS.find(p => p.name === currentPlanName)?.displayName || 'Free'} plan
                  </CardDescription>
                </div>
                {currentPlanName !== 'free' && <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />}
              </div>
            </CardHeader>
            {subscription && (
              <CardContent>
                <div className="flex flex-wrap gap-6 text-sm">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>Renews on {new Date(subscription.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-muted-foreground" />
                    <span className="capitalize">{subscription.billing_cycle} billing</span>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Billing Cycle Toggle */}
          <div className="flex justify-center mb-8">
            <Tabs value={billingCycle} onValueChange={(v) => setBillingCycle(v as 'monthly' | 'yearly')}>
              <TabsList className="grid w-64 grid-cols-2">
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">
                  Yearly
                  <Badge variant="secondary" className="ml-2 text-[10px]">Save 17%</Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Plan Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PLANS.map((plan) => {
              const isCurrentPlan = plan.name === currentPlanName;
              const price = billingCycle === 'monthly' ? plan.priceMonthly : plan.priceYearly;

              return (
                <div
                  key={plan.name}
                  className={cn(
                    'relative p-6 rounded-2xl border bg-card transition-all duration-300',
                    plan.highlighted ? 'border-2 border-primary shadow-lg scale-[1.02]' : 'border-border',
                    isCurrentPlan && 'ring-2 ring-primary'
                  )}
                >
                  {plan.badge && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      {plan.badge.replace('⭐ ', '')}
                    </Badge>
                  )}

                  {isCurrentPlan && (
                    <Badge variant="secondary" className="absolute -top-3 right-4">Current Plan</Badge>
                  )}

                  <h3 className="text-xl font-bold mt-2">{plan.displayName}</h3>
                  <div className="mt-3">
                    <span className="text-3xl font-bold">{formatPrice(price)}</span>
                    {price > 0 && (
                      <span className="text-muted-foreground ml-1">/{billingCycle === 'monthly' ? 'mo' : 'yr'}</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>

                  {/* Limits summary */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted rounded-lg p-2 text-center">
                      <div className="font-bold text-foreground">{formatLimit(plan.organizations)}</div>
                      <div className="text-muted-foreground">Orgs</div>
                    </div>
                    <div className="bg-muted rounded-lg p-2 text-center">
                      <div className="font-bold text-foreground">{formatLimit(plan.teams)}</div>
                      <div className="text-muted-foreground">Teams</div>
                    </div>
                    <div className="bg-muted rounded-lg p-2 text-center">
                      <div className="font-bold text-foreground">{formatLimit(plan.projects)}</div>
                      <div className="text-muted-foreground">Projects</div>
                    </div>
                    <div className="bg-muted rounded-lg p-2 text-center">
                      <div className="font-bold text-foreground">{plan.storage}</div>
                      <div className="text-muted-foreground">Storage</div>
                    </div>
                  </div>

                  <ul className="mt-6 space-y-2">
                    {plan.features.map((feature, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-primary flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full mt-6 rounded-xl"
                    variant={plan.highlighted ? 'default' : 'outline'}
                    disabled={isCurrentPlan || processing}
                    onClick={() => handleUpgrade(plan.name)}
                  >
                    {processing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isCurrentPlan ? (
                      'Current Plan'
                    ) : plan.priceMonthly === 0 ? (
                      'Downgrade'
                    ) : (
                      'Upgrade Now'
                    )}
                  </Button>
                </div>
              );
            })}
          </div>

          <p className="text-center text-sm text-muted-foreground mt-8">
            All plans include a 14-day free trial. Cancel anytime.
            <br />
            Prices shown in INR. GST may apply.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
