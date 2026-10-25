import { useState } from 'react';
import { DollarSign, Megaphone, Users, MousePointerClick, FileSpreadsheet, ShoppingBag, BellRing, Radio } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import OfflineImportModal from '@/components/OfflineImportModal';
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
import { isAwsAnalyticsConfigured, useAwsAnalytics } from '@/hooks/use-aws-analytics';
import { useAwsCache } from '@/hooks/use-aws-cache';
import { awsDataRequest } from '@/lib/aws-data-api';
import { isAwsTelemetrySyncEnabled, setAwsTelemetrySyncEnabled } from '@/lib/telemetry-service';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { data: interactions = [] } = useInteractions();
  const { data: campaigns = [] } = useCampaigns();
  const { data: customers = [] } = useCustomers();
  const { data: awsAnalytics, isLoading: awsAnalyticsLoading, error: awsAnalyticsError } = useAwsAnalytics();
  const { data: awsCache } = useAwsCache();
  const awsAnalyticsEnabled = isAwsAnalyticsConfigured();
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [sendingTestAlert, setSendingTestAlert] = useState(false);
  const [awsTelemetrySync, setAwsTelemetrySync] = useState(isAwsTelemetrySyncEnabled);

  const sendTestAlert = async () => {
    setSendingTestAlert(true);
    try {
      await awsDataRequest('/alerts/test', { method: 'POST', body: '{}' });
      toast.success('SNS test alert published. Confirm the email subscription to receive messages.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'SNS test alert could not be sent.');
    } finally {
      setSendingTestAlert(false);
    }
  };

  const displayInteractions: InteractionRow[] = awsAnalyticsEnabled
    ? (awsAnalytics?.recent || []).map((row) => ({
      id: row.id,
      type: row.type,
      revenue: Number(row.revenue),
      date: row.date,
      customer_id: null,
      product_id: null,
      campaign_id: row.campaign_id,
      channel_id: row.channel_id,
      customers: row.customer_name ? { name: row.customer_name } : null,
      products: row.product_name ? { name: row.product_name } : null,
      campaigns: row.campaign_name ? { name: row.campaign_name } : null,
      channels: row.channel_name ? { name: row.channel_name } : null,
    }))
    : interactions;
  const totalRevenue = awsAnalyticsEnabled
    ? Number(awsAnalytics?.summary.revenue || 0)
    : interactions.reduce((sum, i) => sum + Number(i.revenue), 0);
  const dataSource = !awsAnalyticsEnabled
    ? 'Local app database'
    : awsAnalyticsError
      ? 'AWS analytics unavailable'
      : awsAnalyticsLoading
        ? 'Loading AWS data…'
        : 'AWS RDS PostgreSQL';
  const totalInteractions = awsAnalyticsEnabled && awsCache?.totals.interactions !== undefined
    ? Number(awsCache.totals.interactions)
    : Number(awsAnalytics?.summary.interactions || 0);
  const interactionMetricSource = awsAnalyticsEnabled && awsCache
    ? `Redis read ${awsCache.readLatencyMs.toFixed(2)} ms`
    : dataSource;
  const campaignChartData = awsAnalyticsEnabled
    ? [{
      month: 'All time',
      ...Object.fromEntries((awsAnalytics?.campaigns || []).map((row) => [row.campaign, Number(row.revenue)])),
    }]
    : campaignPerformanceData;
  const channelChartData = awsAnalyticsEnabled
    ? (awsAnalytics?.channels || []).map((row) => ({
      channel: row.channel,
      revenue: Number(row.revenue),
      interactions: Number(row.interactions),
    }))
    : channelComparisonData;

  const metrics = [
    { title: 'Total Revenue', value: `₹${totalRevenue.toLocaleString('en-IN')}`, change: dataSource, changeType: 'positive' as const, icon: DollarSign },
    { title: 'Total Campaigns', value: String(awsAnalyticsEnabled ? awsAnalytics?.summary.campaigns || 0 : campaigns.length), change: dataSource, changeType: 'positive' as const, icon: Megaphone },
    { title: 'Total Customers', value: String(awsAnalyticsEnabled ? awsAnalytics?.summary.customers || 0 : customers.length), change: dataSource, changeType: 'positive' as const, icon: Users },
    { title: 'Total Interactions', value: String(awsAnalyticsEnabled ? totalInteractions : interactions.length), change: interactionMetricSource, changeType: 'positive' as const, icon: MousePointerClick },
  ];

  const recentColumns = [
    { key: 'date', header: 'Date' },
    { key: 'customer', header: 'Customer', render: (item: InteractionRow) => item.customers?.name ?? '—' },
    { key: 'type', header: 'Type', render: (item: InteractionRow) => <StatusBadge status={item.type} /> },
    { key: 'product', header: 'Product', render: (item: InteractionRow) => item.products?.name ?? '—' },
    { key: 'channel', header: 'Channel', render: (item: InteractionRow) => item.channels?.name ?? '—' },
    { key: 'revenue', header: 'Revenue', render: (item: InteractionRow) => (
      <span className="font-medium">{item.revenue > 0 ? `₹${Number(item.revenue).toLocaleString('en-IN')}` : '—'}</span>
    )},
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-header">Dashboard</h1>
          <p className="page-subheader">Overview of omnichannel marketing & revenue performance</p>
        </div>
        <div className="flex items-center gap-2">
          {awsAnalyticsEnabled && (
            <>
              <Button
                variant="outline"
                size="sm"
                aria-pressed={awsTelemetrySync}
                onClick={() => {
                  const enabled = !awsTelemetrySync;
                  setAwsTelemetrySyncEnabled(enabled);
                  setAwsTelemetrySync(enabled);
                }}
                className="gap-2 text-xs"
              >
                <Radio className="w-4 h-4" />
                AWS telemetry {awsTelemetrySync ? 'on' : 'off'}
              </Button>
              <Button variant="outline" size="sm" onClick={sendTestAlert} disabled={sendingTestAlert} className="gap-2 text-xs">
                <BellRing className="w-4 h-4" />
                {sendingTestAlert ? 'Sending alert…' : 'Send SNS test alert'}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setOfflineModalOpen(true)}
            className="gap-2 text-xs"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
            Import Offline Excel
          </Button>
          <Link to="/store">
            <Button size="sm" className="gap-2 text-xs">
              <ShoppingBag className="w-4 h-4" />
              Open Live Storefront
            </Button>
          </Link>
        </div>
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
            <LineChart data={campaignChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={(v) => `₹${v/1000}k`} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Legend />
              {awsAnalyticsEnabled
                ? (awsAnalytics?.campaigns || []).map((row, index) => (
                  <Line key={row.campaign} type="monotone" dataKey={row.campaign} stroke={`hsl(var(--chart-${(index % 4) + 1}))`} strokeWidth={2} dot={false} />
                ))
                : <>
                  <Line type="monotone" dataKey="Spring Launch" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Social Blitz" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="Email Nurture" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={false} />
                </>}
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Channel Comparison</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={channelChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="channel" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Legend />
              <Bar dataKey="revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} name="Revenue (₹)" />
              <Bar dataKey="interactions" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} name="Interactions" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <h3 className="text-sm font-semibold mb-3">Recent Interactions</h3>
        <DataTable data={displayInteractions} columns={recentColumns} />
      </motion.div>

      <OfflineImportModal
        isOpen={offlineModalOpen}
        onClose={() => setOfflineModalOpen(false)}
      />
    </div>
  );
}
