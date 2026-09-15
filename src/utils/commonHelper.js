import crypto from "crypto";
import multer from "multer";
import multerS3 from "multer-s3";
import path from "path";
import Randomstring from "randomstring";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { encryptSetting as encrypt, decryptSetting as decrypt } from './settingsCrypto.js';

// ---------------------------------------------------------------------------
// Amazon S3 client
// ---------------------------------------------------------------------------
const S3_REGION = process.env.AWS_S3_REGION || process.env.AWS_REGION || 'ap-southeast-2';
const S3_BUCKET = process.env.AWS_S3_BUCKET || '';
const isS3Configured = Boolean(
    S3_BUCKET && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
);
const s3 = isS3Configured
    ? new S3Client({
        region: S3_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
    })
    : null;

/**
 * Maps a Multer fieldname to an S3 folder prefix.
 */
const getS3Folder = (fieldname) => {
    switch (fieldname) {
        case 'profile_image':  return 'profile_images';
        case 'organization_logo': return 'organization_logos';
        case 'report_file':
        case 'report_template_file': return 'file_vault';
        case 'support_ticket_file': return 'support_tickets';
        default: return 'misc';
    }
};

// ---------------------------------------------------------------------------
// S3 Multer storage engine
// ---------------------------------------------------------------------------
const s3Storage = isS3Configured
    ? multerS3({
        s3,
        bucket: S3_BUCKET,
        acl: 'private',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key: (req, file, cb) => {
            const folder = getS3Folder(file.fieldname);
            const ext = path.extname(file.originalname);
            cb(null, `${folder}/${file.fieldname}-${Date.now()}${ext}`);
        },
    })
    : multer.memoryStorage();

// ---------------------------------------------------------------------------
// Multer upload instance (S3-backed)
// ---------------------------------------------------------------------------
const imageUpload = multer({
    storage: s3Storage,
    limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter(req, file, cb) {
        if (!isS3Configured) {
            return cb(new Error('File storage is not configured. Please configure AWS S3 before uploading files.'));
        }
        if (file.fieldname === 'profile_image' || file.fieldname === 'organization_logo') {
            if (!file.originalname.match(/\.(jpg|jpeg|png|JPEG|JPG|PNG)$/)) {
                return cb(new Error('Please upload a valid image file (jpg, jpeg or png)'));
            }
        } else {
            if (!file.originalname.match(/\.(jpg|jpeg|png|heif|heic|JPEG|JPG|PNG|HEIF|HEIC|xlsx|xls)$/)) {
                return cb(new Error('Please upload a valid file (jpg, jpeg, png, heif, heic, xlsx or xls)'));
            }
        }
        cb(undefined, true);
    },
});

// ---------------------------------------------------------------------------
// Temp in-memory uploader (for xlsx processing – unchanged)
// ---------------------------------------------------------------------------
const fileExtentionValidate = (req, file, cb) => {
    switch (file.fieldname) {
        case 'upload_cases':
        case 'contact_list_file':
            if (!file.originalname.match(/\.(xlsx)$/)) {
                return cb('Only xlsx file is allowed!', false);
            }
            break;
        default:
            break;
    }
    cb(null, true);
};

const tempFileUploader = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileExtentionValidate,
});

// ---------------------------------------------------------------------------
// S3 file deletion helper
// Accepts either a full S3 URL or just the S3 key.
// ---------------------------------------------------------------------------
const unlinkFile = async (filePathOrUrl) => {
    if (!filePathOrUrl) return;

    let key = filePathOrUrl;

    // If it looks like a URL, extract the key portion after the bucket
    if (filePathOrUrl.startsWith('http')) {
        try {
            const url = new URL(filePathOrUrl);
            // pathname starts with '/', strip leading slash
            key = url.pathname.replace(/^\//, '');
            // If the bucket name is part of the path (path-style URL), strip it
            if (key.startsWith(S3_BUCKET + '/')) {
                key = key.slice(S3_BUCKET.length + 1);
            }
        } catch {
            // Not a valid URL – use as-is
        }
    }

    if (!isS3Configured) {
        console.warn('[S3] Delete skipped because AWS S3 is not configured.');
        return;
    }
    try {
        await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    } catch (err) {
        console.error(`[S3] Failed to delete object "${key}":`, err.message);
    }
};

/**
 * Returns the public (or CloudFront) base URL for a given S3 folder.
 * If CLOUDFRONT_DOMAIN is set, uses that; otherwise falls back to the
 * standard S3 URL format.
 */
const getFileBaseURL = async (modelFieldName = '', host = '') => {
    const folder = await getFileStorageFolder(modelFieldName);
    if (!folder) return '';

    const cdn = process.env.CLOUDFRONT_DOMAIN;
    if (cdn) {
        return `https://${cdn}/${folder}/`;
    }
    if (!isS3Configured) return '';
    return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${folder}/`;
};

const getFileBasePath = async (modelFieldName = '') => {
    // For S3, there is no local path – return the S3 folder prefix instead
    const folder = await getFileStorageFolder(modelFieldName);
    return folder ? `${folder}/` : '';
};

const getFileStorageFolder = async (modelFieldName) => {
    switch (modelFieldName) {
        case 'profile_image':       return 'profile_images';
        case 'organization_logo':   return 'organization_logos';
        case 'report_file':
        case 'report_template_file': return 'file_vault';
        case 'support_ticket_file': return 'support_tickets';
        case 'case_category_image': return 'case_category_images';
        case 'case_files':          return 'case_files';
        default:                    return '';
    }
};

const removeFile = async (tableFieldName = '', fileName = '') => {
    const folder = await getFileStorageFolder(tableFieldName);
    if (folder && fileName) {
        await unlinkFile(`${folder}/${fileName}`);
        return true;
    }
    return false;
};

// ---------------------------------------------------------------------------
// Misc helpers (unchanged)
// ---------------------------------------------------------------------------
const generateRandomString = async (ln = 10, isNumeric = 0) => {
    const charset = isNumeric ? 'numeric' : 'alphanumeric';
    return Randomstring.generate({ length: ln, charset, capitalization: 'uppercase' });
};

const generateUserCode  = async () => generateRandomString(8);
const generatePassword  = async () => generateRandomString(8);
const generateOTP       = async () => generateRandomString(6, 1);
const generateCaseCode  = async () => generateRandomString(6, 1);

const getSiteConstants = async (constantType = '', convertToArray = false) => {
    const allConsts = {
        'user_types': {
            '1': 'Super Admin', '2': 'General Registrar', '3': 'Arbitration Registrar',
            '4': 'Mediation Registrar', '5': 'Dipti Arbitration Registrar',
            '6': 'Dipti Mediation Registrar', '7': 'Arbitrator', '8': 'Mediator',
            '9': 'Bank', '10': 'Normal User', '11': 'Central Coordinator',
            '12': 'Relationship Manager', '13': 'Case Manager',
        },
        'contact_us_person_type': {
            '1': 'Lawyer', '2': 'Mediator', '3': 'Arbitrator',
            '4': 'In House Counsel', '5': 'Student', '6': 'Others',
        },
        'case_loan_customer': { '1': 'Borrower', '2': 'Co-Borrower', '3': 'Guarantor' },
        'case_types': { '1': 'Mediation', '2': 'Arbitration' },
    };

    if (constantType && allConsts[constantType]) {
        const resObj = allConsts[constantType];
        if (convertToArray) {
            return Object.entries(resObj).map(([type_id, type_name]) => ({ type_id, type_name }));
        }
        return resObj;
    }
    return allConsts;
};

const capitalizeFirstLetter = async (string) =>
    string.charAt(0).toUpperCase() + string.slice(1);

const isValidEmail = async (email) => {
    const emailRegex = /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;
    return emailRegex.test(email);
};

/**
 * Safely formats a full name from first, middle, and last name parts.
 * Filters out null, undefined, and empty strings so no double spaces appear
 * when a middle name is absent.
 */
const formatFullName = (firstName, middleName, lastName) =>
    [firstName, middleName, lastName]
        .filter((part) => part && part.trim() !== '')
        .join(' ');

const countStringOccurance = async (s1, s2) => {
    let count = 0;
    let pos   = 0;
    while ((pos = s1.indexOf(s2, pos)) !== -1) {
        count++;
        pos += s2.length;
    }
    return count;
};

export default {
    encrypt,
    decrypt,
    imageUpload,
    unlinkFile,
    tempFileUploader,
    generateUserCode,
    generatePassword,
    generateOTP,
    getSiteConstants,
    generateCaseCode,
    capitalizeFirstLetter,
    isValidEmail,
    getFileBasePath,
    getFileBaseURL,
    removeFile,
    countStringOccurance,
    formatFullName,
    isS3Configured,
};
