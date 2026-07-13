# FieldCore API — Planejamento Técnico

API de gestão de ordens de serviço, manutenção e técnicos em campo. Projeto 2 do portfólio de
Felipe Defendi (foco 100% backend — complementa o FutScoreStats, que é full-stack).

> **Status:** planejamento aprovado, implementação ainda não iniciada.
> Quando for começar, siga o roadmap da seção 12, fase por fase.

---

## 1. Visão geral do produto

**Problema:** empresas de serviço técnico de campo (manutenção industrial, elétrica,
climatização, TI, elevadores, máquinas) ainda coordenam chamados por WhatsApp/planilha. Isso
gera SLA estourado sem ninguém perceber, técnico sem histórico do equipamento na mão, custo de
peça não rastreado, sem auditoria de quem mudou o quê.

**O que a API resolve:** centraliza clientes → equipamentos → chamados → ordens de serviço →
técnicos → peças → custo → relatório, com controle de acesso por empresa (multi-tenant) e por
papel.

**Por que é forte pra portfólio:** ao contrário de um CRUD genérico ("todo list API"), este
domínio força a demonstrar exatamente o que entrevistador de backend testa:
- **Máquina de estados** real (status da OS não pode pular etapa à toa)
- **Isolamento multi-tenant** (empresa A nunca vê dado da empresa B)
- **RBAC granular** (técnico só vê o que é dele)
- **Regra de negócio com cálculo** (SLA por prioridade, custo = peças + mão de obra)
- **Auditoria** (rastreabilidade de mudanças, algo que toda empresa séria exige)

---

## 2. Funcionalidades principais

| Módulo | Funcionalidades |
|---|---|
| **Auth** | Registro (só admin cria usuário, sem self-signup público), login, refresh token, logout |
| **Empresas** | CRUD de empresa (só Super Admin), ativar/desativar |
| **Usuários/Papéis** | CRUD de usuários da empresa, atribuição de papel |
| **Clientes** | CRUD de clientes da empresa |
| **Técnicos** | CRUD de técnicos, especialidade, disponibilidade |
| **Equipamentos** | CRUD de equipamentos vinculados a um cliente |
| **Chamados (Service Request)** | Abertura de chamado, conversão em OS |
| **Ordens de Serviço** | Criação, atribuição de técnico, mudança de status, prioridade, SLA |
| **Peças** | Catálogo de peças, registro de uso na OS |
| **Comentários** | Internos (equipe) vs visíveis ao cliente |
| **Anexos** | Upload de evidência (foto, PDF) vinculado à OS |
| **Histórico** | Linha do tempo de status por OS; histórico de manutenção por equipamento |
| **Relatórios** | SLA cumprido/estourado, custo por período, OS por técnico, tempo médio de resolução |
| **Auditoria** | Log de ações sensíveis (mudança de status, permissão, exclusão) |

---

## 3. Regras de negócio

**Acesso**
- Toda rota (exceto login) exige JWT válido.
- Toda entidade tem `companyId`; toda query é automaticamente filtrada pelo `companyId` do
  usuário logado (via Guard/Interceptor — nunca confiar em `companyId` vindo do client).
- `SUPER_ADMIN` é a única exceção (acesso cross-company, só pra gestão da plataforma).
- Técnico só enxerga OS onde `technicianId = self`. Tentativa de acessar OS de outro técnico → `403`.

**Máquina de estados da OS**
```
ABERTA → EM_ANDAMENTO → PAUSADA ⇄ EM_ANDAMENTO → CONCLUIDA
ABERTA → CANCELADA
EM_ANDAMENTO → CANCELADA
```
- Transições fora dessa matriz são rejeitadas (`422`).
- `CONCLUIDA` é terminal: só `ADMIN` pode reabrir, e isso gera entrada obrigatória em `AuditLog`.

**SLA**
- Prazo calculado na abertura: `slaDueAt = openedAt + horasPorPrioridade(priority)`.
  - URGENTE = 4h · ALTA = 8h · MEDIA = 24h · BAIXA = 72h (configurável por empresa no futuro).
- Campo derivado `slaBreached`: `true` se `resolvedAt > slaDueAt` (ou `now() > slaDueAt`
  enquanto aberta).

**Custo**
- `custoPecas = Σ (quantidade × precoUnitarioNaEpoca)` — o preço é **congelado** no momento do
  uso (`WorkOrderPart.unitPriceAtUse`), não recalculado se o catálogo mudar depois (senão o
  histórico financeiro "muda sozinho" — erro clássico).
- `custoTotal = custoPecas + custoMaoDeObra` (`horasTrabalhadas × valorHora` ou valor fixo).

**Outras**
- Equipamento sempre carrega seu histórico de manutenção (todas as OS vinculadas a ele).
- Toda mudança de status, exclusão ou alteração de permissão gera `AuditLog` (quem, quando, o
  quê, valor anterior/novo).

---

## 4. Perfis de usuário

| Papel | Escopo | Pode |
|---|---|---|
| **SUPER_ADMIN** | Plataforma inteira | Criar/gerenciar empresas, ver métricas globais. Não opera dados de negócio do dia a dia. |
| **ADMIN** (da empresa) | 1 empresa | Tudo dentro da empresa: usuários, técnicos, clientes, equipamentos, OS, relatórios, reabrir OS concluída |
| **GESTOR** | 1 empresa | Chamados, OS, atribuição de técnico, relatórios. **Não** gerencia usuários/permissões |
| **TECNICO** | Próprias OS | Vê e atualiza status/comentário/peças **só** das OS atribuídas a ele. Não vê custo (configurável) nem OS de outros |
| **CLIENTE_EXTERNO** *(stretch, fase avançada)* | Próprios chamados | Abre chamado, acompanha status, vê comentários não-internos. Não vê custo nem dados de outros clientes |

---

## 5. Modelagem do banco de dados

**Relacionamentos-chave:**
- `Company` 1—N tudo (Users, Customers, Technicians, Equipment, ServiceRequests, WorkOrders,
  Parts, AuditLogs) → base do isolamento multi-tenant.
- `Customer` 1—N `Equipment`, 1—N `ServiceRequest`, 1—N `WorkOrder`.
- `Equipment` 1—N `WorkOrder` (histórico de manutenção).
- `Technician` 1—N `WorkOrder` (atribuições).
- `WorkOrder` 1—N `WorkOrderStatusHistory`, 1—N `WorkOrderPart`, 1—N `Comment`, 1—N `Attachment`.
- `Part` 1—N `WorkOrderPart`.
- `User` 1—1 `Technician` (opcional — só quando o papel é TECNICO).

Sketch ilustrativo (Prisma-like, refinar na implementação):

```prisma
model Company {
  id        String   @id @default(cuid())
  name      String
  document  String   @unique // CNPJ
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
}

model User {
  id            String     @id @default(cuid())
  companyId     String?    // null só para SUPER_ADMIN
  name          String
  email         String     @unique
  passwordHash  String
  role          Role
  isActive      Boolean    @default(true)
  technician    Technician?
  createdAt     DateTime   @default(now())
}

enum Role {
  SUPER_ADMIN
  ADMIN
  GESTOR
  TECNICO
  CLIENTE_EXTERNO
}

model Customer {
  id        String   @id @default(cuid())
  companyId String
  name      String
  document  String
  email     String?
  phone     String?
  address   String?
  equipment Equipment[]
  createdAt DateTime @default(now())
}

model Technician {
  id         String   @id @default(cuid())
  companyId  String
  userId     String   @unique
  specialty  String?
  isActive   Boolean  @default(true)
}

model Equipment {
  id           String   @id @default(cuid())
  companyId    String
  customerId   String
  name         String
  type         String
  brand        String?
  serialNumber String?
  installedAt  DateTime?
}

model ServiceRequest {
  id          String   @id @default(cuid())
  companyId   String
  customerId  String
  equipmentId String?
  title       String
  description String
  priority    Priority
  status      ServiceRequestStatus @default(OPEN)
  createdByUserId String
  createdAt   DateTime @default(now())
}

enum Priority { BAIXA MEDIA ALTA URGENTE }
enum ServiceRequestStatus { OPEN CONVERTED CANCELLED }

model WorkOrder {
  id               String   @id @default(cuid())
  companyId        String
  serviceRequestId String?
  customerId       String
  equipmentId      String
  technicianId     String?
  priority         Priority
  status           WorkOrderStatus @default(ABERTA)
  slaDueAt         DateTime
  openedAt         DateTime @default(now())
  startedAt        DateTime?
  resolvedAt       DateTime?
  closedAt         DateTime?
  laborHours       Decimal? @default(0)
  laborCost        Decimal? @default(0)
  description      String
  createdByUserId  String
  statusHistory    WorkOrderStatusHistory[]
  parts            WorkOrderPart[]
  comments         Comment[]
  attachments      Attachment[]
}

enum WorkOrderStatus { ABERTA EM_ANDAMENTO PAUSADA CONCLUIDA CANCELADA }

model WorkOrderStatusHistory {
  id            String   @id @default(cuid())
  workOrderId   String
  fromStatus    WorkOrderStatus?
  toStatus      WorkOrderStatus
  changedByUserId String
  note          String?
  changedAt     DateTime @default(now())
}

model Part {
  id           String   @id @default(cuid())
  companyId    String
  name         String
  sku          String
  unitPrice    Decimal
  stockQty     Int?     @default(0)
}

model WorkOrderPart {
  id             String   @id @default(cuid())
  workOrderId    String
  partId         String
  quantity       Int
  unitPriceAtUse Decimal  // congelado no momento do uso
}

model Comment {
  id          String   @id @default(cuid())
  workOrderId String
  authorUserId String
  body        String
  isInternal  Boolean  @default(true)
  createdAt   DateTime @default(now())
}

model Attachment {
  id             String   @id @default(cuid())
  workOrderId    String
  uploadedByUserId String
  fileUrl        String
  fileName       String
  mimeType       String
  sizeBytes      Int
  createdAt      DateTime @default(now())
}

model AuditLog {
  id         String   @id @default(cuid())
  companyId  String
  userId     String
  action     String   // ex.: "WORK_ORDER_STATUS_CHANGED"
  entityType String
  entityId   String
  metadata   Json?
  createdAt  DateTime @default(now())
}
```

Campos obrigatórios em destaque: `companyId` em quase tudo (base do tenant isolation),
`status`/`priority` sempre com default, `unitPriceAtUse` congelado (não é FK "viva" pro preço
atual).

---

## 6. Endpoints da API (por módulo)

**Auth**

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| POST | `/auth/login` | Login (email+senha) → access+refresh token | Público |
| POST | `/auth/refresh` | Renova access token | Refresh token válido |
| POST | `/auth/logout` | Invalida refresh token | Autenticado |

**Companies**

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| POST | `/companies` | Cria empresa | SUPER_ADMIN |
| GET | `/companies` | Lista empresas | SUPER_ADMIN |
| PATCH | `/companies/:id` | Ativa/edita empresa | SUPER_ADMIN |

**Users**

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| POST | `/users` | Cria usuário na empresa. Payload: `{name, email, password, role}` | ADMIN |
| GET | `/users` | Lista usuários da empresa | ADMIN, GESTOR |
| PATCH | `/users/:id/role` | Muda papel (gera AuditLog) | ADMIN |
| DELETE | `/users/:id` | Desativa usuário | ADMIN |

**Customers**

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| POST | `/customers` | Cria cliente | ADMIN, GESTOR |
| GET | `/customers?search=&page=` | Lista com busca/paginação | ADMIN, GESTOR |
| GET | `/customers/:id` | Detalhe + equipamentos | ADMIN, GESTOR |
| PATCH | `/customers/:id` | Edita | ADMIN, GESTOR |

**Technicians**

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| POST | `/technicians` | Cria técnico (vincula a um User) | ADMIN |
| GET | `/technicians` | Lista técnicos | ADMIN, GESTOR |
| GET | `/technicians/:id/work-orders` | OS atribuídas a ele | ADMIN, GESTOR, TECNICO (só o próprio) |

**Equipment**

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| POST | `/equipment` | Cadastra equipamento | ADMIN, GESTOR |
| GET | `/equipment/:id/history` | Histórico de manutenção (todas as OS) | ADMIN, GESTOR |

**Service Requests**

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| POST | `/service-requests` | Abre chamado. Payload: `{customerId, equipmentId?, title, description, priority}` | ADMIN, GESTOR, CLIENTE_EXTERNO |
| POST | `/service-requests/:id/convert` | Converte chamado em OS | ADMIN, GESTOR |

**Work Orders**

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| POST | `/work-orders` | Cria OS diretamente | ADMIN, GESTOR |
| GET | `/work-orders?status=&technicianId=&page=` | Lista com filtros/paginação | ADMIN, GESTOR, TECNICO (escopo próprio) |
| GET | `/work-orders/:id` | Detalhe completo (peças, comentários, histórico) | conforme escopo |
| PATCH | `/work-orders/:id/assign` | Atribui técnico. Payload: `{technicianId}` | ADMIN, GESTOR |
| PATCH | `/work-orders/:id/status` | Muda status (valida transição). Payload: `{status, note?}` | ADMIN, GESTOR, TECNICO (próprias) |
| POST | `/work-orders/:id/parts` | Registra peça usada. Payload: `{partId, quantity}` | GESTOR, TECNICO (próprias) |
| POST | `/work-orders/:id/comments` | Comentário. Payload: `{body, isInternal}` | qualquer autenticado no escopo |
| POST | `/work-orders/:id/attachments` | Upload de evidência | GESTOR, TECNICO (próprias) |

**Parts**

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| POST | `/parts` | Cadastra peça no catálogo | ADMIN, GESTOR |
| GET | `/parts` | Lista catálogo | ADMIN, GESTOR, TECNICO |

**Reports**

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| GET | `/reports/sla` | % SLA cumprido vs estourado, por período | ADMIN, GESTOR |
| GET | `/reports/costs?from=&to=` | Custo total por período/cliente | ADMIN |
| GET | `/reports/technician-performance` | OS concluídas, tempo médio por técnico | ADMIN, GESTOR |

**Audit Logs**

| Método | Rota | Descrição | Permissão |
|---|---|---|---|
| GET | `/audit-logs?entityType=&entityId=` | Consulta trilha de auditoria | ADMIN |

---

## 7. Arquitetura do projeto (estrutura de pastas)

```
src/
├── modules/
│   ├── auth/            (controller, service, strategies JWT, guards, dto)
│   ├── companies/
│   ├── users/
│   ├── customers/
│   ├── technicians/
│   ├── equipment/
│   ├── service-requests/
│   ├── work-orders/
│   │   ├── work-orders.controller.ts
│   │   ├── work-orders.service.ts
│   │   ├── work-order-status.state-machine.ts   ← regra de transição isolada
│   │   ├── dto/
│   │   └── entities/
│   ├── parts/
│   ├── reports/
│   └── audit-logs/
├── common/
│   ├── guards/          (JwtAuthGuard, RolesGuard, CompanyScopeGuard)
│   ├── decorators/      (@Roles(), @CurrentUser())
│   ├── interceptors/    (AuditLogInterceptor, TenantScopeInterceptor)
│   ├── filters/         (HttpExceptionFilter global)
│   ├── pipes/           (ValidationPipe config)
│   └── utils/
├── config/              (env validation com Zod/Joi, configuração tipada)
├── database/
│   ├── prisma/          (schema.prisma, migrations, seed.ts)
│   └── prisma.service.ts
├── app.module.ts
└── main.ts

test/
├── unit/                (services e regras de negócio isoladas)
├── integration/         (e2e por módulo, banco de teste real via Docker)
└── fixtures/

docker/
├── Dockerfile
├── docker-compose.yml   (app + postgres + adminer)
└── .dockerignore

.github/workflows/ci.yml (lint + test + build)
```

Cada módulo NestJS segue o padrão: `controller` (rotas) → `service` (regra de negócio) → `dto`
(validação de entrada com `class-validator`/Zod) → Prisma para persistência. O **state machine
de status da OS** fica isolado num arquivo próprio — testável sem precisar subir banco.

---

## 8. Segurança

| Item | Como |
|---|---|
| Autenticação | JWT (access token curto, ~15min) |
| Refresh token | Token de vida longa, armazenado hasheado no banco, rotacionado a cada uso |
| Senha | `bcrypt`/`argon2`, nunca texto puro, nunca retornada em nenhuma resposta |
| RBAC | `@Roles()` decorator + `RolesGuard` checando o papel do JWT |
| Isolamento cross-company | `CompanyScopeGuard`/interceptor que injeta `companyId` do JWT em toda query — o client **nunca** manda `companyId` no payload |
| Validação de input | DTO com `class-validator` (ou Zod) em toda rota — rejeita campo extra/tipo errado antes de chegar no service |
| Rate limiting | `@nestjs/throttler` no login (evita brute-force) e globalmente com limite mais generoso |
| Variáveis de ambiente | `.env` fora do Git, validado no boot (erro claro se faltar `DATABASE_URL`/`JWT_SECRET`) |
| CORS | Origem explícita configurável por ambiente |
| Auditoria | Interceptor que grava `AuditLog` em mutações sensíveis, sem precisar chamar manualmente em cada service |

---

## 9. Testes

| Tipo | Foco |
|---|---|
| **Unitários** | State machine de status da OS; cálculo de SLA; cálculo de custo (peças+mão de obra) |
| **Integração** | Fluxo completo: criar cliente → equipamento → chamado → converter em OS → atribuir técnico → mudar status → concluir |
| **Autenticação** | Login com credenciais erradas (401); token expirado (401); refresh token roubado/reutilizado (invalidação) |
| **Permissões** | Técnico tentando acessar OS de outro técnico (403); usuário da empresa A tentando acessar dado da empresa B (403/404) |
| **Regras de negócio** | Transição de status inválida (`CONCLUIDA → EM_ANDAMENTO` direto) rejeitada; reabrir OS concluída só como ADMIN e gera AuditLog; SLA `breached=true` quando resolvida após o prazo |

Exemplos de casos concretos:
- "Técnico X não pode ver OS atribuída ao Técnico Y" → `GET /work-orders/:id` retorna 403.
- "OS urgente aberta às 10h tem `slaDueAt` = 14h" (regra determinística, testável sem mock de
  tempo real usando injeção de clock).
- "Preço da peça muda no catálogo depois do uso → custo histórico da OS antiga não muda"
  (`unitPriceAtUse` congelado).

---

## 10. Documentação (plano do README)

1. Nome + 1 frase de pitch + badges (build, licença, cobertura de testes)
2. **O problema que resolve** (a dor do negócio, não a stack)
3. Stack e por quê (breve, técnico)
4. Diagrama de arquitetura (PNG simples ou Mermaid no próprio README)
5. Como rodar localmente (`docker compose up`, migrations, seed)
6. Variáveis de ambiente (tabela: nome, obrigatório, exemplo)
7. Comandos principais (`npm run start:dev`, `test`, `test:e2e`, `prisma studio`)
8. Link do Swagger (`/api/docs`) + link do deploy
9. Exemplos de uso (2–3 chamadas curl com resposta)
10. Roadmap (o que tem hoje vs próximo)
11. Prints sugeridos: tela do Swagger, diagrama ER, print do CI passando

---

## 11. Diferenciais para recrutadores

- Paginação + filtros + busca em todas as listagens (`page`, `limit`, `search`, `status`)
- Versionamento de API (`/api/v1/...`)
- Exportação de relatório em CSV
- Logs estruturados (`pino`/`winston`, JSON, correlação por `requestId`)
- Collection do Postman/Insomnia versionada no repo
- CI no GitHub Actions (lint + test + build a cada PR) com badge no README
- Deploy real (Railway/Render/Fly.io — Vercel não roda bem NestJS long-running, melhor um desses)
- Cobertura de testes visível (badge do Codecov ou similar)
- Multi-tenant demonstrado de verdade (seed com 2 empresas, prova em teste que uma não vazou pra outra)

---

## 12. Roadmap de desenvolvimento

**MVP**
- Auth (login/refresh), Company, User+Role, Customer, Equipment
- ServiceRequest → WorkOrder (criação direta, sem conversão ainda)
- Status da OS com state machine básica (sem pausar, só Aberta→Andamento→Concluída/Cancelada)
- Docker Compose + Swagger básico + testes unitários da state machine

**Versão intermediária**
- Technician + atribuição, Parts + WorkOrderPart + cálculo de custo
- SLA (cálculo + flag de estourado), Comments, WorkOrderStatusHistory
- RBAC completo (Guards por papel + isolamento cross-company com teste dedicado)
- Testes de integração dos fluxos principais

**Versão avançada**
- Attachments (upload), AuditLog automático (interceptor)
- Reports (SLA, custos, performance por técnico)
- Paginação/filtros/busca em todas as listas, versionamento `/v1`
- CI no GitHub Actions

**Melhorias futuras**
- CLIENTE_EXTERNO (portal do cliente)
- Notificações (fila/webhook quando SLA perto de estourar)
- Multi-idioma na API, exportação CSV/PDF, dashboard de métricas

---

## 13. Critérios de qualidade

Código limpo e tipado (sem `any`) · commits organizados por fase · README completo ·
tratamento de erro consistente (`HttpExceptionFilter` central, nunca stack trace cru pro
cliente) · validação em toda entrada · testes mínimos cobrindo as regras de negócio críticas ·
`docker compose up` funcionando do zero · Swagger 100% das rotas documentadas com exemplos ·
deploy acessível publicamente · README com "cara de portfólio" (não só instrução técnica seca).

---

## 14. Resultado final esperado / Checklist

- [ ] Visão geral clara do problema resolvido
- [ ] Funcionalidades e regras de negócio definidas
- [ ] Modelagem de banco com relacionamentos e campos obrigatórios
- [ ] Endpoints documentados por módulo com permissão e payload
- [ ] Estrutura de pastas profissional
- [ ] Segurança (JWT, RBAC, isolamento multi-tenant, rate limit) implementada
- [ ] Testes unitários + integração cobrindo regras críticas
- [ ] Docker Compose funcional
- [ ] Swagger completo
- [ ] CI no GitHub Actions
- [ ] Deploy online
- [ ] README "de portfólio"

**Para o GitHub:** README com diagrama, badge de CI, link do Swagger e do deploy logo no topo;
repositório público, commits em português claro (sem "wip", "fix 2", etc).
**Para o LinkedIn:** post curto mostrando o diagrama ER ou um print do Swagger, destacando a
regra de negócio mais "de negócio real" (SLA, isolamento multi-tenant) — é isso que separa esse
projeto de um CRUD de tutorial.
