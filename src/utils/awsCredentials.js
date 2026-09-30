/**
 * Static keys when both are provided; otherwise undefined, so the AWS SDK uses
 * its default provider chain (the ECS task role in UAT/production).
 */
export const awsCredentials = (accessKeyId, secretAccessKey) => (
  accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined
)

// Set by ECS (task role) and EKS/web identity; the SDK reads them automatically.
const hasRoleCredentials = () => Boolean(
  process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI
  || process.env.AWS_CONTAINER_CREDENTIALS_FULL_URI
  || process.env.AWS_WEB_IDENTITY_TOKEN_FILE
)

export const hasAwsCredentials = (accessKeyId, secretAccessKey) => (
  Boolean(awsCredentials(accessKeyId, secretAccessKey)) || hasRoleCredentials()
)
