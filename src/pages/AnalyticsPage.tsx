import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell
} from 'recharts';
import { revenueOverTimeData, conversionData, channelComparisonData } from '@/lib/mock-data';
import MetricCard from '@/components/MetricCard';
import { TrendingUp, Percent, Target, DollarSign } from 'lucide-react';
import { isAwsAnalyticsConfigured, useAwsAnalytics } from '@/hooks/use-aws-analytics';

const pieColors = ['hsl(168,80%,36%)', 'hsl(217,91%,60%)', 'hsl(280,65%,60%)', 'hsl(38,92%,50%)'];

const analyticsMetrics = [
  { title: 'Avg. Revenue / Month', value: '₹1,85,000', change: '+14.2% festive surge', changeType: 'positive' as const, icon: DollarSign },
  { title: 'Overall Conversion', value: '4.2%', change: '+0.8% festive improvement', changeType: 'positive' as const, icon: Percent },
  { title: 'Best Channel', value: 'Instagram Reels', change: '5.85% conversion rate', changeType: 'positive' as const, icon: Target },
  { title: 'Festive Growth Rate', value: '+32.4%', change: 'Month over month', changeType: 'positive' as const, icon: TrendingUp },
];

export default function AnalyticsPage() {
  const { data: awsAnalytics, isLoading: awsAnalyticsLoading, error: awsAnalyticsError } = useAwsAnalytics();
  const awsEnabled = isAwsAnalyticsConfigured();
  const dailyChartData = awsEnabled
    ? (awsAnalytics?.daily || []).map((row) => ({ month: row.date.slice(5), revenue: Number(row.revenue) }))
    : revenueOverTimeData;
  const channelChartData = awsEnabled
    ? (awsAnalytics?.channels || []).map((row) => ({
      channel: row.channel,
      revenue: Number(row.revenue),
      interactions: Number(row.interactions),
      visits: Number(row.visits),
      clicks: Number(row.clicks),
      purchases: Number(row.purchases),
    }))
    : channelComparisonData;
  const conversionChartData = awsEnabled
    ? channelChartData.map((row) => ({ channel: row.channel, visits: row.visits, clicks: row.clicks, purchases: row.purchases }))
    : conversionData;
  const totalRevenue = (awsAnalytics?.daily || []).reduce((sum, row) => sum + Number(row.revenue), 0);
  const conversionRate = awsAnalytics?.summary.visits
    ? (awsAnalytics.summary.purchases / awsAnalytics.summary.visits) * 100
    : 0;
  const bestChannel = awsAnalytics?.channels[0]?.channel || '—';
  const displayMetrics = awsEnabled
    ? [
      { title: 'Revenue (Last 30 Days)', value: `₹${totalRevenue.toLocaleString('en-IN')}`, change: awsAnalyticsError ? 'AWS analytics unavailable' : awsAnalyticsLoading ? 'Loading AWS data…' : 'AWS RDS PostgreSQL', changeType: 'positive' as const, icon: DollarSign },
      { title: 'Purchase / Visit Rate', value: `${conversionRate.toFixed(1)}%`, change: 'AWS telemetry events', changeType: 'positive' as const, icon: Percent },
      { title: 'Top Revenue Channel', value: bestChannel, change: 'AWS telemetry events', changeType: 'positive' as const, icon: Target },
      { title: 'Total Interactions', value: String(awsAnalytics?.summary.interactions || 0), change: 'AWS RDS PostgreSQL', changeType: 'positive' as const, icon: TrendingUp },
    ]
    : analyticsMetrics;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-header">Analytics</h1>
        <p className="page-subheader">Deep dive into omnichannel marketing ROI & conversion attribution</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {displayMetrics.map((m, i) => <MetricCard key={m.title} {...m} index={i} />)}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Revenue Over Time (₹)</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={dailyChartData}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `₹${v/1000}k`} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" fill="url(#revGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-semibold mb-4">Revenue by Channel</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={channelChartData} dataKey="revenue" nameKey="channel" cx="50%" cy="50%" outerRadius={100} label={({ channel, percent }) => `${channel} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                {channelChartData.map((_, i) => <Cell key={i} fill={pieColors[i % pieColors.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="bg-card border border-border rounded-xl p-5">
        <h3 className="text-sm font-semibold mb-4">Conversion Rates by Channel</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={conversionChartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis dataKey="channel" type="category" stroke="hsl(var(--muted-foreground))" fontSize={12} width={80} />
            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
            <Legend />
            <Bar dataKey="visits" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} name="Visits" />
            <Bar dataKey="clicks" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} name="Clicks" />
            <Bar dataKey="purchases" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} name="Purchases" />
          </BarChart>
        </ResponsiveContainer>
      </motion.div>
    </div>
  );
}
