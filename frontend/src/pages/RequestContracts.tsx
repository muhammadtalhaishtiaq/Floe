import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Home, Package, DollarSign, Building2, Cog, Plus, Search, FileText, Bell, Send } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { requestCenterAPI } from "@/services/api";
import { toast } from "sonner";

const RequestContracts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sendingRequest, setSendingRequest] = useState<string | null>(null);

  // Fetch request contracts from API
  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      setIsLoading(true);
      const response = await requestCenterAPI.getContracts();
      console.log('📋 Request Contracts API Response:', response);
      setContracts(response.contracts || []);
    } catch (error: any) {
      console.error("Failed to fetch request contracts:", error);
      toast.error("Failed to load request contracts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendRequest = async (contract: any) => {
    try {
      setSendingRequest(contract.id);
      toast.info("Sending payment request...");

      const response = await requestCenterAPI.sendRequest(contract.id);
      
      if (response.success) {
        if (response.agentDecision) {
          if (response.agentDecision.approved) {
            toast.success(`✅ Request sent and APPROVED by payer's AI agent!\n\n${response.agentDecision.reasoning}`, { duration: 5000 });
          } else {
            toast.error(`❌ Request sent but REJECTED by payer's AI agent!\n\n${response.agentDecision.reasoning}`, { duration: 5000 });
          }
        } else {
          toast.success("Payment request sent successfully!");
        }
        
        // Navigate to sent requests to see the result
        setTimeout(() => {
          navigate('/request-center/sent-requests');
        }, 2000);
      } else {
        throw new Error(response.error || 'Failed to send request');
      }
    } catch (error: any) {
      console.error('Send request failed:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to send request');
    } finally {
      setSendingRequest(null);
    }
  };

  const getIconColor = (type: string) => {
    const colors = {
      lease: "from-primary to-accent",
      real_estate_rental: "from-primary to-accent",
      invoice: "from-accent to-secondary",
      invoice_payment: "from-accent to-secondary",
      bond: "from-secondary to-success",
      treasury_bond: "from-secondary to-success",
      milestone: "from-success to-primary",
      freelance_milestone: "from-success to-primary",
      sla: "from-warning to-accent",
      supply_chain: "from-warning to-accent",
      equipment_lease: "from-warning to-accent"
    };
    return colors[type as keyof typeof colors] || "from-primary to-secondary";
  };

  const getIcon = (type: string) => {
    const icons: any = {
      lease: Home,
      real_estate_rental: Home,
      invoice: Package,
      invoice_payment: Package,
      bond: DollarSign,
      treasury_bond: DollarSign,
      milestone: Building2,
      freelance_milestone: Building2,
      sla: Cog,
      supply_chain: Package,
      equipment_lease: Cog
    };
    return icons[type] || FileText;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'completed':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'paused':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'disputed':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  const filteredContracts = contracts.filter(contract => {
    // Parse raw_contract_text if it exists
    let parsedData: any = {};
    try {
      if (contract.raw_contract_text) {
        parsedData = typeof contract.raw_contract_text === 'string' 
          ? JSON.parse(contract.raw_contract_text) 
          : contract.raw_contract_text;
      }
    } catch (e) {
      console.error('Failed to parse contract data:', e);
    }

    const contractName = parsedData.contract_name || contract.asset_description || 'Unnamed Contract';
    const matchesSearch = contractName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filter === "all" || contract.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="flex items-center justify-between p-6">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                🔔 Request Center
              </h1>
              <p className="text-muted-foreground mt-1">Contracts where you request payments from others</p>
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Info Banner */}
          <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
            <div className="flex gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h4 className="font-semibold text-sm mb-1">How it works</h4>
                <p className="text-xs text-muted-foreground">
                  These are contracts where YOU receive payments. Create contracts, then send payment requests to your payers. 
                  If A2A is enabled, their AI agent will automatically evaluate and process your requests!
                </p>
              </div>
            </div>
          </Card>

          {/* Tabs */}
          <div className="flex gap-2 border-b">
            <Button
              variant="ghost"
              className="border-b-2 border-blue-500 rounded-none"
              onClick={() => {}}
            >
              📋 Request Contracts
            </Button>
            <Button
              variant="ghost"
              className="rounded-none"
              onClick={() => navigate('/request-center/sent-requests')}
            >
              📤 Sent Requests
            </Button>
          </div>

          {/* Filters and Search */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              <Input
                placeholder="Search contracts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                variant={filter === "all" ? "default" : "outline"} 
                onClick={() => setFilter("all")}
                size="sm"
              >
                All
              </Button>
              <Button 
                variant={filter === "active" ? "default" : "outline"} 
                onClick={() => setFilter("active")}
                size="sm"
              >
                Active
              </Button>
              <Button 
                variant={filter === "completed" ? "default" : "outline"} 
                onClick={() => setFilter("completed")}
                size="sm"
              >
                Completed
              </Button>
            </div>
            <Button variant="gradient" className="gap-2" onClick={() => navigate("/request-center/contracts/new")}>
              <Plus className="w-5 h-5" />
              New Request Contract
            </Button>
          </div>

          {/* Contracts Grid */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading request contracts...</p>
            </div>
          ) : filteredContracts.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredContracts.map((contract) => {
                const Icon = getIcon(contract.contract_type);
                
                // Parse raw_contract_text to get additional details
                let parsedData: any = {};
                try {
                  if (contract.raw_contract_text) {
                    parsedData = typeof contract.raw_contract_text === 'string' 
                      ? JSON.parse(contract.raw_contract_text) 
                      : contract.raw_contract_text;
                  }
                } catch (e) {
                  console.error('Failed to parse contract data:', e);
                }

                const contractName = parsedData.contract_name || contract.asset_description || 'Unnamed Contract';
                const payerAddress = parsedData.counterparty_address || contract.payer_address || 'N/A';
                const startDate = parsedData.start_date || contract.start_date;

                return (
                  <Card key={contract.id} className="p-6 hover-lift cursor-pointer border-l-4 border-l-purple-500">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getIconColor(contract.contract_type)} flex items-center justify-center mb-4`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    
                    <h3 className="text-lg font-bold mb-2 line-clamp-2">{contractName}</h3>
                    
                    <div className="flex gap-2 mb-4">
                      <Badge 
                        className={`border ${getStatusColor(contract.status)}`}
                      >
                        {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                      </Badge>
                      {contract.a2a_enabled && (
                        <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100">
                          🤖 A2A
                        </Badge>
                      )}
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-semibold">{parseFloat(contract.total_amount_usdc).toFixed(2)} USDC</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-semibold capitalize">{contract.payment_type?.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Payer</span>
                        <span className="font-semibold text-xs">
                          {payerAddress !== 'N/A' 
                            ? `${payerAddress.slice(0, 6)}...${payerAddress.slice(-4)}`
                            : 'N/A'
                          }
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={() => navigate(`/request-center/contracts/${contract.id}`)}
                      >
                        View Details
                      </Button>
                      {contract.status === "active" && (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSendRequest(contract);
                          }}
                          disabled={sendingRequest === contract.id || !contract.a2a_enabled}
                          title={!contract.a2a_enabled ? "Enable A2A first" : ""}
                        >
                          {sendingRequest === contract.id ? (
                            <>⏳ Sending...</>
                          ) : (
                            <>
                              <Send className="w-4 h-4 mr-1" />
                              {contract.a2a_enabled ? "Send Request" : "A2A Required"}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-2xl font-bold mb-2">No request contracts found</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? "Try adjusting your search" : "Create your first request contract to start receiving payments"}
              </p>
              <Button variant="gradient" className="gap-2" onClick={() => navigate("/request-center/contracts/new")}>
                <Plus className="w-5 h-5" />
                Create Request Contract
              </Button>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default RequestContracts;

