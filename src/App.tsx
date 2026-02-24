import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import DashboardLayoutRoute from "@/components/DashboardLayoutRoute";
import Index from "./pages/Index";
import Login from "./pages/auth/Login";
import CustomerLogin from "./pages/auth/CustomerLogin";
import ForgotPassword from "./pages/auth/ForgotPassword";
import ResetPassword from "./pages/auth/ResetPassword";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminBookings from "./pages/admin/Bookings";
import Buildings from "./pages/admin/Buildings";
import Flats from "./pages/admin/Flats";
import AdminReports from "./pages/admin/Reports";
import AdminSavedQuotes from "./pages/admin/SavedQuotes";
import AdminGenerateQuote from "./pages/admin/GenerateQuote";
import StaffManagement from "./pages/admin/StaffManagement";
import AdminGrievances from "./pages/admin/Grievances";
import AdminFeedback from "./pages/admin/Feedback";
import ManagerDashboard from "./pages/manager/Dashboard";
import ManagerSavedQuotes from "./pages/manager/SavedQuotes";
import ManagerGrievances from "./pages/manager/Grievances";
import StaffDashboard from "./pages/staff/Dashboard";
import StaffFlats from "./pages/staff/Flats";
import GenerateQuote from "./pages/staff/GenerateQuote";
import SavedQuotes from "./pages/staff/SavedQuotes";
import StaffReports from "./pages/staff/Reports";
import StaffGrievances from "./pages/staff/Grievances";
import CustomerGrievances from "./pages/customer/Grievances";
import CustomerBookings from "./pages/customer/Bookings";
import CustomerFeedback from "./pages/customer/Feedback";
import ChangePassword from "./pages/shared/ChangePassword";
import NotFound from "./pages/NotFound";
import Signup from "./pages/auth/Signup";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth/login" element={<Login />} />
            <Route path="/auth/signup" element={<Signup />} />
            <Route path="/customer/login" element={<CustomerLogin />} />
            <Route path="/auth/forgot-password" element={<ForgotPassword />} />
            <Route path="/auth/reset-password" element={<ResetPassword />} />

            {/* All dashboard routes share a persistent layout */}
            <Route element={<DashboardLayoutRoute />}>
              {/* Admin Routes */}
              <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
              <Route path="/admin/buildings" element={<ProtectedRoute requiredRole="admin"><Buildings /></ProtectedRoute>} />
              <Route path="/admin/flats" element={<ProtectedRoute requiredRole="admin"><Flats /></ProtectedRoute>} />
              <Route path="/admin/bookings" element={<ProtectedRoute requiredRole="admin"><AdminBookings /></ProtectedRoute>} />
              <Route path="/admin/generate-quote" element={<ProtectedRoute requiredRole="admin"><AdminGenerateQuote /></ProtectedRoute>} />
              <Route path="/admin/saved-quotes" element={<ProtectedRoute requiredRole="admin"><AdminSavedQuotes /></ProtectedRoute>} />
              <Route path="/admin/reports" element={<ProtectedRoute requiredRole="admin"><AdminReports /></ProtectedRoute>} />
              <Route path="/admin/staff-management" element={<ProtectedRoute requiredRole="admin"><StaffManagement /></ProtectedRoute>} />
              <Route path="/admin/grievances" element={<ProtectedRoute requiredRole="admin"><AdminGrievances /></ProtectedRoute>} />
              <Route path="/admin/feedback" element={<ProtectedRoute requiredRole="admin"><AdminFeedback /></ProtectedRoute>} />
              <Route path="/admin/change-password" element={<ProtectedRoute requiredRole="admin"><ChangePassword /></ProtectedRoute>} />
              {/* Manager Routes */}
              <Route path="/manager/dashboard" element={<ProtectedRoute requiredRole="manager"><ManagerDashboard /></ProtectedRoute>} />
              <Route path="/manager/saved-quotes" element={<ProtectedRoute requiredRole="manager"><ManagerSavedQuotes /></ProtectedRoute>} />
              <Route path="/manager/grievances" element={<ProtectedRoute requiredRole="manager"><ManagerGrievances /></ProtectedRoute>} />
              <Route path="/manager/change-password" element={<ProtectedRoute requiredRole="manager"><ChangePassword /></ProtectedRoute>} />
              {/* Staff Routes */}
              <Route path="/staff/dashboard" element={<ProtectedRoute requiredRole="staff"><StaffDashboard /></ProtectedRoute>} />
              <Route path="/staff/flats" element={<ProtectedRoute requiredRole="staff"><StaffFlats /></ProtectedRoute>} />
              <Route path="/staff/generate-quote" element={<ProtectedRoute requiredRole="staff"><GenerateQuote /></ProtectedRoute>} />
              <Route path="/staff/saved-quotes" element={<ProtectedRoute requiredRole="staff"><SavedQuotes /></ProtectedRoute>} />
              <Route path="/staff/reports" element={<ProtectedRoute requiredRole="staff"><StaffReports /></ProtectedRoute>} />
              <Route path="/staff/grievances" element={<ProtectedRoute requiredRole="staff"><StaffGrievances /></ProtectedRoute>} />
              <Route path="/staff/change-password" element={<ProtectedRoute requiredRole="staff"><ChangePassword /></ProtectedRoute>} />
              {/* Customer Routes */}
              <Route path="/customer/grievances" element={<ProtectedRoute requiredRole="customer"><CustomerGrievances /></ProtectedRoute>} />
              <Route path="/customer/bookings" element={<ProtectedRoute requiredRole="customer"><CustomerBookings /></ProtectedRoute>} />
              <Route path="/customer/feedback" element={<ProtectedRoute requiredRole="customer"><CustomerFeedback /></ProtectedRoute>} />
              <Route path="/customer/change-password" element={<ProtectedRoute requiredRole="customer"><ChangePassword /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
