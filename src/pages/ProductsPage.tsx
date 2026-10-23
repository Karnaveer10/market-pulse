import { useState } from 'react';
import { Plus, Search, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { useProducts, useAddProduct, useDeleteProduct, type Product } from '@/hooks/use-products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function ProductsPage() {
  const { data: products = [], isLoading } = useProducts();
  const addProduct = useAddProduct();
  const deleteProduct = useDeleteProduct();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', category: 'Software', price: '' });

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.name || !form.price) return;
    addProduct.mutate({ name: form.name, category: form.category, price: parseFloat(form.price) });
    setForm({ name: '', category: 'Software', price: '' });
    setOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteProduct.mutate(id);
  };

  const exportCSV = () => {
    const csv = ['Name,Category,Price,Status', ...products.map(p => `${p.name},${p.category},${p.price},${p.status}`)].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'products.csv';
    a.click();
  };

  const columns = [
    { key: 'name', header: 'Name', render: (item: Product) => <span className="font-medium">{item.name}</span> },
    { key: 'category', header: 'Category' },
    { key: 'price', header: 'Price', render: (item: Product) => `$${item.price}` },
    { key: 'status', header: 'Status', render: (item: Product) => <StatusBadge status={item.status} /> },
    { key: 'created_at', header: 'Created', render: (item: Product) => new Date(item.created_at).toLocaleDateString() },
    { key: 'actions', header: '', render: (item: Product) => (
      <button onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }} className="text-xs text-destructive hover:underline">Delete</button>
    )},
  ];

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Products</h1>
          <p className="page-subheader">{products.length} products total</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> Export
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add Product</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Product name" /></div>
                <div><Label>Category</Label>
                  <Select value={form.category} onValueChange={v => setForm({...form, category: v})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Software">Software</SelectItem>
                      <SelectItem value="Service">Service</SelectItem>
                      <SelectItem value="Integration">Integration</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Price ($)</Label><Input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})} placeholder="0.00" /></div>
                <Button onClick={handleAdd} className="w-full">Add Product</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 max-w-sm">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search products..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-muted-foreground" />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <DataTable data={filtered as unknown as Record<string, unknown>[]} columns={columns as any} />
      </motion.div>
    </div>
  );
}
