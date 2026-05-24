/** Types partagés pour l'authentification frontend. */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  organizationId: number;
  role?: 'admin' | 'accountant' | 'viewer';
}

export interface User {
  id: number;
  email: string;
  role: 'admin' | 'accountant' | 'viewer';
  organizationId: number;
  createdAt?: string;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface MeResponse {
  user: User;
}
