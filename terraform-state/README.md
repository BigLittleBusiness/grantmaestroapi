# GrantMaestro Terraform State Management

This folder creates and manages the shared remote-state resources for the GrantMaestro backend and frontend Terraform stacks.

| Resource | Name |
| --- | --- |
| Backend state bucket | `grantmaestro-terraform-state-backend-434978747146` |
| Frontend state bucket | `grantmaestro-terraform-state-frontend-434978747146` |
| Lock table | `grantmaestro-terraform-locks` |
| Public hosted zone | `grantmaestro.com` |
| SES domain identity | `grantmaestro.com` |
| SES MAIL FROM domain | `mail.grantmaestro.com` |
| State-management state object | `s3://grantmaestro-terraform-state-backend-434978747146/state-management/terraform.tfstate` |
| Region | `ap-southeast-2` |

The hosted zone also preserves the currently visible baseline DNS records for:

- Apex `A` record: `grantmaestro.com -> 3.104.72.207`
- `www` CNAME: `www.grantmaestro.com -> grantmaestro.com`
- Zoho MX records
- SPF TXT record
- DMARC TXT record
- Zoho DKIM TXT record
- SES domain verification TXT record
- SES Easy DKIM CNAME records
- SES MAIL FROM MX/TXT records

## First Machine Bootstrap

Run this once before the app stacks:

```bash
cd grantmaestroapi
AWS_PROFILE=grantmaestro scripts/infra.sh state apply
```

The script intentionally does two phases:

1. `terraform init -backend=false` so Terraform can create the S3 buckets and DynamoDB lock table before a backend exists.
2. `terraform init -migrate-state -force-copy` so the state-management state itself is moved into S3.

That second phase is what prevents a new machine from trying to recreate the state buckets/table.

## New Machine Setup

On a fresh machine after bootstrap has run, do not create these resources again. Just initialize through the same script:

```bash
cd grantmaestroapi
AWS_PROFILE=grantmaestro scripts/infra.sh state plan
```

Expected result after a clean bootstrap: no new state buckets/table should be proposed.

If the Route53 hosted zone has not been created yet, the state plan should propose that one hosted zone only. After applying it, set the output name servers at the domain registrar:

```bash
cd grantmaestroapi
AWS_PROFILE=grantmaestro scripts/infra.sh state apply
cd terraform-state
AWS_PROFILE=grantmaestro terraform output route53_name_servers
```

Then app stacks can use their normal remote state:

```bash
AWS_PROFILE=grantmaestro scripts/infra.sh uat plan
cd ../grantmaestroui
AWS_PROFILE=grantmaestro scripts/infra.sh uat plan
```

## Adoption / Repair Case

If the S3 buckets/table already exist but the state-management state object is missing, the script refuses to apply because Terraform would otherwise try to recreate existing resources.

Use this repair command instead:

```bash
cd grantmaestroapi
AWS_PROFILE=grantmaestro scripts/state-adopt.sh
```

That imports the existing buckets, bucket subresources, and DynamoDB table into the remote state object.

## App State Layout

Terraform workspaces are used by both app stacks:

| Stack | Workspace | State object |
| --- | --- | --- |
| Backend | `uat` | `env:/uat/terraform.tfstate` |
| Backend | `prod` | `env:/prod/terraform.tfstate` |
| Frontend | `uat` | `env:/uat/terraform.tfstate` |
| Frontend | `prod` | `env:/prod/terraform.tfstate` |

Do not commit `.terraform/`, `*.tfstate`, plans, crash logs, or real `.tfvars` files.

## SES Notes

The shared state stack verifies the whole `grantmaestro.com` domain in Amazon SES. After it is verified, the backend can send from addresses like `noreply@grantmaestro.com`, `support@grantmaestro.com`, or other mailboxes under the same domain without verifying each sender individually.

If SES is still in sandbox mode, AWS may still reject unverified recipient addresses. Domain verification fixes sender identity; production sending access is controlled separately by SES account status.
