import React from 'react';
import { 
  PieChart as PieIcon, 
  BarChart as BarIcon, 
  TrendUp, 
  TrendDown, 
  Tag, 
  Idea, 
  Download,
  Calendar,
  Shield,
  Check
} from '@veasnawt/vicons';
import {
  BarChart,
  Bar,
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
import { AnalyticsSummary } from '../types';
import { formatCurrency } from '../lib/currency';

interface AnalyticsPageProps {
  analytics: AnalyticsSummary | null;
  loading: boolean;
  onOpenExportImport: () => void;
}

const PALETTE = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#06B6D4', '#64748B'];

export const AnalyticsPage: React.FC<AnalyticsPageProps> = ({
  analytics,
  loading,
  onOpenExportImport,
}) => {
  if (loading || !analytics) {
    return (
      <div className="space-y-6 animate-pulse p-4 sm:p-6">
        <div className="h-64 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
          <div className="h-72 bg-slate-200 dark:bg-slate-800 rounded-3xl"></div>
        </div>
      </div>
    );
  }

  const currency = analytics.currency || 'USD';

  // Category data for BarChart
  const barChartData = analytics.category_breakdown.map((c) => ({
    name: c.name.split(' ')[0], // short name
    fullName: c.name,
    monthly: c.monthly,
    yearly: c.yearly,
  }));

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Financial Analytics & Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Detailed spending breakdown across categories, payment methods, and billing cycles.
          </p>
        </div>

        <button
          onClick={onOpenExportImport}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <Download size={14} />
          <span>Export Analytics</span>
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Total Monthly Outflow
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
            {formatCurrency(analytics.total_monthly_spend, currency)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {formatCurrency(analytics.total_yearly_spend, currency)} annualized
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Active Subscriptions
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400">
            {analytics.active_count}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {analytics.paused_count} paused • {analytics.trial_count} trial
          </p>
        </div>

        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Average Spend / Service
          </span>
          <div className="mt-2 text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400">
            {formatCurrency(analytics.average_monthly_spend, currency)}
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            Across active subscriptions
          </p>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Monthly Cost BarChart */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Spending by Category
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Monthly cost comparison by subscription category.
            </p>
          </div>

          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis 
                  dataKey="name" 
                  tick={{ fontSize: 10, fill: '#94A3B8' }} 
                  interval={0} 
                  angle={-25} 
                  textAnchor="end" 
                  tickLine={false} 
                  axisLine={false} 
                />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(15, 23, 42, 0.9)',
                    borderRadius: '12px',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  formatter={(value: any) => [formatCurrency(Number(value), currency), 'Monthly Spend']}
                  labelFormatter={(name, payload) => payload?.[0]?.payload?.fullName || name}
                />
                <Bar dataKey="monthly" fill="#6366F1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Payment Method Breakdown */}
        <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          <div className="mb-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Payment Method Distribution
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Where subscription payments are charged.
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {analytics.payment_method_breakdown.map((pm, i) => (
              <div key={pm.method} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 dark:text-slate-300 capitalize flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                    />
                    <span>{pm.method.replace(/_/g, ' ')}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {formatCurrency(pm.monthly, currency)}/mo
                    </span>
                    <span className="text-[11px] text-slate-400">
                      ({pm.percentage}%)
                    </span>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${pm.percentage}%`,
                      backgroundColor: PALETTE[i % PALETTE.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Category Deep-Dive Table */}
      <div className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">
          Detailed Category Performance
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-slate-100 dark:border-slate-800 text-slate-400 text-[11px] uppercase tracking-wider bg-slate-50/50 dark:bg-slate-800/30">
                <th className="py-3 px-4 font-bold">Category</th>
                <th className="py-3 px-4 font-bold">Services Count</th>
                <th className="py-3 px-4 font-bold">Monthly Commitment</th>
                <th className="py-3 px-4 font-bold">Annual Commitment</th>
                <th className="py-3 px-4 font-bold text-right">% of Budget</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
              {analytics.category_breakdown.map((cat, idx) => (
                <tr key={cat.name} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cat.color || PALETTE[idx % PALETTE.length] }}
                    />
                    <span>{cat.name}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {cat.count} service(s)
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-900 dark:text-white">
                    {formatCurrency(cat.monthly, currency)}
                  </td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                    {formatCurrency(cat.yearly, currency)}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-indigo-600 dark:text-indigo-400">
                    {cat.percentage}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
