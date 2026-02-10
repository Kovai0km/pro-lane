import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { ArrowRight, Video, Palette, Globe, Layers, Users, Zap, Shield, Clock } from 'lucide-react';
import { OptimizedImage } from '@/components/OptimizedImage';

export default function Landing() {
  const features = [
    {
      icon: Video,
      title: 'Video Editing',
      description: 'Manage video projects with timecoded comments and output review.',
    },
    {
      icon: Palette,
      title: 'Design Work',
      description: 'Track design iterations with version history and feedback.',
    },
    {
      icon: Globe,
      title: 'Website Development',
      description: 'Coordinate website builds across teams and stakeholders.',
    },
    {
      icon: Layers,
      title: 'Custom Jobs',
      description: 'Flexible workflow for any creative project type.',
    },
  ];

  const benefits = [
    {
      icon: Users,
      title: 'Team Collaboration',
      description: 'Organize members into teams, assign projects, and track progress in real-time.',
    },
    {
      icon: Zap,
      title: 'Fast Workflow',
      description: 'Streamline handoffs between team members with status tracking.',
    },
    {
      icon: Shield,
      title: 'Secure Access',
      description: 'Role-based permissions ensure only authorized users access projects.',
    },
    {
      icon: Clock,
      title: 'Deadline Tracking',
      description: 'Never miss a deadline with due date notifications and progress views.',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden border-b-2 border-foreground">
          <div className="grid-pattern absolute inset-0 opacity-30" />
          <div className="container relative py-24 md:py-32">
            <div className="max-w-3xl space-y-8">
              <div className="inline-block border-2 border-foreground px-4 py-1 text-sm font-mono uppercase tracking-wider animate-fade-in">
                Agency Workflow Management
              </div>
              <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] animate-slide-in-up">
                Orchestrate Your
                <br />
                Creative Output
              </h1>
              <p className="text-xl text-muted-foreground max-w-xl animate-slide-in-up" style={{ animationDelay: '0.1s' }}>
                ProOrbit streamlines workflow for video editing, design, and web development teams. 
                Assign, track, review, and deliver—all in one place.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
                <Link to="/auth?mode=signup">
                  <Button variant="hero" className="w-full sm:w-auto">
                    Start Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 mt-16 pt-16 border-t-2 border-foreground animate-fade-in" style={{ animationDelay: '0.3s' }}>
              <div>
                <div className="text-4xl md:text-5xl font-bold font-mono">10K+</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider mt-2">Projects Managed</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold font-mono">500+</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider mt-2">Active Teams</div>
              </div>
              <div>
                <div className="text-4xl md:text-5xl font-bold font-mono">99.9%</div>
                <div className="text-sm text-muted-foreground uppercase tracking-wider mt-2">Uptime</div>
              </div>
            </div>
          </div>
        </section>

        {/* Job Types */}
        <section className="section border-b-2 border-foreground">
          <div className="container">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">Built for Creative Work</h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Whether you're cutting videos, designing graphics, or building websites—ProOrbit adapts to your workflow.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-0 border-2 border-foreground">
              {features.map((feature, index) => (
                <div 
                  key={feature.title}
                  className={`p-8 ${index !== features.length - 1 ? 'border-b-2 lg:border-b-0 lg:border-r-2 border-foreground' : ''}`}
                >
                  <feature.icon className="h-8 w-8 mb-4" strokeWidth={1.5} />
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section className="section bg-foreground text-background">
          <div className="container">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div className="space-y-8">
                <h2 className="text-3xl md:text-4xl font-bold">Why ProOrbit?</h2>
                <div className="space-y-6">
                  {benefits.map((benefit) => (
                    <div key={benefit.title} className="flex gap-4">
                      <div className="flex-shrink-0 h-12 w-12 border-2 border-background flex items-center justify-center">
                        <benefit.icon className="h-6 w-6" strokeWidth={1.5} />
                      </div>
                      <div>
                        <h3 className="font-semibold mb-1">{benefit.title}</h3>
                        <p className="text-sm text-background/70">{benefit.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className="border-2 border-background bg-background/5 p-8">
                  <div className="space-y-4">
                    {/* Mock Kanban */}
                    <div className="flex gap-2 mb-6">
                      <div className="px-3 py-1 border-2 border-background text-xs uppercase">Pending</div>
                      <div className="px-3 py-1 bg-background text-foreground text-xs uppercase">In Progress</div>
                      <div className="px-3 py-1 border-2 border-dashed border-background text-xs uppercase">Review</div>
                    </div>
                    <div className="space-y-3">
                      {['Brand Video Edit', 'Website Redesign', 'Social Graphics'].map((item, i) => (
                        <div key={item} className="border-2 border-background/50 p-4 bg-background/5">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-sm">{item}</div>
                              <div className="text-xs text-background/50 mt-1">Due in {3 - i} days</div>
                            </div>
                            <div className="h-6 w-6 border-2 border-background/50" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="section border-b-2 border-foreground">
          <div className="container text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Ready to streamline your workflow?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join hundreds of creative agencies managing their projects with ProOrbit.
            </p>
            <Link to="/auth?mode=signup">
              <Button variant="hero">
                Get Started Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}