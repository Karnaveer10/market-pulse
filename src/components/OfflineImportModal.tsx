import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';

interface ParsedRow {
  date: string;
  customer_name: string;
  channel_name: string;
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
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [totalRevenue, setTotalRevenue] = useState(0);

  if (!isOpen) return null;

  const downloadSampleTemplate = () => {
    const sampleData = [
      {
        Date: new Date().toISOString().split('T')[0],
        CustomerName: 'TechCorp Solutions',
        ChannelName: 'Retail Store',
        CampaignName: 'Spring Launch',
        ProductName: 'Enterprise Cloud Suite',
        Type: 'purchase',
        Revenue: 1200,
      },
      {
        Date: new Date().toISOString().split('T')[0],
        CustomerName: 'Apex Innovations',
        ChannelName: 'Billboard Ad',
        CampaignName: 'Social Blitz',
        ProductName: 'Marketing Pro Hub',
        Type: 'purchase',
        Revenue: 450,
      },
      {
        Date: new Date().toISOString().split('T')[0],
        CustomerName: 'Nexis Media',
        ChannelName: 'Retail Store',
        CampaignName: 'Email Nurture',
        ProductName: 'Developer Tools Pack',
        Type: 'purchase',
        Revenue: 890,
      },
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Offline POS Transactions');
    XLSX.writeFile(wb, 'MarketPulse_Offline_Sample.xlsx');
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
            channel_name: row.ChannelName || row.channel_name || 'Retail Store',
            campaign_name: row.CampaignName || row.campaign_name || 'Spring Launch',
            product_name: row.ProductName || row.product_name || 'Enterprise Cloud Suite',
            type: (row.Type || row.type || 'purchase').toLowerCase(),
            revenue: rev,
          };
        });

        setParsedRows(normalized);
        setTotalRevenue(sumRev);
      } catch (err: any) {
        setErrorMessage('Failed to parse spreadsheet. Please use the sample template.');
        setImportStatus('error');
      }
    };
    reader.readAsBinaryString(uploaded);
  };

  const handleBatchCommit = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);

    try {
      // 1. Fetch channel, campaign, and product ID fallbacks from supabase
      const [channelsRes, campaignsRes, productsRes] = await Promise.all([
        supabase.from('channels').select('id, name'),
        supabase.from('campaigns').select('id, name'),
        supabase.from('products').select('id, name'),
      ]);

      const defaultChannelId = channelsRes.data?.[0]?.id || null;
      const defaultCampaignId = campaignsRes.data?.[0]?.id || null;
      const defaultProductId = productsRes.data?.[0]?.id || null;

      // Map rows for batch insert
      const insertPayload = parsedRows.map((r) => {
        const matchedChannel = channelsRes.data?.find((c) =>
          c.name.toLowerCase().includes(r.channel_name.toLowerCase())
        );
        const matchedCampaign = campaignsRes.data?.find((c) =>
          c.name.toLowerCase().includes(r.campaign_name.toLowerCase())
        );
        const matchedProduct = productsRes.data?.find((p) =>
          p.name.toLowerCase().includes(r.product_name.toLowerCase())
        );

        return {
          date: r.date,
          type: r.type,
          revenue: r.revenue,
          channel_id: matchedChannel?.id || defaultChannelId,
          campaign_id: matchedCampaign?.id || defaultCampaignId,
          product_id: matchedProduct?.id || defaultProductId,
        };
      });

      const { error } = await supabase.from('interactions').insert(insertPayload);
      if (error) throw error;

      // Invalidate queries so dashboard & analytics update immediately
      queryClient.invalidateQueries({ queryKey: ['interactions'] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });

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
                AWS S3 Pre-signed URL + Lambda EventBridge Batch Ingestion
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Download Template Banner */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/40 border border-border">
            <div>
              <div className="text-xs font-semibold">Need the spreadsheet template?</div>
              <div className="text-[11px] text-muted-foreground">
                Pre-formatted headers for offline in-store purchases and billboard campaign sales
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={downloadSampleTemplate} className="gap-2">
              <Download className="w-4 h-4" /> Download .XLSX
            </Button>
          </div>

          {/* Upload Drop Zone */}
          <div className="border-2 border-dashed border-border rounded-2xl p-6 text-center hover:border-primary/50 transition cursor-pointer relative bg-muted/10">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 mx-auto mb-2 text-primary animate-bounce" />
            <div className="text-sm font-semibold mb-1">
              {file ? file.name : 'Drop your Excel (.xlsx / .csv) file here'}
            </div>
            <div className="text-xs text-muted-foreground">
              Direct-to-S3 pre-signed upload simulation with automatic Lambda trigger
            </div>
          </div>

          {/* Verification Preview */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground">
                  Detected Records: <span className="text-primary font-bold">{parsedRows.length} rows</span>
                </span>
                <span className="font-semibold text-emerald-500 font-mono">
                  Total Added Revenue: +${totalRevenue.toLocaleString()}
                </span>
              </div>

              <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                <table className="w-full text-[11px]">
                  <thead className="bg-muted text-muted-foreground sticky top-0">
                    <tr>
                      <th className="p-2 text-left">Date</th>
                      <th className="p-2 text-left">Customer</th>
                      <th className="p-2 text-left">Channel</th>
                      <th className="p-2 text-left">Campaign</th>
                      <th className="p-2 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {parsedRows.slice(0, 5).map((r, i) => (
                      <tr key={i} className="hover:bg-muted/30">
                        <td className="p-2 font-mono">{r.date}</td>
                        <td className="p-2 font-medium">{r.customer_name}</td>
                        <td className="p-2">{r.channel_name}</td>
                        <td className="p-2">{r.campaign_name}</td>
                        <td className="p-2 text-right font-mono font-semibold text-emerald-500">
                          ${r.revenue}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 5 && (
                <div className="text-[10px] text-muted-foreground text-center">
                  ...and {parsedRows.length - 5} more records ready for batch ingestion.
                </div>
              )}
            </div>
          )}

          {importStatus === 'success' && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Batch ingestion complete! Dashboard metrics and database tables refreshed.
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
            S3 EventBridge Trigger $\rightarrow$ Lambda Bulk Ingestion
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
              {isProcessing ? 'Streaming to S3 & DB...' : 'Ingest to Database'}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
