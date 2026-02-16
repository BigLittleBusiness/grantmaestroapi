import asyncHandler from '../middlewares/async.js'
import base from '../models/base.js'
import Stripe from 'stripe'
import sendEmail from '../utils/mailHelper.js'
import moment from 'moment'

const { User, SubscriptionPlans } = base

export const createCheckoutSession = asyncHandler(async (req, res, next) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  const { preferred_plan_id, payment_made_for } = req.body
  const planInfo = await SubscriptionPlans.findOne({
    plan_id: preferred_plan_id,
  })
  if (!planInfo) {
    return res.send({
      status: false,
      message: 'payment session created successfully',
    })
  }
  const stripe_plan_id = planInfo.stripe_plan_id
  const lineItems = [
    {
      price: stripe_plan_id, //'price_1RErltRNoNos9SpYDOwZIzUj',
      quantity: 1,
    },
  ]
  const memberInfo = await User.findOne({
    where: { user_id: payment_made_for },
  })
  if (!memberInfo) {
    return res.send({
      status: false,
      message: 'Member does not exist',
    })
  }
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    customer_email: memberInfo.email,
    line_items: lineItems,
    metadata: {
      user_id: payment_made_for,
    },
    mode: 'subscription',
    success_url: `${process.env.STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`, //http://localhost:3000/success ,
    cancel_url: process.env.STRIPE_CANCEL_URL,
  })
  console.log(session.expires_at)
  moment(session.expires_at).format('YYYY-MM-DD')
  res.send({
    status: true,
    message: 'payment session created successfully',
    data: { id: session.id, url: session.url },
  })
})

export const paymentWebhook = asyncHandler(async (req, res, next) => {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  
  const sig = req.headers['stripe-signature']
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET
  let event
  try {
    
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret)
    sendEmail(
        'sahinfarzina84@gmail.com',
        `Webhook mail for :${event.type}`,
        'webhook',
        {
          subscriptionInfo: '',
          payment_made_for: '',
          stripe_subscription_id: ''
        },
        null // Attachments (optional)
    )
    
    if(event.type == 'checkout.session.completed'){
      const subscriptionInfo = event.data.object
      const userId = subscriptionInfo.metadata.user_id
      const subscriptionId = subscriptionInfo.subscription
      const customerId = subscriptionInfo.customer
      sendEmail(
        'sahinfarzina84@gmail.com',
        'Webhook mail for :checkout.session.completed',
        'webhook',
        {
          subscriptionInfo: subscriptionInfo,
          payment_made_for: userId,
          stripe_subscription_id: subscriptionId
        },
        null // Attachments (optional)
      )
    }
    if (event.type == 'customer.subscription.updated') {
      const subscriptionInfo = event.data.object
      // Email id is hardcoded for testing purpose
      sendEmail(
        'sahinfarzina84@gmail.com',
        'Webhook mail',
        'webhook',
        {
          subscriptionInfo: subscriptionInfo,
        },
        null // Attachments (optional)
      )
    }
  } catch (err) {
    return res
      .status(200)
      .send({ status: false, message: '', Error: err.message })
  }
  console.log(event.type)
  res.send({
    status: true,
    message: 'payment information updated successfully',
  })
})
