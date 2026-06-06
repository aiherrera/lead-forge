
-- ============ email_accounts ============
CREATE TABLE public.email_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'mock', -- mock | smtp | gmail | resend | sendgrid | mailgun | postmark
  sender_name TEXT NOT NULL,
  sender_email TEXT NOT NULL,
  reply_to_email TEXT,
  smtp_host TEXT,
  smtp_port INTEGER,
  smtp_username TEXT,
  smtp_password_secret TEXT, -- secret name reference (never store raw passwords)
  daily_limit INTEGER NOT NULL DEFAULT 50,
  hourly_limit INTEGER NOT NULL DEFAULT 20,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  connection_status TEXT NOT NULL DEFAULT 'untested', -- untested | ok | failed
  last_tested_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_accounts TO anon, authenticated;
GRANT ALL ON public.email_accounts TO service_role;
ALTER TABLE public.email_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access email_accounts" ON public.email_accounts FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_email_accounts_updated BEFORE UPDATE ON public.email_accounts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ email_templates ============
CREATE TABLE public.email_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  preview_text TEXT,
  body_html TEXT,
  body_text TEXT NOT NULL DEFAULT '',
  signature TEXT,
  channel TEXT NOT NULL DEFAULT 'email',
  goal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO anon, authenticated;
GRANT ALL ON public.email_templates TO service_role;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access email_templates" ON public.email_templates FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_email_templates_updated BEFORE UPDATE ON public.email_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ campaigns ============
CREATE TABLE public.campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | ready | scheduled | sending | paused | completed | archived | failed
  audience_type TEXT NOT NULL DEFAULT 'segment', -- segment | category | selection | filter | ready
  audience_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  sender_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  goal TEXT,
  email_type TEXT NOT NULL DEFAULT 'commercial', -- commercial | transactional | manual_follow_up
  sender_name TEXT,
  sender_company TEXT,
  reply_to_email TEXT,
  compliance_address TEXT,
  unsubscribe_enabled BOOLEAN NOT NULL DEFAULT true,
  send_mode TEXT NOT NULL DEFAULT 'immediate', -- immediate | scheduled
  scheduled_at TIMESTAMPTZ,
  daily_limit INTEGER NOT NULL DEFAULT 50,
  hourly_limit INTEGER NOT NULL DEFAULT 20,
  delay_seconds_min INTEGER NOT NULL DEFAULT 120,
  delay_seconds_max INTEGER NOT NULL DEFAULT 300,
  send_days TEXT[] NOT NULL DEFAULT ARRAY['Mon','Tue','Wed','Thu','Fri']::TEXT[],
  send_window_start TEXT NOT NULL DEFAULT '09:00',
  send_window_end TEXT NOT NULL DEFAULT '17:00',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  stop_on_bounce_rate NUMERIC NOT NULL DEFAULT 0.05,
  stop_after_reply BOOLEAN NOT NULL DEFAULT true,
  skip_unsubscribed BOOLEAN NOT NULL DEFAULT true,
  skip_suppressed_domains BOOLEAN NOT NULL DEFAULT true,
  total_leads INTEGER NOT NULL DEFAULT 0,
  sendable_count INTEGER NOT NULL DEFAULT 0,
  excluded_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  bounced_count INTEGER NOT NULL DEFAULT 0,
  unsubscribed_count INTEGER NOT NULL DEFAULT 0,
  replied_count INTEGER NOT NULL DEFAULT 0,
  open_count INTEGER NOT NULL DEFAULT 0,
  click_count INTEGER NOT NULL DEFAULT 0,
  last_activity_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaigns TO anon, authenticated;
GRANT ALL ON public.campaigns TO service_role;
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access campaigns" ON public.campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_campaigns_updated BEFORE UPDATE ON public.campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ campaign_sequence_steps ============
CREATE TABLE public.campaign_sequence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL DEFAULT 1,
  name TEXT NOT NULL DEFAULT 'Step',
  delay_days INTEGER NOT NULL DEFAULT 0,
  subject TEXT NOT NULL DEFAULT '',
  body_html TEXT,
  body_text TEXT NOT NULL DEFAULT '',
  send_condition JSONB NOT NULL DEFAULT '{"send_if_no_reply":true,"send_if_not_bounced":true,"send_if_not_unsubscribed":true,"send_if_previous_sent":true}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_sequence_steps TO anon, authenticated;
GRANT ALL ON public.campaign_sequence_steps TO service_role;
ALTER TABLE public.campaign_sequence_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access campaign_sequence_steps" ON public.campaign_sequence_steps FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_seq_steps_updated BEFORE UPDATE ON public.campaign_sequence_steps FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_seq_steps_campaign ON public.campaign_sequence_steps(campaign_id, step_number);

-- ============ campaign_leads ============
CREATE TABLE public.campaign_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued', -- queued | scheduled | sending | sent | paused | skipped | replied | bounced | unsubscribed | completed | failed
  readiness_status TEXT NOT NULL DEFAULT 'unknown',
  current_step INTEGER NOT NULL DEFAULT 0,
  reply_outcome TEXT, -- interested | not_interested | booked_call | requested_more_info | wrong_contact | do_not_contact
  last_email_sent_at TIMESTAMPTZ,
  next_email_scheduled_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  skipped_at TIMESTAMPTZ,
  skip_reason TEXT,
  unsubscribe_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, business_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_leads TO anon, authenticated;
GRANT ALL ON public.campaign_leads TO service_role;
ALTER TABLE public.campaign_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access campaign_leads" ON public.campaign_leads FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_camp_leads_updated BEFORE UPDATE ON public.campaign_leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_camp_leads_campaign ON public.campaign_leads(campaign_id);
CREATE INDEX idx_camp_leads_business ON public.campaign_leads(business_id);
CREATE INDEX idx_camp_leads_next ON public.campaign_leads(next_email_scheduled_at) WHERE status IN ('queued','scheduled');

-- ============ email_jobs ============
CREATE TABLE public.email_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  campaign_lead_id UUID REFERENCES public.campaign_leads(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  sequence_step_id UUID REFERENCES public.campaign_sequence_steps(id) ON DELETE SET NULL,
  sender_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT,
  body_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued', -- draft | queued | scheduled | sending | sent | failed | bounced | skipped | cancelled
  is_simulated BOOLEAN NOT NULL DEFAULT true,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failure_reason TEXT,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  unsubscribed_at TIMESTAMPTZ,
  unsubscribe_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_jobs TO anon, authenticated;
GRANT ALL ON public.email_jobs TO service_role;
ALTER TABLE public.email_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access email_jobs" ON public.email_jobs FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_email_jobs_updated BEFORE UPDATE ON public.email_jobs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_email_jobs_status_sched ON public.email_jobs(status, scheduled_at);
CREATE INDEX idx_email_jobs_campaign ON public.email_jobs(campaign_id);
CREATE INDEX idx_email_jobs_business ON public.email_jobs(business_id);

-- ============ suppression_list ============
CREATE TABLE public.suppression_list (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT,
  domain TEXT,
  reason TEXT NOT NULL DEFAULT 'unsubscribed', -- unsubscribed | bounced | manual_block | complaint | invalid_email | do_not_contact
  source TEXT,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE SET NULL,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppression_list TO anon, authenticated;
GRANT ALL ON public.suppression_list TO service_role;
ALTER TABLE public.suppression_list ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access suppression_list" ON public.suppression_list FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_suppression_email ON public.suppression_list(email);
CREATE INDEX idx_suppression_domain ON public.suppression_list(domain);

-- ============ email_events ============
CREATE TABLE public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_job_id UUID REFERENCES public.email_jobs(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES public.campaigns(id) ON DELETE CASCADE,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- queued | simulated_send | sent | failed | bounced | opened | clicked | replied | unsubscribed | skipped
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_events TO anon, authenticated;
GRANT ALL ON public.email_events TO service_role;
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access email_events" ON public.email_events FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_email_events_job ON public.email_events(email_job_id);
CREATE INDEX idx_email_events_campaign ON public.email_events(campaign_id);
CREATE INDEX idx_email_events_business ON public.email_events(business_id);

-- ============ businesses additions ============
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS do_not_contact BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_emailed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_outcome TEXT;

-- ============ app_settings (singleton) ============
CREATE TABLE public.app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mock_mode BOOLEAN NOT NULL DEFAULT true,
  default_sender_account_id UUID REFERENCES public.email_accounts(id) ON DELETE SET NULL,
  default_compliance_address TEXT,
  default_sender_name TEXT,
  default_sender_company TEXT,
  global_daily_cap INTEGER NOT NULL DEFAULT 500,
  bounce_alert_rate NUMERIC NOT NULL DEFAULT 0.05,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open access app_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE TRIGGER trg_app_settings_updated BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT DO NOTHING;
