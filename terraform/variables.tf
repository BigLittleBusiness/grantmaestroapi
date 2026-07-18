variable "aws_region" {
  type        = string
  description = "AWS region for the backend stack."
  default     = "ap-southeast-2"
}

variable "project_name" {
  type        = string
  description = "Project name used in resource prefixes."
  default     = "grantmaestro"
}

variable "environment" {
  type        = string
  description = "Terraform workspace-style environment name."
  default     = "prod"
}

variable "shared_infra_owner_environment" {
  type        = string
  description = "Environment that owns shared ALB/RDS resources."
  default     = "uat"
}

variable "domain_name" {
  type        = string
  description = "Primary domain for the GrantMaestro platform."
  default     = "grantmaestro.com"
}

variable "api_subdomain" {
  type        = string
  description = "Production API subdomain."
  default     = "api"
}

variable "uat_api_subdomain" {
  type        = string
  description = "UAT API subdomain."
  default     = "api.uat"
}

variable "route53_zone_id" {
  type        = string
  description = "Optional Route 53 hosted zone ID for DNS records."
  default     = ""
}

variable "alb_certificate_arn" {
  type        = string
  description = "Existing ACM certificate ARN for api.grantmaestro.com/api.uat.grantmaestro.com. Optional; Terraform also requests a wildcard cert and outputs DNS validation records."
  default     = ""
}

variable "enable_https" {
  type        = bool
  description = "Attach the ACM certificate to the ALB HTTPS listener. Keep false until DNS validation has issued the certificate."
  default     = false
}

variable "backend_image" {
  type        = string
  description = "ECR image URI for the production backend service."
}

variable "uat_backend_image" {
  type        = string
  description = "ECR image URI for the UAT backend service."
  default     = ""
}

variable "desired_count" {
  type        = number
  description = "Desired task count for production."
  default     = 1
}

variable "uat_desired_count" {
  type        = number
  description = "Desired task count for UAT."
  default     = 1
}

variable "task_cpu" {
  type        = number
  description = "CPU units for ECS tasks."
  default     = 256
}

variable "task_memory" {
  type        = number
  description = "Memory for ECS tasks in MiB."
  default     = 512
}

variable "allowed_cidrs" {
  type        = list(string)
  description = "CIDR blocks allowed to reach the ALB."
  default     = ["0.0.0.0/0"]
}

variable "vpc_cidr" {
  type        = string
  description = "CIDR block for the backend VPC."
  default     = "10.40.0.0/16"
}

variable "public_subnet_cidrs" {
  type        = list(string)
  description = "Public subnet CIDR blocks."
  default     = ["10.40.0.0/24", "10.40.1.0/24"]
}

variable "private_subnet_cidrs" {
  type        = list(string)
  description = "Private subnet CIDR blocks."
  default     = ["10.40.10.0/24", "10.40.11.0/24"]
}

variable "db_name" {
  type        = string
  description = "Production database name."
  default     = "grantmaestro"
}

variable "uat_db_name" {
  type        = string
  description = "UAT database name."
  default     = "grantmaestro_uat"
}

variable "db_username" {
  type        = string
  description = "Primary database username."
  default     = "grantmaestro_admin"
}

variable "db_instance_class" {
  type        = string
  description = "RDS instance class."
  default     = "db.t4g.micro"
}

variable "db_allocated_storage" {
  type        = number
  description = "Allocated RDS storage in GB."
  default     = 20
}

variable "db_backup_retention_days" {
  type        = number
  description = "RDS backup retention window."
  default     = 7
}

variable "enable_deletion_protection" {
  type        = bool
  description = "Enable deletion protection for RDS."
  default     = false
}

variable "redis_node_type" {
  type        = string
  description = "ElastiCache node type."
  default     = "cache.t4g.micro"
}

variable "frontend_base_url" {
  type        = string
  description = "Canonical frontend app URL used by the backend."
  default     = "https://app.grantmaestro.com"
}

variable "marketing_base_url" {
  type        = string
  description = "Canonical marketing site URL used by the backend."
  default     = "https://www.grantmaestro.com"
}

variable "from_email" {
  type        = string
  description = "Verified SES sender address."
  default     = "noreply@grantmaestro.com"
}

variable "aws_ses_region" {
  type        = string
  description = "AWS region to use for SES."
  default     = "ap-southeast-2"
}

variable "aws_s3_bucket" {
  type        = string
  description = "S3 bucket used by backend for documents, reports, and file storage."
}

variable "aws_s3_use_local_fallback" {
  type        = bool
  description = "Allow local disk fallback when S3 upload fails. Keep false in production."
  default     = false
}

variable "stripe_secret_key" {
  type        = string
  description = "Stripe secret key injected into the backend."
  default     = ""
  sensitive   = true
}

variable "stripe_webhook_secret" {
  type        = string
  description = "Stripe webhook secret injected into the backend."
  default     = ""
  sensitive   = true
}

variable "openai_api_key" {
  type        = string
  description = "OpenAI API key injected into the backend."
  default     = ""
  sensitive   = true
}

variable "pin_secret_key" {
  type        = string
  description = "Pin Payments secret key injected into the backend when used."
  default     = ""
  sensitive   = true
}

variable "pin_publishable_key" {
  type        = string
  description = "Pin Payments publishable key injected into the backend when used."
  default     = ""
  sensitive   = true
}
