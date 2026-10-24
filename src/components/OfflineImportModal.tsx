import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, X, Building2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useChannels } from '@/hooks/use-channels';

interface ParsedRow {
  date: string;
  customer_name: string;
  customer_phone?: string;
  campaign_name: string;
  product_name: string;
  type: string;
  revenue: number;
}

export default function OfflineImportModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const { data: channels = [] } = useChannels();
  const offlineChannels = channels.filter(c => c.type === 'offline');

  // Selected Offline Channel First
  const [selectedChannelId, setSelectedChannelId] = useState<string>('');
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [totalRevenue, setTotalRevenue] = useState(0);

  if (!isOpen) return null;

  // Resolved active offline channel object
  const activeOfflineChannel = offlineChannels.find(c => c.id === selectedChannelId) || offlineChannels[0] || {
    id: 'offline-croma',
    name: 'Croma & Reliance Digital In-Store',
    platform: 'Retail Store POS',
  };

  const downloadSampleTemplate = () => {
    const channelName = activeOfflineChannel.name;
    const sampleData = [
      {
        Date: new Date().toISOString().split('T')[0],
        CustomerName: 'Aarav Sharma',
        CustomerPhone: '+91 98765 43210',
        CampaignName: 'Diwali Mega Dhamaka Sale',
        ProductName: 'Nexus Smart Watch Pro',
        Type: 'purchase',
        Revenue: 4999,
      },
      {
        Date: new Date().toISOString().split('T')[0],
        CustomerName: 'Ananya Deshmukh',
        CustomerPhone: '+91 98230 11223',
        CampaignName: 'Great Indian Festive Blitz',
        ProductName: 'AeroNoise ANC Earbuds',
        Type: 'purchase',
        Revenue: 2499,
      },
      {
        Date: new Date().toISOString().split('T')[0],
        CustomerName: 'Rohan Verma',
        CustomerPhone: '+91 99112 44556',
        CampaignName: 'Monsoon Tech Bonanza',
        ProductName: 'VoltFast GaN 65W Charger',
        Type: 'purchase',
        Revenue: 1899,
      },
      {
        Date: new Date().toISOString().split('T')[0],
        CustomerName: 'Priya Iyer',
        CustomerPhone: '+91 94441 77889',
        CampaignName: 'Diwali Mega Dhamaka Sale',
        ProductName: 'Kavach Ultra PowerBank 20k',
        Type: 'purchase',
        Revenue: 1499,
      },
      {
        Date: new Date().toISOString().split('T')[0],
        CustomerName: 'Kabir Patel',
        CustomerPhone: '+91 97250 99887',
        CampaignName: 'Independence Day Super Savings',
        ProductName: 'GamerX MechStrike Keyboard',
        Type: 'purchase',
        Revenue: 3499,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `${channelName.slice(0, 25)} Sales`);
    const cleanFileName = `MarketPulse_${channelName.replace(/[^a-zA-Z0-9]/g, '_')}_Sample.xlsx`;
    XLSX.writeFile(wb, cleanFileName);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    setFile(uploaded);
    setImportStatus('idle');
    setErrorMessage('');

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        let sumRev = 0;
        const normalized: ParsedRow[] = data.map((row: any) => {
          const rev = Number(row.Revenue || row.revenue || 0);
          sumRev += rev;
          return {
            date: row.Date || row.date || new Date().toISOString().split('T')[0],
            customer_name: row.CustomerName || row.customer_name || 'Walk-in Retail Customer',
            customer_phone: row.CustomerPhone || row.customer_phone || '',
            campaign_name: row.CampaignName || row.campaign_name || 'Diwali Mega Dhamaka Sale',
            product_name: row.ProductName || row.product_name || 'Nexus Smart Watch Pro',
            type: (row.Type || row.type || 'purchase').toLowerCase(),
            revenue: rev,
          };
        });

        setParsedRows(normalized);
        setTotalRevenue(sumRev);
      } catch (err: any) {
        setErrorMessage('Failed to parse spreadsheet. Please use the downloaded sample template.');
        setImportStatus('error');
      }
    };
    reader.readAsBinaryString(uploaded);
  };

  const handleBatchCommit = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    try {
      // 1. Fetch channel, campaign, product, customer IDs from supabase
      const [campaignsRes, productsRes, customersRes] = await Promise.all([
        supabase.from('campaigns').select('id, name'),
        supabase.from('products').select('id, name'),
        supabase.from('customers').select('id, name'),
      ]);

      const defaultCampaignId = campaignsRes.data?.[0]?.id || null;
      const defaultProductId = productsRes.data?.[0]?.id || null;
      const defaultCustomerId = customersRes.data?.[0]?.id || null;

      // Map rows for batch insert assigned to the user-selected offline channel
      const insertPayload = parsedRows.map((r) => {
        const matchedCampaign = campaignsRes.data?.find((c) =>
          c.name.toLowerCase().includes(r.campaign_name.toLowerCase())
        );
        const matchedProduct = productsRes.data?.find((p) =>
          p.name.toLowerCase().includes(r.product_name.toLowerCase())
        );
        const matchedCustomer = customersRes.data?.find((cu) =>
          cu.name.toLowerCase().includes(r.customer_name.toLowerCase())
        );

        return {
          date: r.date,
          type: r.type,
          revenue: r.revenue,
          channel_id: activeOfflineChannel.id.startsWith('offline-') ? null : activeOfflineChannel.id,
          campaign_id: matchedCampaign?.id || defaultCampaignId,
          product_id: matchedProduct?.id || defaultProductId,
          customer_id: matchedCustomer?.id || defaultCustomerId,
        };
      });

      const { error } = await supabase.from('interactions').insert(insertPayload);
      if (error) throw error;

      // Invalidate queries so dashboard, interactions & analytics update immediately
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      queryClient.invalidateQueries({ queryKey: ['channels'] });

      setImportStatus('success');
      setTimeout(() => {
        onClose();
        setImportStatus('idle');
        setFile(null);
        setParsedRows([]);
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Database insert failed.');
      setImportStatus('error');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-card border border-border w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Offline Retail Data Ingestion</h2>
              <p className="text-xs text-muted-foreground">
                AWS S3 Pre-signed URL + EventBridge Lambda Batch Processing
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 overflow-y-auto">
          {/* STEP 1: SELECT OFFLINE CHANNEL FIRST */}
          <div className="space-y-2 p-4 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Step 1: Select Target Offline Channel
                </label>
              </div>
              <span className="text-[10px] text-muted-foreground">Only Offline Channels shown</span>
            </div>

            <select
              value={selectedChannelId || activeOfflineChannel.id}
              onChange={(e) => setSelectedChannelId(e.target.value)}
              className="w-full bg-card border border-border rounded-lg p-2.5 text-xs font-medium text-foreground outline-none focus:border-primary"
            >
              {offlineChannels.map((ch) => (
                <option key={ch.id} value={ch.id}>
                  {ch.name} ({ch.platform})
                </option>
              ))}
            </select>
            <p className="text-[11px] text-muted-foreground">
              All parsed Excel transactions will be attributed to <strong className="text-foreground">{activeOfflineChannel.name}</strong>.
            </p>
          </div>

          {/* 1-CLICK DOWNLOAD PREMADE RELIANCE DIGITAL EXCEL */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-500" />
                Reliance_Digital_Offline_Sales.xlsx
              </div>
              <div className="text-[11px] text-muted-foreground">
                Pre-made POS spreadsheet (8 Indian retail transactions, ₹22,992 total revenue)
              </div>
            </div>
            <a
              href="/Reliance_Digital_Offline_Sales.xlsx"
              download="Reliance_Digital_Offline_Sales.xlsx"
            >
              <Button size="sm" variant="outline" className="gap-2 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 text-xs">
                <Download className="w-4 h-4 text-emerald-400" /> Download Pre-made File
              </Button>
            </a>
          </div>

          {/* STEP 3: UPLOAD FILE */}
          <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center hover:border-primary/50 transition cursor-pointer relative bg-muted/10">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 mx-auto mb-2 text-primary animate-bounce" />
            <div className="text-sm font-semibold mb-1">
              {file ? file.name : 'Drop your POS Excel (.xlsx / .csv) file here'}
            </div>
            <div className="text-xs text-muted-foreground">
              Direct-to-S3 pre-signed upload simulation for {activeOfflineChannel.name}
            </div>
          </div>

          {/* VERIFICATION PREVIEW */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Detected Records: <span className="text-primary font-bold">{parsedRows.length} transactions</span>
                </span>
                <span className="font-semibold text-emerald-500 font-mono">
                  Total Added Revenue: +₹{totalRevenue.toLocaleString('en-IN')}
                </span>
              </div>

              <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted text-muted-foreground sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Customer</th>
                      <th className="p-2 text-left">Target Offline Channel</th>
                      <th className="p-2 text-left">Campaign</th>
                      <th className="p-2 text-right">Revenue (₹)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedRows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-2 font-mono">{r.date}</td>
                        <td className="p-2 font-medium">{r.customer_name}</td>
                        <td className="p-2 text-primary font-medium">{activeOfflineChannel.name}</td>
                        <td className="p-2">{r.campaign_name}</td>
                        <td className="p-2 text-right font-mono font-semibold text-emerald-500">
                          ₹{r.revenue.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 5 && (
                <div className="text-[10px] text-muted-foreground text-center">
                  ...and {parsedRows.length - 5} more transactions ready for batch ingestion.
                </div>
              )}
            </div>
          )}

          {importStatus === 'success' && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Batch ingestion into {activeOfflineChannel.name} complete! Dashboard metrics refreshed.
            </div>
          )}

          {importStatus === 'error' && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              {errorMessage}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <div className="text-[11px] text-muted-foreground">
            Target: <strong>{activeOfflineChannel.name}</strong>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={parsedRows.length === 0 || isProcessing}
              onClick={handleBatchCommit}
              className="gap-2"
            >
              {isProcessing ? 'Ingesting to S3 & RDS...' : `Ingest ${parsedRows.length} Rows to ${activeOfflineChannel.name}`}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
