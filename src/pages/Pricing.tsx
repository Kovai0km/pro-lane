import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { PLANS, formatPrice, formatLimit } from '@/lib/plans';

export default function PricingPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="section border-b border-border">
          <div className="container text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Simple Pricing</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Choose the plan that works for your team. Start free, upgrade when you're ready.
            </p>
          </div>
        </section>

        {/* Plan Cards */}
        <section className="section">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto items-start">
              {PLANS.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative p-8 rounded-2xl border bg-card transition-all duration-300 hover:shadow-xl ${
                    plan.highlighted
                      ? 'border-2 border-primary shadow-lg scale-[1.02]'
                      : 'border-border hover:-translate-y-1'
                  }`}
                >
                  {plan.badge && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-3 py-1">
                      <Star className="h-3 w-3 mr-1 fill-current" />
                      {plan.badge.replace('⭐ ', '')}
                    </Badge>
                  )}
                  <h3 className="text-2xl font-bold mt-2">{plan.displayName}</h3>
                  <div className="mt-4">
                    <span className="text-4xl font-bold">{formatPrice(plan.priceMonthly)}</span>
                    {plan.priceMonthly > 0 && (
                      <span className="text-muted-foreground ml-2">/month</span>
                    )}
                  </div>
                  <p className="mt-4 text-muted-foreground">{plan.description}</p>

                  {/* Limits grid */}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-muted rounded-lg p-2 text-center">
                      <div className="font-bold text-foreground">{formatLimit(plan.organizations)}</div>
                      <div className="text-muted-foreground">Organizations</div>
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

                  <ul className="mt-8 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="text-sm">
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth?mode=signup" className="block mt-8">
                    <Button
                      variant={plan.highlighted ? 'default' : 'outline'}
                      className="w-full rounded-xl"
                      size="lg"
                    >
                      {plan.priceMonthly === 0 ? 'Get Started' : 'Upgrade Now'}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
            <p className="text-center text-sm text-muted-foreground mt-8">
              All prices in INR. Yearly billing available with 17% savings.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
