import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PRIVATE_HOST = /^(localhost|.*\.local|.*\.internal|127\..*|10\..*|192\.168\..*|169\.254\..*|172\.(1[6-9]|2\d|3[01])\..*|\[?::1\]?|0\.0\.0\.0|metadata\.google\.internal)$/i;

function validateServerUrl(raw: unknown): { url: string } | { error: string } {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 2048) {
    return { error: "URL do servidor é obrigatória." };
  }
  let parsed: URL;
  try {
    parsed = new URL(raw.trim());
  } catch {
    return { error: "URL do servidor inválida." };
  }
  if (parsed.protocol !== "https:") {
    return { error: "Somente URLs https são permitidas." };
  }
  const host = parsed.hostname;
  if (PRIVATE_HOST.test(host) || !host.includes(".")) {
    return { error: "Endereço de servidor não permitido." };
  }
  return { url: `${parsed.origin}` };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // --- Auth: only signed-in users may trigger outbound requests ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ ok: false, message: "Não autorizado." }, 401);
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return json({ ok: false, message: "Não autorizado." }, 401);
    }

    const { serverUrl, instanceToken, adminToken } = await req.json();
    const validated = validateServerUrl(serverUrl);
    if ("error" in validated) {
      return json({ ok: false, message: validated.error });
    }
    const base = validated.url;

    if (instanceToken !== undefined && typeof instanceToken !== "string") {
      return json({ ok: false, message: "Instance Token inválido." });
    }
    if (adminToken !== undefined && typeof adminToken !== "string") {
      return json({ ok: false, message: "Admin Token inválido." });
    }

    // Preferência: testar com Instance Token (endpoint de status da instância)
    if (instanceToken) {
      try {
        const res = await fetch(`${base}/instance/status`, {
          headers: { token: instanceToken },
        });
        await res.text();
        console.log(`[test-uazapi] instance status=${res.status}`);

        if (res.ok) {
          return json({ ok: true, message: "Instance Token válido! Instância respondendo corretamente." });
        }

        if (res.status === 401) {
          return json({ ok: false, message: "Instance Token inválido (401). Copie novamente do painel Uazapi." });
        }
      } catch (e: any) {
        return json({ ok: false, message: `Não foi possível conectar: ${e?.message || "erro de rede"}` });
      }
    }

    // Fallback: testar com Admin Token
    if (adminToken) {
      const url = `${base}/instance/all`;
      const attempts = [
        { AdminToken: adminToken },
        { admintoken: adminToken },
      ];

      let lastStatus = 0;
      let lastBody = "";

      for (const headers of attempts) {
        try {
          const res = await fetch(url, { headers });
          lastStatus = res.status;
          lastBody = await res.text();
          console.log(`[test-uazapi] admin header=${Object.keys(headers)[0]} status=${res.status}`);
          if (res.ok) {
            return json({ ok: true, message: "Admin Token válido! Uazapi respondeu corretamente." });
          }

          if (
            res.status === 401 &&
            /public demo server|endpoint has been disabled/i.test(lastBody)
          ) {
            return json({
              ok: true,
              demo: true,
              message:
                "Servidor demo detectado (free.uazapi.com). O endpoint de validação é bloqueado, mas você pode criar instâncias e conectar o WhatsApp normalmente. Para produção, use um servidor Uazapi próprio.",
            });
          }
        } catch (e: any) {
          console.error("[test-uazapi] fetch error", e?.message);
          return json({ ok: false, message: `Não foi possível conectar: ${e?.message || "erro de rede"}` });
        }
      }

      let msg = `Uazapi retornou ${lastStatus}. Verifique URL e token.`;
      if (lastStatus === 401) msg = "Admin Token inválido (401). Copie novamente o AdminToken do painel Uazapi.";
      if (lastStatus === 404) msg = "Endpoint não encontrado (404). Confirme a URL do servidor Uazapi.";

      return json({ ok: false, message: msg });
    }

    return json({ ok: false, message: "Informe pelo menos o Instance Token ou o Admin Token para testar." });
  } catch (error: any) {
    console.error("[test-uazapi] error", error);
    return json({ ok: false, message: "Erro ao testar a conexão." });
  }
});
