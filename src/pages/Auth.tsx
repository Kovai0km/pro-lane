import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { z } from 'zod';
import logoLight from '@/assets/logo-light.jpg';
import logoDark from '@/assets/logo-dark.jpg';

const authSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  fullName: z.string().optional(),
});

export default function Auth() {
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset'>(
    searchParams.get('mode') === 'signup' ? 'signup' 
    : searchParams.get('mode') === 'reset' ? 'reset'
    : 'signin'
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; fullName?: string }>({});

  const { signIn, signUp, resetPassword, updatePassword, user } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { toast } = useToast();

  const logo = theme === 'dark' ? logoDark : logoLight;

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const validateForm = () => {
    try {
      if (mode === 'forgot') {
        z.string().email().parse(email);
        setErrors({});
        return true;
      }
      authSchema.parse({ email, password, fullName: mode === 'signup' ? fullName : undefined });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: { email?: string; password?: string; fullName?: string } = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as keyof typeof fieldErrors] = err.message;
          }
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (mode === 'reset') {
      if (newPassword.length < 6) {
        toast({ title: 'Password too short', description: 'Password must be at least 6 characters.', variant: 'destructive' });
        return;
      }
      setLoading(true);
      try {
        const { error } = await updatePassword(newPassword);
        if (error) throw error;
        toast({ title: 'Password updated', description: 'Your password has been changed. Redirecting...' });
        navigate('/dashboard');
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!validateForm()) return;
    
    setLoading(true);

    try {
      if (mode === 'forgot') {
        const { error } = await resetPassword(email);
        if (error) {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        } else {
          setResetSent(true);
          toast({ title: 'Check your email', description: 'We sent you a password reset link.' });
        }
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password, fullName);
        if (error) {
          if (error.message.includes('already registered')) {
            toast({ title: 'Account exists', description: 'An account with this email already exists. Please sign in instead.', variant: 'destructive' });
            setMode('signin');
          } else {
            toast({ title: 'Sign up failed', description: error.message, variant: 'destructive' });
          }
        } else {
          toast({ title: 'Account created', description: 'Please check your email to verify your account.' });
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: 'Sign in failed',
            description: error.message.includes('Invalid') 
              ? 'Invalid email or password. Please try again.'
              : error.message.includes('Email not confirmed')
              ? 'Please verify your email first. Check your inbox for a verification link.'
              : error.message,
            variant: 'destructive',
          });
        } else {
          navigate('/dashboard');
        }
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-8 md:px-16 py-12">
        <div className="max-w-md mx-auto w-full">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-12">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Link>

          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <img src={logo} alt="ProOrbit" className="h-10 w-auto object-contain" />
              <span className="text-xl font-bold">PROORBIT</span>
            </div>
            <h1 className="text-3xl font-bold mb-2">
              {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Set new password' : 'Reset password'}
            </h1>
            <p className="text-muted-foreground">
              {mode === 'signin' 
                ? 'Sign in to manage your agency workflow.' 
                : mode === 'signup'
                ? 'Start organizing your creative projects today.'
                : mode === 'reset'
                ? 'Enter your new password below.'
                : "Enter your email and we'll send you a reset link."}
            </p>
          </div>

          {mode === 'forgot' && resetSent ? (
            <div className="text-center py-8">
              <div className="h-16 w-16 mx-auto mb-4 border-2 border-foreground flex items-center justify-center">
                <span className="text-2xl">✓</span>
              </div>
              <h2 className="text-xl font-semibold mb-2">Check your email</h2>
              <p className="text-muted-foreground mb-4">
                We sent a password reset link to {email}
              </p>
              <Button variant="outline" onClick={() => { setMode('signin'); setResetSent(false); }}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
                {mode === 'reset' && (
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">New Password</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={loading}
                      required
                      minLength={6}
                    />
                  </div>
                )}
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      disabled={loading}
                    />
                    {errors.fullName && (
                      <p className="text-sm text-destructive">{errors.fullName}</p>
                    )}
                  </div>
                )}

                {mode !== 'reset' && (
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="you@agency.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={loading} required />
                    {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
                  </div>
                )}

                {mode !== 'forgot' && mode !== 'reset' && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      required
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                )}

                {mode === 'signin' && (
                  <div className="text-right">
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Update Password' : 'Send Reset Link'}
                </Button>
              </form>

              <div className="mt-6 text-center text-sm">
                {mode === 'signin' ? (
                  <p className="text-muted-foreground">
                    Don't have an account?{' '}
                    <button 
                      onClick={() => setMode('signup')}
                      className="text-foreground underline underline-offset-4 hover:no-underline"
                    >
                      Sign up
                    </button>
                  </p>
                ) : mode === 'signup' ? (
                  <p className="text-muted-foreground">
                    Already have an account?{' '}
                    <button 
                      onClick={() => setMode('signin')}
                      className="text-foreground underline underline-offset-4 hover:no-underline"
                    >
                      Sign in
                    </button>
                  </p>
                ) : (
                  <p className="text-muted-foreground">
                    Remember your password?{' '}
                    <button 
                      onClick={() => setMode('signin')}
                      className="text-foreground underline underline-offset-4 hover:no-underline"
                    >
                      Sign in
                    </button>
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Panel - Decorative */}
      <div className="hidden lg:flex w-1/2 bg-foreground text-background items-center justify-center p-16">
        <div className="max-w-lg">
          <div className="space-y-8">
            <div className="grid grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => (
                <div 
                  key={i} 
                  className={`aspect-square border-2 border-background/30 ${i % 3 === 0 ? 'bg-background' : ''}`}
                />
              ))}
            </div>
            <blockquote className="text-2xl font-light leading-relaxed">
              "ProOrbit transformed how our team handles projects. 
              Everything is organized, tracked, and delivered on time."
            </blockquote>
            <div>
              <div className="font-semibold">Sarah Chen</div>
              <div className="text-sm text-background/60">Creative Director, Studio X</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
