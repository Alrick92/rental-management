"use client";

import { useEffect, useState } from "react";

interface Announcement {
  id: string;
  title: string;
  body: string;
  scope: "org" | "property" | "contact";
  publishedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
  property: { id: string; name: string } | null;
}

const SCOPE_LABELS: Record<string, string> = {
  org: "Organization-wide",
  property: "Property-specific",
  contact: "Individual",
};

const SCOPE_COLORS: Record<string, string> = {
  org: "bg-blue-100 text-blue-800",
  property: "bg-green-100 text-green-800",
  contact: "bg-yellow-100 text-yellow-800",
};

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scope, setScope] = useState<"org" | "property">("org");
  const [propertyId, setPropertyId] = useState("");
  const [publishImmediately, setPublishImmediately] = useState(true);

  function loadAnnouncements() {
    fetch("/api/v1/announcements")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setAnnouncements(d.data); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAnnouncements(); }, []);

  async function handleCreate() {
    if (!title.trim() || !body.trim()) return;
    const res = await fetch("/api/v1/announcements", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        body,
        scope,
        property_id: scope === "property" ? propertyId : undefined,
        publish: publishImmediately,
      }),
    });
    if (res.ok) {
      setShowForm(false);
      setTitle("");
      setBody("");
      loadAnnouncements();
    } else {
      const err = await res.json();
      alert(err.error?.message || "Failed to create announcement");
    }
  }

  async function handlePublish(id: string) {
    const res = await fetch(`/api/v1/announcements/${id}/publish`, { method: "POST" });
    if (res.ok) {
      loadAnnouncements();
    }
  }

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide">Announcements</h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-[#d97706] text-white px-4 py-2 rounded-md text-sm hover:bg-[#b45309]"
        >
          {showForm ? "Cancel" : "New Announcement"}
        </button>
      </div>

      {showForm && (
        <div className="bg-white border rounded-lg p-4 mb-6 space-y-3">
          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <div className="flex gap-4 items-center">
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as "org" | "property")}
              className="border rounded px-3 py-2 text-sm"
            >
              <option value="org">Organization-wide</option>
              <option value="property">Property-specific</option>
            </select>
            {scope === "property" && (
              <input
                type="text"
                placeholder="Property ID"
                value={propertyId}
                onChange={(e) => setPropertyId(e.target.value)}
                className="border rounded px-3 py-2 text-sm flex-1"
              />
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={publishImmediately}
              onChange={(e) => setPublishImmediately(e.target.checked)}
              id="publish-check"
            />
            <label htmlFor="publish-check" className="text-sm text-[#64748b]">
              Publish immediately
            </label>
          </div>
          <button
            onClick={handleCreate}
            className="bg-[#d97706] text-white px-4 py-2 rounded text-sm hover:bg-[#b45309]"
          >
            Create Announcement
          </button>
        </div>
      )}

      <div className="space-y-4">
        {announcements.length === 0 ? (
          <div className="text-[#64748b] text-center py-12">No announcements yet</div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="bg-white border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{a.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SCOPE_COLORS[a.scope] || ""}`}>
                    {SCOPE_LABELS[a.scope]}
                  </span>
                  {a.publishedAt ? (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Published
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#f1f5f9] text-[#64748b]">
                      Draft
                    </span>
                  )}
                </div>
                {!a.publishedAt && (
                  <button
                    onClick={() => handlePublish(a.id)}
                    className="text-sm text-[#1a365d] hover:underline"
                  >
                    Publish
                  </button>
                )}
              </div>
              <p className="text-sm text-[#475569] whitespace-pre-wrap">{a.body}</p>
              <div className="flex gap-4 mt-3 text-xs text-[#94a3b8]">
                <span>By {a.createdBy.name}</span>
                {a.property && <span>Property: {a.property.name}</span>}
                <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                {a.publishedAt && (
                  <span>Published: {new Date(a.publishedAt).toLocaleDateString()}</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
