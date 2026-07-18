#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

usage() {
  cat <<USAGE
Usage:
  scripts/deploy.sh <prod|uat|staging> [--tag <image_tag>] [--dockerfile <path>] [--region <aws_region>] [--skip-build] [--skip-db-bootstrap]

Examples:
  AWS_PROFILE=grantmaestro scripts/deploy.sh uat --region ap-southeast-2
  AWS_PROFILE=grantmaestro scripts/deploy.sh prod --region ap-southeast-2
  scripts/deploy.sh staging --tag uat-latest
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

TARGET_ENV="$1"
shift

AWS_REGION=""
DOCKERFILE_PATH="Dockerfile"
IMAGE_TAG=""
SKIP_BUILD="false"
SKIP_DB_BOOTSTRAP="false"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --region)
      AWS_REGION="$2"
      shift 2
      ;;
    --dockerfile)
      DOCKERFILE_PATH="$2"
      shift 2
      ;;
    --tag)
      IMAGE_TAG="$2"
      shift 2
      ;;
    --skip-build)
      SKIP_BUILD="true"
      shift
      ;;
    --skip-db-bootstrap)
      SKIP_DB_BOOTSTRAP="true"
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

case "$TARGET_ENV" in
  prod)
    : "${IMAGE_TAG:=prod-latest}"
    APP_ENV="prod"
    ;;
  uat)
    : "${IMAGE_TAG:=uat-latest}"
    APP_ENV="uat"
    ;;
  staging)
    : "${IMAGE_TAG:=uat-latest}"
    APP_ENV="uat"
    TARGET_ENV="uat"
    ;;
  *)
    echo "Environment must be 'prod', 'uat', or 'staging'." >&2
    usage
    exit 1
    ;;
esac

cd "$ROOT_DIR"

for cmd in aws docker; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "$cmd is required for backend deployment." >&2
    exit 1
  fi
done

AWS_ARGS=()
if [[ -n "$AWS_REGION" ]]; then
  AWS_ARGS+=(--region "$AWS_REGION")
fi

run_aws() {
  if [[ ${#AWS_ARGS[@]} -gt 0 ]]; then
    aws "${AWS_ARGS[@]}" "$@"
  else
    aws "$@"
  fi
}

ACCOUNT_ID="$(run_aws sts get-caller-identity --query Account --output text)"
REGION="${AWS_REGION:-$(aws configure get region 2>/dev/null || true)}"
REGION="${REGION:-ap-southeast-2}"
CLUSTER_NAME="${ECS_CLUSTER_NAME:-grantmaestro-${APP_ENV}-cluster}"
SERVICE_NAME="${ECS_SERVICE_NAME:-grantmaestro-${APP_ENV}-${APP_ENV}}"
ECR_REPOSITORY_NAME="${ECR_REPOSITORY_NAME:-grantmaestro-${APP_ENV}/backend}"
ECR_REPOSITORY_URL="${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${ECR_REPOSITORY_NAME}"

print_service_diagnostics() {
  echo "ECS service did not become stable. Recent service events:" >&2
  run_aws ecs describe-services \
    --cluster "$CLUSTER_NAME" \
    --services "$SERVICE_NAME" \
    --query 'services[0].events[0:10].[createdAt,message]' \
    --output table >&2 || true

  echo "Recent backend logs:" >&2
  run_aws logs tail "/ecs/grantmaestro-${APP_ENV}/backend" \
    --since 20m \
    --format short >&2 || true
}

wait_for_service_stable() {
  local attempts=24
  local sleep_seconds=15
  local desired running pending rollout deployment_count

  for ((attempt = 1; attempt <= attempts; attempt++)); do
    desired="$(run_aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query 'services[0].desiredCount' --output text)"
    running="$(run_aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query 'services[0].runningCount' --output text)"
    pending="$(run_aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query 'services[0].pendingCount' --output text)"
    rollout="$(run_aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query 'services[0].deployments[0].rolloutState' --output text)"
    deployment_count="$(run_aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query 'length(services[0].deployments)' --output text)"

    if [[ "$running" == "$desired" && "$pending" == "0" && "$rollout" == "COMPLETED" && "$deployment_count" == "1" ]]; then
      return 0
    fi

    echo "Waiting for ECS stability (${attempt}/${attempts}): desired=${desired}, running=${running}, pending=${pending}, rollout=${rollout}"
    sleep "$sleep_seconds"
  done

  print_service_diagnostics
  return 1
}

bootstrap_database() {
  local task_definition="$1"
  local network_file overrides_file task_arn exit_code

  network_file="$(mktemp)"
  overrides_file="$(mktemp)"

  run_aws ecs describe-services \
    --cluster "$CLUSTER_NAME" \
    --services "$SERVICE_NAME" \
    --query 'services[0].networkConfiguration' \
    --output json >"$network_file"

  cat >"$overrides_file" <<'JSON'
{
  "containerOverrides": [
    {
      "name": "backend",
      "command": [
        "node",
        "-e",
        "const mysql=require('mysql2/promise');(async()=>{const c=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,multipleStatements:true});const db=String(process.env.DB_NAME||'').replace(/`/g,'``');await c.query('CREATE DATABASE IF NOT EXISTS `'+db+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');console.log('database ready '+db);await c.end();})().catch(e=>{console.error(e);process.exit(1);});"
      ]
    }
  ]
}
JSON

  echo "Initializing RDS MySQL database for ${TARGET_ENV} using one-off backend task ${task_definition}"
  task_arn="$(run_aws ecs run-task \
    --cluster "$CLUSTER_NAME" \
    --task-definition "$task_definition" \
    --launch-type FARGATE \
    --network-configuration "file://${network_file}" \
    --overrides "file://${overrides_file}" \
    --query 'tasks[0].taskArn' \
    --output text)"

  rm -f "$network_file" "$overrides_file"

  if [[ -z "$task_arn" || "$task_arn" == "None" ]]; then
    echo "Database bootstrap task was not started." >&2
    return 1
  fi

  run_aws ecs wait tasks-stopped --cluster "$CLUSTER_NAME" --tasks "$task_arn"
  exit_code="$(run_aws ecs describe-tasks \
    --cluster "$CLUSTER_NAME" \
    --tasks "$task_arn" \
    --query 'tasks[0].containers[0].exitCode' \
    --output text)"

  if [[ "$exit_code" != "0" ]]; then
    echo "Database bootstrap failed for task ${task_arn} with exit code ${exit_code}." >&2
    print_service_diagnostics
    return 1
  fi
}

seed_required_data() {
  local task_definition="$1"
  local network_file overrides_file task_arn exit_code

  network_file="$(mktemp)"
  overrides_file="$(mktemp)"

  run_aws ecs describe-services \
    --cluster "$CLUSTER_NAME" \
    --services "$SERVICE_NAME" \
    --query 'services[0].networkConfiguration' \
    --output json >"$network_file"

  cat >"$overrides_file" <<'JSON'
{
  "containerOverrides": [
    {
      "name": "backend",
      "command": [
        "node",
        "-e",
        "const mysql=require('mysql2/promise');(async()=>{const c=await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT||3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});const roles=[[1,'System Admin',0,0],[2,'Organization Admin',0,0],[3,'Team Member',0,0],[4,'Viewer',0,0]];for(const r of roles){await c.execute('INSERT INTO grant_user_roles (role_id,name,is_blocked,is_deleted,created_at,modified_at) VALUES (?,?,?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE name=VALUES(name),is_blocked=0,is_deleted=0,modified_at=NOW()',r);}const plans=[[1,'Seat by Seat','Seat-by-seat plan','month',0,'seed-seat-by-seat',14,0,0],[2,'Pro','Pro plan','month',0,'seed-pro',14,0,0]];for(const p of plans){await c.execute('INSERT INTO grant_subscription_plans (plan_id,plan_name,plan_description,plan_duration,plan_price,stripe_plan_id,trial_days,is_blocked,is_deleted,created_at,modified_at) VALUES (?,?,?,?,?,?,?,?,?,NOW(),NOW()) ON DUPLICATE KEY UPDATE plan_name=VALUES(plan_name),plan_description=VALUES(plan_description),plan_duration=VALUES(plan_duration),plan_price=VALUES(plan_price),stripe_plan_id=VALUES(stripe_plan_id),trial_days=VALUES(trial_days),is_blocked=0,is_deleted=0,modified_at=NOW()',p);}console.log('required seed data ready');await c.end();})().catch(e=>{console.error(e);process.exit(1);});"
      ]
    }
  ]
}
JSON

  echo "Seeding required ${TARGET_ENV} RDS data using one-off backend task ${task_definition}"
  task_arn="$(run_aws ecs run-task \
    --cluster "$CLUSTER_NAME" \
    --task-definition "$task_definition" \
    --launch-type FARGATE \
    --network-configuration "file://${network_file}" \
    --overrides "file://${overrides_file}" \
    --query 'tasks[0].taskArn' \
    --output text)"

  rm -f "$network_file" "$overrides_file"

  if [[ -z "$task_arn" || "$task_arn" == "None" ]]; then
    echo "Required seed data task was not started." >&2
    return 1
  fi

  run_aws ecs wait tasks-stopped --cluster "$CLUSTER_NAME" --tasks "$task_arn"
  exit_code="$(run_aws ecs describe-tasks \
    --cluster "$CLUSTER_NAME" \
    --tasks "$task_arn" \
    --query 'tasks[0].containers[0].exitCode' \
    --output text)"

  if [[ "$exit_code" != "0" ]]; then
    echo "Required seed data task failed for task ${task_arn} with exit code ${exit_code}." >&2
    print_service_diagnostics
    return 1
  fi
}

if [[ "$SKIP_BUILD" != "true" ]]; then
  if [[ ! -f "$ROOT_DIR/$DOCKERFILE_PATH" ]]; then
    echo "Dockerfile not found at: $DOCKERFILE_PATH" >&2
    exit 1
  fi

  IMAGE_URI="${ECR_REPOSITORY_URL}:${IMAGE_TAG}"

  echo "Logging into ECR registry: ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"
  run_aws ecr get-login-password | docker login --username AWS --password-stdin "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com"

  echo "Building backend image: ${IMAGE_URI}"
  if docker buildx version >/dev/null 2>&1; then
    docker buildx build \
      --platform linux/amd64 \
      -f "$DOCKERFILE_PATH" \
      -t "$IMAGE_URI" \
      --push \
      "$ROOT_DIR"
  else
    echo "docker buildx is required to publish linux/amd64 images for ECS." >&2
    exit 1
  fi
fi

SERVICE_TASK_DEFINITION="$(run_aws ecs describe-services --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query 'services[0].taskDefinition' --output text)"

if [[ "$SKIP_DB_BOOTSTRAP" != "true" ]]; then
  bootstrap_database "$SERVICE_TASK_DEFINITION"
fi

run_aws ecs update-service \
  --cluster "$CLUSTER_NAME" \
  --service "$SERVICE_NAME" \
  --force-new-deployment >/dev/null

wait_for_service_stable

if [[ "$SKIP_DB_BOOTSTRAP" != "true" ]]; then
  seed_required_data "$SERVICE_TASK_DEFINITION"
fi

echo "Backend deployment completed: ${TARGET_ENV}"
echo "Cluster: ${CLUSTER_NAME}"
echo "Service: ${SERVICE_NAME}"
if [[ "$SKIP_BUILD" != "true" ]]; then
  echo "Image pushed: ${ECR_REPOSITORY_URL}:${IMAGE_TAG}"
fi
