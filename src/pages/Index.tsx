import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Building2, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const Index = () => {
  const { user, userRole } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && userRole) {
      navigate(userRole === 'admin' ? '/admin/dashboard' : '/staff/dashboard');
    }
  }, [user, userRole, navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Aakar Construction</span>
          </div>
          <Button onClick={() => navigate('/auth/login')}>
            Login
          </Button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="max-w-4xl text-center">
          <h1 className="mb-6 text-5xl font-bold tracking-tight">
            Professional Construction
            <span className="block text-primary">Management System</span>
          </h1>
          <p className="mb-8 text-xl text-muted-foreground">
            Streamline your construction projects with our comprehensive building and flat management platform.
          </p>

          <div className="mb-12">
            <Button size="lg" onClick={() => navigate('/auth/login')}>
              Login to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <Card>
              <CardContent className="p-6">
                <Building2 className="mb-4 h-8 w-8 text-primary" />
                <h3 className="mb-2 font-semibold">Building Management</h3>
                <p className="text-sm text-muted-foreground">
                  Manage multiple buildings with detailed pricing and charges
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Building2 className="mb-4 h-8 w-8 text-accent" />
                <h3 className="mb-2 font-semibold">Flat Tracking</h3>
                <p className="text-sm text-muted-foreground">
                  Track flats with booking status and specifications
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <Building2 className="mb-4 h-8 w-8 text-blue-600" />
                <h3 className="mb-2 font-semibold">Quote Generation</h3>
                <p className="text-sm text-muted-foreground">
                  Generate professional quotes with Excel export
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Index;