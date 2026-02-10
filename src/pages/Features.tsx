import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Video, Palette, Globe, Layers, Users, Zap, Shield, Clock, Bell, MessageSquare, FileUp, BarChart } from 'lucide-react';

const features = [
  {
    icon: Video,
    title: 'Video Project Management',
    description: 'Manage video editing projects with timecoded comments. Review outputs directly in the browser with frame-accurate feedback.',
  },
  {
    icon: Palette,
    title: 'Design Collaboration',
    description: 'Track design iterations with version history. Upload mockups, get feedback, and keep everyone aligned.',
  },
  {
    icon: Globe,
    title: 'Website Development',
    description: 'Coordinate website builds across teams and stakeholders with clear deliverables and milestones.',
  },
  {
    icon: Layers,
    title: 'Custom Job Types',
    description: 'Define your own job types for any creative work. ProOrbit adapts to your workflow, not the other way around.',
  },
  {
    icon: Users,
    title: 'Team Management',
    description: 'Create teams within organizations. Assign roles, manage permissions, and keep everyone organized.',
  },
  {
    icon: Zap,
    title: 'Real-time Updates',
    description: 'See changes as they happen. Comments, status updates, and file uploads sync instantly across all users.',
  },
  {
    icon: Shield,
    title: 'Role-Based Access',
    description: 'Control who sees what. Project-level permissions ensure sensitive work stays private.',
  },
  {
    icon: Clock,
    title: 'Deadline Tracking',
    description: 'Set due dates and get notified when deadlines approach. Never miss a delivery again.',
  },
  {
    icon: Bell,
    title: 'Smart Notifications',
    description: 'Get notified about assignments, comments, mentions, and approaching deadlines.',
  },
  {
    icon: MessageSquare,
    title: 'Direct Messaging',
    description: 'Chat with team members directly within the platform. Keep all communication in one place.',
  },
  {
    icon: FileUp,
    title: 'File Management',
    description: 'Upload attachments and outputs with drag-and-drop. Preview files directly in the browser.',
  },
  {
    icon: BarChart,
    title: 'Progress Tracking',
    description: 'Visual status indicators show project progress at a glance. Know what\'s pending, in progress, or complete.',
  },
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="section border-b border-border">
          <div className="container text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Features</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Everything you need to manage your creative agency workflow in one place.
            </p>
          </div>
        </section>

        {/* Features Grid */}
        <section className="section">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature) => (
                <div key={feature.title} className="p-6 border border-border bg-card">
                  <feature.icon className="h-10 w-10 mb-4" strokeWidth={1.5} />
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
