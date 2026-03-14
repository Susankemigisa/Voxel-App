-- ============================================================
-- Voxel Database Schema
-- Run this in Supabase → SQL Editor
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
    id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name   TEXT,
    email       TEXT NOT NULL,
    avatar_url  TEXT,
    plan        TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── user_preferences ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_preferences (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    primary_language  TEXT NOT NULL DEFAULT 'en' CHECK (primary_language IN ('en', 'lg')),
    voice_gender      TEXT NOT NULL DEFAULT 'female' CHECK (voice_gender IN ('male','female','robot')),
    pitch             NUMERIC NOT NULL DEFAULT 50 CHECK (pitch BETWEEN 0 AND 100),
    reading_rate      NUMERIC NOT NULL DEFAULT 60 CHECK (reading_rate BETWEEN 0 AND 100),
    sign_language     BOOLEAN NOT NULL DEFAULT FALSE,
    speech_assist     BOOLEAN NOT NULL DEFAULT TRUE,
    tts_enabled       BOOLEAN NOT NULL DEFAULT FALSE,
    output_mode       TEXT NOT NULL DEFAULT 'both' CHECK (output_mode IN ('audio','visual','both')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id)
);

-- ── saved_phrases ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.saved_phrases (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    phrase      TEXT NOT NULL,
    language    TEXT NOT NULL DEFAULT 'en',
    category    TEXT CHECK (category IN ('navigation','emergency','custom')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_phrases_user ON public.saved_phrases(user_id);

-- ── transcription_history ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.transcription_history (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    transcript  TEXT NOT NULL,
    language    TEXT NOT NULL DEFAULT 'en',
    confidence  NUMERIC CHECK (confidence BETWEEN 0 AND 1),
    audio_url   TEXT,
    model_used  TEXT CHECK (model_used IN ('wav2vec2','mms')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcription_user    ON public.transcription_history(user_id);
CREATE INDEX IF NOT EXISTS idx_transcription_created ON public.transcription_history(created_at DESC);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE public.profiles             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_phrases        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcription_history ENABLE ROW LEVEL SECURITY;

-- profiles policies
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- user_preferences policies
CREATE POLICY "Users can manage own preferences"
    ON public.user_preferences FOR ALL USING (auth.uid() = user_id);

-- saved_phrases policies
CREATE POLICY "Users can manage own phrases"
    ON public.saved_phrases FOR ALL USING (auth.uid() = user_id);

-- transcription_history policies
CREATE POLICY "Users can view own history"
    ON public.transcription_history FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert history"
    ON public.transcription_history FOR INSERT WITH CHECK (true);

-- ── updated_at trigger ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
