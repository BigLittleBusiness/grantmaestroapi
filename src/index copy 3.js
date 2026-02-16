import express from 'express'
import swaggerUi from 'swagger-ui-express'
import swaggerJsDoc from 'swagger-jsdoc'
import dotenv from 'dotenv'
import errorHandler from './middlewares/error.js'
import grantMaestroRouter from './routes/v1/index.js'
import cors from 'cors'
import https from 'https'
import fs from 'fs'
import path from 'path'
import { paymentWebhook } from './controllers/paymentController.js'
import { fileURLToPath } from 'url'

dotenv.config({ path: './config/config.env' })

const app = express()
app.enable('trust proxy')
app.use('/uploads', express.static('uploads'))

app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf
    },
  })
)
app.use(express.urlencoded({ extended: true }))

const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  // allowedHeaders:'Content-Type,X-Requested-With,Authorization,timeOffset',
  allowedHeaders: '*',
  preflightContinue: true,
}
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

// const swaggerUiOptions = {
//   swaggerOptions: {
//     requestInterceptor: (req) => {
//       req.headers.Authorization = `Bearer YOUR_TOKEN_HERE`
//       return req
//     },
//   },
// }

const swaggerDocs = swaggerJsDoc(swaggerOptions)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs))

let server = {}
console.log('MODE:', MODE)
if (MODE === 'development') {
  server = app.listen(PORT, () => {
    console.log(`Server is running in ${MODE} mode at port ${PORT}`)
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

process.on('unhandledRejection', (err, promise) => {
  console.log(`Error:${err}`)
  server.close(() => process.exit(1))
})
