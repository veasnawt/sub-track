export const EXCHANGE_RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.52,
  JPY: 154.0,
  KHR: 4050.0,
};

export const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'AU$',
  JPY: '¥',
  KHR: '៛',
};

/**
 * Converts an amount from one currency to target currency.
 */
export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string = 'USD'
): number {
  if (fromCurrency === toCurrency) return amount;
  const rateFrom = EXCHANGE_RATES[fromCurrency.toUpperCase()] || 1.0;
  const rateTo = EXCHANGE_RATES[toCurrency.toUpperCase()] || 1.0;
  // Convert from source to USD, then from USD to target
  const inUSD = amount / rateFrom;
  const inTarget = inUSD * rateTo;
  return Math.round(inTarget * 100) / 100;
}

/**
 * Converts price and billing cycle to monthly equivalent in target currency.
 */
export function calculateMonthlyEquivalent(
  price: number,
  billingCycle: string,
  fromCurrency: string = 'USD',
  toCurrency: string = 'USD'
): number {
  const convertedPrice = convertCurrency(price, fromCurrency, toCurrency);
  switch (billingCycle.toLowerCase()) {
    case 'weekly':
      return Math.round(convertedPrice * 4.3333 * 100) / 100;
    case 'monthly':
      return Math.round(convertedPrice * 100) / 100;
    case 'quarterly':
      return Math.round((convertedPrice / 3) * 100) / 100;
    case 'semi_annual':
      return Math.round((convertedPrice / 6) * 100) / 100;
    case 'yearly':
      return Math.round((convertedPrice / 12) * 100) / 100;
    case 'lifetime':
      return 0; // one-time fee
    default:
      return Math.round(convertedPrice * 100) / 100;
  }
}

/**
 * Converts price and billing cycle to yearly equivalent in target currency.
 */
export function calculateYearlyEquivalent(
  price: number,
  billingCycle: string,
  fromCurrency: string = 'USD',
  toCurrency: string = 'USD'
): number {
  const monthly = calculateMonthlyEquivalent(price, billingCycle, fromCurrency, toCurrency);
  return Math.round(monthly * 12 * 100) / 100;
}
