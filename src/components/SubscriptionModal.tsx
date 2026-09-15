import React, { useState, useEffect } from 'react';
import { 
  Close, 
  Check, 
  Tag, 
  Time, 
  Globe, 
  ExternalLink,
  Idea,
  Calendar,
  Lock,
  Refresh
} from '@veasnawt/vicons';
import { Subscription, BillingCycle, SubscriptionStatus, PaymentMethod } from '../types';
import { POPULAR_PRESETS, SubscriptionPreset } from '../lib/presets';
import { SUPPORTED_CURRENCIES } from '../lib/currency';
import { DEFAULT_CATEGORIES } from '../../server/db'; // or locally defined

interface SubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<Subscription>) => Promise<void>;
  initialData?: Subscription | null;
  userCurrency: string;
}

const COLOR_OPTIONS = [
  '#4F46E5', '#6366F1', '#8B5CF6', '#EC4899', '#EF4444',
  '#F97316', '#F59E0B', '#10B981', '#06B6D4', '#0071E3',
  '#24292F', '#FC4C02', '#1DB954', '#10A37F'
];

const PAYMENT_METHODS: { id: PaymentMethod; label: string }[] = [
  { id: 'credit_card', label: 'Credit Card' },
  { id: 'debit_card', label: 'Debit Card' },
  { id: 'paypal', label: 'PayPal' },
  { id: 'apple_pay', label: 'Apple Pay' },
  { id: 'google_pay', label: 'Google Pay' },
  { id: 'bank_transfer', label: 'Bank Transfer' },
  { id: 'crypto', label: 'Crypto' },
  { id: 'other', label: 'Other' },
];

const BILLING_CYCLES: { id: BillingCycle; label: string }[] = [
  { id: 'monthly', label: 'Monthly' },
  { id: 'yearly', label: 'Yearly' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'quarterly', label: 'Quarterly (3 Mo)' },
  { id: 'semi_annual', label: 'Semi-Annual (6 Mo)' },
  { id: 'lifetime', label: 'Lifetime' },
];

const CATEGORY_LIST = [
  'Entertainment & Streaming',
  'Productivity & Work',
  'Cloud & Developer Tools',
  'Music & Audio',
  'Utilities & Software',
  'Health & Fitness',
  'Finance & Banking',
  'Gaming',
  'Education & Learning',
  'Other',
];

export const SubscriptionModal: React.FC<SubscriptionModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  userCurrency,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    category: 'Entertainment & Streaming',
    price: 9.99,
    currency: userCurrency || 'USD',
    billing_cycle: 'monthly' as BillingCycle,
    payment_method: 'credit_card' as PaymentMethod,
    start_date: new Date().toISOString().split('T')[0],
    next_billing_date: new Date().toISOString().split('T')[0],
    status: 'active' as SubscriptionStatus,
    notes: '',
    website: '',
    logo: '',
    color: '#4F46E5',
    reminder_days: 3,
    auto_renew: true,
    cancellation_url: '',
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        category: initialData.category,
        price: initialData.price,
        currency: initialData.currency,
        billing_cycle: initialData.billing_cycle,
        payment_method: initialData.payment_method,
        start_date: initialData.start_date,
        next_billing_date: initialData.next_billing_date,
        status: initialData.status,
        notes: initialData.notes || '',
        website: initialData.website || '',
        logo: initialData.logo || '',
        color: initialData.color || '#4F46E5',
        reminder_days: initialData.reminder_days ?? 3,
        auto_renew: Boolean(initialData.auto_renew),
        cancellation_url: initialData.cancellation_url || '',
      });
    } else {
      const today = new Date().toISOString().split('T')[0];
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const nextMonthStr = nextMonth.toISOString().split('T')[0];

      setFormData({
        name: '',
        category: 'Entertainment & Streaming',
        price: 9.99,
        currency: userCurrency || 'USD',
        billing_cycle: 'monthly',
        payment_method: 'credit_card',
        start_date: today,
        next_billing_date: nextMonthStr,
        status: 'active',
        notes: '',
        website: '',
        logo: '',
        color: '#4F46E5',
        reminder_days: 3,
        auto_renew: true,
        cancellation_url: '',
      });
    }
    setError(null);
  }, [initialData, isOpen, userCurrency]);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: SubscriptionPreset) => {
    const today = new Date().toISOString().split('T')[0];
    const nextDate = new Date();
    if (preset.billing_cycle === 'yearly') {
      nextDate.setFullYear(nextDate.getFullYear() + 1);
    } else {
      nextDate.setMonth(nextDate.getMonth() + 1);
    }

    setFormData(prev => ({
      ...prev,
      name: preset.name,
      category: preset.category,
      price: preset.price,
      currency: preset.currency,
      billing_cycle: preset.billing_cycle,
      website: preset.website,
      logo: preset.logo,
      color: preset.color,
      notes: preset.notes || '',
      cancellation_url: preset.cancellation_url || '',
      start_date: today,
      next_billing_date: nextDate.toISOString().split('T')[0],
    }));
  };

  const autoCalculateNextDate = () => {
    if (!formData.start_date) return;
    const date = new Date(formData.start_date + 'T00:00:00');
    switch (formData.billing_cycle) {
      case 'weekly':
        date.setDate(date.getDate() + 7);
        break;
      case 'monthly':
        date.setMonth(date.getMonth() + 1);
        break;
      case 'quarterly':
        date.setMonth(date.getMonth() + 3);
        break;
      case 'semi_annual':
        date.setMonth(date.getMonth() + 6);
        break;
      case 'yearly':
        date.setFullYear(date.getFullYear() + 1);
        break;
      default:
        date.setMonth(date.getMonth() + 1);
        break;
    }
    setFormData(prev => ({ ...prev, next_billing_date: date.toISOString().split('T')[0] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Service name is required');
      return;
    }

    if (formData.price <= 0) {
      setError('Price must be greater than zero');
      return;
    }

    try {
      setLoading(true);
      await onSubmit({
        ...formData,
        price: Number(formData.price),
        reminder_days: Number(formData.reminder_days),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save subscription');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden my-8">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {initialData ? 'Edit Subscription' : 'Add New Subscription'}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track renewals, price breakdowns, and payment methods.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Close size={18} />
          </button>
        </div>

        {/* Quick Presets Picker (when adding new) */}
        {!initialData && (
          <div className="px-6 pt-4 pb-2 border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/50 dark:bg-slate-800/30">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
              <Idea size={13} className="text-amber-500" />
              <span>Popular Quick Presets</span>
            </p>
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {POPULAR_PRESETS.slice(0, 10).map((preset) => (
                <button
                  type="button"
                  key={preset.name}
                  onClick={() => handleApplyPreset(preset)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 shrink-0 transition-all cursor-pointer shadow-2xs"
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: preset.color }}
                  ></span>
                  <span>{preset.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 rounded-xl">
              {error}
            </div>
          )}

          {/* Row 1: Service Name & Color */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Service Name *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="e.g. Netflix, Spotify, AWS"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Accent Color
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {COLOR_OPTIONS.slice(0, 7).map((color) => (
                  <button
                    type="button"
                    key={color}
                    onClick={() => setFormData({ ...formData, color })}
                    className={`w-6 h-6 rounded-full border-2 transition-transform cursor-pointer ${
                      formData.color === color ? 'border-white ring-2 ring-indigo-500 scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Category & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              >
                {CATEGORY_LIST.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as SubscriptionStatus })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              >
                <option value="active">Active</option>
                <option value="paused">Paused</option>
                <option value="trial">Free Trial</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Row 3: Price, Currency, Billing Cycle */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Price *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Currency
              </label>
              <select
                value={formData.currency}
                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              >
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>
                    {curr.code} ({curr.symbol})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Billing Cycle
              </label>
              <select
                value={formData.billing_cycle}
                onChange={(e) => setFormData({ ...formData, billing_cycle: e.target.value as BillingCycle })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              >
                {BILLING_CYCLES.map((cycle) => (
                  <option key={cycle.id} value={cycle.id}>
                    {cycle.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 4: Start Date & Next Billing Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                required
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Next Billing Date *
                </label>
                <button
                  type="button"
                  onClick={autoCalculateNextDate}
                  className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                  title="Compute next date based on cycle"
                >
                  <Refresh size={11} />
                  <span>Auto-Compute</span>
                </button>
              </div>
              <input
                type="date"
                required
                value={formData.next_billing_date}
                onChange={(e) => setFormData({ ...formData, next_billing_date: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Row 5: Payment Method & Reminder Days */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Payment Method
              </label>
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value as PaymentMethod })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.id} value={pm.id}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Renewal Alert (Days Before)
              </label>
              <select
                value={formData.reminder_days}
                onChange={(e) => setFormData({ ...formData, reminder_days: parseInt(e.target.value) || 3 })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              >
                <option value="1">1 day before</option>
                <option value="2">2 days before</option>
                <option value="3">3 days before (Recommended)</option>
                <option value="7">7 days (1 week) before</option>
                <option value="14">14 days (2 weeks) before</option>
                <option value="30">30 days before</option>
              </select>
            </div>
          </div>

          {/* Row 6: Website URL & Cancellation URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Website URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="https://service.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Direct Cancellation / Account URL
              </label>
              <input
                type="url"
                placeholder="https://service.com/cancel"
                value={formData.cancellation_url}
                onChange={(e) => setFormData({ ...formData, cancellation_url: e.target.value })}
                className="w-full px-3.5 py-2.5 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Row 7: Auto-renew toggle & Notes */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoRenewCheck"
                checked={formData.auto_renew}
                onChange={(e) => setFormData({ ...formData, auto_renew: e.target.checked })}
                className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="autoRenewCheck" className="text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                Automatically renews at the end of each cycle
              </label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Personal Notes
              </label>
              <textarea
                rows={2}
                placeholder="Account credentials hint, family members shared with, promo code expiration..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3.5 py-2 text-sm bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-md shadow-indigo-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              <Check size={16} strokeWidth={2.5} />
              <span>{loading ? 'Saving...' : initialData ? 'Update Subscription' : 'Add Subscription'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
