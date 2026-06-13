"use client";

import { useState } from "react";
import Link from "next/link";

interface SearchResult {
  entity_type: string;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
}

const ENTITY_ICONS: Record<string, string> = {
  contact: "👤",
  property: "🏢",
  unit: "🔑",
  lease: "📄",
  booking: "📅",
};

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [entityType, setEntityType] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (query.length < 2) return;
    setLoading(true);
    setSearched(true);

    const params = new URLSearchParams({ q: query, limit: "20" });
    if (entityType) params.set("type", entityType);

    const res = await fetch(`/api/v1/search?${params}`);
    const data = await res.json();
    setResults(data.results || []);
    setLoading(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Search</h1>
        <p className="text-sm text-gray-500 mt-1">
          Search across contacts, properties, units, leases, and bookings.
        </p>
      </div>

      <div className="mb-6 flex gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search for anything..."
          className="flex-1 rounded border border-gray-300 px-4 py-2.5 text-sm"
          autoFocus
        />
        <select
          value={entityType}
          onChange={(e) => setEntityType(e.target.value)}
          className="rounded border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="">All types</option>
          <option value="contacts">Contacts</option>
          <option value="properties">Properties</option>
          <option value="units">Units</option>
          <option value="leases">Leases</option>
          <option value="bookings">Bookings</option>
        </select>
        <button
          onClick={handleSearch}
          disabled={query.length < 2}
          className="rounded bg-indigo-600 px-6 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          Search
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400">Searching...</p>
      ) : searched && results.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center">
          <p className="text-gray-500">
            No results found for &ldquo;{query}&rdquo;
          </p>
        </div>
      ) : results.length > 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white divide-y">
          {results.map((result) => (
            <Link
              key={`${result.entity_type}-${result.id}`}
              href={result.url}
              className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl">
                {ENTITY_ICONS[result.entity_type] || "📋"}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-900 truncate">
                  {result.title}
                </div>
                {result.subtitle && (
                  <div className="text-xs text-gray-500 truncate">
                    {result.subtitle}
                  </div>
                )}
              </div>
              <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600 capitalize">
                {result.entity_type}
              </span>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
