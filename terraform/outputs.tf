output "api_url" {
  value       = "https://${local.api_hostname}"
  description = "Production backend base URL."
}

output "uat_api_url" {
  value       = "https://${local.uat_api_hostname}"
  description = "UAT backend base URL."
}

output "ecr_repository_url" {
  value       = aws_ecr_repository.backend.repository_url
  description = "Backend ECR repository URL."
}

output "ecs_cluster_name" {
  value       = aws_ecs_cluster.this.name
  description = "ECS cluster name."
}

output "prod_service_name" {
  value       = aws_ecs_service.prod.name
  description = "Production ECS service name."
}

output "uat_service_name" {
  value       = length(aws_ecs_service.uat) > 0 ? aws_ecs_service.uat[0].name : ""
  description = "UAT ECS service name."
}

output "rds_endpoint" {
  value       = local.rds_instance_address
  description = "RDS endpoint."
}

output "redis_endpoint" {
  value       = aws_elasticache_cluster.redis.cache_nodes[0].address
  description = "Redis endpoint."
}

output "backend_acm_certificate_arn" {
  value       = aws_acm_certificate.backend.arn
  description = "Requested backend wildcard ACM certificate ARN in ap-southeast-2."
}

output "backend_acm_dns_validation_records" {
  value = [
    for option in aws_acm_certificate.backend.domain_validation_options : {
      domain = option.domain_name
      name   = option.resource_record_name
      type   = option.resource_record_type
      value  = option.resource_record_value
    }
  ]
  description = "DNS CNAME records to create at the DNS provider to validate the backend wildcard ACM certificate."
}

output "backend_external_dns_records" {
  value = [
    {
      name  = local.uat_api_hostname
      type  = "CNAME"
      value = local.alb_dns_name
    },
    {
      name  = local.api_hostname
      type  = "CNAME"
      value = local.alb_dns_name
    }
  ]
  description = "External DNS records to create when Route53 is not managing grantmaestro.com."
}
