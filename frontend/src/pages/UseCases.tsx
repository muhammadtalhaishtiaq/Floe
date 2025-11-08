import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Home, Package, DollarSign, Building2 } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const UseCases = () => {
  const useCases = [
    {
      icon: Home,
      title: "Real Estate Rent",
      description: "Tokenize properties and automate monthly rent collection. Tenants pay on schedule, landlords receive USDC instantly.",
      example: "Monthly rent for Apartment #405 → Auto-transfer on the 1st of each month",
      gradient: "from-blue-500 to-teal"
    },
    {
      icon: Package,
      title: "Supply Chain Invoices",
      description: "Release payment automatically when goods are delivered. No more manual invoice processing or payment disputes.",
      example: "Pay supplier $5,000 → Payment releases on delivery confirmation",
      gradient: "from-teal to-emerald"
    },
    {
      icon: DollarSign,
      title: "Treasury Bonds",
      description: "Distribute yield payments to token holders on schedule. Perfect for tokenized bonds or dividend-paying assets.",
      example: "Quarterly dividend of $10K → Split automatically among 50 investors",
      gradient: "from-emerald to-lime"
    },
    {
      icon: Building2,
      title: "Commercial Leasing",
      description: "Handle complex commercial leases with base rent, CAM charges, and percentage rent—all automated.",
      example: "Office lease: $3,500/month base + $500 CAM → Auto-calculated & paid",
      gradient: "from-primary to-blue-500"
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
              Real-World Payment Automation
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              See how Floe handles recurring and conditional payments for different types of tokenized assets.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link to="/signup">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white">
                  Try the Demo
                </Button>
              </Link>
              <Link to="/features">
                <Button size="lg" variant="outline">
                  View Features
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16 bg-background">
        <div className="container px-4">
          <div className="space-y-8 max-w-5xl mx-auto">
            {useCases.map((useCase, index) => (
              <Card key={index} className="overflow-hidden hover:shadow-xl transition-shadow">
                <div className="grid md:grid-cols-5">
                  {/* Icon Section */}
                  <div className={`md:col-span-2 p-8 bg-gradient-to-br ${useCase.gradient} text-white flex flex-col justify-center`}>
                    <div className="w-16 h-16 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4">
                      <useCase.icon className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold mb-2">{useCase.title}</h2>
                    <p className="text-white/90 text-sm">{useCase.description}</p>
                  </div>

                  {/* Content Section */}
                  <div className="md:col-span-3 p-8 flex flex-col justify-center bg-background">
                    <h3 className="text-sm font-semibold text-primary uppercase tracking-wide mb-3">
                      Example Workflow
                    </h3>
                    <p className="text-lg text-foreground font-medium mb-4">
                      {useCase.example}
                    </p>
                    <div className="flex items-start gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      <span>Set up once, runs automatically on schedule or when conditions are met</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-gradient-to-b from-muted/30 to-background">
        <div className="container px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-foreground text-center mb-12">
              How Floe Works
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">1</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Create Contract</h3>
                <p className="text-sm text-muted-foreground">
                  Upload your agreement or use our AI parser to extract payment terms
                </p>
              </Card>
              <Card className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">2</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Set Schedule</h3>
                <p className="text-sm text-muted-foreground">
                  Define when and how payments should execute—recurring or conditional
                </p>
              </Card>
              <Card className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-bold text-primary">3</span>
                </div>
                <h3 className="font-semibold text-foreground mb-2">Automate</h3>
                <p className="text-sm text-muted-foreground">
                  Payments execute automatically in USDC via Circle programmable wallets
                </p>
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
              See It in Action
            </h2>
            <p className="text-muted-foreground mb-6">
              Try our demo to create your first automated payment contract
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/signup">
                <Button size="lg" className="bg-primary hover:bg-primary/90 text-white">
                  Try the Demo
                </Button>
              </Link>
              <Link to="/features">
                <Button size="lg" variant="outline">
                  Learn More
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </section>

      <Footer />
    </div>
  );
};

export default UseCases;
