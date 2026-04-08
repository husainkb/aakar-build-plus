import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Building2, LayoutDashboard, Building, Home, FileText, LogOut, FileBarChart, Menu, Lock, FolderOpen, Users, MessageSquareWarning, BookOpen, MessageSquare } from 'lucide-react';
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
import { useState, useEffect } from 'react';
import { NotificationBell } from '@/components/NotificationBell';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { userRole, signOut, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [canViewGrievances, setCanViewGrievances] = useState(false);

  useEffect(() => {
    const checkPossession = async () => {
      if (userRole === 'customer' && user?.id) {
        // 1. Get customer ID
        const { data: customer } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (customer) {
          // 2. Check for possession enabled flats
          const { count } = await supabase
            .from('flats')
            .select('*', { count: 'exact', head: true })
            .eq('booked_customer_id', customer.id)
            .eq('possession_enabled', true);

          setCanViewGrievances(!!count && count > 0);
        }
      }
    };
    checkPossession();
  }, [userRole, user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  const adminLinks = [
    { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/admin/buildings', label: 'Buildings', icon: Building },
    { href: '/admin/flats', label: 'Flats', icon: Home },
    { href: '/admin/bookings', label: 'Bookings', icon: BookOpen },
    { href: '/admin/generate-quote', label: 'Generate Quote', icon: FileText },
    { href: '/admin/saved-quotes', label: 'Saved Quotes', icon: FolderOpen },
    { href: '/admin/grievances', label: 'Grievances', icon: MessageSquareWarning },
    { href: '/admin/feedback', label: 'Feedback', icon: MessageSquare },
    { href: '/admin/reports', label: 'Reports', icon: FileBarChart },
    { href: '/admin/staff-management', label: 'Staff Management', icon: Users },
    { href: '/admin/create-staff', label: 'Create Staff', icon: UserPlus },
    { href: '/admin/change-password', label: 'Change Password', icon: Lock },
  ];

  const managerLinks = [
    { href: '/manager/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/manager/saved-quotes', label: 'Team Quotes', icon: FolderOpen },
    { href: '/manager/grievances', label: 'Grievances', icon: MessageSquareWarning },
    { href: '/manager/change-password', label: 'Change Password', icon: Lock },
  ];

  const staffLinks = [
    { href: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/staff/flats', label: 'Flats', icon: Home },
    { href: '/staff/generate-quote', label: 'Generate Quote', icon: FileText },
    { href: '/staff/saved-quotes', label: 'Saved Quotes', icon: FolderOpen },
    { href: '/staff/grievances', label: 'My Tickets', icon: MessageSquareWarning },
    { href: '/staff/reports', label: 'Reports', icon: FileBarChart },
    { href: '/staff/change-password', label: 'Change Password', icon: Lock },
  ];

  const allCustomerLinks = [
    { href: '/customer/bookings', label: 'My Bookings', icon: Home },
    { href: '/customer/grievances', label: 'My Grievances', icon: MessageSquareWarning },
    { href: '/customer/feedback', label: 'Feedback', icon: MessageSquare },
    { href: '/customer/change-password', label: 'Change Password', icon: Lock },
  ];
  useEffect(() => {
    console.log("canViewGrievances", canViewGrievances);
  }, [canViewGrievances]);
  const customerLinks = allCustomerLinks.filter(link =>
    link.label !== 'My Grievances' || canViewGrievances
  );

  const links = userRole === 'admin' ? adminLinks :
    userRole === 'manager' ? managerLinks :
      userRole === 'customer' ? customerLinks : staffLinks;

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


  // Theme toggle logic with localStorage persistence (default: light)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored === 'dark' || stored === 'light') {
        if (stored === 'dark') document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        return stored;
      }
      // Default to light mode
      document.documentElement.classList.remove('dark');
      return 'light';
    }
    return 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', next);
      return next;
    });
  };

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Mobile/Tablet: Sheet Drawer */}
      <div className="lg:hidden">
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetTrigger asChild>
            <Button
              className="fixed top-4 right-8 z-50 shadow-lg"
              variant="outline"
              size="icon"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
            <div className="flex items-center border-b border-sidebar-border px-6 w-48 py-1">
              <img src="/images/logo.png" alt="Aakar Construction Logo" className="h-auto max-w-full" />
            </div>
            <SidebarNav />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop: Fixed Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r bg-sidebar border-sidebar-border">
        <div className="flex py-1 items-center border-b border-sidebar-border px-6">
          <div className='w-[9.6rem]'>
            <img src="/images/logo.png" alt="Aakar Construction Logo" className="h-auto max-w-full" />
          </div>
        </div>
        <SidebarNav />
      </aside>

      {/* Main content */}
      <main className="flex-1 lg:pl-64 min-h-screen">
        <div className="sticky top-0 z-40 border-b bg-card shadow-sm">
          <div className="flex h-16 items-center px-4 sm:px-6 lg:px-8 justify-between">
            <h2 className="text-base sm:text-lg font-semibold capitalize text-card-foreground">
              {userRole} Dashboard
            </h2>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <button
                onClick={toggleTheme}
                className="rounded px-3 py-1 text-sm font-medium border border-border bg-background text-foreground hover:bg-muted transition"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? '🌙 Dark' : '☀️ Light'}
              </button>
            </div>
          </div>
        </div>
        <div className="py-4 sm:p-6 lg:p-8">{children}</div>
      </main>
    </div>
  );
};
