export type BillingCycle = 'weekly' | 'monthly' | 'quarterly' | 'semi_annual' | 'yearly' | 'lifetime';
export type SubscriptionStatus = 'active' | 'paused' | 'cancelled' | 'trial';
export type PaymentMethod = 'credit_card' | 'debit_card' | 'paypal' | 'apple_pay' | 'google_pay' | 'bank_transfer' | 'crypto' | 'other';

export interface User {
  userId: string;
  name: string;
  email: string;
  currency: string;
  theme?: 'light' | 'dark' | 'system';
  createdAt?: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  billing_cycle: BillingCycle;
  payment_method: PaymentMethod;
  start_date: string; // YYYY-MM-DD
  next_billing_date: string; // YYYY-MM-DD
  status: SubscriptionStatus;
  notes?: string;
  website?: string;
  logo?: string;
  color?: string;
  reminder_days: number;
  auto_renew: boolean;
  cancellation_url?: string;
  created_at?: string;
  updated_at?: string;
  
  // Computed properties from API
  days_until_renewal?: number;
  is_renewing_soon?: boolean;
  is_overdue?: boolean;
  monthly_equivalent?: number;
  yearly_equivalent?: number;
}

export interface Category {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  is_system?: boolean;
}

export interface CategoryBreakdown {
  name: string;
  monthly: number;
  yearly: number;
  count: number;
  percentage: number;
  color?: string;
}

export interface UpcomingRenewal {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  converted_price: number;
  target_currency: string;
  billing_cycle: BillingCycle;
  next_billing_date: string;
  days_until: number;
  color?: string;
  logo?: string;
  status: SubscriptionStatus;
  auto_renew: boolean;
}

export interface CostInsight {
  type: 'top_expense' | 'annual_discount' | 'paused_savings' | 'trial_ending';
  title: string;
  message: string;
  impact: 'warning' | 'opportunity' | 'success' | 'urgent';
  savings?: number;
  subId?: string;
}

export interface AnalyticsSummary {
  currency: string;
  total_monthly_spend: number;
  total_yearly_spend: number;
  average_monthly_spend: number;
  active_count: number;
  paused_count: number;
  cancelled_count: number;
  trial_count: number;
  total_count: number;
  renewals_next_7_days: {
    count: number;
    amount: number;
  };
  renewals_next_30_days: {
    count: number;
    amount: number;
  };
  category_breakdown: CategoryBreakdown[];
  billing_cycle_breakdown: {
    cycle: BillingCycle;
    monthly: number;
    count: number;
    percentage: number;
  }[];
  payment_method_breakdown: {
    method: PaymentMethod;
    monthly: number;
    count: number;
    percentage: number;
  }[];
  upcoming_renewals: UpcomingRenewal[];
  all_upcoming_renewals: UpcomingRenewal[];
  insights: CostInsight[];
  monthly_forecast: {
    month: string;
    amount: number;
  }[];
}

export interface FilterOptions {
  search: string;
  category: string;
  status: string;
  billing_cycle: string;
  payment_method: string;
  sort_by: 'next_billing_date' | 'price' | 'name' | 'created_at';
  sort_order: 'asc' | 'desc';
}
