import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { awsDataRequest, awsPublicDataRequest, isAwsDataApiConfigured } from '@/lib/aws-data-api';

export type Campaign = Tables<'campaigns'>;

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      if (isAwsDataApiConfigured()) return awsPublicDataRequest<Campaign[]>('/catalog/campaigns');
      const { data, error } = await supabase.from('campaigns').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });
}

export function useAddCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (campaign: TablesInsert<'campaigns'>) => {
      if (isAwsDataApiConfigured()) return awsDataRequest<Campaign>('/data/campaigns', { method: 'POST', body: JSON.stringify(campaign) });
      const { data, error } = await supabase.from('campaigns').insert(campaign).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}
