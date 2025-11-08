import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Wallet as WalletIcon,
  Copy, QrCode, Send, Download, Plus, ExternalLink, Bell, Loader2, AlertCircle,
  ArrowUpRight, ArrowDownLeft, Clock, RefreshCw
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { walletsAPI } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

const Wallets = () => {
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSendOpen, setIsSendOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [wallets, setWallets] = useState<any[]>([]);
  const [primaryWallet, setPrimaryWallet] = useState<any>(null);
  const [hasWallet, setHasWallet] = useState(false);
  const [walletName, setWalletName] = useState('');
  const [recentTransactions, setRecentTransactions] = useState<any[]>([]);
  const [isLoadingTxs, setIsLoadingTxs] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  
  // Transfer form state
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [recipientAddress, setRecipientAddress] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferStatus, setTransferStatus] = useState(''); // For live status updates
  const [transferProgress, setTransferProgress] = useState(0); // 0-100
  
  // Wallet creation form state
  const [selectedBlockchain, setSelectedBlockchain] = useState('ARC-TESTNET');
  const [cctpProgress, setCctpProgress] = useState<{
    isActive: boolean;
    step: number;
    message: string;
  }>({ isActive: false, step: 0, message: '' });
  const [destBlockchain, setDestBlockchain] = useState<string>('');

  // Fetch user's wallets on mount
  useEffect(() => {
    fetchWallets();
  }, []);


  const fetchWallets = async () => {
    try {
      setIsLoading(true);
      const response = await walletsAPI.getMy();
      
      if (response.success && response.wallets) {
        setWallets(response.wallets);
        setPrimaryWallet(response.primaryWallet);
        setHasWallet(true);
        console.log('✅ Wallets loaded:', response.wallets);
        
        // Fetch recent transactions for ALL wallets combined
        if (response.wallets && response.wallets.length > 0) {
          // Fetch transactions for all wallets in parallel
          const allTransactionsPromises = response.wallets.map((wallet: any) => 
            walletsAPI.getTransactions(wallet.id, 5).catch(() => ({ success: false, transactions: [] }))
          );

          Promise.all(allTransactionsPromises).then(results => {
            // Calculate balance for each wallet from transactions
            const walletsWithCalculatedBalance = response.wallets.map((wallet: any, index: number) => {
              const walletTxs = results[index]?.transactions || [];
              
              // Calculate balance: received - sent (only completed transactions)
              let calculatedBalance = 0;
              walletTxs.forEach((tx: any) => {
                if (tx.status === 'complete') {
                  if (tx.type === 'received') {
                    calculatedBalance += tx.amount;
                  } else if (tx.type === 'sent') {
                    calculatedBalance -= tx.amount;
                  }
                }
              });
              
              // Add calculated balance to wallet object
              return {
                ...wallet,
                calculatedBalance: calculatedBalance
              };
            });
            
            // Calculate total balance across ALL wallets
            const totalBal = walletsWithCalculatedBalance.reduce((sum, wallet) => {
              return sum + (wallet.calculatedBalance || 0);
            }, 0);
            setTotalBalance(totalBal);
            
            // Update wallets with calculated balances
            setWallets(walletsWithCalculatedBalance);
            
            // Update primary wallet too
            const primaryWithBalance = walletsWithCalculatedBalance.find((w: any) => w.isPrimary) || walletsWithCalculatedBalance[0];
            setPrimaryWallet(primaryWithBalance);
            
            // Combine all transactions for recent activity
            const allTxs = results
              .filter(r => r.success)
              .flatMap(r => r.transactions)
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .slice(0, 10);
            
            setRecentTransactions(allTxs);
            setIsLoadingTxs(false);
          });
        }
      } else {
        setHasWallet(false);
        console.log('ℹ️ No wallets found');
      }
    } catch (error: any) {
      if (error.response?.status === 404) {
        setHasWallet(false);
        console.log('ℹ️ No wallets exist yet');
      } else {
        console.error('Failed to fetch wallets:', error);
        toast.error('Failed to load wallets');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTransactions = async (walletId: string) => {
    try {
      setIsLoadingTxs(true);
      const response = await walletsAPI.getTransactions(walletId, 5);
      if (response.success) {
        setRecentTransactions(response.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    } finally {
      setIsLoadingTxs(false);
    }
  };

  const handleRefreshBalance = async () => {
    setIsRefreshing(true);
    try {
      toast.info('Refreshing wallet balances...');
      await fetchWallets();
      toast.success('Balances updated! 🎉');
    } catch (error) {
      toast.error('Failed to refresh balances');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateWallet = async () => {
    if (!walletName.trim()) {
      toast.error('Please enter a wallet name');
      return;
    }

    setIsCreating(true);
    try {
      const blockchainName = selectedBlockchain === 'ARC-TESTNET' ? 'Arc' : 
                             selectedBlockchain === 'BASE-SEPOLIA' ? 'Base' :
                             selectedBlockchain === 'ETH-SEPOLIA' ? 'Ethereum' : 'Polygon';
      toast.info(`Creating Circle wallet on ${blockchainName}...`);
      
      const response = await walletsAPI.create({
        blockchain: selectedBlockchain,
        walletName: walletName.trim()
      });
      
      if (response.success) {
        toast.success(`Wallet "${response.wallet.name}" created! 🎉`);
        toast.info(`Address: ${response.wallet.address.slice(0, 10)}...`);
        
        setWalletName(''); // Reset form
        setIsCreateOpen(false);
        
        // Refresh wallets
        await fetchWallets();
      }
    } catch (error: any) {
      console.error('Wallet creation error:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to create wallet';
      toast.error(errorMsg);
    } finally {
      setIsCreating(false);
    }
  };

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    toast.success("Address copied to clipboard!");
  };

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const handleSendUSDC = async () => {
    if (!sourceWalletId || !recipientAddress || !transferAmount) {
      toast.error('Please fill in all required fields');
      return;
    }

    const amount = parseFloat(transferAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    // Find source wallet and check balance
    const sourceWallet = wallets.find(w => w.id === sourceWalletId);
    if (!sourceWallet) {
      toast.error('Source wallet not found');
      return;
    }

    const balance = sourceWallet.calculatedBalance || 0;
    if (balance < amount) {
      toast.error(`Insufficient balance. You have $${balance.toFixed(2)} USDC`);
      return;
    }

    // Check if cross-chain using detected blockchain
    const destinationChain = destBlockchain || sourceWallet.blockchain;
    const isCrossChain = !!(destBlockchain && sourceWallet.blockchain !== destBlockchain);

    setIsSending(true);
    setTransferProgress(0);
    
    try {
      if (isCrossChain) {
        // CCTP Cross-chain transfer with real-time progress
        setCctpProgress({ isActive: true, step: 0, message: 'Starting cross-chain transfer...' });
        setTransferStatus(`🌉 Bridging from ${sourceWallet.blockchain} to ${destinationChain}...`);
        setTransferProgress(10);
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        setCctpProgress({ isActive: true, step: 1, message: 'Approving USDC...' });
        setTransferStatus('✅ Step 1/4: Approving USDC...');
        setTransferProgress(20);
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setCctpProgress({ isActive: true, step: 2, message: 'Burning USDC on source chain...' });
        setTransferStatus('🔥 Step 2/4: Burning USDC...');
        setTransferProgress(35);
      } else {
        // Same-chain transfer (existing flow)
        setTransferStatus(`💸 Sending $${amount} USDC...`);
        setTransferProgress(30);
      }
      
      // Make API call with destination blockchain (ALWAYS pass it now!)
      const response = await walletsAPI.send(
        sourceWalletId, 
        recipientAddress, 
        transferAmount,
        transferNote,
        destinationChain // Always pass destination blockchain
      );
      
      if (isCrossChain) {
        setTransferProgress(50);
        setCctpProgress({ isActive: true, step: 3, message: 'Getting attestation from Circle...' });
        setTransferStatus('📜 Step 3/4: Getting attestation... (30-45s)');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setTransferProgress(70);
        setCctpProgress({ isActive: true, step: 4, message: 'Minting USDC on destination chain...' });
        setTransferStatus('✨ Step 4/4: Minting USDC...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setTransferProgress(100);
      setTransferStatus('✅ Transfer complete!');
      setCctpProgress({ isActive: false, step: 0, message: '' });
      
      if (response.success) {
        toast.success(`Transfer successful! 🎉`);
        
        // Wait a bit to show success, then close
        setTimeout(() => {
          // Reset form
          setSourceWalletId('');
          setRecipientAddress('');
          setTransferAmount('');
          setTransferNote('');
          setDestBlockchain('');
          setTransferStatus('');
          setTransferProgress(0);
          setCctpProgress({ isActive: false, step: 0, message: '' });
          setIsSendOpen(false);
          
          // Refresh wallets
          fetchWallets();
        }, 2000);
      }
    } catch (error: any) {
      console.error('Transfer error:', error);
      const errorMsg = error.response?.data?.error || error.response?.data?.message || 'Failed to send USDC';
      toast.error(errorMsg);
      setTransferStatus('');
      setTransferProgress(0);
      setCctpProgress({ isActive: false, step: 0, message: '' });
      setDestBlockchain('');
      setIsSending(false);
    }
  };

  const quickCopyWalletAddress = (wallet: any) => {
    setRecipientAddress(wallet.address);
    toast.success(`Copied ${wallet.name} address!`);
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
              <h1 className="text-3xl font-bold">Wallets</h1>
              <p className="text-muted-foreground mt-1">Manage your Circle USDC wallets on Arc blockchain</p>
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <span className="ml-3 text-muted-foreground">Loading wallet...</span>
            </div>
          ) : !hasWallet ? (
            // NO WALLET - Show Create Wallet Prompt
            <Card className="p-12 text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-primary/10 flex items-center justify-center">
                <WalletIcon className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-4">Create Your First Wallet</h2>
              <p className="text-muted-foreground mb-8 text-lg">
                Create a Circle wallet on Arc blockchain to start making payments.
                Your wallet will be created on the testnet - no real money needed!
              </p>
              <div className="bg-muted/50 border border-border rounded-lg p-6 mb-8 text-left space-y-3">
                <h3 className="font-semibold text-lg mb-3">What you'll get:</h3>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-sm">✓</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Arc Testnet Wallet</strong> - Gasless transactions with USDC
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-sm">✓</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Secure & Non-Custodial</strong> - Circle Developer-Controlled Wallets
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-primary text-sm">✓</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    <strong>Ready for Payments</strong> - Execute contract payments instantly
                  </p>
                </div>
              </div>

              {/* Wallet Name Input */}
              <div className="max-w-md mx-auto mb-6">
                <Label htmlFor="first-wallet-name" className="text-left block mb-2">
                  Wallet Name
                </Label>
                <Input
                  id="first-wallet-name"
                  placeholder="e.g., Personal Wallet, Business Account"
                  value={walletName}
                  onChange={(e) => setWalletName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && walletName.trim()) {
                      handleCreateWallet();
                    }
                  }}
                  className="text-lg"
                />
              </div>

              <Button 
                variant="gradient" 
                size="lg" 
                className="gap-2"
                onClick={handleCreateWallet}
                disabled={isCreating || !walletName.trim()}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating Wallet...
                  </>
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    Create Wallet on Arc
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground mt-4">
                Takes ~10 seconds • Free on testnet
              </p>
            </Card>
          ) : (
            // HAS WALLET - Show Wallet Details
            <>
              {/* Total Balance */}
              <Card className="p-8 gradient-primary text-white">
                <p className="text-lg mb-2 text-white/80">Total Balance (All Wallets)</p>
                <p className="text-5xl font-bold mb-4">
                  {totalBalance.toFixed(2)} 
                  <span className="text-2xl font-normal"> USDC</span>
                </p>
                {wallets.length > 1 && (
                  <p className="text-sm text-white/60 mb-4">
                    Across {wallets.length} wallets
                  </p>
                )}
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="bg-white text-primary border-0 hover:bg-white/90"
                    onClick={handleRefreshBalance}
                    disabled={isRefreshing}
                  >
                    <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Dialog open={isSendOpen} onOpenChange={setIsSendOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="bg-white text-primary border-0 hover:bg-white/90">
                        <Send className="w-4 h-4 mr-2" />
                        Send
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Send USDC<small>(Between Wallets)</small></DialogTitle>
                        {/* <DialogDescription>Transfer USDC between wallets</DialogDescription> */}
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {/* Source Wallet Selector */}
                        <div className="space-y-2">
                          <Label htmlFor="source-wallet">From Wallet</Label>
                          <Select value={sourceWalletId} onValueChange={setSourceWalletId}>
                            <SelectTrigger id="source-wallet">
                              <SelectValue placeholder="Select source wallet" />
                            </SelectTrigger>
                            <SelectContent>
                              {wallets.map((wallet) => (
                                <SelectItem key={wallet.id} value={wallet.id}>
                                  {wallet.name} - ${(wallet.calculatedBalance || 0).toFixed(2)} USDC
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {sourceWalletId && (
                            <p className="text-sm text-muted-foreground">
                              Balance: ${(wallets.find(w => w.id === sourceWalletId)?.calculatedBalance || 0).toFixed(2)} USDC
                            </p>
                          )}
                        </div>

                        {/* Recipient Address & Blockchain */}
                        <div className="space-y-2">
                          <Label htmlFor="to-address">To Address</Label>
                          <div className="flex gap-2">
                            <Input 
                              id="to-address" 
                              placeholder="0x... or wallet address" 
                              value={recipientAddress}
                              onChange={(e) => setRecipientAddress(e.target.value)}
                              className="flex-1"
                            />
                            <Select value={destBlockchain} onValueChange={setDestBlockchain}>
                              <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Select chain" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ARC-TESTNET">🔵 Arc Testnet</SelectItem>
                                <SelectItem value="BASE-SEPOLIA">🔷 Base Sepolia</SelectItem>
                                <SelectItem value="ETH-SEPOLIA">💎 Ethereum Sepolia</SelectItem>
                                <SelectItem value="MATIC-AMOY">🟣 Polygon Amoy</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {recipientAddress && destBlockchain && (
                            <div className="p-2 bg-muted rounded-md">
                              <p className="text-xs text-muted-foreground mb-1">Sending to:</p>
                              <p className="text-sm font-mono break-all">{recipientAddress}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                on {destBlockchain === 'ARC-TESTNET' ? '🔵 Arc Testnet' :
                                    destBlockchain === 'BASE-SEPOLIA' ? '🔷 Base Sepolia' :
                                    destBlockchain === 'ETH-SEPOLIA' ? '💎 Ethereum Sepolia' :
                                    destBlockchain === 'MATIC-AMOY' ? '🟣 Polygon Amoy' : destBlockchain}
                              </p>
                            </div>
                          )}
                          {wallets.filter(w => w.id !== sourceWalletId).length > 0 && (
                            <div className="space-y-1.5">
                              <Label htmlFor="quick-copy-wallet" className="text-xs text-muted-foreground">
                                💡 Quick-copy your wallets
                              </Label>
                              <Select onValueChange={(walletId) => {
                                const wallet = wallets.find(w => w.id === walletId);
                                if (wallet) {
                                  quickCopyWalletAddress(wallet);
                                  setDestBlockchain(wallet.blockchain); // Auto-set blockchain
                                }
                              }}>
                                <SelectTrigger id="quick-copy-wallet" className="h-9">
                                  <SelectValue placeholder="Select a wallet to copy address" />
                                </SelectTrigger>
                                <SelectContent>
                                  {wallets.filter(w => w.id !== sourceWalletId).map((wallet) => (
                                    <SelectItem key={wallet.id} value={wallet.id}>
                                      {wallet.name} ({wallet.blockchain})
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>

                        {/* Amount */}
                        <div className="space-y-2">
                          <Label htmlFor="transfer-amount">Amount (USDC)</Label>
                          <Input 
                            id="transfer-amount" 
                            type="number" 
                            placeholder="0.00" 
                            step="0.01"
                            min="0"
                            value={transferAmount}
                            onChange={(e) => setTransferAmount(e.target.value)}
                          />
                        </div>

                        {/* Cross-Chain Detection & Progress */}
                        {sourceWalletId && recipientAddress && destBlockchain && (() => {
                          const sourceWallet = wallets.find(w => w.id === sourceWalletId);
                          
                          // Check if source and destination are on different blockchains
                          const isCrossChain = !!(
                            sourceWallet && 
                            destBlockchain && 
                            sourceWallet.blockchain &&
                            sourceWallet.blockchain.trim() !== destBlockchain.trim()
                          );
                          
                          if (isCrossChain) {
                            return (
                              <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                                <div className="flex items-center gap-3 mb-2">
                                  <span className="text-2xl">
                                    {sourceWallet.blockchain === 'ARC-TESTNET' ? '🔵' :
                                     sourceWallet.blockchain === 'BASE-SEPOLIA' ? '🔷' :
                                     sourceWallet.blockchain === 'ETH-SEPOLIA' ? '💎' : '🟣'}
                                  </span>
                                  <span className="text-xl">→</span>
                                  <span className="text-2xl">🌉</span>
                                  <span className="text-xl">→</span>
                                  <span className="text-2xl">
                                    {destBlockchain === 'ARC-TESTNET' ? '🔵' :
                                     destBlockchain === 'BASE-SEPOLIA' ? '🔷' :
                                     destBlockchain === 'ETH-SEPOLIA' ? '💎' : '🟣'}
                                  </span>
                                </div>
                                <p className="text-sm text-blue-700 dark:text-blue-300">
                                  🌉 Cross-chain transfer detected! USDC will be bridged automatically.
                                </p>
                                <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                                  Estimated time: ~30-60 seconds
                                </p>
                              </div>
                            );
                          }
                          return null;
                        })()}

                        {/* Transfer Progress */}
                        {isSending && transferStatus && (
                          <div className="space-y-3 p-4 bg-muted rounded-lg">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">{transferStatus}</span>
                              <span className="text-sm text-muted-foreground">{transferProgress}%</span>
                            </div>
                            <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                                style={{ width: `${transferProgress}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Send Button */}
                        <Button 
                          variant="gradient" 
                          className="w-full gap-2" 
                          onClick={handleSendUSDC}
                          disabled={isSending || !sourceWalletId || !recipientAddress || !transferAmount}
                        >
                          {isSending ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="w-4 h-4" />
                              Send USDC
                            </>
                          )}
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* CCTP Progress Modal */}
                  <Dialog open={cctpProgress.isActive} onOpenChange={() => {}}>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>🌉 Cross-Chain Bridge in Progress</DialogTitle>
                        <DialogDescription>
                          Your USDC is being transferred via Circle's CCTP protocol
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {/* Progress Steps */}
                        <div className="space-y-3">
                          {/* Step 1: Approve */}
                          <div className={`flex items-center gap-3 p-3 rounded-lg ${cctpProgress.step >= 1 ? 'bg-green-50 dark:bg-green-950' : 'bg-gray-50 dark:bg-gray-900'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cctpProgress.step >= 1 ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}>
                              {cctpProgress.step > 1 ? '✓' : '1'}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">Approve USDC</p>
                              <p className="text-xs text-muted-foreground">Authorize token spending</p>
                            </div>
                            {cctpProgress.step === 1 && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                          </div>

                          {/* Step 2: Burn */}
                          <div className={`flex items-center gap-3 p-3 rounded-lg ${cctpProgress.step >= 2 ? 'bg-green-50 dark:bg-green-950' : 'bg-gray-50 dark:bg-gray-900'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cctpProgress.step >= 2 ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}>
                              {cctpProgress.step > 2 ? '✓' : '2'}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">Burn USDC</p>
                              <p className="text-xs text-muted-foreground">Remove tokens from source chain</p>
                            </div>
                            {cctpProgress.step === 2 && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                          </div>

                          {/* Step 3: Attestation */}
                          <div className={`flex items-center gap-3 p-3 rounded-lg ${cctpProgress.step >= 3 ? 'bg-green-50 dark:bg-green-950' : 'bg-gray-50 dark:bg-gray-900'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cctpProgress.step >= 3 ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}>
                              {cctpProgress.step > 3 ? '✓' : '3'}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">Get Attestation</p>
                              <p className="text-xs text-muted-foreground">Circle validates transfer (30-45s)</p>
                            </div>
                            {cctpProgress.step === 3 && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                          </div>

                          {/* Step 4: Mint */}
                          <div className={`flex items-center gap-3 p-3 rounded-lg ${cctpProgress.step >= 4 ? 'bg-green-50 dark:bg-green-950' : 'bg-gray-50 dark:bg-gray-900'}`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${cctpProgress.step >= 4 ? 'bg-green-500 text-white' : 'bg-gray-300 dark:bg-gray-700'}`}>
                              {cctpProgress.step > 4 ? '✓' : '4'}
                            </div>
                            <div className="flex-1">
                              <p className="font-medium">Mint USDC</p>
                              <p className="text-xs text-muted-foreground">Create tokens on destination chain</p>
                            </div>
                            {cctpProgress.step === 4 && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
                          </div>
                        </div>

                        {/* Current Status */}
                        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <p className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>{cctpProgress.message}</span>
                          </p>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-background rounded-full h-2 overflow-hidden">
                          <div 
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500 ease-out"
                            style={{ width: `${(cctpProgress.step / 4) * 100}%` }}
                          />
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* <Button 
                    variant="ghost" 
                    className="text-white border-2 border-white/30 hover:bg-white/10"
                    onClick={() => primaryWallet && copyAddress(primaryWallet.address)}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Address
                  </Button> */}
                </div>
              </Card>

              {/* Wallets Grid */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">My Wallets ({wallets.length})</h2>
                <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                  <DialogTrigger asChild>
                    <Button variant="gradient" className="gap-2">
                      <Plus className="w-4 h-4" />
                      Create New Wallet
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New Wallet</DialogTitle>
                      <DialogDescription>
                        Create a Circle wallet on any supported blockchain
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="blockchain-select">Blockchain Network</Label>
                        <Select value={selectedBlockchain} onValueChange={setSelectedBlockchain}>
                          <SelectTrigger id="blockchain-select">
                            <SelectValue placeholder="Select blockchain" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ARC-TESTNET">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🔵</span>
                                <span>Arc Testnet</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="BASE-SEPOLIA">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🔷</span>
                                <span>Base Sepolia</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="ETH-SEPOLIA">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">💎</span>
                                <span>Ethereum Sepolia</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="MATIC-AMOY">
                              <div className="flex items-center gap-2">
                                <span className="text-lg">🟣</span>
                                <span>Polygon Amoy</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="new-wallet-name">Wallet Name</Label>
                        <Input
                          id="new-wallet-name"
                          placeholder="e.g., Savings, Business Account"
                          value={walletName}
                          onChange={(e) => setWalletName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && walletName.trim()) {
                              handleCreateWallet();
                            }
                          }}
                        />
                      </div>
                      <Button 
                        variant="gradient" 
                        className="w-full gap-2" 
                        onClick={handleCreateWallet}
                        disabled={isCreating || !walletName.trim()}
                      >
                        {isCreating ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            Creating...
                          </>
                        ) : (
                          <>
                            <Plus className="w-4 h-4" />
                            Create Wallet
                          </>
                        )}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {wallets.map((wallet, index) => (
                  <Card key={wallet.id} className="p-6 hover-lift">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center text-3xl">
                        {wallet.blockchain === 'ARC-TESTNET' ? '🔵' :
                         wallet.blockchain === 'BASE-SEPOLIA' ? '🔷' :
                         wallet.blockchain === 'ETH-SEPOLIA' ? '💎' :
                         wallet.blockchain === 'MATIC-AMOY' ? '🟣' : '💼'}
                      </div>
                      <div className="flex flex-col gap-2">
                        {wallet.isPrimary && (
                          <Badge variant="default" className="text-xs">Primary</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {wallet.blockchain === 'ARC-TESTNET' ? 'Arc' :
                           wallet.blockchain === 'BASE-SEPOLIA' ? 'Base' :
                           wallet.blockchain === 'ETH-SEPOLIA' ? 'Ethereum' :
                           wallet.blockchain === 'MATIC-AMOY' ? 'Polygon' : 'Unknown'}
                        </Badge>
                        <Button variant="ghost" size="icon" onClick={() => copyAddress(wallet.address)}>
                          <Copy className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <h3 className="text-2xl font-bold mb-2">{wallet.name}</h3>
                    <p className="text-4xl font-bold mb-6">
                      {wallet.calculatedBalance !== undefined ? wallet.calculatedBalance.toFixed(2) : '0.00'} 
                      <span className="text-lg text-muted-foreground ml-2">USDC</span>
                    </p>
                    
                    <div className="space-y-4 mb-6">
                      <div>
                        <span className="text-sm text-muted-foreground">Wallet Address</span>
                        <div className="flex items-center gap-2 mt-1">
                          <code className="px-2 py-1 bg-muted rounded text-xs font-mono flex-1 overflow-hidden text-ellipsis">
                            {truncateAddress(wallet.address)}
                          </code>
                        </div>
                      </div>

                      <div>
                        <span className="text-sm text-muted-foreground">Created</span>
                        <p className="text-sm mt-1">
                          {new Date(wallet.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                      
                      <a 
                        href={`${
                          wallet.blockchain === 'ARC-TESTNET' ? 'https://testnet.arcscan.app' :
                          wallet.blockchain === 'BASE-SEPOLIA' ? 'https://sepolia.basescan.org' :
                          wallet.blockchain === 'ETH-SEPOLIA' ? 'https://sepolia.etherscan.io' :
                          wallet.blockchain === 'MATIC-AMOY' ? 'https://amoy.polygonscan.com' :
                          'https://testnet.arcscan.app'
                        }/address/${wallet.address}`}
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        View on Explorer
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="flex gap-2 pt-4 border-t">
                      <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => setIsSendOpen(true)}>
                        <Send className="w-4 h-4" />
                        Send
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 gap-2" onClick={() => copyAddress(wallet.address)}>
                        <QrCode className="w-4 h-4" />
                        QR
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Recent Transactions */}
              {/* {recentTransactions.length > 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold">Recent Activity</h2>
                    <Badge variant="secondary" className="gap-1">
                      <Clock className="w-3 h-3" />
                      Last 5 transactions
                    </Badge>
                  </div>
                  
                  <Card className="divide-y">
                    {recentTransactions.map((tx) => (
                      <div key={tx.id} className="p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                              tx.type === 'sent' 
                                ? 'bg-red-500/10 text-red-500' 
                                : 'bg-green-500/10 text-green-500'
                            }`}>
                              {tx.type === 'sent' ? (
                                <ArrowUpRight className="w-5 h-5" />
                              ) : (
                                <ArrowDownLeft className="w-5 h-5" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">
                                {tx.type === 'sent' ? 'Sent' : 'Received'} Payment
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {new Date(tx.createdAt).toLocaleString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className={`text-lg font-bold ${
                              tx.type === 'sent' ? 'text-red-500' : 'text-green-500'
                            }`}>
                              {tx.type === 'sent' ? '-' : '+'}{tx.amount.toFixed(2)} USDC
                            </p>
                            <Badge variant={tx.status === 'confirmed' ? 'default' : 'secondary'} className="text-xs">
                              {tx.status}
                            </Badge>
                          </div>
                        </div>
                        {tx.hash && (
                          <a
                            href={`${
                              import.meta.env.VITE_BLOCKCHAIN_NETWORK === 'ARC-TESTNET'
                                ? 'https://testnet.arcscan.app'
                                : 'https://amoy.polygonscan.com'
                            }/tx/${tx.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
                          >
                            View on Explorer
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ))}
                  </Card>
                </div>
              )} */}

              {/* Info Card - Get Testnet USDC */}
              <Card className="p-6 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/20">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <WalletIcon className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg mb-2">Testnet USDC</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                     We are getting 10 free USDC from Circle's testnet faucet. 
                      {/* Get <strong>10 free USDC</strong> every hour from Circle's testnet faucet. 
                      Perfect for testing payments and contracts! */}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => window.open('https://faucet.circle.com/', '_blank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                        Get Free USDC
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="gap-2"
                        onClick={handleRefreshBalance}
                        disabled={isRefreshing}
                      >
                        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                        Refresh Balance
                      </Button>
                    </div>
                    {/* <p className="text-xs text-muted-foreground mt-3">
                      📋 Copy your wallet address above, paste it on the faucet, select <strong>Arc Testnet</strong>, and click "Send 10 USDC"
                    </p> */}
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default Wallets;
