import { motion } from 'framer-motion';
import { Wifi, Building2 } from 'lucide-react';
import { useChannels, type Channel } from '@/hooks/use-channels';
import StatusBadge from '@/components/StatusBadge';

export default function ChannelsPage() {
  const { data: channels = [], isLoading } = useChannels();
  const online = channels.filter(c => c.type === 'online');
  const offline = channels.filter(c => c.type === 'offline');

  const ChannelCard = ({ channel, index }: { channel: Channel; index: number }) => (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="metric-card flex items-center gap-4"
    >
      <div className={`p-3 rounded-xl ${channel.type === 'online' ? 'bg-primary/10' : 'bg-muted'}`}>
        {channel.type === 'online' ? <Wifi className="w-5 h-5 text-primary" /> : <Building2 className="w-5 h-5 text-muted-foreground" />}
      </div>
      <div className="flex-1">
        <p className="font-medium text-sm">{channel.name}</p>
        <p className="text-xs text-muted-foreground">{channel.platform}</p>
      </div>
      <StatusBadge status={channel.type} />
    </motion.div>
  );

  if (isLoading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="page-header">Channels</h1>
        <p className="page-subheader">{channels.length} marketing channels</p>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Wifi className="w-4 h-4 text-primary" /> Online Channels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {online.map((ch, i) => <ChannelCard key={ch.id} channel={ch} index={i} />)}
        </div>
      </div>

      <div>
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" /> Offline Channels</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {offline.map((ch, i) => <ChannelCard key={ch.id} channel={ch} index={i} />)}
        </div>
      </div>
    </div>
  );
}
