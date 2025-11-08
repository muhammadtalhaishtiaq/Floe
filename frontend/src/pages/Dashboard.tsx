import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, DollarSign, Calendar, TrendingUp, 
  ArrowUpRight, ArrowDownLeft, Loader2, Wallet, Plus
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { contractsAPI, paymentsAPI, walletsAPI, a2aAPI } from "@/services/api";
import { toast } from "sonner";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [contracts, setContracts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [a2aStats, setA2AStats] = useState({
    pendingRequests: 0,
    approvedToday: 0,
    activeAgents: 0
  });

  // Fetch real data on mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        // Fetch contracts
        const contractsRes = await contractsAPI.getAll();
        setContracts(contractsRes.contracts || []);

        // Fetch all transactions
        const transactionsRes = await paymentsAPI.getAllTransactions();
        setTransactions(transactionsRes.transactions || []);

        // Fetch A2A stats
        try {
          const a2aRes = await a2aAPI.getRequests('pending', 100);
          const pendingCount = a2aRes.requests?.filter((r: any) => r.status === 'pending').length || 0;
          
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const approvedTodayCount = a2aRes.requests?.filter((r: any) => 
            r.status === 'approved' && new Date(r.updated_at) >= todayStart
          ).length || 0;
          
          const activeAgentCount = contractsRes.contracts?.filter((c: any) => c.a2a_enabled).length || 0;
          
          setA2AStats({
            pendingRequests: pendingCount,
            approvedToday: approvedTodayCount,
            activeAgents: activeAgentCount
          });
        } catch (a2aError) {
          console.log('A2A stats not available');
        }

        // Fetch wallet balance and calculate from transactions
        try {
          const walletsRes = await walletsAPI.getMy();
          const wallets = walletsRes.wallets || [];
          
          // Calculate balance for each wallet from transactions
          let totalBalance = 0;
          for (const wallet of wallets) {
            try {
              const txResponse = await walletsAPI.getTransactions(wallet.id, 100);
              const walletTransactions = txResponse.transactions || [];
              
              // Calculate balance: received - sent (only complete transactions)
              let walletBalance = 0;
              walletTransactions.forEach((tx: any) => {
                if (tx.status === 'complete') {
                  const amount = parseFloat(tx.amount || 0);
                  if (tx.type === 'received') {
                    walletBalance += amount;
                  } else if (tx.type === 'sent') {
                    walletBalance -= amount;
                  }
                }
              });
              
              totalBalance += walletBalance;
            } catch (error) {
              console.log(`Failed to fetch transactions for wallet ${wallet.id}`);
            }
          }
          
          setWalletBalance(totalBalance);
          console.log('💰 Total wallet balance:', totalBalance);
        } catch (error) {
          console.log('No wallets yet');
        }
      } catch (error: any) {
        console.error("Failed to fetch dashboard data:", error);
        toast.error("Failed to load dashboard data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Calculate real stats
  const activeContracts = contracts.filter(c => c.status === 'active').length;
  const completedContracts = contracts.filter(c => c.status === 'completed').length;
  const totalContractValue = contracts.reduce((sum, c) => sum + parseFloat(c.total_amount_usdc || 0), 0);

  const totalPaid = transactions
    .filter(t => (t.type === 'OUTBOUND' || t.type === 'manual' || t.type === 'automated') && (t.status === 'confirmed' || t.status === 'complete'))
    .reduce((sum, t) => sum + parseFloat(t.amount_usdc || 0), 0);

  const totalReceived = transactions
    .filter(t => t.type === 'INBOUND' && (t.status === 'confirmed' || t.status === 'complete'))
    .reduce((sum, t) => sum + parseFloat(t.amount_usdc || 0), 0);

  const pendingPayments = transactions
    .filter(t => t.status === 'pending')
    .reduce((sum, t) => sum + parseFloat(t.amount_usdc || 0), 0);

  const stats = [
    { 
      label: "Active Contracts", 
      value: isLoading ? "..." : activeContracts.toString(), 
      change: `${completedContracts} completed`, 
      icon: FileText,
      iconColor: "bg-blue-500",
      textColor: "text-blue-500"
    },
    { 
      label: "Wallet Balance", 
      value: isLoading ? "..." : `${walletBalance.toFixed(2)} USDC`, 
      change: `${pendingPayments.toFixed(2)} pending`, 
      icon: Wallet,
      iconColor: "bg-teal",
      textColor: "text-teal"
    },
    { 
      label: "Total Paid", 
      value: isLoading ? "..." : `${totalPaid.toFixed(2)} USDC`, 
      change: "All time", 
      icon: TrendingUp,
      iconColor: "bg-emerald",
      textColor: "text-emerald"
    },
    { 
      label: "Total Received", 
      value: isLoading ? "..." : `${totalReceived.toFixed(2)} USDC`, 
      change: "All time", 
      icon: DollarSign,
      iconColor: "bg-primary",
      textColor: "text-primary"
    }
  ];

  // Get recent active contracts
  const recentActiveContracts = contracts
    .filter(c => c.status === 'active')
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  // Get recent transactions (last 4)
  const recentTransactions = transactions
    .sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())
    .slice(0, 4);

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="flex items-center justify-between p-6">
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                Welcome back, {user?.full_name}!
              </h1>
              <p className="text-muted-foreground mt-1 text-sm">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })} at {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
           
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="p-6 hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-4">
                  <div className={`w-12 h-12 rounded-lg ${stat.iconColor} flex items-center justify-center`}>
                    <stat.icon className="w-6 h-6 text-white" />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-3xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
                  <p className={`text-xs font-medium ${stat.textColor}`}>{stat.change}</p>
                </div>
              </Card>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/contracts/new')}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center">
                  <Plus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Create Contract</p>
                  <p className="text-sm text-muted-foreground">Start a new payment agreement</p>
                </div>
              </div>
            </Card>
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/wallets')}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-teal flex items-center justify-center">
                  <Wallet className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Manage Wallets</p>
                  <p className="text-sm text-muted-foreground">View and create wallets</p>
                </div>
              </div>
            </Card>
            <Card className="p-6 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigate('/payments')}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-emerald flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">View Payments</p>
                  <p className="text-sm text-muted-foreground">Track all transactions</p>
                </div>
              </div>
            </Card>
          </div>

          {/* A2A Agent-to-Agent Payments Widget */}
          <Card className="p-6 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center">
                  <span className="text-2xl">🤖</span>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">A2A Autonomous Payments</h2>
                  <p className="text-sm text-muted-foreground">AI agents handling your payments</p>
                </div>
              </div>
              <Link to="/a2a">
                <Button variant="outline" size="sm" className="gap-1">
                  View All
                  <ArrowUpRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>

            {/* Mock Stats */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{a2aStats.pendingRequests}</p>
                <p className="text-xs text-muted-foreground mt-1">Pending Requests</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{a2aStats.approvedToday}</p>
                <p className="text-xs text-muted-foreground mt-1">Approved Today</p>
              </div>
              <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{a2aStats.activeAgents}</p>
                <p className="text-xs text-muted-foreground mt-1">Active Agents</p>
              </div>
            </div>

            {/* Recent Activity Mock */}
            <div className="bg-white/50 dark:bg-gray-800/50 p-4 rounded-lg border border-dashed">
              <p className="text-sm font-semibold text-muted-foreground mb-2">📜 Recent Agent Activity</p>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">No activity yet</span>
                  <span className="text-muted-foreground">Enable A2A on contracts to see activity</span>
                </div>
              </div>
            </div>

            {/* CTA */}
            <div className="mt-4 text-center">
              <Link to="/contracts">
                <Button className="bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white" size="sm">
                  🤖 Enable A2A on Contracts
                </Button>
              </Link>
            </div>
          </Card>

          {/* Active Contracts */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Active Contracts</h2>
              <Link to="/contracts">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentActiveContracts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No active contracts yet</p>
                <Button className="mt-4" onClick={() => navigate('/contracts/new')}>
                  Create Your First Contract
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {recentActiveContracts.map((contract) => {
                  let parsedData: any = {};
                  try {
                    parsedData = typeof contract.raw_contract_text === 'string' 
                      ? JSON.parse(contract.raw_contract_text) 
                      : contract.raw_contract_text || {};
                  } catch (e) {}

                  return (
                    <div key={contract.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate(`/contracts/${contract.id}`)}>
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
                          <FileText className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">{parsedData.contract_name || contract.contract_type}</p>
                          <p className="text-sm text-muted-foreground">{parsedData.counterparty_name || 'N/A'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <p className="text-lg font-semibold text-foreground">{parseFloat(contract.total_amount_usdc).toFixed(2)} <span className="text-sm text-muted-foreground">USDC</span></p>
                        <Badge variant="default" className="bg-green-500">
                          {contract.status}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Recent Transactions */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-foreground">Recent Transactions</h2>
              <Link to="/payments">
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </Link>
            </div>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : recentTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <DollarSign className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentTransactions.map((tx) => {
                  const isInbound = tx.type === 'INBOUND';
                  const isSent = tx.type === 'OUTBOUND' || tx.type === 'manual' || tx.type === 'automated';
                  const timeAgo = new Date(tx.executed_at).toLocaleDateString();

                  return (
                    <div key={tx.id} className="flex items-center justify-between p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          isInbound ? "bg-emerald" : "bg-red-500"
                        }`}>
                          {isInbound ? <ArrowDownLeft className="w-5 h-5 text-white" /> : <ArrowUpRight className="w-5 h-5 text-white" />}
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {tx.asset_description || tx.wallet_name || (isInbound ? 'Received USDC' : 'Sent USDC')}
                          </p>
                          <p className="text-sm text-muted-foreground">{timeAgo}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-semibold ${isInbound ? "text-emerald" : "text-red-600"}`}>
                          {isInbound ? "+" : "-"}{parseFloat(tx.amount_usdc).toFixed(2)} USDC
                        </p>
                        <Badge variant="outline" className={`mt-1 ${tx.status === 'confirmed' || tx.status === 'complete' ? 'border-emerald text-emerald' : 'border-yellow-500 text-yellow-500'}`}>
                          {tx.status === 'confirmed' || tx.status === 'complete' ? '✓ Confirmed' : 'Pending'}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
