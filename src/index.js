import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'
import swaggerJsDoc from 'swagger-jsdoc'
import dotenv from 'dotenv'
import errorHandler from './middlewares/error.js'
import grantMaestroRouter from './routes/v1/index.js'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { paymentWebhook } from './controllers/paymentController.js'
import { fileURLToPath } from 'url'

dotenv.config({ path: './config/config.env' })

const app = express()
app.enable('trust proxy')

// ── Security headers ────────────────────────────────────────────────────────
app.use(helmet())

// ── Rate limiting ────────────────────────────────────────────────────────────
// Strict limiter for authentication endpoints (login, signup, password reset)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
})

// General API limiter for all other routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
})

app.use('/v1/auth/login', authLimiter)
app.use('/v1/auth/signup', authLimiter)
app.use('/v1/auth/forgot-password', authLimiter)
app.use('/v1/auth/reset-password', authLimiter)
app.use('/v1', apiLimiter)

// Files are now served from Amazon S3 — local /uploads static middleware removed.
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf
    },
  })
)
app.use(express.urlencoded({ extended: true }))

// CORS origins are loaded from CORS_ORIGINS in config.env (comma-separated).
// Example: CORS_ORIGINS=http://localhost:3000,https://grantmaestro.com
const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS: origin '${origin}' is not allowed`))
    }
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}
app.use(cookieParser())
app.use(cors(corsOptions))
app.use('/v1', grantMaestroRouter)
app.post('/webhook', paymentWebhook)

app.use(errorHandler)

const PORT = process.env.PORT
const MODE = process.env.MODE
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const swaggerOptions = {
  swaggerDefinition: {
    openapi: '3.0.0',
    info: {
      title: 'Grant Maestro API',
      version: '1.0.0',
      description: 'API documentation',
    },
    servers: [{ url: 'http://localhost:3005' }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }], // Applies globally
  },
  apis: [
    path.join(__dirname, './routes/v1/*.js'),
    path.join(__dirname, './controllers/*.js'),
  ],
}

const swaggerDocs = swaggerJsDoc(swaggerOptions)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs))

let server = {}
if (MODE === 'development') {
  server = app.listen(PORT, () => {
    console.log(`Server running in ${MODE} mode on port ${PORT}`)
  })
} else {
  const options = {
    key: fs.readFileSync('/etc/letsencrypt/live/grantmaestro.com/privkey.pem'),
    cert: fs.readFileSync(
      '/etc/letsencrypt/live/grantmaestro.com/fullchain.pem'
    ),
  }
  server = https.createServer(options, app).listen(PORT, () => {
    console.log(`Secure server is running on https://localhost:${PORT}`)
  })
}

process.on('unhandledRejection', (err) => {
  console.error(`Unhandled rejection: ${err.message || err}`)
  server.close(() => process.exit(1))
})
