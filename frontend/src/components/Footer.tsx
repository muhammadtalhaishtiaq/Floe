import { Link } from "react-router-dom";
import { Github, Twitter, MessageCircle } from "lucide-react";
import Logo from "./Logo";

const Footer = () => {
  return (
    <footer className="relative border-t border-border/40 bg-gradient-to-b from-background via-muted/30 to-muted/50 overflow-hidden">
      {/* Subtle Gradient Accents */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-teal/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-emerald/5 rounded-full blur-3xl" />
      
      <div className="container px-4 py-16 relative">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="space-y-6">
            <Logo size="default" />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
              Smooth payment automation for real-world assets. Built for the future of finance.
            </p>
            {/* Trust Badge */}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-emerald animate-glow-pulse" />
              <span>Powered by Circle USDC</span>
            </div>
          </div>
          
          <div>
            <h4 className="font-bold mb-6 text-foreground">Product</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link 
                  to="/features" 
                  className="text-muted-foreground hover:text-primary hover:translate-x-1 transition-all inline-flex items-center gap-2 group"
                >
                  <span className="w-0 h-0.5 bg-primary group-hover:w-4 transition-all" />
                  Features
                </Link>
              </li>
              <li>
                <Link 
                  to="/use-cases" 
                  className="text-muted-foreground hover:text-primary hover:translate-x-1 transition-all inline-flex items-center gap-2 group"
                >
                  <span className="w-0 h-0.5 bg-primary group-hover:w-4 transition-all" />
                  Use Cases
                </Link>
              </li>
              <li>
                {/* <Link 
                  to="/signup" 
                  className="text-muted-foreground hover:text-primary hover:translate-x-1 transition-all inline-flex items-center gap-2 group"
                >
                  <span className="w-0 h-0.5 bg-primary group-hover:w-4 transition-all" />
                  Pricing
                </Link> */}
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-6 text-foreground">Resources</h4>
            <ul className="space-y-3 text-sm">
              {/* <li>
                <Link 
                  to="/login" 
                  className="text-muted-foreground hover:text-primary hover:translate-x-1 transition-all inline-flex items-center gap-2 group"
                >
                  <span className="w-0 h-0.5 bg-primary group-hover:w-4 transition-all" />
                  Documentation
                </Link>
              </li> */}
              <li>
                <a 
                  href="https://github.com" 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary hover:translate-x-1 transition-all inline-flex items-center gap-2 group"
                >
                  <span className="w-0 h-0.5 bg-primary group-hover:w-4 transition-all" />
                  GitHub
                </a>
              </li>
              <li>
                {/* <Link 
                  to="/login" 
                  className="text-muted-foreground hover:text-primary hover:translate-x-1 transition-all inline-flex items-center gap-2 group"
                >
                  <span className="w-0 h-0.5 bg-primary group-hover:w-4 transition-all" />
                  Support
                </Link> */}
              </li>
            </ul>
          </div>

          <div>
            {/* <h4 className="font-bold mb-6 text-foreground">Connect</h4> */}
            {/* <div className="flex gap-4">
              <a 
                href="https://twitter.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-muted/50 hover:bg-primary/20 border border-border/50 hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-all hover-lift group"
              >
                <Twitter className="h-5 w-5 group-hover:scale-110 transition-transform" />
              </a>
              <a 
                href="https://github.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-muted/50 hover:bg-primary/20 border border-border/50 hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-all hover-lift group"
              >
                <Github className="h-5 w-5 group-hover:scale-110 transition-transform" />
              </a>
              <a 
                href="https://discord.com" 
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 rounded-lg bg-muted/50 hover:bg-primary/20 border border-border/50 hover:border-primary/50 flex items-center justify-center text-muted-foreground hover:text-primary transition-all hover-lift group"
              >
                <MessageCircle className="h-5 w-5 group-hover:scale-110 transition-transform" />
              </a>
            </div> */}
            {/* <p className="text-xs text-muted-foreground mt-6">
              Join our community of innovators
            </p> */}
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-border/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 Floe. All rights reserved. Built with 💚 for the future of payments.
          </p>
          <div className="flex gap-6 text-xs text-muted-foreground">
            {/* <Link to="/login" className="hover:text-primary transition-colors">Privacy Policy</Link>
            <Link to="/login" className="hover:text-primary transition-colors">Terms of Service</Link>
            <Link to="/login" className="hover:text-primary transition-colors">Cookies</Link> */}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
