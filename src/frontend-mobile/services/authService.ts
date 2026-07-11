import * as SecureStore from 'expo-secure-store';
import axios, { AxiosError } from 'axios';

const ACCESS_TOKEN_KEY = 'kfc.auth.accessToken';
const DEVICE_ID_KEY = 'kfc.auth.deviceId';
const REFRESH_TOKEN_KEY = 'kfc.auth.refreshToken';
const REQUEST_TIMEOUT_MS = 15_000;

interface LoginApiResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  user: {
    display_name: string;
    email: string;
    id: string;
    phone: string;
  };
}

interface ApiErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

export interface AuthSession {
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
  user: {
    displayName: string;
    email: string;
    id: string;
    phone: string;
  };
}

export class AuthServiceError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
  }
}

export async function loginService(email: string, password: string): Promise<AuthSession> {
  try {
    const deviceId = await getDeviceId();
    const response = await createApiClient().post<LoginApiResponse>('/api/auth/login', {
      device_id: deviceId,
      email,
      password,
    });
    const session = mapAuthSession(response.data);

    await saveAuthSession(session);
    return session;
  } catch (error) {
    throw toAuthServiceError(error);
  }
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearAuthSession(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
    SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
  ]);
}

function createApiClient() {
  return axios.create({
    baseURL: getApiBaseUrl(),
    headers: { 'content-type': 'application/json' },
    timeout: REQUEST_TIMEOUT_MS,
  });
}

function getApiBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (!baseUrl) {
    throw new AuthServiceError(
      'The mobile API URL is missing. Set EXPO_PUBLIC_API_BASE_URL before logging in.',
      'CONFIGURATION_ERROR',
    );
  }

  return baseUrl.replace(/\/+$/, '');
}

async function getDeviceId(): Promise<string> {
  const storedDeviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);

  if (storedDeviceId) {
    return storedDeviceId;
  }

  const deviceId = `expo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

function mapAuthSession(response: LoginApiResponse): AuthSession {
  if (!response.access_token || !response.user) {
    throw new AuthServiceError('The server returned an invalid login response.', 'INVALID_RESPONSE');
  }

  return {
    accessToken: response.access_token,
    expiresIn: response.expires_in,
    refreshToken: response.refresh_token,
    user: {
      displayName: response.user.display_name,
      email: response.user.email,
      id: response.user.id,
      phone: response.user.phone,
    },
  };
}

async function saveAuthSession(session: AuthSession): Promise<void> {
  try {
    await Promise.all([
      SecureStore.setItemAsync(ACCESS_TOKEN_KEY, session.accessToken),
      session.refreshToken
        ? SecureStore.setItemAsync(REFRESH_TOKEN_KEY, session.refreshToken)
        : SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
    ]);
  } catch {
    await clearAuthSession();
    throw new AuthServiceError('We could not securely save your login session.', 'STORAGE_ERROR');
  }
}

function toAuthServiceError(error: unknown): AuthServiceError {
  if (error instanceof AuthServiceError) {
    return error;
  }

  if (axios.isAxiosError<ApiErrorResponse>(error)) {
    return mapAxiosError(error);
  }

  return new AuthServiceError('Something went wrong. Please try again.', 'UNKNOWN_ERROR');
}

function mapAxiosError(error: AxiosError<ApiErrorResponse>): AuthServiceError {
  const status = error.response?.status;
  const code = error.response?.data.error?.code;

  if (!error.response) {
    return new AuthServiceError(
      'We could not connect to the server. Check your connection and try again.',
      'NETWORK_ERROR',
    );
  }

  if (status === 400) {
    return new AuthServiceError('Please check your email and password.', code ?? 'VALIDATION_ERROR');
  }

  if (status === 401 || code === 'INVALID_CREDENTIALS') {
    return new AuthServiceError('Email or password is incorrect.', code ?? 'INVALID_CREDENTIALS');
  }

  if (status === 403) {
    return new AuthServiceError('This account is unavailable. Please contact support.', code ?? 'USER_UNAVAILABLE');
  }

  if (status && status >= 500) {
    return new AuthServiceError('The server is unavailable. Please try again later.', code ?? 'SERVER_ERROR');
  }

  return new AuthServiceError('Something went wrong. Please try again.', code ?? 'REQUEST_ERROR');
}
