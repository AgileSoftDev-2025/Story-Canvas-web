// frontend/src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { authService } from '../utils/authService';
import type { User, AuthTokens } from '../utils/authService';

interface AuthContextType {
  user: User | null;
  tokens: AuthTokens | null;
  login: (tokens: AuthTokens, userData: User) => void;
  logout: () => void;
  signIn: (username: string, password: string) => Promise<{success: boolean; error?: string}>;
  signUp: (email: string, username: string, password: string, passwordConfirmation: string) => 
    Promise<{success: boolean; error?: string; fieldErrors?: Record<string, string>}>;
  isAuthenticated: boolean;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [tokens, setTokens] = useState<AuthTokens | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = () => {
      try {
        const isAuth = authService.isAuthenticated();
        if (isAuth) {
          const storedUser = authService.getCurrentUser();
          const accessToken = authService.getAccessToken();
          const refreshToken = authService.getRefreshToken();
          
          if (storedUser && accessToken) {
            setUser(storedUser);
            setTokens({
              access: accessToken,
              refresh: refreshToken || ''
            });
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = (authTokens: AuthTokens, userData: User) => {
    try {
      // Store tokens
      authService.setTokens(authTokens);
      
      // Store user
      authService.setCurrentUser(userData);
      
      // Update state
      setUser(userData);
      setTokens(authTokens);
      
      console.log("✅ AuthContext login completed");
    } catch (error) {
      console.error('Login error in AuthContext:', error);
      throw error;
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      const result = await authService.signIn(username, password);
      if (result.success && result.tokens && result.user) {
        setUser(result.user);
        setTokens(result.tokens);
      }
      return result;
    } catch (error) {
      console.error('SignIn error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign in failed'
      };
    }
  };

  const signUp = async (email: string, username: string, password: string, passwordConfirmation: string) => {
    try {
      const result = await authService.signUp(email, username, password, passwordConfirmation);
      if (result.success && result.tokens && result.user) {
        setUser(result.user);
        setTokens(result.tokens);
      }
      return result;
    } catch (error) {
      console.error('SignUp error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sign up failed'
      };
    }
  };

  const logout = () => {
  try {
    // First clear ALL localStorage
    localStorage.clear();
    sessionStorage.clear();
    
    // Then clear auth service
    authService.signOut();
    
    // Clear React state
    setUser(null);
    setTokens(null);
    
    console.log("✅ User logged out and ALL localStorage cleared");
    
    // Optional: Reload the page to ensure clean state
    window.location.href = "/"; // Redirect to home
  } catch (error) {
    console.error('Logout error:', error);
  }
};

  const value = {
    user,
    tokens,
    login,
    logout,
    signIn,
    signUp,
    isAuthenticated: !!user,
    loading,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  
  // Provide backward compatibility - map tokens to token property
  return {
    ...context,
    token: context.tokens?.access || null,  // Add token property as alias for tokens.access
  };
};