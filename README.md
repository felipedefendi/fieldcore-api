# FieldCore API

API de gestão de ordens de serviço, manutenção e técnicos em campo — para empresas de
manutenção industrial, elétrica, climatização, TI ou predial que ainda coordenam chamados
por planilha/WhatsApp.

🔗 **Swagger:** `/api/docs` (após rodar localmente) · **Deploy:** _(adicionar após o deploy)_

## 📋 O problema que resolve

Empresas de serviço técnico de campo perdem visibilidade de SLA, não rastreiam custo de peças
por ordem de serviço e não têm histórico de manutenção por equipamento. A FieldCore API
centraliza clientes → equipamentos → ordens de serviço → status, com:

- **Isolamento multi-tenant real** — cada empresa só acessa seus próprios dados (testado: uma
  empresa não vê nem por ID direto os recursos de outra — retorna `404`, não `403`, para não
  nem revelar que o recurso existe)
- **Máquina de estados** para o ciclo de vida da ordem de serviço (transições inválidas são
  rejeitadas com `422`)
- **RBAC por papel** (Super Admin / Admin / Gestor / Técnico / Cliente externo)
- **JWT com access + refresh token**, com rotação e bloqueio de reuso

O planejamento técnico completo está em [`PLANNING.md`](./PLANNING.md).

## 🛠️ Stack

- **Node.js + TypeScript + NestJS** — arquitetura modular (controller → service → DTO → Prisma)
- **PostgreSQL + Prisma ORM** — migrations versionadas
- **JWT** (`@nestjs/jwt` + `passport-jwt`) — access token curto + refresh token rotacionado
- **Docker + Docker Compose** — Postgres, Adminer e a própria API
- **Swagger/OpenAPI** — documentação interativa em `/api/docs`
- **Jest** — testes unitários da lógica de negócio (máquina de estados, parsing de datas)
- **Zod** — validação de variáveis de ambiente no boot
- **ESLint + Prettier**

## 🏗️ Arquitetura

```mermaid
erDiagram
    Company ||--o{ User : possui
    Company ||--o{ Customer : possui
    Company ||--o{ Equipment : possui
    Company ||--o{ WorkOrder : possui
    Customer ||--o{ Equipment : tem
    Customer ||--o{ WorkOrder : solicita
    Equipment ||--o{ WorkOrder : "historico de"
    User ||--o{ RefreshToken : possui
    User ||--o{ WorkOrder : cria
```

Toda entidade carrega `companyId`; nenhuma query confia em `companyId` vindo do client — ele
sempre vem do JWT do usuário autenticado (`@CurrentUser()` + `requireCompanyId()`).

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
> containerizada).

### Usuários de teste (criados pelo `npm run seed`)

| Papel | Email | Senha |
|---|---|---|
| SUPER_ADMIN | `super@fieldcore.dev` | `Senha123!` |
| ADMIN (empresa demo) | `admin@fieldcore.dev` | `Senha123!` |

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

**Mudar o status (a maquina de estados valida a transicao):**
```bash
curl -X PATCH http://localhost:3000/work-orders/<id>/status \
  -H "Authorization: Bearer <accessToken>" \
  -H "Content-Type: application/json" \
  -d '{"status":"EM_ANDAMENTO"}'
```

## 🗺️ Roadmap

- [x] **MVP** — Auth (login/refresh/logout), Company, User+Role, Customer, Equipment, WorkOrder
      com maquina de estados basica, Docker Compose, Swagger, testes unitarios
- [ ] **Intermediaria** — Technician + atribuicao de OS, Parts + calculo de custo, SLA
      (calculo + flag de estourado), Comments, WorkOrderStatusHistory
- [ ] **Avancada** — Attachments, AuditLog automatico, Reports (SLA/custos/performance),
      paginacao/filtros em todas as listas, CI no GitHub Actions
- [ ] **Futuro** — Portal do cliente externo, notificacoes de SLA, exportacao CSV/PDF

Planejamento completo de cada fase em [`PLANNING.md`](./PLANNING.md).

## ✅ Qualidade

15 testes unitarios cobrindo a maquina de estados da OS, parsing de duracoes JWT e as
funcoes de dominio. Isolamento multi-tenant e RBAC validados manualmente ponta a ponta
(login, CRUD, transicoes de status validas/invalidas, cross-tenant isolation).

---

Feito por [Felipe Defendi](https://portfolio-felipe-sigma-jade.vercel.app).
