import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';

export type Customer = Tables<'customers'>;

export function useCustomers() {
  return useQuery({
    queryKey: ['customers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('customers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Customer[];
    },
  });
}

export function useAddCustomer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (customer: TablesInsert<'customers'>) => {
      const { data, error } = await supabase.from('customers').insert(customer).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  });
}
