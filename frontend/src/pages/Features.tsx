import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Sparkles, RefreshCw, CheckCircle, Shield, 
  Wallet, Code, Zap, FileCheck
} from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const Features = () => {
  const features = [
    {
      icon: Sparkles,
      title: "AI Contract Parser",
      description: "Upload a contract, and our AI reads it to create automated payment schedules. No coding required.",
      color: "bg-blue-500"
    },
    {
      icon: RefreshCw,
      title: "Recurring Payments",
      description: "Set up monthly rent, quarterly dividends, or custom schedules that execute automatically.",
      color: "bg-teal"
    },
    {
      icon: CheckCircle,
      title: "Conditional Triggers",
      description: "Release payments only when conditions are met—delivery confirmation, oracle data, or manual approval.",
      color: "bg-emerald"
    },
    {
      icon: Shield,
      title: "Programmable Wallets",
      description: "Built on Circle's programmable wallets with USDC on Arc blockchain for fast, secure settlement.",
      color: "bg-primary"
    },
    {
      icon: Wallet,
      title: "Multi-Wallet Management",
      description: "Create and manage multiple wallets for different assets or business units from one dashboard.",
      color: "bg-blue-600"
    },
    {
      icon: Code,
      title: "RESTful API",
      description: "Integrate Floe into your existing systems with our developer-friendly API.",
      color: "bg-cyan"
    },
    {
      icon: Zap,
      title: "Real-Time Execution",
      description: "Payments execute instantly when schedules or conditions are triggered. No delays.",
      color: "bg-teal"
    },
    {
      icon: FileCheck,
      title: "Transaction History",
      description: "View complete payment history with on-chain verification for every transaction.",
      color: "bg-emerald"
    }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-background via-muted/20 to-background pt-32 pb-16">
        <div className="container px-4">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h1 className="text-5xl md:text-6xl font-bold text-foreground">
              Payment Automation, Simplified
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Everything you need to automate USDC payments for real-world assets. 
              Built for the Circle Arc Hackathon.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link to="/signup">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white">
                  Try the Demo
                </Button>
              </Link>
              <Link to="/use-cases">
                <Button size="lg" variant="outline">
                  See Use Cases
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-16 bg-background">
        <div className="container px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-3">What We Built</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              A functional prototype demonstrating automated payment workflows for tokenized assets
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {features.map((feature, index) => (
              <Card key={index} className="p-6 hover:shadow-lg transition-shadow">
                <div className={`w-12 h-12 rounded-lg ${feature.color} flex items-center justify-center mb-4`}>
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="py-16 bg-gradient-to-b from-muted/30 to-background">
        <div className="container px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-foreground mb-8">Built With</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <Card className="p-6">
                <h4 className="font-semibold text-foreground">Circle USDC</h4>
                <p className="text-sm text-muted-foreground mt-1">Programmable Wallets</p>
              </Card>
              <Card className="p-6">
                <h4 className="font-semibold text-foreground">Arc Blockchain</h4>
                <p className="text-sm text-muted-foreground mt-1">Fast Settlement</p>
              </Card>
              <Card className="p-6">
                <h4 className="font-semibold text-foreground">React + Vite</h4>
                <p className="text-sm text-muted-foreground mt-1">Modern Frontend</p>
              </Card>
              <Card className="p-6">
                <h4 className="font-semibold text-foreground">Node.js + Express</h4>
                <p className="text-sm text-muted-foreground mt-1">Reliable Backend</p>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-background">
        <div className="container px-4">
          <Card className="max-w-3xl mx-auto p-10 text-center border-2 border-primary/20">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Ready to See It in Action?
            </h2>
            <p className="text-muted-foreground mb-6">
              Sign up to explore the demo and see how automated USDC payments work
            </p>
            <Link to="/signup">
              <Button size="lg" className="bg-primary hover:bg-primary/90 text-white">
                Try the Demo
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default Features;
