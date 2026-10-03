"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

type Notice = { id: string; title: string; message: string; href: string; read_at: string | null; created_at: string };

export default function NotificationBell({ onNavigate }: { onNavigate?: () => void }) {
  const [open, setOpen] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json();
      setNotices(data.notifications ?? []);
      setUnread(data.unread ?? 0);
      setError("");
    } catch { setError("Não foi possível carregar os avisos."); }
  }, []);
  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 20000);
    return () => window.clearInterval(interval);
  }, [refresh]);
  async function markRead(id?: string) {
    const response = await fetch("/api/notifications", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
    if (response.ok) void refresh();
  }
  return <div className="notification-shell">
    <button type="button" className="notification-trigger" onClick={() => { setOpen(!open); if (!open) void refresh(); }} aria-label={`Avisos: ${unread} não lidos`} aria-expanded={open} data-tooltip="Avisos"><Bell/><span>Avisos</span>{unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}</button>
    {open && <div className="notification-popover"><header><strong>Avisos</strong><div>{unread > 0 && <button onClick={() => markRead()} title="Marcar todos como lidos"><CheckCheck size={17}/></button>}<button onClick={() => setOpen(false)} aria-label="Fechar avisos">×</button></div></header>
      {error && <p className="notification-empty">{error}</p>}
      {!error && !notices.length && <p className="notification-empty">Nenhum aviso por enquanto.</p>}
      <div className="notification-list">{notices.map(item => <Link key={item.id} href={item.href} className={item.read_at ? "" : "unread"} onClick={() => { if (!item.read_at) void markRead(item.id); setOpen(false); onNavigate?.(); }}><strong>{item.title}</strong><span>{item.message}</span><small>{new Date(item.created_at).toLocaleString("pt-BR")}</small></Link>)}</div>
    </div>}
  </div>;
}
