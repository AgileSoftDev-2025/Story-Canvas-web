import { localStorageService } from "./localStorageService";

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface User {
  id: string;
  username: string;
  email: string;
  is_active: boolean;
  last_login: string;
}

export class AuthService {
  private static instance: AuthService;

  public static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // ===== AUTHENTICATION CHECK =====
  isAuthenticated(): boolean {
    try {
      const token = this.getAccessToken();
      const user = localStorageService.getCurrentUser();
      return !!(token && user);
    } catch (error) {
      console.error('Auth check failed:', error);
      return false;
    }
  }

  // ===== TOKEN MANAGEMENT =====
  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }

  setTokens(tokens: AuthTokens): void {
    try {
      if (tokens.access) {
        localStorage.setItem('access_token', tokens.access);
      }
      if (tokens.refresh) {
        localStorage.setItem('refresh_token', tokens.refresh);
      }
      console.log('✅ Tokens saved to localStorage');
    } catch (error) {
      console.error('❌ Error saving tokens:', error);
      throw error;
    }
  }

  clearTokens(): void {
    try {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      console.log('✅ Tokens cleared from localStorage');
    } catch (error) {
      console.error('❌ Error clearing tokens:', error);
    }
  }

  // ===== USER MANAGEMENT =====
  getCurrentUser(): User | null {
    return localStorageService.getCurrentUser();
  }

  setCurrentUser(userData: any): void {
    try {
      // Format user data to match User interface
      const user: User = {
        id: userData.id || userData.user_id || `user_${Date.now()}`,
        username: userData.username,
        email: userData.email,
        is_active: userData.is_active || true,
        last_login: userData.last_login || new Date().toISOString(),
      };

      // Save to localStorage via localStorageService
      localStorageService.setCurrentUser({
        username: user.username,
        email: user.email,
        is_active: user.is_active,
        last_login: user.last_login,
      });

      console.log('✅ User data saved:', user.username);
    } catch (error) {
      console.error('❌ Error saving user data:', error);
      throw error;
    }
  }

  clearCurrentUser(): void {
    localStorageService.clearCurrentUser();
  }

  // ===== SIGN IN OPERATION =====
  async signIn(username: string, password: string): Promise<{
    success: boolean;
    tokens?: AuthTokens;
    user?: User;
    error?: string;
  }> {
    try {
      console.log('🔄 Attempting sign in...');
      
      const response = await fetch('http://127.0.0.1:8000/api/auth/signin/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      console.log('📨 SignIn response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ SignIn failed with status:', response.status, errorData);
        return {
          success: false,
          error: errorData.error || errorData.message || `Login failed with status ${response.status}`
        };
      }

      const data = await response.json();
      console.log('✅ SignIn successful, data:', data);

      if (data.success && data.tokens && data.user) {
        // Save tokens
        this.setTokens(data.tokens);
        
        // Save user data
        this.setCurrentUser(data.user);
        
        return {
          success: true,
          tokens: data.tokens,
          user: data.user
        };
      } else {
        return {
          success: false,
          error: data.error || 'Invalid response from server'
        };
      }
    } catch (error) {
      console.error('🚨 SignIn network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // ===== SIGN UP OPERATION =====
  async signUp(email: string, username: string, password: string, passwordConfirmation: string): Promise<{
    success: boolean;
    tokens?: AuthTokens;
    user?: User;
    error?: string;
    fieldErrors?: Record<string, string>;
  }> {
    try {
      console.log('🔄 Attempting sign up...');
      
      const response = await fetch('http://127.0.0.1:8000/api/auth/signup/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          username,
          password,
          password_confirm: passwordConfirmation,
        }),
      });

      console.log('📨 SignUp response status:', response.status);
      const data = await response.json();
      
      if (response.status === 201 && data.success) {
        if (data.tokens && data.user) {
          // Save tokens
          this.setTokens(data.tokens);
          
          // Save user data
          this.setCurrentUser(data.user);
          
          console.log('✅ SignUp successful, user created:', data.user.username);
          
          return {
            success: true,
            tokens: data.tokens,
            user: data.user
          };
        } else {
          return {
            success: false,
            error: 'Missing tokens or user data in response'
          };
        }
      } else {
        // Handle validation errors
        let errorMessage = 'Registration failed';
        const fieldErrors: Record<string, string> = {};

        if (data.errors) {
          // Extract field-specific errors
          if (data.errors.email) {
            fieldErrors.email = Array.isArray(data.errors.email) 
              ? data.errors.email[0] 
              : data.errors.email;
          }
          if (data.errors.username) {
            fieldErrors.username = Array.isArray(data.errors.username) 
              ? data.errors.username[0] 
              : data.errors.username;
          }
          if (data.errors.password) {
            fieldErrors.password = Array.isArray(data.errors.password) 
              ? data.errors.password[0] 
              : data.errors.password;
          }
          
          // If we have field errors, use them
          if (Object.keys(fieldErrors).length > 0) {
            return {
              success: false,
              error: 'Please fix the errors below',
              fieldErrors
            };
          }
        }

        if (data.error) {
          errorMessage = data.error;
        } else if (data.message) {
          errorMessage = data.message;
        }

        return {
          success: false,
          error: errorMessage
        };
      }
    } catch (error) {
      console.error('🚨 SignUp network error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error'
      };
    }
  }

  // ===== SIGN OUT OPERATION =====
  signOut(): void {
  try {
    // Clear ALL localStorage (not just tokens)
    localStorage.clear();
    
    // Also clear sessionStorage
    sessionStorage.clear();
    
    console.log('✅ User signed out and ALL storage cleared');
  } catch (error) {
    console.error('❌ Error during sign out:', error);
    throw error;
  }
}

  // ===== TOKEN REFRESH =====
  async refreshAccessToken(): Promise<boolean> {
    try {
      const refreshToken = this.getRefreshToken();
      if (!refreshToken) {
        console.error('❌ No refresh token available');
        return false;
      }

      const response = await fetch('http://127.0.0.1:8000/api/auth/token/refresh/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refresh: refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.access) {
          localStorage.setItem('access_token', data.access);
          console.log('✅ Access token refreshed');
          return true;
        }
      }
      
      console.error('❌ Failed to refresh token');
      return false;
    } catch (error) {
      console.error('❌ Token refresh error:', error);
      return false;
    }
  }

  // ===== VALIDATE TOKEN =====
  async validateToken(): Promise<boolean> {
    try {
      const token = this.getAccessToken();
      if (!token) return false;

      const response = await fetch('http://127.0.0.1:8000/api/auth/token/verify/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      return response.ok;
    } catch (error) {
      console.error('❌ Token validation error:', error);
      return false;
    }
  }

  // ===== GET AUTH HEADERS =====
  getAuthHeaders(): Record<string, string> {
    const token = this.getAccessToken();
    return token ? {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    } : {
      'Content-Type': 'application/json',
    };
  }

  // ===== UPDATE USER PROFILE =====
  async updateProfile(updates: Partial<User>): Promise<boolean> {
    try {
      const response = await fetch('http://127.0.0.1:8000/api/auth/profile/', {
        method: 'PUT',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.user) {
          this.setCurrentUser(data.user);
          console.log('✅ User profile updated');
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('❌ Profile update error:', error);
      return false;
    }
  }
}

export const authService = AuthService.getInstance();