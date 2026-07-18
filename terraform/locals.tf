data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  is_prod            = var.environment == "prod"
  is_uat             = var.environment == "uat"
  use_shared_rds_alb = local.is_prod
  name_prefix        = "${var.project_name}-${var.environment}"
  shared_name_prefix = "${var.project_name}-${var.shared_infra_owner_environment}"
  azs                = slice(data.aws_availability_zones.available.names, 0, 2)
  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
    Repository  = "grantmaestroapi"
  }

  api_hostname            = "${var.api_subdomain}.${var.domain_name}"
  uat_api_hostname        = "${var.uat_api_subdomain}.${var.domain_name}"
  env_api_hostname        = local.is_prod ? local.api_hostname : local.uat_api_hostname
  alb_https_enabled       = var.enable_https
  backend_certificate_arn = var.alb_certificate_arn != "" ? var.alb_certificate_arn : aws_acm_certificate.backend.arn
  route53_zone_id         = var.route53_zone_id != "" ? var.route53_zone_id : one(data.aws_route53_zone.primary[*].zone_id)

  # ACM returns the same validation CNAME for the apex and wildcard domain.
  # Static keys keep first-time Terraform plans valid while values are unknown.
  backend_acm_validation_domains = {
    wildcard_root = "*.${var.domain_name}"
    wildcard_uat  = "*.uat.${var.domain_name}"
  }
  backend_acm_validation_records = {
    for key, domain_name in local.backend_acm_validation_domains : key => {
      name = one([
        for option in aws_acm_certificate.backend.domain_validation_options :
        option.resource_record_name
        if option.domain_name == domain_name
      ])
      type = one([
        for option in aws_acm_certificate.backend.domain_validation_options :
        option.resource_record_type
        if option.domain_name == domain_name
      ])
      value = one([
        for option in aws_acm_certificate.backend.domain_validation_options :
        option.resource_record_value
        if option.domain_name == domain_name
      ])
    }
  }

  # RDS/ALB are created by UAT and reused by PROD to mirror the existing deployment pattern.
  rds_instance_address = local.use_shared_rds_alb ? data.aws_db_instance.shared_rds[0].address : aws_db_instance.backend[0].address
  rds_instance_port    = local.use_shared_rds_alb ? data.aws_db_instance.shared_rds[0].port : aws_db_instance.backend[0].port
  alb_arn              = local.use_shared_rds_alb ? data.aws_lb.shared_alb[0].arn : aws_lb.backend[0].arn
  alb_dns_name         = local.use_shared_rds_alb ? data.aws_lb.shared_alb[0].dns_name : aws_lb.backend[0].dns_name
  alb_zone_id          = local.use_shared_rds_alb ? data.aws_lb.shared_alb[0].zone_id : aws_lb.backend[0].zone_id
  vpc_id               = local.use_shared_rds_alb ? data.aws_lb.shared_alb[0].vpc_id : aws_vpc.this[0].id
  private_subnet_ids   = local.use_shared_rds_alb ? data.aws_db_subnet_group.shared_rds[0].subnet_ids : aws_subnet.private[*].id

  redis_url                  = "redis://${aws_elasticache_cluster.redis.cache_nodes[0].address}:${aws_elasticache_cluster.redis.port}/0"
  shared_prod_secret_payload = local.use_shared_rds_alb ? jsondecode(data.aws_secretsmanager_secret_version.shared_prod_app_config[0].secret_string) : {}
  prod_db_password           = local.use_shared_rds_alb ? local.shared_prod_secret_payload.DB_PASSWORD : random_password.db_password.result
  uat_cors_origins           = "https://app.uat.${var.domain_name},https://app.${var.domain_name}"
  prod_cors_origins          = "https://app.${var.domain_name}"

  prod_secret_payload = {
    DB_HOST                 = local.rds_instance_address
    DB_PORT                 = tostring(local.rds_instance_port)
    DB_USER                 = var.db_username
    DB_PASSWORD             = local.prod_db_password
    DB_NAME                 = var.db_name
    JWT_SECRET              = random_password.prod_jwt_secret.result
    REFRESH_TOKEN_SECRET    = random_password.prod_refresh_token_secret.result
    SETTINGS_ENCRYPTION_KEY = random_password.prod_settings_encryption_key.result
    SETTINGS_ENCRYPTION_IV  = substr(random_password.prod_settings_encryption_iv.result, 0, 16)
    REDIS_URL               = local.redis_url
    CORS_ORIGINS            = local.prod_cors_origins
    FRONTEND_URL            = var.frontend_base_url
    FROM_EMAIL              = var.from_email
    AWS_SES_REGION          = var.aws_ses_region
    STRIPE_SECRET_KEY       = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET   = var.stripe_webhook_secret
    STRIPE_SUCCESS_URL      = "${var.frontend_base_url}/payment-success"
    STRIPE_CANCEL_URL       = "${var.frontend_base_url}/payment-cancel"
    OPENAI_API_KEY          = var.openai_api_key
    PIN_SECRET_KEY          = var.pin_secret_key
    PIN_PUBLISHABLE_KEY     = var.pin_publishable_key
  }

  uat_secret_payload = {
    DB_HOST                 = local.rds_instance_address
    DB_PORT                 = tostring(local.rds_instance_port)
    DB_USER                 = var.db_username
    DB_PASSWORD             = random_password.db_password.result
    DB_NAME                 = var.uat_db_name
    JWT_SECRET              = random_password.uat_jwt_secret.result
    REFRESH_TOKEN_SECRET    = random_password.uat_refresh_token_secret.result
    SETTINGS_ENCRYPTION_KEY = random_password.uat_settings_encryption_key.result
    SETTINGS_ENCRYPTION_IV  = substr(random_password.uat_settings_encryption_iv.result, 0, 16)
    REDIS_URL               = local.redis_url
    CORS_ORIGINS            = local.uat_cors_origins
    FRONTEND_URL            = var.frontend_base_url
    FROM_EMAIL              = var.from_email
    AWS_SES_REGION          = var.aws_ses_region
    STRIPE_SECRET_KEY       = var.stripe_secret_key
    STRIPE_WEBHOOK_SECRET   = var.stripe_webhook_secret
    STRIPE_SUCCESS_URL      = "${var.frontend_base_url}/payment-success"
    STRIPE_CANCEL_URL       = "${var.frontend_base_url}/payment-cancel"
    OPENAI_API_KEY          = var.openai_api_key
    PIN_SECRET_KEY          = var.pin_secret_key
    PIN_PUBLISHABLE_KEY     = var.pin_publishable_key
  }
}
