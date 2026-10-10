"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CirclePlus, Clock3, FolderKanban, Layers3 } from "lucide-react";

type Demand = {
  id: string;
  title: string;
  description: string;
  status: string;
  submission_due_at: string | null;
};

type Project = {
  id: string;
  demand_id: string;
  title: string;
  description: string;
  status: string;
  updated_at: string | null;
};

export default function ProjectBoard({ demands, projects }: { demands: Demand[]; projects: Project[] }) {
  const router = useRouter();
  const [busyDemand, setBusyDemand] = useState("");
  const [notice, setNotice] = useState("");

  async function addProject(demandId: string) {
    setBusyDemand(demandId);
    setNotice("");
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ demandId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.id) throw new Error(data.error || "Não foi possível adicionar o projeto.");
      router.push(`/workspace/projects/${data.id}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível adicionar o projeto.");
      setBusyDemand("");
    }
  }

  return <section className="project-section">
    <div className="board-toolbar"><div><h2>Demandas do grupo</h2><p>{demands.length} trabalho(s) em andamento · todos os integrantes podem adicionar projetos</p></div></div>
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="workspace-demand-list">
      {demands.map((demand) => {
        const demandProjects = projects.filter((project) => project.demand_id === demand.id);
        const late = Boolean(demand.submission_due_at && new Date() > new Date(demand.submission_due_at));
        return <article className="workspace-demand" key={demand.id}>
          <header>
            <div className="workspace-demand-icon"><FolderKanban/></div>
            <div><span className={`demand-status ${late ? "late" : demand.status}`}>{late ? "Prazo vencido" : demandLabel(demand.status)}</span><h2>{demand.title}</h2><p>{demand.description}</p></div>
            <div className="workspace-demand-actions"><span><Layers3/>{demandProjects.length} projeto{demandProjects.length === 1 ? "" : "s"}</span><button type="button" className="primary-button" onClick={() => addProject(demand.id)} disabled={busyDemand === demand.id}><CirclePlus/>{busyDemand === demand.id ? "Criando…" : "Adicionar projeto"}</button></div>
          </header>
          <div className="workspace-demand-deadline"><Clock3/><span><small>Entrega final</small><strong>{demand.submission_due_at ? new Date(demand.submission_due_at).toLocaleString("pt-BR") : "Sem prazo"}</strong></span></div>
          <div className="workspace-demand-projects">
            {demandProjects.map((project, index) => <Link href={`/workspace/projects/${project.id}`} className="workspace-project-row" key={project.id}>
              <span className="workspace-project-number">{index + 1}</span>
              <div><span className={`project-state ${project.status}`}>{projectLabel(project.status)}</span><strong>{project.title || `Projeto ${index + 1} · sem título`}</strong><small>{project.description || "Abra para adicionar título, descrição e arquivos."}</small></div>
              <span className="workspace-project-open">Abrir <ArrowRight/></span>
            </Link>)}
            {!demandProjects.length && <div className="workspace-no-project"><FolderKanban/><div><strong>Nenhum projeto nesta demanda</strong><p>Qualquer integrante pode criar o primeiro projeto.</p></div></div>}
          </div>
        </article>;
      })}
      {!demands.length && <div className="panel empty-demand"><FolderKanban/><p>O administrador ainda não atribuiu nenhuma demanda ao grupo.</p></div>}
    </div>
  </section>;
}

function demandLabel(status: string) {
  const map: Record<string, string> = { scheduled: "Agendada", open: "Aberta", development: "Em desenvolvimento", review: "Em revisão", published: "Publicada", voting: "Em votação", awaiting_results: "Resultado pendente" };
  return map[status] ?? status;
}

function projectLabel(status: string) {
  const map: Record<string, string> = { draft: "Em edição", submitted: "Entregue", late: "Entregue com atraso", review: "Em análise", changes_requested: "Ajustes solicitados", approved: "Aprovado", published: "Publicado" };
  return map[status] ?? status;
}
