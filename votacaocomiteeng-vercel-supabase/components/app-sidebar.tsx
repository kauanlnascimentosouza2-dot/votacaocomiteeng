"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Clapperboard, FolderKanban, LogOut, Menu, MessageCircle, PanelLeftClose, PanelLeftOpen, ShieldCheck, UsersRound, Vote, X } from "lucide-react";
import NotificationBell from "@/components/notification-bell";

type SidebarUser = { name: string; email: string; isAdmin: boolean; avatarUrl?: string | null; hasActiveGroup?: boolean };

const primaryItems = [
  { href: "/workspace", label: "Área do grupo", icon: FolderKanban },
  { href: "/lessons", label: "Aulas", icon: Clapperboard },
  { href: "/calendar", label: "Cronograma", icon: CalendarDays },
  { href: "/", label: "Votação", icon: Vote },
  { href: "/community", label: "Nós", icon: UsersRound },
  { href: "/chat", label: "Chat geral", icon: MessageCircle },
];

const adminItems = [
  { href: "/admin/semester", label: "Semestres e grupos" },
  { href: "/admin/demands", label: "Demandas e prazos" },
  { href: "/admin/review", label: "Revisão de projetos" },
  { href: "/?view=admin", label: "Votação e resultados" },
  { href: "/admin/community", label: "Publicações pendentes" },
  { href: "/admin/people", label: "Participantes e administradores" },
];

export default function AppSidebar({ user }: { user: SidebarUser }) {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(pathname.startsWith("/admin"));
  const active = (href: string) => { const base = href.split("?")[0]; return base === "/" ? pathname === "/" : pathname.startsWith(base); };
  const visiblePrimaryItems = user.isAdmin || user.hasActiveGroup ? primaryItems : primaryItems.filter((item) => item.href === "/community");

  return <>
    <button className="sidebar-mobile-trigger" onClick={() => setMobileOpen(true)} aria-label="Abrir menu"><Menu/></button>
    {mobileOpen && <button className="sidebar-mobile-shade" onClick={() => setMobileOpen(false)} aria-label="Fechar menu"/>}
    <aside className={`app-sidebar ${expanded ? "expanded" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="sidebar-brand"><img src="/logo-comite.png" alt="Engenharias Senac"/><span>Comitê de Engenharia</span><button className="sidebar-mobile-close" onClick={() => setMobileOpen(false)} aria-label="Fechar"><X/></button></div>
      <button className="sidebar-expand" onClick={() => setExpanded(!expanded)} aria-label={expanded ? "Recolher menu" : "Expandir menu"}>{expanded ? <PanelLeftClose/> : <PanelLeftOpen/>}<span>{expanded ? "Recolher" : "Expandir"}</span></button>
      <nav className="sidebar-nav" aria-label="Navegação principal">
        {visiblePrimaryItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={active(item.href) ? "active" : ""} data-tooltip={item.label}><item.icon/><span>{item.label}</span></Link>)}
        {user.isAdmin && <div className="sidebar-admin"><button className={pathname.startsWith("/admin") ? "active" : ""} onClick={() => { if (!expanded && !mobileOpen) { setExpanded(true); setAdminOpen(true); } else { setAdminOpen(!adminOpen); } }} data-tooltip="Painel administrativo"><ShieldCheck/><span>Painel administrativo</span>{adminOpen ? <ChevronLeft className="submenu-arrow"/> : <ChevronRight className="submenu-arrow"/>}</button>{adminOpen && <div className="sidebar-submenu">{adminItems.map((item) => <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={active(item.href) ? "active" : ""}><ClipboardList/><span>{item.label}</span></Link>)}</div>}</div>}
      </nav>
      {(user.isAdmin || user.hasActiveGroup) && <NotificationBell onNavigate={() => setMobileOpen(false)}/>}
      <div className="sidebar-account"><Link href="/profile" data-tooltip="Meu perfil">{user.avatarUrl ? <img src={user.avatarUrl} alt="Foto do perfil"/> : <span>{initials(user.name)}</span>}<div><strong>{user.name}</strong><small>{user.email}</small></div></Link><form action="/auth/signout" method="post"><button data-tooltip="Sair" aria-label="Sair"><LogOut/><span>Sair</span></button></form></div>
    </aside>
  </>;
}

function initials(name: string) { return name.split(/\s+/).filter(Boolean).slice(0,2).map((part) => part[0]).join("").toUpperCase() || "U"; }
