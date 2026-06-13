"use client";

import { useEffect, useState, useCallback } from "react";

interface Participant {
  userId: string;
  name: string;
  role: string;
}

interface Thread {
  id: string;
  subject: string;
  property: { id: string; name: string } | null;
  participants: Participant[];
  lastMessage: { body: string; sender: { id: string; name: string }; createdAt: string } | null;
  messageCount: number;
  unread: boolean;
  updatedAt: string;
}

interface Message {
  id: string;
  body: string;
  createdAt: string;
  sender: { id: string; name: string; role: string };
}

interface OrgUser {
  id: string;
  name: string;
  role: string;
}

export default function MessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newParticipants, setNewParticipants] = useState<string[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
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
    fetch("/api/v1/contacts?limit=200")
      .then((r) => (r.ok ? r.json() : null))
      .then(() => {
        // Load org users for participant selection — use a lightweight approach
        // since we don't have a dedicated /users endpoint for non-admins
      });
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

  async function handleCreateThread() {
    if (!newSubject.trim() || !newBody.trim() || newParticipants.length === 0) return;
    const res = await fetch("/api/v1/messages/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: newSubject,
        participant_ids: newParticipants,
        body: newBody,
      }),
    });
    if (res.ok) {
      setShowNew(false);
      setNewSubject("");
      setNewBody("");
      setNewParticipants([]);
      loadThreads();
    } else {
      const err = await res.json();
      alert(err.error?.message || "Failed to create thread");
    }
  }

  // Load users when opening new thread form
  useEffect(() => {
    if (showNew && orgUsers.length === 0) {
      fetch("/api/v1/contacts?limit=200")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d) {
            setOrgUsers(
              d.data.map((c: { id: string; name: string }) => ({
                id: c.id,
                name: c.name,
                role: "contact",
              }))
            );
          }
        });
    }
  }, [showNew, orgUsers.length]);

  if (loading) return <div className="p-6">Loading messages...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold uppercase tracking-wide">Messages</h2>
        <button
          onClick={() => setShowNew(!showNew)}
          className="bg-[#d97706] text-white px-4 py-2 rounded-md text-sm hover:bg-[#b45309]"
        >
          {showNew ? "Cancel" : "New Conversation"}
        </button>
      </div>

      {showNew && (
        <div className="bg-white border rounded-lg p-4 mb-6 space-y-3">
          <h3 className="font-semibold">New Conversation</h3>
          <input
            type="text"
            placeholder="Subject"
            value={newSubject}
            onChange={(e) => setNewSubject(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <div>
            <label className="text-sm text-[#64748b]">Participant User IDs (comma-separated)</label>
            <input
              type="text"
              placeholder="user-id-1, user-id-2"
              value={newParticipants.join(", ")}
              onChange={(e) =>
                setNewParticipants(e.target.value.split(",").map((s) => s.trim()).filter(Boolean))
              }
              className="w-full border rounded px-3 py-2 text-sm mt-1"
            />
          </div>
          <textarea
            placeholder="Message..."
            value={newBody}
            onChange={(e) => setNewBody(e.target.value)}
            rows={3}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={handleCreateThread}
            className="bg-[#d97706] text-white px-4 py-2 rounded text-sm hover:bg-[#b45309]"
          >
            Start Conversation
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4" style={{ minHeight: 400 }}>
        {/* Thread list */}
        <div className="col-span-1 bg-white border rounded-lg overflow-y-auto" style={{ maxHeight: 600 }}>
          {threads.length === 0 ? (
            <div className="p-4 text-[#64748b] text-sm text-center">No conversations yet</div>
          ) : (
            threads.map((t) => (
              <button
                key={t.id}
                onClick={() => openThread(t.id)}
                className={`w-full text-left p-3 border-b hover:bg-[#f8fafc] ${
                  selectedThread === t.id ? "bg-[#1a365d]/10" : ""
                } ${t.unread ? "font-semibold" : ""}`}
              >
                <div className="text-sm truncate">{t.subject}</div>
                <div className="text-xs text-[#64748b] mt-1 truncate">
                  {t.lastMessage
                    ? `${t.lastMessage.sender.name}: ${t.lastMessage.body}`
                    : "No messages"}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[#94a3b8]">
                    {new Date(t.updatedAt).toLocaleDateString()}
                  </span>
                  {t.unread && (
                    <span className="w-2 h-2 bg-[#234681] rounded-full" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>

        {/* Message view */}
        <div className="col-span-2 bg-white border rounded-lg flex flex-col" style={{ maxHeight: 600 }}>
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-[#94a3b8] text-sm">
              Select a conversation
            </div>
          ) : msgLoading ? (
            <div className="flex-1 flex items-center justify-center text-[#94a3b8] text-sm">
              Loading...
            </div>
          ) : (
            <>
              <div className="p-3 border-b bg-[#f8fafc]">
                <div className="font-medium text-sm">
                  {threads.find((t) => t.id === selectedThread)?.subject}
                </div>
                <div className="text-xs text-[#64748b]">
                  {threads
                    .find((t) => t.id === selectedThread)
                    ?.participants.map((p) => p.name)
                    .join(", ")}
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender.id === currentUserId ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[70%] rounded-lg px-3 py-2 text-sm ${
                        m.sender.id === currentUserId
                          ? "bg-[#1a365d] text-white"
                          : "bg-[#f1f5f9] text-[#1e293b]"
                      }`}
                    >
                      <div className="text-xs opacity-75 mb-1">{m.sender.name}</div>
                      <div className="whitespace-pre-wrap">{m.body}</div>
                      <div className="text-xs opacity-50 mt-1">
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </div>
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
                <button
                  onClick={handleSendReply}
                  className="bg-[#d97706] text-white px-4 py-2 rounded text-sm hover:bg-[#b45309]"
                >
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
