export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  decimal_places: number;
}

/**
 * Format an amount in minor units (cents) to a display string using the currency's
 * symbol and decimal places.
 *
 * Examples:
 *   formatMoney(150000, { symbol: "$", decimal_places: 2 }) → "$1,500.00"
 *   formatMoney(150000, { symbol: "CFA", decimal_places: 0 }) → "CFA 150,000"
 *   formatMoney(150000, { symbol: "¥", decimal_places: 0 }) → "¥150,000"
 */
export function formatMoney(
  amountMinor: number,
  currency: Pick<CurrencyInfo, "symbol" | "decimal_places">
): string {
  const divisor = Math.pow(10, currency.decimal_places);
  const amount = amountMinor / divisor;

  const formatted = amount.toLocaleString("en-US", {
    minimumFractionDigits: currency.decimal_places,
    maximumFractionDigits: currency.decimal_places,
  });

  // For multi-character symbols (e.g. "CFA", "CHF"), add a space after
  if (currency.symbol.length > 1) {
    return `${currency.symbol} ${formatted}`;
  }

  return `${currency.symbol}${formatted}`;
}

/**
 * Default currency used as fallback when no currency is configured.
 */
export const DEFAULT_CURRENCY: CurrencyInfo = {
  code: "USD",
  symbol: "$",
  name: "US Dollar",
  decimal_places: 2,
};
