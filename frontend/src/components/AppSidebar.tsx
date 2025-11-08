import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, FileText, CreditCard, Wallet, 
  Settings, LogOut, Users, Bot, Bell
} from "lucide-react";
import Logo from "@/components/Logo";
import { useAuth } from "@/contexts/AuthContext";
import { a2aAPI } from "@/services/api";
import { useState, useEffect } from "react";

const AppSidebar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [a2aBadgeCount, setA2ABadgeCount] = useState(0);

  // Fetch A2A pending count
  useEffect(() => {
    const fetchA2APending = async () => {
      try {
        const currentUserId = localStorage.getItem('userId');
        const response = await a2aAPI.getRequests(undefined, 100);
        
        // Only count INCOMING requests (where YOU are the payer)
        const incomingPending = response.requests?.filter((r: any) => {
          const isPayer = (r as any).payer_id === currentUserId;
          const isPending = r.status === 'pending' || r.status === 'approved';
          return isPayer && isPending;
        }).length || 0;
        
        setA2ABadgeCount(incomingPending);
      } catch (error) {
        console.log('Could not fetch A2A badge count');
      }
    };

    fetchA2APending();
    
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchA2APending, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  // Navigation items configuration
  const navItems = [
    { path: "/dashboard", label: "Dashboard", icon: TrendingUp },
    { path: "/contracts", label: "Contracts", icon: FileText },
    { path: "/payments", label: "Payments", icon: CreditCard },
    { path: "/wallets", label: "Wallets", icon: Wallet },
    { path: "/a2a", label: "A2A Payments", icon: Bot, badge: a2aBadgeCount }, // DYNAMIC badge
    { path: "/request-center", label: "Request Center", icon: Bell }, // NEW: Request Center
    { path: "/recipients", label: "Recipients", icon: Users },
    { path: "/settings", label: "Settings", icon: Settings },
  ];

  // Check if current path matches or starts with the nav item path
  const isActive = (path: string) => {
    if (path === "/dashboard") {
      return location.pathname === "/dashboard";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <aside className="w-64 border-r border-border bg-background sticky top-0 h-screen flex flex-col">
      <div className="p-6 border-b border-border">
        <Link to="/" className="hover:opacity-80 transition-opacity inline-block">
          <Logo />
        </Link>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <Link key={item.path} to={item.path}>
              <Button 
                className={
                  active 
                    ? "w-full justify-start gap-3 bg-primary hover:bg-primary/90 text-white font-semibold relative" 
                    : "w-full justify-start gap-3 relative"
                }
                variant={active ? "default" : "ghost"}
              >
                <Icon className="w-5 h-5" />
                {item.label}
                
                {/* Notification Badge - only for A2A for now */}
                {item.badge !== undefined && item.badge > 0 && (
                  <Badge 
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-red-500 text-white px-2 py-0.5 text-xs"
                  >
                    {item.badge}
                  </Badge>
                )}
              </Button>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border">
        {/* User info - uncomment if needed */}
        {user && (
          <div className="flex items-center gap-3 mb-3 p-3 rounded-lg hover:bg-muted transition-colors">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white font-bold text-sm">
              {user.full_name?.split(' ').map(n => n[0]).join('') || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{user.full_name || 'User'}</p>
              <p className="text-xs text-muted-foreground">{user.role || 'Free Plan'}</p>
            </div>
          </div>
        )}
        
        <Button 
          variant="ghost" 
          className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="w-5 h-5" />
          Logout
        </Button>
      </div>
    </aside>
  );
};

export default AppSidebar;

