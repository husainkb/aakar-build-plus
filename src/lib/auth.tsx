import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session, createClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

// ✅ Admin Supabase Client (for password reset by email)
const supabaseAdmin = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
);

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: 'admin' | 'staff' | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string, role: 'admin' | 'staff') => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<{ error: any }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: any }>;
  updatePassword: (newPassword: string) => Promise<{ error: any }>;
  forgotPassword: (email: string, newPassword: string) => Promise<{ error: any }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'staff' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(async () => {
            const { data } = await supabase
              .from('profiles')
              .select('role')
              .eq('id', session.user.id)
              .single();
            
            setUserRole(data?.role ?? null);
            setLoading(false);
          }, 0);
        } else {
          setUserRole(null);
          setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(async () => {
          const { data } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single();
          
          setUserRole(data?.role ?? null);
          setLoading(false);
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (!error) {
      toast.success('Signed in successfully!');
    }
    
    return { error };
  };

  const signUp = async (email: string, password: string, name: string, role: 'admin' | 'staff') => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role
        }
      }
    });
    
    if (!error) {
      toast.success('Account created successfully! Please check your email for verification.');
    }
    
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRole(null);
    toast.success('Signed out successfully!');
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user?.email) {
      return { error: { message: 'No user logged in' } };
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      return { error: { message: 'Current password is incorrect' } };
    }

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (!error) {
      toast.success('Password changed successfully!');
    }

    return { error };
  };

  const resetPasswordForEmail = async (email: string) => {
    const redirectUrl = `${window.location.origin}/auth/reset-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (!error) {
      toast.success('Password reset link sent to your email!');
    }

    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (!error) {
      toast.success('Password updated successfully!');
    }

    return { error };
  };

  const forgotPassword = async (email: string, newPassword: string) => {
    try {
      // Fetch all users and match by email
      const { data: users, error: fetchError } = await supabaseAdmin.auth.admin.listUsers();
      if (fetchError) throw fetchError;

      const user = users?.users?.find((u: any) => u.email === email);
      if (!user) {
        toast.error('No user found with that email');
        return { error: { message: 'User not found' } };
      }

      // Update the user’s password using admin privileges
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
        password: newPassword,
      });

      if (updateError) throw updateError;

      toast.success('Password updated successfully!');
      return { error: null };
    } catch (error: any) {
      console.error('Forgot Password Error:', error.message);
      toast.error('Failed to update password');
      return { error };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      session, 
      userRole, 
      loading, 
      signIn, 
      signUp, 
      signOut,
      changePassword,
      resetPasswordForEmail,
      updatePassword,
      forgotPassword
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
