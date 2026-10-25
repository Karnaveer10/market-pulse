import { getAwsIdToken, isAwsCognitoConfigured } from '@/lib/aws-cognito-auth';

const apiBase = import.meta.env.VITE_AWS_API_GATEWAY_URL?.replace(/\/+$/, '');

export const isAwsDataApiConfigured = () => Boolean(apiBase && isAwsCognitoConfigured());

export const isAwsApiConfigured = () => Boolean(apiBase);

export async function awsPublicRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiBase) throw new Error('AWS API Gateway is not configured');
  const headers = new Headers(init.headers);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `AWS request failed (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.error === 'string') message = body.error;
    } catch {
      // Keep the status-based error for a non-JSON gateway response.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export const awsPublicDataRequest = <T>(path: string) => awsPublicRequest<T>(path);

export async function awsDataRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!apiBase) throw new Error('AWS API Gateway is not configured');
  const token = getAwsIdToken();
  if (!token) throw new Error('Sign in to AWS Cognito to access MarketPulse data');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBase}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `AWS request failed (HTTP ${response.status})`;
    try {
      const body = await response.json();
      if (typeof body.error === 'string') message = body.error;
    } catch {
      // Keep the status-based error for a non-JSON gateway response.
    }
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
