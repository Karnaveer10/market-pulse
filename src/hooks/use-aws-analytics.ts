import { useQuery } from '@tanstack/react-query';
import { getAwsIdToken, isAwsCognitoConfigured } from '@/lib/aws-cognito-auth';

export interface AwsAnalytics {
  summary: {
    interactions: number;
    revenue: number;
    cost: number;
    visits: number;
    clicks: number;
    purchases: number;
    campaigns: number;
    customers: number;
  };
  channels: Array<{ channel: string; interactions: number; revenue: number; visits: number; clicks: number; purchases: number }>;
  campaigns: Array<{ campaign: string; interactions: number; revenue: number; cost: number }>;
  daily: Array<{ date: string; revenue: number; interactions: number }>;
  recent: Array<{
    id: string;
    type: string;
    revenue: number;
    date: string;
    campaign_id: string | null;
    channel_id: string | null;
    customer_name: string | null;
    product_name: string | null;
    campaign_name: string | null;
    channel_name: string | null;
  }>;
}

const apiBase = import.meta.env.VITE_AWS_API_GATEWAY_URL?.replace(/\/+$/, '');

export const isAwsAnalyticsConfigured = () => Boolean(apiBase && isAwsCognitoConfigured());

export function useAwsAnalytics() {
  return useQuery({
    queryKey: ['aws-analytics'],
    enabled: isAwsAnalyticsConfigured(),
    queryFn: async (): Promise<AwsAnalytics> => {
      const token = getAwsIdToken();
      if (!token) throw new Error('Sign in to AWS Cognito to load cloud analytics');
      const response = await fetch(`${apiBase}/analytics`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error(`AWS analytics request failed (HTTP ${response.status})`);
      return response.json();
    },
    refetchInterval: 30000,
    retry: 1,
  });
}
