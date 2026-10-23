import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface MetricCardProps {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative' | 'neutral';
  icon: LucideIcon;
  index?: number;
}

export default function MetricCard({ title, value, change, changeType, icon: Icon, index = 0 }: MetricCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="metric-card"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-bold mt-1 tracking-tight">{value}</p>
        </div>
        <div className="p-2.5 rounded-xl bg-primary/10">
          <Icon className="w-5 h-5 text-primary" />
        </div>
      </div>
      <p className={`text-xs mt-3 font-medium ${
        changeType === 'positive' ? 'text-success' :
        changeType === 'negative' ? 'text-destructive' : 'text-muted-foreground'
      }`}>
        {change}
      </p>
    </motion.div>
  );
}
