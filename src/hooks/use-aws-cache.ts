import { useQuery } from '@tanstack/react-query';
import { awsDataRequest, isAwsDataApiConfigured } from '@/lib/aws-data-api';

export interface AwsCacheAnalytics {
  totals: Record<string, string>;
  campaign: Record<string, string>;
  channel: Record<string, string>;
  readLatencyMs: number;
}

export function useAwsCache() {
  return useQuery({
    queryKey: ['aws-cache'],
    enabled: isAwsDataApiConfigured(),
    queryFn: () => awsDataRequest<AwsCacheAnalytics>('/cache'),
    refetchInterval: 10000,
    retry: 1,
  });
}
