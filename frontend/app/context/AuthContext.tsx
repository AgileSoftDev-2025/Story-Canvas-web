// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface User {
  id: number;
  username: string;
  email: string;
}

interface AuthTokens {
  access: string;
  refresh: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  login: (tokens: AuthTokens, userData: User) => void;
  logout: () => Promise<void>;
  loading: boolean;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      try {
        const accessToken = localStorage.getItem('access_token');
        const userData = localStorage.getItem('user');
        
        if (accessToken && userData) {
          const parsedUser = JSON.parse(userData);
          setUser(parsedUser);
          setToken(accessToken);
          console.log('✅ User authenticated from localStorage:', parsedUser.username);
        }
      } catch (error) {
        console.error('❌ Error checking auth:', error);
        // Clear corrupted data
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (tokens: AuthTokens, userData: User) => {
    console.log('🔐 Logging in user:', userData.username);
    localStorage.setItem('access_token', tokens.access);
    localStorage.setItem('refresh_token', tokens.refresh);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    setToken(tokens.access);
    console.log('✅ Login successful');
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await fetch('http://127.0.0.1:8000/api/auth/refresh/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken
        }),
      });

      if (!response.ok) {
        throw new Error('Token refresh failed');
      }

      const result = await response.json();
      
      if (result.success && result.tokens?.access) {
        localStorage.setItem('access_token', result.tokens.access);
        setToken(result.tokens.access);
        console.log('✅ Token refreshed successfully');
        return true;
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('❌ Error refreshing token:', error);
      await logout();
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const refreshToken = localStorage.getItem('refresh_token');
      const accessToken = localStorage.getItem('access_token');
      
      // Call backend signout endpoint if tokens exist
      if (refreshToken && accessToken) {
        await fetch('http://127.0.0.1:8000/api/auth/signout/', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            refresh_token: refreshToken
          }),
        }).catch(error => {
          console.error('❌ Logout API call failed:', error);
        });
      }
    } catch (error) {
      console.error('❌ Error during logout:', error);
    } finally {
      // Clear all auth data from localStorage
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem('current_project_id');
      setUser(null);
      setToken(null);
      console.log('✅ Logout completed');
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user && !!token,
    token,
    login,
    logout,
    loading,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};