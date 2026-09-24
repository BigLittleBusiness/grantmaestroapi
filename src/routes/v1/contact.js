import express from 'express'
import {
  getContactFormConfiguration,
  submitContactEnquiry,
} from '../../controllers/contactController.js'

const contactRouter = express.Router()

// The site key is designed to be public. The secret never leaves the server.
contactRouter.get('/config', getContactFormConfiguration)
contactRouter.post('/', submitContactEnquiry)

export default contactRouter
