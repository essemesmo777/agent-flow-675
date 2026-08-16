# Remix of Q7 Pipeline

Crie uma plataforma web completa chamada **Inov4** - uma plataforma de IA para gestão de agentes SDR e Prospecção, com as seguintes especificações:

## 1. AUTENTICAÇÃO E INTEGRAÇÃO SUPABASE

- Configure integração completa com Supabase para autenticação
- Crie tela de login minimalista e moderna com:
  - Logo "Inov4" centralizada no topo (design moderno e profissional)
  - Container elegante com campos de email e senha
  - Botão de login com feedback visual
  - Design responsivo com gradientes sutis e glassmorphism
  - Validação de formulário em tempo real

## 2. ESTRUTURA DO BANCO DE DADOS (Supabase)

Crie as seguintes tabelas:

```sql
-- Tabela de usuários (já existe no Supabase Auth)

-- Tabela de configuração SDR
sdr_config (
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES auth.users,
  nome_agente: text,
  nome_empresa: text,
  telefone_contato: text,
  telefone_transferencia: text,
  papel_agente: text,
  estilo_comunicacao: text,
  processo_qualificacao: text,
  descricao_empresa: text,
  descricao_produtos: text,
  acoes_permitidas: text,
  acoes_proibidas: text,
  created_at: timestamp,
  updated_at: timestamp
)

-- Tabela de configuração de Prospecção
prospeccao_config (
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES auth.users,
  nome_agente: text,
  nome_empresa: text,
  papel_agente: text,
  estilo_comunicacao: text,
  descricao_empresa: text,
  descricao_produtos: text,
  acoes_proibidas: text,
  created_at: timestamp,
  updated_at: timestamp
)

-- Tabela de leads
leads (
  id: uuid PRIMARY KEY,
  user_id: uuid REFERENCES auth.users,
  nome: text,
  email: text,
  telefone: text,
  empresa: text,
  cargo: text,
  status: text,
  qualificado: boolean,
  created_at: timestamp,
)
```

## 3. DASHBOARD PRINCIPAL

Após login, crie dashboard com:
- Header com logo Inov4 e informações do usuário
- Menu lateral fixo com navegação:
  - 🎯 Dashboard (ativo por padrão)
  - 🤖 SDR
  - 📞 Prospecção  
  - 👤 Perfil
  - 🚪 Sair (botão destacado em vermelho no final)
- Cards de métricas com animações:
  - **Total de Leads**: contador animado com ícone
  - **Leads Qualificados**: contador com badge verde
  - **Taxa de Qualificação**: porcentagem com gráfico circular
- Design moderno com cards glassmorphism e micro-interações

## 4. TELA DE CONFIGURAÇÃO SDR

Ao clicar em "SDR" no menu:

**CASO 1: Primeira configuração (não existe no banco)**
- Exibir formulário com todos os campos listados
- Campos agrupados visualmente por categoria
- Validação em tempo real
- Botão "Salvar Configuração" que:
  - Salva no Supabase (tabela sdr_config)
  - Mostra feedback de sucesso
  - Recarrega a página para mostrar o preview

**CASO 2: Configuração existente (recuperar do banco)**
- Buscar dados do usuário logado na tabela sdr_config
- Exibir preview do prompt gerado em container elegante:
  ```
  PREVIEW DO PROMPT GERADO
  [Exibir o prompt formatado baseado nos dados salvos]
  ```
- Botão "Editar Configuração" que permite modificar
- Usar textarea com syntax highlighting para o preview

**Geração do Prompt SDR:**
```
Você é {nome_agente}, um agente SDR da empresa {nome_empresa}.

INFORMAÇÕES DE CONTATO:
- Telefone de atendimento: {telefone_contato}
- Telefone para transferência: {telefone_transferencia}

SEU PAPEL:
{papel_agente}

ESTILO DE COMUNICAÇÃO:
{estilo_comunicacao}

PROCESSO DE QUALIFICAÇÃO:
{processo_qualificacao}

SOBRE A EMPRESA:
{descricao_empresa}

PRODUTOS/SERVIÇOS:
{descricao_produtos}

AÇÕES PERMITIDAS:
{acoes_permitidas}

AÇÕES PROIBIDAS:
{acoes_proibidas}
```

## 5. TELA DE CONFIGURAÇÃO DE PROSPECÇÃO

Ao clicar em "Prospecção" no menu:

**CASO 1: Primeira configuração**
- Formulário com os campos especificados
- Salvar na tabela prospeccao_config

**CASO 2: Configuração existente**
- Exibir preview do prompt gerado
- Opção de editar

**Funcionalidades Adicionais:**

### A) Simulador de Frase
- Container com botão "Simular Frase da IA"
- Ao clicar, gerar uma frase exemplo baseada no prompt configurado
- Usar API do Claude/OpenAI ou gerar frases predefinidas inteligentes
- Animação de "digitando..." antes de mostrar resultado

### B) Upload de Planilha de Leads
- Área de drag-and-drop para upload de CSV/XLSX
- Usar biblioteca para processar planilha (xlsx ou papaparse)
- Validar colunas esperadas: nome, email, telefone, empresa, cargo
- Após upload:
  - Salvar leads na tabela `leads` do Supabase
  - Recarregar página mostrando tabela de leads
  - Tabela com: Nome, Email, Telefone, Empresa, Cargo, Status
  - Funcionalidade de filtro e busca
  - Paginação se houver muitos leads
  - Botões de ação: Editar, Remover, Marcar como qualificado

**Geração do Prompt de Prospecção:**
```
Você é {nome_agente}, responsável pela prospecção ativa da empresa {nome_empresa}.

SEU PAPEL:
{papel_agente}

ESTILO DE COMUNICAÇÃO:
{estilo_comunicacao}

SOBRE A EMPRESA:
{descricao_empresa}

PRODUTOS/SERVIÇOS:
{descricao_produtos}

AÇÕES PROIBIDAS:
{acoes_proibidas}

Sua missão é criar mensagens personalizadas e atrativas para cada lead.
```

## 6. TELA DE PERFIL

- Exibir informações do usuário logado (pegando do Supabase Auth)
- Mostrar: Nome, Email, Data de cadastro
- Card elegante com avatar e informações organizadas
- Opção para "Alterar Senha" (usando funções do Supabase)

## 7. FUNCIONALIDADE DE LOGOUT

- Botão de logout no menu lateral
- Ao clicar, fazer logout do Supabase Auth
- Redirecionar para tela de login
- Limpar estados da aplicação

## 8. REQUISITOS TÉCNICOS

- **Framework**: React com TypeScript
- **Roteamento**: React Router DOM
- **Estilização**: Tailwind CSS
- **Ícones**: Lucide React
- **Backend**: Supabase (Auth + Database)
- **Componentes**: shadcn/ui
- **Upload**: Biblioteca para processar planilhas (xlsx ou papaparse)
- **Estado**: React Hooks (useState, useEffect, Context API para auth)

## 9. DESIGN SYSTEM

- **Cores principais**: 
  - Primary: Azul vibrante (#3B82F6)
  - Secondary: Roxo (#8B5CF6)
  - Success: Verde (#10B981)
  - Danger: Vermelho (#EF4444)
- **Tipografia**: Inter ou Poppins
- **Efeitos**: Glassmorphism, sombras suaves, animações smooth
- **Layout**: Responsivo (mobile-first)

## 10. FLUXO DE NAVEGAÇÃO

```
Login → Dashboard → 
  ├─ SDR (Configurar/Visualizar)
  ├─ Prospecção (Configurar/Visualizar/Upload)
  ├─ Perfil (Visualizar dados)
  └─ Logout
```

## IMPORTANTE:

1. Todas as operações devem ter loading states
2. Feedback visual para todas as ações (toast notifications)
3. Tratamento de erros elegante
4. Validação de formulários completa
5. Proteção de rotas (só acessa se estiver logado)
6. Dados sempre sincronizados com Supabase
7. Interface totalmente responsiva
8. Animações suaves e micro-interações

Crie uma aplicação moderna, profissional e totalmente funcional com todas essas especificações.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://agent-flow-675.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/32e28249-e10b-4c7f-a1b2-ad058797e972).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
