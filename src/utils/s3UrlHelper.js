/**
 * s3UrlHelper.js
 *
 * Centralised helper for building public S3 / CloudFront URLs for uploaded files.
 *
 * When multer-s3 stores a file, req.file.location contains the full S3 URL.
 * For files that were stored before the S3 migration (or when only the
 * filename is stored in the DB), this helper reconstructs the full URL.
 *
 * Environment variables used:
 *   AWS_S3_BUCKET      – S3 bucket name (default: grantmaestro-uploads)
 *   AWS_REGION         – AWS region (default: ap-southeast-2)
 *   AWS_SES_REGION     – fallback region if AWS_REGION is not set
 *   CLOUDFRONT_DOMAIN  – optional CloudFront domain (e.g. cdn.grantmaestro.com)
 */

const S3_BUCKET = process.env.AWS_S3_BUCKET || 'grantmaestro-uploads';
const REGION    = process.env.AWS_REGION || process.env.AWS_SES_REGION || 'ap-southeast-2';
const CDN       = process.env.CLOUDFRONT_DOMAIN;

/**
 * Returns the base URL for a given S3 folder.
 * Includes a trailing slash.
 *
 * @param {string} folder  – S3 folder prefix, e.g. 'profile_images'
 * @returns {string}
 */
export const s3BaseUrl = (folder) => {
    if (CDN) {
        return `https://${CDN}/${folder}/`;
    }
    return `https://${S3_BUCKET}.s3.${REGION}.amazonaws.com/${folder}/`;
};

/**
 * Builds a full URL for a profile image filename.
 * If the value already looks like a full URL (starts with http), returns it as-is.
 *
 * @param {string|null} filename
 * @returns {string}
 */
export const profileImageUrl = (filename) => {
    if (!filename) return '';
    if (filename.startsWith('http')) return filename;
    return s3BaseUrl('profile_images') + filename;
};

/**
 * Builds a full URL for an organisation logo filename.
 */
export const orgLogoUrl = (filename) => {
    if (!filename) return '';
    if (filename.startsWith('http')) return filename;
    return s3BaseUrl('organization_logos') + filename;
};

/**
 * Builds a full URL for a file vault document filename.
 */
export const fileVaultUrl = (filename) => {
    if (!filename) return '';
    if (filename.startsWith('http')) return filename;
    return s3BaseUrl('file_vault') + filename;
};

/**
 * Builds a full URL for a support ticket attachment filename.
 */
export const supportTicketFileUrl = (filename) => {
    if (!filename) return '';
    if (filename.startsWith('http')) return filename;
    return s3BaseUrl('support_tickets') + filename;
};

/**
 * Generic helper – pass the multer fieldname and the stored filename.
 */
export const buildFileUrl = (fieldname, filename) => {
    if (!filename) return '';
    if (filename.startsWith('http')) return filename;

    switch (fieldname) {
        case 'profile_image':         return profileImageUrl(filename);
        case 'organization_logo':     return orgLogoUrl(filename);
        case 'report_file':
        case 'report_template_file':  return fileVaultUrl(filename);
        case 'support_ticket_file':   return supportTicketFileUrl(filename);
        default:                      return s3BaseUrl('misc') + filename;
    }
};
