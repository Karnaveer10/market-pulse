import { useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { motion } from 'framer-motion';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { useCampaigns, useAddCampaign, type Campaign } from '@/hooks/use-campaigns';
import { useProducts } from '@/hooks/use-products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';

export default function CampaignsPage() {
  const { data: campaigns = [], isLoading } = useCampaigns();
  const { data: products = [] } = useProducts();
  const addCampaign = useAddCampaign();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', startDate: '', endDate: '', budget: '', productId: '' });

  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  const handleAdd = () => {
    if (!form.name || !form.budget) return;
    addCampaign.mutate({
      name: form.name,
      start_date: form.startDate,
      end_date: form.endDate,
      budget: parseFloat(form.budget),
      product_id: form.productId || null,
    });
    setForm({ name: '', startDate: '', endDate: '', budget: '', productId: '' });
    setOpen(false);
  };

  const columns = [
    { key: 'name', header: 'Campaign', render: (item: Campaign) => <span className="font-medium">{item.name}</span> },
    { key: 'status', header: 'Status', render: (item: Campaign) => <StatusBadge status={item.status} /> },
    { key: 'budget', header: 'Budget', render: (item: Campaign) => `$${Number(item.budget).toLocaleString()}` },
    { key: 'spent', header: 'Spent', render: (item: Campaign) => {
      const pct = item.budget > 0 ? Math.round(Number(item.spent) / Number(item.budget) * 100) : 0;
      return (
        <div className="space-y-1">
          <span className="text-xs">${Number(item.spent).toLocaleString()} ({pct}%)</span>
          <Progress value={pct} className="h-1.5" />
        </div>
      );
    }},
    { key: 'start_date', header: 'Start' },
    { key: 'end_date', header: 'End' },
  ];

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Campaigns</h1>
          <p className="page-subheader">{campaigns.length} campaigns</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> New Campaign</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Campaign</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Campaign name" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start Date</Label><Input type="date" value={form.startDate} onChange={e => setForm({...form, startDate: e.target.value})} /></div>
                <div><Label>End Date</Label><Input type="date" value={form.endDate} onChange={e => setForm({...form, endDate: e.target.value})} /></div>
              </div>
              <div><Label>Budget ($)</Label><Input type="number" value={form.budget} onChange={e => setForm({...form, budget: e.target.value})} placeholder="0" /></div>
              <div><Label>Product</Label>
                <Select value={form.productId} onValueChange={v => setForm({...form, productId: v})}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAdd} className="w-full">Create Campaign</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 max-w-sm">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-muted-foreground" />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <DataTable data={filtered as unknown as Record<string, unknown>[]} columns={columns as any} />
      </motion.div>
    </div>
  );
}
