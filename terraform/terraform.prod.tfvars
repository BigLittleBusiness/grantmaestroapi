aws_region        = "ap-southeast-2"
project_name      = "grantmaestro"
environment       = "prod"
domain_name       = "grantmaestro.com"
api_subdomain     = "api"
uat_api_subdomain = "api.uat"
route53_zone_id   = ""
# Optional existing ACM cert. Leave empty on first apply; Terraform requests one and outputs DNS validation records.
alb_certificate_arn            = ""
enable_https                   = true
db_engine_version              = "8.4.11"
shared_rds_instance_identifier = "grantmaestro-uat-db-84-20260902"

# Keep both image values present in each env file to avoid accidental rollback.
backend_image     = "434978747146.dkr.ecr.ap-southeast-2.amazonaws.com/grantmaestro-prod/backend:prod-latest"
uat_backend_image = "434978747146.dkr.ecr.ap-southeast-2.amazonaws.com/grantmaestro-prod/backend:uat-latest"

desired_count                  = 1
uat_desired_count              = 1
ecr_keep_tagged_images         = 10
ecr_untagged_image_expire_days = 7

frontend_base_url         = "https://app.grantmaestro.com"
marketing_base_url        = "https://www.grantmaestro.com"
aws_s3_bucket             = "grantmaestro-documents-prod"
aws_s3_use_local_fallback = false
aws_ses_region            = "ap-southeast-2"
from_email                = "noreply@grantmaestro.com"

# Optional application secrets. Prefer setting real values in uncommitted .tfvars or GitHub environment secrets.
stripe_secret_key     = ""
stripe_webhook_secret = ""
openai_api_key        = ""
pin_secret_key        = ""
pin_publishable_key   = ""
