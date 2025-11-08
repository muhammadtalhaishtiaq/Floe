import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Home, Package, DollarSign, Building2, Cog, Plus, Search, FileText, Bell } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { contractsAPI, paymentsAPI } from "@/services/api";
import { toast } from "sonner";
import { PaymentDialog } from "@/components/PaymentDialog";

const Contracts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [selectedContract, setSelectedContract] = useState<any>(null);

  // Fetch contracts from API
  useEffect(() => {
    fetchContracts();
  }, []);

  const fetchContracts = async () => {
    try {
      const response = await contractsAPI.getAll();
      console.log('📋 Contracts API Response:', response);
      console.log('📊 Contracts data:', response.contracts);
      
      // For each contract, check payment status and update if needed
      const contractsWithUpdatedStatus = await Promise.all(
        (response.contracts || []).map(async (contract: any) => {
          // Only check one-time payment contracts that are still active
          if (contract.payment_type === 'one_time' && contract.status === 'active') {
            try {
              // Fetch payment history for this contract
              const paymentsResponse = await paymentsAPI.getHistory({ contractId: contract.id });
              const payments = paymentsResponse.transactions || [];
              
              // Check if there's a completed payment
              const hasCompletedPayment = payments.some(
                (tx: any) => tx.status === 'confirmed' || tx.status === 'complete'
              );
              
              if (hasCompletedPayment) {
                // Update contract status to completed
                await contractsAPI.updateStatus(contract.id, 'completed');
                return { ...contract, status: 'completed' };
              }
            } catch (error) {
              console.error(`Failed to check payments for contract ${contract.id}:`, error);
            }
          }
          return contract;
        })
      );
      
      setContracts(contractsWithUpdatedStatus);
    } catch (error: any) {
      console.error("Failed to fetch contracts:", error);
      toast.error("Failed to load contracts");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayNow = (contract: any) => {
    setSelectedContract(contract);
    setShowPaymentDialog(true);
  };

  const handleExecutePayment = async (walletId: string, walletAddress: string) => {
    if (!selectedContract) return;

    try {
      // Parse contract data to get recipient address
      let parsedData: any = {};
      try {
        if (selectedContract.raw_contract_text) {
          parsedData = typeof selectedContract.raw_contract_text === 'string' 
            ? JSON.parse(selectedContract.raw_contract_text) 
            : selectedContract.raw_contract_text;
        }
      } catch (e) {
        console.error('Failed to parse contract data:', e);
      }

      const recipientAddress = parsedData.counterparty_address;
      if (!recipientAddress) {
        throw new Error('Recipient address not found');
      }

      // Execute payment
      const response = await paymentsAPI.execute({
        sourceWalletId: walletId,
        destinationWalletId: recipientAddress,
        amount: selectedContract.total_amount_usdc,
        contractId: selectedContract.id,
        metadata: {
          contractName: parsedData.contract_name || selectedContract.asset_description,
          contractType: selectedContract.contract_type,
          paymentType: selectedContract.payment_type
        }
      });

      if (response.success) {
        toast.success('Payment initiated successfully! 🎉');
        // Refresh contracts list
        await fetchContracts();
      } else {
        throw new Error(response.error || 'Payment failed');
      }
    } catch (error: any) {
      console.error('Payment execution failed:', error);
      throw error;
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
              <h1 className="text-3xl font-bold">RWA Contracts</h1>
              <p className="text-muted-foreground mt-1">Manage your automated payment contracts</p>
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
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
                variant={filter === "paused" ? "default" : "outline"} 
                onClick={() => setFilter("paused")}
                size="sm"
              >
                Paused
              </Button>
              <Button 
                variant={filter === "completed" ? "default" : "outline"} 
                onClick={() => setFilter("completed")}
                size="sm"
              >
                Completed
              </Button>
              <Button 
                variant={filter === "cancelled" ? "default" : "outline"} 
                onClick={() => setFilter("cancelled")}
                size="sm"
              >
                Cancelled
              </Button>
            </div>
            <Button variant="gradient" className="gap-2" onClick={() => navigate("/contracts/new")}>
              <Plus className="w-5 h-5" />
              New Contract
            </Button>
          </div>

          {/* Contracts Grid */}
          {isLoading ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">Loading contracts...</p>
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
                const counterpartyAddress = parsedData.counterparty_address || 'N/A';
                const startDate = parsedData.start_date || contract.start_date;
                
                // Debug logging
                if (!startDate) {
                  console.warn('⚠️ Missing start_date for contract:', {
                    id: contract.id,
                    parsedData_start_date: parsedData.start_date,
                    contract_start_date: contract.start_date,
                    raw_contract_text: contract.raw_contract_text
                  });
                }

                return (
                  <Card key={contract.id} className="p-6 hover-lift cursor-pointer">
                    <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${getIconColor(contract.contract_type)} flex items-center justify-center mb-4`}>
                      <Icon className="w-8 h-8 text-white" />
                    </div>
                    
                    <h3 className="text-lg font-bold mb-2 line-clamp-2">{contractName}</h3>
                    
                    <Badge 
                      className={`mb-4 border ${getStatusColor(contract.status)}`}
                    >
                      {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                    </Badge>

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
                        <span className="text-muted-foreground">Start Date</span>
                        <span className="font-semibold">{startDate ? new Date(startDate).toLocaleDateString() : 'Not set'}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Recipient</span>
                        <span className="font-semibold text-xs">
                          {counterpartyAddress !== 'N/A' 
                            ? `${counterpartyAddress.slice(0, 6)}...${counterpartyAddress.slice(-4)}`
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
                        onClick={() => navigate(`/contracts/${contract.id}`)}
                      >
                        View Details
                      </Button>
                      {contract.status === "active" && (
                        <Button 
                          variant="default" 
                          size="sm" 
                          className="flex-1"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePayNow(contract);
                          }}
                        >
                          Pay Now
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
              <h3 className="text-2xl font-bold mb-2">No contracts found</h3>
              <p className="text-muted-foreground mb-6">
                {searchQuery ? "Try adjusting your search" : "Create your first RWA contract to start automating payments"}
              </p>
              <Button variant="gradient" className="gap-2">
                <Plus className="w-5 h-5" />
                Create Contract
              </Button>
            </Card>
          )}
        </div>
      </main>

      {/* Payment Dialog */}
      {selectedContract && (
        <PaymentDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          contract={selectedContract}
          onExecute={handleExecutePayment}
          onPaymentSuccess={() => {
            fetchContracts();
          }}
        />
      )}
    </div>
  );
};

export default Contracts;
