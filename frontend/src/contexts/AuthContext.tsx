import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from '@/services/api';

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  circle_wallet_id?: string | null;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  getUserId: () => string | null;
  getUserEmail: () => string | null;
  getUserRole: () => string | null;
  getWalletId: () => string | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    const currentUser = authAPI.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await authAPI.login(email, password);
    setUser(data.user);
  };

  const signup = async (name: string, email: string, password: string) => {
    const data = await authAPI.signup(name, email, password);
    setUser(data.user);
  };

  const logout = () => {
    authAPI.logout();
    setUser(null);
  };

  // Helper functions to easily access user data
  const getUserId = () => user?.id || null;
  const getUserEmail = () => user?.email || null;
  const getUserRole = () => user?.role || null;
  const getWalletId = () => user?.circle_wallet_id || null;

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        getUserId,
        getUserEmail,
        getUserRole,
        getWalletId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

