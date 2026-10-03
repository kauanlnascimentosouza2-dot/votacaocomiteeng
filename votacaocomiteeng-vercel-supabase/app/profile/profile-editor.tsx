"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BriefcaseBusiness, Camera, GraduationCap, Linkedin, Mail, Save, UsersRound } from "lucide-react";

type Profile = {
  id: string; name: string; email: string; notification_email: string | null;
  avatarUrl: string | null; team_name: string; course: string | null;
  academic_period: string | null; phone: string | null; specialty: string | null;
  skills: string[]; bio: string | null; linkedin_url: string | null; portfolio_url: string | null;
};
type GroupPerson = { id: string; name: string; email: string; specialty?: string | null; avatarUrl?: string | null; role?: string };

export default function ProfileEditor({ profile, group, semester, groupPeople }: {
  profile: Profile;
  group: { name: string; status: string; role: string } | null;
  semester: { name: string } | null;
  groupPeople: Array<Record<string, unknown>>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const people = groupPeople as unknown as GroupPerson[];

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch(`/api/profiles/${profile.id}`, { method: "PATCH", body: new FormData(event.currentTarget) });
      const data = await response.json().catch(() => ({}));
      setNotice(response.ok ? "Perfil atualizado." : data.error || "Não foi possível salvar.");
      if (response.ok) router.refresh();
    } catch {
      setNotice("Falha de conexão. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="feature-page">
    <section className="feature-heading">
      <div><span className="eyebrow">Minha conta</span><h1>Meu perfil</h1><p>Suas informações profissionais e acadêmicas dentro da equipe Manufatura.</p></div>
      <div className="profile-context"><UsersRound/><div><small>Equipe</small><strong>{profile.team_name || "Manufatura"}</strong><span>{group ? `Grupo ${group.name} · ${group.role === "leader" ? "Líder" : "Integrante"}` : "Aguardando alocação"}</span></div></div>
    </section>
    {notice && <div className="notice" role="status">{notice}</div>}
    <div className="profile-layout">
      <form className="panel profile-form" onSubmit={save}>
        <div className="profile-photo-editor">{profile.avatarUrl ? <img src={profile.avatarUrl} alt="Sua foto"/> : <span>{initials(profile.name)}</span>}<label><Camera/>Trocar foto<input name="avatar" type="file" accept="image/jpeg,image/png,image/webp"/></label></div>
        <div className="profile-fields">
          <label>Nome<input name="name" defaultValue={profile.name} required/></label>
          <label>E-mail de login<input value={profile.email} disabled/></label>
          <label className="full-field notification-email-field"><span><Mail size={17}/> E-mail para avisos (opcional)</span><input name="notificationEmail" type="email" maxLength={254} defaultValue={profile.notification_email ?? ""} placeholder={profile.email}/><small>Preencha para receber por e-mail novas demandas, aulas e eventos. Se deixar vazio, os avisos aparecem somente no site.</small></label>
          <label>Curso<input name="course" defaultValue={profile.course ?? ""} placeholder="Ex.: Engenharia de Produção"/></label>
          <label>Semestre/período<input name="academicPeriod" defaultValue={profile.academic_period ?? ""} placeholder="Ex.: 6º semestre"/></label>
          <label>Telefone<input name="phone" defaultValue={profile.phone ?? ""} placeholder="(11) 99999-9999"/></label>
          <label>Função ou especialidade<input name="specialty" defaultValue={profile.specialty ?? ""} placeholder="Ex.: Projetos e prototipagem"/></label>
          <label className="full-field">Competências <small>Separe por vírgulas</small><input name="skills" defaultValue={(profile.skills ?? []).join(", ")} placeholder="CAD, Lean, automação"/></label>
          <label className="full-field">Mini apresentação<textarea name="bio" defaultValue={profile.bio ?? ""} placeholder="Conte um pouco sobre sua experiência e interesses"/></label>
          <label><Linkedin/>LinkedIn<input name="linkedinUrl" type="url" defaultValue={profile.linkedin_url ?? ""} placeholder="https://linkedin.com/in/..."/></label>
          <label><BriefcaseBusiness/>Portfólio<input name="portfolioUrl" type="url" defaultValue={profile.portfolio_url ?? ""} placeholder="https://..."/></label>
        </div>
        <button className="primary-button" disabled={busy}><Save/>{busy ? "Salvando…" : "Salvar perfil"}</button>
      </form>
      <aside className="profile-side">
        <section className="panel"><div className="panel-title"><GraduationCap/><div><h2>Vínculo atual</h2><p>{semester?.name ?? "Nenhum semestre ativo"}</p></div></div><dl className="profile-details"><div><dt>Equipe</dt><dd>Manufatura</dd></div><div><dt>Grupo</dt><dd>{group?.name ?? "Aguardando alocação"}</dd></div><div><dt>Papel</dt><dd>{group?.role === "leader" ? "Líder" : group ? "Integrante" : "—"}</dd></div></dl></section>
        {group && <section className="panel"><div className="panel-title"><UsersRound/><div><h2>Integrantes do grupo</h2><p>Perfis visíveis apenas para o próprio grupo.</p></div></div><div className="profile-team-list">{people.map(person => <div key={person.id}>{person.avatarUrl ? <img src={person.avatarUrl} alt=""/> : <span>{initials(person.name)}</span>}<div><strong>{person.name}</strong><small>{person.role === "leader" ? "Líder" : person.specialty || person.email}</small></div></div>)}</div></section>}
      </aside>
    </div>
  </div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "U";
}
