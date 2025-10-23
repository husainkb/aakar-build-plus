import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Building2, LayoutDashboard, Building, Home, FileText, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { userRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const adminLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/buildings', label: 'Buildings', icon: Building },
    { href: '/admin/flats', label: 'Flats', icon: Home },
  ];

  const staffLinks = [
    { href: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/staff/generate-quote', label: 'Generate Quote', icon: FileText },
  ];

  const links = userRole === 'admin' ? adminLinks : staffLinks;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-64 border-r bg-sidebar text-sidebar-foreground">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <Building2 className="h-6 w-6 text-sidebar-primary" />
          <span className="ml-2 text-lg font-semibold">Aakar Construction</span>
        </div>
        <nav className="space-y-1 p-4">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.href;
            return (
              <Link
                key={link.href}
                to={link.href}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'hover:bg-sidebar-accent/50'
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={handleSignOut}
          >
            <LogOut className="mr-3 h-4 w-4" />
            Logout
          </Button>
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1">
        <div className="border-b bg-card">
          <div className="flex h-16 items-center px-8">
            <h2 className="text-lg font-semibold capitalize">
              {userRole} Dashboard
            </h2>
          </div>
        </div>
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};