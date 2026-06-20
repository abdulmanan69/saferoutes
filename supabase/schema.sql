-- =============================================
-- SafeRoute Database Schema
-- Run this entire file in Supabase SQL Editor
-- =============================================

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    full_name TEXT,
    email TEXT,
    phone TEXT,
    vehicle TEXT DEFAULT 'Not set',
    plate TEXT,
    emergency_contact TEXT,
    emergency_phone TEXT,
    avatar_url TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    safety_score INTEGER DEFAULT 95,
    plan TEXT DEFAULT 'Free' CHECK (plan IN ('Free', 'Pro', 'Fleet')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- If you already created the table before, add the columns:
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'Free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'customer';

-- 2. Trips
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    start_location TEXT NOT NULL,
    destination TEXT NOT NULL,
    route_name TEXT,
    distance_km NUMERIC DEFAULT 0,
    duration_hours NUMERIC DEFAULT 0,
    risk_level TEXT DEFAULT 'Low' CHECK (risk_level IN ('Low', 'Medium', 'High')),
    risk_score INTEGER DEFAULT 0,
    status TEXT DEFAULT 'Completed' CHECK (status IN ('Completed', 'In Progress', 'Cancelled')),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. User settings
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    language TEXT DEFAULT 'English (UK)',
    units TEXT DEFAULT 'Kilometers (km)',
    auto_night_mode BOOLEAN DEFAULT TRUE,
    route_risk_alerts BOOLEAN DEFAULT TRUE,
    tourism_highlights BOOLEAN DEFAULT TRUE,
    fatigue_prompts BOOLEAN DEFAULT TRUE,
    share_trip_progress BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Announcements (admin broadcasts shown to every user)
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'danger')),
    active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Rides marketplace (customers request, drivers accept & complete)
CREATE TABLE IF NOT EXISTS public.rides (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    customer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    driver_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    pickup TEXT NOT NULL,
    destination TEXT NOT NULL,
    distance_km NUMERIC DEFAULT 0,
    fare NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'requested' CHECK (status IN ('requested', 'accepted', 'completed', 'cancelled')),
    notes TEXT,
    pickup_lat NUMERIC, pickup_lng NUMERIC,
    dest_lat NUMERIC, dest_lng NUMERIC,
    driver_lat NUMERIC, driver_lng NUMERIC,   -- live driver position while en route
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrading an existing database? Add the tracking columns:
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS pickup_lat NUMERIC;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS pickup_lng NUMERIC;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS dest_lat NUMERIC;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS dest_lng NUMERIC;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS driver_lat NUMERIC;
ALTER TABLE public.rides ADD COLUMN IF NOT EXISTS driver_lng NUMERIC;

-- 6. In-ride chat between customer and driver
CREATE TABLE IF NOT EXISTS public.ride_messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    ride_id UUID REFERENCES public.rides(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS ride_messages_ride_idx ON public.ride_messages(ride_id, created_at);

-- Indexes
CREATE INDEX IF NOT EXISTS trips_user_id_idx ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS trips_created_at_idx ON public.trips(created_at DESC);
CREATE INDEX IF NOT EXISTS announcements_active_idx ON public.announcements(active, created_at DESC);
CREATE INDEX IF NOT EXISTS rides_status_idx ON public.rides(status, created_at DESC);
CREATE INDEX IF NOT EXISTS rides_customer_idx ON public.rides(customer_id);
CREATE INDEX IF NOT EXISTS rides_driver_idx ON public.rides(driver_id);

-- =============================================
-- Row Level Security
-- =============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;

-- Admin check function (avoids circular RLS reference)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT COALESCE(
        (SELECT role = 'admin' FROM public.profiles WHERE id = auth.uid()),
        FALSE
    );
$$;

-- Profiles policies
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
DROP POLICY IF EXISTS "profiles_insert" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
DROP POLICY IF EXISTS "profiles_delete" ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
    USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT
    WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
    USING (id = auth.uid() OR public.is_admin());
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE
    USING (public.is_admin());

-- Trips policies
DROP POLICY IF EXISTS "trips_select" ON public.trips;
DROP POLICY IF EXISTS "trips_insert" ON public.trips;
DROP POLICY IF EXISTS "trips_update" ON public.trips;
DROP POLICY IF EXISTS "trips_delete" ON public.trips;

CREATE POLICY "trips_select" ON public.trips FOR SELECT
    USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "trips_insert" ON public.trips FOR INSERT
    WITH CHECK (user_id = auth.uid());
CREATE POLICY "trips_update" ON public.trips FOR UPDATE
    USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "trips_delete" ON public.trips FOR DELETE
    USING (user_id = auth.uid() OR public.is_admin());

-- Settings policies (owner manages their own; admins may manage any — needed so
-- admin "delete user data" can also remove the user's settings row)
DROP POLICY IF EXISTS "settings_all" ON public.user_settings;
CREATE POLICY "settings_all" ON public.user_settings FOR ALL
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Announcements policies: every signed-in user reads active ones; admins manage all
DROP POLICY IF EXISTS "announcements_select" ON public.announcements;
DROP POLICY IF EXISTS "announcements_write" ON public.announcements;

CREATE POLICY "announcements_select" ON public.announcements FOR SELECT
    USING (active = TRUE OR public.is_admin());
CREATE POLICY "announcements_write" ON public.announcements FOR ALL
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- Rides policies: open requests are visible to any signed-in user (drivers browse
-- them); accepted/completed rides only to their customer, driver, or an admin.
DROP POLICY IF EXISTS "rides_select" ON public.rides;
DROP POLICY IF EXISTS "rides_insert" ON public.rides;
DROP POLICY IF EXISTS "rides_update" ON public.rides;
DROP POLICY IF EXISTS "rides_delete" ON public.rides;

CREATE POLICY "rides_select" ON public.rides FOR SELECT
    USING (status = 'requested' OR customer_id = auth.uid() OR driver_id = auth.uid() OR public.is_admin());
CREATE POLICY "rides_insert" ON public.rides FOR INSERT
    WITH CHECK (customer_id = auth.uid());
CREATE POLICY "rides_update" ON public.rides FOR UPDATE
    USING (status = 'requested' OR customer_id = auth.uid() OR driver_id = auth.uid() OR public.is_admin());
CREATE POLICY "rides_delete" ON public.rides FOR DELETE
    USING (customer_id = auth.uid() OR public.is_admin());

-- Ride chat: only the ride's customer/driver (or admin) can read & send
DROP POLICY IF EXISTS "ride_messages_select" ON public.ride_messages;
DROP POLICY IF EXISTS "ride_messages_insert" ON public.ride_messages;

CREATE POLICY "ride_messages_select" ON public.ride_messages FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.rides r
        WHERE r.id = ride_id AND (r.customer_id = auth.uid() OR r.driver_id = auth.uid())
    ) OR public.is_admin());
CREATE POLICY "ride_messages_insert" ON public.ride_messages FOR INSERT
    WITH CHECK (sender_id = auth.uid() AND EXISTS (
        SELECT 1 FROM public.rides r
        WHERE r.id = ride_id AND (r.customer_id = auth.uid() OR r.driver_id = auth.uid())
    ));

-- Let ride counterparties see each other's basic profile (name/phone for contact)
DROP POLICY IF EXISTS "profiles_ride_counterpart" ON public.profiles;
CREATE POLICY "profiles_ride_counterpart" ON public.profiles FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.rides r
        WHERE (r.customer_id = auth.uid() AND r.driver_id = profiles.id)
           OR (r.driver_id = auth.uid() AND r.customer_id = profiles.id)
    ));

-- =============================================
-- Realtime (instant ride updates + chat)
-- =============================================
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.rides;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================
-- Auto-create profile + settings on signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        NEW.email
    )
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
