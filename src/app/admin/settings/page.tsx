"use client";

import { useState, useEffect } from "react";


interface Setting {
  key: string;
  value: unknown;
  description: string | null;
  updated_at: string;
}

const DEFAULT_SETTINGS = [
  { key: "smtp_host", description: "SMTP server hostname", defaultValue: "" },
  { key: "smtp_port", description: "SMTP server port", defaultValue: 587 },
  { key: "smtp_user", description: "SMTP username", defaultValue: "" },
  { key: "smtp_from", description: "Default sender email", defaultValue: "" },
  { key: "backup_enabled", description: "Enable automated backups", defaultValue: false },
  { key: "backup_target", description: "Backup storage target (e.g. s3://bucket)", defaultValue: "" },
  { key: "app_name", description: "Application display name", defaultValue: "Rental Manager" },
  { key: "maintenance_mode", description: "Enable maintenance mode", defaultValue: false },
];

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [status, setStatus] = useState("");

  const [fetchKey, setFetchKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/admin/system-settings")
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setSettings(d.data || []); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchKey]);

  const fetchSettings = () => setFetchKey((k) => k + 1);

  const handleSave = async (key: string, description?: string) => {
    let parsedValue: unknown = editValue;
    try {
      parsedValue = JSON.parse(editValue);
    } catch {
      // keep as string
    }

    const res = await fetch("/api/v1/admin/system-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value: parsedValue, description }),
    });

    if (res.ok) {
      setEditKey(null);
      setEditValue("");
      setStatus(`Saved "${key}"`);
      fetchSettings();
      setTimeout(() => setStatus(""), 3000);
    } else {
      setStatus("Failed to save setting");
    }
  };

  const getSettingValue = (key: string): string => {
    const setting = settings.find((s) => s.key === key);
    if (!setting) return "";
    return typeof setting.value === "string"
      ? setting.value
      : JSON.stringify(setting.value);
  };

  return (
    <>
      <h2 className="mb-6 text-xl font-bold uppercase tracking-wide text-white">System Settings</h2>
        {status && (
          <div className="mb-4 bg-green-900/50 px-4 py-2 text-sm text-green-300">
            {status}
          </div>
        )}

        {loading ? (
          <p className="text-[#94a3b8]">Loading...</p>
        ) : (
          <div className="space-y-4">
            {DEFAULT_SETTINGS.map((def) => {
              const currentValue = getSettingValue(def.key);
              const isEditing = editKey === def.key;

              return (
                <div
                  key={def.key}
                  className="border border-[#234681] bg-[#1a365d] p-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-medium">{def.key}</h3>
                      <p className="text-xs text-[#94a3b8] mt-0.5">
                        {def.description}
                      </p>
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => {
                          setEditKey(def.key);
                          setEditValue(currentValue || String(def.defaultValue));
                        }}
                        className="border border-[#234681] px-3 py-1 text-xs hover:bg-[#234681]"
                      >
                        Edit
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div className="mt-3 flex gap-2">
                      <input
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="flex-1 border border-[#234681] bg-[#234681] px-3 py-1.5 text-sm"
                      />
                      <button
                        onClick={() =>
                          handleSave(def.key, def.description)
                        }
                        className="bg-[#d97706] px-3 py-1.5 text-xs hover:bg-[#b45309]"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditKey(null)}
                        className="border border-[#234681] px-3 py-1.5 text-xs hover:bg-[#234681]"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div className="mt-2 bg-[#234681]/50 px-3 py-1.5 text-sm text-slate-300">
                      {currentValue || (
                        <span className="text-[#64748b] italic">
                          Not set (default: {String(def.defaultValue)})
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </>
  );
}
