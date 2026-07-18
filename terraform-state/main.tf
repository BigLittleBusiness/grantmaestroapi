terraform {
  required_version = ">= 1.6"

  backend "s3" {}

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

resource "aws_route53_zone" "primary" {
  name    = "grantmaestro.com"
  comment = "GrantMaestro public DNS zone"

  tags = {
    Name        = "grantmaestro.com"
    Environment = "shared"
    ManagedBy   = "Terraform"
    Purpose     = "Public DNS for GrantMaestro"
  }
}

resource "aws_route53_record" "apex" {
  allow_overwrite = true
  zone_id         = aws_route53_zone.primary.zone_id
  name            = "grantmaestro.com"
  type            = "A"
  ttl             = 300
  records         = ["3.104.72.207"]
}

resource "aws_route53_record" "www" {
  allow_overwrite = true
  zone_id         = aws_route53_zone.primary.zone_id
  name            = "www.grantmaestro.com"
  type            = "CNAME"
  ttl             = 14400
  records         = ["grantmaestro.com"]
}

resource "aws_route53_record" "mx" {
  allow_overwrite = true
  zone_id         = aws_route53_zone.primary.zone_id
  name            = "grantmaestro.com"
  type            = "MX"
  ttl             = 14400
  records = [
    "10 mx.zoho.com.au",
    "20 mx2.zoho.com.au",
    "50 mx3.zoho.com.au",
  ]
}

resource "aws_route53_record" "spf" {
  allow_overwrite = true
  zone_id         = aws_route53_zone.primary.zone_id
  name            = "grantmaestro.com"
  type            = "TXT"
  ttl             = 14400
  records         = ["v=spf1 include:zohomail.com.au include:zoho.in ~all"]
}

resource "aws_route53_record" "dmarc" {
  allow_overwrite = true
  zone_id         = aws_route53_zone.primary.zone_id
  name            = "_dmarc.grantmaestro.com"
  type            = "TXT"
  ttl             = 14400
  records         = ["v=DMARC1; p=quarantine; rua=mailto:hello@grantmaestro.com"]
}

resource "aws_route53_record" "zoho_dkim" {
  allow_overwrite = true
  zone_id         = aws_route53_zone.primary.zone_id
  name            = "zoho._domainkey.grantmaestro.com"
  type            = "TXT"
  ttl             = 14400
  records = [
    "v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCfEY2IWLhx2TGEfKjAsJI7oA5+8DF6BpvzP6izjdA+w1HE9YM8ZTTNddtarm2k80JjoqcCoRB3RDD0/DUvxkouZ3qf/IRUipPrShvNkQACoXUhuNj3JEGqFcrj0TlTLy+/Wsn7j4VWMHJhk8JlqP+3BZI1OA66XNjpTWtETiGUiwIDAQAB",
  ]
}

resource "aws_ses_domain_identity" "primary" {
  domain = aws_route53_zone.primary.name
}

resource "aws_route53_record" "ses_domain_verification" {
  allow_overwrite = true
  zone_id         = aws_route53_zone.primary.zone_id
  name            = "_amazonses.${aws_route53_zone.primary.name}"
  type            = "TXT"
  ttl             = 300
  records         = [aws_ses_domain_identity.primary.verification_token]
}

resource "aws_ses_domain_identity_verification" "primary" {
  domain = aws_ses_domain_identity.primary.id

  depends_on = [aws_route53_record.ses_domain_verification]
}

resource "aws_ses_domain_dkim" "primary" {
  domain = aws_ses_domain_identity.primary.domain
}

resource "aws_route53_record" "ses_dkim" {
  count = 3

  allow_overwrite = true
  zone_id         = aws_route53_zone.primary.zone_id
  name            = "${aws_ses_domain_dkim.primary.dkim_tokens[count.index]}._domainkey.${aws_route53_zone.primary.name}"
  type            = "CNAME"
  ttl             = 300
  records         = ["${aws_ses_domain_dkim.primary.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

resource "aws_ses_domain_mail_from" "primary" {
  domain                 = aws_ses_domain_identity.primary.domain
  mail_from_domain       = "mail.${aws_route53_zone.primary.name}"
  behavior_on_mx_failure = "UseDefaultValue"
}

resource "aws_route53_record" "ses_mail_from_mx" {
  allow_overwrite = true
  zone_id         = aws_route53_zone.primary.zone_id
  name            = aws_ses_domain_mail_from.primary.mail_from_domain
  type            = "MX"
  ttl             = 300
  records         = ["10 feedback-smtp.${var.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  allow_overwrite = true
  zone_id         = aws_route53_zone.primary.zone_id
  name            = aws_ses_domain_mail_from.primary.mail_from_domain
  type            = "TXT"
  ttl             = 300
  records         = ["v=spf1 include:amazonses.com ~all"]
}

# S3 bucket for Terraform state - Backend
resource "aws_s3_bucket" "terraform_state_backend" {
  bucket = "grantmaestro-terraform-state-backend-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "terraform-state-backend"
    Environment = "shared"
    ManagedBy   = "Terraform"
    Purpose     = "Terraform remote state for grantmaestroapi"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state_backend" {
  bucket = aws_s3_bucket.terraform_state_backend.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state_backend" {
  bucket = aws_s3_bucket.terraform_state_backend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state_backend" {
  bucket = aws_s3_bucket.terraform_state_backend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "terraform_state_backend" {
  bucket = aws_s3_bucket.terraform_state_backend.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# S3 bucket for Terraform state - Frontend
resource "aws_s3_bucket" "terraform_state_frontend" {
  bucket = "grantmaestro-terraform-state-frontend-${data.aws_caller_identity.current.account_id}"

  tags = {
    Name        = "terraform-state-frontend"
    Environment = "shared"
    ManagedBy   = "Terraform"
    Purpose     = "Terraform remote state for grantmaestroui"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state_frontend" {
  bucket = aws_s3_bucket.terraform_state_frontend.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state_frontend" {
  bucket = aws_s3_bucket.terraform_state_frontend.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "terraform_state_frontend" {
  bucket = aws_s3_bucket.terraform_state_frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "terraform_state_frontend" {
  bucket = aws_s3_bucket.terraform_state_frontend.id

  rule {
    id     = "delete-old-versions"
    status = "Enabled"

    filter {}

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# DynamoDB table for state locking (optional but recommended)
resource "aws_dynamodb_table" "terraform_locks" {
  name         = "grantmaestro-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Name        = "terraform-locks"
    Environment = "shared"
    ManagedBy   = "Terraform"
    Purpose     = "State locking for concurrent Terraform operations"
  }
}

data "aws_caller_identity" "current" {}
