-- ═══════════════════════════════════════════════════════════════════════════
-- MelkJet REOS — Real Estate Operating System · PostgreSQL Schema (production)
-- Multi-tenant · Event-driven · ML-ready (feature store + pgvector) · Scalable
-- اجرا: psql -d melkjet -f docs/reos-schema.sql   (idempotent — IF NOT EXISTS)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";       -- pgvector (embeddings). اگر نبود: بردار در jsonb.

-- ╔═══════════════════ AUTH / IDENTITY / MULTI-TENANT ═══════════════════╗
CREATE TABLE IF NOT EXISTS organizations (        -- هستهٔ multi-tenant
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,                              -- agency | builder | bank | legal | materials
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, phone TEXT UNIQUE NOT NULL, email TEXT,
  password_hash TEXT, status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL                        -- buyer, agent, agency, builder, contractor, legal, finance, materials, architect, appraiser, notary
);
CREATE TABLE IF NOT EXISTS user_roles (           -- RBAC + ABAC (scoped به organization)
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  permissions JSONB DEFAULT '[]'::jsonb,           -- ABAC attributes
  PRIMARY KEY (user_id, role_id, organization_id)
);

-- ╔═══════════════════ REAL ESTATE CORE (Zillow core) ═══════════════════╗
CREATE TABLE IF NOT EXISTS properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL, description TEXT,
  price BIGINT, rent_monthly BIGINT, currency TEXT DEFAULT 'IRT',
  deal TEXT,                                       -- sale | rent
  area INT, rooms INT, floor INT, year_built INT,
  type TEXT, status TEXT NOT NULL DEFAULT 'active',-- active | sold | rented | pending | rejected
  lat DOUBLE PRECISION, lng DOUBLE PRECISION,
  city TEXT, region TEXT, neighborhood TEXT, address TEXT,
  features JSONB DEFAULT '[]'::jsonb,
  owner_id UUID, organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  demand_score REAL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS property_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  url TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'image', order_index INT DEFAULT 0
);
CREATE TABLE IF NOT EXISTS property_price_history (   -- برای «کاهش قیمت» در فید
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES properties(id) ON DELETE CASCADE,
  price BIGINT NOT NULL, at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ╔═══════════════════ CRM CORE (leads) ═══════════════════╗
CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT, phone TEXT, email TEXT,
  budget BIGINT, intent TEXT,                      -- buy | rent | invest
  need TEXT, status TEXT NOT NULL DEFAULT 'new',   -- new, contacted, hot, cold, visit, negotiation, won, lost
  stage TEXT, source TEXT,                         -- divar | instagram | website | agency
  assigned_agent_id UUID,                          -- 🆔 لینک با آیدیِ پروفایل، نه نام
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  score INT DEFAULT 0, conversion_prob REAL,
  reminder_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lead_interactions (     -- تایم‌لاینِ فعالیت (قلبِ CRM)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,                              -- call | whatsapp | sms | email | visit | note | view | save
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS lead_tags ( lead_id UUID REFERENCES leads(id) ON DELETE CASCADE, tag TEXT, PRIMARY KEY (lead_id, tag) );

-- ╔═══════════════════ DEALS (money engine) ═══════════════════╗
CREATE TABLE IF NOT EXISTS deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE SET NULL,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  agent_id UUID,
  price BIGINT, commission BIGINT,
  stage TEXT NOT NULL DEFAULT 'negotiation',       -- negotiation | closed | lost
  probability REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), closed_at TIMESTAMPTZ
);

-- ╔═══════════════════ BUSINESS LAYER (agents / agencies / builders …) ═══════════════════╗
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  rating REAL DEFAULT 0, conversion_rate REAL DEFAULT 0, response_time INT,   -- minutes
  trust_score REAL DEFAULT 0, specialty JSONB DEFAULT '[]'::jsonb, active BOOLEAN DEFAULT true
);
CREATE TABLE IF NOT EXISTS agent_performance (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  leads_count INT DEFAULT 0, deals_count INT DEFAULT 0, revenue BIGINT DEFAULT 0, updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS agency_memberships (    -- 🆔 عضویتِ مشاور↔آژانس با آیدی
  advisor_id UUID, agency_id UUID, since TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (advisor_id, agency_id)
);
CREATE TABLE IF NOT EXISTS projects (              -- سازنده/انبوه‌ساز
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), organization_id UUID, name TEXT,
  stage TEXT, roi REAL, units_total INT, units_sold INT, meta JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ╔═══════════════════ AI / ML LAYER ═══════════════════╗
CREATE TABLE IF NOT EXISTS embeddings (            -- VECTOR STORE (pgvector)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  embedding VECTOR(64),                            -- REOS EMBED_DIM=64 (ارتقا به 1536 با مدلِ برداریِ واقعی)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);
CREATE TABLE IF NOT EXISTS feature_store (         -- قلبِ ML: ویژگی‌های زندهٔ هر موجودیت
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  features JSONB NOT NULL DEFAULT '{}'::jsonb, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (entity_type, entity_id)
);
CREATE TABLE IF NOT EXISTS predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  type TEXT NOT NULL,                              -- conversion | price | demand | agent | upsell
  score REAL NOT NULL, meta JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS matches (               -- CORE Zillow engine — نتیجهٔ تطبیق
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL, source_id TEXT NOT NULL,
  target_type TEXT NOT NULL, target_id TEXT NOT NULL,
  score REAL NOT NULL, reason JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ╔═══════════════════ EVENT LAYER (قلبِ AI) ═══════════════════╗
CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT, type TEXT NOT NULL,               -- user_clicked_property | user_saved_property | user_searched | contact_made | lead_created | property_created | agent_assigned | deal_closed
  entity_type TEXT, entity_id TEXT,
  value JSONB DEFAULT '{}'::jsonb, session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ╔═══════════════════ RECOMMENDATION LAYER ═══════════════════╗
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  preferred_locations JSONB DEFAULT '[]'::jsonb, preferred_price_range JSONB, preferred_types JSONB DEFAULT '[]'::jsonb,
  intent TEXT, embedding VECTOR(64), updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS recommendation_feed (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  score REAL NOT NULL, reason JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ranking_logs (          -- بازخوردِ آنلاین (impression → click → save → contact) برای retrain
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT, property_id TEXT,
  shown BOOLEAN DEFAULT true, clicked BOOLEAN DEFAULT false, saved BOOLEAN DEFAULT false, contacted BOOLEAN DEFAULT false,
  score REAL, ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ╔═══════════════════ MONETIZATION LAYER ═══════════════════╗
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), role TEXT, name TEXT, price BIGINT,
  features JSONB DEFAULT '[]'::jsonb, limits JSONB DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id UUID, plan_id UUID REFERENCES plans(id),
  start_date TIMESTAMPTZ DEFAULT now(), end_date TIMESTAMPTZ, status TEXT DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS promotions (            -- Boost / Featured / VIP
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  promotion_type TEXT NOT NULL,                    -- boost | featured | vip
  budget BIGINT, boost_score REAL DEFAULT 0,
  start_at TIMESTAMPTZ NOT NULL DEFAULT now(), end_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS leads_marketplace (     -- فروشِ لید (exclusive/shared)
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  buyer_id UUID, seller_id UUID, price BIGINT,
  exclusive BOOLEAN DEFAULT false, status TEXT DEFAULT 'listed', created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL, target_type TEXT, target_query JSONB DEFAULT '{}'::jsonb,
  budget BIGINT, status TEXT DEFAULT 'draft', created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID, amount BIGINT NOT NULL,
  type TEXT NOT NULL,                              -- subscription | boost | lead_purchase | commission | referral
  status TEXT DEFAULT 'pending', ref JSONB DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ╔═══════════════════ AI AGENT LAYER (کارمندِ دیجیتالِ هر نقش) ═══════════════════╗
CREATE TABLE IF NOT EXISTS ai_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), role TEXT NOT NULL, name TEXT,
  model TEXT, configuration JSONB DEFAULT '{}'::jsonb
);
CREATE TABLE IF NOT EXISTS ai_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  entity_type TEXT, entity_id TEXT, memory JSONB DEFAULT '{}'::jsonb, embedding VECTOR(64)
);
CREATE TABLE IF NOT EXISTS ai_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  task_type TEXT, status TEXT DEFAULT 'pending', result JSONB, created_at TIMESTAMPTZ DEFAULT now()
);
CREATE TABLE IF NOT EXISTS ai_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), agent_id UUID REFERENCES ai_agents(id) ON DELETE CASCADE,
  action TEXT, input JSONB, output JSONB, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ╔═══════════════════ SEARCH (Elastic-ready) ═══════════════════╗
CREATE TABLE IF NOT EXISTS search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, entity_id TEXT NOT NULL,
  full_text TEXT, tsv TSVECTOR, geo_point POINT, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ╔═══════════════════ INDEXES (سرعت در مقیاسِ میلیونی) ═══════════════════╗
CREATE INDEX IF NOT EXISTS idx_property_city   ON properties(city);
CREATE INDEX IF NOT EXISTS idx_property_price   ON properties(price);
CREATE INDEX IF NOT EXISTS idx_property_geo     ON properties(lat, lng);
CREATE INDEX IF NOT EXISTS idx_property_status  ON properties(status);
CREATE INDEX IF NOT EXISTS idx_lead_status      ON leads(status);
CREATE INDEX IF NOT EXISTS idx_lead_score       ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_lead_agent       ON leads(assigned_agent_id);
CREATE INDEX IF NOT EXISTS idx_events_type      ON events(type);
CREATE INDEX IF NOT EXISTS idx_events_entity    ON events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_events_user      ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_time      ON events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_match_score      ON matches(score DESC);
CREATE INDEX IF NOT EXISTS idx_feed_user        ON recommendation_feed(user_id, score DESC);
CREATE INDEX IF NOT EXISTS idx_promo_entity     ON promotions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_search_tsv       ON search_index USING GIN(tsv);
-- pgvector ANN (وقتی pgvector فعال است):
-- CREATE INDEX IF NOT EXISTS idx_emb_ann ON embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
