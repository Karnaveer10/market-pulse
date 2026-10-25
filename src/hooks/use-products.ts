import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { awsDataRequest, awsPublicDataRequest, isAwsDataApiConfigured } from '@/lib/aws-data-api';

export type Product = Tables<'products'>;

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      if (isAwsDataApiConfigured()) return awsPublicDataRequest<Product[]>('/catalog/products');
      const { data, error } = await supabase.from('products').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useAddProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (product: TablesInsert<'products'>) => {
      if (isAwsDataApiConfigured()) return awsDataRequest<Product>('/data/products', { method: 'POST', body: JSON.stringify(product) });
      const { data, error } = await supabase.from('products').insert(product).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}

export function useDeleteProduct() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      if (isAwsDataApiConfigured()) return awsDataRequest<{ deleted: boolean; id: string }>(`/data/products?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  });
}
