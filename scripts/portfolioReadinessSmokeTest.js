import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import pug from 'pug'

const root = new URL('..', import.meta.url)
const read = (relativePath) => readFile(new URL(relativePath, root), 'utf8')

const controller = await read('src/controllers/portfolioReadinessController.js')
const route = await read('src/routes/v1/portfolioReadiness.js')
const routeRegistry = await read('src/routes/v1/index.js')
const server = await read('src/index.js')
const insightUtility = await read('src/utils/portfolioReadinessInsights.js')

assert.match(controller, /verifyTurnstile\(req\.body\.captchaToken, req\.ip\)/)
assert.match(controller, /marketingConsent === true/)
assert.match(controller, /if \(website\) return res\.status\(200\)/)
assert.match(controller, /Action-plan email delivery is temporarily unavailable/)
assert.match(controller, /GrantMaestro - Your Grant Portfolio Readiness Action Plan/)
assert.match(controller, /GrantMaestro - Portfolio readiness action plan request/)
assert.match(route, /portfolioReadinessRouter\.get\('\/config'/)
assert.match(route, /portfolioReadinessRouter\.post\('\/interpretation', interpretationStartLimiter, interpretPortfolioReadiness\)/)
assert.match(route, /portfolioReadinessRouter\.get\('\/interpretation\/:analysisId', interpretationStatusLimiter, getPortfolioReadinessInterpretationStatus\)/)
assert.match(route, /portfolioReadinessRouter\.post\('\/', actionPlanLimiter, submitPortfolioReadinessRequest\)/)
assert.match(routeRegistry, /router\.use\('\/public\/portfolio-readiness', portfolioReadinessRouter\)/)
assert.doesNotMatch(server, /app\.use\('\/v1\/public\/portfolio-readiness', publicFormLimiter\)/)
assert.match(insightUtility, /normaliseReadinessAnswers/)
assert.match(insightUtility, /MANUS_READINESS_ANALYSIS_ENABLED/)
assert.match(insightUtility, /MANUS_API_KEY/)
assert.match(insightUtility, /\/v2\/task\.create/)
assert.match(insightUtility, /\/v2\/task\.listMessages/)
assert.doesNotMatch(insightUtility, /callClaudeText|ANTHROPIC_API_KEY|claude-/i)

for (const template of ['portfolioReadinessActionPlan', 'portfolioReadinessLeadAlert']) {
  pug.compileFile(new URL(`src/emails/${template}.pug`, root).pathname)
}

console.log('Portfolio readiness API smoke tests passed.')
