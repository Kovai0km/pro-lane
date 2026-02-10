import { Link } from 'react-router-dom';
import logoDark from '@/assets/logo-dark.jpg';

export function Footer() {
  return (
    <footer className="border-t-2 border-foreground bg-foreground text-background">
      <div className="container py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <img src={logoDark} alt="ProOrbit" className="h-8 w-auto object-contain" />
              <span className="text-lg font-bold">PROORBIT</span>
            </div>
            <p className="text-sm text-background/70">
              Workflow management for creative agencies.
            </p>
          </div>

          {/* Product */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider">Product</h4>
            <ul className="space-y-2 text-sm text-background/70">
              <li><Link to="/features" className="hover:text-background">Features</Link></li>
              <li><Link to="/pricing" className="hover:text-background">Pricing</Link></li>
              <li><Link to="/integrations" className="hover:text-background">Integrations</Link></li>
            </ul>
          </div>

          {/* Company */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider">Company</h4>
            <ul className="space-y-2 text-sm text-background/70">
              <li><Link to="/about" className="hover:text-background">About</Link></li>
              <li><Link to="/blog" className="hover:text-background">Blog</Link></li>
              <li><Link to="/careers" className="hover:text-background">Careers</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold uppercase tracking-wider">Legal</h4>
            <ul className="space-y-2 text-sm text-background/70">
              <li><Link to="/privacy" className="hover:text-background">Privacy</Link></li>
              <li><Link to="/terms" className="hover:text-background">Terms</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-background/20 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-background/70">
            © {new Date().getFullYear()} ProOrbit.in. All rights reserved.
          </p>
          <p className="text-xs font-mono text-background/50">
            v1.0.0
          </p>
        </div>
      </div>
    </footer>
  );
}
