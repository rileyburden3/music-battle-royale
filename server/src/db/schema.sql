-- Battle Royale Music App Database Schema
-- PostgreSQL

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  firebase_uid VARCHAR(128) UNIQUE NOT NULL,
  username VARCHAR(30) UNIQUE NOT NULL,
  display_name VARCHAR(50) NOT NULL,
  avatar_url TEXT,
  emblem VARCHAR(10) NOT NULL DEFAULT '🎵',
  genre_preferences TEXT[] DEFAULT '{}',
  total_points INTEGER DEFAULT 0,
  battles_won INTEGER DEFAULT 0,
  battles_played INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Battles table
CREATE TABLE IF NOT EXISTS battles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(100) NOT NULL,
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'lobby',
  genre VARCHAR(50),
  song_count INTEGER NOT NULL DEFAULT 8,
  current_round INTEGER DEFAULT 0,
  invite_code VARCHAR(10) UNIQUE NOT NULL,
  voting_deadline TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_status CHECK (status IN ('lobby', 'submitting', 'voting', 'calculating', 'bracket', 'completed'))
);

-- Battle participants
CREATE TABLE IF NOT EXISTS battle_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) NOT NULL DEFAULT 'invited',
  songs_submitted BOOLEAN DEFAULT FALSE,
  rankings_submitted BOOLEAN DEFAULT FALSE,
  joined_at TIMESTAMPTZ,
  UNIQUE(battle_id, user_id),
  CONSTRAINT valid_participant_status CHECK (status IN ('invited', 'accepted', 'declined'))
);

-- Songs in a battle
CREATE TABLE IF NOT EXISTS songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  artist VARCHAR(200) NOT NULL,
  album VARCHAR(200),
  album_art_url TEXT,
  spotify_id VARCHAR(50),
  youtube_id VARCHAR(20),
  preview_url TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rankings (1-10 score per song per user per round)
CREATE TABLE IF NOT EXISTS rankings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  song_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  ranked_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 10),
  round INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(battle_id, song_id, ranked_by, round)
);

-- Bracket matches
CREATE TABLE IF NOT EXISTS bracket_matches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  battle_id UUID NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  round INTEGER NOT NULL,
  match_number INTEGER NOT NULL,
  song1_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  song2_id UUID NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  winner_id UUID REFERENCES songs(id) ON DELETE SET NULL,
  song1_avg_score DECIMAL(4,2),
  song2_avg_score DECIMAL(4,2),
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(battle_id, round, match_number)
);

-- Leaderboard entries (materialized/cached)
CREATE TABLE IF NOT EXISTS leaderboard_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period VARCHAR(20) NOT NULL DEFAULT 'all_time',
  points INTEGER DEFAULT 0,
  rank INTEGER,
  battles_won INTEGER DEFAULT 0,
  songs_in_top3 INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, period),
  CONSTRAINT valid_period CHECK (period IN ('weekly', 'monthly', 'all_time'))
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(30) NOT NULL,
  title VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_notification_type CHECK (type IN ('friend_accepted', 'submit_songs', 'voting_live', 'battle_complete'))
);

-- Cold start demo songs (pre-seeded)
CREATE TABLE IF NOT EXISTS demo_songs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  artist VARCHAR(200) NOT NULL,
  album VARCHAR(200),
  album_art_url TEXT,
  spotify_id VARCHAR(50),
  preview_url TEXT,
  genre VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_battles_creator ON battles(creator_id);
CREATE INDEX IF NOT EXISTS idx_battles_status ON battles(status);
CREATE INDEX IF NOT EXISTS idx_battles_invite_code ON battles(invite_code);
CREATE INDEX IF NOT EXISTS idx_battle_participants_battle ON battle_participants(battle_id);
CREATE INDEX IF NOT EXISTS idx_battle_participants_user ON battle_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_songs_battle ON songs(battle_id);
CREATE INDEX IF NOT EXISTS idx_rankings_battle ON rankings(battle_id);
CREATE INDEX IF NOT EXISTS idx_rankings_song ON rankings(song_id);
CREATE INDEX IF NOT EXISTS idx_bracket_matches_battle ON bracket_matches(battle_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_period ON leaderboard_entries(period, points DESC);

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER battles_updated_at BEFORE UPDATE ON battles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Migration: add email + phone_number to users (run once)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Migration: add songs_quota to battle_participants (run once)
ALTER TABLE battle_participants ADD COLUMN IF NOT EXISTS songs_quota INTEGER DEFAULT 2;
