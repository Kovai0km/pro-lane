import { Header } from '@/components/layout/Header';
import { Footer } from '@/components/layout/Footer';

export default function TermsPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="section border-b border-border">
          <div className="container text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">Terms of Service</h1>
            <p className="text-muted-foreground">Last updated: December 2024</p>
          </div>
        </section>

        {/* Content */}
        <section className="section">
          <div className="container max-w-3xl">
            <div className="space-y-8 text-muted-foreground">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
                <p>
                  By accessing or using ProOrbit, you agree to be bound by these Terms of Service. 
                  If you do not agree to these terms, please do not use our services.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">2. Description of Service</h2>
                <p>
                  ProOrbit provides a workflow management platform for creative agencies. We reserve 
                  the right to modify, suspend, or discontinue any part of the service at any time.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">3. User Accounts</h2>
                <p>
                  You are responsible for maintaining the confidentiality of your account credentials 
                  and for all activities that occur under your account. You must notify us immediately 
                  of any unauthorized use.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">4. User Content</h2>
                <p>
                  You retain ownership of content you upload to ProOrbit. By uploading content, you 
                  grant us a license to store, display, and process that content as necessary to 
                  provide our services.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">5. Acceptable Use</h2>
                <p>
                  You agree not to use ProOrbit for any unlawful purpose or in any way that could 
                  damage, disable, or impair our services. You must not upload malicious content or 
                  attempt to gain unauthorized access.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">6. Payment Terms</h2>
                <p>
                  Paid features are billed in advance on a monthly or annual basis. Refunds are 
                  provided in accordance with our refund policy. Prices are subject to change with 
                  notice.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">7. Limitation of Liability</h2>
                <p>
                  ProOrbit is provided "as is" without warranties of any kind. We are not liable for 
                  any indirect, incidental, or consequential damages arising from your use of our 
                  services.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold text-foreground mb-3">8. Contact</h2>
                <p>
                  Questions about these Terms should be sent to{' '}
                  <a href="mailto:legal@proorbit.in" className="text-foreground underline">
                    legal@proorbit.in
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
