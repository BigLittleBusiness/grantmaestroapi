#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="$ROOT_DIR/terraform"
STATE_DIR="$ROOT_DIR/terraform-state"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"
STATE_BACKEND_BUCKET="grantmaestro-terraform-state-backend-434978747146"
STATE_FRONTEND_BUCKET="grantmaestro-terraform-state-frontend-434978747146"
STATE_LOCK_TABLE="grantmaestro-terraform-locks"
STATE_MANAGEMENT_KEY="state-management/terraform.tfstate"

usage() {
  cat <<USAGE
Usage:
  scripts/infra.sh <state|uat|prod> [plan|apply]

Examples:
  AWS_PROFILE=grantmaestro scripts/infra.sh state apply
  AWS_PROFILE=grantmaestro scripts/infra.sh uat apply
  AWS_PROFILE=grantmaestro scripts/infra.sh prod apply
USAGE
}

if [[ $# -lt 1 ]]; then
  usage
  exit 1
fi

TARGET="$1"
ACTION="${2:-apply}"

if [[ "$ACTION" != "plan" && "$ACTION" != "apply" ]]; then
  echo "Action must be 'plan' or 'apply'." >&2
  usage
  exit 1
fi

state_bucket_exists() {
  aws s3api head-bucket --bucket "$STATE_BACKEND_BUCKET" >/dev/null 2>&1
}

state_object_exists() {
  aws s3api head-object --bucket "$STATE_BACKEND_BUCKET" --key "$STATE_MANAGEMENT_KEY" >/dev/null 2>&1
}

init_state_remote() {
  terraform init -input=false -reconfigure "$@" \
    -backend-config="bucket=${STATE_BACKEND_BUCKET}" \
    -backend-config="key=${STATE_MANAGEMENT_KEY}" \
    -backend-config="region=${AWS_REGION}" \
    -backend-config="encrypt=true" \
    -backend-config="dynamodb_table=${STATE_LOCK_TABLE}"
}

print_state_outputs() {
  echo
  echo "Route53 hosted zone ID:"
  terraform output -raw route53_zone_id
  echo
  echo "Route53 name servers to set at the registrar:"
  terraform output -json route53_name_servers
  echo
  echo "SES domain identity:"
  terraform output -raw ses_domain_identity
  echo
  echo "SES MAIL FROM domain:"
  terraform output -raw ses_mail_from_domain
}

case "$TARGET" in
  state)
    if ! command -v aws >/dev/null 2>&1; then
      echo "aws CLI is required for state bootstrap safety checks." >&2
      exit 1
    fi

    cd "$STATE_DIR"

    if state_bucket_exists; then
      if ! state_object_exists; then
        echo "State buckets already exist, but ${STATE_MANAGEMENT_KEY} is missing." >&2
        echo "Do not run state apply from a new machine yet; Terraform would try to recreate existing buckets/table." >&2
        echo "Run: AWS_PROFILE=grantmaestro scripts/state-adopt.sh" >&2
        exit 1
      fi

      init_state_remote
      terraform validate
      if [[ "$ACTION" == "plan" ]]; then
        terraform plan
      else
        terraform apply
        print_state_outputs
      fi
    else
      terraform init -backend=false -reconfigure
      terraform validate
      if [[ "$ACTION" == "plan" ]]; then
        terraform plan
      else
        terraform apply
        echo "Migrating state-management local state into ${STATE_BACKEND_BUCKET}/${STATE_MANAGEMENT_KEY}"
        terraform init -input=false -migrate-state -force-copy \
          -backend-config="bucket=${STATE_BACKEND_BUCKET}" \
          -backend-config="key=${STATE_MANAGEMENT_KEY}" \
          -backend-config="region=${AWS_REGION}" \
          -backend-config="encrypt=true" \
          -backend-config="dynamodb_table=${STATE_LOCK_TABLE}"
        print_state_outputs
      fi
    fi
    ;;
  uat|prod)
    TFVARS="terraform.${TARGET}.tfvars"
    if [[ ! -f "$TF_DIR/$TFVARS" ]]; then
      echo "Missing $TF_DIR/$TFVARS. Copy $TFVARS.example and fill non-secret values first." >&2
      exit 1
    fi

    cd "$TF_DIR"
    terraform init -reconfigure
    terraform workspace select "$TARGET" || terraform workspace new "$TARGET"
    terraform validate
    if [[ "$ACTION" == "plan" ]]; then
      terraform plan -var-file="$TFVARS"
    else
      terraform apply -var-file="$TFVARS"
      echo
      echo "Backend DNS records are managed automatically in Route53."
      echo
      echo "Requested backend ACM certificate ARN:"
      terraform output -raw backend_acm_certificate_arn
    fi
    ;;
  *)
    echo "Target must be 'state', 'uat', or 'prod'." >&2
    usage
    exit 1
    ;;
esac
