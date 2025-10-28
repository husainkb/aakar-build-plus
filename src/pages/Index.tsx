import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useState } from 'react';

const Index = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  useEffect(() => {
    if (user && userRole) {
      navigate(userRole === 'admin' ? '/admin/dashboard' : '/staff/dashboard');
    }
  }, [user, userRole, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    const { error } = await signIn(email, password);
    
    if (error) {
      toast.error(error.message || 'Failed to sign in');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex flex-col home">
      {/* Full Width Header with Same Background */}
      <header className="w-full border-[#484848] border-b">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className='w-[9.6rem]'>
              <img src="/images/logo.png" alt="Aakar Construction Logo" className="h-auto max-w-full" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Responsive Layout */}
      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left Section - Index Content */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          <div className="w-full max-w-2xl space-y-6 sm:space-y-8 py-8 lg:py-0">
            {/* Main Heading */}
            <div className="text-center space-y-4 sm:space-y-6">
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white">
                Professional Construction
                <span className="block text-[#78c0c5] mt-2">Management System</span>
              </h1>
              <p className="text-base sm:text-lg lg:text-xl text-[#bababa] max-w-2xl mx-auto px-4">
                Streamline your construction projects with our comprehensive building and flat management platform.
              </p>
            </div>


            {/* Features Grid - Responsive */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mt-8 sm:mt-12 px-2">
              <Card className="text-center border-0 shadow-lg bg-[#232628] text-white">
                <CardContent className="p-4 sm:p-6">
                  <Building2 className="mx-auto mb-3 sm:mb-4 h-8 w-8 sm:h-10 sm:w-10 text-[#78c0c5]" />
                  <h3 className="mb-2 sm:mb-3 text-base sm:text-lg font-semibold">Building Management</h3>
                  <p className="text-xs sm:text-sm text-[#bababa]">
                    Manage multiple buildings with detailed pricing and changes
                  </p>
                </CardContent>
              </Card>
              <Card className="text-center border-0 shadow-lg bg-[#232628] text-white">
                <CardContent className="p-4 sm:p-6">
                  <Building2 className="mx-auto mb-3 sm:mb-4 h-8 w-8 sm:h-10 sm:w-10 text-[#43a047]" />
                  <h3 className="mb-2 sm:mb-3 text-base sm:text-lg font-semibold">Flat Tracking</h3>
                  <p className="text-xs sm:text-sm text-[#bababa]">
                    Track files with booking tools for specifications
                  </p>
                </CardContent>
              </Card>
              <Card className="text-center border-0 shadow-lg bg-[#232628] text-white">
                <CardContent className="p-4 sm:p-6">
                  <Building2 className="mx-auto mb-3 sm:mb-4 h-8 w-8 sm:h-10 sm:w-10 text-[#78c0c5]" />
                  <h3 className="mb-2 sm:mb-3 text-base sm:text-lg font-semibold">Quote Generation</h3>
                  <p className="text-xs sm:text-sm text-[#bababa]">
                    Generate professional quotes with Excel export
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>

        {/* Right Section - Login Form */}
        <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8 from-primary/5 via-background to-accent/5">
          <div className="w-full max-w-md mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2">Welcome Back</h2>
              <p className="text-[#bababa] text-sm sm:text-base">Sign in to your account</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
              <div className="space-y-2 sm:space-y-3">
                <Label htmlFor="email" className="text-sm font-medium text-[#bababa]">
                    Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="peyao3132@erford.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                    className="h-10 sm:h-12 text-base placeholder:text-[#bababa] bg-[#232628] border-[#4e4e4e] text-white"
                />
              </div>

              <div className="space-y-2 sm:space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-sm font-medium text-[#bababa]">
                      Password
                  </Label>
                  <Link to="/auth/forgot-password" className="text-xs text-white hover:underline">
                    Forgot Password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                    className="h-10 sm:h-12 text-base placeholder:text-[#bababa] bg-[#232628] border-[#4e4e4e] text-white"
                />
              </div>

              <Button 
                type="submit" 
                className="w-full h-10 sm:h-12 text-base font-medium" 
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-background border-t-transparent" />
                    Signing in...
                  </div>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;