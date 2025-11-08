import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Home, Package, DollarSign, Building2, Cog } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { toast } from "sonner";
import { contractsAPI, walletsAPI } from "@/services/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const RequestContractNew = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [userWallets, setUserWallets] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    contract_type: "",
    contract_name: "",
    description: "",
    payer_address: "", // The person who will PAY you
    amount_usdc: "",
    payment_frequency: "",
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    fetchUserWallets();
  }, []);

  const fetchUserWallets = async () => {
    try {
      const response = await walletsAPI.getMy();
      if (response.success && response.wallets) {
        setUserWallets(response.wallets);
      }
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get receiver wallet from localStorage
    const receiver_wallet_address = localStorage.getItem('receiver_wallet_address');
    
    if (!receiver_wallet_address) {
      toast.error("❌ Please set your receiving wallet in Request Center first!");
      navigate('/request-center');
      return;
    }
    
    if (!formData.contract_type || !formData.amount_usdc || !formData.payer_address) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (userWallets.length === 0) {
      toast.error("You need at least one wallet to create a contract");
      return;
    }

    setIsLoading(true);

    try {
      // Create contract where YOU are the PAYEE (receiver)
      const contractData = {
        // Backend expects these fields at root level
        contract_type: formData.contract_type,
        contract_name: formData.contract_name || `${formData.contract_type} Payment`,
        description: formData.description || '',
        counterparty_name: 'Payer', // Just a placeholder
        counterparty_address: formData.payer_address, // Person who will pay
        receiver_wallet_address: receiver_wallet_address, // From global settings
        amount_usdc: parseFloat(formData.amount_usdc),
        payment_frequency: formData.payment_frequency,
        start_date: formData.start_date || new Date().toISOString().split('T')[0],
        end_date: formData.end_date || null,
        payment_day_of_month: null,
        is_request_contract: true // IMPORTANT: Flag this as a request contract
      };

      console.log('📤 Creating request contract:', contractData);

      const response = await contractsAPI.create(contractData);

      if (response.success) {
        toast.success("Request contract created successfully! 🎉");
        navigate('/request-center/contracts');
      } else {
        throw new Error(response.error || 'Failed to create contract');
      }
    } catch (error: any) {
      console.error('Contract creation error:', error);
      toast.error(error.response?.data?.error || error.message || 'Failed to create contract');
    } finally {
      setIsLoading(false);
    }
  };

  const contractTypes = [
    { value: "real_estate_rental", label: "🏠 Real Estate Rental", icon: Home },
    { value: "invoice_payment", label: "📦 Invoice Payment", icon: Package },
    { value: "treasury_bond", label: "💰 Treasury Bond", icon: DollarSign },
    { value: "freelance_milestone", label: "🏗️ Freelance Milestone", icon: Building2 },
    { value: "equipment_lease", label: "⚙️ Equipment Lease", icon: Cog },
  ];

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="p-6">
            <Button
              variant="ghost"
              size="sm"
              className="mb-2"
              onClick={() => navigate('/request-center/contracts')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Request Contracts
            </Button>
            <h1 className="text-3xl font-bold">Create Request Contract</h1>
            <p className="text-muted-foreground mt-1">
              Create a contract where you RECEIVE payments from others
            </p>
          </div>
        </header>

        <div className="p-6">
          <Card className="max-w-2xl mx-auto p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 mb-6">
            <div className="flex gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h4 className="font-semibold text-sm mb-1">You are the PAYEE (Receiver)</h4>
                <p className="text-xs text-muted-foreground">
                  This contract is for payments YOU will receive. The payer address is the wallet that will send you money.
                </p>
              </div>
            </div>
          </Card>

          <Card className="max-w-2xl mx-auto p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Contract Type */}
              <div className="space-y-2">
                <Label htmlFor="contract_type">Contract Type *</Label>
                <Select
                  value={formData.contract_type}
                  onValueChange={(value) => setFormData({ ...formData, contract_type: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contract type" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractTypes.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contract Name */}
              <div className="space-y-2">
                <Label htmlFor="contract_name">Contract Name</Label>
                <Input
                  id="contract_name"
                  placeholder="e.g., Monthly Rent from Tenant"
                  value={formData.contract_name}
                  onChange={(e) => setFormData({ ...formData, contract_name: e.target.value })}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this payment is for..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              {/* Payer Address */}
              <div className="space-y-2">
                <Label htmlFor="payer_address">Payer Wallet Address (FROM) *</Label>
                <Select
                  value={formData.payer_address}
                  onValueChange={(value) => setFormData({ ...formData, payer_address: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select wallet that will send you money" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">
                      ✍️ Enter manually (external wallet)
                    </SelectItem>
                    {userWallets.map((wallet) => (
                      <SelectItem key={wallet.id} value={wallet.address}>
                        💼 {wallet.name || "My Wallet"} ({wallet.address.slice(0, 6)}...{wallet.address.slice(-4)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.payer_address === 'manual' && (
                  <Input
                    className="mt-2"
                    placeholder="0x... (enter wallet address)"
                    value={formData.payer_address === 'manual' ? '' : formData.payer_address}
                    onChange={(e) => setFormData({ ...formData, payer_address: e.target.value })}
                  />
                )}
                <p className="text-xs text-muted-foreground">
                  💸 Money will be SENT FROM this wallet (tenant/payer)
                </p>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount_usdc">Amount (USDC) *</Label>
                <Input
                  id="amount_usdc"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount_usdc}
                  onChange={(e) => setFormData({ ...formData, amount_usdc: e.target.value })}
                />
              </div>

              {/* Payment Frequency */}
              <div className="space-y-2">
                <Label htmlFor="payment_frequency">Payment Type *</Label>
                <Select
                  value={formData.payment_frequency}
                  onValueChange={(value) => setFormData({ ...formData, payment_frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="one_time">One-time</SelectItem>
                    <SelectItem value="monthly">Recurring - Monthly</SelectItem>
                    <SelectItem value="quarterly">Recurring - Quarterly</SelectItem>
                    <SelectItem value="annual">Recurring - Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="end_date">End Date (Optional)</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => navigate('/request-center/contracts')}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600"
                  disabled={isLoading}
                >
                  {isLoading ? "Creating..." : "Create Request Contract"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default RequestContractNew;

