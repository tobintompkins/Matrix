"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  hasMatrixPermission,
  resolveMatrixRole,
} from "@/lib/auth/permissions";
import { ADVISORY_ASSISTANT } from "@/lib/ai/assistant/types";
import { MatrixButton, MatrixCard } from "../../components/ui";

type Conversation = {
  id: string;
  title: string;
  status: string;
  updatedAt: string;
  messageCount: number;
};

type Message = {
  id: string;
  role: string;
  content: string;
  confidence?: number | null;
  dataBasis?: string | null;
  limitations?: string | null;
  followUps?: string[];
  createdAt: string;
  sources?: Array<{
    id: string;
    displayLabel: string;
    href: string | null;
    fieldSummary: string | null;
    sourceType: string;
  }>;
};

const TABS = [
  { href: "/ai-operations", label: "Overview" },
  { href: "/ai-operations/assistant", label: "Assistant" },
  { href: "/ai-operations/automations", label: "Automations" },
  { href: "/ai-operations?tab=insights", label: "Insights" },
  { href: "/ai-operations?tab=trends", label: "Trends" },
  { href: "/ai-operations?tab=runs", label: "Analysis Runs" },
  { href: "/ai-operations?tab=health", label: "AI Health" },
];

export default function AiAssistantPage() {
  const { user } = useUser();
  const router = useRouter();
  const params = useParams<{ conversationId?: string }>();
  const { role } = resolveMatrixRole(
    user?.publicMetadata as Record<string, unknown> | undefined,
  );
  const canView = hasMatrixPermission(role, "VIEW_AI_ASSISTANT");
  const canUse = hasMatrixPermission(role, "USE_AI_ASSISTANT");

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(
    params.conversationId ?? null,
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/ai-operations/assistant/conversations", {
      cache: "no-store",
    });
    const json = await res.json();
    if (json.ok) setConversations(json.items ?? []);
  }, []);

  const loadMessages = useCallback(async (id: string) => {
    const res = await fetch(
      `/api/ai-operations/assistant/conversations/${id}/messages`,
      { cache: "no-store" },
    );
    const json = await res.json();
    if (json.ok) setMessages(json.items ?? []);
  }, []);

  useEffect(() => {
    if (!canView) return;
    void loadConversations();
    void fetch("/api/ai-operations/assistant/suggestions")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setSuggestions(j.suggestions ?? []);
      });
  }, [canView, loadConversations]);

  useEffect(() => {
    if (params.conversationId) {
      setActiveId(params.conversationId);
    }
  }, [params.conversationId]);

  useEffect(() => {
    if (activeId) void loadMessages(activeId);
  }, [activeId, loadMessages]);

  const startNew = async () => {
    setError("");
    const res = await fetch("/api/ai-operations/assistant/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const json = await res.json();
    if (!json.ok) {
      setError(json.error ?? "Could not create conversation.");
      return;
    }
    setActiveId(json.conversation.id);
    setMessages([]);
    router.push(`/ai-operations/assistant/${json.conversation.id}`);
    await loadConversations();
  };

  const ask = async (text?: string) => {
    const q = (text ?? question).trim();
    if (!q || !canUse) return;
    setLoading(true);
    setError("");
    setStatus("Searching Matrix…");
    try {
      let conversationId = activeId;
      if (!conversationId) {
        const created = await fetch("/api/ai-operations/assistant/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }).then((r) => r.json());
        if (!created.ok) throw new Error(created.error ?? "Create failed");
        conversationId = created.conversation.id as string;
        setActiveId(conversationId);
        router.push(`/ai-operations/assistant/${conversationId}`);
      }
      const res = await fetch(
        `/api/ai-operations/assistant/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Query failed");
      setQuestion("");
      await loadMessages(conversationId!);
      await loadConversations();
      setStatus("Answer ready.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setStatus("");
    } finally {
      setLoading(false);
    }
  };

  const feedback = async (messageId: string, rating: string) => {
    if (!activeId) return;
    await fetch("/api/ai-operations/assistant/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: activeId,
        messageId,
        rating,
      }),
    });
    setStatus("Feedback saved.");
  };

  const archive = async () => {
    if (!activeId) return;
    await fetch(`/api/ai-operations/assistant/conversations/${activeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ARCHIVED" }),
    });
    await loadConversations();
    setStatus("Conversation archived.");
  };

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-bold text-white">AI Assistant</h1>
        <p className="mt-3 text-sm text-rose-300" role="alert">
          You do not have permission to view the AI Assistant.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 lg:flex-row lg:gap-6">
      <button
        type="button"
        className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 lg:hidden"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-expanded={sidebarOpen}
      >
        {sidebarOpen ? "Hide conversations" : "Show conversations"}
      </button>

      <aside
        className={`${
          sidebarOpen ? "block" : "hidden"
        } w-full shrink-0 space-y-3 lg:block lg:w-72`}
        aria-label="Conversation history"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-300">Conversations</h2>
          {canUse ? (
            <MatrixButton onClick={() => void startNew()}>New</MatrixButton>
          ) : null}
        </div>
        {conversations.length === 0 ? (
          <p className="text-sm text-slate-500">No conversations yet.</p>
        ) : (
          <ul className="max-h-[60vh] space-y-1 overflow-y-auto">
            {conversations.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                    activeId === c.id
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
                      : "border-slate-800 text-slate-300 hover:border-slate-600"
                  }`}
                  onClick={() => {
                    setActiveId(c.id);
                    router.push(`/ai-operations/assistant/${c.id}`);
                    setSidebarOpen(false);
                  }}
                >
                  <span className="line-clamp-1 font-medium">{c.title}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {c.status} · {c.messageCount} msgs
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <div className="min-w-0 flex-1 space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-white">AI Assistant</h1>
          <p className="mt-1 text-sm text-slate-400">
            Natural-language search across Matrix records you are allowed to view.
          </p>
        </div>

        <nav aria-label="AI Operations tabs" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`rounded-lg border px-3 py-2 text-sm ${
                t.href.startsWith("/ai-operations/assistant")
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                  : "border-slate-800 text-slate-400 hover:text-slate-200"
              }`}
              aria-current={
                t.href.startsWith("/ai-operations/assistant") ? "page" : undefined
              }
            >
              {t.label}
            </Link>
          ))}
        </nav>

        <p
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-100"
          role="note"
        >
          {ADVISORY_ASSISTANT}
        </p>

        {error ? (
          <p className="text-sm text-rose-300" role="alert">
            {error}
          </p>
        ) : null}
        {status ? (
          <p className="text-sm text-slate-400" role="status" aria-live="polite">
            {status}
          </p>
        ) : null}

        {messages.length === 0 ? (
          <MatrixCard title="Suggested prompts">
            <div className="grid gap-2 sm:grid-cols-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={!canUse || loading}
                  className="rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2 text-left text-sm text-slate-300 hover:border-cyan-500/40 disabled:opacity-50"
                  onClick={() => void ask(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </MatrixCard>
        ) : null}

        <div
          className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/30 p-4"
          aria-label="Conversation messages"
        >
          {messages.map((m) => (
            <article
              key={m.id}
              className={`rounded-lg px-3 py-3 text-sm ${
                m.role === "USER"
                  ? "ml-6 border border-slate-700 bg-slate-900/80 text-slate-100"
                  : "mr-2 border border-slate-800 bg-slate-950/60 text-slate-200"
              }`}
            >
              <header className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold uppercase tracking-wide">
                  {m.role === "USER" ? "You" : "Assistant"}
                </span>
                {m.confidence != null ? (
                  <span>Evidence quality {Math.round(m.confidence)}%</span>
                ) : null}
                {m.dataBasis ? <span>· {m.dataBasis}</span> : null}
                <span>· {new Date(m.createdAt).toLocaleString()}</span>
              </header>
              <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                {m.content}
              </pre>
              {m.sources && m.sources.length > 0 ? (
                <ul className="mt-3 space-y-1 border-t border-slate-800 pt-2 text-xs">
                  <li className="font-medium text-slate-400">Sources</li>
                  {m.sources.map((s) => (
                    <li key={s.id}>
                      {s.href ? (
                        <Link
                          href={s.href}
                          className="text-cyan-300 hover:underline"
                        >
                          {s.displayLabel}
                        </Link>
                      ) : (
                        <span>{s.displayLabel}</span>
                      )}
                      {s.fieldSummary ? (
                        <span className="text-slate-500"> — {s.fieldSummary}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {m.limitations ? (
                <p className="mt-2 text-xs text-slate-500">{m.limitations}</p>
              ) : null}
              {m.role === "ASSISTANT" ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded border border-slate-700 px-2 py-1 text-xs text-slate-300"
                    onClick={() => {
                      void navigator.clipboard.writeText(m.content);
                      setStatus("Answer copied.");
                    }}
                  >
                    Copy answer
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-700 px-2 py-1 text-xs text-emerald-300"
                    onClick={() => void feedback(m.id, "HELPFUL")}
                  >
                    Helpful
                  </button>
                  <button
                    type="button"
                    className="rounded border border-slate-700 px-2 py-1 text-xs text-rose-300"
                    onClick={() => void feedback(m.id, "NOT_HELPFUL")}
                  >
                    Not helpful
                  </button>
                  {(m.followUps ?? []).slice(0, 3).map((f) => (
                    <button
                      key={f}
                      type="button"
                      className="rounded border border-cyan-900/50 px-2 py-1 text-xs text-cyan-300"
                      disabled={loading}
                      onClick={() => void ask(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          {loading ? (
            <p className="text-sm text-slate-400" role="status">
              Generating grounded answer…
            </p>
          ) : null}
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            void ask();
          }}
        >
          <label className="sr-only" htmlFor="ai-assistant-question">
            Ask Matrix AI
          </label>
          <input
            id="ai-assistant-question"
            className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 text-sm text-white"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask about service calls, machines, PM, inventory…"
            disabled={!canUse || loading}
            maxLength={2000}
          />
          <MatrixButton type="submit" disabled={!canUse || loading || !question.trim()}>
            Ask
          </MatrixButton>
        </form>

        {activeId ? (
          <div className="flex flex-wrap gap-2">
            <MatrixButton onClick={() => void archive()}>Archive</MatrixButton>
            <Link
              href="/ai-operations"
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300"
            >
              Back to Overview
            </Link>
          </div>
        ) : null}
      </div>
    </div>
  );
}
