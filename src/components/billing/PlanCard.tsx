import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Crown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  features: string[];
}

interface PlanCardProps {
  plan: Plan;
  billingCycle: 'monthly' | 'yearly';
  isCurrentPlan: boolean;
  onSelect: (plan: Plan) => void;
  loading?: boolean;
}

export function PlanCard({ plan, billingCycle, isCurrentPlan, onSelect, loading }: PlanCardProps) {
  const price = billingCycle === 'monthly' ? plan.price_monthly : plan.price_yearly;
  const isPro = plan.name === 'pro';
  const isFree = plan.name === 'free';
  const yearlyMonthlyEquivalent = Math.round(plan.price_yearly / 12);
  const savings = billingCycle === 'yearly' && isPro 
    ? Math.round(((plan.price_monthly * 12) - plan.price_yearly) / (plan.price_monthly * 12) * 100)
    : 0;

  return (
    <Card className={cn(
      'relative transition-all duration-200',
      isPro && 'border-primary shadow-lg',
      isCurrentPlan && 'ring-2 ring-primary'
    )}>
      {isPro && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground px-3">
            <Crown className="h-3 w-3 mr-1" />
            Popular
          </Badge>
        </div>
      )}
      {isCurrentPlan && (
        <div className="absolute -top-3 right-4">
          <Badge variant="secondary">Current Plan</Badge>
        </div>
      )}

      <CardHeader className="text-center pt-8">
        <CardTitle className="text-2xl">{plan.display_name}</CardTitle>
        <CardDescription>{plan.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Pricing */}
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold">
              {isFree ? 'Free' : `₹${price.toLocaleString()}`}
            </span>
            {!isFree && (
              <span className="text-muted-foreground">
                /{billingCycle === 'monthly' ? 'mo' : 'yr'}
              </span>
            )}
          </div>
          {billingCycle === 'yearly' && isPro && (
            <div className="mt-1 space-y-1">
              <p className="text-sm text-muted-foreground">
                ₹{yearlyMonthlyEquivalent}/mo billed annually
              </p>
              <Badge variant="secondary" className="text-green-600 bg-green-100">
                Save {savings}%
              </Badge>
            </div>
          )}
        </div>

        {/* Features */}
        <ul className="space-y-3">
          {plan.features.map((feature, index) => (
            <li key={index} className="text-sm">
              {feature}
            </li>
          ))}
        </ul>

        {/* CTA Button */}
        <Button
          className="w-full"
          variant={isPro ? 'default' : 'outline'}
          disabled={isCurrentPlan || loading}
          onClick={() => onSelect(plan)}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : isCurrentPlan ? (
            'Current Plan'
          ) : isFree ? (
            'Downgrade'
          ) : (
            'Upgrade Now'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
