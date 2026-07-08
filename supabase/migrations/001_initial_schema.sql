-- LECTORES Platform - Initial Schema with Multi-tenant RLS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Enums
CREATE TYPE user_role AS ENUM ('super_admin', 'community_owner', 'member');
CREATE TYPE membership_status AS ENUM ('active', 'pending', 'cancelled', 'expired');
CREATE TYPE subscription_status AS ENUM ('active', 'past_due', 'cancelled', 'trialing');
CREATE TYPE event_type AS ENUM ('meeting', 'deadline', 'announcement', 'other');
CREATE TYPE meeting_status AS ENUM ('scheduled', 'live', 'ended');

-- Profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  is_super_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Communities
CREATE TABLE communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  logo_url TEXT,
  accent_color TEXT NOT NULL DEFAULT '#0ea5e9',
  owner_id UUID NOT NULL REFERENCES profiles(id),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  stripe_price_id TEXT,
  monthly_price_cents INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_communities_slug ON communities(slug);
CREATE INDEX idx_communities_owner ON communities(owner_id);

-- Memberships
CREATE TABLE memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'member',
  status membership_status NOT NULL DEFAULT 'pending',
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, community_id)
);

CREATE INDEX idx_memberships_user ON memberships(user_id);
CREATE INDEX idx_memberships_community ON memberships(community_id);

-- Invites
CREATE TABLE invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID NOT NULL REFERENCES profiles(id),
  max_uses INTEGER,
  use_count INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invites_token ON invites(token);

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membership_id UUID NOT NULL REFERENCES memberships(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status subscription_status NOT NULL DEFAULT 'trialing',
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Forum
CREATE TABLE forum_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_pinned BOOLEAN NOT NULL DEFAULT FALSE,
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  reply_count INTEGER NOT NULL DEFAULT 0,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forum_threads_community ON forum_threads(community_id, created_at DESC);

CREATE TABLE forum_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  like_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_forum_posts_thread ON forum_posts(thread_id, created_at);

CREATE TABLE forum_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  thread_id UUID REFERENCES forum_threads(id) ON DELETE CASCADE,
  post_id UUID REFERENCES forum_posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, thread_id),
  UNIQUE(user_id, post_id),
  CHECK (
    (thread_id IS NOT NULL AND post_id IS NULL) OR
    (thread_id IS NULL AND post_id IS NOT NULL)
  )
);

-- Classroom
CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  video_provider TEXT NOT NULL DEFAULT 'mux',
  video_id TEXT,
  video_url TEXT,
  duration_seconds INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES lessons(id) ON DELETE CASCADE,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  progress_percent INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Library / Books
CREATE TABLE books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT,
  description TEXT,
  cover_url TEXT,
  pdf_storage_path TEXT,
  content_json JSONB,
  total_pages INTEGER NOT NULL DEFAULT 0,
  table_of_contents JSONB DEFAULT '[]'::jsonb,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_books_community ON books(community_id);

CREATE TABLE reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  current_page INTEGER NOT NULL DEFAULT 0,
  progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, book_id)
);

CREATE TABLE reading_bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Meetings
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  description TEXT,
  livekit_room TEXT NOT NULL,
  active_book_id UUID REFERENCES books(id),
  status meeting_status NOT NULL DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE meeting_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meeting_chat ON meeting_chat_messages(meeting_id, created_at);

-- Calendar
CREATE TABLE calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  event_type event_type NOT NULL DEFAULT 'other',
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  meeting_id UUID REFERENCES meetings(id),
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calendar_events ON calendar_events(community_id, starts_at);

-- Helper functions for RLS
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE(
    (SELECT is_super_admin FROM profiles WHERE id = auth.uid()),
    FALSE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_community_member(p_community_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND community_id = p_community_id
      AND status = 'active'
  ) OR is_super_admin();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION is_community_admin(p_community_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM memberships
    WHERE user_id = auth.uid()
      AND community_id = p_community_id
      AND role IN ('community_owner')
      AND status = 'active'
  ) OR is_super_admin() OR EXISTS (
    SELECT 1 FROM communities
    WHERE id = p_community_id AND owner_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_user_community_ids()
RETURNS SETOF UUID AS $$
  SELECT community_id FROM memberships
  WHERE user_id = auth.uid() AND status = 'active'
  UNION
  SELECT id FROM communities WHERE is_super_admin();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE forum_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (id = auth.uid() OR is_super_admin());
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (id = auth.uid());

-- Communities policies
CREATE POLICY "Members can view their communities" ON communities FOR SELECT
  USING (is_community_member(id) OR is_super_admin());
CREATE POLICY "Super admin can manage communities" ON communities FOR ALL
  USING (is_super_admin());
CREATE POLICY "Owner can update community" ON communities FOR UPDATE
  USING (is_community_admin(id));

-- Memberships policies
CREATE POLICY "Users can view memberships in their communities" ON memberships FOR SELECT
  USING (user_id = auth.uid() OR is_community_admin(community_id));
CREATE POLICY "Users can insert own membership via invite" ON memberships FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Admins can manage memberships" ON memberships FOR ALL
  USING (is_community_admin(community_id) OR is_super_admin());

-- Invites policies
CREATE POLICY "Anyone can read active invite by token" ON invites FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins manage invites" ON invites FOR ALL USING (is_community_admin(community_id) OR is_super_admin());

-- Subscriptions policies
CREATE POLICY "Users view own subscriptions" ON subscriptions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM memberships m WHERE m.id = membership_id AND (m.user_id = auth.uid() OR is_community_admin(m.community_id))
  ));

-- Forum policies
CREATE POLICY "Members view forum threads" ON forum_threads FOR SELECT USING (is_community_member(community_id));
CREATE POLICY "Members create forum threads" ON forum_threads FOR INSERT WITH CHECK (is_community_member(community_id) AND author_id = auth.uid());
CREATE POLICY "Authors and admins update threads" ON forum_threads FOR UPDATE USING (author_id = auth.uid() OR is_community_admin(community_id));
CREATE POLICY "Admins delete threads" ON forum_threads FOR DELETE USING (is_community_admin(community_id) OR author_id = auth.uid());

CREATE POLICY "Members view posts" ON forum_posts FOR SELECT
  USING (EXISTS (SELECT 1 FROM forum_threads t WHERE t.id = thread_id AND is_community_member(t.community_id)));
CREATE POLICY "Members create posts" ON forum_posts FOR INSERT
  WITH CHECK (author_id = auth.uid() AND EXISTS (SELECT 1 FROM forum_threads t WHERE t.id = thread_id AND is_community_member(t.community_id)));
CREATE POLICY "Authors update posts" ON forum_posts FOR UPDATE USING (author_id = auth.uid());
CREATE POLICY "Authors delete posts" ON forum_posts FOR DELETE USING (author_id = auth.uid() OR EXISTS (SELECT 1 FROM forum_threads t JOIN forum_posts p ON p.thread_id = t.id WHERE p.id = forum_posts.id AND is_community_admin(t.community_id)));

CREATE POLICY "Members manage reactions" ON forum_reactions FOR ALL USING (user_id = auth.uid());

-- Classroom policies
CREATE POLICY "Members view courses" ON courses FOR SELECT
  USING (is_community_member(community_id) AND (is_published OR is_community_admin(community_id)));
CREATE POLICY "Admins manage courses" ON courses FOR ALL USING (is_community_admin(community_id));

CREATE POLICY "Members view lessons" ON lessons FOR SELECT
  USING (EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND is_community_member(c.community_id) AND (lessons.is_published OR is_community_admin(c.community_id))));
CREATE POLICY "Admins manage lessons" ON lessons FOR ALL
  USING (EXISTS (SELECT 1 FROM courses c WHERE c.id = course_id AND is_community_admin(c.community_id)));

CREATE POLICY "Users manage own lesson progress" ON lesson_progress FOR ALL USING (user_id = auth.uid());

-- Library policies
CREATE POLICY "Members view books" ON books FOR SELECT
  USING (is_community_member(community_id) AND (is_published OR is_community_admin(community_id)));
CREATE POLICY "Admins manage books" ON books FOR ALL USING (is_community_admin(community_id));

CREATE POLICY "Users manage own reading progress" ON reading_progress FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Users manage own bookmarks" ON reading_bookmarks FOR ALL USING (user_id = auth.uid());

-- Meeting policies
CREATE POLICY "Members view meetings" ON meetings FOR SELECT USING (is_community_member(community_id));
CREATE POLICY "Admins manage meetings" ON meetings FOR ALL USING (is_community_admin(community_id));

CREATE POLICY "Members view chat" ON meeting_chat_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_id AND is_community_member(m.community_id)));
CREATE POLICY "Members send chat" ON meeting_chat_messages FOR INSERT
  WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM meetings m WHERE m.id = meeting_id AND is_community_member(m.community_id)));

-- Calendar policies
CREATE POLICY "Members view events" ON calendar_events FOR SELECT USING (is_community_member(community_id));
CREATE POLICY "Admins manage events" ON calendar_events FOR ALL USING (is_community_admin(community_id) OR created_by = auth.uid());

-- Storage bucket for PDFs (run in Supabase dashboard or via API)
-- INSERT INTO storage.buckets (id, name, public) VALUES ('books', 'books', false);

-- Realtime for meeting chat
ALTER PUBLICATION supabase_realtime ADD TABLE meeting_chat_messages;
