// Idea Garden reminders (Supabase Edge Function, Deno). Deployed as "garden-remind" with JWT verification OFF
// (pg_cron calls it without a user token; supabase/push.sql). Two ways in:
//   x-cron-secret header (hourly cron): for each subscribed user where it's 9:00 local and nothing was sent
//     in the last 3 days, pick at most one gentle reminder from their garden and push it to their devices
//   {test: true} + the user's own Authorization token: push a test notification to that user's devices now
// Secrets: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (pair; public half is in src/config.js), CRON_SECRET,
//          VAPID_SUBJECT (optional). SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
import webpush from "npm:web-push@3";
import { createClient } from "npm:@supabase/supabase-js@2";

const DAY = 864e5;
const SEND_HOUR = 9;
const QUIET_DAYS = 3;
const APP = "./";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
webpush.setVapidDetails(
  Deno.env.get("VAPID_SUBJECT") || "https://valesxecute.github.io/idgarden/",
  Deno.env.get("VAPID_PUBLIC_KEY") ?? "",
  Deno.env.get("VAPID_PRIVATE_KEY") ?? "",
);

type Note = { title: string; body: string; url: string };
const days = (iso?: string) => (iso ? (Date.now() - Date.parse(iso)) / DAY : 0);
const short = (s: string, n = 48) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s);
const ideaTitle = (i: any) => i.title || short(String(i.content || "").split("\n")[0]);

// at most one, most useful first. Mirrors the in-app nudges (projects.js projectNudges, ideas.js revisit)
function pick(state: any): Note | null {
  for (const p of (state?.projects ?? []).filter((p: any) => p.status === "active")) {
    const m = (p.milestones ?? []).find((x: any) => !x.done);
    if (!m) continue;
    const doneTimes = (p.milestones ?? []).flatMap((x: any) => x.tasks ?? []).filter((t: any) => t.doneAt).map((t: any) => Date.parse(t.doneAt));
    const last = Math.max(Date.parse(m.startedAt || p.startDate || p.createdAt), ...doneTimes);
    if ((Date.now() - last) / DAY >= 14) {
      return { title: `🌳 ${short(p.name, 40)}`, body: `“${short(m.name)}” hasn’t moved in a while. Is there a 15-minute step you could take?`, url: `${APP}#/project/${p.id}` };
    }
    const due = Date.parse(p.startDate || p.createdAt) + (m.weekEnd ?? 0) * 7 * DAY;
    if (Date.now() > due && Date.now() - due < 3 * DAY) {
      return { title: `🌳 ${short(p.name, 40)}`, body: `“${short(m.name)}” was planned to wrap up about now. Done, or does it need more time?`, url: `${APP}#/project/${p.id}` };
    }
  }
  const waiting = (state?.ideas ?? [])
    .filter((i: any) => i.status === "incubator" && days(i.updatedAt) >= 10)
    .sort((a: any, b: any) => Date.parse(a.updatedAt) - Date.parse(b.updatedAt))[0];
  if (waiting) return { title: "🫙 From your terrarium", body: `“${ideaTitle(waiting)}” is still waiting. Five minutes of thinking?`, url: `${APP}#/think/${waiting.id}` };
  return null;
}

async function send(subs: any[], note: Note) {
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(note), { TTL: 6 * 3600 });
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await admin.from("push_subs").delete().eq("endpoint", s.endpoint); // unsubscribed / expired
      else console.error("push failed", e?.statusCode, e?.body ?? e);
    }
  }
  return sent;
}

async function tick() {
  const { data: subs, error } = await admin.from("push_subs").select("*");
  if (error) throw error;
  const byUser = new Map<string, any[]>();
  for (const s of subs ?? []) {
    const localHour = new Date(Date.now() + s.tz_offset * 60e3).getUTCHours();
    const recent = s.last_sent && days(s.last_sent) < QUIET_DAYS - 0.1;
    if (localHour === SEND_HOUR && !recent) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);
  }
  if (!byUser.size) return { users: 0, sent: 0 };
  const { data: gardens, error: gErr } = await admin.from("gardens").select("user_id, state").in("user_id", [...byUser.keys()]);
  if (gErr) throw gErr;
  let sent = 0;
  for (const g of gardens ?? []) {
    const note = pick(g.state);
    if (!note) continue;
    const userSubs = byUser.get(g.user_id)!;
    const n = await send(userSubs, note);
    if (n) await admin.from("push_subs").update({ last_sent: new Date().toISOString() }).in("endpoint", userSubs.map((s) => s.endpoint));
    sent += n;
  }
  return { users: byUser.size, sent };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  try {
    const secret = Deno.env.get("CRON_SECRET");
    if (secret && req.headers.get("x-cron-secret") === secret) return json(await tick());

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer /, "");
    const { data } = token ? await admin.auth.getUser(token) : { data: { user: null } };
    if (!data.user) return json({ error: "sign_in_required" }, 401);
    const { data: subs } = await admin.from("push_subs").select("*").eq("user_id", data.user.id);
    if (!subs?.length) return json({ error: "no_subscription" }, 404);
    const sent = await send(subs, { title: "🌱 Idea Garden", body: "Reminders are on. I’ll only nudge you now and then, around 9:00.", url: APP });
    return json({ sent });
  } catch (e) {
    console.error(e);
    return json({ error: "remind_error" }, 500);
  }
});
