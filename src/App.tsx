import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Login from "./pages/auth/Login";
import Signup from "./pages/auth/Signup";
import AdminDashboard from "./pages/admin/Dashboard";
import Buildings from "./pages/admin/Buildings";
import Flats from "./pages/admin/Flats";
import StaffDashboard from "./pages/staff/Dashboard";
import GenerateQuote from "./pages/staff/GenerateQuote";
import NotFound from "./pages/NotFound";

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
            <Route path="/admin/dashboard" element={<ProtectedRoute requiredRole="admin"><AdminDashboard /></ProtectedRoute>} />
            <Route path="/admin/buildings" element={<ProtectedRoute requiredRole="admin"><Buildings /></ProtectedRoute>} />
            <Route path="/admin/flats" element={<ProtectedRoute requiredRole="admin"><Flats /></ProtectedRoute>} />
            <Route path="/staff/dashboard" element={<ProtectedRoute requiredRole="staff"><StaffDashboard /></ProtectedRoute>} />
            <Route path="/staff/generate-quote" element={<ProtectedRoute requiredRole="staff"><GenerateQuote /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
