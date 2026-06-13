"use client";

import { useEffect, useState } from "react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  scope: string;
  publishedAt: string;
  property: { id: string; name: string } | null;
}

export default function TenantAnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/announcements")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAnnouncements(d.data); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h2 className="text-2xl font-bold uppercase tracking-wide mb-6">Announcements</h2>
      {announcements.length === 0 ? (
        <div className="text-[#64748b] text-center py-12">No announcements</div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div key={a.id} className="bg-white border p-4">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-semibold">{a.title}</h3>
                {a.property && (
                  <span className="text-xs text-[#94a3b8]">{a.property.name}</span>
                )}
              </div>
              <p className="text-sm text-[#475569] whitespace-pre-wrap">{a.body}</p>
              <div className="text-xs text-[#94a3b8] mt-2">
                {new Date(a.publishedAt).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
