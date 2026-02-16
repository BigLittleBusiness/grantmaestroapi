import crypto from "crypto";
import multer from "multer";
import path from "path";
import Randomstring from "randomstring";
import { fileURLToPath } from 'url';
import fs from "fs";
const __filename = fileURLToPath(import.meta.url); // get the resolved path to the file
const __dirname = path.dirname(__filename); 
const uploadPath = path.resolve(__dirname, '../../uploads');
const encrypt = function (text) {
    const algorithm = 'aes-256-cbc';
    
    const key_new = 'g6ZOpvHQ78X4PbLzmU5eErPRtdh6mAXp';
    const iv_new = 'o6SG75PDEbNTBYJV';

    var cipher = crypto.createCipheriv(algorithm,key_new,iv_new)
    var crypted = cipher.update(text,'utf8','hex')
    crypted += cipher.final('hex');
    return crypted;
}

const decrypt = function (text) {
    
    const algorithm = 'aes-256-cbc';
    
    const key_new = 'g6ZOpvHQ78X4PbLzmU5eErPRtdh6mAXp';
    const iv_new = 'o6SG75PDEbNTBYJV';

    var decipher = crypto.createDecipheriv(algorithm,key_new,iv_new)
    var dec = decipher.update(text,'hex','utf8')
    dec += decipher.final('utf8');
    return dec;
}

var fileStorage = multer.diskStorage({
    destination:function (req, file, cb){
        if (file.fieldname === "profile_image"){
            cb(null, uploadPath+'/profile_image');
        }else if(file.fieldname === "organization_logo"){
            cb(null, uploadPath+'/organization_logo');
        }else if(file.fieldname === "report_file"){
            cb(null, uploadPath+'/file_vault');
        }else if(file.fieldname === "report_template_file"){
            cb(null, uploadPath+'/file_vault');
        }else if(file.fieldname === "support_ticket_file"){
            cb(null, uploadPath+'/support_ticket');
        }else{
            cb(null, uploadPath+'/profile_image')
        }
    },
    filename:function(req,file,cb){
        cb(null,file.fieldname+'-'+Date.now()+path.extname(file.originalname))
    }
})
const imageUpload = multer({
    storage:fileStorage,
    limits:{filesize:10},
    fileFilter(req, file, cb) {
        // console.log(file)
        if (file.fieldname === "profile_images"){
            if (!file.originalname.match(/\.(jpg|jpeg|png|JPEG|JPG|PNG)$/)) {
                return cb(new Error('Please upload an valid image file'))
            }
        }if (file.fieldname === "organization_logo"){
            if (!file.originalname.match(/\.(jpg|jpeg|png|JPEG|JPG|PNG)$/)) {
                return cb(new Error('Please upload an valid image file'))
            }
        }else{
            if (!file.originalname.match(/\.(jpg|jpeg|png|heif|heic|JPEG|JPG|PNG|HEIF|HEIC|xlsx|xls)$/)) {
                return cb(new Error('Please upload an valid image file with extension jpg, jpeg or png'))
            }
        }
        // if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
        //     return cb(new Error('Please upload an valid image file'))
        // }
        cb(undefined, true)
    }
})

const fileExtentionValidate = (req, file, cb) => {
    switch(file.fieldname){
        case 'upload_cases':
            if (!file.originalname.match(/\.(xlsx)$/)) {
                return cb('Only xlsx file is allowed!', false);
            }
            break
        case 'contact_list_file':
            if (!file.originalname.match(/\.(xlsx)$/)) {
                return cb('Only xlsx file is allowed!', false);
            }
            break
        default:
            console.log("file not define")
    }
    cb(null, true);
}

const tempFileUploader = multer({
    storage:multer.memoryStorage(),
    fileFilter: fileExtentionValidate,
})

const unlinkFile = async (filePath) => {
    
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
    }
    return 
}

const generateRandomString = async(ln=10, isNumeric=0)=>{
    ln = (ln)?ln:10;
    var charset = "alphanumeric"
    if(isNumeric){
        charset = "numeric"
    }
    //var referralCode = ""
    const referralCode = await Randomstring.generate({
        length: ln,
        charset: charset,
        capitalization:'uppercase'
    });
    return referralCode
}

const generateUserCode = async() => {
    return await generateRandomString(8)
}

const generatePassword = async() => {
    return await generateRandomString(8)
}
const generateOTP = async() => {
    return await generateRandomString(6,1)
}

const generateCaseCode = async() => {
    return await generateRandomString(6,1)
}

//defind and fet return the constants
const getSiteConstants = async(constantType="", convertToArray=false) => {
    //defind the the var 
    let allConsts = {
        'user_types':{
            "1":"Super Admin",
            "2":"General Registrar",
            "3":"Arbitration Registrar",
            "4":"Mediation Registrar",
            "5":"Dipti Arbitration Registrar",
            "6":"Dipti Mediation Registrar",
            "7":"Arbitrator",
            "8":"Mediator",
            "9":"Bank",
            "10":"Normal User",
            "11":"Central Coordinator",
            "12":"Relationship Manager",
            "13":"Case Manager",
        },
        "contact_us_person_type":{
            "1":"Lawyer",
            "2":"Mediator",
            "3":"Arbitrator",
            "4":"In House Counsel",
            "5":"Student",
            "6":"Others",
        },
        "case_loan_customer":{
            "1":"Borrower",
            "2":"Co-Borrower",
            "3":"Guarantor",
        },
        "case_types":{
            "1":"Mediation",
            "2":"Arbitration",
        }
    }
    if(constantType && constantType.length>0){
        if(allConsts.hasOwnProperty(constantType)){
            let resObj = allConsts[constantType]
            if(convertToArray){
                var resArr = []
                for( let k in resObj){
                    if(resObj.hasOwnProperty(k)){
                        resArr.push({
                            type_id:k,
                            type_name:resObj[k]
                        })
                    }
                }
                return resArr
            }else{
                return resObj
            }
        }else{
            return {}
        }
    }
    return allConsts
}
const capitalizeFirstLetter = async(string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

const isValidEmail = async (email) => {
    let emailRegex = /^[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](-*\.?[a-zA-Z0-9])*\.[a-zA-Z](-?[a-zA-Z0-9])+$/;
    let valid = emailRegex.test(email);
    return valid;
}

const getFileBasePath = async(modelFiledName="") => {
    var fullpath=""
    const folderName = await getFileStorageFolder(modelFiledName)
    if(folderName.length>0){
        fullpath = uploadPath + "/" + folderName + "/"
    }
    return fullpath
}

const getFileBaseURL = async(modelFiledName="", host="") => {
    var fullpath=""
    const basePath="/uploads/"
    const folderName = await getFileStorageFolder(modelFiledName)
    if(folderName.length>0){
        fullpath = host + basePath + folderName + "/"
    }
    return fullpath
}

const getFileStorageFolder = async (modelFiledName) => {
    var folderName=""
    switch(modelFiledName){
        case 'case_category_image':
            folderName = 'case_category_images'
            break
        case "case_files":
            folderName = 'case_files'
        default:
    }
    return folderName
}

const removeFile = async (table_field_name="", file_name="") => {
    let fileBasePath  = await getFileBasePath(table_field_name)
    if(fileBasePath.length>0 && file_name.length>0){
        let filePath = fileBasePath + file_name
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            return true
        }
    }
    /*
    var folderName = await getFileStorageFolder(table_field_name)
    if(folderName.length>0 && file_name.length>0){
        let filePath = uploadPath + "/" + folderName + "/" + file_name
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            return true
        }
    }*/
    return false
}


const countStringOccurance = async(s1, s2) => {
    let count = 0;
    let pos = 0;
    while ((pos = s1.indexOf(s2, pos)) !== -1) {
        count++;
        // Move past the current match
        pos += s2.length; 
    }
    return count
}

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
    countStringOccurance
}