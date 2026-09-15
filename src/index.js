import './env.js' // MUST be first — loads dotenv before any other module reads process.env
import express from 'express'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import swaggerUi from 'swagger-ui-express'
import swaggerJsDoc from 'swagger-jsdoc'
import errorHandler from './middlewares/error.js'
import grantMaestroRouter from './routes/v1/index.js'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { paymentWebhook } from './controllers/paymentController.js'
import './scheduledJobs.js'
import { fileURLToPath } from 'url'

const app = express()
app.set('trust proxy', 1)

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

// Stripe signs the exact raw request payload, so this route must be registered
// before express.json() parses the body.
app.post('/v1/subscription/stripe-webhook', express.raw({ type: 'application/json' }), paymentWebhook)

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
const allowedOrigins = [
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS || 'http://localhost:3000').split(','),
]
  .map((origin) => origin?.trim())
  .filter(Boolean)

const normaliseOrigin = (origin) => origin
  .replace(/:80$/, '')
  .replace(/:443$/, '')

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. server-to-server webhooks and curl).
    const originAllowed = origin && allowedOrigins.some(
      (allowedOrigin) => normaliseOrigin(allowedOrigin) === normaliseOrigin(origin)
    )
    if (!origin || originAllowed) {
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
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'grantmaestro-api',
    domain: 'grantmaestro.com',
  })
})
app.use('/v1', grantMaestroRouter)

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

const CERT_PATH = '/etc/letsencrypt/live/grantmaestro.com/privkey.pem'
let server = {}
if (process.env.ENABLE_HTTPS !== 'true') {
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
