"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/button";

interface OrgSettings {
  id: string;
  name: string;
  slug: string;
  default_currency: string;
  timezone: string;
  management_fee_percent: number;
  invoice_lead_days: number;
  grace_period_days: number;
  status: string;
}

interface CurrencyOption {
  code: string;
  symbol: string;
  name: string;
}

export default function OrgSettingsPage() {
  const [settings, setSettings] = useState<OrgSettings | null>(null);
  const [currencies, setCurrencies] = useState<CurrencyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      const [settingsRes, currenciesRes] = await Promise.all([
        fetch("/api/v1/org-settings"),
        fetch("/api/v1/currencies"),
      ]);
      if (settingsRes.ok) {
        setSettings(await settingsRes.json());
      }
      if (currenciesRes.ok) {
        setCurrencies(await currenciesRes.json());
      }
      setLoading(false);
    }
    load();
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    setError("");
    setSuccess("");

    const res = await fetch("/api/v1/org-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: settings.name,
        default_currency: settings.default_currency,
        timezone: settings.timezone,
        management_fee_percent: settings.management_fee_percent,
        invoice_lead_days: settings.invoice_lead_days,
        grace_period_days: settings.grace_period_days,
      }),
    });

    const data = await res.json();
    setSaving(false);

    if (res.ok) {
      setSettings(data);
      setSuccess("Settings saved.");
      setTimeout(() => setSuccess(""), 3000);
    } else {
      setError(data.error?.message || "Failed to save settings");
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;
  if (!settings) return <div className="p-6">Failed to load settings.</div>;

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h2 className="text-2xl font-bold uppercase tracking-wide mb-6">Organization Settings</h2>

      {success && (
        <div className="mb-4 bg-green-50 border border-green-200 p-3 text-sm text-green-800">
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6 border border-[#e2e8f0] bg-white p-6">
        <div>
          <label className="block text-sm font-medium text-[#475569] mb-1">
            Organization Name
          </label>
          <input
            type="text"
            value={settings.name}
            onChange={(e) => setSettings({ ...settings, name: e.target.value })}
            className="w-full border border-[#cbd5e1] px-3 py-2 text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#475569] mb-1">
              Default Currency
            </label>
            <select
              value={settings.default_currency}
              onChange={(e) =>
                setSettings({ ...settings, default_currency: e.target.value })
              }
              className="w-full border border-[#cbd5e1] px-3 py-2 text-sm"
            >
              {currencies.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.code} — {c.symbol} ({c.name})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-[#475569] mb-1">
              Timezone
            </label>
            <input
              type="text"
              value={settings.timezone}
              onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
              className="w-full border border-[#cbd5e1] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#475569] mb-1">
              Management Fee %
            </label>
            <input
              type="number"
              value={settings.management_fee_percent}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  management_fee_percent: parseInt(e.target.value) || 0,
                })
              }
              min={0}
              max={100}
              className="w-full border border-[#cbd5e1] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#475569] mb-1">
              Invoice Lead Days
            </label>
            <input
              type="number"
              value={settings.invoice_lead_days}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  invoice_lead_days: parseInt(e.target.value) || 0,
                })
              }
              min={0}
              max={90}
              className="w-full border border-[#cbd5e1] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[#475569] mb-1">
              Grace Period Days
            </label>
            <input
              type="number"
              value={settings.grace_period_days}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  grace_period_days: parseInt(e.target.value) || 0,
                })
              }
              min={0}
              max={90}
              className="w-full border border-[#cbd5e1] px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="text-xs text-[#64748b]">
          Slug: <span className="font-mono">{settings.slug}</span> &middot; Status:{" "}
          <span className="font-medium">{settings.status}</span>
        </div>

        <Button type="submit" variant="primary" size="lg" disabled={saving}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </form>
    </div>
  );
}
