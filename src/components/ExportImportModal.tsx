import React, { useState, useRef } from 'react';
import { Download, Upload, Close, Check, Document, Idea } from '@veasnawt/vicons';
import { Subscription } from '../types';

interface ExportImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  subscriptions: Subscription[];
  onImport: (items: Partial<Subscription>[]) => Promise<void>;
}

export const ExportImportModal: React.FC<ExportImportModalProps> = ({
  isOpen,
  onClose,
  subscriptions,
  onImport,
}) => {
  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [parsedItems, setParsedItems] = useState<Partial<Subscription>[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'Category', 'Price', 'Currency', 'Billing Cycle', 'Payment Method', 'Start Date', 'Next Billing Date', 'Status', 'Notes', 'Website'];
    const rows = subscriptions.map(s => [
      `"${s.name.replace(/"/g, '""')}"`,
      `"${s.category.replace(/"/g, '""')}"`,
      s.price,
      s.currency,
      s.billing_cycle,
      s.payment_method,
      s.start_date,
      s.next_billing_date,
      s.status,
      `"${(s.notes || '').replace(/"/g, '""')}"`,
      `"${(s.website || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `subtrack-subscriptions-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to JSON
  const handleExportJSON = () => {
    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(subscriptions, null, 2))}`;
    const link = document.createElement('a');
    link.setAttribute('href', jsonString);
    link.setAttribute('download', `subtrack-subscriptions-${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Download sample template
  const handleDownloadTemplate = () => {
    const sample = `Name,Category,Price,Currency,Billing Cycle,Payment Method,Start Date,Next Billing Date,Status,Notes,Website
Netflix,Entertainment & Streaming,15.49,USD,monthly,credit_card,2025-01-01,2026-02-01,active,Family plan,https://netflix.com
Spotify,Music & Audio,11.99,USD,monthly,paypal,2025-02-15,2026-02-15,active,Individual,https://spotify.com`;
    const encodedUri = encodeURI('data:text/csv;charset=utf-8,' + sample);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `subtrack-template.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle CSV file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImportError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) {
          throw new Error('CSV file must have a header line and at least one data row.');
        }

        const items: Partial<Subscription>[] = [];
        // Skip header
        for (let i = 1; i < lines.length; i++) {
          // Simple CSV row parser handling quotes
          const match = lines[i].match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g);
          const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
          
          if (cols.length >= 3 && cols[0]) {
            items.push({
              name: cols[0],
              category: cols[1] || 'Other',
              price: parseFloat(cols[2]) || 0,
              currency: (cols[3] || 'USD').toUpperCase(),
              billing_cycle: (cols[4] as any) || 'monthly',
              payment_method: (cols[5] as any) || 'credit_card',
              start_date: cols[6] || new Date().toISOString().split('T')[0],
              next_billing_date: cols[7] || new Date().toISOString().split('T')[0],
              status: (cols[8] as any) || 'active',
              notes: cols[9] || '',
              website: cols[10] || '',
            });
          }
        }

        if (items.length === 0) {
          throw new Error('No valid subscription rows found in file.');
        }

        setParsedItems(items);
      } catch (err: any) {
        setImportError(err.message || 'Failed to parse CSV file');
      }
    };
    reader.readAsText(file);
  };

  const executeImport = async () => {
    if (parsedItems.length === 0) return;
    try {
      setImporting(true);
      await onImport(parsedItems);
      onClose();
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              Data Backup & Transfer
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Close size={18} />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-6 pt-2">
          <button
            onClick={() => setActiveTab('export')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'export'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Export Data
          </button>
          <button
            onClick={() => setActiveTab('import')}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold border-b-2 transition-all cursor-pointer ${
              activeTab === 'import'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Import CSV
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download a backup copy of your {subscriptions.length} tracked subscriptions to use in Excel, Google Sheets, or another tracker.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-all cursor-pointer group shadow-2xs"
                >
                  <Download size={22} className="text-indigo-600 dark:text-indigo-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">Export to CSV</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">Spreadsheet friendly</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportJSON}
                  className="flex flex-col items-center justify-center p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-500 dark:hover:border-indigo-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 transition-all cursor-pointer group shadow-2xs"
                >
                  <Document size={22} className="text-purple-600 dark:text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                  <span className="text-xs font-bold">Export to JSON</span>
                  <span className="text-[11px] text-slate-400 mt-0.5">Complete raw data</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Upload a CSV file containing your subscriptions.
                </p>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                >
                  <Download size={12} />
                  <span>Sample Template</span>
                </button>
              </div>

              {importError && (
                <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl">
                  {importError}
                </div>
              )}

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 dark:border-slate-700 hover:border-indigo-500 dark:hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-slate-50/50 dark:bg-slate-800/30 transition-all"
              >
                <Upload size={28} className="mx-auto text-indigo-500 mb-2" />
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                  {parsedItems.length > 0 ? `${parsedItems.length} rows ready to import` : 'Click to select CSV file'}
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Supports comma-separated values (.csv)
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {parsedItems.length > 0 && (
                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setParsedItems([])}
                    className="px-3 py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={executeImport}
                    disabled={importing}
                    className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-sm disabled:opacity-50 cursor-pointer"
                  >
                    <Check size={14} />
                    <span>{importing ? 'Importing...' : `Import ${parsedItems.length} Items`}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
