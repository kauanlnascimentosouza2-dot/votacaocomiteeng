"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, Download, Edit3,
  ExternalLink, FileArchive, FileCheck2, FileText, Image as ImageIcon,
  Images, Link2, Maximize2, RotateCcw, Search, X,
} from "lucide-react";

type ProjectFile = {
  id: string; fileName: string; sizeBytes: number; downloadUrl: string | null;
  deliverableTitle: string; submittedAt: string; isLate: boolean; notes: string;
};

type Project = {
  id: string; title: string; description: string; status: string;
  submitted_at: string | null; updated_at: string | null;
  external_links: string[] | null; mainImageUrl: string | null; pdfUrl: string | null;
  images: Array<{ id: string; signedUrl: string | null }>; files: ProjectFile[];
  demands: { title: string; description: string; submission_due_at: string | null; publication_at: string | null };
  groups: { name: string };
};

type ReviewDecision = "approved" | "changes_requested";
type ViewerTab = "overview" | "gallery" | "pdf" | "files";

const statusLabels: Record<string, string> = {
  approved: "Aprovado", changes_requested: "Ajustes solicitados",
  late: "Entregue atrasado", published: "Publicado", review: "Em análise",
  submitted: "Aguardando revisão",
};

export default function ReviewClient({ projects }: { projects: Project[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("pending");
  const [demand, setDemand] = useState("all");
  const [selectedId, setSelectedId] = useState(projects[0]?.id ?? "");
  const [viewerTab, setViewerTab] = useState<ViewerTab>("overview");
  const [activeImage, setActiveImage] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<ReviewDecision | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const demands = useMemo(
    () => [...new Set(projects.map((project) => project.demands.title))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [projects],
  );
  const filteredProjects = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("pt-BR");
    return projects.filter((project) => {
      const matchesSearch = !normalizedQuery || [project.title, project.groups.name, project.demands.title, project.description]
        .some((value) => value?.toLocaleLowerCase("pt-BR").includes(normalizedQuery));
      const matchesDemand = demand === "all" || project.demands.title === demand;
      const matchesStatus = status === "all"
        || (status === "pending" && !["approved", "published"].includes(project.status))
        || project.status === status;
      return matchesSearch && matchesDemand && matchesStatus;
    });
  }, [demand, projects, query, status]);

  const selected = filteredProjects.find((project) => project.id === selectedId) ?? filteredProjects[0];
  const selectedIndex = filteredProjects.findIndex((project) => project.id === selected?.id);
  const gallery = selected ? [
    ...(selected.mainImageUrl ? [{ id: "main", signedUrl: selected.mainImageUrl }] : []),
    ...selected.images.filter((image) => image.signedUrl),
  ] : [];
  const shownImage = gallery[Math.min(activeImage, Math.max(gallery.length - 1, 0))];

  function selectProject(id: string) {
    setSelectedId(id); setViewerTab("overview"); setActiveImage(0);
    setLightbox(false); setReviewDialog(null); setNotice("");
  }

  function moveSelection(direction: -1 | 1) {
    if (!filteredProjects.length) return;
    const nextIndex = selectedIndex < 0 ? 0 : (selectedIndex + direction + filteredProjects.length) % filteredProjects.length;
    selectProject(filteredProjects[nextIndex].id);
  }

  async function review(decision: ReviewDecision) {
    if (!selected) return;
    setBusy(true); setNotice("");
    try {
      const response = await fetch(`/api/admin/projects/${selected.id}/review`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note: reviewNote.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Não foi possível concluir a revisão.");
      setNotice(decision === "approved" ? "Projeto aprovado com sucesso." : "Ajustes enviados ao grupo.");
      setReviewDialog(null); setReviewNote(""); router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Não foi possível concluir a revisão.");
    } finally { setBusy(false); }
  }

  const pendingCount = projects.filter((project) => !["approved", "published"].includes(project.status)).length;
  const approvedCount = projects.filter((project) => ["approved", "published"].includes(project.status)).length;

  return (
    <div className="feature-page review-page">
      <section className="feature-heading review-heading">
        <div><span className="eyebrow">Painel administrativo</span><h1>Análise de projetos</h1><p>Compare materiais, confira arquivos e registre a decisão sem sair desta tela.</p></div>
        <div className="review-summary" aria-label="Resumo das análises">
          <span><Clock3/><strong>{pendingCount}</strong><small>pendentes</small></span>
          <span><CheckCircle2/><strong>{approvedCount}</strong><small>aprovados</small></span>
        </div>
      </section>

      {notice && <div className="notice" role="status">{notice}</div>}

      <section className="review-toolbar" aria-label="Filtros de projetos">
        <label className="review-search">
          <span className="sr-only">Buscar projeto</span><Search/>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar projeto, grupo ou demanda"/>
          {query && <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca"><X/></button>}
        </label>
        <div className="review-status-filters" role="group" aria-label="Filtrar por situação">
          {[["pending", "Pendentes"], ["approved", "Aprovados"], ["changes_requested", "Com ajustes"], ["all", "Todos"]].map(([value, label]) => (
            <button key={value} type="button" className={status === value ? "active" : ""} onClick={() => setStatus(value)}>{label}</button>
          ))}
        </div>
        <label className="review-demand-filter"><span>Demanda</span><select value={demand} onChange={(event) => setDemand(event.target.value)}><option value="all">Todas as demandas</option>{demands.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </section>

      <div className="review-workbench">
        <aside className="review-project-list" aria-label="Projetos encontrados">
          <header>
            <div><strong>{filteredProjects.length} projeto{filteredProjects.length === 1 ? "" : "s"}</strong><span>Selecione para analisar</span></div>
            <div className="review-list-navigation"><button type="button" onClick={() => moveSelection(-1)} disabled={!filteredProjects.length} aria-label="Projeto anterior"><ArrowLeft/></button><button type="button" onClick={() => moveSelection(1)} disabled={!filteredProjects.length} aria-label="Próximo projeto"><ArrowRight/></button></div>
          </header>
          <div>
            {filteredProjects.map((project) => (
              <button type="button" key={project.id} className={`review-project-item ${selected?.id === project.id ? "active" : ""}`} onClick={() => selectProject(project.id)}>
                <span className="review-project-thumb">{project.mainImageUrl ? <img src={project.mainImageUrl} alt=""/> : <ImageIcon/>}</span>
                <span className="review-project-copy"><span className={`project-state ${project.status}`}>{statusLabels[project.status] ?? project.status}</span><strong>{project.title || project.demands.title}</strong><small>{project.groups.name}</small><span>{project.demands.title}</span></span>
                <ArrowRight className="review-project-arrow"/>
              </button>
            ))}
            {!filteredProjects.length && <div className="review-empty"><Search/><strong>Nenhum projeto encontrado</strong><p>Ajuste a busca ou os filtros.</p></div>}
          </div>
        </aside>

        {selected ? (
          <article className="review-viewer">
            <header className="review-viewer-header"><div><span className={`project-state ${selected.status}`}>{statusLabels[selected.status] ?? selected.status}</span><h2>{selected.title || selected.demands.title}</h2><p>{selected.groups.name} <span>•</span> {selected.demands.title}</p></div><div className="review-viewer-position"><strong>{selectedIndex >= 0 ? selectedIndex + 1 : "—"}</strong><span>de {filteredProjects.length}</span></div></header>

            <nav className="review-viewer-tabs" aria-label="Conteúdo do projeto">
              <button type="button" className={viewerTab === "overview" ? "active" : ""} onClick={() => setViewerTab("overview")}><FileCheck2/>Visão geral</button>
              <button type="button" className={viewerTab === "gallery" ? "active" : ""} onClick={() => setViewerTab("gallery")}><Images/>Imagens <span>{gallery.length}</span></button>
              <button type="button" className={viewerTab === "pdf" ? "active" : ""} onClick={() => setViewerTab("pdf")} disabled={!selected.pdfUrl}><FileText/>PDF</button>
              <button type="button" className={viewerTab === "files" ? "active" : ""} onClick={() => setViewerTab("files")}><FileArchive/>Entregas <span>{selected.files.length}</span></button>
            </nav>

            <div className="review-viewer-body">
              {viewerTab === "overview" && <Overview project={selected} galleryCount={gallery.length} openGallery={() => { setViewerTab("gallery"); setLightbox(true); }}/>}
              {viewerTab === "gallery" && (
                <div className="review-gallery">
                  {shownImage?.signedUrl ? <><button type="button" className="review-gallery-stage" onClick={() => setLightbox(true)}><img src={shownImage.signedUrl} alt={`${selected.title}, imagem ${activeImage + 1}`}/><span><Maximize2/>Ver em tela cheia</span></button><div className="review-gallery-strip">{gallery.map((image, index) => <button type="button" key={image.id} className={index === activeImage ? "active" : ""} onClick={() => setActiveImage(index)}><img src={image.signedUrl!} alt={`Miniatura ${index + 1}`}/><span>{index + 1}</span></button>)}</div></> : <div className="review-empty"><Images/><strong>Nenhuma imagem enviada</strong><p>Confira o PDF ou as entregas do projeto.</p></div>}
                </div>
              )}
              {viewerTab === "pdf" && selected.pdfUrl && <div className="review-pdf"><div className="review-pdf-toolbar"><span><FileText/>Documento do projeto</span><a href={selected.pdfUrl} target="_blank" rel="noreferrer"><ExternalLink/>Abrir em nova aba</a></div><iframe src={`${selected.pdfUrl}#view=FitH&toolbar=1`} title={`PDF de ${selected.title}`}/></div>}
              {viewerTab === "files" && <ProjectFiles files={selected.files}/>}
            </div>

            <footer className="review-decision-bar">
              <Link className="secondary-button" href={`/workspace/projects/${selected.id}`}><Edit3/>Editar projeto</Link>
              <div>{selected.status !== "approved" && <button className="danger-button" type="button" onClick={() => { setReviewNote(""); setReviewDialog("changes_requested"); }}><RotateCcw/>Solicitar ajustes</button>}<button className="primary-button" type="button" onClick={() => { setReviewNote(""); setReviewDialog("approved"); }} disabled={selected.status === "approved"}><Check/>{selected.status === "approved" ? "Projeto aprovado" : "Aprovar projeto"}</button></div>
            </footer>
          </article>
        ) : <div className="panel review-empty"><FileCheck2/><strong>Nenhum projeto disponível</strong><p>Os projetos enviados aparecerão aqui.</p></div>}
      </div>

      {lightbox && shownImage?.signedUrl && <div className="review-lightbox" role="dialog" aria-modal="true" aria-label="Visualizador de imagem"><button type="button" className="review-lightbox-close" onClick={() => setLightbox(false)} aria-label="Fechar visualizador"><X/></button>{gallery.length > 1 && <button type="button" className="review-lightbox-prev" onClick={() => setActiveImage((activeImage - 1 + gallery.length) % gallery.length)} aria-label="Imagem anterior"><ArrowLeft/></button>}<img src={shownImage.signedUrl} alt={`${selected.title}, imagem ${activeImage + 1}`}/>{gallery.length > 1 && <button type="button" className="review-lightbox-next" onClick={() => setActiveImage((activeImage + 1) % gallery.length)} aria-label="Próxima imagem"><ArrowRight/></button>}<span>{activeImage + 1} / {gallery.length}</span></div>}

      {reviewDialog && selected && <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title"><div className="modal review-dialog"><span className={`review-dialog-icon ${reviewDialog}`}>{reviewDialog === "approved" ? <Check/> : <RotateCcw/>}</span><h2 id="review-dialog-title">{reviewDialog === "approved" ? "Aprovar este projeto?" : "Solicitar ajustes"}</h2><p>{reviewDialog === "approved" ? `“${selected.title || selected.demands.title}” ficará disponível para as próximas etapas.` : `Explique ao grupo ${selected.groups.name} o que precisa ser corrigido.`}</p>{reviewDialog === "changes_requested" && <label>Orientações para o grupo<textarea autoFocus value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Descreva os ajustes necessários…"/></label>}<div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setReviewDialog(null)} disabled={busy}>Cancelar</button><button type="button" className={reviewDialog === "approved" ? "primary-button" : "danger-button"} onClick={() => review(reviewDialog)} disabled={busy || (reviewDialog === "changes_requested" && !reviewNote.trim())}>{reviewDialog === "approved" ? <Check/> : <RotateCcw/>}{busy ? "Salvando…" : reviewDialog === "approved" ? "Confirmar aprovação" : "Enviar solicitação"}</button></div></div></div>}
    </div>
  );
}

function Overview({ project, galleryCount, openGallery }: { project: Project; galleryCount: number; openGallery: () => void }) {
  return <div className="review-overview">
    <button type="button" className="review-cover" onClick={openGallery} disabled={!galleryCount}>{project.mainImageUrl ? <img src={project.mainImageUrl} alt={`Imagem principal de ${project.title}`}/> : <span><ImageIcon/><strong>Projeto sem imagem principal</strong></span>}{galleryCount > 0 && <em><Maximize2/>Ampliar imagem</em>}</button>
    <section className="review-description"><span className="review-section-label">Descrição do projeto</span><p>{project.description || "O grupo ainda não adicionou uma descrição."}</p></section>
    <dl className="review-metadata"><div><dt>Grupo</dt><dd>{project.groups.name}</dd></div><div><dt>Demanda</dt><dd>{project.demands.title}</dd></div><div><dt>Entrega registrada</dt><dd>{formatDate(project.submitted_at)}</dd></div><div><dt>Prazo da demanda</dt><dd>{formatDate(project.demands.submission_due_at)}</dd></div><div><dt>Publicação prevista</dt><dd>{formatDate(project.demands.publication_at)}</dd></div><div><dt>Última atualização</dt><dd>{formatDate(project.updated_at)}</dd></div></dl>
    {(project.external_links ?? []).length > 0 && <section className="review-links"><span className="review-section-label">Links externos</span><div>{project.external_links!.map((link) => <a key={link} href={link} target="_blank" rel="noreferrer"><Link2/>{displayUrl(link)}<ExternalLink/></a>)}</div></section>}
  </div>;
}

function ProjectFiles({ files }: { files: ProjectFile[] }) {
  return <div className="review-files">{files.map((file) => <article key={file.id}><span><FileArchive/></span><div><strong>{file.fileName}</strong><p>{file.deliverableTitle}{file.isLate ? " · entregue com atraso" : ""}</p><small>{formatDate(file.submittedAt)} · {formatSize(file.sizeBytes)}</small>{file.notes && <blockquote>{file.notes}</blockquote>}</div>{file.downloadUrl && <a href={file.downloadUrl} target="_blank" rel="noreferrer" download={file.fileName}><Download/>Baixar</a>}</article>)}{!files.length && <div className="review-empty"><FileArchive/><strong>Nenhum arquivo de etapa</strong><p>O projeto não possui anexos de entrega.</p></div>}</div>;
}

function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Não informado"; }
function formatSize(bytes: number) { return bytes < 1024 * 1024 ? `${Math.max(1, Math.ceil(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1).replace(".0", "")} MB`; }
function displayUrl(value: string) { try { const url = new URL(value); return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`; } catch { return value; } }
