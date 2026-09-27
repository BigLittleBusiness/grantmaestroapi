# Portfolio Readiness Insight — BinaryLane AI Configuration

## Purpose

The public `/grant-portfolio-readiness` page gives each visitor an expanded outcome-focused interpretation immediately after their nine answers and before the optional action-plan email form.

It always has a **guided interpretation** derived from the answer pattern. This requires no third-party service, does not need a secret and is the safe default if the AI provider is unavailable, capped or disabled.

An optional server-side model can refine that interpretation. It must run from the **GrantMaestro API on the BinaryLane VPS**. The React browser bundle never receives an AI credential and does not call the provider directly.

## Privacy and data boundary

Only this anonymous information is sent to the configured provider when AI refinement is enabled:

- nine fixed question identifiers;
- one integer score from `0` to `3` for each; and
- the derived category pattern.

The provider does **not** receive a visitor’s name, email, organisation, role, grant data, funder data, financial data, documents, IP address, cookies or free-text input. The API does not persist the anonymous result. A short-lived in-memory response cache avoids repeat calls for the same answer pattern.

> The feature is a practical reflection aid, not a compliance assessment, audit, certification, legal opinion or verified portfolio diagnosis.

## BinaryLane environment configuration

Store the following values only in `/etc/grantmaestro/api.env` (or the protected production secret manager that writes it). Do not put them in GitHub, a React `REACT_APP_*` variable, browser source, a PM2 command line or the UI `.env.production` file.

```dotenv
# Keep false until provider, privacy review and budget owner are approved.
READINESS_INSIGHT_AI_ENABLED=false

# Claude provider configuration is read only by the Node API.
# ANTHROPIC_API_BASE=https://api.anthropic.com
# ANTHROPIC_API_KEY=REPLACE_WITH_APPROVED_ANTHROPIC_KEY

# Claude Haiku is selected for concise, bounded public interpretation. Change
# this only after the provider and quality/cost review approves a replacement.
READINESS_INSIGHT_AI_MODEL=claude-haiku-4-5

# Public endpoint safeguards: cap model usage and avoid long browser waits.
READINESS_INSIGHT_DAILY_LIMIT=100
READINESS_INSIGHT_AI_TIMEOUT_MS=8000
```

After a protected configuration change:

```bash
sudo -iu grantmaestro bash -lc '
  export NVM_DIR="$HOME/.nvm"
  . "$NVM_DIR/nvm.sh"
  cd /srv/grantmaestro/api
  pm2 reload grantmaestro-api --update-env
  pm2 status grantmaestro-api
'
```

## Enablement checklist

1. Approve the provider, model, data-processing terms and credential owner.
2. Set a conservative daily limit. The endpoint uses an in-process daily limit and a maximum 200-entry, 24-hour response cache; it is intentionally a secondary safeguard, not a replacement for the provider’s project-level usage cap.
3. Set a provider-level spending alert and hard project cap. The application cap should be below that ceiling.
4. Set `READINESS_INSIGHT_AI_ENABLED=true`, reload PM2, and test with a non-identifying sample answer pattern.
5. Confirm results are concise, are framed as practical reflections and contain no unsupported claims.
6. Test the disabled path (`READINESS_INSIGHT_AI_ENABLED=false`) and an invalid provider key. Both must return the guided interpretation without an error page.
7. Monitor API logs for the generic fallback warning. Do not log answer patterns, prompts or provider credentials.

## API behaviour and abuse controls

| Control | Behaviour |
|---|---|
| Route | `POST /v1/public/portfolio-readiness/interpretation` |
| Inputs | Exactly nine pre-defined integer scores; any other shape is rejected with HTTP 422. |
| Public throttle | Six interpretation requests per IP per hour. |
| Provider enablement | Off unless `READINESS_INSIGHT_AI_ENABLED=true` and an API key is present. |
| Daily budget | `READINESS_INSIGHT_DAILY_LIMIT`; after the cap, the server returns the guided interpretation. |
| Timeout / provider failure | Returns the guided interpretation; no visitor-facing provider error. |
| Prompt injection | The public request accepts fixed IDs and integers only; no visitor free-text is interpolated into the provider prompt. |
| Caching | Up to 200 response patterns are held in process for 24 hours; no contact details are included. |

## Acceptance checks

```bash
# API regression check
cd /srv/grantmaestro/api
npm run test:portfolio-readiness

# Guided path — expected status 200 and data.source = "guided" when AI is disabled
curl -fsS -X POST https://APP_HOST/v1/public/portfolio-readiness/interpretation \
  -H 'Content-Type: application/json' \
  --data '{"answers":[
    {"id":"deadline_visibility","score":0},
    {"id":"forward_planning","score":1},
    {"id":"leadership_reporting","score":1},
    {"id":"acquittal_checklists","score":0},
    {"id":"evidence_control","score":1},
    {"id":"requirements_visibility","score":1},
    {"id":"accountable_ownership","score":1},
    {"id":"continuity","score":1},
    {"id":"shared_tasks","score":1}
  ]}'
```

The UI must show the interpretation above the action-plan form in both guided and AI-enabled modes. It must remain useful if an AI provider is never configured.
