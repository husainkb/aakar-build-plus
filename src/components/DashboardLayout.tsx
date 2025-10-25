import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Building2, LayoutDashboard, Building, Home, FileText, LogOut, FileBarChart, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
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

  const SidebarNav = () => (
    <nav className="space-y-1 p-4">
      {links.map((link) => {
        const Icon = link.icon;
        const isActive = location.pathname === link.href;
        return (
          <Link
            key={link.href}
            to={link.href}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 hover:scale-[1.02]',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
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
        className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50 mt-4"
        onClick={() => { 
          setDrawerOpen(false); 
          handleSignOut(); 
        }}
      >
        <LogOut className="mr-3 h-4 w-4" />
        Logout
      </Button>
    </nav>
  );

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile/Tablet: Sheet Drawer */}
      <div className="lg:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button 
              className="fixed top-4 left-4 z-50 shadow-lg" 
              variant="outline" 
              size="icon"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
            <div className="flex h-16 items-center border-b border-sidebar-border px-6">
              <Building2 className="h-6 w-6 text-sidebar-primary" />
              <span className="ml-2 text-lg font-semibold text-sidebar-foreground">Aakar Construction</span>
            </div>
            <SidebarNav />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Fixed Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r bg-sidebar border-sidebar-border">
        <div className="flex h-16 items-center border-b border-sidebar-border px-6">
          <Building2 className="h-6 w-6 text-sidebar-primary" />
          <span className="ml-2 text-lg font-semibold text-sidebar-foreground">Aakar Construction</span>
        </div>
        <SidebarNav />
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:pl-64 min-h-screen">
        <div className="sticky top-0 z-40 border-b bg-card shadow-sm">
          <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8">
            <h2 className="text-base sm:text-lg font-semibold capitalize text-card-foreground">
              {userRole} Dashboard
            </h2>
          </div>
        </div>
        <div className="p-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};