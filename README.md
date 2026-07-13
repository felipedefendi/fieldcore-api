# FieldCore API

API de gestão de ordens de serviço, manutenção e técnicos em campo — para empresas de
manutenção industrial, elétrica, climatização, TI ou predial que ainda coordenam chamados
por planilha/WhatsApp.

🔗 **Swagger:** `/api/docs` · **Deploy:** https://fieldcore-api.onrender.com/api/docs

## 📋 O problema que resolve

Empresas de serviço técnico de campo perdem visibilidade de SLA, não rastreiam custo de peças
por ordem de serviço e não têm histórico de manutenção por equipamento. A FieldCore API
centraliza clientes → equipamentos → ordens de serviço → técnicos → peças → custo, com:

- **Isolamento multi-tenant real** — cada empresa só acessa seus próprios dados (testado com
  integração automatizada: uma empresa não vê nem por ID direto os recursos de outra — retorna
  `404`, não `403`, para não nem revelar que o recurso existe)
- **Máquina de estados** para o ciclo de vida da ordem de serviço (transições inválidas são
  rejeitadas com `422`)
- **RBAC por papel** (Super Admin / Admin / Gestor / Técnico / Cliente externo) — técnico só
  acessa as ordens de serviço atribuídas a ele
- **SLA calculado por prioridade** (com flag de estourado) e **custo total** (peças com preço
  congelado no momento do uso + mão de obra), ambos como funções puras e testadas
- **Histórico de status** registrado automaticamente a cada mudança
- **JWT com access + refresh token**, com rotação e bloqueio de reuso

O planejamento técnico completo está em [`PLANNING.md`](./PLANNING.md).

## 🛠️ Stack

- **Node.js + TypeScript + NestJS** — arquitetura modular (controller → service → DTO → Prisma)
- **PostgreSQL + Prisma ORM** — migrations versionadas
- **JWT** (`@nestjs/jwt` + `passport-jwt`) — access token curto + refresh token rotacionado
- **Docker + Docker Compose** — Postgres, Adminer e a própria API
- **Swagger/OpenAPI** — documentação interativa em `/api/docs`
- **Jest** — testes unitários (lógica de negócio) e de integração (e2e, contra Postgres real)
- **Zod** — validação de variáveis de ambiente no boot
- **ESLint + Prettier**

## 🏗️ Arquitetura

```mermaid
erDiagram
    Company ||--o{ User : possui
    Company ||--o{ Customer : possui
    Company ||--o{ Equipment : possui
    Company ||--o{ WorkOrder : possui
    Company ||--o{ Technician : possui
    Company ||--o{ Part : possui
    Customer ||--o{ Equipment : tem
    Customer ||--o{ WorkOrder : solicita
    Equipment ||--o{ WorkOrder : "historico de"
    Technician ||--o{ WorkOrder : atende
    WorkOrder ||--o{ WorkOrderPart : usa
    WorkOrder ||--o{ Comment : recebe
    WorkOrder ||--o{ WorkOrderStatusHistory : registra
    Part ||--o{ WorkOrderPart : "usada em"
    User ||--o{ RefreshToken : possui
    User ||--o{ WorkOrder : cria
```

Toda entidade carrega `companyId`; nenhuma query confia em `companyId` vindo do client — ele
sempre vem do JWT do usuário autenticado (`@CurrentUser()` + `requireCompanyId()`). SLA e custo
total nunca são armazenados: são sempre recalculados na resposta a partir de funções puras
(`sla.ts`, `cost.ts`), evitando que o dado fique desatualizado.

## 🚀 Como rodar localmente

```bash
cp .env.example .env
# edite os segredos JWT no .env se quiser

docker compose up postgres adminer -d
npx prisma migrate dev
npm run seed

npm run start:dev
```

A API sobe em `http://localhost:3000`, com Swagger em `http://localhost:3000/api/docs` e
Adminer (interface do Postgres) em `http://localhost:8080`.

> Alternativa: `docker compose up` sobe **tudo** (Postgres + Adminer + a própria API
> containerizada) — o próprio container roda `prisma migrate deploy` antes de iniciar.

### Usuários de teste (criados pelo `npm run seed`)

| Papel | Email | Senha |
|---|---|---|
| SUPER_ADMIN | `super@fieldcore.dev` | `Senha123!` |
| ADMIN (empresa demo) | `admin@fieldcore.dev` | `Senha123!` |
| TECNICO (empresa demo) | `tecnico@fieldcore.dev` | `Senha123!` |

## 🔑 Variáveis de ambiente

| Variável | Obrigatória | Exemplo |
|---|---|---|
| `DATABASE_URL` | sim | `postgresql://fieldcore:fieldcore@localhost:5432/fieldcore` |
| `JWT_ACCESS_SECRET` | sim | string aleatória forte |
| `JWT_ACCESS_EXPIRES_IN` | não (default `15m`) | `15m` |
| `JWT_REFRESH_SECRET` | sim | string aleatória forte (diferente da de acesso) |
| `JWT_REFRESH_EXPIRES_IN` | não (default `7d`) | `7d` |
| `PORT` | não (default `3000`) | `3000` |
| `CORS_ORIGIN` | não (default `*`) | `http://localhost:3000` |

## 📦 Comandos principais

```bash
npm run start:dev     # dev com hot-reload
npm run build          # build de producao
npm run lint            # eslint --fix
npm test                 # testes unitarios (jest)
npm run test:e2e          # testes de integracao (contra o Postgres real)
npx prisma studio         # explorar o banco visualmente
npx prisma migrate dev     # criar/aplicar uma nova migration
npm run seed                # popular dados de demonstracao
```

## 📡 Exemplos de uso

**Login:**
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@fieldcore.dev","password":"Senha123!"}'
```

**Criar uma ordem de serviço (com o access token retornado acima):**
```bash
curl -X POST http://localhost:3000/work-orders \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"customerId":"...","equipmentId":"...","priority":"ALTA","description":"Ar-condicionado nao gela"}'
```

**Atribuir um técnico:**
```bash
curl -X PATCH http://localhost:3000/work-orders/<id>/assign \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"technicianId":"..."}'
```

**Mudar o status (a máquina de estados valida a transição):**
```bash
curl -X PATCH http://localhost:3000/work-orders/<id>/status \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"status":"EM_ANDAMENTO"}'
```

**Registrar peça usada (preço congelado no momento do uso):**
```bash
curl -X POST http://localhost:3000/work-orders/<id>/parts \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"partId":"...","quantity":2}'
```

## 🗺️ Roadmap

- [x] **MVP** — Auth (login/refresh/logout), Company, User+Role, Customer, Equipment, WorkOrder
      com máquina de estados básica, Docker Compose, Swagger, testes unitários
- [x] **Intermediária** — Technician + atribuição de OS, Parts + cálculo de custo, SLA
      (cálculo + flag de estourado), Comments, WorkOrderStatusHistory, RBAC completo
      (escopo do técnico) e testes de integração cobrindo isolamento multi-tenant
- [ ] **Avançada** — Attachments, AuditLog automático, Reports (SLA/custos/performance),
      paginação/filtros em todas as listas, CI no GitHub Actions
- [ ] **Futuro** — Portal do cliente externo, notificações de SLA, exportação CSV/PDF

Planejamento completo de cada fase em [`PLANNING.md`](./PLANNING.md).

## ✅ Qualidade

27 testes unitários (máquina de estados, SLA, custo, parsing de duração JWT) + 12 testes de
integração end-to-end rodando contra um Postgres real, provando na prática:

- Isolamento multi-tenant (uma empresa nunca vê dado de outra, nem por ID direto)
- RBAC — técnico só acessa as próprias ordens de serviço atribuídas
- Cálculo correto de SLA (por prioridade) e de custo total (peças + mão de obra)
- Transições de status inválidas rejeitadas, histórico registrado automaticamente

---

Feito por [Felipe Defendi](https://portfolio-felipe-sigma-jade.vercel.app).
