import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import GlobalAIChat from "@/components/GlobalAIChat"; // 🤖 Global AI Assistant
import GlobalVoiceAssistant from "@/components/GlobalVoiceAssistant"; // 🎤 Global Voice Assistant
import Index from "./pages/Index";
import Features from "./pages/Features";
import UseCases from "./pages/UseCases";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Contracts from "./pages/Contracts";
import ContractNew from "./pages/ContractNew";
import ContractDetail from "./pages/ContractDetail";
import Payments from "./pages/Payments";
import Wallets from "./pages/Wallets";
import Recipients from "./pages/Recipients";
import SettingsPage from "./pages/SettingsPage";
import A2ARequests from "./pages/A2ARequests"; // 🤖 A2A Agent-to-Agent payments
import RequestContracts from "./pages/RequestContracts"; // 🔔 Request Center
import RequestContractNew from "./pages/RequestContractNew"; // 🔔 Create Request Contract
import RequestContractDetail from "./pages/RequestContractDetail"; // 🔔 Request Contract Detail
import SentRequests from "./pages/SentRequests"; // 📤 Sent Requests
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        {/* 🎤 Global Voice Assistant - Available on all pages (above chat) */}
        <GlobalVoiceAssistant />
        
        {/* 🤖 Global AI Chat - Available on all pages */}
        <GlobalAIChat />
        
        <Routes>
            {/* Public routes */}
          <Route path="/" element={<Index />} />
            <Route path="/features" element={<Features />} />
            <Route path="/use-cases" element={<UseCases />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
            
            {/* Protected routes - require authentication */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/contracts" element={<ProtectedRoute><Contracts /></ProtectedRoute>} />
            <Route path="/contracts/new" element={<ProtectedRoute><ContractNew /></ProtectedRoute>} />
            <Route path="/contracts/:id" element={<ProtectedRoute><ContractDetail /></ProtectedRoute>} />
            <Route path="/payments" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/wallets" element={<ProtectedRoute><Wallets /></ProtectedRoute>} />
            <Route path="/recipients" element={<ProtectedRoute><Recipients /></ProtectedRoute>} />
            <Route path="/a2a" element={<ProtectedRoute><A2ARequests /></ProtectedRoute>} />
            <Route path="/request-center" element={<ProtectedRoute><RequestContracts /></ProtectedRoute>} />
            <Route path="/request-center/contracts" element={<ProtectedRoute><RequestContracts /></ProtectedRoute>} />
            <Route path="/request-center/contracts/new" element={<ProtectedRoute><RequestContractNew /></ProtectedRoute>} />
            <Route path="/request-center/contracts/:id" element={<ProtectedRoute><RequestContractDetail /></ProtectedRoute>} />
            <Route path="/request-center/sent-requests" element={<ProtectedRoute><SentRequests /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
            
            {/* 404 catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
