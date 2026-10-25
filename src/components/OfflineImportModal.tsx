import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileSpreadsheet, Download, CheckCircle2, AlertCircle, X, Building2 } from 'lucide-react';
import ExcelJS from 'exceljs';
import Papa from 'papaparse';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useChannels } from '@/hooks/use-channels';
import { getAwsIdToken } from '@/lib/aws-cognito-auth';

interface ParsedRow {
  date: string;
  customer_name: string;
  customer_phone?: string;
  campaign_name: string;
  product_name: string;
  type: string;
  revenue: number;
}

function normalizeHeader(value: unknown): string {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function rowValue(row: Record<string, unknown>, candidates: string[]): unknown {
  const values = new Map(Object.entries(row).map(([key, value]) => [normalizeHeader(key), value]));
  for (const candidate of candidates) {
    const value = values.get(normalizeHeader(candidate));
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return undefined;
}

function excelValue(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value ?? '';
  if (value instanceof Date) return value;
  const cell = value as { result?: unknown; text?: string; richText?: Array<{ text?: string }> };
  if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text || '').join('');
  if (Object.prototype.hasOwnProperty.call(cell, 'result')) return cell.result;
  if (Object.prototype.hasOwnProperty.call(cell, 'text')) return cell.text;
  return '';
}

async function parseUploadedSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  if (file.name.toLowerCase().endsWith('.csv')) {
    const parsed = Papa.parse<Record<string, unknown>>(await file.text(), {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: true,
    });
    if (parsed.errors.length > 0) throw new Error(parsed.errors[0].message);
    return parsed.data.filter((row) => Object.values(row).some((value) => String(value || '').trim() !== ''));
  }
  if (!file.name.toLowerCase().endsWith('.xlsx')) throw new Error('Choose an .xlsx or .csv file');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await file.arrayBuffer());
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('Spreadsheet has no worksheet');
  const headers = worksheet.getRow(1).values.slice(1).map((value) => String(excelValue(value) || '').trim());
  if (headers.every((header) => !header)) throw new Error('Spreadsheet header row is empty');
  const rows: Record<string, unknown>[] = [];
  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const source = worksheet.getRow(rowNumber);
    const row: Record<string, unknown> = {};
    headers.forEach((header, columnIndex) => {
      if (header) row[header] = excelValue(source.getCell(columnIndex + 1).value);
    });
    if (Object.values(row).some((value) => String(value || '').trim() !== '')) rows.push(row);
  }
  return rows;
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
  const [awsImportQueued, setAwsImportQueued] = useState(false);

  if (!isOpen) return null;

  // Resolved active offline channel object
  const activeOfflineChannel = offlineChannels.find(c => c.id === selectedChannelId) || offlineChannels[0] || {
    id: 'offline-croma',
    name: 'Croma & Reliance Digital In-Store',
    platform: 'Retail Store POS',
  };

  const downloadSampleTemplate = async () => {
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

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(`${channelName.slice(0, 22)} Sales`);
    worksheet.columns = Object.keys(sampleData[0]).map((key) => ({ header: key, key, width: 24 }));
    worksheet.addRows(sampleData);
    const cleanFileName = `MarketPulse_${channelName.replace(/[^a-zA-Z0-9]/g, '_')}_Sample.xlsx`;
    const buffer = await workbook.xlsx.writeBuffer();
    const url = URL.createObjectURL(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanFileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const uploaded = e.target.files?.[0];
    if (!uploaded) return;

    setFile(uploaded);
    setImportStatus('idle');
    setErrorMessage('');
    try {
      if (uploaded.size > 25 * 1024 * 1024) throw new Error('File must be 25 MiB or smaller');
      const data = await parseUploadedSpreadsheet(uploaded);
      if (data.length === 0) throw new Error('Spreadsheet contains no transaction rows');
      let sumRevenue = 0;
      const normalized: ParsedRow[] = data.map((row) => {
        const revenue = Number(rowValue(row, ['Revenue', 'Sales', 'Amount']) || 0);
        if (!Number.isFinite(revenue) || revenue < 0) throw new Error('Spreadsheet contains an invalid revenue amount');
        sumRevenue += revenue;
        const eventType = String(rowValue(row, ['Type', 'Event Type']) || 'purchase').toLowerCase();
        return {
          date: String(rowValue(row, ['Date', 'Transaction Date', 'Timestamp']) || new Date().toISOString().split('T')[0]),
          customer_name: String(rowValue(row, ['CustomerName', 'Customer Name', 'Customer Identifier']) || 'Walk-in Retail Customer'),
          customer_phone: String(rowValue(row, ['CustomerPhone', 'Customer Phone']) || ''),
          campaign_name: String(rowValue(row, ['CampaignName', 'Campaign Name', 'Campaign Tag']) || 'Diwali Mega Dhamaka Sale'),
          product_name: String(rowValue(row, ['ProductName', 'Product Name', 'Product SKU']) || 'Nexus Smart Watch Pro'),
          type: ['visit', 'click', 'lead', 'cart_add', 'purchase'].includes(eventType) ? eventType : 'purchase',
          revenue,
        };
      });
      setParsedRows(normalized);
      setTotalRevenue(sumRevenue);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to parse spreadsheet. Please use the sample template.');
      setImportStatus('error');
    }
  };

  const handleBatchCommit = async () => {
    if (parsedRows.length === 0) return;
    setIsProcessing(true);
    setAwsImportQueued(false);

    try {
      const awsApiBase = import.meta.env.VITE_AWS_API_GATEWAY_URL?.replace(/\/+$/, '');
      if (awsApiBase && file) {
        const idToken = getAwsIdToken();
        if (!idToken) throw new Error('Sign in to the AWS admin account before uploading to S3.');
        const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        const fileSha256 = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
        const signedUrlResponse = await fetch(`${awsApiBase}/imports/presigned-url`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({
            filename: file.name,
            sizeBytes: file.size,
            channelId: activeOfflineChannel.id,
            fileSha256,
          }),
        });
        if (!signedUrlResponse.ok) {
          throw new Error(`AWS could not prepare the upload (HTTP ${signedUrlResponse.status})`);
        }
        const signedUpload = await signedUrlResponse.json();
        const uploadResponse = await fetch(signedUpload.uploadUrl, {
          method: 'PUT',
          headers: signedUpload.headers,
          body: file,
        });
        if (!uploadResponse.ok) throw new Error(`S3 upload failed (HTTP ${uploadResponse.status})`);
        setAwsImportQueued(true);

        // EventBridge and the importer persist these rows to AWS asynchronously.
        // Do not also write the same file into Supabase.
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
        return;
      }

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
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Database insert failed.');
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
              accept=".xlsx,.csv"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
            <Upload className="w-8 h-8 mx-auto mb-2 text-primary animate-bounce" />
            <div className="text-sm font-semibold mb-1">
              {file ? file.name : 'Drop your POS Excel (.xlsx / .csv) file here'}
            </div>
            <div className="text-xs text-muted-foreground">
              Choose an .xlsx or .csv file for {activeOfflineChannel.name}.
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
              {awsImportQueued
                ? `S3 accepted the file for ${activeOfflineChannel.name}; EventBridge will process it in AWS.`
                : `Rows for ${activeOfflineChannel.name} were saved to the app database. AWS upload is not configured in this run.`}
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
              {isProcessing ? 'Uploading and saving rows...' : `Ingest ${parsedRows.length} Rows to ${activeOfflineChannel.name}`}
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
