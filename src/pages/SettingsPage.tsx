import React, { useState } from 'react';
import { 
  Settings, 
  User as UserIcon, 
  Refresh, 
  Download, 
  Upload, 
  Shield, 
  Check, 
  Idea,
  Lock,
  Database
} from '@veasnawt/vicons';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { SUPPORTED_CURRENCIES } from '../lib/currency';
import { api } from '../lib/api';

interface SettingsPageProps {
  onOpenExportImport: () => void;
  onDataReset: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  onOpenExportImport,
  onDataReset,
}) => {
  const { user, updateUser, theme, toggleTheme } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || 'USD');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSaving(true);
      await updateUser({ name: name.trim(), currency });
      toast({
        type: 'success',
        message: 'Settings updated successfully',
        description: 'Your profile and currency preference have been saved.',
      });
    } catch (err: any) {
      toast({
        type: 'error',
        message: 'Failed to update settings',
        description: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleResetSampleData = async () => {
    if (!window.confirm('Are you sure you want to reset and seed sample subscriptions? This will replace your current subscription items with sample demo services.')) {
      return;
    }

    try {
      setResetting(true);
      await api.subscriptions.resetSeed();
      toast({
        type: 'success',
        message: 'Sample subscriptions re-seeded!',
        description: '10 realistic sample subscriptions with diverse renewals have been restored.',
      });
      onDataReset();
    } catch (err: any) {
      toast({
        type: 'error',
        message: 'Failed to re-seed data',
        description: err.message,
      });
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
          Settings & Preferences
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Manage your account profile, currency conversions, reminders, and data backups.
        </p>
      </div>

      {/* Section 1: User Profile & Currency */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-6">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <UserIcon size={20} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Account Profile
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Personal credentials and display currency settings.
            </p>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Email Address (Read-only)
              </label>
              <input
                type="email"
                disabled
                value={user?.email || ''}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-100 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-500 cursor-not-allowed"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Primary Display Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              >
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} - {curr.name} ({curr.symbol})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-400 mt-1">
                All subscriptions are normalized into this currency for analytics.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Theme Mode
              </label>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="px-4 py-2 text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 flex items-center gap-2 cursor-pointer"
                >
                  <span>{theme === 'dark' ? '☀️ Switch to Light Mode' : '🌙 Switch to Dark Mode'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Check size={14} />
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Data Transfer & Backup */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
            <Download size={20} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Data Management & Backup
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Export subscriptions to spreadsheets or import from backup files.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              CSV / JSON Transfer
            </span>
            <p className="text-[11px] text-slate-400">
              Download your full subscriptions list or upload from CSV template.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenExportImport}
            className="px-4 py-2 text-xs font-semibold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer shadow-2xs"
          >
            Open Export / Import Modal
          </button>
        </div>
      </div>

      {/* Section 3: Reset / Seed Sample Subscriptions */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 flex items-center justify-center">
            <Refresh size={20} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white">
              Reset & Demo Data
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Quickly restore realistic sample subscriptions for testing.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
          <div>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              Re-seed 10 Realistic Subscriptions
            </span>
            <p className="text-[11px] text-slate-400">
              Replaces existing subscriptions with Netflix, Spotify, ChatGPT Plus, Copilot, Amazon Prime, Figma, etc.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetSampleData}
            disabled={resetting}
            className="px-4 py-2 text-xs font-semibold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 rounded-xl transition-colors cursor-pointer"
          >
            {resetting ? 'Re-seeding...' : 'Reset to Sample Data'}
          </button>
        </div>
      </div>

      {/* Section 4: System & Database Architecture Info */}
      <div className="p-6 rounded-3xl bg-slate-100/60 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 text-xs space-y-2 text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 font-bold text-slate-700 dark:text-slate-300">
          <Database size={15} />
          <span>Production SQLite Engine Active</span>
        </div>
        <p className="text-[11px] leading-relaxed">
          SubTrack persists user sessions and subscriptions in SQLite with WAL mode (Write-Ahead Logging) and foreign-key constraints. All operations are scoped securely per authenticated user.
        </p>
      </div>
    </div>
  );
};
