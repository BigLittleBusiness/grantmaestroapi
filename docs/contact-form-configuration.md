# Contact Form Configuration

GrantMaestro uses **Cloudflare Turnstile** for public and in-app support contact forms. Every CAPTCHA response is verified on the API before an enquiry or support ticket is accepted. The contact recipient is stored only in the protected API environment and must not be committed to GitHub or sent to the browser.

## Required protected environment values

Create a Turnstile widget in the Cloudflare dashboard for each deployed hostname, then place the following values in the protected `config.env` on the relevant server:

```dotenv
# Cloudflare Turnstile public site key; safe to expose to the browser.
TURNSTILE_SITE_KEY=<site-key>

# Cloudflare Turnstile secret key; server-only.
TURNSTILE_SECRET_KEY=<secret-key>

# Comma-separated website hostnames that are allowed to pass verification.
TURNSTILE_EXPECTED_HOSTNAMES=<production-hostname>,<www-production-hostname>

# The inbound recipient encoded as base64; no raw address is stored in source.
# Generate this value on the server:
# printf '%s' '<inbound-contact-address>' | base64 -w 0
CONTACT_RECIPIENT_B64=<base64-encoded-recipient>
```

The mail sender configuration in **Sys Admin → Email Settings** must also be completed and successfully tested with Amazon SES before any enquiry can be delivered.

## Behaviour and safeguards

The public `/contact` page requests the public Turnstile key from the API. It remains unavailable until all four protected contact settings are present. The API applies both an IP rate limit and server-side CAPTCHA validation. The email recipient is decoded only inside the API process. Contact and support notification subjects are always normalised to start with `GrantMaestro - `, and public enquiry replies use the submitted address as `Reply-To` rather than exposing an address in the user interface.

The in-app support ticket form uses the same CAPTCHA verification. It still stores the ticket in the organisation workspace; its internal email notification is skipped safely if the recipient or SES is not configured.

## Pre-release test

After configuration on HTTPS, verify the following without exposing credentials:

1. Load `/contact` and confirm the CAPTCHA renders.
2. Submit an enquiry with valid fields and confirm it is delivered to the protected inbound recipient with a `GrantMaestro - ` subject prefix.
3. Submit with no CAPTCHA token or an expired token and confirm the API rejects it.
4. Submit an authenticated in-app support ticket and confirm that it stores correctly and sends the same branded internal notification.
5. Confirm page source, rendered DOM and repository search results contain no public `mailto:` links or raw platform contact addresses.
6. Confirm that the recipient and Turnstile secret are absent from Git history, static build files and frontend environment values.

Use a distinct Turnstile widget and keys for staging and production. Set the expected hostnames exactly; an unexpected hostname fails verification.
