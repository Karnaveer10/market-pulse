interface StatusBadgeProps {
  status: string;
}

const statusStyles: Record<string, string> = {
  active: 'bg-success/15 text-success',
  completed: 'bg-info/15 text-info',
  paused: 'bg-warning/15 text-warning',
  inactive: 'bg-muted text-muted-foreground',
  click: 'bg-info/15 text-info',
  purchase: 'bg-success/15 text-success',
  visit: 'bg-warning/15 text-warning',
  online: 'bg-primary/15 text-primary',
  offline: 'bg-muted text-muted-foreground',
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${statusStyles[status] || 'bg-muted text-muted-foreground'}`}>
      {status}
    </span>
  );
}
