import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { awsDataRequest, awsPublicDataRequest, isAwsDataApiConfigured } from '@/lib/aws-data-api';

export type Channel = Tables<'channels'>;

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      if (isAwsDataApiConfigured()) return awsPublicDataRequest<Channel[]>('/catalog/channels');
      const { data, error } = await supabase.from('channels').select('*').order('type', { ascending: true });
      if (error) throw error;
      return data as Channel[];
    },
  });
}
