import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppSidebar from '@/components/AppSidebar';
import { a2aAPI } from '@/services/api';
import { toast } from 'sonner';

interface A2ARequest {
  id: string;
  contract_id: string;
  from_agent_wallet_id: string;
  to_agent_wallet_address: string;
  amount: string;
  network: string;
  description: string;
  status: string;
  payment_requirements: any;
  created_at: string;
  updated_at: string;
}

const A2ARequests: React.FC = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState<A2ARequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing' | 'activity' | 'upcoming'>('incoming');
  const [activities, setActivities] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // Get current user ID from localStorage
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        setCurrentUserId(userData.id || userData.userId);
      } catch (e) {
        console.error('Failed to parse user data:', e);
      }
    }
    
    fetchA2ARequests();
    if (activeTab === 'activity') {
      fetchActivityLog();
    }
  }, [activeTab]);

  const fetchA2ARequests = async () => {
    try {
      setLoading(true);
      
      console.log('🔍 Fetching A2A requests...');
      
      // Fetch real A2A requests from backend
      const response = await a2aAPI.getRequests(undefined, 50);
      
      console.log('📦 API Response:', response);
      console.log('📋 Requests:', response.requests);
      
      if (response.success) {
        const allRequests = response.requests || [];
        console.log(`✅ Found ${allRequests.length} total requests`);
        setRequests(allRequests);
      } else {
        console.error('❌ API returned success: false');
        toast.error('Failed to load requests');
      }
    } catch (error: any) {
      console.error('❌ Failed to fetch A2A requests:', error);
      console.error('Error details:', error.response?.data);
      toast.error('Failed to load A2A requests: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLog = async () => {
    try {
      const response = await a2aAPI.getActivityLog(undefined, 50);
      
      if (response.success) {
        setActivities(response.activities || []);
      }
    } catch (error: any) {
      console.error('Failed to fetch activity log:', error);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    try {
      const request = requests.find(r => r.id === requestId);
      
      if (!request) {
        toast.error('Request not found');
        return;
      }

      toast.info('🤖 AI Agent evaluating payment...');

      // Step 1: Call agent decision endpoint
      const decisionResponse = await a2aAPI.agentDecide(request.contract_id, {
        amount: request.amount,
        fromAddress: request.from_agent_wallet_id,
        toAddress: request.to_agent_wallet_address,
        network: request.network,
        description: request.description,
        requestedAt: new Date(request.created_at)
      });

      console.log('🤖 Agent Decision:', decisionResponse);

      if (!decisionResponse.success) {
        toast.error('Agent decision failed: ' + decisionResponse.error);
        return;
      }

      const decision = decisionResponse.decision;

      // Step 2: Show agent reasoning to user
      if (decision.approved) {
        toast.success(`✅ Agent Approved!\n\n${decision.reasoning}`, { duration: 5000 });
        
        // Step 3: Execute payment
        toast.info('💸 Executing payment...');
        
        try {
          const paymentResponse = await a2aAPI.executePayment(requestId);
          
          if (paymentResponse.success) {
            toast.success('✅ Payment executed successfully!', { duration: 5000 });
          } else {
            toast.error('Payment execution failed: ' + paymentResponse.error);
          }
        } catch (paymentError: any) {
          console.error('Payment execution failed:', paymentError);
          toast.error('Payment execution failed: ' + (paymentError.response?.data?.error || paymentError.message));
        }
        
        // Refresh requests to show updated status
        setTimeout(() => {
          fetchA2ARequests();
          fetchActivityLog();
        }, 2000);
      } else {
        toast.error(`❌ Agent Rejected!\n\n${decision.reasoning}`, { duration: 5000 });
        
        // Refresh to show rejected status
        setTimeout(() => {
          fetchA2ARequests();
          fetchActivityLog();
        }, 2000);
      }
      
    } catch (error: any) {
      console.error('Failed to process payment:', error);
      toast.error('Failed to process payment: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    // TODO: Implement reject functionality
    alert('Request rejected');
    fetchA2ARequests();
  };

  const handleExecutePayment = async (requestId: string) => {
    try {
      toast.info('💸 Executing payment...');
      
      const paymentResponse = await a2aAPI.executePayment(requestId);
      
      if (paymentResponse.success) {
        toast.success('✅ Payment executed successfully!', { duration: 5000 });
        
        // Refresh requests to show updated status
        setTimeout(() => {
          fetchA2ARequests();
          fetchActivityLog();
        }, 2000);
      } else {
        toast.error('Payment execution failed: ' + paymentResponse.error);
      }
    } catch (error: any) {
      console.error('Payment execution failed:', error);
      toast.error('Payment execution failed: ' + (error.response?.data?.error || error.message));
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: { [key: string]: { bg: string; text: string } } = {
      pending: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
      approved: { bg: 'bg-blue-100', text: 'text-blue-800' },
      paid: { bg: 'bg-green-100', text: 'text-green-800' },
      rejected: { bg: 'bg-red-100', text: 'text-red-800' },
      failed: { bg: 'bg-gray-100', text: 'text-gray-800' }
    };

    const badge = badges[status] || badges.pending;

    return (
      <span className={`px-3 py-1 rounded-full text-sm font-medium ${badge.bg} ${badge.text}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
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
          <div className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
                  🤖 Agent-to-Agent Payments
                </h1>
                <p className="text-muted-foreground">
                  Autonomous payment requests between AI agents
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Tabs */}
          <div className="bg-card rounded-lg shadow-sm border">
            <div className="flex border-b overflow-x-auto">
              <button
                onClick={() => setActiveTab('incoming')}
                className={`flex-1 px-6 py-4 text-center font-medium transition whitespace-nowrap ${
                  activeTab === 'incoming'
                    ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                📥 Incoming Requests
                {(() => {
                  const incomingCount = requests.filter(r => {
                    if (!currentUserId) return false;
                    const isPayer = (r as any).payer_id === currentUserId;
                    const isPending = r.status === 'pending' || r.status === 'approved';
                    return isPayer && isPending;
                  }).length;
                  return incomingCount > 0 && (
                    <span className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded-full">
                      {incomingCount}
                    </span>
                  );
                })()}
              </button>
              <button
                onClick={() => setActiveTab('outgoing')}
                className={`flex-1 px-6 py-4 text-center font-medium transition whitespace-nowrap ${
                  activeTab === 'outgoing'
                    ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-950/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                📤 Outgoing Requests
                {(() => {
                  const outgoingCount = requests.filter(r => {
                    if (!currentUserId) return false;
                    const isPayee = (r as any).payee_id === currentUserId;
                    const isPending = r.status === 'pending' || r.status === 'approved';
                    return isPayee && isPending;
                  }).length;
                  return outgoingCount > 0 && (
                    <span className="ml-2 px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                      {outgoingCount}
                    </span>
                  );
                })()}
              </button>
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex-1 px-6 py-4 text-center font-medium transition whitespace-nowrap ${
                  activeTab === 'activity'
                    ? 'border-b-2 border-purple-500 text-purple-600 bg-purple-50 dark:bg-purple-950/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                📜 Activity Log
              </button>
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`flex-1 px-6 py-4 text-center font-medium transition whitespace-nowrap ${
                  activeTab === 'upcoming'
                    ? 'border-b-2 border-green-500 text-green-600 bg-green-50 dark:bg-green-950/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
              >
                ⏰ Upcoming Payments
              </button>
            </div>
          </div>

        {/* Tab Content */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
            <p className="text-gray-600 mt-4">Loading A2A data...</p>
          </div>
        ) : (
          <>
            {/* Incoming/Outgoing Requests Tab */}
            {(activeTab === 'incoming' || activeTab === 'outgoing') && (
              requests.length === 0 ? (
                <div className="bg-card rounded-lg shadow-sm p-12 text-center border">
                  <div className="text-6xl mb-4">🤖</div>
                  <h3 className="text-xl font-semibold mb-2">
                    No A2A Requests Yet
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {activeTab === 'incoming'
                      ? 'You have no incoming payment requests from AI agents'
                      : 'You have not sent any payment requests yet'}
                  </p>
                  <button
                    onClick={() => navigate('/contracts')}
                    className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                  >
                    Create Contract with A2A
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {requests
                    .filter(request => {
                      if (!currentUserId) return true; // Show all if we can't determine user
                      
                      // Incoming: Requests where YOU are the PAYER (someone requesting payment FROM you)
                      // Outgoing: Requests where YOU are the PAYEE (YOU requesting payment from someone)
                      if (activeTab === 'incoming') {
                        // Show requests where you are the PAYER (contract.payer_id === currentUserId)
                        return (request as any).payer_id === currentUserId;
                      } else {
                        // Show requests where you are the PAYEE (contract.payee_id === currentUserId)
                        return (request as any).payee_id === currentUserId;
                      }
                    })
                    .map((request) => (
                    <div
                      key={request.id}
                      className="bg-card rounded-lg shadow-sm p-6 hover:shadow-md transition border-l-4 border-blue-500 border"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-lg font-semibold">
                              {request.description}
                            </h3>
                            {getStatusBadge(request.status)}
                          </div>

                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Amount</p>
                              <p className="font-semibold text-xl">
                                ${request.amount} USDC
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Network</p>
                              <p className="font-semibold">
                                {request.network}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">
                                {activeTab === 'incoming' ? 'From' : 'To'}
                              </p>
                              <p className="font-mono text-xs">
                                {activeTab === 'incoming'
                                  ? request.from_agent_wallet_id
                                  : request.to_agent_wallet_address}
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Created</p>
                              <p>
                                {new Date(request.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        {activeTab === 'incoming' && request.status === 'pending' && (
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleApproveRequest(request.id)}
                              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition"
                            >
                              ✅ Approve & Pay
                            </button>
                            <button
                              onClick={() => handleRejectRequest(request.id)}
                              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                            >
                              ❌ Reject
                            </button>
                          </div>
                        )}
                        
                        {/* Manual Approval - Execute Payment Button */}
                        {(request.status === 'approved' || request.status === 'pending') && (
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => handleExecutePayment(request.id)}
                              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition flex items-center gap-2"
                            >
                              <span>💸</span>
                              <span>Execute Payment</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Payment Details */}
                      {request.status === 'paid' && (
                        <div className="mt-4 pt-4 border-t">
                          <p className="text-sm text-green-600 dark:text-green-400 flex items-center gap-2">
                            <span>✅</span>
                            <span>Payment completed successfully</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            {/* Activity Log Tab */}
            {activeTab === 'activity' && (
              <div className="bg-card rounded-lg shadow-sm p-6 border">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <span className="text-3xl">📜</span>
                  Agent Activity Timeline
                </h2>
                
                {/* Activity Log */}
                {activities.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">📜</div>
                    <h3 className="text-xl font-semibold mb-2">No Activity Yet</h3>
                    <p className="text-muted-foreground">Agent activity will appear here once A2A is enabled</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {activities.map((activity, index) => (
                      <div key={activity.id || index} className="flex gap-4 items-start">
                        <div className="flex flex-col items-center">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                            activity.status === 'paid' ? 'bg-green-100 text-green-600' :
                            activity.status === 'approved' ? 'bg-blue-100 text-blue-600' :
                            activity.status === 'pending' ? 'bg-yellow-100 text-yellow-600' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {activity.status === 'paid' ? '✓' :
                             activity.status === 'approved' ? '👍' :
                             activity.status === 'pending' ? '⏳' : '📨'}
                          </div>
                          {index < activities.length - 1 && (
                            <div className="w-0.5 h-full bg-border mt-2"></div>
                          )}
                        </div>
                        <div className="flex-1 pb-8">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold">
                              {activity.description || `Payment ${activity.status}`}
                            </h3>
                            <span className="text-sm text-muted-foreground">
                              {new Date(activity.created_at).toLocaleString()}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground mb-3">
                            Amount: ${activity.amount} USDC
                            {activity.contract_title && ` • ${activity.contract_title}`}
                          </p>
                          {activity.agent_decision_log && (
                            <div className="bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                              <p className="text-xs font-semibold text-purple-800 dark:text-purple-200 mb-1">
                                🤖 Agent Reasoning:
                              </p>
                              <p className="text-xs text-purple-700 dark:text-purple-300">
                                {activity.agent_decision_log.reasoning || 'Decision logged'}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Upcoming Payments Tab */}
            {activeTab === 'upcoming' && (
              <div className="bg-card rounded-lg shadow-sm p-6 border">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                  <span className="text-3xl">⏰</span>
                  Scheduled Payments
                </h2>

                {/* Empty State - Real data would come from scheduler */}
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">📅</div>
                  <h3 className="text-xl font-semibold mb-2">No Scheduled Payments</h3>
                  <p className="text-muted-foreground mb-6">
                    Upcoming recurring payments will appear here when scheduled by the payment processor
                  </p>
                  <p className="text-sm text-muted-foreground">
                    The automated scheduler checks for due payments every 5 minutes
                  </p>
                  <button
                    onClick={() => navigate('/contracts')}
                    className="mt-4 px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition"
                  >
                    Go to Contracts
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        </div>
      </main>
    </div>
  );
};

export default A2ARequests;

