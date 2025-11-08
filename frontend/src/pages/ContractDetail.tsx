import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  ArrowLeft, 
  FileText, 
  Calendar, 
  DollarSign, 
  User, 
  Clock, 
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Wallet,
  Loader2
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { contractsAPI, paymentsAPI, walletsAPI, a2aAPI } from "@/services/api";
import { toast } from "sonner";
import { PaymentDialog } from "@/components/PaymentDialog";

const ContractDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState<any[]>([]);
  const [pollingTransactions, setPollingTransactions] = useState<Set<string>>(new Set());
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [isEnablingA2A, setIsEnablingA2A] = useState(false);

  // Poll transaction status for pending transactions
  useEffect(() => {
    const pollTransactionStatus = async (circlePaymentId: string) => {
      try {
        const statusResponse = await paymentsAPI.getStatus(circlePaymentId);
        if (statusResponse.success) {
          const state = statusResponse.transaction.state;
          
          // If transaction is complete or failed, stop polling
          if (state === 'COMPLETE' || state === 'FAILED') {
            setPollingTransactions(prev => {
              const newSet = new Set(prev);
              newSet.delete(circlePaymentId);
              return newSet;
            });
            
            // Refresh payment history
            const historyResponse = await paymentsAPI.getHistory({ contractId: id });
            if (historyResponse.success) {
              setPaymentHistory(historyResponse.transactions || []);
              
              // If one-time payment is complete, update contract status to 'completed'
              if (state === 'COMPLETE' && contract?.payment_type === 'one_time') {
                try {
                  await contractsAPI.updateStatus(contract.id, 'completed');
                  // Refresh contract
                  const updatedContract = await contractsAPI.getById(id!);
                  setContract(updatedContract.contract);
                  toast.success("Contract completed! 🎉");
                } catch (error) {
                  console.error('Failed to update contract status:', error);
                }
              }
            }
            
            if (state === 'COMPLETE') {
              toast.success("Transaction confirmed on blockchain! 🎉");
            } else {
              toast.error("Transaction failed");
            }
          }
        }
      } catch (error) {
        console.error('Failed to poll transaction status:', error);
      }
    };

    // Poll every 5 seconds for pending transactions
    const interval = setInterval(() => {
      pollingTransactions.forEach(txId => {
        pollTransactionStatus(txId);
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [pollingTransactions, id]);

  useEffect(() => {
    const fetchContract = async () => {
      try {
        console.log(`🔍 Fetching contract with ID: ${id}`);
        const response = await contractsAPI.getById(id!);
        console.log("📋 Contract Detail Response:", response);
        
        if (response.success && response.contract) {
          console.log("✅ Contract loaded successfully:", response.contract);
          setContract(response.contract);
          
          // Fetch payment history for this contract
          try {
            const historyResponse = await paymentsAPI.getHistory({ contractId: id });
            if (historyResponse.success) {
              setPaymentHistory(historyResponse.transactions || []);
              
              // Start polling for any pending transactions
              const pendingTxs = historyResponse.transactions
                .filter((tx: any) => tx.status === 'pending' && tx.circle_payment_id)
                .map((tx: any) => tx.circle_payment_id);
              
              if (pendingTxs.length > 0) {
                setPollingTransactions(new Set(pendingTxs));
              }
            }
          } catch (error) {
            console.log("No payment history yet");
          }
        } else {
          console.error("❌ Invalid response format:", response);
          toast.error("Invalid contract data received");
        }
      } catch (error: any) {
        console.error("❌ Failed to fetch contract:", error);
        console.error("Error details:", {
          message: error.message,
          response: error.response?.data,
          status: error.response?.status
        });
        
        if (error.response?.status === 404) {
          toast.error("Contract not found");
        } else {
          toast.error("Failed to load contract details");
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      console.log(`🚀 ContractDetail mounted with ID: ${id}`);
      fetchContract();
    } else {
      console.error("❌ No contract ID provided");
      setIsLoading(false);
    }
  }, [id]);

  // Open payment confirmation dialog
  const openPaymentDialog = () => {
    setShowPaymentDialog(true);
  };

  // Handle Execute Payment (after confirmation)
  const handleExecutePayment = async (walletId: string, walletAddress: string) => {
    if (!contract) return;
    
    setIsExecuting(true);
    
    try {
      toast.info("Executing payment...");
      
      // Parse contract data for destination address
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
      
      const destinationAddress = parsedData.counterparty_address;
      
      if (!destinationAddress || destinationAddress === 'N/A') {
        throw new Error("No recipient address found in contract");
      }
      
      console.log('💰 Payment details:', {
        from: walletAddress,
        to: destinationAddress,
        amount: contract.total_amount_usdc,
        contractId: contract.id
      });
      
      const paymentData = {
        sourceWalletId: walletId,
        destinationWalletId: destinationAddress,
        amount: contract.total_amount_usdc,
        contractId: contract.id,
        metadata: {
          contractName: parsedData.contract_name || contract.asset_description,
          contractType: contract.contract_type,
          paymentType: contract.payment_type
        }
      };
      
      const response = await paymentsAPI.execute(paymentData);
      
      if (response.success) {
        toast.success("Payment executed successfully! 🎉");
        toast.info("Waiting for blockchain confirmation...");
        
        // Start polling for this transaction
        if (response.payment?.id) {
          setPollingTransactions(prev => new Set(prev).add(response.payment.id));
        }
      } else {
        throw new Error(response.error || "Payment failed");
      }
    } catch (error: any) {
      console.error("Payment execution error:", error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  };

  // Handle Pause Contract
  const handlePauseContract = async () => {
    if (!contract) return;
    
    setIsPausing(true);
    try {
      await contractsAPI.updateStatus(contract.id, 'paused');
      toast.success("Contract paused successfully");
      
      // Refresh contract
      const response = await contractsAPI.getById(id!);
      setContract(response.contract);
    } catch (error: any) {
      console.error("Pause error:", error);
      toast.error("Failed to pause contract");
    } finally {
      setIsPausing(false);
    }
  };

  // Handle Cancel Contract
  const handleCancelContract = async () => {
    if (!contract) return;
    
    setIsCancelling(true);
    try {
      await contractsAPI.updateStatus(contract.id, 'cancelled');
      toast.success("Contract cancelled successfully");
      
      // Close dialog and navigate back
      setShowCancelDialog(false);
      setTimeout(() => navigate('/contracts'), 1500);
    } catch (error: any) {
      console.error("Cancel error:", error);
      toast.error("Failed to cancel contract");
    } finally {
      setIsCancelling(false);
    }
  };

  // Handle Enable A2A
  const handleEnableA2A = async () => {
    if (!contract) return;
    
    setIsEnablingA2A(true);
    try {
      const result = await a2aAPI.enableA2A(contract.id, 'manual'); // Default to manual mode
      
      toast.success(`🤖 A2A Enabled! Payments will require your approval.`);
      
      // Refresh contract to show updated status
      const updatedContract = await contractsAPI.getById(id!);
      setContract(updatedContract.contract);
      
    } catch (error: any) {
      console.error('Failed to enable A2A:', error);
      toast.error(error.response?.data?.error || "Failed to enable A2A");
    } finally {
      setIsEnablingA2A(false);
    }
  };

  // Handle Disable A2A
  const handleDisableA2A = async () => {
    if (!contract) return;
    
    setIsEnablingA2A(true);
    try {
      await a2aAPI.disableA2A(contract.id);
      
      toast.success("A2A Disabled");
      
      // Refresh contract
      const updatedContract = await contractsAPI.getById(id!);
      setContract(updatedContract.contract);
      
    } catch (error: any) {
      console.error('Failed to disable A2A:', error);
      toast.error(error.response?.data?.error || "Failed to disable A2A");
    } finally {
      setIsEnablingA2A(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading contract details...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <main className="flex-1 flex items-center justify-center">
          <Card className="p-12 text-center max-w-md">
            <AlertCircle className="w-16 h-16 mx-auto mb-4 text-destructive" />
            <h3 className="text-2xl font-bold mb-2">Contract Not Found</h3>
            <p className="text-muted-foreground mb-6">
              The contract you're looking for doesn't exist or has been deleted.
            </p>
            <Button onClick={() => navigate("/contracts")}>
              Back to Contracts
            </Button>
          </Card>
        </main>
      </div>
    );
  }

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
  const counterpartyName = parsedData.counterparty_name || 'N/A';
  const counterpartyAddress = parsedData.counterparty_address || 'N/A';
  const startDate = parsedData.start_date || contract.start_date;
  const endDate = parsedData.end_date || contract.end_date;
  const paymentDayOfMonth = parsedData.payment_day_of_month;
  
  // ✅ Debug logging for dates
  console.log('📅 Contract dates:', {
    parsedData_start_date: parsedData.start_date,
    contract_start_date: contract.start_date,
    final_startDate: startDate,
    isValid: startDate && !isNaN(new Date(startDate).getTime())
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'completed':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'disputed':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  return (
    <div className="min-h-screen flex w-full bg-background">
      {/* Sidebar */}
      <AppSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
          <div className="p-6">
            <Button 
              variant="ghost" 
              className="mb-4 gap-2"
              onClick={() => navigate("/contracts")}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Contracts
            </Button>
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">{contractName}</h1>
                <div className="flex items-center gap-3">
                  <Badge className={`${getStatusColor(contract.status)} border`}>
                    {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Contract ID: {contract.id}
                  </span>
                </div>
              </div>
              {contract.status === 'active' && (() => {
                const isOneTime = contract.payment_type === 'one_time';
                const isRecurring = ['monthly', 'quarterly', 'yearly'].includes(contract.payment_type || '');
                
                // Check if one-time payment is already completed
                const hasCompletedPayment = paymentHistory.some(
                  (tx: any) => tx.status === 'completed' || tx.status === 'confirmed'
                );
                
                // ✅ For ONE-TIME: Disable after first payment
                const shouldDisableOneTime = isOneTime && hasCompletedPayment;
                
                // ✅ For RECURRING: Check if payment already made this period
                const shouldDisableRecurring = isRecurring && (() => {
                  if (paymentHistory.length === 0) return false;
                  
                  // Get last completed payment
                  const lastPayment = paymentHistory
                    .filter((tx: any) => tx.status === 'completed' || tx.status === 'confirmed')
                    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                  
                  if (!lastPayment) return false;
                  
                  const lastPaymentDate = new Date(lastPayment.created_at);
                  const now = new Date();
                  
                  // Check if payment was made this month/quarter/year
                  if (contract.payment_type === 'monthly') {
                    return lastPaymentDate.getMonth() === now.getMonth() && 
                           lastPaymentDate.getFullYear() === now.getFullYear();
                  } else if (contract.payment_type === 'quarterly') {
                    const lastQuarter = Math.floor(lastPaymentDate.getMonth() / 3);
                    const currentQuarter = Math.floor(now.getMonth() / 3);
                    return lastQuarter === currentQuarter && 
                           lastPaymentDate.getFullYear() === now.getFullYear();
                  } else if (contract.payment_type === 'yearly') {
                    return lastPaymentDate.getFullYear() === now.getFullYear();
                  }
                  return false;
                })();
                
                const shouldDisable = shouldDisableOneTime || shouldDisableRecurring;
                
                return (
                  <Button 
                    variant="gradient" 
                    className="gap-2"
                    onClick={openPaymentDialog}
                    disabled={isExecuting || shouldDisable}
                    title={
                      shouldDisableOneTime ? "One-time payment already completed" :
                      shouldDisableRecurring ? "Payment already made for this period" : ""
                    }
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Executing...
                      </>
                    ) : shouldDisableOneTime ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Payment Completed
                      </>
                    ) : shouldDisableRecurring ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Paid This {contract.payment_type === 'monthly' ? 'Month' : 
                                   contract.payment_type === 'quarterly' ? 'Quarter' : 'Year'}
                      </>
                    ) : (
                      <>
                        <DollarSign className="w-5 h-5" />
                        Execute Payment
                      </>
                    )}
                  </Button>
                );
              })()}
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6 max-w-7xl">
          {/* Main Info Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Payment Information */}
            <Card className="p-6 lg:col-span-2 space-y-6">
              <div>
                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Payment Information
                </h2>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm text-muted-foreground">Total Amount</label>
                      <p className="text-2xl font-bold text-primary">
                        {parseFloat(contract.total_amount_usdc).toFixed(2)} USDC
                      </p>
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">Payment Type</label>
                      <p className="text-lg font-semibold capitalize">
                        {contract.payment_type.replace('_', ' ')}
                      </p>
                    </div>
                    
                    {/* ✅ Next Payment Due (for recurring) */}
                    {['monthly', 'quarterly', 'yearly'].includes(contract.payment_type) && (() => {
                      const lastPayment = paymentHistory
                        .filter((tx: any) => tx.status === 'completed' || tx.status === 'confirmed')
                        .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                      
                      const now = new Date();
                      let nextDue: Date | null = null;
                      
                      if (!lastPayment) {
                        // ✅ No payments yet - calculate from start_date
                        if (startDate && !isNaN(new Date(startDate).getTime())) {
                          nextDue = new Date(startDate);
                          console.log('📅 Next payment from start_date:', startDate, '→', nextDue);
                        } else if (contract.start_date && !isNaN(new Date(contract.start_date).getTime())) {
                          nextDue = new Date(contract.start_date);
                          console.log('📅 Next payment from contract.start_date:', contract.start_date, '→', nextDue);
                        } else {
                          // Fallback to today if no valid start_date
                          console.warn('⚠️ No valid start_date found, using today');
                          nextDue = new Date();
                        }
                      } else {
                        // ✅ Calculate from last payment date
                        nextDue = new Date(lastPayment.created_at);
                        
                        if (contract.payment_type === 'monthly') {
                          nextDue.setMonth(nextDue.getMonth() + 1);
                        } else if (contract.payment_type === 'quarterly') {
                          nextDue.setMonth(nextDue.getMonth() + 3);
                        } else if (contract.payment_type === 'yearly') {
                          nextDue.setFullYear(nextDue.getFullYear() + 1);
                        }
                        console.log('📅 Next payment from last payment:', lastPayment.created_at, '→', nextDue);
                      }
                      
                      // ✅ Validate nextDue before rendering
                      if (!nextDue || isNaN(nextDue.getTime())) {
                        console.error('❌ Invalid nextDue date:', nextDue);
                        return (
                          <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                            <label className="text-sm text-red-600 dark:text-red-400 font-medium">⚠️ Error</label>
                            <p className="text-sm font-semibold text-red-700 dark:text-red-300">
                              Invalid payment date
                            </p>
                          </div>
                        );
                      }
                      
                      const isPastDue = nextDue < now;
                      const isDueToday = nextDue.toDateString() === now.toDateString();
                      
                      return (
                        <div className={`p-3 border rounded-lg ${
                          isPastDue ? 'bg-red-500/10 border-red-500/20' :
                          isDueToday ? 'bg-yellow-500/10 border-yellow-500/20' :
                          'bg-green-500/10 border-green-500/20'
                        }`}>
                          <label className={`text-sm font-medium ${
                            isPastDue ? 'text-red-600 dark:text-red-400' :
                            isDueToday ? 'text-yellow-600 dark:text-yellow-400' :
                            'text-green-600 dark:text-green-400'
                          }`}>
                            {isPastDue ? '⚠️ Payment Overdue' : isDueToday ? '⏰ Due Today' : '✅ Next Payment'}
                          </label>
                          <p className={`text-sm font-semibold ${
                            isPastDue ? 'text-red-700 dark:text-red-300' :
                            isDueToday ? 'text-yellow-700 dark:text-yellow-300' :
                            'text-green-700 dark:text-green-300'
                          }`}>
                            {nextDue.toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      );
                    })()}
                    <div>
                      <label className="text-sm text-muted-foreground">Contract Type</label>
                      <p className="text-lg font-semibold capitalize">
                        {contract.contract_type.replace('_', ' ')}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {paymentDayOfMonth && (
                      <div>
                        <label className="text-sm text-muted-foreground">Payment Day</label>
                        <p className="text-lg font-semibold">
                          Day {paymentDayOfMonth} of each month
                        </p>
                      </div>
                    )}
                    <div>
                      <label className="text-sm text-muted-foreground">Start Date</label>
                      <p className="text-lg font-semibold flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {startDate ? new Date(startDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : 'Not set'}
                      </p>
                    </div>
                    {endDate && (
                      <div>
                        <label className="text-sm text-muted-foreground">End Date</label>
                        <p className="text-lg font-semibold flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {new Date(endDate).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="border-t pt-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <User className="w-5 h-5 text-primary" />
                  Counterparty Information
                </h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-muted-foreground">Name</label>
                    <p className="text-lg font-semibold">{counterpartyName}</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground">Wallet Address</label>
                    <div className="flex items-center gap-2">
                      <code className="px-3 py-2 bg-muted rounded-lg text-sm font-mono flex-1">
                        {counterpartyAddress}
                      </code>
                      {counterpartyAddress !== 'N/A' && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            navigator.clipboard.writeText(counterpartyAddress);
                            toast.success("Address copied to clipboard!");
                          }}
                        >
                          Copy
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {contract.asset_description && (
                <div className="border-t pt-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    Description
                  </h3>
                  <p className="text-muted-foreground">{contract.asset_description}</p>
                </div>
              )}
            </Card>

            {/* Timeline & Actions */}
            <div className="space-y-6">
              {/* Timeline Card */}
              <Card className="p-6">
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-primary" />
                  Timeline
                </h3>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-2"></div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">Created</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(contract.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>

                  {contract.updated_at !== contract.created_at && contract.status !== 'cancelled' && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-500 mt-2"></div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Last Updated</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(contract.updated_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )}

                  {contract.status === 'cancelled' && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 rounded-full bg-red-500 mt-2"></div>
                      <div className="flex-1">
                        <p className="font-semibold text-sm">Cancelled</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(contract.updated_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Actions Card */}
              {contract.status !== 'cancelled' && contract.status !== 'completed' && (
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
                  <div className="space-y-3">
                    {/* A2A Toggle Button */}
                    {contract.a2a_enabled ? (
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
                        onClick={handleDisableA2A}
                        disabled={isEnablingA2A}
                      >
                        {isEnablingA2A ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <span className="text-xl">🤖</span>
                        )}
                        <div className="flex-1 text-left">
                          <div className="font-semibold">A2A Enabled</div>
                          <div className="text-xs text-muted-foreground">Autonomous payments active</div>
                        </div>
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                          ✓ Active
                        </Badge>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 hover:bg-purple-50 dark:hover:bg-purple-950/20 border-purple-200"
                        onClick={handleEnableA2A}
                        disabled={isEnablingA2A}
                      >
                        {isEnablingA2A ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <span className="text-xl">🤖</span>
                        )}
                        <div className="flex-1 text-left">
                          <div className="font-semibold">Enable A2A Payments</div>
                          <div className="text-xs text-muted-foreground">Let AI agents handle payments</div>
                        </div>
                      </Button>
                    )}

                    {contract.status === 'active' && (
                      <>
                        <Button 
                          variant="default" 
                          className="w-full gap-2"
                          onClick={openPaymentDialog}
                          disabled={isExecuting}
                        >
                          {isExecuting ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Executing...
                            </>
                          ) : (
                            <>
                              <DollarSign className="w-4 h-4" />
                              Execute Payment Now
                            </>
                          )}
                        </Button>
                        <Button 
                          variant="outline" 
                          className="w-full gap-2"
                          onClick={handlePauseContract}
                          disabled={isPausing}
                        >
                          {isPausing ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Pausing...
                            </>
                          ) : (
                            <>
                              <Clock className="w-4 h-4" />
                              Pause Contract
                            </>
                          )}
                        </Button>
                      </>
                    )}
                    <Button 
                      variant="outline" 
                      className="w-full gap-2 text-destructive border-destructive hover:bg-destructive hover:text-white"
                      onClick={() => setShowCancelDialog(true)}
                      disabled={isCancelling}
                    >
                      <AlertCircle className="w-4 h-4" />
                      Cancel Contract
                    </Button>
                  </div>
                </Card>
              )}

              {/* Blockchain Info Card */}
              {counterpartyAddress !== 'N/A' && (
                <Card className="p-6">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Wallet className="w-5 h-5 text-primary" />
                    Blockchain
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-muted-foreground">Network</label>
                      <p className="font-semibold">
                        {import.meta.env.VITE_BLOCKCHAIN_NETWORK === 'ARC-TESTNET' 
                          ? 'Arc Testnet' 
                          : import.meta.env.VITE_BLOCKCHAIN_NETWORK === 'MATIC-AMOY'
                          ? 'Polygon Amoy Testnet'
                          : 'Ethereum Sepolia'
                        }
                      </p>
                      {import.meta.env.VITE_BLOCKCHAIN_NETWORK === 'ARC-TESTNET' && (
                        <p className="text-xs text-muted-foreground mt-1">USDC as Native Gas ⚡</p>
                      )}
                    </div>
                    <Button 
                      variant="outline" 
                      className="w-full gap-2"
                      onClick={() => {
                        const explorerUrl = import.meta.env.VITE_BLOCKCHAIN_NETWORK === 'ARC-TESTNET'
                          ? `https://testnet.arcscan.app/address/${counterpartyAddress}`
                          : import.meta.env.VITE_BLOCKCHAIN_NETWORK === 'MATIC-AMOY'
                          ? `https://amoy.polygonscan.com/address/${counterpartyAddress}`
                          : `https://sepolia.etherscan.io/address/${counterpartyAddress}`;
                        window.open(explorerUrl, '_blank');
                      }}
                    >
                      <ExternalLink className="w-4 h-4" />
                      View on Explorer
                    </Button>
                  </div>
                </Card>
              )}

              {/* A2A Info Section */}
              {!contract.a2a_enabled && contract.status === 'active' && (
                <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
                  <div className="flex gap-3">
                    <span className="text-2xl">🤖</span>
                    <div>
                      <h4 className="font-semibold text-sm mb-1">What is A2A?</h4>
                      <p className="text-xs text-muted-foreground">
                        Enable autonomous payments where AI agents verify and execute payments automatically based on your contract terms. No manual approval needed!
                      </p>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          </div>

          {/* Payment History Section */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-primary" />
              Payment History
            </h2>
            {paymentHistory.length > 0 ? (
              <div className="space-y-4">
                {paymentHistory.map((transaction) => (
                  <div 
                    key={transaction.id} 
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={
                          transaction.status === 'completed' ? 'default' :
                          transaction.status === 'pending' ? 'secondary' :
                          'destructive'
                        }>
                          {transaction.status}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(transaction.executed_at || transaction.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="font-semibold text-lg">
                        {parseFloat(transaction.amount_usdc).toFixed(2)} USDC
                      </p>
                      {transaction.tx_hash && (
                        <code className="text-xs text-muted-foreground">
                          TX: {transaction.tx_hash.slice(0, 10)}...{transaction.tx_hash.slice(-8)}
                        </code>
                      )}
                    </div>
                    {transaction.tx_hash && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => {
                          const explorerUrl = import.meta.env.VITE_BLOCKCHAIN_NETWORK === 'ARC-TESTNET'
                            ? `https://testnet.arcscan.app/tx/${transaction.tx_hash}`
                            : import.meta.env.VITE_BLOCKCHAIN_NETWORK === 'MATIC-AMOY'
                            ? `https://amoy.polygonscan.com/tx/${transaction.tx_hash}`
                            : `https://sepolia.etherscan.io/tx/${transaction.tx_hash}`;
                          window.open(explorerUrl, '_blank');
                        }}
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">No payments executed yet</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Payment history will appear here once transactions are processed
                </p>
              </div>
            )}
          </Card>
        </div>
      </main>

      {/* Payment Dialog - Reusable Component */}
      {contract && (
        <PaymentDialog
          open={showPaymentDialog}
          onOpenChange={setShowPaymentDialog}
          contract={contract}
          onExecute={handleExecutePayment}
          onPaymentSuccess={async () => {
            // Refresh contract and payment history
            const updatedContract = await contractsAPI.getById(id!);
            setContract(updatedContract.contract);
            
            const historyResponse = await paymentsAPI.getHistory({ contractId: id });
            if (historyResponse.success) {
              setPaymentHistory(historyResponse.transactions || []);
            }
          }}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Contract?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The contract will be permanently cancelled
              and no further payments will be processed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>Keep Contract</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelContract}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Cancelling...
                </>
              ) : (
                "Cancel Contract"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ContractDetail;

