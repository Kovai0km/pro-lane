import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="section border-b border-border">
          <div className="container text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">About ProOrbit</h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Building the future of creative agency workflow management.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="section">
          <div className="container max-w-3xl">
            <div className="prose prose-lg dark:prose-invert">
              <h2 className="text-2xl font-bold mb-4">Our Mission</h2>
              <p className="text-muted-foreground mb-8">
                ProOrbit was created to solve the chaos of managing creative projects. 
                We believe that video editors, designers, and developers deserve tools 
                that understand their unique workflows—not generic project management 
                software that forces them to adapt.
              </p>

              <h2 className="text-2xl font-bold mb-4">What We Do</h2>
              <p className="text-muted-foreground mb-8">
                We provide a centralized platform where creative teams can manage projects, 
                collaborate with clients, and deliver exceptional work. From timecoded video 
                comments to real-time notifications, every feature is designed with creative 
                professionals in mind.
              </p>

              <h2 className="text-2xl font-bold mb-4">Our Values</h2>
              <ul className="space-y-4 text-muted-foreground mb-8">
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">Simplicity:</span>
                  Complex workflows shouldn't require complex tools.
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">Speed:</span>
                  Every click matters. We optimize for efficiency.
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">Security:</span>
                  Your creative work is your livelihood. We protect it.
                </li>
                <li className="flex gap-3">
                  <span className="font-semibold text-foreground">Support:</span>
                  Real humans, real help, real fast.
                </li>
              </ul>

              <h2 className="text-2xl font-bold mb-4">Contact</h2>
              <p className="text-muted-foreground">
                Have questions? Reach out to us at{' '}
                <a href="mailto:hello@proorbit.in" className="text-foreground underline">
                  hello@proorbit.in
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
