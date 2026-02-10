import { Link } from 'react-router-dom';
import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

const openings = [
  {
    title: 'Senior Frontend Engineer',
    department: 'Engineering',
    location: 'Remote',
    type: 'Full-time',
  },
  {
    title: 'Product Designer',
    department: 'Design',
    location: 'Remote',
    type: 'Full-time',
  },
  {
    title: 'Customer Success Manager',
    department: 'Support',
    location: 'Remote',
    type: 'Full-time',
  },
];

export default function CareersPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="section border-b border-border">
          <div className="container text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Careers</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join us in building the future of creative workflow management.
            </p>
          </div>
        </section>

        {/* Why Join */}
        <section className="section border-b border-border">
          <div className="container max-w-3xl">
            <h2 className="text-2xl font-bold mb-6">Why Join ProOrbit?</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 border border-border bg-card">
                <h3 className="font-semibold mb-2">Remote First</h3>
                <p className="text-muted-foreground text-sm">
                  Work from anywhere in the world. We're a distributed team across multiple time zones.
                </p>
              </div>
              <div className="p-6 border border-border bg-card">
                <h3 className="font-semibold mb-2">Competitive Pay</h3>
                <p className="text-muted-foreground text-sm">
                  We offer competitive salaries, equity, and comprehensive benefits.
                </p>
              </div>
              <div className="p-6 border border-border bg-card">
                <h3 className="font-semibold mb-2">Growth Focused</h3>
                <p className="text-muted-foreground text-sm">
                  Learning budget, conference attendance, and career development support.
                </p>
              </div>
              <div className="p-6 border border-border bg-card">
                <h3 className="font-semibold mb-2">Work-Life Balance</h3>
                <p className="text-muted-foreground text-sm">
                  Flexible hours, unlimited PTO, and no expectation of weekend work.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Open Positions */}
        <section className="section">
          <div className="container max-w-3xl">
            <h2 className="text-2xl font-bold mb-6">Open Positions</h2>
            {openings.length > 0 ? (
              <div className="space-y-4">
                {openings.map((job) => (
                  <div key={job.title} className="p-6 border border-border bg-card flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">{job.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {job.department} · {job.location} · {job.type}
                      </p>
                    </div>
                    <Button variant="outline" size="sm">
                      Apply
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">
                No open positions at the moment. Check back soon!
              </p>
            )}

            <div className="mt-8 p-6 bg-muted">
              <p className="text-sm text-muted-foreground">
                Don't see a role that fits? Send your resume to{' '}
                <a href="mailto:careers@proorbit.in" className="text-foreground underline">
                  careers@proorbit.in
                </a>
              </p>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
