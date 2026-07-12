#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="$ROOT_DIR/terraform-state"
AWS_REGION="${AWS_REGION:-ap-southeast-2}"
STATE_BACKEND_BUCKET="grantmaestro-terraform-state-backend-434978747146"
STATE_FRONTEND_BUCKET="grantmaestro-terraform-state-frontend-434978747146"
STATE_LOCK_TABLE="grantmaestro-terraform-locks"
STATE_MANAGEMENT_KEY="state-management/terraform.tfstate"
DOMAIN_NAME="grantmaestro.com"

cd "$STATE_DIR"

terraform init -input=false -migrate-state -force-copy \
  -backend-config="bucket=${STATE_BACKEND_BUCKET}" \
  -backend-config="key=${STATE_MANAGEMENT_KEY}" \
  -backend-config="region=${AWS_REGION}" \
  -backend-config="encrypt=true" \
  -backend-config="dynamodb_table=${STATE_LOCK_TABLE}"

import_if_missing() {
  local address="$1"
  local id="$2"

  if terraform state show "$address" >/dev/null 2>&1; then
    echo "Already adopted: ${address}"
  else
    terraform import "$address" "$id"
  fi
}

import_if_missing aws_s3_bucket.terraform_state_backend "$STATE_BACKEND_BUCKET"
import_if_missing aws_s3_bucket_versioning.terraform_state_backend "$STATE_BACKEND_BUCKET"
import_if_missing aws_s3_bucket_server_side_encryption_configuration.terraform_state_backend "$STATE_BACKEND_BUCKET"
import_if_missing aws_s3_bucket_public_access_block.terraform_state_backend "$STATE_BACKEND_BUCKET"
import_if_missing aws_s3_bucket_lifecycle_configuration.terraform_state_backend "$STATE_BACKEND_BUCKET"

import_if_missing aws_s3_bucket.terraform_state_frontend "$STATE_FRONTEND_BUCKET"
import_if_missing aws_s3_bucket_versioning.terraform_state_frontend "$STATE_FRONTEND_BUCKET"
import_if_missing aws_s3_bucket_server_side_encryption_configuration.terraform_state_frontend "$STATE_FRONTEND_BUCKET"
import_if_missing aws_s3_bucket_public_access_block.terraform_state_frontend "$STATE_FRONTEND_BUCKET"
import_if_missing aws_s3_bucket_lifecycle_configuration.terraform_state_frontend "$STATE_FRONTEND_BUCKET"

import_if_missing aws_dynamodb_table.terraform_locks "$STATE_LOCK_TABLE"

HOSTED_ZONE_ID="$(aws route53 list-hosted-zones-by-name \
  --dns-name "$DOMAIN_NAME" \
  --query "HostedZones[?Name=='${DOMAIN_NAME}.' && Config.PrivateZone==\`false\`].Id | [0]" \
  --output text)"

if [[ -n "$HOSTED_ZONE_ID" && "$HOSTED_ZONE_ID" != "None" ]]; then
  import_if_missing aws_route53_zone.primary "${HOSTED_ZONE_ID#/hostedzone/}"
else
  echo "No existing public Route53 hosted zone found for ${DOMAIN_NAME}; skipping hosted zone adoption."
fi

echo
echo "Adoption complete. Review drift with:"
echo "  AWS_PROFILE=grantmaestro terraform -chdir=$STATE_DIR plan"
