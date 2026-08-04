Remover o input de nome da instância Uazapi sem quebrar o backend

Objetivo: deixar o cadastro de instância Uazapi mais simples, removendo o campo "Nome da instância" do drawer de configuração e do admin, sem quebrar as edge functions que usam o nome como identificador.

Abordagem escolhida: enviar um nome padrão ("principal") automaticamente, mantendo a coluna `whatsapp_instances.name` NOT NULL e a lógica do webhook inalterada. Isso evita alterações de schema e migração de dados.

Passos:

1. Frontend — ConfigDrawer.tsx
   - Remover o input de "Nome da instância" e o texto auxiliar.
   - Remover a validação que exige `instanceName.trim()`.
   - No payload de insert/update de `whatsapp_instances`, enviar `name: "principal"` (ou o nome já salvo, se existir) ao invés de `instanceName.trim()`.

2. Frontend — admin/UazapiConfig.tsx
   - O admin já usa `DEFAULT_INSTANCE_NAME = "principal"`. Garantir que o insert continue funcionando e que o input não seja necessário.

3. Edge functions — nenhuma alteração
   - `whatsapp-webhook` continua encontrando a instância por token; se por nome, usará "principal".
   - `manage-instance` action `create` continua recebendo um nome (agora enviado pelo frontend como "principal" se ausente).

4. Teste
   - Salvar configuração Uazapi pelo drawer sem preencher nome (input removido) e confirmar que o registro é criado/atualizado com `name = 'principal'`.
   - Verificar se webhook de mensagem ainda associa ao usuário correto.

Riscos e observações:
   - Se o usuário quiser ter mais de uma instância por conta, o nome padrão único pode conflitar. Nesta versão, a regra é uma instância por usuário, então "principal" é suficiente.
   - O webhook ainda faz fallback por nome, então se a Uazapi enviar um nome diferente, ele tenta normalizar/match; o nome salvo é corrigido automaticamente após a primeira mensagem.

Nenhuma alteração de schema é necessária.