import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase, AppRole } from '@/lib/supabase';
import { SubscriptionTier, getTierByProductId } from '@/lib/stripe-config';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  roles: AppRole[];
  isAdmin: boolean;
  loading: boolean;
  signOut: () => Promise<void>;
  subscriptionTier: SubscriptionTier;
  isSubscribed: boolean;
  subscriptionEnd: string | null;
  checkSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  roles: [],
  isAdmin: false,
  loading: true,
  signOut: async () => {},
  subscriptionTier: null,
  isSubscribed: false,
  subscriptionEnd: null,
  checkSubscription: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [subscriptionTier, setSubscriptionTier] = useState<SubscriptionTier>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);

  async function fetchRoles(userId: string) {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);
    if (data) setRoles(data.map((r) => r.role as AppRole));
  }

  async function checkSubscription() {
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) {
        console.error('Error checking subscription:', error);
        return;
      }
      const subscribed = data?.subscribed ?? false;
      setIsSubscribed(subscribed);
      setSubscriptionTier(getTierByProductId(data?.product_id));
      setSubscriptionEnd(data?.subscription_end ?? null);

      // Paid-only platform gate: sign out non-admin users without an active subscription.
      if (!subscribed) {
        const { data: sessionData } = await supabase.auth.getSession();
        const uid = sessionData.session?.user?.id;
        if (uid) {
          const { data: rolesData } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', uid);
          const isAdminUser = (rolesData ?? []).some((r) => r.role === 'admin');
          if (!isAdminUser) {
            try {
              sessionStorage.setItem('dronie_paid_only_notice', '1');
            } catch {}
            await supabase.auth.signOut();
            if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/auth')) {
              window.location.href = '/auth';
            }
          }
        }
      }
    } catch (err) {
      console.error('Subscription check failed:', err);
    }
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          // Don't block auth loading on roles or subscription
          fetchRoles(session.user.id);
          checkSubscription();
        } else {
          setRoles([]);
          setSubscriptionTier(null);
          setIsSubscribed(false);
          setSubscriptionEnd(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoles(session.user.id);
        checkSubscription();
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Auto-refresh subscription status every 60 seconds
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(checkSubscription, 60_000);
    return () => clearInterval(interval);
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        roles,
        isAdmin: roles.includes('admin'),
        loading,
        signOut,
        subscriptionTier,
        isSubscribed,
        subscriptionEnd,
        checkSubscription,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
