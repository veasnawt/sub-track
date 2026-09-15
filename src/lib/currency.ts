export const SUPPORTED_CURRENCIES = [
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: 'AU$', name: 'Australian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'KHR', symbol: '៛', name: 'Cambodian Riel' },
];

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

export function formatCurrency(amount: number | undefined | null, currency: string = 'USD'): string {
  if (amount === undefined || amount === null || isNaN(amount)) return '$0.00';
  const curr = currency.toUpperCase();
  const symbol = CURRENCY_SYMBOLS[curr] || curr;

  // Currencies with no decimal places typically (JPY, KHR)
  const isZeroDecimal = curr === 'JPY' || curr === 'KHR';
  const formattedNumber = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: isZeroDecimal ? 0 : 2,
    maximumFractionDigits: isZeroDecimal ? 0 : 2,
  }).format(amount);

  return `${symbol}${formattedNumber}`;
}

export function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string = 'USD'
): number {
  if (fromCurrency === toCurrency) return amount;
  const rateFrom = EXCHANGE_RATES[fromCurrency.toUpperCase()] || 1.0;
  const rateTo = EXCHANGE_RATES[toCurrency.toUpperCase()] || 1.0;
  const inUSD = amount / rateFrom;
  const inTarget = inUSD * rateTo;
  return Math.round(inTarget * 100) / 100;
}

export function calculateMonthlyPrice(
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
      return 0;
    default:
      return Math.round(convertedPrice * 100) / 100;
  }
}
