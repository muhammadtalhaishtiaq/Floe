import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, Search, Download, Calendar, ArrowUpRight, ArrowDownLeft,
  Filter, Bell, FileText, ExternalLink, Loader2
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { paymentsAPI } from "@/services/api";
import { toast } from "sonner";

const Payments = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch ALL transactions (from Circle + our DB)
  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await paymentsAPI.getAllTransactions();
        console.log('💰 All Transactions API Response:', response);
        console.log('📊 Total transactions:', response.count);
        setPayments(response.transactions || []);
      } catch (error: any) {
        console.error("Failed to fetch payments:", error);
        toast.error("Failed to load payments");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayments();
  }, []);

  // Calculate stats from real data
  const totalPaid = payments
    .filter(p => (p.type === 'OUTBOUND' || p.type === 'manual' || p.type === 'automated') && (p.status === 'confirmed' || p.status === 'complete'))
    .reduce((sum, p) => sum + parseFloat(p.amount_usdc || 0), 0);

  const totalReceived = payments
    .filter(p => p.type === 'INBOUND' && (p.status === 'confirmed' || p.status === 'complete'))
    .reduce((sum, p) => sum + parseFloat(p.amount_usdc || 0), 0);

  const upcoming = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => sum + parseFloat(p.amount_usdc || 0), 0);

  const filteredPayments = payments.filter(payment => {
    const contractName = payment.asset_description || payment.contract_type || '';
    const matchesSearch = 
      contractName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (payment.from_wallet || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (payment.to_wallet || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || payment.status.toLowerCase() === statusFilter;
    const matchesType = typeFilter === "all" || payment.type.toLowerCase() === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "confirmed":
      case "completed": 
      case "complete": 
        return "default";
      case "pending": 
      case "scheduled": 
        return "secondary";
      case "failed": 
        return "destructive";
      case "cancelled": 
        return "outline";
      default: 
        return "secondary";
    }
  };

  const getBlockchainExplorer = (txHash: string) => {
    const network = import.meta.env.VITE_BLOCKCHAIN_NETWORK || 'ARC-TESTNET';
    if (network === 'ARC-TESTNET') {
      return `https://testnet.arcscan.app/tx/${txHash}`;
    } else if (network === 'MATIC-AMOY') {
      return `https://amoy.polygonscan.app/tx/${txHash}`;
    }
    return `https://sepolia.etherscan.app/tx/${txHash}`;
  };

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
              <h1 className="text-3xl font-bold">Payments</h1>
              <p className="text-muted-foreground mt-1">Track and manage all your USDC transactions</p>
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
                <ArrowUpRight className="w-5 h-5 text-destructive" />
              </div>
              <p className="text-3xl font-bold">{totalPaid.toFixed(2)} USDC</p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Total Received</p>
                <ArrowDownLeft className="w-5 h-5 text-success" />
              </div>
              <p className="text-3xl font-bold">{totalReceived.toFixed(2)} USDC</p>
              <p className="text-xs text-muted-foreground mt-1">All time</p>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-muted-foreground">Pending</p>
                <Calendar className="w-5 h-5 text-warning" />
              </div>
              <p className="text-3xl font-bold">{upcoming.toFixed(2)} USDC</p>
              <p className="text-xs text-muted-foreground mt-1">In progress</p>
            </Card>
          </div>

          {/* Filters */}
          <Card className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  placeholder="Search payments..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-full lg:w-48">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="automated">Automated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </Card>

          {/* Payments Table */}
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border">
                  <tr className="text-left">
                    <th className="p-4 text-sm font-semibold">Date</th>
                    <th className="p-4 text-sm font-semibold">Contract</th>
                    <th className="p-4 text-sm font-semibold">From → To</th>
                    <th className="p-4 text-sm font-semibold">Amount</th>
                    <th className="p-4 text-sm font-semibold">Type</th>
                    <th className="p-4 text-sm font-semibold">Status</th>
                    <th className="p-4 text-sm font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center">
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Loading payments...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPayments.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-muted-foreground">
                        No payments found
                      </td>
                    </tr>
                  ) : (
                    filteredPayments.map((payment) => (
                      <tr key={payment.id} className="border-b border-border hover:bg-muted/50 transition-colors">
                        <td className="p-4 text-sm">
                          {new Date(payment.executed_at).toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2">
                            {payment.type === 'INBOUND' ? (
                              <ArrowDownLeft className="w-4 h-4 text-success" />
                            ) : (
                              <ArrowUpRight className="w-4 h-4 text-destructive" />
                            )}
                            <span className="font-medium">
                              {payment.asset_description || payment.contract_type || payment.wallet_name || 'Direct Transfer'}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="truncate max-w-[100px] font-mono text-xs">
                              {(payment.source_address || payment.from_wallet)?.substring(0, 6)}...{(payment.source_address || payment.from_wallet)?.substring(38)}
                            </span>
                            <span className="text-muted-foreground">→</span>
                            <span className="truncate max-w-[100px] font-mono text-xs">
                              {(payment.destination_address || payment.to_wallet)?.substring(0, 6)}...{(payment.destination_address || payment.to_wallet)?.substring(38)}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex items-center gap-1">
                            {payment.type === 'INBOUND' ? (
                              <span className="text-success font-bold">+{parseFloat(payment.amount_usdc).toFixed(2)}</span>
                            ) : (
                              <span className="text-destructive font-bold">-{parseFloat(payment.amount_usdc).toFixed(2)}</span>
                            )}
                            <span className="text-xs text-muted-foreground">USDC</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="capitalize">
                            {payment.type === 'INBOUND' ? 'Received' : payment.type === 'OUTBOUND' ? 'Sent' : payment.type}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <Badge variant={getStatusColor(payment.status)} className="capitalize">
                            {payment.status}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex gap-2">
                            {payment.tx_hash && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => window.open(getBlockchainExplorer(payment.tx_hash), '_blank')}
                                className="gap-1"
                              >
                                <ExternalLink className="w-3 h-3" />
                                View
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Payments;
