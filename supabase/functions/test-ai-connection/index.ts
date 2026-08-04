import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_DEFAULT_MODEL = "llama-3.3-70b-versatile";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return json({ ok: false, error: "Não autorizado" }, 200);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return json({ ok: false, error: "Usuário inválido" }, 200);

    const body = await req.json().catch(() => ({}));
    let { apiKey } = body ?? {};
    const provider = "groq";
    const model = GROQ_DEFAULT_MODEL;

    if (!apiKey) apiKey = Deno.env.get("GROQ_API_KEY");
    if (!apiKey) {
      return json({ ok: false, error: "Chave da Groq não configurada. Adicione em Configurações → Integração." }, 200);
    }

    const res = await fetch(GROQ_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: "Responda apenas com a palavra: OK" },
          { role: "user", content: "Teste de conexão" },
        ],
      }),
    });


    const text = await res.text();
    if (!res.ok) {
      if (res.status === 503) return json({ ok: false, error: `Groq sobrecarregada. Tente novamente em instantes.` }, 200);
      if (res.status === 429) return json({ ok: false, error: `Limite de requisições da Groq atingido.` }, 200);
      if (res.status === 401 || res.status === 403) return json({ ok: false, error: `Chave da Groq inválida.` }, 200);
      if (res.status === 404) return json({ ok: false, error: `Modelo "${model}" não encontrado na Groq.` }, 200);
      return json({ ok: false, error: `Groq retornou ${res.status}: ${text.substring(0, 300)}` }, 200);
    }
    const data = JSON.parse(text);
    const reply = data.choices?.[0]?.message?.content || "(vazio)";
    return json({ ok: true, data: { reply: String(reply).substring(0, 200), provider, model } }, 200);

  } catch (e: any) {
    return json({ ok: false, error: e.message || "Erro interno" }, 200);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
