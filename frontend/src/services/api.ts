import axios from 'axios';

// Base API URL - connects to our Express backend
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests if it exists
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors (unauthorized)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login if it's NOT a login/signup request failure
    const isAuthRequest = error.config?.url?.includes('/auth/login') || 
                          error.config?.url?.includes('/auth/signup');
    
    if (error.response?.status === 401 && !isAuthRequest) {
      // Token expired or invalid - clear storage and redirect
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    
    // For auth requests or other errors, just reject (let component handle it)
    return Promise.reject(error);
  }
);

// =====================
// AUTH API
// =====================
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  signup: async (name: string, email: string, password: string) => {
    const response = await api.post('/auth/signup', { full_name: name, email, password });
    if (response.data.token) {
      localStorage.setItem('auth_token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
    }
    return response.data;
  },

  logout: () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isAuthenticated: () => {
    return !!localStorage.getItem('auth_token');
  },
};

// =====================
// CONTRACTS API
// =====================
export const contractsAPI = {
  getAll: async () => {
    const response = await api.get('/contracts');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/contracts/${id}`);
    return response.data;
  },

  create: async (contractData: any) => {
    const response = await api.post('/contracts/register', contractData);
    return response.data;
  },

  updateStatus: async (id: string, status: string) => {
    const response = await api.patch(`/contracts/${id}/status`, { status });
    return response.data;
  },
};

// =====================
// PAYMENTS API
// =====================
export const paymentsAPI = {
  getAll: async () => {
    const response = await api.get('/payments');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/payments/${id}`);
    return response.data;
  },

  execute: async (paymentData: {
    sourceWalletId: string;
    destinationWalletId: string;
    amount: string;
    contractId: string;
    metadata?: any;
  }) => {
    const response = await api.post('/payments/execute', paymentData);
    return response.data;
  },

  schedule: async (paymentData: any) => {
    const response = await api.post('/payments/schedule', paymentData);
    return response.data;
  },

  trigger: async (paymentId: string) => {
    const response = await api.post(`/payments/${paymentId}/trigger`);
    return response.data;
  },

  getHistory: async (filters?: any) => {
    const response = await api.get('/payments/history', { params: filters });
    return response.data;
  },

  getAllTransactions: async () => {
    const response = await api.get('/payments/all-transactions');
    return response.data;
  },

  getStatus: async (transactionId: string) => {
    const response = await api.get(`/payments/status/${transactionId}`);
    return response.data;
  },
};

// =====================
// WALLETS API
// =====================
export const walletsAPI = {
  getAll: async () => {
    const response = await api.get('/wallets');
    return response.data;
  },

  getMy: async () => {
    const response = await api.get('/wallets/me');
    return response.data;
  },

  create: async (walletData: any) => {
    const response = await api.post('/wallets/create', walletData);
    return response.data;
  },

  getBalance: async (walletId: string) => {
    const response = await api.get(`/wallets/${walletId}/balance`);
    return response.data;
  },

  send: async (walletId: string, to: string, amount: string, note?: string, destChain?: string) => {
    const payload: any = { to, amount };
    if (note) payload.note = note;
    if (destChain) payload.destChain = destChain; // Only include if cross-chain
    
    const response = await api.post(`/wallets/${walletId}/send`, payload);
    return response.data;
  },

  getTransactions: async (walletId: string, limit?: number) => {
    const response = await api.get(`/wallets/${walletId}/transactions`, {
      // params: { limit }
    });
    // console.log('🔍 Transactions response:', response.data);
    return response.data;
  },

  // Detect wallet blockchain by address
  detectBlockchain: async (address: string) => {
    const response = await api.post('/wallets/detect-blockchain', { address });
    return response.data;
  },
};

// =====================
// ASSETS API
// =====================
export const assetsAPI = {
  getAll: async () => {
    const response = await api.get('/assets');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/assets/${id}`);
    return response.data;
  },

  register: async (assetData: any) => {
    const response = await api.post('/assets/register', assetData);
    return response.data;
  },
};

// =====================
// RECIPIENTS API
// =====================
export const recipientsAPI = {
  save: async (data: {
    recipient_name: string;
    wallet_address: string;
    nickname?: string;
    notes?: string;
  }) => {
    const response = await api.post('/recipients/save', data);
    return response.data;
  },

  list: async () => {
    const response = await api.get('/recipients/list');
    return response.data;
  },

  getById: async (id: string) => {
    const response = await api.get(`/recipients/${id}`);
    return response.data;
  },

  update: async (id: string, data: {
    recipient_name?: string;
    wallet_address?: string;
    nickname?: string;
    notes?: string;
  }) => {
    const response = await api.put(`/recipients/${id}`, data);
    return response.data;
  },

  delete: async (id: string) => {
    const response = await api.delete(`/recipients/${id}`);
    return response.data;
  }
};

// =====================
// API KEYS API
// =====================
export const apiKeysAPI = {
  save: async (data: {
    service_name: string;
    api_key: string;
    additional_config?: any;
  }) => {
    const response = await api.post('/api-keys/save', data);
    return response.data;
  },

  list: async () => {
    const response = await api.get('/api-keys/list');
    return response.data;
  },

  delete: async (service_name: string) => {
    const response = await api.delete(`/api-keys/${service_name}`);
    return response.data;
  },

  toggle: async (service_name: string) => {
    const response = await api.patch(`/api-keys/${service_name}/toggle`);
    return response.data;
  }
};

// =====================
// VOICE API
// =====================
export const voiceAPI = {
  speechToText: async (formData: FormData) => {
    const response = await api.post('/voice/speech-to-text', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  textToSpeech: async (text: string) => {
    const response = await api.post('/voice/text-to-speech', { text });
    return response.data;
  },

  processContract: async (transcript: string, context?: any) => {
    const response = await api.post('/voice/process-contract', { 
      transcript, 
      context 
    });
    return response.data;
  },

  confirmRecipient: async (recipientId: string, context: any) => {
    const response = await api.post('/voice/confirm-recipient', {
      recipient_id: recipientId,
      context
    });
    return response.data;
  }
};

// =====================
// A2A (Agent-to-Agent) API
// =====================
export const a2aAPI = {
  // Enable A2A for a contract
  enableA2A: async (contractId: string, approvalMode: 'manual' | 'auto' = 'manual') => {
    const response = await api.post(`/a2a/contracts/${contractId}/enable-a2a`, {
      approvalMode
    });
    return response.data;
  },

  // Disable A2A for a contract
  disableA2A: async (contractId: string) => {
    const response = await api.post(`/a2a/contracts/${contractId}/disable-a2a`);
    return response.data;
  },

  // Get all A2A requests
  getRequests: async (status?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (limit) params.append('limit', limit.toString());
    
    const response = await api.get(`/a2a/requests?${params.toString()}`);
    return response.data;
  },

  // Agent makes a decision on payment
  agentDecide: async (contractId: string, paymentRequest: any) => {
    const response = await api.post('/a2a/decide', {
      contractId,
      paymentRequest
    });
    return response.data;
  },

  // Get activity log
  getActivityLog: async (contractId?: string, limit?: number) => {
    const params = new URLSearchParams();
    if (contractId) params.append('contractId', contractId);
    if (limit) params.append('limit', limit.toString());
    
    const response = await api.get(`/a2a/activity-log?${params.toString()}`);
    return response.data;
  },

  // Create payment request (for testing/demo)
  createRequest: async (data: {
    contractId: string;
    amount: string;
    description: string;
    fromWalletId: string;
    toWalletAddress: string;
    network: string;
  }) => {
    const response = await api.post('/a2a/request', data);
    return response.data;
  },

  // Process payment request
  processRequest: async (paymentRequest: any, walletId: string, autoApprove: boolean = false) => {
    const response = await api.post('/a2a/process', {
      paymentRequest,
      walletId,
      autoApprove
    });
    return response.data;
  },

  // Get payment status
  getStatus: async (paymentId: string) => {
    const response = await api.get(`/a2a/status/${paymentId}`);
    return response.data;
  },

  // Execute payment manually for an approved request
  executePayment: async (requestId: string) => {
    const response = await api.post(`/a2a/execute-payment/${requestId}`);
    return response.data;
  }
};

// =====================
// REQUEST CENTER API
// For users acting as REQUESTERS (sending payment requests)
// =====================
export const requestCenterAPI = {
  // Get all request contracts (where user is payee/requester)
  getContracts: async () => {
    const response = await api.get('/request-center/contracts');
    return response.data;
  },

  // Get single request contract
  getContract: async (contractId: string) => {
    const response = await api.get(`/request-center/contracts/${contractId}`);
    return response.data;
  },

  // Send payment request for a contract
  sendRequest: async (contractId: string, data?: { amount?: string; description?: string }) => {
    const response = await api.post(`/request-center/send-request/${contractId}`, data || {});
    return response.data;
  },

  // Get all sent requests
  getSentRequests: async (limit?: number) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    
    const response = await api.get(`/request-center/sent-requests?${params.toString()}`);
    return response.data;
  },

  // Get single sent request
  getSentRequest: async (requestId: string) => {
    const response = await api.get(`/request-center/sent-requests/${requestId}`);
    return response.data;
  }
};

export default api;


