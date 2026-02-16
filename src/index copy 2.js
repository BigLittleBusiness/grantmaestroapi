import express from 'express'
import dotenv from 'dotenv'
import errorHandler from './middlewares/error.js'
import adminRouter from './routes/admin.js'
import cors from 'cors'
import https from 'https'
import fs from 'fs'
import {paymentWebhook} from './controllers/paymentController.js'

dotenv.config({ path: './config/config.env' })

const app = express()
app.enable('trust proxy')
app.use('/uploads', express.static('uploads'))
// app.use(express.json())
// app.use(express.urlencoded({ extended: true }))



app.use(express.json({
  verify: (req, res, buf) => {
      req.rawBody = buf
  }
}));
app.use(express.urlencoded({ extended: true }));

// use it before all route definitions

const corsOptions = {
  origin: '*',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  // allowedHeaders:'Content-Type,X-Requested-With,Authorization,timeOffset',
  allowedHeaders: '*',
  preflightContinue: true,
}
app.use(cors(corsOptions))
app.use('/admin', adminRouter)
app.post('/webhook', paymentWebhook)

app.use(errorHandler)

const PORT = process.env.PORT
const MODE = process.env.MODE

// const fs = require('fs');
//const express = require('express');
//const app = express();
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
