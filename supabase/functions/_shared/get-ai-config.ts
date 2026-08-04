import { createClient } from "npm:@supabase/supabase-js@2.49.1";

export interface AIConfig {
  apiKey: string;
  model: string;
  systemPrompt: string;
  enabled: boolean;
}

export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

export async function getAgentConfig(userId: string): Promise<AIConfig | null> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return null;
  const admin = createClient(supabaseUrl, serviceKey);
  const { data } = await admin
    .from("agent_configs")
    .select("groq_api_key, groq_model, system_prompt, enabled")
    .eq("user_id", userId)
    .maybeSingle();
  const apiKey = data?.groq_api_key || Deno.env.get("GROQ_API_KEY") || null;
  if (!apiKey) return null;
  return {
    apiKey,
    model: data?.groq_model || GROQ_DEFAULT_MODEL,
    systemPrompt: data?.system_prompt || "Você é um assistente de atendimento simpático e objetivo.",
    enabled: !!data?.enabled,
  };
}

export async function callGroq(
  apiKey: string,
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
): Promise<{ ok: boolean; reply?: string; error?: string; status?: number }> {
  try {
    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages }),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, status: res.status, error: translateAIError(text, res.status) };
    }
    const data = JSON.parse(text);
    const reply = data.choices?.[0]?.message?.content;
    if (!reply || !String(reply).trim()) {
      const finish = data.choices?.[0]?.finish_reason;
      return { ok: false, error: `Resposta vazia da IA (finish_reason=${finish ?? "n/a"})` };
    }
    return { ok: true, reply: String(reply) };
  } catch (e: any) {
    return { ok: false, error: e.message || "Falha ao chamar IA" };
  }
}

function translateAIError(text: string, status: number): string {
  const t = text.substring(0, 500);
  if (status === 503 || /overloaded|high demand|service unavailable/i.test(t)) {
    return "O modelo Groq está temporariamente sobrecarregado. Aguarde alguns segundos e tente novamente.";
  }
  if (status === 429 || /rate limit|too many requests/i.test(t)) {
    return "Limite de requisições da Groq atingido. Aguarde um momento.";
  }
  if (status === 401 || status === 403 || /invalid api key|invalid_api_key/i.test(t)) {
    return "Chave da Groq inválida. Verifique em Configurações → Integração.";
  }
  if (status === 404 || /model.*not found|does not exist|decommissioned/i.test(t)) {
    return "Modelo Groq não encontrado. Escolha outro em Configurações → Integração.";
  }
  if (status === 400 || /bad request|invalid request/i.test(t)) {
    return "Requisição inválida para a Groq. Verifique o modelo e a chave.";
  }
  return `A Groq retornou erro ${status}: ${t}`;
}
