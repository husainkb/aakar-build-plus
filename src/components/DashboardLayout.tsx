import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Building2, LayoutDashboard, Building, Home, FileText, LogOut, FileBarChart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from '@/components/ui/drawer';
import { useState } from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { userRole, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth/login');
  };

  const adminLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/buildings', label: 'Buildings', icon: Building },
    { href: '/admin/flats', label: 'Flats', icon: Home },
    { href: '/admin/reports', label: 'Reports', icon: FileBarChart },
  ];

  const staffLinks = [
    { href: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/staff/generate-quote', label: 'Generate Quote', icon: FileText },
    { href: '/staff/reports', label: 'Reports', icon: FileBarChart },
  ];

  const links = userRole === 'admin' ? adminLinks : staffLinks;

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar for desktop, Drawer for mobile/tablet */}
      <div className="lg:hidden">
        <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
          <DrawerTrigger asChild>
            <Button className="fixed top-4 left-4 z-50 lg:hidden" variant="outline" size="icon" onClick={() => setDrawerOpen(true)}>
              <Building2 className="h-6 w-6" />
            </Button>
          </DrawerTrigger>
          <DrawerContent className="p-0">
            <aside className="w-64 border-r bg-sidebar text-sidebar-foreground min-h-screen">
              <div className="flex h-16 items-center border-b border-sidebar-border px-6">
                <Building2 className="h-6 w-6 text-sidebar-primary" />
                <span className="ml-2 text-lg font-semibold">Aakar Construction</span>
                <DrawerClose asChild>
                  <Button variant="ghost" size="icon" className="ml-auto" onClick={() => setDrawerOpen(false)}>
                    ✕
                  </Button>
                </DrawerClose>
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
                      onClick={() => setDrawerOpen(false)}
                    >
                      <Icon className="h-4 w-4" />
                      {link.label}
                    </Link>
                  );
                })}
                <Button
                  variant="ghost"
                  className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50"
                  onClick={() => { setDrawerOpen(false); handleSignOut(); }}
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  Logout
                </Button>
              </nav>
            </aside>
          </DrawerContent>
        </Drawer>
      </div>
      <aside className="hidden lg:block w-64 border-r bg-sidebar text-sidebar-foreground">
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
      <main className="flex-1 lg:ml-0">
        <div className="border-b bg-card">
          <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-base sm:text-lg font-semibold capitalize">
              {userRole} Dashboard
            </h2>
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};