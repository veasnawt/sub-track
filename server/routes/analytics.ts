import { Router } from 'express';
import { db } from '../db';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth';
import { calculateMonthlyEquivalent, calculateYearlyEquivalent, convertCurrency } from '../currency';

const router = Router();
router.use(authMiddleware);

function calculateDaysDifference(targetDateStr: string): number {
  const target = new Date(targetDateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// GET /api/analytics/summary
router.get('/summary', (req: AuthenticatedRequest, res) => {
  const userId = req.user!.userId;
  const targetCurrency = req.user!.currency || 'USD';

  const subscriptions = db.prepare('SELECT * FROM subscriptions WHERE user_id = ?').all(userId) as any[];

  let totalMonthlySpend = 0;
  let totalYearlySpend = 0;
  let activeCount = 0;
  let pausedCount = 0;
  let cancelledCount = 0;
  let trialCount = 0;

  let renewalsNext7DaysCount = 0;
  let renewalsNext7DaysAmount = 0;
  let renewalsNext30DaysCount = 0;
  let renewalsNext30DaysAmount = 0;

  let pausedMonthlySavings = 0;

  const categoryMap: Record<string, { name: string; monthly: number; count: number; color: string }> = {};
  const cycleMap: Record<string, { cycle: string; monthly: number; count: number }> = {};
  const paymentMap: Record<string, { method: string; monthly: number; count: number }> = {};

  let highestExpenseSub: any = null;
  let maxMonthlyCost = 0;

  const upcomingRenewals: any[] = [];
  const trialAlerts: any[] = [];

  for (const sub of subscriptions) {
    const monthlyEq = calculateMonthlyEquivalent(sub.price, sub.billing_cycle, sub.currency, targetCurrency);
    const yearlyEq = calculateYearlyEquivalent(sub.price, sub.billing_cycle, sub.currency, targetCurrency);
    const daysUntil = calculateDaysDifference(sub.next_billing_date);
    const convertedActualPrice = convertCurrency(sub.price, sub.currency, targetCurrency);

    if (sub.status === 'active' || sub.status === 'trial') {
      totalMonthlySpend += monthlyEq;
      totalYearlySpend += yearlyEq;
      activeCount++;

      if (monthlyEq > maxMonthlyCost) {
        maxMonthlyCost = monthlyEq;
        highestExpenseSub = {
          id: sub.id,
          name: sub.name,
          category: sub.category,
          monthly_cost: monthlyEq,
          currency: targetCurrency,
          color: sub.color,
          logo: sub.logo,
        };
      }

      // Track renewals
      if (daysUntil >= 0 && daysUntil <= 7) {
        renewalsNext7DaysCount++;
        renewalsNext7DaysAmount += convertedActualPrice;
      }
      if (daysUntil >= 0 && daysUntil <= 30) {
        renewalsNext30DaysCount++;
        renewalsNext30DaysAmount += convertedActualPrice;
      }

      // Add to upcoming renewals list
      if (daysUntil >= 0) {
        upcomingRenewals.push({
          id: sub.id,
          name: sub.name,
          category: sub.category,
          price: sub.price,
          currency: sub.currency,
          converted_price: convertedActualPrice,
          target_currency: targetCurrency,
          billing_cycle: sub.billing_cycle,
          next_billing_date: sub.next_billing_date,
          days_until: daysUntil,
          color: sub.color,
          logo: sub.logo,
          status: sub.status,
          auto_renew: Boolean(sub.auto_renew),
        });
      }

      // Categories
      if (!categoryMap[sub.category]) {
        categoryMap[sub.category] = {
          name: sub.category,
          monthly: 0,
          count: 0,
          color: sub.color || '#6366F1',
        };
      }
      categoryMap[sub.category].monthly += monthlyEq;
      categoryMap[sub.category].count += 1;

      // Billing Cycle
      if (!cycleMap[sub.billing_cycle]) {
        cycleMap[sub.billing_cycle] = {
          cycle: sub.billing_cycle,
          monthly: 0,
          count: 0,
        };
      }
      cycleMap[sub.billing_cycle].monthly += monthlyEq;
      cycleMap[sub.billing_cycle].count += 1;

      // Payment method
      if (!paymentMap[sub.payment_method]) {
        paymentMap[sub.payment_method] = {
          method: sub.payment_method,
          monthly: 0,
          count: 0,
        };
      }
      paymentMap[sub.payment_method].monthly += monthlyEq;
      paymentMap[sub.payment_method].count += 1;
    }

    if (sub.status === 'paused') {
      pausedCount++;
      pausedMonthlySavings += monthlyEq;
    } else if (sub.status === 'cancelled') {
      cancelledCount++;
    } else if (sub.status === 'trial') {
      trialCount++;
      trialAlerts.push({
        id: sub.id,
        name: sub.name,
        days_until: daysUntil,
        end_date: sub.next_billing_date,
        price: sub.price,
        currency: sub.currency,
      });
    }
  }

  // Sort upcoming renewals chronologically
  upcomingRenewals.sort((a, b) => a.days_until - b.days_until);

  // Category breakdown with percentages
  const categoryBreakdown = Object.values(categoryMap).map((cat) => ({
    name: cat.name,
    monthly: Math.round(cat.monthly * 100) / 100,
    yearly: Math.round(cat.monthly * 12 * 100) / 100,
    count: cat.count,
    percentage: totalMonthlySpend > 0 ? Math.round((cat.monthly / totalMonthlySpend) * 1000) / 10 : 0,
    color: cat.color,
  })).sort((a, b) => b.monthly - a.monthly);

  // Cycle breakdown
  const cycleBreakdown = Object.values(cycleMap).map((c) => ({
    cycle: c.cycle,
    monthly: Math.round(c.monthly * 100) / 100,
    count: c.count,
    percentage: totalMonthlySpend > 0 ? Math.round((c.monthly / totalMonthlySpend) * 1000) / 10 : 0,
  }));

  // Payment method breakdown
  const paymentBreakdown = Object.values(paymentMap).map((p) => ({
    method: p.method,
    monthly: Math.round(p.monthly * 100) / 100,
    count: p.count,
    percentage: totalMonthlySpend > 0 ? Math.round((p.monthly / totalMonthlySpend) * 1000) / 10 : 0,
  }));

  // Recurring cost insights
  const insights = [];

  // Insight 1: Most expensive subscription
  if (highestExpenseSub && totalMonthlySpend > 0) {
    const pct = Math.round((highestExpenseSub.monthly_cost / totalMonthlySpend) * 100);
    insights.push({
      type: 'top_expense',
      title: 'Top Expense Driver',
      message: `${highestExpenseSub.name} accounts for ${pct}% of your monthly subscription spending (${targetCurrency} ${highestExpenseSub.monthly_cost.toFixed(2)}/mo).`,
      impact: 'warning',
      subId: highestExpenseSub.id,
    });
  }

  // Insight 2: Annual switch savings opportunity
  const monthlySubs = subscriptions.filter(s => s.status === 'active' && s.billing_cycle === 'monthly' && s.price >= 10);
  if (monthlySubs.length > 0) {
    const monthlySum = monthlySubs.reduce((acc, s) => acc + calculateMonthlyEquivalent(s.price, s.billing_cycle, s.currency, targetCurrency), 0);
    const potentialAnnualSavings = Math.round(monthlySum * 12 * 0.16 * 100) / 100; // ~16% avg discount for annual billing
    insights.push({
      type: 'annual_discount',
      title: 'Annual Billing Optimization',
      message: `You have ${monthlySubs.length} monthly subscriptions over ${targetCurrency} 10. Switching to annual plans could save you approximately ${targetCurrency} ${potentialAnnualSavings.toFixed(2)}/year.`,
      impact: 'opportunity',
      savings: potentialAnnualSavings,
    });
  }

  // Insight 3: Paused subscriptions savings
  if (pausedMonthlySavings > 0) {
    insights.push({
      type: 'paused_savings',
      title: 'Active Pause Savings',
      message: `You are currently saving ${targetCurrency} ${pausedMonthlySavings.toFixed(2)}/mo (${targetCurrency} ${(pausedMonthlySavings * 12).toFixed(2)}/yr) from ${pausedCount} paused subscription(s).`,
      impact: 'success',
      savings: pausedMonthlySavings * 12,
    });
  }

  // Insight 4: Trial alerts
  if (trialAlerts.length > 0) {
    for (const trial of trialAlerts) {
      insights.push({
        type: 'trial_ending',
        title: 'Free Trial Ending Soon',
        message: `${trial.name} trial ends in ${trial.days_until} day(s). Cancel before ${trial.end_date} to avoid being charged ${trial.currency} ${trial.price}.`,
        impact: 'urgent',
        subId: trial.id,
      });
    }
  }

  // 12-Month Spending Forecast
  const today = new Date();
  const monthlyForecast = [];
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  for (let i = 0; i < 12; i++) {
    const forecastDate = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const monthLabel = `${monthNames[forecastDate.getMonth()]} ${forecastDate.getFullYear().toString().slice(2)}`;
    
    // Calculate expected spend for this month
    let monthSpend = 0;
    for (const sub of subscriptions) {
      if (sub.status !== 'active') continue;
      const convertedPrice = convertCurrency(sub.price, sub.currency, targetCurrency);
      
      if (sub.billing_cycle === 'monthly') {
        monthSpend += convertedPrice;
      } else if (sub.billing_cycle === 'weekly') {
        monthSpend += convertedPrice * 4.333;
      } else if (sub.billing_cycle === 'quarterly') {
        // occurs once every 3 months
        const subDate = new Date(sub.next_billing_date + 'T00:00:00');
        if ((forecastDate.getMonth() - subDate.getMonth()) % 3 === 0) {
          monthSpend += convertedPrice;
        }
      } else if (sub.billing_cycle === 'semi_annual') {
        const subDate = new Date(sub.next_billing_date + 'T00:00:00');
        if ((forecastDate.getMonth() - subDate.getMonth()) % 6 === 0) {
          monthSpend += convertedPrice;
        }
      } else if (sub.billing_cycle === 'yearly') {
        const subDate = new Date(sub.next_billing_date + 'T00:00:00');
        if (forecastDate.getMonth() === subDate.getMonth()) {
          monthSpend += convertedPrice;
        }
      }
    }

    monthlyForecast.push({
      month: monthLabel,
      amount: Math.round(monthSpend * 100) / 100,
    });
  }

  const averageMonthlySpend = activeCount > 0 ? Math.round((totalMonthlySpend / activeCount) * 100) / 100 : 0;

  return res.json({
    success: true,
    data: {
      currency: targetCurrency,
      total_monthly_spend: Math.round(totalMonthlySpend * 100) / 100,
      total_yearly_spend: Math.round(totalYearlySpend * 100) / 100,
      average_monthly_spend: averageMonthlySpend,
      active_count: activeCount,
      paused_count: pausedCount,
      cancelled_count: cancelledCount,
      trial_count: trialCount,
      total_count: subscriptions.length,
      renewals_next_7_days: {
        count: renewalsNext7DaysCount,
        amount: Math.round(renewalsNext7DaysAmount * 100) / 100,
      },
      renewals_next_30_days: {
        count: renewalsNext30DaysCount,
        amount: Math.round(renewalsNext30DaysAmount * 100) / 100,
      },
      category_breakdown: categoryBreakdown,
      billing_cycle_breakdown: cycleBreakdown,
      payment_method_breakdown: paymentBreakdown,
      upcoming_renewals: upcomingRenewals.slice(0, 10),
      all_upcoming_renewals: upcomingRenewals,
      insights,
      monthly_forecast: monthlyForecast,
    },
  });
});

export default router;
