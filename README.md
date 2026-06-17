# Opera Ads Marketing API Template

GTM **server-side** tag template for sending tracking events to the Opera Ads
Marketing API.

## About Opera Ads Marketing API

Opera Ads Marketing API is a server-to-server endpoint that lets advertisers send
website / app / offline events directly from their backend (or a server-side
GTM container) to Opera Ads. Compared to browser pixels, server-side delivery
is more reliable (immune to ad blockers, ITP, and intermittent client issues).

## About this template

This template lives in a **Server container** of Google Tag Manager. It:

1. Reads incoming events from a GA4 client (or any client that puts
   GA4-compatible data on the event), or from manually-overridden fields.
2. Resolves attribution signals: `clickId` from URL (`opera_click_id` or
   `opcid` query param) / same-domain referrer / `opcid` cookie, and
   `advertiserUserId` from the `OAU` first-party cookie.
3. Aggregates product / order data (`contents`, `currency`, `order_id`,
   `description`, `query`, `brand`, custom properties) into a single
   `eventData` JSON string.
4. POSTs a flat JSON payload to the Opera Ads endpoint.

## Installation

### Option A: Install from the GTM Community Template Gallery

> Coming soon — once submitted to https://tagmanager.google.com/gallery/.

### Option B: Import locally (for development / preview)

1. Download `template.tpl` from this repo.
2. In your **Server** GTM container, go to **Templates** → **Tag Templates** →
   **New**.
3. Click the **⋮** menu in the top-right → **Import**.
4. Select `template.tpl` → **Save**.
5. The "Opera Ads Marketing API" tag type is now available under **Custom** when
   creating a new tag.

## Setup

1. Create a tag of type **Opera Ads Marketing API**.
2. Fill in:
   - **Conversion ID** — from your Opera Ads dashboard (e.g.
     `adv_xxxxxxxxxxxxxxxxxx_v2`).
   - **Event Name** — `Inherit from event` is recommended; use the SELECT to
     override.
3. (Optional) Configure **Properties** (product / order data) — these are
   merged into the `eventData` JSON string.
4. (Optional) Set **Event ID** for cross-source deduplication; leave blank and
   the template will auto-generate one as `gtm_<timestamp>_<random>`.
5. Attach a trigger that matches your events (typically **All Custom Events**
   when relying on a GA4 client upstream).

## Verify

- In the GTM Server container, enable **Preview** and trigger an event from
  your website.
- Confirm the Opera Ads tag fires with status **Succeeded**.
- Inspect the outgoing request body — it should be a **flat JSON** object with
  fields like `trackerId`, `eventId`, `eventName`, `eventData`, `payout`,
  `clickId`, `advertiserUserId`, `url`, `refU`, `utmSource`, etc.

## Endpoint reference

```
POST https://px.oa.opera.com/s
Content-Type: application/json

{
  "trackerId": "adv_xxxxxxxxxxxxxxxxxx_v2",
  "clickId": "1a2b3c4d5e6f7g8h9i0j",
  "eventId": "a2b3c4d5-e6f7-498e-b2db-76349821a6df",
  "eventName": "purchase",
  "eventData": "{\"contents\":[...],\"currency\":\"USD\",\"order_id\":\"ORD9876\",\"integration\":\"gtm_server\",\"integration_version\":\"0.1.0\",\"event_trigger_source\":\"GoogleTagManagerServer\"}",
  "payout": "49.95",
  "ip": "192.0.2.1",
  "ua": "Mozilla/5.0 ...",
  "advertiserUserId": "oau-user-xyz",
  "url": "https://example.com/checkout/thank-you",
  "refU": "https://example.com/product/item-x",
  "utmSource": "facebook",
  "utmMedium": "cpc",
  "utmCampaign": "summer_promo",
  "utmTerm": "shoes",
  "utmContent": "ad_variant_a"
}
```

| Field | Required | Notes |
| --- | --- | --- |
| `trackerId` | Y | Opera Ads Conversion ID |
| `eventId` | Y | Auto-generated as `gtm_<timestamp>_<random>` when not provided |
| `eventName` | Y | GA4 names are mapped to Opera standard names (see `EVENT_NAME_MAP` in `template.js`) |
| `clickId` | N | `opera_click_id` / `opcid` URL param, same-domain referrer, or `opcid` cookie |
| `eventData` | N | JSON-stringified bag of product / order / custom properties |
| `payout` | N | USD value as float string |
| `ip` / `ua` | N | Forwarded from the upstream client |
| `advertiserUserId` | N | First-party `OAU` cookie |
| `url` / `refU` | N | Page URL / referrer |
| `utm*` | N | Auto-extracted from `eventData.campaign_*` or `page_location` query string |

## Development

`template.tpl` is the file GTM imports. `template.js` is the same sandboxed
JavaScript extracted into a standalone file for easier editing and code
review — keep the two in sync.

## License

Apache License 2.0 — see [LICENSE](./LICENSE).
