import React from 'react';
import { 
  TrendUp, 
  TrendDown, 
  Calendar, 
  Time, 
  Check, 
  ExternalLink, 
  Shield, 
  Tag, 
  Idea, 
  ChevronRight,
  Add,
  PieChart as PieIcon,
  BarChart as BarIcon,
  Play,
  Pause
} from '@veasnawt/vicons';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';
import confetti from 'canvas-confetti';
import { AnalyticsSummary, Subscription } from '../types';
import { formatCurrency } from '../lib/currency';

interface DashboardPageProps {
  analytics: AnalyticsSummary | null;
  loading: boolean;
  onOpenAddModal: () => void;
  onRenewSubscription: (id: string) => void;
  onEditSubscription: (sub: Subscription) => void;
  onNavigate: (tab: string) => void;
}

const PIE_COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4', '#64748B'];

export const DashboardPage: React.FC<DashboardPageProps> = ({
  analytics,
  loading,
  onOpenAddModal,
  onRenewSubscription,
  onEditSubscription,
  onNavigate,
}) => {
  if (loading || !analytics) {
    return (
      <div className="space-y-6 animate-pulse p-4 sm:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-28 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          ))}
        </div>
        <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
      </div>
    );
  }

  const currency = analytics.currency || 'USD';

  const triggerRenew = (id: string, e: React.MouseEvent) => {
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

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Banner / Welcome */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Dashboard & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Real-time spending overview, upcoming renewals, and savings opportunities.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigate('calendar')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer"
          >
            <Calendar size={14} />
            <span>Renewal Calendar</span>
          </button>
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-500/20 transition-all cursor-pointer"
          >
            <Add size={14} strokeWidth={2.5} />
            <span>Add Subscription</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Monthly Spending */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Monthly Spending
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <TrendUp size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(analytics.total_monthly_spend, currency)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Normalized from {analytics.active_count} active services
            </p>
          </div>
          <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Card 2: Yearly Outflow */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Yearly Projected
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Calendar size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(analytics.total_yearly_spend, currency)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Annual recurring commitment
            </p>
          </div>
          <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-purple-500/5 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Card 3: Upcoming in 7 Days */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Due in Next 7 Days
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Time size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-rose-600 dark:text-rose-400 tracking-tight flex items-baseline gap-2">
              {formatCurrency(analytics.renewals_next_7_days.amount, currency)}
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                ({analytics.renewals_next_7_days.count} bills)
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {analytics.renewals_next_30_days.count} due across next 30 days
            </p>
          </div>
          <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-rose-500/5 rounded-full blur-xl pointer-events-none"></div>
        </div>

        {/* Card 4: Average Cost per Service */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs hover:shadow-md transition-shadow relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Avg Cost / Service
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <PieIcon size={18} />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
              {formatCurrency(analytics.average_monthly_spend, currency)}
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              {analytics.active_count} active, {analytics.paused_count} paused, {analytics.trial_count} trial
            </p>
          </div>
          <div className="absolute -bottom-8 -right-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none"></div>
        </div>
      </div>

      {/* Smart Recurring-Cost Insights Banner */}
      {analytics.insights && analytics.insights.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Idea size={15} className="text-amber-500" />
              <span>Smart Recurring Cost Insights</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {analytics.insights.map((insight, idx) => {
              const isUrgent = insight.impact === 'urgent';
              const isOpp = insight.impact === 'opportunity';
              const isSuccess = insight.impact === 'success';

              return (
                <div
                  key={idx}
                  className={`p-4 rounded-2xl border transition-all ${
                    isUrgent
                      ? 'bg-rose-50/60 dark:bg-rose-950/25 border-rose-200 dark:border-rose-900/60 text-rose-900 dark:text-rose-200'
                      : isOpp
                      ? 'bg-amber-50/60 dark:bg-amber-950/25 border-amber-200 dark:border-amber-900/60 text-amber-900 dark:text-amber-200'
                      : isSuccess
                      ? 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-200 dark:border-emerald-900/60 text-emerald-900 dark:text-emerald-200'
                      : 'bg-indigo-50/60 dark:bg-indigo-950/25 border-indigo-200 dark:border-indigo-900/60 text-indigo-900 dark:text-indigo-200'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isUrgent
                          ? 'bg-rose-500 animate-pulse'
                          : isOpp
                          ? 'bg-amber-500'
                          : isSuccess
                          ? 'bg-emerald-500'
                          : 'bg-indigo-500'
                      }`}
                    />
                    <span className="text-xs font-bold">{insight.title}</span>
                  </div>
                  <p className="text-xs opacity-90 leading-relaxed">
                    {insight.message}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Forecast Area Chart */}
        <div className="lg:col-span-2 p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                12-Month Expense Forecast
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Projected cash outflow considering monthly, quarterly, and annual renewals.
              </p>
            </div>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analytics.monthly_forecast} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="forecastGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value), currency), 'Forecast Spend']}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#6366F1"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#forecastGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Doughnut */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Category Allocation
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Distribution of monthly subscription budget.
            </p>
          </div>

          <div className="h-48 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.category_breakdown}
                  dataKey="monthly"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                >
                  {analytics.category_breakdown.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value), currency), 'Monthly']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Category Top List */}
          <div className="mt-auto space-y-2 pt-3 border-t border-slate-100 dark:border-slate-800">
            {analytics.category_breakdown.slice(0, 4).map((cat, i) => (
              <div key={cat.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 truncate">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color || PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="text-slate-700 dark:text-slate-300 truncate">{cat.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {formatCurrency(cat.monthly, currency)}
                  </span>
                  <span className="text-[11px] text-slate-400">({cat.percentage}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upcoming Renewal Timeline */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <span>Upcoming Renewal Timeline</span>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                Next 10 Bills
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Click 'Mark Renewed' to log payment and advance billing to the next cycle.
            </p>
          </div>

          <button
            onClick={() => onNavigate('calendar')}
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>Full Calendar</span>
            <ChevronRight size={14} />
          </button>
        </div>

        {analytics.upcoming_renewals.length === 0 ? (
          <div className="text-center py-10 text-slate-400 text-xs">
            No active subscriptions scheduled for renewal.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {analytics.upcoming_renewals.map((sub) => {
              const isUrgent = sub.days_until <= 3;
              const isToday = sub.days_until === 0;

              return (
                <div
                  key={sub.id}
                  className="p-4 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-all flex flex-col justify-between gap-3 shadow-2xs group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                        style={{ backgroundColor: sub.color || '#4F46E5' }}
                      >
                        {sub.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {sub.name}
                        </h4>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                          {sub.category}
                        </span>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                        {formatCurrency(sub.converted_price, sub.target_currency)}
                      </div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400">
                        {sub.billing_cycle}
                      </span>
                    </div>
                  </div>

                  {/* Timing & Action Row */}
                  <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2">
                    <span
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full flex items-center gap-1 ${
                        isToday
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 animate-pulse'
                          : isUrgent
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400'
                          : 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <Time size={10} />
                      {isToday
                        ? 'Due Today!'
                        : sub.days_until === 1
                        ? 'Due Tomorrow'
                        : `In ${sub.days_until} days (${sub.next_billing_date})`}
                    </span>

                    <button
                      onClick={(e) => triggerRenew(sub.id, e)}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-2xs hover:shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                      title="Log payment and advance to next renewal cycle"
                    >
                      <Check size={12} strokeWidth={2.5} />
                      <span>Renew</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
