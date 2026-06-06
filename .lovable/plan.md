## CRM Integrations & Sync Center

Big surface — splitting into 3 phases so each ships working value and you can review between them.

### Phase 1 — Data model + Integrations page + Generic Webhook (fully functional)

**DB migration** — new tables: `integrations`, `integration_mappings`, `sync_rules`, `sync_jobs`, `sync_events`, `external_records`. All with RLS + GRANTs (single-user pattern matching existing tables).

**Integrations page** (replaces current placeholder):
- Provider cards: HubSpot, Pipedrive, Salesforce, GoHighLevel, Airtable, Zapier, Make, Generic Webhook, CSV scheduled export
- Each card: status badge (Not connected / Connected / Error / Disabled), description, last sync, actions
- "Connect" opens provider-specific setup drawer
- Only Generic Webhook + Airtable get real setup; others show "Coming soon — UI ready, needs credentials"

**Generic Webhook — fully functional**:
- Setup: name, URL, method (POST/PUT), auth (none/bearer/custom header), custom headers, payload template with `{{variables}}`, enabled toggle
- Test button: sends sample payload via server fn, shows request/response/status
- Server fn `testWebhook` and `sendWebhook` in `src/lib/integrations/webhook.functions.ts`

**Airtable integration**:
- Setup: API key (stored as secret reference), base ID, table name
- Test connection via Airtable API
- Server fn `airtable.functions.ts`

### Phase 2 — Field mapping + Sync rules + Manual sync

- **Field mapping screen** per integration: LeadForge fields → CRM fields, transformation dropdown (text/number/url/phone/email/date/csv/domain/bool), required badge, sample value preview
- **Sync rules**: trigger type (manual / on qualified / on ready / on first sent / on reply / on interested / on won / added to campaign / segment change), audience config, create-or-update behavior, enabled toggle
- **Manual sync actions** wired into Businesses table, Pipeline, Campaign detail, Business drawer: "Sync to CRM", "Sync selected", "Sync filtered", "Sync campaign leads"
- **Confirmation modal** before sync: integration, record count, create/update/skip breakdown, missing-field warnings
- **Duplicate detection**: email / phone / domain / name+address match before sync
- Server-side job enqueue: builds payload from mapping + transformations, inserts into `sync_jobs`

### Phase 3 — Sync Center + queue worker + history

**Sync Center page** with tabs: Queue, History, Errors, Rules, Logs
- KPIs: total / successful / failed / pending / skipped / last sync / active integrations
- Queue table: integration, business, target, action, status, scheduled, completed, error, retry — row actions: retry, cancel, view payload, view response, open business
- History tab: paginated `sync_jobs` log
- Errors tab: failed jobs with retry
- Logs drawer: payload + response JSON viewer

**Queue worker**:
- Public endpoint `/api/public/hooks/process-sync-queue` (apikey-protected) that drains pending jobs
- Per-job: load integration, render payload, POST to webhook OR call Airtable API, store response, mark status, write `sync_events`, update `external_records` on success
- Retry: exponential backoff, max 5 attempts, permanent fail after

**Activity sync + Pipeline sync + Campaign sync triggers**: hooks in existing pipeline/campaign update paths that insert `sync_jobs` when matching `sync_rules` fire.

### Honest behavior
- HubSpot / Pipedrive / Salesforce / GoHighLevel / Zapier / Make / CSV scheduled: full UI, but Connect button shows "Configure credentials" with the actual fields needed; until configured, status stays "Not connected" and sync attempts fail loudly with "Provider not connected".
- No fake success states. Mock/dev mode (if used) shows a clear "SIM" badge like the email system already does.

### Files touched (Phase 1 only — confirm before I start Phase 2/3)
- New: `supabase/migrations/...`
- New: `src/lib/integrations/{types.ts,db.ts,webhook.functions.ts,airtable.functions.ts,variables.ts}`
- New: `src/routes/integrations.$id.tsx`, `src/routes/sync-center.tsx` (stub for now)
- New: `src/components/integrations/{ProviderCard.tsx,WebhookSetupDialog.tsx,AirtableSetupDialog.tsx,TestResultDialog.tsx}`
- Edit: `src/routes/integrations.tsx` (replace placeholder), `src/components/AppShell.tsx` (sidebar entries), `src/integrations/supabase/types.ts` (regen after migration)

Proceed with Phase 1?