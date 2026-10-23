import { DollarSign, Megaphone, Users, MousePointerClick } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import MetricCard from '@/components/MetricCard';
import DataTable from '@/components/DataTable';
import StatusBadge from '@/components/StatusBadge';
import { useInteractions, type InteractionRow } from '@/hooks/use-interactions';
import { useCampaigns } from '@/hooks/use-campaigns';
import { useCustomers } from '@/hooks/use-customers';
import { channelComparisonData, campaignPerformanceData } from '@/lib/mock-data';

export default function DashboardPage() {
  const { data: interactions = [] } = useInteractions();
  const { data: campaigns = [] } = useCampaigns();
  const { data: customers = [] } = useCustomers();

  const totalRevenue = interactions.reduce((sum, i) => sum + Number(i.revenue), 0);

  const metrics = [
    { title: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, change: 'Live from database', changeType: 'positive' as const, icon: DollarSign },
    { title: 'Total Campaigns', value: String(campaigns.length), change: 'Live from database', changeType: 'positive' as const, icon: Megaphone },
    { title: 'Total Customers', value: String(customers.length), change: 'Live from database', changeType: 'positive' as const, icon: Users },
    { title: 'Total Interactions', value: String(interactions.length), change: 'Live from database', changeType: 'positive' as const, icon: MousePointerClick },
  ];

  const recentColumns = [
    { key: 'date', header: 'Date' },
    { key: 'customer', header: 'Customer', render: (item: InteractionRow) => item.customers?.name ?? '—' },
    { key: 'type', header: 'Type', render: (item: InteractionRow) => <StatusBadge status={item.type} /> },
    { key: 'product', header: 'Product', render: (item: InteractionRow) => item.products?.name ?? '—' },
    { key: 'channel', header: 'Channel', render: (item: InteractionRow) => item.channels?.name ?? '—' },
    { key: 'revenue', header: 'Revenue', render: (item: InteractionRow) => (
      <span className="font-medium">{item.revenue > 0 ? `$${item.revenue}` : '—'}</span>
    )},
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Dashboard</h1>
        <p className="page-subheader">Overview of your marketing performance</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <MetricCard key={m.title} {...m} index={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Campaign Performance</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={campaignPerformanceData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `$${v/1000}k`} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Legend />
              <Line type="monotone" dataKey="Spring Launch" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Social Blitz" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Email Nurture" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Channel Comparison</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={channelComparisonData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Legend />
              <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Revenue ($)" />
              <Bar dataKey="interactions" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Interactions" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <h3 className="text-sm font-semibold mb-3">Recent Interactions</h3>
        <DataTable data={interactions.slice(0, 8) as any} columns={recentColumns as any} />
      </motion.div>
    </div>
  );
}
