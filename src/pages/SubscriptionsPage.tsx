import React, { useState, useMemo } from 'react';
import { 
  Search, 
  Filter, 
  Sort, 
  Grid, 
  List, 
  Add, 
  Edit, 
  Delete, 
  Check, 
  Time, 
  Globe, 
  ExternalLink, 
  Play, 
  Pause,
  Download,
  Upload,
  Refresh,
  Close,
  Idea,
  Tag
} from '@veasnawt/vicons';
import confetti from 'canvas-confetti';
import { Subscription, FilterOptions, SubscriptionStatus, BillingCycle } from '../types';
import { formatCurrency } from '../lib/currency';

interface SubscriptionsPageProps {
  subscriptions: Subscription[];
  loading: boolean;
  userCurrency: string;
  onOpenAddModal: () => void;
  onEditSubscription: (sub: Subscription) => void;
  onDeleteSubscription: (sub: Subscription) => void;
  onRenewSubscription: (id: string) => void;
  onToggleStatus: (id: string, status: string) => void;
  onOpenExportImport: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const SubscriptionsPage: React.FC<SubscriptionsPageProps> = ({
  subscriptions,
  loading,
  userCurrency,
  onOpenAddModal,
  onEditSubscription,
  onDeleteSubscription,
  onRenewSubscription,
  onToggleStatus,
  onOpenExportImport,
  searchQuery,
  onSearchChange,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCycle, setSelectedCycle] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'next_billing_date' | 'price' | 'name' | 'start_date'>('next_billing_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Distinct categories from existing subscriptions + defaults
  const categories = useMemo(() => {
    const set = new Set<string>();
    subscriptions.forEach(s => {
      if (s.category) set.add(s.category);
    });
    return Array.from(set).sort();
  }, [subscriptions]);

  // Filter and sort subscriptions
  const filteredSubscriptions = useMemo(() => {
    return subscriptions
      .filter((sub) => {
        // Search
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = sub.name.toLowerCase().includes(q);
          const matchCategory = sub.category.toLowerCase().includes(q);
          const matchNotes = (sub.notes || '').toLowerCase().includes(q);
          const matchWebsite = (sub.website || '').toLowerCase().includes(q);
          if (!matchName && !matchCategory && !matchNotes && !matchWebsite) return false;
        }

        // Category
        if (selectedCategory !== 'all' && sub.category !== selectedCategory) {
          return false;
        }

        // Status
        if (selectedStatus !== 'all' && sub.status !== selectedStatus) {
          return false;
        }

        // Cycle
        if (selectedCycle !== 'all' && sub.billing_cycle !== selectedCycle) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortBy === 'next_billing_date') {
          cmp = new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime();
        } else if (sortBy === 'price') {
          cmp = (a.monthly_equivalent || a.price) - (b.monthly_equivalent || b.price);
        } else if (sortBy === 'name') {
          cmp = a.name.localeCompare(b.name);
        } else if (sortBy === 'start_date') {
          cmp = new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [subscriptions, searchQuery, selectedCategory, selectedStatus, selectedCycle, sortBy, sortOrder]);

  const handleRenew = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.8 },
      });
    } catch (e) {}
    onRenewSubscription(id);
  };

  const getStatusBadge = (status: SubscriptionStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
            Active
          </span>
        );
      case 'paused':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60">
            Paused
          </span>
        );
      case 'trial':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/60">
            Free Trial
          </span>
        );
      case 'cancelled':
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Subscriptions
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Manage, filter, and track all your recurring subscriptions and services.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={onOpenExportImport}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Download size={14} />
            <span>Export / Import</span>
          </button>
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Add size={14} strokeWidth={2.5} />
            <span>New Subscription</span>
          </button>
        </div>
      </div>

      {/* Filter and Control Bar */}
      <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-4">
        {/* Search & Main Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search Field */}
          <div className="lg:col-span-2 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={16} />
            </div>
            <input
              type="text"
              placeholder="Search by name, category, notes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
              >
                <Close size={14} />
              </button>
            )}
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Billing Cycle */}
          <div>
            <select
              value={selectedCycle}
              onChange={(e) => setSelectedCycle(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
            >
              <option value="all">All Cycles</option>
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="weekly">Weekly</option>
              <option value="quarterly">Quarterly</option>
              <option value="semi_annual">Semi-Annual</option>
              <option value="lifetime">Lifetime</option>
            </select>
          </div>

          {/* Sort Control */}
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="flex-1 px-3 py-2 text-xs sm:text-sm bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl focus:border-indigo-500 focus:outline-none text-slate-900 dark:text-white"
            >
              <option value="next_billing_date">Sort: Next Renewal</option>
              <option value="price">Sort: Price</option>
              <option value="name">Sort: Name</option>
              <option value="start_date">Sort: Start Date</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              className="p-2 bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
              title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
            >
              <Sort size={16} />
            </button>
          </div>
        </div>

        {/* Status Filter Pills & View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          {/* Status Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {['all', 'active', 'paused', 'trial', 'cancelled'].map((status) => (
              <button
                key={status}
                onClick={() => setSelectedStatus(status)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold capitalize transition-all cursor-pointer ${
                  selectedStatus === status
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {status === 'all' ? 'All' : status === 'trial' ? 'Free Trials' : status}
              </button>
            ))}
          </div>

          {/* View Toggle */}
          <div className="flex items-center gap-1 self-end sm:self-auto bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Grid Cards View"
            >
              <Grid size={16} />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Table View"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Subscription Results */}
      {filteredSubscriptions.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-500 flex items-center justify-center mx-auto">
            <Tag size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">
            No subscriptions matched your filters
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
            Try adjusting your search keywords, clear category filters, or add a new subscription.
          </p>
          <div className="pt-2 flex items-center justify-center gap-2">
            {(searchQuery || selectedCategory !== 'all' || selectedStatus !== 'all' || selectedCycle !== 'all') && (
              <button
                onClick={() => {
                  onSearchChange('');
                  setSelectedCategory('all');
                  setSelectedStatus('all');
                  setSelectedCycle('all');
                }}
                className="px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Reset Filters
              </button>
            )}
            <button
              onClick={onOpenAddModal}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm cursor-pointer"
            >
              Add Subscription
            </button>
          </div>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid View */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSubscriptions.map((sub) => {
            const isUrgent = (sub.days_until_renewal ?? 99) <= 3;
            const isToday = sub.days_until_renewal === 0;

            return (
              <div
                key={sub.id}
                onClick={() => onEditSubscription(sub)}
                className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md hover:border-indigo-200 dark:hover:border-indigo-800/60 transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden"
              >
                {/* Top Section */}
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0 group-hover:scale-105 transition-transform"
                        style={{ backgroundColor: sub.color || '#4F46E5' }}
                      >
                        {sub.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {sub.name}
                        </h3>
                        <span className="text-xs text-slate-500 dark:text-slate-400 block truncate">
                          {sub.category}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {getStatusBadge(sub.status)}
                    </div>
                  </div>

                  {/* Price & Billing Cycle */}
                  <div className="mt-4 flex items-baseline justify-between">
                    <div>
                      <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white">
                        {formatCurrency(sub.price, sub.currency)}
                      </span>
                      <span className="text-xs text-slate-400 ml-1 uppercase font-semibold">
                        /{sub.billing_cycle}
                      </span>
                    </div>

                    {sub.billing_cycle !== 'monthly' && (
                      <div className="text-[11px] text-slate-400">
                        ~{formatCurrency(sub.monthly_equivalent, userCurrency)}/mo
                      </div>
                    )}
                  </div>

                  {/* Payment Method & Start Date */}
                  <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span className="capitalize font-medium">
                      💳 {sub.payment_method.replace(/_/g, ' ')}
                    </span>
                    <span>Started: {sub.start_date}</span>
                  </div>

                  {/* Notes snippet if present */}
                  {sub.notes && (
                    <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-xl line-clamp-2 italic">
                      "{sub.notes}"
                    </p>
                  )}
                </div>

                {/* Bottom Renewal & Action Row */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full flex items-center gap-1 ${
                        isToday
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 animate-pulse'
                          : isUrgent
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <Time size={10} />
                      {isToday
                        ? 'Renews Today'
                        : sub.days_until_renewal === 1
                        ? 'Renews Tomorrow'
                        : `In ${sub.days_until_renewal} days`}
                    </span>
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {/* Mark Renewed */}
                    {sub.status === 'active' && (
                      <button
                        type="button"
                        onClick={(e) => handleRenew(sub.id, e)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-lg transition-colors cursor-pointer"
                        title="Mark renewed & advance billing date"
                      >
                        <Check size={16} strokeWidth={2.5} />
                      </button>
                    )}

                    {/* Pause / Play Toggle */}
                    <button
                      type="button"
                      onClick={() => onToggleStatus(sub.id, sub.status === 'active' ? 'paused' : 'active')}
                      className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      title={sub.status === 'active' ? 'Pause subscription' : 'Activate subscription'}
                    >
                      {sub.status === 'active' ? <Pause size={15} /> : <Play size={15} />}
                    </button>

                    {/* External Link */}
                    {sub.website && (
                      <a
                        href={sub.website}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        title="Visit Website"
                      >
                        <ExternalLink size={15} />
                      </a>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => onDeleteSubscription(sub)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
                      title="Delete subscription"
                    >
                      <Delete size={15} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/30">
                <th className="py-3.5 px-4 font-bold">Service</th>
                <th className="py-3.5 px-4 font-bold">Category</th>
                <th className="py-3.5 px-4 font-bold">Price</th>
                <th className="py-3.5 px-4 font-bold">Monthly Eq.</th>
                <th className="py-3.5 px-4 font-bold">Next Billing</th>
                <th className="py-3.5 px-4 font-bold">Status</th>
                <th className="py-3.5 px-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {filteredSubscriptions.map((sub) => (
                <tr
                  key={sub.id}
                  onClick={() => onEditSubscription(sub)}
                  className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 cursor-pointer transition-colors"
                >
                  {/* Service Name */}
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0"
                        style={{ backgroundColor: sub.color || '#4F46E5' }}
                      >
                        {sub.name.charAt(0)}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">
                          {sub.name}
                        </div>
                        <div className="text-[11px] text-slate-400 capitalize">
                          {sub.payment_method.replace(/_/g, ' ')}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Category */}
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {sub.category}
                  </td>

                  {/* Price */}
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {formatCurrency(sub.price, sub.currency)}{' '}
                    <span className="text-[10px] text-slate-400 font-normal uppercase">
                      /{sub.billing_cycle}
                    </span>
                  </td>

                  {/* Monthly Equivalent */}
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {formatCurrency(sub.monthly_equivalent, userCurrency)}/mo
                  </td>

                  {/* Next Billing */}
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900 dark:text-white">
                      {sub.next_billing_date}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {sub.days_until_renewal === 0
                        ? 'Today!'
                        : sub.days_until_renewal === 1
                        ? 'Tomorrow'
                        : `In ${sub.days_until_renewal} days`}
                    </div>
                  </td>

                  {/* Status */}
                  <td className="py-3 px-4">
                    {getStatusBadge(sub.status)}
                  </td>

                  {/* Actions */}
                  <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1.5">
                      {sub.status === 'active' && (
                        <button
                          type="button"
                          onClick={(e) => handleRenew(sub.id, e)}
                          className="px-2 py-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg hover:bg-emerald-100 cursor-pointer"
                          title="Mark as Renewed"
                        >
                          Renew
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEditSubscription(sub)}
                        className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title="Edit"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSubscription(sub)}
                        className="p-1 text-slate-400 hover:text-rose-600"
                        title="Delete"
                      >
                        <Delete size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
