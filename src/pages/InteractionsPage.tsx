import { useState } from 'react';
import { Search, Download, FileSpreadsheet } from 'lucide-react';
import { motion } from 'framer-motion';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { useInteractions, type InteractionRow } from '@/hooks/use-interactions';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import OfflineImportModal from '@/components/OfflineImportModal';

export default function InteractionsPage() {
  const { data: interactions = [], isLoading } = useInteractions();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);

  const filtered = interactions.filter(i => {
    const customerName = i.customers?.name ?? '';
    const productName = i.products?.name ?? '';
    const matchSearch = customerName.toLowerCase().includes(search.toLowerCase()) ||
      productName.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || i.type === typeFilter;
    return matchSearch && matchType;
  });

  const exportCSV = () => {
    const csv = ['Date,Customer,Type,Product,Campaign,Channel,Revenue', ...filtered.map(i =>
      `${i.date},${i.customers?.name ?? ''},${i.type},${i.products?.name ?? ''},${i.campaigns?.name ?? ''},${i.channels?.name ?? ''},${i.revenue}`
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'interactions.csv';
    a.click();
  };

  const columns = [
    { key: 'date', header: 'Date' },
    { key: 'customer', header: 'Customer', render: (item: InteractionRow) => <span className="font-medium">{item.customers?.name ?? '—'}</span> },
    { key: 'type', header: 'Type', render: (item: InteractionRow) => <StatusBadge status={item.type} /> },
    { key: 'product', header: 'Product', render: (item: InteractionRow) => item.products?.name ?? '—' },
    { key: 'campaign', header: 'Campaign', render: (item: InteractionRow) => item.campaigns?.name ?? '—' },
    { key: 'channel', header: 'Channel', render: (item: InteractionRow) => item.channels?.name ?? '—' },
    { key: 'revenue', header: 'Revenue', render: (item: InteractionRow) => (
      <span className="font-medium">{item.revenue > 0 ? `$${item.revenue}` : '—'}</span>
    )},
  ];

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Interactions</h1>
          <p className="page-subheader">{filtered.length} interactions</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setOfflineModalOpen(true)}>
            <FileSpreadsheet className="w-4 h-4 mr-1 text-emerald-500" /> Import Offline Excel
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-1.5">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="bg-transparent border-none outline-none text-sm w-40 placeholder:text-muted-foreground" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="click">Click</SelectItem>
            <SelectItem value="purchase">Purchase</SelectItem>
            <SelectItem value="visit">Visit</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <DataTable data={filtered as unknown as Record<string, unknown>[]} columns={columns as any} />
      </motion.div>

      <OfflineImportModal
        isOpen={offlineModalOpen}
        onClose={() => setOfflineModalOpen(false)}
      />
    </div>
  );
}
