import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole } from "@/hooks/useAdminRole";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import {
  Bot,
  ExternalLink,
  TestTube2,
  Clock,
  Webhook,
  Copy,
  Shield,
  Smartphone,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialSection?: "whatsapp" | "agente";
}

function CheckRow({ ok, warn, label }: { ok?: boolean; warn?: boolean; label: string }) {
  const Icon = warn ? AlertTriangle : ok ? CheckCircle2 : XCircle;
  const color = warn ? "text-amber-500" : ok ? "text-emerald-500" : "text-destructive";
  return (
    <div className="flex items-start gap-2">
      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${color}`} />
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}

export function ConfigDrawer({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { isAdmin } = useAdminRole();
  const navigate = useNavigate();

  // Agente state
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [prompt, setPrompt] = useState(
    "Você é um assistente de atendimento simpático e objetivo.",
  );
  const [enabled, setEnabled] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testingHook, setTestingHook] = useState(false);
  const [hookReport, setHookReport] = useState<any | null>(null);
  // Conexão Uazapi (por usuário)
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [serverUrl, setServerUrl] = useState("");
  const [instanceToken, setInstanceToken] = useState("");
  const [hasInstanceToken, setHasInstanceToken] = useState(false);
  const [savingUazapi, setSavingUazapi] = useState(false);
  const [testingUazapi, setTestingUazapi] = useState(false);
  // Follow-up automático
  const [followupOn, setFollowupOn] = useState(false);
  const [followupMinutes, setFollowupMinutes] = useState<number>(1);
  const [followupMax, setFollowupMax] = useState<number>(1);

  const loadAgent = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("agent_configs")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setPrompt(data.system_prompt);
      setEnabled(data.enabled);
      setHasKey(!!data.groq_api_key);
      const m = (data as any).followup_inactivity_minutes;
      setFollowupOn(!!m && m > 0);
      setFollowupMinutes(m && m > 0 ? m : 1);
      setFollowupMax((data as any).followup_max_per_conversation ?? 1);
    }
  };

  const loadUazapi = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("whatsapp_instances")
      .select("id,server_url,instance_token,webhook_secret")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setInstanceId(data.id);
      setServerUrl(data.server_url || "");
      setHasInstanceToken(!!data.instance_token);
      setWebhookSecret((data as any).webhook_secret || "");
    }
  };


  useEffect(() => {
    if (!open) return;
    loadAgent();
    loadUazapi();
  }, [open, user]);

  const saveUazapi = async () => {
    if (!user) return;
    if (!serverUrl.trim()) {
      toast({ variant: "destructive", title: "Informe o Server URL" });
      return;
    }
    setSavingUazapi(true);
    const payload: any = {
      user_id: user.id,
      name: "principal",
      server_url: serverUrl.trim().replace(/\/$/, ""),
    };
    if (instanceToken.trim()) payload.instance_token = instanceToken.trim();
    const { data, error } = instanceId
      ? await supabase
          .from("whatsapp_instances")
          .update(payload)
          .eq("id", instanceId)
          .eq("user_id", user.id)
          .select("id")
          .single()
      : await supabase
          .from("whatsapp_instances")
          .insert(payload)
          .select("id")
          .single();
    setSavingUazapi(false);
    if (error) {
      toast({ variant: "destructive", title: "Erro", description: error.message });
    } else {
      toast({ title: "Uazapi salva!" });
      if (data?.id) setInstanceId(data.id);
      if (instanceToken.trim()) {
        setHasInstanceToken(true);
        setInstanceToken("");
      }
    }
  };

  const testUazapi = async () => {
    if (!serverUrl.trim()) {
      toast({ variant: "destructive", title: "Informe o Server URL" });
      return;
    }
    setTestingUazapi(true);
    let tokenToTest = instanceToken.trim();
    if (!tokenToTest && hasInstanceToken && user) {
      const { data } = await supabase
        .from("whatsapp_instances")
        .select("instance_token")
        .eq("user_id", user.id)
        .eq("id", instanceId || "")
        .maybeSingle();
      tokenToTest = data?.instance_token || "";
    }
    const { data, error } = await supabase.functions.invoke("test-uazapi", {
      body: {
        serverUrl: serverUrl.trim().replace(/\/$/, ""),
        instanceToken: tokenToTest || undefined,
      },
    });
    setTestingUazapi(false);
    if (error || !data?.ok) {
      toast({
        variant: "destructive",
        title: "Falha no teste",
        description: data?.message || error?.message || "Erro",
      });
    } else {
      toast({ title: "Uazapi OK!", description: data.message });
    }
  };

  const saveAgent = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = {
      user_id: user.id,
      system_prompt: prompt,
      enabled,
      followup_inactivity_minutes: followupOn ? followupMinutes : null,
      followup_max_per_conversation: followupMax,
    };
    if (apiKey.trim()) payload.groq_api_key = apiKey.trim();
    const { error } = await supabase
      .from("agent_configs")
      .upsert(payload, { onConflict: "user_id" });
    setSaving(false);
    if (error) toast({ variant: "destructive", title: "Erro", description: error.message });
    else {
      toast({ title: "Salvo!" });
      if (apiKey.trim()) {
        setHasKey(true);
        setApiKey("");
      }
    }
  };

  const testConnection = async () => {
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("test-ai-connection", {
      body: { apiKey: apiKey.trim() || undefined },
    });
    setTesting(false);
    if (error || !data?.ok) {
      toast({
        variant: "destructive",
        title: "Falha no teste",
        description: data?.error || error?.message || "Erro",
      });
    } else {
      toast({ title: "Conexão OK!", description: `Resposta: ${data.data?.reply}` });
    }
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-webhook`;

  const copyWebhook = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      toast({ title: "URL copiada!" });
    } catch {
      toast({ variant: "destructive", title: "Não foi possível copiar" });
    }
  };

  const testWebhook = async () => {
    setTestingHook(true);
    setHookReport(null);
    try {
      // Resolve token: usa o input, senão busca do banco
      let tokenToUse = instanceToken.trim();
      if (!tokenToUse && user) {
        const { data } = await supabase
          .from("whatsapp_instances")
          .select("instance_token")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        tokenToUse = data?.instance_token || "";
      }
      const res = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "dry_run",
          instance: { name: "principal", token: tokenToUse },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast({ variant: "destructive", title: "Webhook inacessível", description: `HTTP ${res.status}` });
      } else {
        setHookReport(json.checks || { error: json.error || "Sem detalhes" });
      }
    } catch (e: any) {
      toast({ variant: "destructive", title: "Falha no webhook", description: e.message });
    } finally {
      setTestingHook(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configuração</SheetTitle>
          <SheetDescription>
            Configure a IA e o follow-up automático.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-8">
          {/* Conexão Uazapi (por usuário) */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-primary" /> Conexão Uazapi
            </h3>
            <p className="text-xs text-muted-foreground">
              Cole o Server URL e o Instance Token da sua instância WhatsApp na Uazapi.
              Cada usuário usa a própria instância. O nome é definido automaticamente como "principal".
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">Server URL</Label>
              <Input
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="https://free.uazapi.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Instance Token{" "}
                {hasInstanceToken && (
                  <span className="text-muted-foreground">(configurado)</span>
                )}
              </Label>
              <Input
                type="password"
                value={instanceToken}
                onChange={(e) => setInstanceToken(e.target.value)}
                placeholder={
                  hasInstanceToken ? "•••••••• (deixe vazio para manter)" : "cole o token da instância"
                }
              />
              <a
                href="https://docs.uazapi.com/"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Onde encontrar <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex gap-2">
              <Button onClick={saveUazapi} disabled={savingUazapi} className="flex-1" size="sm">
                {savingUazapi ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="outline" size="sm" onClick={testUazapi} disabled={testingUazapi}>
                <TestTube2 className="w-4 h-4 mr-2" />
                {testingUazapi ? "Testando..." : "Testar"}
              </Button>
            </div>
          </section>

          <Separator />

          {isAdmin && (
            <>
              <section className="space-y-2">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Shield className="w-4 h-4 text-primary" /> Admin Token global (opcional)
                </h3>
                <p className="text-xs text-muted-foreground">
                  Fluxo normal do cliente é o bloco acima. Use esta tela apenas
                  se precisar gerenciar instâncias no nível do servidor com o
                  Admin Token.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    onOpenChange(false);
                    navigate("/admin/uazapi");
                  }}
                >
                  Abrir configuração da Uazapi
                </Button>
              </section>
              <Separator />
            </>
          )}

          {/* Webhook Uazapi */}
          <section className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Webhook className="w-4 h-4 text-primary" /> Webhook do WhatsApp (Uazapi)
            </h3>
            <p className="text-xs text-muted-foreground">
              Cole esta URL no painel da Uazapi para receber as mensagens aqui.
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs">URL do webhook</Label>
              <div className="flex gap-2">
                <Input readOnly value={webhookUrl} className="text-xs font-mono" />
                <Button variant="outline" size="sm" onClick={copyWebhook}>
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-md border border-border bg-muted/40 p-3 text-xs space-y-2">
              <div className="font-medium">Como configurar</div>
              <ol className="list-decimal ml-4 space-y-1 text-muted-foreground">
                <li>Abra o painel da Uazapi → sua instância → aba <span className="font-medium">Webhook</span>.</li>
                <li>Cole a URL acima no campo <span className="font-medium">URL</span>.</li>
                <li>
                  Marque os eventos:
                  <ul className="list-disc ml-4 mt-1">
                    <li><span className="font-mono">messages</span> (obrigatório)</li>
                    <li><span className="font-mono">messages_update</span> (opcional)</li>
                    <li><span className="font-mono">connection</span> (opcional)</li>
                  </ul>
                </li>
                <li>Salve.</li>
              </ol>
            </div>

            <Button variant="outline" size="sm" onClick={testWebhook} disabled={testingHook} className="w-full">
              <TestTube2 className="w-4 h-4 mr-2" />
              {testingHook ? "Testando..." : "Testar webhook"}
            </Button>

            {hookReport && (
              <div className="rounded-md border border-border bg-background p-3 text-xs space-y-1.5">
                <CheckRow
                  ok={!!hookReport?.instance?.ok}
                  label={
                    hookReport?.instance?.ok
                      ? `Instância encontrada (por ${hookReport.instance.matched_by}) — ${hookReport.instance.instance_name}`
                      : `Instância não encontrada${hookReport?.instance?.error ? ` — ${hookReport.instance.error}` : ""}`
                  }
                />
                {hookReport?.instance?.name_mismatch && (
                  <CheckRow
                    warn
                    label="Nome digitado difere do painel — o webhook corrige automaticamente na primeira mensagem"
                  />
                )}
                <CheckRow
                  ok={!!hookReport?.agent?.ok}
                  label={
                    hookReport?.agent?.ok
                      ? "Agente ativo e configurado"
                      : `Agente: ${hookReport?.agent?.error || "não configurado"}`
                  }
                />
                <CheckRow
                  ok={!!hookReport?.groq?.ok}
                  label={hookReport?.groq?.ok ? "Groq respondendo" : `Groq: ${hookReport?.groq?.error || "falha"}`}
                />
                <CheckRow
                  ok={!!hookReport?.uazapi?.ok}
                  label={hookReport?.uazapi?.ok ? "Uazapi acessível" : `Uazapi: ${hookReport?.uazapi?.error || "falha"}`}
                />
              </div>
            )}
          </section>

          <Separator />

          {/* Agente IA */}
          <section className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" /> Agente IA (Groq)
            </h3>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Chave da API {hasKey && <span className="text-muted-foreground">(configurada)</span>}
              </Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={hasKey ? "•••••••• (deixe vazio para manter)" : "gsk_..."}
              />
              <a
                href="https://console.groq.com/keys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                Obter chave gratuita <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Prompt do agente</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                placeholder="Como o agente deve se comportar, tom de voz, sobre o negócio..."
              />
            </div>

            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <div className="font-medium text-sm">Agente ativo</div>
                <div className="text-xs text-muted-foreground">
                  Responde automaticamente às mensagens do WhatsApp.
                </div>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </label>

            <div className="flex gap-2">
              <Button onClick={saveAgent} disabled={saving} className="flex-1" size="sm">
                {saving ? "Salvando..." : "Salvar"}
              </Button>
              <Button variant="outline" size="sm" onClick={testConnection} disabled={testing}>
                <TestTube2 className="w-4 h-4 mr-2" />
                {testing ? "Testando..." : "Testar"}
              </Button>
            </div>
          </section>

          <Separator />

          {/* Follow-up automático */}
          <section className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" /> Follow-up automático
            </h3>
            <p className="text-xs text-muted-foreground">
              Se o cliente ficar sem responder por um tempo, a IA envia uma
              mensagem curta de reengajamento.
            </p>

            <label className="flex items-center justify-between cursor-pointer">
              <div className="font-medium text-sm">Reengajar clientes inativos</div>
              <Switch checked={followupOn} onCheckedChange={setFollowupOn} />
            </label>

            {followupOn && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Após quantos minutos</Label>
                  <Input
                    type="number"
                    min={1}
                    max={43200}
                    value={followupMinutes}
                    onChange={(e) => setFollowupMinutes(Number(e.target.value) || 1)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Máx. por conversa</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={followupMax}
                    onChange={(e) => setFollowupMax(Number(e.target.value) || 1)}
                  />
                </div>
              </div>
            )}

            <p className="text-[11px] text-muted-foreground">
              Salve na seção acima para aplicar. O contador é zerado toda vez
              que o cliente responde.
            </p>
          </section>
        </div>

      </SheetContent>
    </Sheet>
  );
}