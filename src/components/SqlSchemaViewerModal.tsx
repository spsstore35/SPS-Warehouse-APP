import React, { useState } from 'react';
import { X, Copy, Check, Download, Database, Terminal, Sparkles } from 'lucide-react';

interface SqlSchemaViewerModalProps {
  onClose: () => void;
}

export const SqlSchemaViewerModal: React.FC<SqlSchemaViewerModalProps> = ({ onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'migration' | 'full'>('migration');

  const migrationSql = `-- ==============================================================================
-- The old "public access" SQL that used to be shown here was removed on purpose:
-- it opened every table to anyone with the public key.
-- Use the migration file in the repo instead (run it in the Supabase SQL editor):
--   supabase/migrations/20261202_auth_rls_v3.sql   (see docs/AUTH_RLS_SETUP.md)
-- ==============================================================================`;

  const fullSchemaSql = migrationSql;

  const sqlContent = activeTab === 'migration' ? migrationSql : fullSchemaSql;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleDownload = () => {
    const blob = new Blob([sqlContent], { type: 'text/sql' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab === 'migration' ? 'supabase_migration_update.sql' : 'supabase_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Supabase &amp; PostgreSQL Database SQL
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Run the Migration SQL on an existing database, or Full Schema for a fresh setup
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Tabs + Instructions banner */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex bg-white border border-slate-200 rounded-xl p-1 gap-1 shadow-xs">
              <button
                type="button"
                onClick={() => setActiveTab('migration')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'migration'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Update Migration SQL (Existing DB)</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('full')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  activeTab === 'full'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Database className="w-3.5 h-3.5" />
                <span>Full Fresh Schema</span>
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-800 hover:bg-slate-100 shadow-sm transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-600" />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy SQL'}</span>
              </button>

              <button
                onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download .sql</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-700">
            <Terminal className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              {activeTab === 'migration'
                ? 'Safe to run on your live Supabase database: adds Team/Scout Fera2 columns on profiles & bookings, creates scout_fera2_leaders & calendar_events if missing.'
                : 'Complete schema for setting up a brand new Supabase database from scratch.'}
            </span>
          </div>
        </div>

        {/* Code Content */}
        <div className="p-5 overflow-y-auto flex-1 bg-slate-950 font-mono text-xs text-slate-200 leading-relaxed max-h-[60vh]">
          <pre className="whitespace-pre-wrap">{sqlContent}</pre>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-medium">
            {activeTab === 'migration' ? 'Incremental Supabase migration script' : 'Full PostgreSQL schema'}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
