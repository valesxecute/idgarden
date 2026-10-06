// Idea Garden AI (Supabase Edge Function, Deno). Deployed as "garden-ai".
// Provider: any OpenAI-compatible Chat Completions API. Default: Google Gemini free tier.
// Secrets (Supabase → Edge Functions → Secrets), never shipped to the browser:
//   GEMINI_API_KEY (required; free at aistudio.google.com) · AI_MODEL (optional, default gemini-3.8-flash)
//   AI_BASE_URL (optional; e.g. https://api.groq.com/openai/v1 to use Groq instead)
// Tasks:
//   think: Think With Me reply for one idea      → { reply, questions[] }
//   plan:  project roadmap for the new-project wizard → { estimateNote, firstSteps[], milestones[{name, weeks, tasks[]}] }
// Signed-in users only; DAILY_LIMIT requests per user per day (public.bump_ai_usage, supabase/ai_usage.sql).
import OpenAI from "npm:openai";
import { createClient } from "npm:@supabase/supabase-js@2";

const API_KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("AI_API_KEY");
const BASE_URL = Deno.env.get("AI_BASE_URL") || "https://generativelanguage.googleapis.com/v1beta/openai/";
const MODEL = Deno.env.get("AI_MODEL") || "gemini-3.8-flash";
const DAILY_LIMIT = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

// created on first use: the SDK throws at construction without a key,
// which would crash every request (even the sign-in check) instead of answering "ai_not_configured"
let openai: OpenAI | null = null;
const client = () => (openai ??= new OpenAI({ apiKey: API_KEY, baseURL: BASE_URL }));

// ---------- prompts (stable text first: helps provider-side prompt caching) ----------
const THINK_SYSTEM = `You are the creative partner inside Idea Garden, a calm app where people capture ideas, collect inspiration, and grow the good ones into real projects. You are talking with the owner of one idea. You can see that idea plus a few related items from their garden: other ideas, saved inspirations, learning goals and projects.

How to be: curious, thoughtful and warm, but honest. Challenge assumptions when it helps the idea. Don't flatter or cheer, and don't pad. Keep replies short enough to read on a phone: usually under 150 words, using "• " bullet lines when listing. Mention the user's own garden items by name when they genuinely connect. Never invent garden items, sources, statistics or links; if something needs research, say what to look up.

The user may pick a mode:
- brainstorm: 5-7 varied directions, including one unexpected one
- develop: sharpen it into a one-line concept (who it's for, the problem, what it is, why it's different)
- questions: 3-5 questions worth answering before going further; also return them in "questions"
- challenge: stress-test it (riskiest assumptions, existing alternatives, what to cut)
- connect: how items in their garden relate to this idea
- inspire: what kinds of reading, examples or people would feed this idea; point to their saved inspirations where relevant
- plan: 2-3 concrete first steps, then mention they can tap "Turn into project" for a full roadmap
With no mode, respond to what they said and, if useful, end with one good question.

Formatting: plain text, **bold** for emphasis, "• " for bullets. No headings, no tables. "questions" is empty unless you are proposing questions they might want to save.`;

const PLAN_SYSTEM = `You create realistic project plans for Idea Garden, an app that helps people turn ideas into real projects. Plans must fit the person's stated timeframe and weekly hours.

Rules:
- 4-7 milestones in order; their "weeks" must add up exactly to the total weeks given.
- Each milestone has 2-4 tasks. Tasks are concrete actions, not vague goals.
- firstSteps: the 3 smallest useful actions to start this week, each doable in under an hour.
- estimateNote: one or two honest sentences on whether the timeframe fits the weekly hours, and what to cut if it is tight. Say it is a rough estimate. No cheerleading.
- Use the person's own words and context; don't invent facts about them.`;

const THINK_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    questions: { type: "array", items: { type: "string" } },
  },
  required: ["reply", "questions"],
  additionalProperties: false,
};

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    estimateNote: { type: "string" },
    firstSteps: { type: "array", items: { type: "string" } },
    milestones: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          weeks: { type: "integer" },
          tasks: { type: "array", items: { type: "string" } },
        },
        required: ["name", "weeks", "tasks"],
        additionalProperties: false,
      },
    },
  },
  required: ["estimateNote", "firstSteps", "milestones"],
  additionalProperties: false,
};

// ---------- helpers ----------
const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

function thinkPrompt(b: any): string {
  const idea = b.idea ?? {};
  const list = (items: any[] | undefined, fmt: (x: any) => string) => (items ?? []).slice(0, 5).map(fmt).join("\n") || "(none)";
  const history = (b.history ?? []).slice(-12)
    .map((m: any) => `${m.role === "user" ? "User" : "You"}: ${clip(m.text, 1200)}`).join("\n") || "(this is the start)";
  return `<idea>
title: ${clip(idea.title, 200)}
text: ${clip(idea.content, 2000)}
why it interests them: ${clip(idea.why, 600) || "(not written yet)"}
tags: ${(idea.tags ?? []).join(", ") || "(none)"}
open questions: ${(idea.questions ?? []).map((q: string) => clip(q, 200)).join(" | ") || "(none)"}
notes: ${clip(idea.notes, 1500) || "(none)"}
</idea>
<related_ideas>
${list(b.related?.ideas, (x) => `- ${clip(x.title, 200)}: ${clip(x.content, 300)}`)}
</related_ideas>
<saved_inspirations>
${list(b.related?.inspirations, (x) => `- ${clip(x.title, 200)}${x.caught ? ` (caught their attention: ${clip(x.caught, 200)})` : ""}${x.note ? ` - ${clip(x.note, 200)}` : ""}`)}
</saved_inspirations>
<learning>
${list(b.related?.learning, (x) => `- ${clip(x.topic, 150)}${x.goal ? `: ${clip(x.goal, 200)}` : ""}`)}
</learning>
<projects>
${list(b.related?.projects, (x) => `- ${clip(x.name, 150)}`)}
</projects>
<conversation_so_far>
${history}
</conversation_so_far>
<request mode="${clip(b.mode || "free", 20)}">
${clip(b.text, 2000) || "(no extra text - just use the mode)"}
</request>`;
}

function planPrompt(b: any): string {
  return `Project: ${clip(b.name, 200)}
Goal / what done looks like: ${clip(b.goal || b.done, 600) || "(not specified)"}
Total weeks: ${Number(b.weeks) || 8}
Hours per week: ${Number(b.hoursPerWeek) || 5}
The idea behind it: ${clip(b.idea?.content, 1500) || "(none)"}
Why it matters to them: ${clip(b.idea?.why, 600) || "(not written)"}
Things they are learning: ${(b.learning ?? []).slice(0, 5).map((l: any) => clip(l, 150)).join(", ") || "(none)"}`;
}

async function ask(system: string, user: string, name: string, schema: object, maxTokens: number) {
  const res = await client().chat.completions.create({
    model: MODEL,
    max_tokens: maxTokens,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    response_format: { type: "json_schema", json_schema: { name, schema, strict: true } },
  });
  const msg = res.choices?.[0]?.message;
  if ((msg as any)?.refusal) return { refusal: true };
  if (res.choices?.[0]?.finish_reason === "length") throw new Error("response_truncated");
  return JSON.parse(msg?.content || "{}");
}

// ---------- handler ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  // the caller's own token: bump_ai_usage() only works for a signed-in user
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, req.headers.get("apikey") ?? Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
  });
  const { data: used, error: usageError } = await sb.rpc("bump_ai_usage");
  if (usageError || used === null) return json({ error: "sign_in_required" }, 401);
  if (used > DAILY_LIMIT) return json({ error: "daily_limit", limit: DAILY_LIMIT }, 429);

  if (!API_KEY) return json({ error: "ai_not_configured", detail: "key_missing" }, 503);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "bad_request" }, 400); }

  try {
    if (body.task === "think") return json(await ask(THINK_SYSTEM, thinkPrompt(body), "think_reply", THINK_SCHEMA, 4000));
    if (body.task === "plan") return json(await ask(PLAN_SYSTEM, planPrompt(body), "project_plan", PLAN_SCHEMA, 8000));
    return json({ error: "unknown_task" }, 400);
  } catch (e) {
    if (e instanceof OpenAI.RateLimitError) return json({ error: "busy" }, 503);
    if (e instanceof OpenAI.AuthenticationError || (e instanceof OpenAI.APIError && /api key/i.test(e.message))) { console.error("key rejected", e.status, e.message); return json({ error: "ai_not_configured", detail: "key_rejected" }, 503); }
    if (e instanceof OpenAI.APIError) { console.error(e.status, e.message); return json({ error: "ai_error", status: e.status }, 502); }
    console.error(e);
    return json({ error: "ai_error" }, 500);
  }
});
