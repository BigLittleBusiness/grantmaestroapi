# Grant Maestro API

The backend API for Grant Maestro, built with Node.js, Express and Sequelize (MySQL).

## Tech Stack

- **Framework:** Express.js (ES modules)
- **Database:** MySQL 8 via Sequelize (MariaDB 10.4+ also works for local development)
- **Authentication:** JWT in HTTP-only cookies
- **Payments:** Stripe hosted Checkout with Stripe Tax for Australian GST; Pin Payments as a fallback provider
- **Email:** Amazon SES (`nodemailer` + `@aws-sdk/client-ses`, Pug templates in `src/emails`)
- **File storage:** Amazon S3 (`multer-s3`)
- **Bot protection:** Cloudflare Turnstile on public forms

## Prerequisites

- Node.js 22.x
- MySQL 8.0+ (or MariaDB 10.4+) with an empty database for the app
- For payments, email and uploads: a Stripe account, and AWS SES and S3

## Local Development Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Configure the environment**
   ```bash
   cp config/config.env.example config/config.env
   ```
   Fill in the database connection, `JWT_SECRET`, `SETTINGS_ENCRYPTION_KEY` (exactly 32 characters) and `SETTINGS_ENCRYPTION_IV` (exactly 16 characters). To create the first Platform Admin, set `SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`. `config.env.example` documents every variable.

3. **Create the schema and seed data** (the database named by `DB_NAME` must already exist)
   ```bash
   npm run db:setup
   ```

4. **Start the API**
   ```bash
   npm run dev     # nodemon, restarts on changes
   npm start       # plain node
   ```
   The API listens on `PORT` (3001 locally, because the React dev server uses 3000). Check it with `GET /api/health`.

5. **Configure integrations** by logging in as the Platform Admin:
   - **Payment Settings:** Stripe keys (see [Stripe Billing And GST](#stripe-billing-and-gst)).
   - **Email Settings:** SES keys and sender address.

   Secrets saved here are stored encrypted with `SETTINGS_ENCRYPTION_KEY`/`IV`.

Swagger UI is served at `/api-docs` (e.g. `http://localhost:3001/api-docs`).

## npm Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` / `npm start` | Run the API with or without nodemon |
| `npm run db:setup` | `db:migrate`, then `db:seed` |
| `npm run db:migrate` | Apply pending migrations (`-- --status` lists them) |
| `npm run db:seed` | Insert missing reference data and the Platform Admin |
| `npm run stripe:setup` | Link Stripe prices to the plans (`-- --dry-run` to preview) |
| `npm run notifications:run` | Run the daily notification jobs once. This sends real emails. |
| `npm test` | Run all smoke tests (the `test:*` scripts) |

## Project Layout

```
config/          config.env (local, git-ignored) and config.env.example
data/            reference data SQL used by the seeders
db/              migrate.js, seed.js, migrations/, seeders/
scripts/         Stripe setup, smoke tests, deploy/infra shell scripts
src/
  index.js       Express app: security headers, rate limits, CORS, routes, Swagger
  env.js         loads config/config.env (or CONFIG_ENV_PATH)
  controllers/   route handlers
  routes/v1/     API routes, mounted at /v1
  models/        Sequelize models; base.js defines associations
  emails/        Pug email templates
  utils/         billing, Stripe, settings, mail, S3 and access-control helpers
  scheduledJobs.js  daily reminder emails (08:00 Australia/Sydney)
terraform/       backend infrastructure (ECS, RDS, ALB, S3, Secrets Manager)
terraform-state/ shared state buckets, Route53 zone and SES domain identity
```

## Roles

Role IDs are fixed in `src/utils/routeAccessHelper.js`, which also lists which roles may call each protected route. Unlisted routes are denied.

| ID | Role | Notes |
| --- | --- | --- |
| 1 | Organisation Admin | Created by public registration; manages the organisation, team and billing |
| 2 | Platform Admin | Platform settings, plans, promo codes; only in the "GrantMaestro Platform" organisation |
| 3 | Team Member | |
| 4 | Acquittal Contributor | Contributes to grant reporting without admin rights |

## Database: Migrations And Seed Data

- `npm run db:migrate` applies each file in `db/migrations` once, in filename order, and records it in `grant_schema_migrations`.
  - The first migration creates every table from the Sequelize models.
  - The later ones are idempotent upgrades for databases created by older versions.
  - To change the schema, update the model and add a migration named `<YYYYMMDDHHmm>-<description>.js` that exports `up({ connection })`. `connection` is a mysql2 promise connection, and `db/migrations/helpers.js` provides `addColumnIfMissing`.
- `npm run db:seed` runs every seeder in `db/seeders`, each in its own transaction. Seeders only insert missing rows, so they are safe to re-run and never overwrite data edited in the app. They load:
  - the four roles above;
  - countries, states, positions and grant categories from `data/*.sql`;
  - the plans Starter (1), Pro (2) and Enterprise (3). The frontend registration form uses these IDs, and `npm run stripe:setup` syncs their prices from Stripe;
  - the Platform Admin from `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD`, skipped when these are unset.

On startup the API also creates any missing tables, but it never alters existing ones, so schema changes need a migration. Creating the schema on a new database takes a few minutes, because each foreign key is added separately.

## Stripe Billing And GST

Customers subscribe through Stripe hosted Checkout on the GrantMaestro products in Stripe:

- Starter, Professional and Enterprise;
- monthly and yearly (yearly = 10 × monthly);
- an extra-seat price for each plan and interval.

Prices are GST-exclusive. Stripe Tax adds 10% GST when the billing address is in Australia, including on every renewal. Organisations outside Australia are not charged GST. Customers can enter an ABN at checkout.

Per environment (test keys for local/UAT, live keys for production):

1. **Platform Admin → Payment Settings → Stripe:** save the publishable and secret keys, and enable Stripe checkout.
2. **Stripe Dashboard → Tax:** complete the tax settings and add an active **Australia** registration. In live mode, add it yourself against the business ABN. Checkout stays disabled until the registration exists, so it can never take an Australian payment without GST.
3. **Link the prices:** run `npm run stripe:setup`. It is idempotent; `-- --dry-run` previews it. In test mode it also creates the Australian registration if it is missing.
   - It matches products named `GrantMaestro <Starter|Professional|Enterprise> - <Monthly|Yearly>[ extra seat]`.
   - It assigns the lookup keys `grantmaestro_<starter|pro|enterprise>_[seat_]<month|year>` and marks the prices GST-exclusive.
   - It copies the prices into `grant_subscription_plans`.

   Run it again whenever prices change in Stripe.
4. **Stripe Dashboard → Developers → Webhooks:**
   - Add `https://<api-host>/v1/subscription/stripe-webhook`, listening for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `customer.subscription.updated` and `customer.subscription.deleted`.
   - Save the signing secret in Payment Settings.
   - Renewals and cancellations are only applied when these events arrive. Locally, use `stripe listen --forward-to localhost:3001/v1/subscription/stripe-webhook`.
5. To show the ABN on Stripe tax invoices, add it in Stripe Dashboard → Settings → Business → Tax details.

How subscriptions behave:

- A payment gives the whole organisation access until the end of the paid period, plus 3 days' grace for renewal retries.
- A cancelled or unpaid subscription ends access on the day it ends.
- Changing plan or seat count after subscribing is not self-service yet; the checkout asks existing subscribers to contact support.
- The Stripe account is shared with other products, so the webhook only acts on objects whose metadata has `platform=grantmaestro`.

When Stripe is not enabled, checkout falls back to Pin Payments. Its keys are set in Payment Settings → Pin Payments.

## Email (SES)

Email settings are resolved in this order: the Platform Admin's Email Settings page, then `config.env` (`AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`, `AWS_SES_REGION`, `FROM_EMAIL`, `FROM_NAME`). Without static keys, the ECS task role is used; it has SES send permission.

If nothing is configured, emails are skipped and a warning is logged, so signup and other flows keep working. The "Send Test Email" button uses the same configuration.

Keep in mind:

- The sender must be an SES-verified identity. Use an address on a verified domain, e.g. `noreply@grantmaestro.com`. The domain is verified via `terraform-state/`. A Gmail sender fails Gmail's sender checks, so its messages tend to land in spam.
- While the SES account is in sandbox mode, AWS only delivers to verified recipient addresses. Request production access in the SES console before launch.

## File Storage (S3)

Uploads go to `AWS_S3_BUCKET`, using static keys from `config.env` or, in ECS, the task role (which has S3 read/write/delete). Without either, uploads are accepted but not stored. `CLOUDFRONT_DOMAIN` optionally serves files through CloudFront.

## Testing

```bash
npm test
```

Runs the smoke tests in `scripts/*SmokeTest.js`. The contact-release test also checks the frontend repository, which it expects next to this one as `frontend/` or `grantmaestroui/`.

## AWS Deployment

GrantMaestro is deployed in the same localhost-first style as GrantThrive:

- Terraform is applied manually from a local machine using the `grantmaestro` AWS profile.
- GitHub Actions does not manage Terraform; it only builds and pushes the backend image and rolls ECS after infrastructure exists.
- UAT uses `https://api.uat.grantmaestro.com`. Production uses `https://api.grantmaestro.com`.
- Route53 manages DNS for `grantmaestro.com`.
- ECS/Fargate runs the API. RDS MySQL stores application data. Runtime configuration comes from Secrets Manager.
- SES domain verification, DKIM and MAIL FROM DNS are managed in the shared Terraform state stack.

### Terraform State And Shared DNS

The shared state stack lives in `terraform-state/`. It manages the remote state buckets, DynamoDB lock table, Route53 zone, baseline DNS records and SES domain identity.

```bash
AWS_PROFILE=grantmaestro scripts/infra.sh state plan
AWS_PROFILE=grantmaestro scripts/infra.sh state apply
```

After bootstrap, the state is stored remotely at:

- Backend state bucket: `grantmaestro-terraform-state-backend-434978747146`
- Frontend state bucket: `grantmaestro-terraform-state-frontend-434978747146`
- Lock table: `grantmaestro-terraform-locks`
- State-management key: `state-management/terraform.tfstate`

On a new machine, run `AWS_PROFILE=grantmaestro scripts/infra.sh state plan` first. A healthy setup shows no changes and must not try to recreate buckets, locks, Route53 or SES resources.

### Backend Infrastructure

```bash
AWS_PROFILE=grantmaestro scripts/infra.sh uat plan
AWS_PROFILE=grantmaestro scripts/infra.sh uat apply

AWS_PROFILE=grantmaestro scripts/infra.sh prod plan
AWS_PROFILE=grantmaestro scripts/infra.sh prod apply
```

Environment settings live in `terraform/terraform.uat.tfvars` and `terraform/terraform.prod.tfvars`. The backend stack manages ECS, ECR, RDS, Redis, Secrets Manager app config, ALB listeners/rules, S3 app storage, ACM validation and API DNS records.

### Backend Deploy

```bash
AWS_PROFILE=grantmaestro scripts/deploy.sh uat --region ap-southeast-2
AWS_PROFILE=grantmaestro scripts/deploy.sh prod --region ap-southeast-2
```

The deploy script:

1. builds and pushes the Docker image;
2. initialises the RDS logical database if needed;
3. forces an ECS rollout and waits for the service to be stable;
4. runs `node db/migrate.js && node db/seed.js` as a one-off ECS task.

The Platform Admin seeder only runs where `SEED_ADMIN_EMAIL`/`SEED_ADMIN_PASSWORD` are set. After the first deploy to an environment, run `npm run stripe:setup` against its database with that environment's Stripe keys.
