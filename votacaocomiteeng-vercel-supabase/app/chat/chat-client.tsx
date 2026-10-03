"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle, Send, Trash2, UsersRound } from "lucide-react";

type Semester = { id: string; name: string; status: string };
type Message = { id: string; author_id: string | null; author_name: string; body: string; created_at: string };

export default function ChatClient({ semesters, initialSemesterId, userId, displayName, isAdmin }: {
  semesters: Semester[];
  initialSemesterId: string;
  userId: string;
  displayName: string;
  isAdmin: boolean;
}) {
  const [semesterId, setSemesterId] = useState(initialSemesterId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const firstLoad = useRef(true);

  const refresh = useCallback(async () => {
    if (!semesterId) return;
    try {
      const response = await fetch(`/api/chat?semesterId=${encodeURIComponent(semesterId)}`, { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) { setNotice(data.error || "Não foi possível carregar o chat."); return; }
      setCanWrite(Boolean(data.canWrite));
      setMessages(previous => {
        const next = data.messages as Message[];
        if (previous.length === next.length && previous.every((message, index) => message.id === next[index]?.id)) return previous;
        return next;
      });
    } catch { setNotice("Falha de conexão com o chat."); }
  }, [semesterId]);

  useEffect(() => {
    firstLoad.current = true;
    setMessages([]);
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 7000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    if (firstLoad.current || list.scrollHeight - list.scrollTop - list.clientHeight < 160) list.scrollTop = list.scrollHeight;
    firstLoad.current = false;
  }, [messages]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || !canWrite) return;
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ semesterId, message: draft }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) setNotice(data.error || "Não foi possível enviar.");
      else { setDraft(""); await refresh(); }
    } catch { setNotice("Falha de conexão. Tente novamente."); }
    finally { setBusy(false); }
  }

  async function remove(message: Message) {
    if (!window.confirm("Apagar esta mensagem do chat?")) return;
    setBusy(true);
    try {
      const response = await fetch("/api/chat", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: message.id }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) setNotice(data.error || "Não foi possível apagar a mensagem.");
      else await refresh();
    } catch { setNotice("Falha de conexão. Tente novamente."); }
    finally { setBusy(false); }
  }

  const semester = semesters.find(item => item.id === semesterId);
  return <div className="feature-page">
    <section className="feature-heading"><div><span className="eyebrow">CONVERSAS</span><h1>Chat geral</h1><p>Espaço de conversa dos grupos da Semana das Engenharias.</p></div><label className="chat-edition-picker">Edição<select value={semesterId} onChange={event => setSemesterId(event.target.value)}>{semesters.map(item => <option key={item.id} value={item.id}>{item.name}{item.status === "closed" ? " · encerrada" : ""}</option>)}</select></label></section>
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="panel chat-panel">
      <header className="chat-heading"><div><MessageCircle/><div><strong>{semester?.name ?? "Chat geral"}</strong><span>{canWrite ? "Conversa aberta para os participantes" : "Histórico desta edição"}</span></div></div><UsersRound/></header>
      <div className="chat-messages" ref={listRef} aria-live="polite">
        {messages.map(message => <article key={message.id} className={`chat-message ${message.author_id === userId ? "own" : ""}`}><div className="chat-avatar">{initials(message.author_name)}</div><div className="chat-bubble"><div className="chat-meta"><strong>{message.author_id === userId ? `${displayName} (você)` : message.author_name}</strong><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</time>{(message.author_id === userId || isAdmin) && <button type="button" title="Apagar mensagem" aria-label="Apagar mensagem" disabled={busy} onClick={() => remove(message)}><Trash2/></button>}</div><p>{message.body}</p></div></article>)}
        {!messages.length && <div className="chat-empty"><MessageCircle/><p>Comece a conversa desta edição.</p></div>}
      </div>
      {canWrite ? <form className="chat-compose" onSubmit={send}><label htmlFor="chat-draft" className="sr-only">Sua mensagem</label><textarea id="chat-draft" value={draft} onChange={event => setDraft(event.target.value)} maxLength={1000} rows={2} placeholder="Escreva uma mensagem para todos os grupos"/><button className="primary-button" disabled={busy || !draft.trim()}><Send/>Enviar</button></form> : <div className="chat-readonly">Esta edição está encerrada ou seu grupo ainda não foi ativado.</div>}
    </section>
  </div>;
}

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "U"; }
