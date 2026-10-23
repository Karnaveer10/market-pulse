import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';

export type Channel = Tables<'channels'>;

export function useChannels() {
  return useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      const { data, error } = await supabase.from('channels').select('*').order('type', { ascending: true });
      if (error) throw error;
      return data as Channel[];
    },
  });
}
