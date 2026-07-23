# GrantMaestro Backend Terraform

This backend stack is deployed from localhost, not by GitHub Actions. GitHub Actions only builds/pushes the backend image and rolls ECS after the infrastructure exists.

## Domain Arrangement

| Purpose | UAT/Staging | Production |
| --- | --- | --- |
| API URL | `https://api.uat.grantmaestro.com` | `https://api.grantmaestro.com` |
| Frontend origin | `https://app.uat.grantmaestro.com` | `https://app.grantmaestro.com` |
| ECS cluster | `grantmaestro-uat-cluster` | `grantmaestro-prod-cluster` |
| ECS service | `grantmaestro-uat-uat` | `grantmaestro-prod-prod` |
| Database | `grantmaestro_uat` | `grantmaestro` |
| Upload bucket | `grantmaestro-documents-uat` | `grantmaestro-documents-prod` |

UAT owns the shared VPC, ALB, and MySQL RDS instance. Production reuses the UAT-owned ALB/RDS, matching the GrantThrive setup. Root and `www.grantmaestro.com` are intentionally not managed by this stack.

## Email / SES

SES domain verification is managed by the shared state stack in `terraform-state`, not by each app workspace. Route53 records for SES domain verification, Easy DKIM, and `mail.grantmaestro.com` MAIL FROM are created automatically.

The backend sends through the ECS task role with `FROM_EMAIL` from Secrets Manager. Because the domain identity is verified, any sender under `grantmaestro.com` can be used, for example `noreply@grantmaestro.com` or `support@grantmaestro.com`.

If SES rejects recipients, check whether the SES account is still in sandbox mode. Terraform verifies the sender domain; SES production access is an AWS account-level approval.

## ACM Flow

Terraform requests a wildcard ACM certificate in `ap-southeast-2` for:

- `*.grantmaestro.com`
- `*.uat.grantmaestro.com`
- `grantmaestro.com`

The first apply does not wait for validation and does not attach HTTPS to the ALB because `enable_https = false` by default. When the shared state stack has created the Route53 hosted zone, Terraform creates the ACM validation CNAMEs automatically.

You can still inspect the validation records with:

```bash
terraform output -json backend_acm_dns_validation_records
```

After ACM status is `ISSUED`, set this in both backend tfvars and re-apply UAT first, then PROD:

```hcl
enable_https = true
```

You can also set `alb_certificate_arn` to an existing issued certificate ARN. If empty, Terraform uses the requested certificate ARN.

## Local Bootstrap

```bash
cd grantmaestroapi
AWS_PROFILE=grantmaestro scripts/infra.sh state apply
cp terraform/terraform.uat.tfvars.example terraform/terraform.uat.tfvars
cp terraform/terraform.prod.tfvars.example terraform/terraform.prod.tfvars
# Leave route53_zone_id empty; Terraform discovers the managed Route53 zone.
# Leave enable_https=false until ACM is issued.
AWS_PROFILE=grantmaestro scripts/infra.sh uat apply
AWS_PROFILE=grantmaestro scripts/infra.sh prod apply
```

After `state apply`, set the printed Route53 name servers at the registrar. Once delegation propagates, the ACM validation and API DNS records are managed by Terraform.

## Local App Deploy

```bash
cd grantmaestroapi
AWS_PROFILE=grantmaestro scripts/deploy.sh uat --region ap-southeast-2
AWS_PROFILE=grantmaestro scripts/deploy.sh prod --region ap-southeast-2
```

The deploy script builds/pushes the Docker image, optionally bootstraps the MySQL database, forces an ECS rollout, and waits for service stability.

The app does not have a migrations/seeders folder. Schema is currently created by Sequelize `sync`, and the deploy script runs one-off ECS tasks to:

1. Create the target logical database if missing.
2. Roll the ECS service so Sequelize creates/updates tables.
3. Seed required roles and subscription plans idempotently.

## Production Cutover

Production uses the same two-phase flow as UAT:

```bash
cd grantmaestroapi
cp terraform/terraform.prod.tfvars.example terraform/terraform.prod.tfvars
# Keep enable_https=false for the first apply.
AWS_PROFILE=grantmaestro scripts/infra.sh prod apply
AWS_PROFILE=grantmaestro scripts/deploy.sh prod --region ap-southeast-2
```

After ACM is issued, update `terraform/terraform.prod.tfvars`:

```hcl
enable_https = true
```

Then re-apply:

```bash
AWS_PROFILE=grantmaestro scripts/infra.sh prod apply
```

Only after this second apply should the GitHub `prod` branch deployment be used, because the workflow verifies `https://api.grantmaestro.com/api/health`.

## GitHub Actions

`.github/workflows/deploy-aws.yml` does not run Terraform. It only:

1. Builds and pushes the Docker image.
2. Forces the ECS service deployment.
3. Verifies `/api/health`.

Branch behavior:

- Push to `staging` deploys UAT.
- Push to `prod` deploys production.
- Manual `workflow_dispatch` can deploy either `uat` or `prod`.
