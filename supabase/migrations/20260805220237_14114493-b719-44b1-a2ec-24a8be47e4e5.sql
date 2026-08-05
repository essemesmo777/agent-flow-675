ALTER TABLE public.whatsapp_instances
  ADD COLUMN IF NOT EXISTS webhook_secret text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex');

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_instances_webhook_secret_key
  ON public.whatsapp_instances (webhook_secret);