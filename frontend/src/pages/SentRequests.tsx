import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Bell, ArrowLeft, ExternalLink } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { requestCenterAPI } from "@/services/api";
import { toast } from "sonner";

const SentRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchSentRequests();
  }, []);

  const fetchSentRequests = async () => {
    try {
      setIsLoading(true);
      const response = await requestCenterAPI.getSentRequests();
      console.log('📤 Sent Requests Response:', response);
      setRequests(response.requests || []);
    } catch (error: any) {
      console.error('Failed to fetch sent requests:', error);
      toast.error('Failed to load sent requests');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { bg: string; text: string; label: string } } = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '⏳ Pending' },
      approved: { bg: 'bg-blue-100', text: 'text-blue-800', label: '✅ Approved' },
      paid: { bg: 'bg-green-100', text: 'text-green-800', label: '💰 Paid' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800', label: '❌ Rejected' },
      failed: { bg: 'bg-gray-100', text: 'text-gray-800', label: '⚠️ Failed' }
    };

    const badge = badges[status] || badges.pending;

    return (
      <Badge className={`${badge.bg} ${badge.text} border-0`}>
        {badge.label}
      </Badge>
    );
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
              <Button
                variant="ghost"
                size="sm"
                className="mb-2"
                onClick={() => navigate('/request-center/contracts')}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Request Contracts
              </Button>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                📤 Sent Payment Requests
              </h1>
              <p className="text-muted-foreground mt-1">Track payment requests you've sent to payers</p>
            </div>
            <Button variant="ghost" size="icon">
              <Bell className="w-5 h-5" />
            </Button>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {/* Tabs */}
          <div className="flex gap-2 border-b">
            <Button
              variant="ghost"
              className="rounded-none"
              onClick={() => navigate('/request-center/contracts')}
            >
              📋 Request Contracts
            </Button>
            <Button
              variant="ghost"
              className="border-b-2 border-blue-500 rounded-none"
              onClick={() => {}}
            >
              📤 Sent Requests
            </Button>
          </div>

          {/* Requests List */}
          {isLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading sent requests...</p>
            </div>
          ) : requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => (
                <Card key={request.id} className="p-6 border-l-4 border-l-purple-500">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">
                          {request.description || request.contract_title || 'Payment Request'}
                        </h3>
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Contract: {request.contract_title || 'N/A'}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primary">
                        ${parseFloat(request.amount).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">USDC</p>
                    </div>
                  </div>

                  {/* Request Details */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Network</p>
                      <p className="text-sm font-semibold">{request.network}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Payer Address</p>
                      <p className="text-sm font-mono text-xs">
                        {request.to_agent_wallet_address?.slice(0, 6)}...
                        {request.to_agent_wallet_address?.slice(-4)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Sent At</p>
                      <p className="text-sm">
                        {new Date(request.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">A2A Mode</p>
                      <p className="text-sm">
                        {request.a2a_enabled ? (
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100 border-0">
                            🤖 {request.a2a_approval_mode || 'manual'}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Manual</span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Agent Decision Log */}
                  {request.agent_decision_log && (
                    <div className="mb-4">
                      <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">🤖</span>
                          <div className="flex-1">
                            <p className="text-sm font-semibold text-purple-800 dark:text-purple-200 mb-2">
                              AI Agent Decision
                            </p>
                            <p className="text-sm text-purple-700 dark:text-purple-300 mb-2">
                              {request.agent_decision_log.reasoning || 'Decision logged'}
                            </p>
                            <div className="flex items-center gap-4 text-xs text-purple-600 dark:text-purple-400">
                              <span>
                                Decision: {request.agent_decision_log.approved ? '✅ Approved' : '❌ Rejected'}
                              </span>
                              <span>
                                Mode: {request.agent_decision_log.mode || 'manual'}
                              </span>
                              <span>
                                {new Date(request.agent_decision_log.timestamp).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Activity Timeline */}
                  <div className="border-t pt-4">
                    <p className="text-xs font-semibold text-muted-foreground mb-3">📜 Activity Timeline</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                        <span className="text-muted-foreground">
                          {new Date(request.created_at).toLocaleString()} - Request sent
                        </span>
                      </div>
                      
                      {request.agent_decision_log && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className={`w-2 h-2 rounded-full ${
                            request.agent_decision_log.approved ? 'bg-green-500' : 'bg-red-500'
                          }`}></div>
                          <span className="text-muted-foreground">
                            {new Date(request.agent_decision_log.timestamp).toLocaleString()} - 
                            Agent {request.agent_decision_log.approved ? 'approved' : 'rejected'}
                          </span>
                        </div>
                      )}

                      {request.status === 'paid' && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-green-500"></div>
                          <span className="text-muted-foreground">
                            {new Date(request.updated_at).toLocaleString()} - Payment executed
                          </span>
                        </div>
                      )}

                      {request.status === 'pending' && !request.agent_decision_log && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                          <span className="text-muted-foreground">
                            Waiting for payer's agent evaluation...
                          </span>
                        </div>
                      )}

                      {request.status === 'approved' && (
                        <div className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
                          <span className="text-muted-foreground">
                            Approved - waiting for payment execution...
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/contracts/${request.contract_id}`)}
                    >
                      View Contract
                    </Button>
                    {request.status === 'paid' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1"
                      >
                        View Transaction
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">📤</div>
              <h3 className="text-2xl font-bold mb-2">No sent requests yet</h3>
              <p className="text-muted-foreground mb-6">
                Go to Request Contracts and click "Send Request" to send your first payment request
              </p>
              <Button
                variant="gradient"
                onClick={() => navigate('/request-center/contracts')}
              >
                View Request Contracts
              </Button>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
};

export default SentRequests;

