"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft, ArrowRight, BarChart3, Bell, CalendarDays, Check,
  CheckCircle2, Clapperboard, ClipboardList, ExternalLink, FileCheck2,
  FolderKanban, HelpCircle, Lightbulb, MessageCircle, MessageSquareWarning,
  ShieldCheck, Sparkles, UserCog, UserRound, Users, UsersRound, Vote, X,
} from "lucide-react";

type User = { id?: string; isAdmin: boolean; hasActiveGroup?: boolean; onboardingCompleted?: boolean };
type GuideCategory = "Comece aqui" | "Menu principal" | "Administração" | "Sua conta";
type GuideStep = {
  key: string;
  navLabel: string;
  category: GuideCategory;
  title: string;
  description: string;
  bullets: string[];
  tip: string;
  icon: LucideIcon;
  accent: "navy" | "orange" | "green" | "purple" | "blue" | "rose";
  href?: string;
};

const guideVersion = "guide-v13";

export default function FirstAccessGuide({ user }: { user: User }) {
  const pathname = usePathname();
  const steps = useMemo(() => guideSteps(user), [user]);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const current = steps[Math.min(step, steps.length - 1)];
  const resumeKey = `${guideVersion}:resume:${user.id ?? "guest"}`;
  const doneKey = `${guideVersion}:done:${user.id ?? "guest"}`;

  useEffect(() => {
    if (!user.id) return;
    try {
      if (localStorage.getItem(doneKey)) return;
      const savedStep = Number(sessionStorage.getItem(resumeKey));
      if (Number.isInteger(savedStep) && savedStep >= 0 && savedStep < steps.length) setStep(savedStep);
      setOpen(true);
    } catch {
      if (!user.onboardingCompleted) setOpen(true);
    }
  }, [doneKey, resumeKey, steps.length, user.id, user.onboardingCompleted]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setOpen(false); return; }
      if (event.key !== "Tab") return;
      const nodes = panel.current?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href]");
      if (!nodes?.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener("keydown", keydown);
      previous?.focus();
    };
  }, [open]);

  function changeStep(next: number) {
    const safe = Math.max(0, Math.min(next, steps.length - 1));
    setStep(safe);
    setError("");
    try { sessionStorage.setItem(resumeKey, String(safe)); } catch {}
    panel.current?.focus();
  }

  function openPage() {
    try { sessionStorage.setItem(resumeKey, String(step)); } catch {}
    setOpen(false);
  }

  async function complete() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/onboarding", { method: "POST" });
      if (!response.ok) { setError("Não foi possível salvar sua preferência. Tente novamente."); return; }
      try { localStorage.setItem(doneKey, "done"); sessionStorage.removeItem(resumeKey); } catch {}
      setOpen(false);
      opener.current?.focus();
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally { setBusy(false); }
  }

  return <>
    <button ref={opener} className="sidebar-guide" data-tooltip="Guia do sistema" aria-label="Abrir guia do sistema" onClick={() => { try { sessionStorage.removeItem(resumeKey); } catch {} setStep(0); setError(""); setOpen(true); }}><HelpCircle/><span>Guia do sistema</span></button>
    {open && current && createPortal(
      <div className="guide-shade">
        <div ref={panel} className="guide-shell" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="guide-title" aria-describedby="guide-copy">
          <aside className="guide-index">
            <div className="guide-index-brand"><span><Sparkles/></span><div><strong>Guia do sistema</strong><small>{user.isAdmin ? "Visão de administrador" : user.hasActiveGroup ? "Visão de integrante" : "Primeiros passos"}</small></div></div>
            <div className="guide-index-scroll">
              {categories(steps).map((category) => <section key={category}>
                <h3>{category}</h3>
                {steps.map((item, index) => {
                  if (item.category !== category) return null;
                  const Icon = item.icon;
                  return <button type="button" key={item.key} className={index === step ? "active" : ""} onClick={() => changeStep(index)}><span><Icon/></span><strong>{item.navLabel}</strong>{index < step ? <Check className="guide-index-check"/> : <small>{index + 1}</small>}</button>;
                })}
              </section>)}
            </div>
            <button type="button" className="guide-skip" onClick={() => void complete()} disabled={busy}>Pular e ver depois pelo menu</button>
          </aside>

          <main className="guide-content">
            <button type="button" className="guide-close" onClick={() => setOpen(false)} aria-label="Fechar por agora"><X/></button>
            <div className="guide-mobile-position"><span>{step + 1} de {steps.length}</span><strong>{current.category}</strong></div>
            <div className={`guide-visual ${current.accent}`}>
              <span className="guide-visual-icon"><current.icon/></span>
              <div><small>{current.category}</small><strong>{current.navLabel}</strong></div>
              <span className="guide-visual-number">{String(step + 1).padStart(2, "0")}</span>
            </div>

            <div className="guide-copy">
              <span className="eyebrow">{current.category}</span>
              <h2 id="guide-title">{current.title}</h2>
              <p id="guide-copy">{current.description}</p>
              <section className="guide-capabilities">
                <h3>Nesta área você pode</h3>
                <ul>{current.bullets.map((bullet) => <li key={bullet}><CheckCircle2/><span>{bullet}</span></li>)}</ul>
              </section>
              <div className="guide-tip"><Lightbulb/><div><strong>Dica rápida</strong><p>{current.tip}</p></div></div>
              {current.href && <Link className="guide-open-page" href={current.href} onClick={openPage}><span>{isCurrentPage(current.href, pathname) ? "Você está nesta aba" : `Abrir ${current.navLabel}`}</span><ExternalLink/></Link>}
              {error && <p className="form-message" role="alert">{error}</p>}
            </div>

            <footer className="guide-footer">
              <div className="guide-progress-copy"><span>Progresso do guia</span><strong>{Math.round(((step + 1) / steps.length) * 100)}%</strong><div><span style={{ width: `${((step + 1) / steps.length) * 100}%` }}/></div></div>
              <div className="guide-actions">
                <button type="button" className="secondary-button" onClick={() => changeStep(step - 1)} disabled={busy || step === 0}><ArrowLeft/>Anterior</button>
                <button type="button" className="primary-button" onClick={() => step === steps.length - 1 ? void complete() : changeStep(step + 1)} disabled={busy}>{busy ? "Salvando…" : step === steps.length - 1 ? "Concluir guia" : "Próxima aba"}{step === steps.length - 1 ? <Check/> : <ArrowRight/>}</button>
              </div>
            </footer>
          </main>
        </div>
      </div>,
      document.body,
    )}
  </>;
}

function guideSteps(user: User): GuideStep[] {
  const start: GuideStep = {
    key: "welcome", navLabel: "Visão geral", category: "Comece aqui", title: user.isAdmin ? "Conheça o painel de administração" : user.hasActiveGroup ? "Conheça seu ambiente de projetos" : "Seu cadastro está quase pronto",
    description: user.isAdmin ? "Este guia apresenta cada aba disponível, a ordem recomendada do trabalho e os atalhos que ajudam a acompanhar grupos, projetos e votações." : user.hasActiveGroup ? "Veja onde criar projetos, acompanhar prazos, votar e conversar com os outros participantes. Você pode abrir qualquer aba diretamente pelo guia." : "Enquanto o administrador prepara seu grupo, você já pode conhecer a comunidade e completar seu perfil.",
    bullets: user.isAdmin ? ["Navegar por todas as áreas administrativas", "Entender a sequência entre demanda, projeto e votação", "Voltar a este guia pelo ícone de ajuda"] : user.hasActiveGroup ? ["Encontrar rapidamente cada atividade", "Entender o propósito de todas as abas", "Voltar a este guia pelo ícone de ajuda"] : ["Acompanhar a comunidade", "Completar seus dados pessoais", "Aguardar a ativação do grupo"],
    tip: "Use a lista ao lado para pular diretamente para qualquer explicação. O guia não obriga uma ordem.", icon: Sparkles, accent: "orange",
  };

  const community: GuideStep = { key: "community", navLabel: "Nós", category: "Menu principal", title: "Compartilhe a trajetória da equipe", description: "A aba Nós funciona como o mural da comunidade: um espaço para registrar atividades, conquistas, fotos e atualizações dos projetos.", bullets: ["Criar publicações com texto e imagens", "Comentar nas publicações da comunidade", "Acompanhar registros aprovados pelo administrador"], tip: "As novas publicações passam por moderação antes de aparecer para toda a comunidade.", icon: UsersRound, accent: "green", href: "/community" };
  const profile: GuideStep = { key: "profile", navLabel: "Meu perfil", category: "Sua conta", title: "Mantenha suas informações atualizadas", description: "Seu perfil reúne identidade, contato e informações acadêmicas usadas para reconhecer você no grupo e enviar avisos importantes.", bullets: ["Adicionar foto, curso e competências", "Definir o e-mail que receberá os avisos", "Consultar seu grupo e papel atual"], tip: "Clique na sua foto ou nas iniciais, no rodapé do menu, para abrir esta área rapidamente.", icon: UserRound, accent: "purple", href: "/profile" };

  if (!user.hasActiveGroup && !user.isAdmin) return [start, community, profile, {
    key: "waiting", navLabel: "Próximo passo", category: "Sua conta", title: "Aguarde a alocação em um grupo", description: "Quando o administrador colocar você em um grupo ativo, as abas de projetos, aulas, cronograma, votação e chat serão liberadas automaticamente.", bullets: ["Complete o perfil enquanto aguarda", "Confira se o e-mail de avisos está correto", "Entre novamente após receber a confirmação"], tip: "O administrador organiza os participantes por semestre. Você não precisa criar outro cadastro.", icon: Users, accent: "blue",
  }];

  const primary: GuideStep[] = [
    { key: "workspace", navLabel: "Área do grupo", category: "Menu principal", title: "Crie e entregue os projetos do grupo", description: "Esta é a principal área de trabalho. As demandas recebidas aparecem organizadas com seus prazos e com todos os projetos cadastrados pelo grupo.", bullets: ["Adicionar vários projetos em uma mesma demanda", "Editar título, descrição, imagens, PDF e links", "Enviar etapas e confirmar a entrega final"], tip: "Todos os integrantes podem criar, editar e enviar projetos. Cada projeto é analisado separadamente.", icon: FolderKanban, accent: "navy", href: "/workspace" },
    { key: "lessons", navLabel: "Aulas", category: "Menu principal", title: "Consulte os materiais de aprendizagem", description: "A biblioteca de aulas concentra vídeos e conteúdos organizados em pastas pelo administrador.", bullets: ["Navegar pelas pastas de conteúdo", "Assistir aos vídeos dentro do sistema", "Revisar materiais durante o desenvolvimento"], tip: "Use as pastas para encontrar rapidamente conteúdos relacionados à etapa atual do projeto.", icon: Clapperboard, accent: "rose", href: "/lessons" },
    { key: "calendar", navLabel: "Cronograma", category: "Menu principal", title: "Visualize todos os prazos importantes", description: "O cronograma reúne aberturas de demandas, entregas, publicações, votações e eventos em uma única visão.", bullets: ["Filtrar eventos por categoria", "Ver os próximos compromissos em ordem", "Identificar prazos concluídos ou atrasados"], tip: "Confira esta aba no início da semana para planejar as entregas do grupo.", icon: CalendarDays, accent: "blue", href: "/calendar" },
    { key: "voting", navLabel: "Votação", category: "Menu principal", title: "Participe das decisões do Comitê", description: "As votações abertas exibem os projetos aprovados, seus materiais e o período disponível para registrar a escolha.", bullets: ["Comparar projetos de outros grupos", "Registrar um voto com confirmação", "Consultar histórico e resultados liberados"], tip: "Você não pode votar em projetos do próprio grupo e pode alterar cada voto somente uma vez.", icon: Vote, accent: "orange", href: "/" },
    community,
    { key: "chat", navLabel: "Chat geral", category: "Menu principal", title: "Converse com os participantes", description: "O chat geral permite trocar mensagens rápidas com integrantes e administradores dentro do ambiente do Comitê.", bullets: ["Enviar mensagens para a comunidade", "Acompanhar conversas recentes", "Excluir suas próprias mensagens quando necessário"], tip: "Use o mural Nós para registros permanentes e o Chat geral para conversas rápidas.", icon: MessageCircle, accent: "green", href: "/chat" },
  ];

  const account: GuideStep[] = [
    { key: "notifications", navLabel: "Notificações", category: "Sua conta", title: "Não perca novas atividades", description: "O sino do menu reúne avisos sobre demandas, aulas e eventos atribuídos ao seu semestre ou grupo.", bullets: ["Identificar avisos ainda não lidos", "Abrir diretamente a atividade relacionada", "Marcar notificações como lidas"], tip: "Cadastre também um e-mail de avisos no perfil para receber lembretes fora do sistema.", icon: Bell, accent: "orange" },
    profile,
  ];

  const admin: GuideStep[] = user.isAdmin ? [
    { key: "semesters", navLabel: "Semestres e grupos", category: "Administração", title: "Organize a estrutura de cada semestre", description: "Aqui começa o fluxo administrativo: cadastre o semestre, forme grupos, escolha líderes e ative as equipes.", bullets: ["Alocar participantes por arrastar e soltar", "Definir o líder de cada grupo", "Ativar ou arquivar grupos e semestres"], tip: "Ative o grupo somente depois de conferir seus integrantes; isso libera a Área do grupo.", icon: ShieldCheck, accent: "navy", href: "/admin/semester" },
    { key: "demands", navLabel: "Demandas e prazos", category: "Administração", title: "Distribua trabalhos e defina datas", description: "Cadastre o desafio que será desenvolvido, escolha os grupos participantes e configure as etapas do processo.", bullets: ["Definir descrição e grupos participantes", "Criar etapas intermediárias e entrega final", "Programar publicação e período de votação"], tip: "Os grupos recebem um projeto inicial e podem adicionar outros projetos à mesma demanda.", icon: ClipboardList, accent: "blue", href: "/admin/demands" },
    { key: "review", navLabel: "Análise de projetos", category: "Administração", title: "Revise cada projeto antes da votação", description: "A central de análise reúne imagens, PDF, links e arquivos das entregas para uma decisão individual por projeto.", bullets: ["Buscar e filtrar projetos", "Visualizar imagens, PDF e arquivos técnicos", "Aprovar ou solicitar ajustes ao grupo"], tip: "Aprovar um projeto não aprova automaticamente os outros projetos do mesmo grupo.", icon: FileCheck2, accent: "green", href: "/admin/review" },
    { key: "results", navLabel: "Votação e resultados", category: "Administração", title: "Gerencie rodadas e resultados", description: "Selecione projetos aprovados, abra rodadas de votação e acompanhe a participação durante todo o processo.", bullets: ["Criar votações por demanda", "Encerrar rodadas e liberar resultados", "Criar desempate quando necessário"], tip: "A rodada exige pelo menos dois projetos aprovados da mesma demanda.", icon: BarChart3, accent: "orange", href: "/?view=admin" },
    { key: "moderation", navLabel: "Publicações pendentes", category: "Administração", title: "Modere o mural da comunidade", description: "Revise as publicações enviadas para a aba Nós antes que elas sejam exibidas para todos.", bullets: ["Conferir texto e imagens", "Aprovar publicações adequadas", "Rejeitar com uma orientação clara"], tip: "A moderação ajuda o mural a permanecer útil, respeitoso e relacionado às atividades.", icon: MessageSquareWarning, accent: "rose", href: "/admin/community" },
    { key: "people", navLabel: "Participantes e admins", category: "Administração", title: "Gerencie pessoas e permissões", description: "Consulte os participantes cadastrados e controle quem possui acesso às funções administrativas.", bullets: ["Buscar participantes por nome ou e-mail", "Consultar vínculo e informações do perfil", "Adicionar ou remover administradores"], tip: "Conceda acesso administrativo somente a pessoas responsáveis pela operação do sistema.", icon: UserCog, accent: "purple", href: "/admin/people" },
  ] : [];

  const finish: GuideStep = { key: "finish", navLabel: "Tudo pronto", category: "Sua conta", title: "Agora você conhece todo o sistema", description: "Você pode concluir o guia e começar a usar o Comitê. Sempre que precisar, abra novamente o Guia do sistema na parte inferior do menu lateral.", bullets: ["Use o menu para alternar entre as áreas", "Consulte as dicas rápidas de cada aba", "Reabra este guia a qualquer momento"], tip: "No celular, toque no botão de menu no canto superior esquerdo para acessar as abas.", icon: CheckCircle2, accent: "green" };
  return [start, ...primary, ...admin, ...account, finish];
}

function categories(steps: GuideStep[]) {
  return (["Comece aqui", "Menu principal", "Administração", "Sua conta"] as GuideCategory[]).filter((category) => steps.some((step) => step.category === category));
}

function isCurrentPage(href: string, pathname: string) {
  const base = href.split("?")[0];
  return base === "/" ? pathname === "/" : pathname.startsWith(base);
}
