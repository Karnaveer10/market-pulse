import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type Campaign = Tables<'campaigns'>;

export function useCampaigns() {
  return useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
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
      const { data, error } = await supabase.from('campaigns').insert(campaign).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}
