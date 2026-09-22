import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({
  path: process.env.CONFIG_ENV_PATH
    || path.resolve(__dirname, '../config/config.env'),
})
