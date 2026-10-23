import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
      const { data, error } = await supabase
        .from('interactions')
        .select('*, customers(name), products(name), campaigns(name), channels(name)')
        .order('date', { ascending: false });
      if (error) throw error;
      return data as InteractionRow[];
    },
  });
}
