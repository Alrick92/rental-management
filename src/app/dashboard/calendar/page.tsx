"use client";

import { useEffect, useState, useCallback } from "react";

interface CalendarEvent {
  id: string;
  type: "booking" | "lease";
  unitId: string;
  unitName: string;
  propertyId: string;
  start: string;
  end: string;
  status: string;
  guest?: string;
  tenant?: string;
}

const EVENT_COLORS: Record<string, string> = {
  tentative: "bg-gray-200 text-gray-800",
  confirmed: "bg-blue-200 text-blue-800",
  checked_in: "bg-green-200 text-green-800",
  checked_out: "bg-yellow-200 text-yellow-800",
  active: "bg-purple-200 text-purple-800",
  signed: "bg-indigo-200 text-indigo-800",
};

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const fetchCalendar = useCallback((y: number, m: number, dim: number) => {
    const start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
    const end = `${y}-${String(m + 1).padStart(2, "0")}-${String(dim).padStart(2, "0")}`;
    fetch(`/api/v1/calendar?start=${start}&end=${end}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setEvents(d.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchCalendar(year, month, daysInMonth);
  }, [year, month, daysInMonth, fetchCalendar]);

  function getEventsByDay() {
    const map: Record<number, CalendarEvent[]> = {};
    for (const ev of events) {
      const evStart = new Date(ev.start);
      const evEnd = new Date(ev.end);
      for (let d = 1; d <= daysInMonth; d++) {
        const day = new Date(year, month, d);
        if (day >= evStart && day <= evEnd) {
          if (!map[d]) map[d] = [];
          map[d].push(ev);
        }
      }
    }
    return map;
  }
  const eventsByDay = getEventsByDay();

  function prevMonth() {
    setCurrentDate(new Date(year, month - 1, 1));
  }
  function nextMonth() {
    setCurrentDate(new Date(year, month + 1, 1));
  }

  const monthName = currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const today = new Date();
  const isToday = (d: number) =>
    d === today.getDate() && month === today.getMonth() && year === today.getFullYear();

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold">Reservation Calendar</h2>
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="px-3 py-1 border rounded text-sm hover:bg-gray-100">
            &larr; Prev
          </button>
          <span className="text-lg font-medium">{monthName}</span>
          <button onClick={nextMonth} className="px-3 py-1 border rounded text-sm hover:bg-gray-100">
            Next &rarr;
          </button>
        </div>
      </div>

      <div className="flex gap-3 mb-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200" /> Confirmed</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200" /> Checked In</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-gray-200" /> Tentative</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-purple-200" /> Active Lease</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-indigo-200" /> Signed Lease</span>
      </div>

      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading calendar...</div>
      ) : (
        <div className="bg-white border rounded-lg">
          <div className="grid grid-cols-7 border-b">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="p-2 text-center text-xs font-medium text-gray-500 bg-gray-50">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {blanks.map((i) => (
              <div key={`blank-${i}`} className="border-b border-r p-2 min-h-[100px] bg-gray-50" />
            ))}
            {days.map((d) => {
              const dayEvents = eventsByDay[d] || [];
              return (
                <div
                  key={d}
                  className={`border-b border-r p-1.5 min-h-[100px] ${isToday(d) ? "bg-indigo-50" : ""}`}
                >
                  <div className={`text-xs font-medium mb-1 ${isToday(d) ? "text-indigo-600" : "text-gray-600"}`}>
                    {d}
                  </div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <div
                        key={ev.id}
                        className={`text-[10px] px-1 py-0.5 rounded truncate ${EVENT_COLORS[ev.status] || "bg-gray-100"}`}
                        title={`${ev.type === "booking" ? "Booking" : "Lease"}: ${ev.unitName} — ${ev.guest || ev.tenant || ""}`}
                      >
                        {ev.unitName}: {ev.guest || ev.tenant}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className="text-[10px] text-gray-400">+{dayEvents.length - 3} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
