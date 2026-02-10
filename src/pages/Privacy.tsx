import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="section border-b border-border">
          <div className="container text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground">Last updated: December 2024</p>
          </div>
        </section>

        {/* Content */}
        <section className="section">
          <div className="container max-w-3xl">
            <div className="space-y-8 text-muted-foreground">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">1. Information We Collect</h2>
                <p>
                  We collect information you provide directly to us, such as when you create an account, 
                  use our services, or contact us for support. This includes your name, email address, 
                  and any content you upload to our platform.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">2. How We Use Your Information</h2>
                <p>
                  We use the information we collect to provide, maintain, and improve our services, 
                  to communicate with you, and to protect our users. We do not sell your personal 
                  information to third parties.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">3. Data Security</h2>
                <p>
                  We implement appropriate technical and organizational measures to protect your personal 
                  data against unauthorized access, alteration, disclosure, or destruction. All data is 
                  encrypted in transit and at rest.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">4. Data Retention</h2>
                <p>
                  We retain your information for as long as your account is active or as needed to provide 
                  you services. You can request deletion of your account and associated data at any time.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">5. Your Rights</h2>
                <p>
                  You have the right to access, correct, or delete your personal data. You can also 
                  export your data or object to certain processing activities. Contact us to exercise 
                  these rights.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">6. Cookies</h2>
                <p>
                  We use cookies and similar technologies to provide and improve our services. You can 
                  control cookie settings through your browser preferences.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">7. Contact Us</h2>
                <p>
                  If you have questions about this Privacy Policy, please contact us at{' '}
                  <a href="mailto:privacy@proorbit.in" className="text-foreground underline">
                    privacy@proorbit.in
                  </a>
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
