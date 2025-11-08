import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import Logo from "./Logo";
import { useAuth } from "@/contexts/AuthContext";

const Navbar = () => {
  const { isAuthenticated } = useAuth();

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70 shadow-soft">
      <div className="container flex h-20 items-center justify-between px-4">
        <div className="flex items-center gap-12">
          <Link to="/" className="flex items-center space-x-2 hover:scale-105 transition-transform">
            <Logo size="default" />
          </Link>
          <div className="hidden md:flex items-center gap-8">
            <Link 
              to="/features" 
              className="relative text-sm font-semibold text-muted-foreground hover:text-primary transition-colors group"
            >
              Features
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent group-hover:w-full transition-all duration-300" />
            </Link>
            <Link 
              to="/use-cases" 
              className="relative text-sm font-semibold text-muted-foreground hover:text-primary transition-colors group"
            >
              Use Cases
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-gradient-to-r from-primary to-accent group-hover:w-full transition-all duration-300" />
            </Link>
           
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isAuthenticated ? (
            <Link to="/dashboard">
              <Button 
                size="sm" 
                className="relative bg-gradient-to-r from-secondary to-primary text-white font-bold shadow-md hover:shadow-glow hover:scale-105 transition-all duration-300 overflow-hidden group"
              >
                <span className="relative z-10">Dashboard</span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-lime opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
            </Link>
          ) : (
            <>
          <Link to="/login">
            <Button 
              variant="ghost" 
              size="sm" 
              className="font-semibold hover:bg-muted/50"
            >
              Login
            </Button>
          </Link>
          <Link to="/signup">
            <Button 
              size="sm" 
              className="relative bg-gradient-to-r from-secondary to-primary text-white font-bold shadow-md hover:shadow-glow hover:scale-105 transition-all duration-300 overflow-hidden group"
            >
              <span className="relative z-10">Get Started</span>
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-lime opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </Button>
          </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
