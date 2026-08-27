import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Map, Eye, EyeOff, Loader2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AuthPage() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [paidOnlyNotice, setPaidOnlyNotice] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    try {
      if (sessionStorage.getItem('dronie_paid_only_notice') === '1') {
        setPaidOnlyNotice(true);
        sessionStorage.removeItem('dronie_paid_only_notice');
      }
    } catch {}
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: { data: { full_name: fullName } }
        });
        if (error) {
          const msg = (error.message || '').toLowerCase();
          if (msg.includes('already registered') || msg.includes('already been registered') || msg.includes('user already exists')) {
            throw new Error('An account with this email already exists. Please sign in instead.');
          }
          throw error;
        }
        // Supabase obfuscates existing users by returning a user with no identities.
        if (data.user && (data.user.identities?.length ?? 0) === 0) {
          setMode('login');
          throw new Error('An account with this email already exists. Please sign in instead.');
        }
        toast({ title: 'Account created!', description: 'Welcome to Dronie.' });
        navigate('/dashboard');

      } else {
        const { data: signInData, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
        if (error) throw error;

        // Paid-only gate: verify subscription (admins exempt) before allowing access.
        const uid = signInData.user?.id;
        if (uid) {
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', uid);
          const isAdminUser = (rolesData ?? []).some((r) => r.role === 'admin');

          if (!isAdminUser) {
            const { data: subData } = await supabase.functions.invoke('check-subscription');
            if (!subData?.subscribed) {
              await supabase.auth.signOut();
              setPaidOnlyNotice(true);
              setLoading(false);
              return;
            }
          }
        }
        navigate('/dashboard');
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-foreground p-12">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Map className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-display font-700 text-lg text-primary-foreground">Dronie
</span>
        </Link>

        <div className="space-y-4">
          <p className="text-4xl font-display font-700 text-primary-foreground leading-tight">
            Turn drone flights<br />into precise maps.
          </p>
          <p className="text-primary-foreground/60 text-base">
            Upload images. Process in the cloud.<br />Download professional deliverables.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[{ val: 'GeoTIFF', label: 'Ortho export' },
          { val: 'LAS/LAZ', label: 'Point clouds' },
          { val: 'Browser', label: 'Map viewer' },
          { val: 'Free', label: 'To get started' }].
          map((s) =>
          <div key={s.label} className="bg-primary-foreground/5 rounded-xl p-4 border border-primary-foreground/10">
              <p className="text-2xl font-display font-700 text-accent">{s.val}</p>
              <p className="text-xs text-primary-foreground/50 mt-0.5">{s.label}</p>
            </div>
          )}
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-8">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Map className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-700 text-lg text-foreground">Dronie</span>
          </div>

          {paidOnlyNotice && (
            <div className="rounded-xl border border-accent/30 bg-accent/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-accent">
                <Sparkles className="w-4 h-4" />
                <p className="text-sm font-semibold">Thank you for testing Dronie</p>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Dronie is now a paid platform and we no longer offer a free tier.
                We're grateful for the time you spent exploring the product during our
                preview period. To continue using your account, please choose a
                subscription plan that fits your work.
              </p>
              <Button
                type="button"
                size="sm"
                className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={() => navigate('/subscription')}
              >
                View subscription plans
              </Button>
            </div>
          )}

          <div>
            <h1 className="text-2xl font-display font-700 text-foreground">
              {mode === 'login' ? 'Welcome back' : 'Create account'}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === 'login' ?
              'Sign in to your Dronie dashboard' :
              'Start processing drone imagery for free'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' &&
            <div className="space-y-1.5">
                <Label htmlFor="fullName">Full name</Label>
                <Input
                id="fullName"
                placeholder="Alex Rivera"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required />
              
              </div>
            }

            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required />
              
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="pr-10" />
                
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                  
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.97]">
              
              {loading ?
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Please wait</> :
              mode === 'login' ? 'Sign In' : 'Create Account'}
            </Button>
          </form>

          <p className="text-sm text-center text-muted-foreground">
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-primary font-medium hover:underline">
              
              {mode === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>

          <p className="text-xs text-center text-muted-foreground">
            By continuing you agree to our{' '}
            <a href="#" className="underline hover:text-foreground">Terms</a> and{' '}
            <a href="#" className="underline hover:text-foreground">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>);

}