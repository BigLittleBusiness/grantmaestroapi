output "terraform_state_backend_bucket" {
  value       = aws_s3_bucket.terraform_state_backend.id
  description = "S3 bucket for backend terraform state"
}

output "terraform_state_frontend_bucket" {
  value       = aws_s3_bucket.terraform_state_frontend.id
  description = "S3 bucket for frontend terraform state"
}

output "terraform_locks_table" {
  value       = aws_dynamodb_table.terraform_locks.name
  description = "DynamoDB table for state locking"
}

output "route53_zone_id" {
  value       = aws_route53_zone.primary.zone_id
  description = "Route53 public hosted zone ID for grantmaestro.com."
}

output "route53_name_servers" {
  value       = aws_route53_zone.primary.name_servers
  description = "Name servers to set at the domain registrar for grantmaestro.com."
}

output "ses_domain_identity" {
  value       = aws_ses_domain_identity.primary.domain
  description = "Terraform-managed SES domain identity."
}

output "ses_mail_from_domain" {
  value       = aws_ses_domain_mail_from.primary.mail_from_domain
  description = "Custom SES MAIL FROM domain."
}

output "ses_dkim_records" {
  value = [
    for record in aws_route53_record.ses_dkim : {
      name  = record.name
      type  = record.type
      value = one(record.records)
    }
  ]
  description = "Route53 DKIM records managed for SES."
}

output "backend_config" {
  value = {
    bucket         = aws_s3_bucket.terraform_state_backend.id
    key            = "terraform.tfstate"
    region         = "ap-southeast-2"
    encrypt        = "true"
    dynamodb_table = aws_dynamodb_table.terraform_locks.name
  }
  description = "Backend configuration for grantmaestroapi terraform"
}

output "frontend_config" {
  value = {
    bucket         = aws_s3_bucket.terraform_state_frontend.id
    key            = "terraform.tfstate"
    region         = "ap-southeast-2"
    encrypt        = "true"
    dynamodb_table = aws_dynamodb_table.terraform_locks.name
  }
  description = "Backend configuration for grantmaestroui terraform"
}
