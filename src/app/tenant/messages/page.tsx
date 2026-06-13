"use client";

import { useEffect, useState, useCallback } from "react";

interface Thread {
  id: string;
  subject: string;
  participants: { userId: string; name: string; role: string }[];
  lastMessage: { body: string; sender: { id: string; name: string }; createdAt: string } | null;
  unread: boolean;
  updatedAt: string;
}

interface Message {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string; role: string };
}

export default function TenantMessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");

  const loadThreads = useCallback(() => {
    fetch("/api/v1/messages/threads")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setThreads(d.data); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadThreads();
    fetch("/api/v1/auth/me")
      .then((r) => r.json())
      .then((d) => setCurrentUserId(d.user_id));
  }, [loadThreads]);

  function openThread(threadId: string) {
    setSelectedThread(threadId);
    setMsgLoading(true);
    fetch(`/api/v1/messages/threads/${threadId}/messages`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setMessages(d.data); })
      .finally(() => setMsgLoading(false));
    fetch(`/api/v1/messages/threads/${threadId}/read`, { method: "POST" });
  }

  async function handleSendReply() {
    if (!replyBody.trim() || !selectedThread) return;
    const res = await fetch(`/api/v1/messages/threads/${selectedThread}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: replyBody }),
    });
    if (res.ok) {
      const msg = await res.json();
      setMessages((prev) => [...prev, msg]);
      setReplyBody("");
      loadThreads();
    }
  }

  if (loading) return <div className="p-6">Loading messages...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Messages</h2>

      <div className="grid grid-cols-3 gap-4" style={{ minHeight: 400 }}>
        <div className="col-span-1 bg-white border rounded-lg overflow-y-auto" style={{ maxHeight: 500 }}>
          {threads.length === 0 ? (
            <div className="p-4 text-gray-500 text-sm text-center">No messages yet</div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={`w-full text-left p-3 border-b hover:bg-gray-50 ${
                  selectedThread === t.id ? "bg-indigo-50" : ""
                } ${t.unread ? "font-semibold" : ""}`}
              >
                <div className="text-sm truncate">{t.subject}</div>
                <div className="text-xs text-gray-500 mt-1 truncate">
                  {t.lastMessage ? `${t.lastMessage.sender.name}: ${t.lastMessage.body}` : "No messages"}
                </div>
                {t.unread && <span className="inline-block w-2 h-2 bg-indigo-500 rounded-full mt-1" />}
              </button>
            ))
          )}
        </div>

        <div className="col-span-2 bg-white border rounded-lg flex flex-col" style={{ maxHeight: 500 }}>
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
              Select a conversation
            </div>
          ) : msgLoading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Loading...</div>
          ) : (
            <>
              <div className="p-3 border-b bg-gray-50 text-sm font-medium">
                {threads.find((t) => t.id === selectedThread)?.subject}
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender.id === currentUserId ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                      m.sender.id === currentUserId ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-900"
                    }`}>
                      <div className="text-xs opacity-75 mb-1">{m.sender.name}</div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div className="text-xs opacity-50 mt-1">{new Date(m.createdAt).toLocaleTimeString()}</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-3 border-t flex gap-2">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSendReply(); }}
                  className="flex-1 border rounded px-3 py-2 text-sm"
                />
                <button onClick={handleSendReply} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm hover:bg-indigo-700">
                  Send
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
