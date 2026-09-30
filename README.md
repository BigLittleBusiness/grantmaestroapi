# Grant Maestro API

The backend API for Grant Maestro, built with Node.js, Express, and Sequelize (MySQL).

## Prerequisites

- Node.js 22.x
- MySQL 8.0+
- AWS Account (S3 for file storage, SES for email)

## Local Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/BigLittleBusiness/grantmaestroapi.git
   cd grantmaestroapi
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Configuration**
   Copy the example environment file and fill in your local details:
   ```bash
   cp config/config.env.example config/config.env
   ```
   *Note: Ensure your local MySQL server is running and the database specified in `DB_NAME` exists.*

4. **Database Setup**
   The application uses Sequelize ORM. On first boot, it will automatically sync the schema (`sync({ alter: true })`).

5. **Start the server**
   ```bash
   # Development mode (with nodemon)
   npm run dev

   # Production mode
   npm start
   ```

## Tech Stack

- **Framework:** Express.js
- **Database:** MySQL (via Sequelize ORM)
- **Authentication:** JWT (JSON Web Tokens) + HTTP-only cookies
- **File Storage:** Amazon S3 (`multer-s3`)
- **Email:** Amazon SES (`nodemailer` + `@aws-sdk/client-ses`)
- **Payments:** Pin Payments REST API

## API Documentation

Swagger UI documentation is available when the server is running at:
`http://localhost:3000/api-docs`

## AWS Deployment

GrantMaestro is deployed in the same localhost-first style as GrantThrive:

- Terraform is applied manually from a local machine using the `grantmaestro` AWS profile.
- GitHub Actions does not manage Terraform.
- GitHub Actions only builds/pushes the backend image and rolls ECS after infrastructure exists.
- UAT uses `https://api.uat.grantmaestro.com`.
- Production uses `https://api.grantmaestro.com`.
- Route53 manages DNS for `grantmaestro.com`.
- ECS/Fargate runs the API and RDS MySQL stores application data.
- SES domain verification, DKIM, and MAIL FROM DNS are managed in the shared Terraform state stack.

### Terraform State And Shared DNS

The shared state stack lives in `terraform-state/` and manages the remote state buckets, DynamoDB lock table, Route53 zone, baseline DNS records, and SES domain identity.

```bash
AWS_PROFILE=grantmaestro scripts/infra.sh state plan
AWS_PROFILE=grantmaestro scripts/infra.sh state apply
```

After bootstrap, the state is stored remotely at:

- Backend state bucket: `grantmaestro-terraform-state-backend-434978747146`
- Frontend state bucket: `grantmaestro-terraform-state-frontend-434978747146`
- Lock table: `grantmaestro-terraform-locks`
- State-management key: `state-management/terraform.tfstate`

On a new machine, run `AWS_PROFILE=grantmaestro scripts/infra.sh state plan` first. A healthy setup should show no changes and must not try to recreate buckets, locks, Route53, or SES resources.

### Backend Infrastructure

```bash
AWS_PROFILE=grantmaestro scripts/infra.sh uat plan
AWS_PROFILE=grantmaestro scripts/infra.sh uat apply

AWS_PROFILE=grantmaestro scripts/infra.sh prod plan
AWS_PROFILE=grantmaestro scripts/infra.sh prod apply
```

Terraform files for each environment live in:

- `terraform/terraform.uat.tfvars`
- `terraform/terraform.prod.tfvars`

The backend stack manages ECS, ECR, RDS, Redis, Secrets Manager app config, ALB listeners/rules, S3 app storage, ACM validation, and API DNS records.

### Backend Deploy

```bash
AWS_PROFILE=grantmaestro scripts/deploy.sh uat --region ap-southeast-2
AWS_PROFILE=grantmaestro scripts/deploy.sh prod --region ap-southeast-2
```

The deploy script builds and pushes the Docker image, initializes the RDS logical database if needed, forces an ECS rollout, waits for service stability, and runs required seed data.

### Migrations And Seed Data

This app currently does not have a migrations or seeders directory. Schema changes are applied by Sequelize `sync({ alter: true })` during service startup.

The deployment script seeds required data idempotently after the service is stable:

- User roles (IDs match `src/utils/routeAccessHelper.js`): 1 Organisation Admin, 2 Platform Admin, 3 Team Member, 4 Acquittal Contributor
- Subscription plans: Seat by Seat, Pro

### Stripe Billing And GST

Customers subscribe through Stripe hosted Checkout using the GrantMaestro products in Stripe (Starter, Professional, Enterprise; monthly and yearly; plus an extra-seat price for each). Prices are GST-exclusive: Stripe Tax adds 10% GST when the billing address is in Australia, including on every renewal. Organisations outside Australia are not charged GST.

Per environment (test keys for local/UAT, live keys for production):

1. **System Admin → Payment Settings → Stripe**: save the publishable and secret keys and enable Stripe checkout.
2. **Stripe Dashboard → Tax**: complete the tax settings and add an active **Australia** registration. In live mode, add it yourself against the business ABN. Checkout stays disabled until the registration exists, so it can never take an Australian payment without GST.
3. Link the Stripe prices to the app (idempotent; `--dry-run` to preview). In test mode, this also creates the Australian registration if it is missing:
   ```bash
   npm run stripe:setup
   ```
   The script matches products named `GrantMaestro <Starter|Professional|Enterprise> - <Monthly|Yearly>[ extra seat]`, assigns the lookup keys `grantmaestro_<starter|pro|enterprise>_[seat_]<month|year>`, marks them GST-exclusive and copies the prices into `grant_subscription_plans`. Run it again whenever prices change in Stripe.
4. **Stripe Dashboard → Developers → Webhooks**: add `https://<api-host>/v1/subscription/stripe-webhook` with the events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `customer.subscription.updated` and `customer.subscription.deleted`, then save the signing secret in Payment Settings. Renewals and cancellations rely on these events. For local testing, use `stripe listen --forward-to localhost:3001/v1/subscription/stripe-webhook`.

To show your ABN on Stripe tax invoices, add it in Stripe Dashboard → Settings → Business → Tax details.

The Stripe account is shared with other products, so the webhook only acts on objects whose metadata has `platform=grantmaestro`.

### Email / SES

SES is verified at the `grantmaestro.com` domain level in `terraform-state/`. The backend can send from addresses under that domain, such as `noreply@grantmaestro.com` or `support@grantmaestro.com`, through the ECS task role.

Runtime email variables:

- `FROM_EMAIL=noreply@grantmaestro.com`
- `AWS_SES_REGION=ap-southeast-2`

Static AWS access keys are not required in ECS because the task role has SES send permissions.

Important: SES domain verification allows sender addresses under `grantmaestro.com`. If the AWS SES account is still in sandbox mode, AWS can still reject unverified recipient addresses until SES production access is approved.
