# Portfolio Readiness Insight — Manus Structured Analysis

## Purpose

The public `/grant-portfolio-readiness` page gives each visitor an expanded, outcome-focused reflection after nine readiness answers and before the optional action-plan email form.

The page always shows an immediate **guided interpretation** calculated from the answer pattern. That does not require a credential or third-party call. When Manus structured analysis is approved and enabled, the API starts a private Manus task using only the anonymous fixed-answer pattern. The page keeps showing the useful guided reflection while it checks for the structured result, then swaps in the returned reflection when available.

> The reflection is a practical discussion aid. It is not an audit, compliance assessment, certification, legal opinion or verified portfolio diagnosis.

## Data boundary

Only the following anonymous information reaches the Manus API:

- the nine fixed question identifiers;
- one integer score from `0` to `3` for each; and
- the derived category pattern and corresponding answer labels.

The Manus task does **not** receive a visitor’s name, email, organisation, role, grant data, funder data, financial data, documents, IP address, cookies or free-text input. The API does not persist the answer pattern or contact data for this workflow. It holds an opaque mapping from the browser to the Manus task ID in memory only for up to ten minutes; the browser never sees the Manus task ID.

## Manus task design

Each enabled analysis uses `POST https://api.manus.ai/v2/task.create` with:

- `interactive_mode: false`, so the task proceeds without asking the visitor questions;
- `hide_in_task_list: true` and `share_visibility: private`;
- the `manus-1.6-lite` profile by default, configurable through the protected environment;
- a strict structured-output schema containing only `headline`, three `paragraphs`, and `discussionPrompt`; and
- an instruction not to browse, use external tools, ask questions or take external action.

The API retrieves only the `structured_output_result` from `task.listMessages`. A task error, waiting state, invalid structured output, timeout or unavailable credential results in the guided reflection remaining in place.

## BinaryLane environment configuration

Store these values only in `/etc/grantmaestro/api.env` (or the approved protected secret manager that writes it). Do not put them in GitHub, the React bundle, a `REACT_APP_*` variable, browser source, PM2 command line or UI `.env.production` file.

```dotenv
# Keep false until the Manus API credential, privacy review and operational cap
# are approved. Guided output remains live while this is false.
MANUS_READINESS_ANALYSIS_ENABLED=false

# Server-only Manus API authentication.
# MANUS_API_KEY=REPLACE_WITH_APPROVED_MANUS_API_KEY
# MANUS_API_BASE=https://api.manus.ai

# Use the lightweight profile for the short, bounded structured reflection.
MANUS_READINESS_AGENT_PROFILE=manus-1.6-lite

# Safety and responsiveness controls.
MANUS_READINESS_DAILY_LIMIT=25
MANUS_READINESS_REQUEST_TIMEOUT_MS=12000
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

1. Create or designate the dedicated Manus API credential owner and store the key in the protected BinaryLane environment.
2. Approve the Manus data-handling terms and the limited anonymous-score data boundary above.
3. Set a conservative `MANUS_READINESS_DAILY_LIMIT`; the application cap is a secondary safeguard and should remain below the account-level operational limit.
4. Set `MANUS_READINESS_ANALYSIS_ENABLED=true`, reload PM2 and test with a non-identifying answer pattern.
5. Confirm the task is private, non-interactive, has no connector or external tool access, and returns only the expected structured fields.
6. Review representative results for Australian English, practical tone, no unsupported claims and clear differentiation from an audit or formal assessment.
7. Test the disabled state and invalid-key state. Both must keep the guided reflection visible without a visitor-facing provider error.

## API behaviour and controls

| Control | Behaviour |
|---|---|
| Start route | `POST /v1/public/portfolio-readiness/interpretation` |
| Status route | `GET /v1/public/portfolio-readiness/interpretation/:analysisId` |
| Inputs | Exactly nine pre-defined integer scores; any other shape receives HTTP 422. |
| Start throttle | Six start requests per IP per hour. |
| Status throttle | Twenty status checks per IP per ten minutes. |
| Task privacy | Private, hidden from task list and non-interactive; no Manus task ID reaches the browser. |
| Response format | A strict Manus structured-output schema: headline, exactly three paragraphs and one discussion prompt. |
| In-memory mapping | At most 200 opaque analysis mappings, deleted after ten minutes or terminal result. |
| Result cache | Up to 200 successful anonymous answer patterns retained in process for 24 hours; no contact data is cached. |
| Daily cap | `MANUS_READINESS_DAILY_LIMIT`; after the cap, guided output remains in place. |
| Provider failure | Guided output remains in place; no provider error is shown to a visitor. |
| Prompt injection | The public request accepts fixed IDs and integers only; no visitor free text is included in the Manus prompt. |

## Acceptance checks

```bash
cd /srv/grantmaestro/api
npm run test:portfolio-readiness

# Guided path when Manus analysis is disabled: status 200, data.source = "guided"
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

When Manus analysis is enabled, the start response will have `analysisStatus: "pending"` and an opaque `analysisId`. Query the status route with that analysis ID until `analysisStatus` becomes `ready`; verify that `data.source` is `"manus"`, exactly three paragraphs are returned and the result contains no contact or organisation details.
