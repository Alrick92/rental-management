"use client";

import { useEffect, useState, useCallback } from "react";
import { formatMoney, DEFAULT_CURRENCY } from "@/lib/currency";
import type { CurrencyInfo } from "@/lib/currency";

interface UseCurrenciesReturn {
  currencies: CurrencyInfo[];
  defaultCurrency: CurrencyInfo;
  loading: boolean;
  format: (amountMinor: number, currencyCode?: string | null) => string;
}

export function useCurrencies(): UseCurrenciesReturn {
  const [currencies, setCurrencies] = useState<CurrencyInfo[]>([]);
  const [defaultCode, setDefaultCode] = useState("USD");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [currRes, settingsRes] = await Promise.all([
        fetch("/api/v1/currencies"),
        fetch("/api/v1/org-settings"),
      ]);
      if (currRes.ok) {
        setCurrencies(await currRes.json());
      }
      if (settingsRes.ok) {
        const settings = await settingsRes.json();
        setDefaultCode(settings.default_currency || "USD");
      }
      setLoading(false);
    }
    load();
  }, []);

  const defaultCurrency = currencies.find((c) => c.code === defaultCode) || DEFAULT_CURRENCY;

  const format = useCallback(
    (amountMinor: number, currencyCode?: string | null) => {
      const currency = currencyCode
        ? currencies.find((c) => c.code === currencyCode) || defaultCurrency
        : defaultCurrency;
      return formatMoney(amountMinor, currency);
    },
    [currencies, defaultCurrency]
  );

  return { currencies, defaultCurrency, loading, format };
}
