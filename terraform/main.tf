resource "random_password" "db_password" {
  length  = 24
  special = false
}
moved {
  from = aws_db_subnet_group.backend
  to   = aws_db_subnet_group.backend[0]
}

moved {
  from = aws_db_instance.backend
  to   = aws_db_instance.backend[0]
}

moved {
  from = aws_lb.backend
  to   = aws_lb.backend[0]
}

data "aws_route53_zone" "primary" {
  count        = var.route53_zone_id == "" ? 1 : 0
  name         = var.domain_name
  private_zone = false
}

data "aws_db_instance" "shared_rds" {
  count                  = local.use_shared_rds_alb ? 1 : 0
  db_instance_identifier = "${local.shared_name_prefix}-db"
}

data "aws_db_subnet_group" "shared_rds" {
  count = local.use_shared_rds_alb ? 1 : 0
  name  = data.aws_db_instance.shared_rds[0].db_subnet_group
}

data "aws_lb" "shared_alb" {
  count = local.use_shared_rds_alb ? 1 : 0
  name  = substr("${local.shared_name_prefix}-alb", 0, 32)
}

data "aws_security_group" "shared_db" {
  count = local.use_shared_rds_alb ? 1 : 0
  name  = "${local.shared_name_prefix}-db"
}

data "aws_secretsmanager_secret" "shared_prod_app_config" {
  count = local.use_shared_rds_alb ? 1 : 0
  name  = "${local.shared_name_prefix}/prod/app-config"
}

data "aws_secretsmanager_secret_version" "shared_prod_app_config" {
  count     = local.use_shared_rds_alb ? 1 : 0
  secret_id = data.aws_secretsmanager_secret.shared_prod_app_config[0].id
}

data "aws_lb_listener" "http" {
  count             = local.use_shared_rds_alb ? 1 : 0
  load_balancer_arn = data.aws_lb.shared_alb[0].arn
  port              = 80
}

data "aws_lb_listener" "https" {
  count             = local.use_shared_rds_alb && local.alb_https_enabled ? 1 : 0
  load_balancer_arn = data.aws_lb.shared_alb[0].arn
  port              = 443
}

resource "aws_acm_certificate" "backend" {
  domain_name               = "*.${var.domain_name}"
  subject_alternative_names = [var.domain_name, "*.uat.${var.domain_name}"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "backend_acm_validation" {
  for_each = local.backend_acm_validation_records

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.value]
  ttl             = 300
  type            = each.value.type
  zone_id         = local.route53_zone_id
}

resource "random_password" "prod_jwt_secret" {
  length  = 48
  special = false
}

resource "random_password" "uat_jwt_secret" {
  length  = 48
  special = false
}

resource "random_password" "prod_refresh_token_secret" {
  length  = 32
  special = false
}

resource "random_password" "uat_refresh_token_secret" {
  length  = 32
  special = false
}

resource "random_password" "prod_settings_encryption_key" {
  length  = 32
  special = false
}

resource "random_password" "prod_settings_encryption_iv" {
  length  = 16
  special = false
}

resource "random_password" "uat_settings_encryption_key" {
  length  = 32
  special = false
}

resource "random_password" "uat_settings_encryption_iv" {
  length  = 16
  special = false
}

resource "aws_vpc" "this" {
  count                = local.use_shared_rds_alb ? 0 : 1
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
}

resource "aws_internet_gateway" "this" {
  count  = local.use_shared_rds_alb ? 0 : 1
  vpc_id = aws_vpc.this[0].id
}

resource "aws_subnet" "public" {
  count                   = local.use_shared_rds_alb ? 0 : 2
  vpc_id                  = aws_vpc.this[0].id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = local.azs[count.index]
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private" {
  count             = local.use_shared_rds_alb ? 0 : 2
  vpc_id            = aws_vpc.this[0].id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = local.azs[count.index]
}

resource "aws_route_table" "public" {
  count  = local.use_shared_rds_alb ? 0 : 1
  vpc_id = aws_vpc.this[0].id
}

resource "aws_route" "public_default" {
  count                  = local.use_shared_rds_alb ? 0 : 1
  route_table_id         = aws_route_table.public[0].id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this[0].id
}

resource "aws_route_table_association" "public" {
  count          = local.use_shared_rds_alb ? 0 : 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public[0].id
}

resource "aws_eip" "nat" {
  count  = local.use_shared_rds_alb ? 0 : 1
  domain = "vpc"
}

resource "aws_nat_gateway" "this" {
  count         = local.use_shared_rds_alb ? 0 : 1
  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id
}

resource "aws_route_table" "private" {
  count  = local.use_shared_rds_alb ? 0 : 1
  vpc_id = aws_vpc.this[0].id
}

resource "aws_route" "private_default" {
  count                  = local.use_shared_rds_alb ? 0 : 1
  route_table_id         = aws_route_table.private[0].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[0].id
}

resource "aws_route_table_association" "private" {
  count          = local.use_shared_rds_alb ? 0 : 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[0].id
}

resource "aws_security_group" "alb" {
  count       = local.use_shared_rds_alb ? 0 : 1
  name        = "${local.name_prefix}-alb"
  description = "Public access to the backend ALB"
  vpc_id      = aws_vpc.this[0].id

  lifecycle {
    create_before_destroy = true
  }

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidrs
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = var.allowed_cidrs
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name        = "${local.name_prefix}-ecs"
  description = "Backend ECS tasks"
  vpc_id      = local.vpc_id

  lifecycle {
    create_before_destroy = true
  }

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = local.use_shared_rds_alb ? data.aws_lb.shared_alb[0].security_groups : [aws_security_group.alb[0].id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "db" {
  name        = "${local.name_prefix}-db"
  description = "RDS access from ECS"
  vpc_id      = local.vpc_id

  lifecycle {
    ignore_changes = [ingress]
  }

  ingress {
    from_port       = 3306
    to_port         = 3306
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_vpc_security_group_ingress_rule" "prod_ecs_to_shared_db" {
  count                        = local.use_shared_rds_alb ? 1 : 0
  security_group_id            = data.aws_security_group.shared_db[0].id
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = 3306
  to_port                      = 3306
  ip_protocol                  = "tcp"
  description                  = "Allow ${local.name_prefix} ECS tasks to use the shared RDS instance"
}

resource "aws_security_group" "redis" {
  name        = "${local.name_prefix}-redis"
  description = "Redis access from ECS"
  vpc_id      = local.vpc_id

  ingress {
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_ecr_repository" "backend" {
  name                 = "${local.name_prefix}/backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${local.name_prefix}/backend"
  retention_in_days = 30
}

resource "aws_db_subnet_group" "backend" {
  count      = local.use_shared_rds_alb ? 0 : 1
  name       = "${local.name_prefix}-db"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_instance" "backend" {
  count                      = local.use_shared_rds_alb ? 0 : 1
  identifier                 = "${local.name_prefix}-db"
  engine                     = "mysql"
  engine_version             = "8.0"
  instance_class             = var.db_instance_class
  allocated_storage          = var.db_allocated_storage
  storage_type               = "gp3"
  db_name                    = var.db_name
  username                   = var.db_username
  password                   = random_password.db_password.result
  publicly_accessible        = false
  multi_az                   = false
  storage_encrypted          = true
  backup_retention_period    = var.db_backup_retention_days
  deletion_protection        = var.enable_deletion_protection
  skip_final_snapshot        = true
  db_subnet_group_name       = aws_db_subnet_group.backend[0].name
  vpc_security_group_ids     = [aws_security_group.db.id]
  apply_immediately          = true
  auto_minor_version_upgrade = true
}

resource "aws_elasticache_subnet_group" "redis" {
  name       = "${local.name_prefix}-redis"
  subnet_ids = local.private_subnet_ids
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id           = "${local.name_prefix}-redis"
  engine               = "redis"
  node_type            = var.redis_node_type
  num_cache_nodes      = 1
  port                 = 6379
  parameter_group_name = "default.redis7"
  subnet_group_name    = aws_elasticache_subnet_group.redis.name
  security_group_ids   = [aws_security_group.redis.id]
}

resource "aws_iam_role" "ecs_task_execution" {
  name = "${local.name_prefix}-ecs-task-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_task_execution_secrets" {
  name = "${local.name_prefix}-ecs-task-execution-secrets"
  role = aws_iam_role.ecs_task_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = [
          aws_secretsmanager_secret.prod.arn,
          aws_secretsmanager_secret.uat.arn
        ]
      }
    ]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
      Action = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_ses" {
  name = "${local.name_prefix}-ecs-task-ses"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "ses:SendEmail",
        "ses:SendRawEmail",
        "ses:GetSendQuota",
        "ses:GetSendStatistics"
      ]
      Resource = "*"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name_prefix}-ecs-task-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = "arn:aws:s3:::${var.aws_s3_bucket}"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "arn:aws:s3:::${var.aws_s3_bucket}/*"
      }
    ]
  })
}

resource "aws_ecs_cluster" "this" {
  name = "${local.name_prefix}-cluster"
}

resource "aws_secretsmanager_secret" "prod" {
  name = "${local.name_prefix}/prod/app-config"
}

resource "aws_secretsmanager_secret_version" "prod" {
  secret_id     = aws_secretsmanager_secret.prod.id
  secret_string = jsonencode(local.prod_secret_payload)
}

resource "aws_secretsmanager_secret" "uat" {
  name = "${local.name_prefix}/uat/app-config"
}

resource "aws_secretsmanager_secret_version" "uat" {
  secret_id     = aws_secretsmanager_secret.uat.id
  secret_string = jsonencode(local.uat_secret_payload)
}

resource "aws_lb" "backend" {
  count              = local.use_shared_rds_alb ? 0 : 1
  name               = substr("${local.name_prefix}-alb", 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb[0].id]
  subnets            = aws_subnet.public[*].id
}

resource "aws_lb_target_group" "prod" {
  name        = substr("${local.name_prefix}-prod", 0, 32)
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_target_group" "uat" {
  count       = local.use_shared_rds_alb ? 0 : 1
  name        = substr("${local.name_prefix}-uat", 0, 32)
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = local.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 2
  }
}

resource "aws_lb_listener" "http" {
  count             = local.use_shared_rds_alb ? 0 : 1
  load_balancer_arn = local.alb_arn
  port              = 80
  protocol          = "HTTP"

  dynamic "default_action" {
    for_each = local.alb_https_enabled ? [1] : []
    content {
      type = "redirect"

      redirect {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }

  dynamic "default_action" {
    for_each = !local.alb_https_enabled ? [1] : []
    content {
      type             = "forward"
      target_group_arn = aws_lb_target_group.prod.arn
    }
  }
}

resource "aws_lb_listener" "https" {
  count = local.use_shared_rds_alb ? 0 : (local.alb_https_enabled ? 1 : 0)

  load_balancer_arn = local.alb_arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = local.backend_certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.prod.arn
  }
}

resource "aws_lb_listener_rule" "uat" {
  count        = local.use_shared_rds_alb ? 0 : 1
  listener_arn = local.alb_https_enabled ? aws_lb_listener.https[0].arn : aws_lb_listener.http[0].arn
  priority     = 10

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.uat[0].arn
  }

  condition {
    host_header {
      values = [local.uat_api_hostname]
    }
  }
}

resource "aws_lb_listener_rule" "prod" {
  count        = local.use_shared_rds_alb ? 1 : 0
  listener_arn = local.alb_https_enabled ? data.aws_lb_listener.https[0].arn : data.aws_lb_listener.http[0].arn
  priority     = 5

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.prod.arn
  }

  condition {
    host_header {
      values = [local.api_hostname]
    }
  }
}

resource "aws_ecs_task_definition" "prod" {
  family                   = "${local.name_prefix}-prod"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.task_cpu)
  memory                   = tostring(var.task_memory)
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = var.backend_image
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "MODE", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "AWS_S3_BUCKET", value = var.aws_s3_bucket },
        { name = "AWS_S3_USE_LOCAL_FALLBACK", value = tostring(var.aws_s3_use_local_fallback) },
        { name = "MARKETING_BASE_URL", value = var.marketing_base_url }
      ]
      secrets = [
        { name = "DB_HOST", valueFrom = "${aws_secretsmanager_secret.prod.arn}:DB_HOST::" },
        { name = "DB_PORT", valueFrom = "${aws_secretsmanager_secret.prod.arn}:DB_PORT::" },
        { name = "DB_USER", valueFrom = "${aws_secretsmanager_secret.prod.arn}:DB_USER::" },
        { name = "DB_PASSWORD", valueFrom = "${aws_secretsmanager_secret.prod.arn}:DB_PASSWORD::" },
        { name = "DB_NAME", valueFrom = "${aws_secretsmanager_secret.prod.arn}:DB_NAME::" },
        { name = "JWT_SECRET", valueFrom = "${aws_secretsmanager_secret.prod.arn}:JWT_SECRET::" },
        { name = "REFRESH_TOKEN_SECRET", valueFrom = "${aws_secretsmanager_secret.prod.arn}:REFRESH_TOKEN_SECRET::" },
        { name = "SETTINGS_ENCRYPTION_KEY", valueFrom = "${aws_secretsmanager_secret.prod.arn}:SETTINGS_ENCRYPTION_KEY::" },
        { name = "SETTINGS_ENCRYPTION_IV", valueFrom = "${aws_secretsmanager_secret.prod.arn}:SETTINGS_ENCRYPTION_IV::" },
        { name = "REDIS_URL", valueFrom = "${aws_secretsmanager_secret.prod.arn}:REDIS_URL::" },
        { name = "CORS_ORIGINS", valueFrom = "${aws_secretsmanager_secret.prod.arn}:CORS_ORIGINS::" },
        { name = "FRONTEND_URL", valueFrom = "${aws_secretsmanager_secret.prod.arn}:FRONTEND_URL::" },
        { name = "FROM_EMAIL", valueFrom = "${aws_secretsmanager_secret.prod.arn}:FROM_EMAIL::" },
        { name = "AWS_SES_REGION", valueFrom = "${aws_secretsmanager_secret.prod.arn}:AWS_SES_REGION::" },
        { name = "STRIPE_SECRET_KEY", valueFrom = "${aws_secretsmanager_secret.prod.arn}:STRIPE_SECRET_KEY::" },
        { name = "STRIPE_WEBHOOK_SECRET", valueFrom = "${aws_secretsmanager_secret.prod.arn}:STRIPE_WEBHOOK_SECRET::" },
        { name = "STRIPE_SUCCESS_URL", valueFrom = "${aws_secretsmanager_secret.prod.arn}:STRIPE_SUCCESS_URL::" },
        { name = "STRIPE_CANCEL_URL", valueFrom = "${aws_secretsmanager_secret.prod.arn}:STRIPE_CANCEL_URL::" },
        { name = "OPENAI_API_KEY", valueFrom = "${aws_secretsmanager_secret.prod.arn}:OPENAI_API_KEY::" },
        { name = "PIN_SECRET_KEY", valueFrom = "${aws_secretsmanager_secret.prod.arn}:PIN_SECRET_KEY::" },
        { name = "PIN_PUBLISHABLE_KEY", valueFrom = "${aws_secretsmanager_secret.prod.arn}:PIN_PUBLISHABLE_KEY::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "prod"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "uat" {
  count                    = local.use_shared_rds_alb ? 0 : 1
  family                   = "${local.name_prefix}-uat"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = tostring(var.task_cpu)
  memory                   = tostring(var.task_memory)
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = var.uat_backend_image != "" ? var.uat_backend_image : var.backend_image
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "MODE", value = "production" },
        { name = "PORT", value = "3000" },
        { name = "AWS_REGION", value = var.aws_region },
        { name = "AWS_S3_BUCKET", value = var.aws_s3_bucket },
        { name = "AWS_S3_USE_LOCAL_FALLBACK", value = tostring(var.aws_s3_use_local_fallback) },
        { name = "MARKETING_BASE_URL", value = var.marketing_base_url }
      ]
      secrets = [
        { name = "DB_HOST", valueFrom = "${aws_secretsmanager_secret.uat.arn}:DB_HOST::" },
        { name = "DB_PORT", valueFrom = "${aws_secretsmanager_secret.uat.arn}:DB_PORT::" },
        { name = "DB_USER", valueFrom = "${aws_secretsmanager_secret.uat.arn}:DB_USER::" },
        { name = "DB_PASSWORD", valueFrom = "${aws_secretsmanager_secret.uat.arn}:DB_PASSWORD::" },
        { name = "DB_NAME", valueFrom = "${aws_secretsmanager_secret.uat.arn}:DB_NAME::" },
        { name = "JWT_SECRET", valueFrom = "${aws_secretsmanager_secret.uat.arn}:JWT_SECRET::" },
        { name = "REFRESH_TOKEN_SECRET", valueFrom = "${aws_secretsmanager_secret.uat.arn}:REFRESH_TOKEN_SECRET::" },
        { name = "SETTINGS_ENCRYPTION_KEY", valueFrom = "${aws_secretsmanager_secret.uat.arn}:SETTINGS_ENCRYPTION_KEY::" },
        { name = "SETTINGS_ENCRYPTION_IV", valueFrom = "${aws_secretsmanager_secret.uat.arn}:SETTINGS_ENCRYPTION_IV::" },
        { name = "REDIS_URL", valueFrom = "${aws_secretsmanager_secret.uat.arn}:REDIS_URL::" },
        { name = "CORS_ORIGINS", valueFrom = "${aws_secretsmanager_secret.uat.arn}:CORS_ORIGINS::" },
        { name = "FRONTEND_URL", valueFrom = "${aws_secretsmanager_secret.uat.arn}:FRONTEND_URL::" },
        { name = "FROM_EMAIL", valueFrom = "${aws_secretsmanager_secret.uat.arn}:FROM_EMAIL::" },
        { name = "AWS_SES_REGION", valueFrom = "${aws_secretsmanager_secret.uat.arn}:AWS_SES_REGION::" },
        { name = "STRIPE_SECRET_KEY", valueFrom = "${aws_secretsmanager_secret.uat.arn}:STRIPE_SECRET_KEY::" },
        { name = "STRIPE_WEBHOOK_SECRET", valueFrom = "${aws_secretsmanager_secret.uat.arn}:STRIPE_WEBHOOK_SECRET::" },
        { name = "STRIPE_SUCCESS_URL", valueFrom = "${aws_secretsmanager_secret.uat.arn}:STRIPE_SUCCESS_URL::" },
        { name = "STRIPE_CANCEL_URL", valueFrom = "${aws_secretsmanager_secret.uat.arn}:STRIPE_CANCEL_URL::" },
        { name = "OPENAI_API_KEY", valueFrom = "${aws_secretsmanager_secret.uat.arn}:OPENAI_API_KEY::" },
        { name = "PIN_SECRET_KEY", valueFrom = "${aws_secretsmanager_secret.uat.arn}:PIN_SECRET_KEY::" },
        { name = "PIN_PUBLISHABLE_KEY", valueFrom = "${aws_secretsmanager_secret.uat.arn}:PIN_PUBLISHABLE_KEY::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backend.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "uat"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "prod" {
  name            = "${local.name_prefix}-prod"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.prod.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.prod.arn
    container_name   = "backend"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.http]
}

resource "aws_ecs_service" "uat" {
  count           = local.use_shared_rds_alb ? 0 : 1
  name            = "${local.name_prefix}-uat"
  cluster         = aws_ecs_cluster.this.id
  task_definition = aws_ecs_task_definition.uat[0].arn
  desired_count   = var.uat_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = local.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.uat[0].arn
    container_name   = "backend"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.http]
}

resource "aws_route53_record" "api" {
  count   = local.use_shared_rds_alb ? 0 : 1
  zone_id = local.route53_zone_id
  name    = local.api_hostname
  type    = "A"

  alias {
    name                   = local.alb_dns_name
    zone_id                = local.alb_zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "uat_api" {
  count   = local.use_shared_rds_alb ? 0 : 1
  zone_id = local.route53_zone_id
  name    = local.uat_api_hostname
  type    = "A"

  alias {
    name                   = local.alb_dns_name
    zone_id                = local.alb_zone_id
    evaluate_target_health = true
  }
}
