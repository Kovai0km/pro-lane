import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';
import { Mail, Cloud, Video, Palette, Globe, Lock } from 'lucide-react';

const integrations = [
  {
    icon: Mail,
    name: 'Email',
    description: 'Receive notifications and updates directly in your inbox.',
    status: 'Available',
  },
  {
    icon: Cloud,
    name: 'Cloud Storage',
    description: 'Secure file storage with automatic backups.',
    status: 'Available',
  },
  {
    icon: Video,
    name: 'Video Players',
    description: 'Embedded video playback with timecode support.',
    status: 'Available',
  },
  {
    icon: Palette,
    name: 'Adobe Creative Cloud',
    description: 'Direct integration with Adobe apps.',
    status: 'Coming Soon',
  },
  {
    icon: Globe,
    name: 'Slack',
    description: 'Get notified in your Slack channels.',
    status: 'Coming Soon',
  },
  {
    icon: Lock,
    name: 'SSO / SAML',
    description: 'Enterprise single sign-on support.',
    status: 'Enterprise',
  },
];

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="section border-b border-border">
          <div className="container text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Integrations</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect ProOrbit with the tools you already use.
            </p>
          </div>
        </section>

        {/* Integrations Grid */}
        <section className="section">
          <div className="container">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
              {integrations.map((integration) => (
                <div key={integration.name} className="p-6 border border-border bg-card">
                  <div className="flex items-start justify-between mb-4">
                    <integration.icon className="h-10 w-10" strokeWidth={1.5} />
                    <span className={`text-xs font-medium uppercase tracking-wider px-2 py-1 ${
                      integration.status === 'Available' 
                        ? 'bg-foreground text-background' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {integration.status}
                    </span>
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{integration.name}</h3>
                  <p className="text-muted-foreground">{integration.description}</p>
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
