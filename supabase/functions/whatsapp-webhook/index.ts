import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";
import { getAgentConfig, callGroq } from "../_shared/get-ai-config.ts";
import { getUazapiConfig } from "../_shared/get-uazapi-config.ts";
import { cancelPendingFollowups, scheduleInactivityFollowup } from "../_shared/followups.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, token",
};

function normalizeName(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase();
}

function ok(body: any = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractText(body: any) {
  // Uazapi envia a mensagem completa em body.data; alguns payloads legados usam body.message
  const envelope = body.data || body;
  const m = envelope?.message ? envelope : envelope?.message || body.message || body;
  const text =
    envelope?.message?.conversation ||
    envelope?.message?.extendedTextMessage?.text ||
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    (typeof m?.content === "string" ? m.content : m?.content?.text) ||
    m?.body ||
    m?.text ||
    null;
  const fromMe = envelope?.key?.fromMe ?? m?.key?.fromMe ?? m?.fromMe ?? false;
  const rawJid =
    body.chat?.wa_chatid ||
    body.chat?.lead_phone ||
    envelope?.key?.remoteJid ||
    m?.key?.remoteJid ||
    m?.chatid ||
    m?.from ||
    "";
  const phone = String(rawJid).replace(/@.*/, "").replace(/\D/g, "");
  const isGroup = String(rawJid).includes("@g.us");
  const contactName = body.chat?.lead_name || envelope?.pushName || m?.pushName || null;
  const instanceName = body.instance?.name || body.instanceName || "";
  const instanceToken =
    body.instance?.token || body.token || null;
  return { text, fromMe, phone, isGroup, contactName, instanceName, instanceToken, message: envelope || m };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // --- Shared secret: identifies which instance the event belongs to ---
    const url = new URL(req.url);
    const providedSecret =
      req.headers.get("x-webhook-secret") || url.searchParams.get("secret") || "";

    const body = await req.json();
    const event = body.EventType || body.event || body.type || "messages";
    if (event === "test") return ok({ ok: true, message: "webhook ok" });

    if (!providedSecret) {
      console.warn("[webhook] missing webhook secret");
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: secretRow } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("webhook_secret", providedSecret)
      .maybeSingle();

    if (!secretRow) {
      console.warn("[webhook] invalid webhook secret");
      return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (event === "dry_run") return await runDryRun(secretRow);
    if (event === "connection" || event === "connection.update") return ok();

    const { text, fromMe, phone, isGroup, contactName, instanceName, instanceToken, message } = extractText(body);

    if (!message || isGroup || !text || !phone) return ok();

    // A instância é sempre a dona do segredo — nunca resolvida por nome/token do payload
    const instRow: any = secretRow;
    if (instanceToken && instRow.instance_token && instanceToken !== instRow.instance_token) {
      console.warn("[webhook] payload token does not match instance");
      return ok();
    }


    const userId = instRow.user_id;

    // Auto-sincroniza o nome salvo com o nome real vindo da Uazapi (matches por token)
    if (instanceName && instRow.name !== instanceName) {
      await supabase
        .from("whatsapp_instances")
        .update({ name: instanceName })
        .eq("id", instRow.id);
      instRow.name = instanceName;
    }

    // Upsert conversation
    const { data: convExisting } = await supabase
      .from("conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("contact_phone", phone)
      .maybeSingle();

    let conv = convExisting;
    if (!conv) {
      // Novo contato → coluna "Novo Lead" (fallback: primeiro stage por position)
      const { data: novoLead } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("user_id", userId)
        .eq("name", "Novo Lead")
        .limit(1)
        .maybeSingle();
      let firstStage = novoLead;
      if (!firstStage) {
        const { data: fallback } = await supabase
          .from("pipeline_stages")
          .select("id")
          .eq("user_id", userId)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        firstStage = fallback;
      }
      const { data: created } = await supabase
        .from("conversations")
        .insert({
          user_id: userId,
          instance_id: instRow.id,
          contact_phone: phone,
          contact_name: contactName,
          ai_enabled: fromMe ? false : true,
          human_takeover_at: fromMe ? new Date().toISOString() : null,
          last_message_at: new Date().toISOString(),
          stage_id: firstStage?.id ?? null,
        })
        .select()
        .single();
      conv = created;
    } else {
      const update: Record<string, any> = {
        last_message_at: new Date().toISOString(),
        contact_name: contactName || conv.contact_name,
      };
      if (fromMe) {
        update.ai_enabled = false;
        update.human_takeover_at = new Date().toISOString();
        conv.ai_enabled = false;
        conv.human_takeover_at = update.human_takeover_at;
      }
      await supabase.from("conversations").update(update).eq("id", conv.id);
    }
    if (!conv) return ok();

    // Mensagem enviada do próprio celular do usuário → registra como takeover humano
    // e encerra aqui (não chama IA, não reenvia via Uazapi).
    if (fromMe) {
      await cancelPendingFollowups(supabase, conv.id);
      await supabase
        .from("conversations")
        .update({ inactivity_followup_at: null, auto_followup_count: 0 })
        .eq("id", conv.id);
      await supabase.from("messages").insert({
        conversation_id: conv.id,
        user_id: userId,
        direction: "outbound",
        sender: "human",
        content: text,
      });
      return ok();
    }

    // Cliente respondeu → cancela follow-ups pendentes e zera contador de auto-follow-ups
    await cancelPendingFollowups(supabase, conv.id);
    await supabase
      .from("conversations")
      .update({ inactivity_followup_at: null, auto_followup_count: 0 })
      .eq("id", conv.id);

    // Save inbound message
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      user_id: userId,
      direction: "inbound",
      sender: "contact",
      content: text,
    });

    // AI reply?
    if (!conv.ai_enabled) return ok();
    const agent = await getAgentConfig(userId);
    if (!agent || !agent.enabled) return ok();

    // Build history (last 20 messages)
    const { data: history } = await supabase
      .from("messages")
      .select("direction, sender, content")
      .eq("conversation_id", conv.id)
      .order("created_at", { ascending: false })
      .limit(20);

    const chat = [
      { role: "system" as const, content: agent.systemPrompt },
      ...(history || []).reverse().map((m: any) => ({
        role: (m.direction === "inbound" ? "user" : "assistant") as "user" | "assistant",
        content: m.content,
      })),
    ];

    const groq = await callGroq(agent.apiKey, agent.model, chat);
    if (!groq.ok || !groq.reply) {
      console.error("[webhook] groq failed", groq.error);
      return ok();
    }

    // Send via Uazapi (prefere config por instância; fallback global)
    const uaz = await getUazapiConfig();
    const serverUrl = (instRow.server_url as string | null)?.replace(/\/$/, "") || uaz?.serverUrl;
    const token = instRow.instance_token || uaz?.instanceToken;
    if (!serverUrl || !token) {
      console.error("[webhook] uazapi server/token missing", { hasServer: !!serverUrl, hasToken: !!token });
      return ok();
    }
    const sendRes = await fetch(`${serverUrl}/send/text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", token },
      body: JSON.stringify({ number: phone, text: groq.reply }),
    });
    if (!sendRes.ok) {
      console.error("[webhook] uazapi send failed", await sendRes.text());
      return ok();
    }

    // Persist outbound
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      user_id: userId,
      direction: "outbound",
      sender: "ai",
      content: groq.reply,
    });
    await supabase
      .from("conversations")
      .update({ last_message_at: new Date().toISOString() })
      .eq("id", conv.id);

    // Agenda auto-follow-up por inatividade, se habilitado
    await scheduleInactivityFollowup({
      admin: supabase,
      userId,
      conversationId: conv.id,
      currentAutoCount: conv.auto_followup_count ?? 0,
    });

    return ok();
  } catch (e: any) {
    console.error("[webhook] error", e);
    return ok({ ok: false, error: e.message });
  }
});

async function runDryRun(body: any) {
  const inName: string = String(body?.instance?.name || "").trim();
  const inToken: string = String(body?.instance?.token || "").trim();
  const checks: any = {
    instance: { ok: false, matched_by: null, name_mismatch: false, instance_name: null },
    agent: { ok: false, has_key: false, enabled: false },
    groq: { ok: false },
    uazapi: { ok: false },
  };

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 1. Instance lookup
  let instRow: any = null;
  if (inToken) {
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .eq("instance_token", inToken)
      .maybeSingle();
    if (data) {
      instRow = data;
      checks.instance.matched_by = "token";
    }
  }
  if (!instRow && inName) {
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("*")
      .not("instance_token", "is", null)
      .order("updated_at", { ascending: false })
      .limit(20);
    instRow = (data || []).find((r: any) => normalizeName(r.name) === normalizeName(inName)) || null;
    if (instRow) checks.instance.matched_by = "name";
  }
  if (instRow) {
    checks.instance.ok = true;
    checks.instance.instance_name = instRow.name;
    checks.instance.name_mismatch = !!(inName && instRow.name !== inName);
  } else {
    checks.instance.error = "Nenhuma instância encontrada com esse token/nome";
    return ok({ ok: false, checks });
  }

  // 2. Agent
  const agent = await getAgentConfig(instRow.user_id);
  checks.agent.has_key = !!agent?.apiKey;
  checks.agent.enabled = !!agent?.enabled;
  checks.agent.ok = checks.agent.has_key && checks.agent.enabled;
  if (!checks.agent.has_key) checks.agent.error = "Chave da Groq não configurada";
  else if (!checks.agent.enabled) checks.agent.error = "Agente não está ativo";

  // 3. Groq ping
  if (agent?.apiKey) {
    const r = await callGroq(agent.apiKey, agent.model, [
      { role: "system", content: "Responda apenas: ok" },
      { role: "user", content: "ping" },
    ]);
    checks.groq.ok = r.ok;
    if (!r.ok) checks.groq.error = r.error;
  } else {
    checks.groq.error = "Sem chave para testar";
  }

  // 4. Uazapi reachable
  const uaz = await getUazapiConfig();
  const serverUrl = (instRow.server_url as string | null)?.replace(/\/$/, "") || uaz?.serverUrl;
  const token = instRow.instance_token || uaz?.instanceToken;
  if (!serverUrl || !token) {
    checks.uazapi.error = "Server URL ou token da instância ausente";
  } else {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 5000);
      const res = await fetch(`${serverUrl}/instance/status`, {
        method: "GET",
        headers: { token },
        signal: ctrl.signal,
      });
      clearTimeout(t);
      await res.text().catch(() => "");
      checks.uazapi.ok = res.ok;
      checks.uazapi.status = res.status;
      if (!res.ok) checks.uazapi.error = `Uazapi retornou HTTP ${res.status}`;
    } catch (e: any) {
      checks.uazapi.error = e?.message || "Falha ao conectar na Uazapi";
    }
  }

  const allOk = checks.instance.ok && checks.agent.ok && checks.groq.ok && checks.uazapi.ok;
  return ok({ ok: allOk, checks });
}