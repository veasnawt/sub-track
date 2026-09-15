import React, { useState, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Time, 
  Check, 
  ExternalLink,
  Add,
  Close,
  Tag
} from '@veasnawt/vicons';
import confetti from 'canvas-confetti';
import { Subscription } from '../types';
import { formatCurrency } from '../lib/currency';

interface CalendarPageProps {
  subscriptions: Subscription[];
  userCurrency: string;
  onRenewSubscription: (id: string) => void;
  onEditSubscription: (sub: Subscription) => void;
  onOpenAddModal: () => void;
}

export const CalendarPage: React.FC<CalendarPageProps> = ({
  subscriptions,
  userCurrency,
  onRenewSubscription,
  onEditSubscription,
  onOpenAddModal,
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  // Calculate calendar grid days
  const calendarDays = useMemo(() => {
    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();

    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean; isToday: boolean }[] = [];

    const todayStr = new Date().toISOString().split('T')[0];

    // Previous month padding
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const prevMonthDate = new Date(year, month - 1, d);
      const dateStr = prevMonthDate.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= totalDaysInMonth; d++) {
      const currentMonthDate = new Date(year, month, d);
      const dateStr = currentMonthDate.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding to fill complete grid of 35 or 42
    const totalCells = days.length > 35 ? 42 : 35;
    const remaining = totalCells - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextMonthDate = new Date(year, month + 1, d);
      const dateStr = nextMonthDate.toISOString().split('T')[0];
      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [year, month]);

  // Map subscriptions to renewal dates
  const renewalsByDate = useMemo(() => {
    const map: Record<string, Subscription[]> = {};
    subscriptions.forEach((sub) => {
      if (sub.status !== 'active' && sub.status !== 'trial') return;
      const d = sub.next_billing_date;
      if (!map[d]) map[d] = [];
      map[d].push(sub);
    });
    return map;
  }, [subscriptions]);

  // Selected month totals
  const currentMonthRenewals = useMemo(() => {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
    const inMonth: Subscription[] = [];
    let totalSpend = 0;

    subscriptions.forEach((sub) => {
      if (sub.status === 'active' || sub.status === 'trial') {
        if (sub.next_billing_date.startsWith(prefix)) {
          inMonth.push(sub);
          totalSpend += sub.monthly_equivalent || sub.price;
        }
      }
    });

    inMonth.sort((a, b) => new Date(a.next_billing_date).getTime() - new Date(b.next_billing_date).getTime());

    return {
      list: inMonth,
      totalSpend: Math.round(totalSpend * 100) / 100,
      count: inMonth.length,
    };
  }, [subscriptions, year, month]);

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const jumpToToday = () => {
    setCurrentDate(new Date());
    setSelectedDay(new Date().toISOString().split('T')[0]);
  };

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

  const selectedDayRenewals = selectedDay ? renewalsByDate[selectedDay] || [] : [];

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header and Month Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Renewal Calendar
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Visualize upcoming billing events and monthly cash commitments.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={jumpToToday}
            className="px-3 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-700 shadow-2xs cursor-pointer"
          >
            Today
          </button>

          <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-0.5 shadow-2xs">
            <button
              onClick={prevMonth}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="px-3 py-1 text-xs sm:text-sm font-bold text-slate-900 dark:text-white min-w-[130px] text-center">
              {monthNames[month]} {year}
            </span>
            <button
              onClick={nextMonth}
              className="p-1.5 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg cursor-pointer"
              title="Next Month"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm cursor-pointer"
          >
            <Add size={14} strokeWidth={2.5} />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* Monthly Summary Bar */}
      <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
            <CalendarIcon size={16} />
          </div>
          <div>
            <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
              {monthNames[month]} Renewal Total
            </span>
            <p className="text-[11px] text-indigo-700/80 dark:text-indigo-300/70">
              {currentMonthRenewals.count} scheduled renewal(s) this month
            </p>
          </div>
        </div>

        <div className="text-left sm:text-right">
          <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">
            {formatCurrency(currentMonthRenewals.totalSpend, userCurrency)}
          </span>
          <span className="text-xs text-indigo-500 dark:text-indigo-300 block">
            estimated outflow
          </span>
        </div>
      </div>

      {/* Main Calendar Grid & Detail Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 p-4 sm:p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
          {/* Days of week header */}
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {daysOfWeek.map((day) => (
              <div key={day} className="py-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((day, idx) => {
              const renewals = renewalsByDate[day.dateStr] || [];
              const hasRenewals = renewals.length > 0;
              const isSelected = selectedDay === day.dateStr;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedDay(day.dateStr)}
                  className={`min-h-[70px] sm:min-h-[88px] p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 ring-2 ring-indigo-500/20'
                      : day.isToday
                      ? 'border-indigo-400 dark:border-indigo-600 bg-slate-50 dark:bg-slate-800/40'
                      : day.isCurrentMonth
                      ? 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
                      : 'border-transparent bg-slate-50/40 dark:bg-slate-900/30 opacity-40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                        day.isToday
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : day.isCurrentMonth
                          ? 'text-slate-800 dark:text-slate-200'
                          : 'text-slate-400'
                      }`}
                    >
                      {day.dayNum}
                    </span>

                    {hasRenewals && (
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                        {renewals.length}
                      </span>
                    )}
                  </div>

                  {/* Subscriptions Pills / Dots */}
                  <div className="space-y-1 mt-1 overflow-hidden">
                    {renewals.slice(0, 2).map((sub) => (
                      <div
                        key={sub.id}
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold truncate flex items-center gap-1 text-white shadow-2xs"
                        style={{ backgroundColor: sub.color || '#4F46E5' }}
                        title={`${sub.name} - ${formatCurrency(sub.price, sub.currency)}`}
                      >
                        <span className="truncate">{sub.name}</span>
                      </div>
                    ))}
                    {renewals.length > 2 && (
                      <span className="text-[9px] font-bold text-slate-400 block truncate pl-1">
                        +{renewals.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Selected Day Detail Panel */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {selectedDay ? `Renewals on ${selectedDay}` : 'Day Breakdown'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                {selectedDayRenewals.length} subscription(s) renewing
              </p>
            </div>

            {selectedDay && (
              <button
                onClick={() => setSelectedDay(null)}
                className="text-xs text-slate-400 hover:text-slate-600"
              >
                Clear
              </button>
            )}
          </div>

          <div className="py-4 space-y-3 flex-1 overflow-y-auto max-h-[460px]">
            {selectedDayRenewals.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                {selectedDay
                  ? 'No subscriptions scheduled for renewal on this date.'
                  : 'Click on any calendar day to inspect scheduled subscriptions.'}
              </div>
            ) : (
              selectedDayRenewals.map((sub) => (
                <div
                  key={sub.id}
                  onClick={() => onEditSubscription(sub)}
                  className="p-3.5 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 hover:bg-white dark:hover:bg-slate-800 transition-all cursor-pointer space-y-2.5 shadow-2xs group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm"
                        style={{ backgroundColor: sub.color || '#4F46E5' }}
                      >
                        {sub.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-900 dark:text-white truncate group-hover:text-indigo-600">
                          {sub.name}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {sub.category}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">
                        {formatCurrency(sub.price, sub.currency)}
                      </div>
                      <div className="text-[10px] text-slate-400 uppercase">
                        {sub.billing_cycle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-[11px]">
                    <span className="text-slate-500 capitalize">
                      💳 {sub.payment_method.replace(/_/g, ' ')}
                    </span>
                    <button
                      onClick={(e) => handleRenew(sub.id, e)}
                      className="px-2.5 py-1 text-[10px] font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <Check size={11} strokeWidth={2.5} />
                      <span>Mark Renewed</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
