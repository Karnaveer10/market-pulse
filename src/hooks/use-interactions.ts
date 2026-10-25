import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { awsDataRequest, isAwsDataApiConfigured } from '@/lib/aws-data-api';

export interface InteractionRow {
  id: string;
  type: string;
  revenue: number;
  date: string;
  customer_id: string | null;
  product_id: string | null;
  campaign_id: string | null;
  channel_id: string | null;
  customers: { name: string } | null;
  products: { name: string } | null;
  campaigns: { name: string } | null;
  channels: { name: string } | null;
}

export function useInteractions() {
  return useQuery({
    queryKey: ['interactions'],
    queryFn: async () => {
      if (isAwsDataApiConfigured()) {
        const result = await awsDataRequest<{ recent: Array<{
          id: string; type: string; revenue: number; date: string; customer_id: string | null;
          product_id: string | null; campaign_id: string | null; channel_id: string | null;
          customer_name: string | null; product_name: string | null; campaign_name: string | null; channel_name: string | null;
        }> }>('/analytics');
        return result.recent.map((row) => ({
          ...row,
          customers: row.customer_name ? { name: row.customer_name } : null,
          products: row.product_name ? { name: row.product_name } : null,
          campaigns: row.campaign_name ? { name: row.campaign_name } : null,
          channels: row.channel_name ? { name: row.channel_name } : null,
        })) as InteractionRow[];
      }
      const { data, error } = await supabase
        .from('interactions')
        .select('*, customers(name), products(name), campaigns(name), channels(name)')
        .order('date', { ascending: false });
      if (error) throw error;
      return data as InteractionRow[];
    },
  });
}
