import { useState } from 'react';
import { Plus, Search, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';
import DataTable from '@/components/DataTable';
import { useCustomers, useAddCustomer, type Customer } from '@/hooks/use-customers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export default function CustomersPage() {
  const { data: customers = [], isLoading } = useCustomers();
  const addCustomer = useAddCustomer();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', location: '', phone: '' });

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase()) ||
    c.location.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdd = () => {
    if (!form.name || !form.email) return;
    addCustomer.mutate({
      name: form.name,
      email: form.email,
      location: form.location,
      phones: form.phone ? form.phone.split(',').map(p => p.trim()) : [],
    });
    setForm({ name: '', email: '', location: '', phone: '' });
    setOpen(false);
  };

  const columns = [
    { key: 'name', header: 'Name', render: (item: Customer) => (
      <div>
        <span className="font-medium">{item.name}</span>
        <p className="text-xs text-muted-foreground">{item.email}</p>
      </div>
    )},
    { key: 'location', header: 'Location', render: (item: Customer) => (
      <div className="flex items-center gap-1 text-muted-foreground">
        <MapPin className="w-3 h-3" /><span className="text-sm">{item.location}</span>
      </div>
    )},
    { key: 'phones', header: 'Phone(s)', render: (item: Customer) => (
      <div className="text-sm">{item.phones.join(', ')}</div>
    )},
    { key: 'joined_at', header: 'Joined' },
  ];

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Customers</h1>
          <p className="page-subheader">{customers.length} customers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 mr-1" /> Add Customer</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Customer</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="Full name" /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@example.com" /></div>
              <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({...form, location: e.target.value})} placeholder="City, Country" /></div>
              <div><Label>Phone(s)</Label><Input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Comma separated" /></div>
              <Button onClick={handleAdd} className="w-full">Add Customer</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5 max-w-sm">
        <Search className="w-4 h-4 text-muted-foreground" />
        <input type="text" placeholder="Search customers..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-muted-foreground" />
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <DataTable data={filtered as unknown as Record<string, unknown>[]} columns={columns as any} />
      </motion.div>
    </div>
  );
}
