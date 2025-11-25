// frontend/src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { localStorageService } from '../utils/localStorageService';

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

  // Helper function to clear guest data when user logs in
  const clearGuestData = (): void => {
    console.log('🧹 Clearing guest data from localStorage');
    
    // Clear current user if it's a guest
    const currentUser = localStorageService.getCurrentUser();
    if (currentUser && currentUser.username.startsWith('guest_')) {
      localStorageService.clearCurrentUser();
    }
    
    // Only clear guest projects, keep user project IDs
    const allProjects = localStorageService.getAllProjects();
    const guestProjects = allProjects.filter(p => p.is_guest_project === true);
    
    if (guestProjects.length > 0) {
      console.log(`🗑️ Removing ${guestProjects.length} guest projects`);
      guestProjects.forEach(project => {
        localStorageService.deleteProject(project.project_id);
      });
    }
    
    // Clear any guest-related user stories, wireframes, scenarios
    try {
      const userStories = localStorageService.getAllUserStories();
      const guestUserStories = userStories.filter(us => 
        guestProjects.some(p => p.project_id === us.project_id)
      );
      if (guestUserStories.length > 0) {
        console.log(`🗑️ Removing ${guestUserStories.length} guest user stories`);
      }

      const wireframes = localStorageService.getAllWireframes();
      const guestWireframes = wireframes.filter(w => 
        guestProjects.some(p => p.project_id === w.project_id)
      );
      if (guestWireframes.length > 0) {
        console.log(`🗑️ Removing ${guestWireframes.length} guest wireframes`);
      }

      const scenarios = localStorageService.getAllScenarios();
      const guestScenarios = scenarios.filter(s => 
        guestProjects.some(p => p.project_id === s.project_id)
      );
      if (guestScenarios.length > 0) {
        console.log(`🗑️ Removing ${guestScenarios.length} guest scenarios`);
      }
    } catch (error) {
      console.warn('⚠️ Error cleaning guest data:', error);
    }
  };

  // Helper function to clear all local data on logout
  const clearAllLocalData = (): void => {
    console.log('🧹 Clearing all localStorage data on logout');
    
    // Clear user project IDs along with other data
    localStorage.removeItem('user_project_ids');
    
    // Clear all localStorage service data
    localStorageService.clearAllData();
    
    // Clear auth-related items
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user');
    localStorage.removeItem('current_project_id');
  };

  // Check and clean storage on initial load
  useEffect(() => {
    const checkAndCleanStorage = () => {
      const token = localStorage.getItem('access_token');
      const currentUser = localStorageService.getCurrentUser();
      
      // If user is logged in but there's guest data, clean it
      if (token && currentUser && currentUser.username.startsWith('guest_')) {
        console.log('🔄 Cleaning guest data on page load for logged-in user');
        clearGuestData();
      }
    };

    checkAndCleanStorage();
  }, []);

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
    
    // Clear guest data before setting new user data
    clearGuestData();
    
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
      // Clear all local data including user project IDs
      clearAllLocalData();
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