import { localStorageService } from "./localStorageService";

export class AuthService {
    private static instance: AuthService;

    public static getInstance(): AuthService {
        if (!AuthService.instance) {
            AuthService.instance = new AuthService();
        }
        return AuthService.instance;
    }

    isAuthenticated(): boolean {
        const token = localStorage.getItem('auth_token');
        const user = localStorage.getItem('current_user');
        return !!(token && user);
    }

    getCurrentUser() {
        return localStorageService.getCurrentUser();
    }

    async login(username: string, password: string): Promise<boolean> {
        try {
            const response = await fetch('/api/auth/signin/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('auth_token', data.token);

                // Set user in local storage
                localStorageService.setCurrentUser({
                    username: data.user.username,
                    email: data.user.email,
                    is_active: true,
                    last_login: new Date().toISOString(),
                });

                return true;
            }
            return false;
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    }

    logout(): void {
        localStorage.removeItem('auth_token');
        localStorageService.clearCurrentUser();
    }
}

export const authService = AuthService.getInstance();