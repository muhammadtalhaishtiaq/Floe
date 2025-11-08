import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  DollarSign, 
  Calendar, 
  User, 
  AlertCircle,
  Loader2,
  Send,
  Bot,
  XCircle
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { contractsAPI, a2aAPI, requestCenterAPI } from "@/services/api";
import { toast } from "sonner";

const RequestContractDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEnablingA2A, setIsEnablingA2A] = useState(false);
  const [isSendingRequest, setIsSendingRequest] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    fetchContract();
  }, [id]);

  const fetchContract = async () => {
    try {
      console.log(`🔍 Fetching contract with ID: ${id}`);
      const response = await contractsAPI.getById(id!);
      console.log("📋 Contract Response:", response);
      
      if (response.success && response.contract) {
        setContract(response.contract);
      } else {
        toast.error("Invalid contract data received");
      }
    } catch (error: any) {
      console.error("❌ Failed to fetch contract:", error);
      toast.error("Failed to load contract details");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEnableA2A = async (mode: 'manual' | 'auto' = 'auto') => {
    if (!contract) return;
    
    setIsEnablingA2A(true);
    try {
      const result = await a2aAPI.enableA2A(contract.id, mode);
      toast.success(`🤖 A2A Enabled in ${mode.toUpperCase()} mode! AI agents will ${mode === 'auto' ? 'automatically' : 'manually'} handle payment decisions.`);
      await fetchContract();
      setShowModeSelector(false);
    } catch (error: any) {
      console.error('Failed to enable A2A:', error);
      toast.error(error.response?.data?.error || "Failed to enable A2A");
    } finally {
      setIsEnablingA2A(false);
    }
  };

  const handleSendRequest = async () => {
    if (!contract) return;
    
    setIsSendingRequest(true);
    try {
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
      setIsSendingRequest(false);
    }
  };

  const handleCancel = async () => {
    if (!contract) return;
    
    setIsCancelling(true);
    try {
      await contractsAPI.updateStatus(contract.id, 'cancelled');
      toast.success("Contract cancelled successfully");
      navigate('/request-center/contracts');
    } catch (error: any) {
      console.error('Failed to cancel contract:', error);
      toast.error(error.response?.data?.error || "Failed to cancel contract");
    } finally {
      setIsCancelling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'completed':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'cancelled':
        return 'bg-red-500/10 text-red-500 border-red-500/20';
      default:
        return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
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
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Contract Not Found</h2>
            <p className="text-muted-foreground mb-6">The contract you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/request-center/contracts')}>
              Back to Request Contracts
            </Button>
          </div>
        </main>
      </div>
    );
  }

  // Parse contract data
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

  const contractName = parsedData.contract_name || contract.asset_description || 'Request Contract';
  const payerAddress = parsedData.counterparty_address || 'N/A';

  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />

      <main className="flex-1 overflow-auto">
        {/* Header */}
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
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">{contractName}</h1>
                <p className="text-muted-foreground mt-1">Request Contract Details</p>
              </div>
              <Badge className={`border ${getStatusColor(contract.status)}`}>
                {contract.status.charAt(0).toUpperCase() + contract.status.slice(1)}
              </Badge>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6 max-w-4xl mx-auto">
          {/* Info Banner */}
          <Card className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border-purple-200 dark:border-purple-800">
            <div className="flex gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h4 className="font-semibold text-sm mb-1">You are the PAYEE</h4>
                <p className="text-xs text-muted-foreground">
                  This contract is for payments YOU will receive. Send a request to the payer and let AI agents handle the approval process!
                </p>
              </div>
            </div>
          </Card>

          {/* Contract Details */}
          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Contract Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-3">
                <DollarSign className="w-5 h-5 text-primary mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Amount</p>
                  <p className="text-2xl font-bold">${parseFloat(contract.total_amount_usdc).toFixed(2)} USDC</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-primary mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Payment Type</p>
                  <p className="font-semibold capitalize">{contract.payment_type?.replace('_', ' ')}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-primary mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Payer Address</p>
                  <p className="font-mono text-sm break-all">
                    {payerAddress !== 'N/A' ? payerAddress : 'Not specified'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-primary mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-semibold">
                    {contract.start_date ? new Date(contract.start_date).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>

              {contract.end_date && (
                <div className="flex items-start gap-3">
                  <Calendar className="w-5 h-5 text-primary mt-1" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-semibold">
                      {new Date(contract.end_date).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Bot className="w-5 h-5 text-primary mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">A2A Status</p>
                  <p className="font-semibold">
                    {contract.a2a_enabled ? (
                      <span className="text-green-600">✅ Enabled ({contract.a2a_approval_mode})</span>
                    ) : (
                      <span className="text-gray-500">❌ Disabled</span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            {parsedData.description && (
              <div className="mt-6 pt-6 border-t">
                <p className="text-sm text-muted-foreground mb-2">Description</p>
                <p className="text-sm">{parsedData.description}</p>
              </div>
            )}
          </Card>

          {/* Action Buttons */}
          {contract.status === 'active' && (
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Actions</h2>
              
              {/* A2A Required Notice */}
              {!contract.a2a_enabled && (
                <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                  <div className="flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-800 dark:text-amber-200 text-sm">A2A Required</p>
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                        You must activate A2A Payments first. This enables AI agents to automatically evaluate and process payment requests!
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-3">
                {/* A2A Toggle */}
                {!contract.a2a_enabled ? (
                  <>
                    {!showModeSelector ? (
                      <Button
                        variant="outline"
                        className="w-full justify-start gap-3 hover:bg-purple-50 dark:hover:bg-purple-950/20 border-purple-200"
                        onClick={() => setShowModeSelector(true)}
                        disabled={isEnablingA2A}
                      >
                        <Bot className="w-5 h-5" />
                        <div className="flex-1 text-left">
                          <div className="font-semibold">Activate A2A Payments - AI Agents</div>
                          <div className="text-xs text-muted-foreground">Let AI agents automatically evaluate and approve payments</div>
                        </div>
                      </Button>
                    ) : (
                      <div className="border rounded-lg p-4 space-y-3">
                        <h4 className="font-semibold text-sm">Select A2A Mode:</h4>
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-3 bg-green-50 dark:bg-green-950/20 border-green-500 hover:bg-green-100"
                          onClick={() => handleEnableA2A('auto')}
                          disabled={isEnablingA2A}
                        >
                          {isEnablingA2A ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-lg">⚡</span>}
                          <div className="flex-1 text-left">
                            <div className="font-semibold text-green-700">AUTO Mode (Recommended)</div>
                            <div className="text-xs text-green-600">AI agents approve & execute payments automatically</div>
                          </div>
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start gap-3"
                          onClick={() => handleEnableA2A('manual')}
                          disabled={isEnablingA2A}
                        >
                          {isEnablingA2A ? <Loader2 className="w-5 h-5 animate-spin" /> : <span className="text-lg">👤</span>}
                          <div className="flex-1 text-left">
                            <div className="font-semibold">MANUAL Mode</div>
                            <div className="text-xs text-muted-foreground">AI evaluates but requires your approval</div>
                          </div>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowModeSelector(false)}
                          className="w-full"
                        >
                          Cancel
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Bot className="w-5 h-5 text-green-600" />
                      <div>
                        <p className="font-semibold text-green-800 dark:text-green-200">A2A Enabled</p>
                        <p className="text-xs text-green-700 dark:text-green-300">
                          AI agents ready in {contract.a2a_approval_mode?.toUpperCase()} mode
                          {contract.a2a_approval_mode === 'auto' ? ' - Payments execute automatically!' : ' - Manual approval required'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Send Request Button */}
                <Button
                  className="w-full justify-start gap-3 bg-gradient-to-r from-purple-500 to-blue-500 hover:from-purple-600 hover:to-blue-600 text-white"
                  onClick={handleSendRequest}
                  disabled={isSendingRequest || !contract.a2a_enabled}
                >
                  {isSendingRequest ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Send Payment Request</div>
                    <div className="text-xs opacity-90">
                      {contract.a2a_enabled 
                        ? `Request $${parseFloat(contract.total_amount_usdc).toFixed(2)} USDC from payer`
                        : "⚠️ Enable A2A first to send requests"
                      }
                    </div>
                  </div>
                </Button>

                {/* Cancel Button */}
                <Button
                  variant="destructive"
                  className="w-full justify-start gap-3"
                  onClick={handleCancel}
                  disabled={isCancelling}
                >
                  {isCancelling ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <XCircle className="w-5 h-5" />
                  )}
                  <div className="flex-1 text-left">
                    <div className="font-semibold">Cancel Contract</div>
                    <div className="text-xs opacity-90">Permanently cancel this request contract</div>
                  </div>
                </Button>
              </div>
            </Card>
          )}

          {contract.status === 'cancelled' && (
            <Card className="p-6 bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800">
              <div className="flex items-center gap-3">
                <XCircle className="w-6 h-6 text-red-600" />
                <div>
                  <h3 className="font-semibold text-red-800 dark:text-red-200">Contract Cancelled</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">This contract has been cancelled and cannot be used.</p>
                </div>
              </div>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default RequestContractDetail;

