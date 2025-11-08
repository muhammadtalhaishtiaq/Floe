import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Sparkles, RefreshCw, CheckCircle, Shield, Home, Package, DollarSign } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Index = () => {
  const features = [
    {
      icon: Sparkles,
      title: "AI Contract Parser",
      description: "Natural language → automated schedules"
    },
    {
      icon: RefreshCw,
      title: "Recurring Payments",
      description: "Set it and forget it automation"
    },
    {
      icon: CheckCircle,
      title: "Conditional Release",
      description: "Pay on delivery confirmation"
    },
    {
      icon: Shield,
      title: "Circle Wallets",
      description: "Secure USDC on Arc blockchain"
    }
  ];

  const useCases = [
    {
      icon: Home,
      title: "Real Estate",
      description: "Automated monthly rent payments for tokenized properties",
      gradient: "from-primary to-accent"
    },
    {
      icon: Package,
      title: "Supply Chain",
      description: "Payment on delivery confirmation for invoices",
      gradient: "from-accent to-secondary"
    },
    {
      icon: DollarSign,
      title: "Treasury Bonds",
      description: "Scheduled yield payouts for digital assets",
      gradient: "from-secondary to-primary"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Hero Section - TRANSFORMED with Mesh Gradient */}
      <section className="relative overflow-hidden mesh-gradient-bg py-16 md:py-24">
        {/* Animated Grid Overlay */}
        <div className="absolute inset-0 bg-grid-white/10 bg-[size:20px_20px] opacity-40" />
        
        {/* Floating Geometric Shapes */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-cyan/20 rounded-full blur-3xl animate-float-slow opacity-60" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal/20 rounded-full blur-3xl animate-float-medium opacity-60" />
        <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-emerald/10 rounded-full blur-3xl animate-float opacity-50" />
        
        <div className="container px-4 relative z-10">
          <div className="max-w-5xl mx-auto text-center space-y-8">
            {/* Hero Headline */}
            <div className="space-y-4 animate-fade-in">
              <h1 className="text-5xl md:text-6xl font-black leading-tight text-white">
                Smooth Payment <span className="shimmer-text">Automation</span><br/>
                for Real-World Assets
              </h1>
              <p className="text-lg md:text-xl text-white/95 max-w-2xl mx-auto">
                See how it works in seconds with USDC on Arc
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/signup">
                <Button 
                  size="lg" 
                  className="w-full sm:w-auto bg-white text-emerald hover:bg-white/95 shadow-2xl hover:shadow-glow hover:scale-105 transition-all duration-300 px-8 py-6 font-bold"
                >
                  Get Started →
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full sm:w-auto glass-light text-white border-2 border-white/40 hover:border-white/60 hover:bg-white/20 backdrop-blur-md px-8 py-6 font-semibold transition-all duration-300"
              >
                Watch Demo ▶
              </Button>
            </div>

            {/* Terminal Window - More Compact */}
            <div className="max-w-3xl mx-auto pt-4 animate-slide-up">
              <div className="bg-slate-900/90 backdrop-blur-xl rounded-xl overflow-hidden shadow-2xl border border-white/10">
                {/* Terminal Header */}
                <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/80 border-b border-white/10">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
                  </div>
                  <span className="text-white/60 text-xs ml-3 font-mono">floe-cli</span>
                </div>
                
                {/* Terminal Body - Reduced Padding */}
                <div className="p-5 font-mono text-xs md:text-sm space-y-2">
                  <div className="flex items-start gap-2 opacity-0 animate-fade-in" style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}>
                    <span className="text-teal shrink-0">$</span>
                    <span className="text-white">floe create-contract --type "real-estate-rent"</span>
                  </div>
                  
                  <div className="flex items-start gap-2 opacity-0 animate-fade-in" style={{ animationDelay: '1s', animationFillMode: 'forwards' }}>
                    <span className="text-emerald shrink-0">✓</span>
                    <span className="text-white/90">Contract parsed: Apartment #405</span>
                  </div>
                  
                  <div className="flex items-start gap-2 opacity-0 animate-fade-in" style={{ animationDelay: '1.5s', animationFillMode: 'forwards' }}>
                    <span className="text-emerald shrink-0">✓</span>
                    <span className="text-white/90">Monthly payment: 1,200 USDC</span>
                  </div>
                  
                  <div className="flex items-start gap-2 opacity-0 animate-fade-in" style={{ animationDelay: '2s', animationFillMode: 'forwards' }}>
                    <span className="text-emerald shrink-0">✓</span>
                    <span className="text-white/90">Schedule: 1st of every month</span>
                  </div>
                  
                  <div className="flex items-start gap-2 opacity-0 animate-fade-in" style={{ animationDelay: '2.5s', animationFillMode: 'forwards' }}>
                    <span className="text-lime shrink-0">→</span>
                    <span className="text-white/90">Executing on Arc blockchain...</span>
                  </div>
                  
                  <div className="flex items-start gap-2 opacity-0 animate-fade-in" style={{ animationDelay: '3s', animationFillMode: 'forwards' }}>
                    <span className="text-emerald shrink-0">✓</span>
                    <span className="text-white font-semibold">Payment sent! Tx: 0x8f3e...9c2d</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Stats Row - More Compact */}
            <div className="flex flex-wrap gap-8 justify-center pt-6 border-t border-white/20 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-3xl font-bold text-white">$2M+</div>
                <div className="text-xs text-white/70">Automated</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">5+</div>
                <div className="text-xs text-white/70">Use Cases</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-white">Sub-Second</div>
                <div className="text-xs text-white/70">Settlement</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section - ENHANCED with Glassmorphism */}
      <section id="features" className="py-20 md:py-32 bg-gradient-to-b from-background to-muted/30 relative">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] opacity-30" />
        
        <div className="container px-4 relative">
          <div className="text-center mb-16 space-y-4 animate-fade-in">
            <h2 className="text-4xl md:text-6xl font-black tracking-tight">
              Powerful Automation
              <span className="block gradient-text">Features</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Enterprise-grade tools for seamless payment automation
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => {
              const glowColors = ['glow-navy', 'glow-cyan', 'glow-emerald', 'glow-lime'];
              const bgColors = ['from-navy to-ocean', 'from-ocean to-cyan', 'from-cyan to-teal', 'from-teal to-emerald'];
              
              return (
                <Card 
                  key={index} 
                  className="group relative p-8 hover-lift cursor-pointer animate-scale-in border-2 border-border/50 hover:border-primary/50 transition-all duration-300 bg-gradient-card overflow-hidden"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  {/* Hover Glow Effect */}
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${glowColors[index]} -z-10`} />
                  
                  {/* Icon with Gradient Background */}
                  <div className={`relative w-16 h-16 rounded-2xl bg-gradient-to-br ${bgColors[index]} flex items-center justify-center mb-6 shadow-lg group-hover:scale-110 group-hover:rotate-3 transition-all duration-300`}>
                    <feature.icon className="w-8 h-8 text-white relative z-10" />
                    <div className="absolute inset-0 bg-white/20 rounded-2xl animate-glow-pulse" />
                  </div>
                  
                  <h3 className="text-xl font-bold mb-3 group-hover:text-primary transition-colors">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                  
                  {/* Bottom Accent Line */}
                  <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${bgColors[index]} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`} />
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Use Cases Section - ENHANCED with Immersive Gradients */}
      <section id="use-cases" className="py-20 md:py-32 relative overflow-hidden">
        {/* Ambient Background */}
        <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-muted/30" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-teal/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-emerald/10 rounded-full blur-3xl opacity-50" />
        
        <div className="container px-4 relative">
          <div className="text-center mb-20 space-y-6">
            <h2 className="text-4xl md:text-6xl font-black tracking-tight">
              Built for 
              <span className="block gradient-text mt-2">Real-World Assets</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Trusted solutions across industries, powering the future of asset payments
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-10">
            {useCases.map((useCase, index) => (
              <Card 
                key={index} 
                className="group relative overflow-hidden hover-lift cursor-pointer border-2 border-border/50 hover:border-primary/50 transition-all duration-500 bg-card"
              >
                {/* Enhanced Gradient Header */}
                <div className={`relative h-48 bg-gradient-to-br ${useCase.gradient} flex items-center justify-center overflow-hidden`}>
                  {/* Pattern Overlay */}
                  <div className="absolute inset-0 bg-grid-white/5 bg-[size:20px_20px]" />
                  
                  {/* Icon with White Circle Background */}
                  <div className="relative w-24 h-24 rounded-full bg-white shadow-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <useCase.icon className={`w-12 h-12 text-primary`} />
                  </div>
                  
                  {/* Bottom Wave Effect */}
                  <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-card/50 to-transparent" />
                </div>
                
                <div className="p-8">
                  <h3 className="text-2xl font-bold mb-4 group-hover:gradient-text transition-all">{useCase.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{useCase.description}</p>
                  
                  {/* Learn More Link */}
                  <div className="mt-6 flex items-center text-primary font-semibold group-hover:translate-x-2 transition-transform">
                    Learn more
                    <span className="ml-2">→</span>
                  </div>
                </div>
                
                {/* Hover Glow Border Effect */}
                <div className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-glow -z-10" />
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section - ENHANCED with Gradient and Depth */}
      <section className="relative py-24 md:py-40 overflow-hidden">
        {/* Dynamic Gradient Background */}
        <div className="absolute inset-0 mesh-gradient-bg" />
        <div className="absolute inset-0 bg-gradient-to-t from-navy/50 to-transparent" />
        
        {/* Floating Elements */}
        <div className="absolute top-20 right-20 w-64 h-64 bg-yellow/20 rounded-full blur-3xl animate-float opacity-40" />
        <div className="absolute bottom-20 left-20 w-80 h-80 bg-lime/20 rounded-full blur-3xl animate-float-medium opacity-40" />
        
        <div className="container px-4 text-center text-white space-y-10 relative z-10">
          <div className="space-y-6 animate-slide-up">
            <h2 className="text-4xl md:text-6xl font-black leading-tight">
              Start Automating
              <span className="block shimmer-text mt-2">Payments Today</span>
            </h2>
            <p className="text-xl md:text-2xl text-white/95 max-w-3xl mx-auto leading-relaxed">
              Join the future of payment automation. Free testnet access • No credit card required
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center pt-8">
            <Link to="/signup">
              <Button 
                size="lg" 
                className="bg-white text-emerald hover:bg-white/95 shadow-2xl hover:shadow-glow hover:scale-105 transition-all duration-300 text-xl px-12 py-7 font-bold"
              >
                Get Started Free
                <span className="ml-2">→</span>
              </Button>
            </Link>
            <Button 
              variant="outline" 
              size="lg" 
              className="glass-light text-white border-2 border-white/40 hover:border-white/70 hover:bg-white/20 backdrop-blur-md text-xl px-12 py-7 font-semibold"
            >
              Schedule Demo
            </Button>
          </div>
          
          {/* Trust Indicators */}
          <div className="flex flex-wrap justify-center gap-12 pt-16 border-t border-white/20 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">⚡</div>
              <div className="text-white/80 text-sm">Instant Settlement</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">🔒</div>
              <div className="text-white/80 text-sm">Bank-Grade Security</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">🤖</div>
              <div className="text-white/80 text-sm">AI-Powered</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">🌐</div>
              <div className="text-white/80 text-sm">Global USDC</div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Index;
