import { after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type Activity = {
  semesterId: string;
  recipientIds: string[];
  eventKey: string;
  kind: "demand" | "lesson" | "calendar";
  title: string;
  message: string;
  href: string;
  origin: string;
};

export async function createActivityNotifications(activity: Activity) {
  const recipientIds = [...new Set(activity.recipientIds)].filter(Boolean);
  if (!recipientIds.length) return { created: 0, error: null };
  const admin = createAdminClient();
  const rows = recipientIds.map(userId => ({
    semester_id: activity.semesterId,
    user_id: userId,
    event_key: activity.eventKey,
    kind: activity.kind,
    title: activity.title,
    message: activity.message,
    href: activity.href,
  }));
  const { data, error } = await admin.from("activity_notifications").upsert(rows, { onConflict: "user_id,event_key", ignoreDuplicates: true }).select("id");
  if (error) return { created: 0, error: error.message };
  const ids = (data ?? []).map(item => item.id);
  if (ids.length) after(() => sendPendingActivityEmails(activity.origin, ids));
  return { created: ids.length, error: null };
}

export async function sendPendingActivityEmails(origin: string, ids?: string[]) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  if (!apiKey || !senderEmail) return { sent: 0, failed: 0 };
  const admin = createAdminClient();
  let query = admin.from("activity_notifications").select("id,user_id,title,message,href,email_status,email_attempts").in("email_status", ["pending", "failed"]).lt("email_attempts", 3).order("created_at").limit(100);
  if (ids?.length) query = query.in("id", ids);
  const { data: notifications } = await query;
  if (!notifications?.length) return { sent: 0, failed: 0 };
  const userIds = [...new Set(notifications.map(row => row.user_id))];
  const { data: profiles } = await admin.from("profiles").select("id,name,notification_email").in("id", userIds);
  const profileMap = new Map((profiles ?? []).map(profile => [profile.id, profile]));
  let sent = 0;
  let failed = 0;
  for (let start = 0; start < notifications.length; start += 5) {
    await Promise.all(notifications.slice(start, start + 5).map(async row => {
      const profile = profileMap.get(row.user_id);
      const address = profile?.notification_email?.trim();
      if (!address) {
        await admin.from("activity_notifications").update({ email_status: "skipped" }).eq("id", row.id).in("email_status", ["pending", "failed"]);
        return;
      }
      const { data: claimed } = await admin.from("activity_notifications").update({ email_status: "sending", email_attempts: row.email_attempts + 1, email_to: address }).eq("id", row.id).eq("email_status", row.email_status).eq("email_attempts", row.email_attempts).select("id").maybeSingle();
      if (!claimed) return;
      try {
        const link = new URL(row.href, process.env.NEXT_PUBLIC_SITE_URL || origin).toString();
        const response = await fetch("https://api.brevo.com/v3/smtp/email", {
          method: "POST",
          headers: { "Content-Type": "application/json", "api-key": apiKey },
          body: JSON.stringify({
            sender: { name: process.env.BREVO_SENDER_NAME || "Comitê de Engenharia", email: senderEmail },
            to: [{ email: address, name: profile?.name || undefined }],
            subject: row.title,
            htmlContent: `<h2>${escapeHtml(row.title)}</h2><p>Olá, ${escapeHtml(profile?.name || "participante")}.</p><p>${escapeHtml(row.message)}</p><p><a href="${escapeHtml(link)}">Abrir no sistema</a></p>`,
          }),
        });
        const payload = await response.json().catch(() => ({}));
        await admin.from("activity_notifications").update({ email_status: response.ok ? "sent" : "failed", email_error: response.ok ? null : JSON.stringify(payload).slice(0,500), emailed_at: response.ok ? new Date().toISOString() : null }).eq("id", row.id);
        if (response.ok) sent++; else failed++;
      } catch (error) {
        await admin.from("activity_notifications").update({ email_status: "failed", email_error: String(error).slice(0,500) }).eq("id", row.id);
        failed++;
      }
    }));
  }
  return { sent, failed };
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]!));
}
