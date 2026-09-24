import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import pug from 'pug'

const root = new URL('..', import.meta.url)
const read = (relativePath) => readFile(new URL(relativePath, root), 'utf8')

const encodedRecipient = 'aGVsbG9AYmlnbGl0dGxlYnVzaW5lc3MuY29t'
process.env.CONTACT_RECIPIENT_B64 = encodedRecipient
const { getContactRecipient } = await import('../src/utils/contactRecipient.js')

assert.equal(
  getContactRecipient(),
  Buffer.from(encodedRecipient, 'base64').toString('utf8'),
  'Encoded contact recipient should resolve server-side'
)

const contactController = await read('src/controllers/contactController.js')
assert.match(contactController, /GrantMaestro - \$\{enquiryTypes\[enquiryType\]\}/)
assert.match(contactController, /verifyTurnstile\(req\.body\.captchaToken, req\.ip\)/)
assert.match(contactController, /getContactRecipient\(\)/)

const ticketController = await read('src/controllers/ticketController.js')
assert.match(ticketController, /verifyTurnstile\(captchaToken, req\.ip\)/)
assert.match(ticketController, /GrantMaestro - Support enquiry/)

const contactRoute = await read('src/routes/v1/contact.js')
assert.match(contactRoute, /contactRouter\.post\('\/', submitContactEnquiry\)/)

for (const template of ['contactEnquiry', 'supportTicketAlert']) {
  const templatePath = new URL(`src/emails/${template}.pug`, root)
  pug.compileFile(templatePath.pathname)
}

const frontendFiles = [
  'src/components/LandingPage/Footer.jsx',
  'src/pages/LegalPages.jsx',
  'src/pages/Auth/ForcePasswordReset.jsx',
]
for (const file of frontendFiles) {
  const contents = await read(new URL(`../../grantmaestroui/${file}`, import.meta.url).pathname)
  assert.doesNotMatch(contents, /mailto:/i, `${file} must not expose a mailto link`)
}

console.log('Contact release smoke tests passed.')
