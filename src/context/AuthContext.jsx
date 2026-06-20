import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be inside AuthProvider');
    return ctx;
};

// Dev-only demo mode: set localStorage sr_demo=1 to browse the UI without a
// backend session (used for docs/screenshots; all queries return empty data).
const DEMO = import.meta.env.DEV && typeof localStorage !== 'undefined' && localStorage.getItem('sr_demo') === '1';
const DEMO_USER = { id: '00000000-0000-0000-0000-000000000000', email: 'demo@saferoute.app' };
const DEMO_PROFILE = {
    id: DEMO_USER.id, full_name: 'Demo Driver', email: DEMO_USER.email,
    role: 'admin', plan: 'Pro', user_type: 'customer', safety_score: 97,
    vehicle: 'Toyota Corolla Cross', created_at: new Date().toISOString()
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(DEMO ? DEMO_USER : null);
    const [profile, setProfile] = useState(DEMO ? DEMO_PROFILE : null);
    const [loading, setLoading] = useState(!DEMO);

    const fetchProfile = useCallback(async (userId) => {
        const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        setProfile(data ?? null);
    }, []);

    useEffect(() => {
        if (DEMO) return; // demo mode: skip real auth wiring
        let mounted = true;

        const initAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!mounted) return;
            setUser(session?.user ?? null);
            if (session?.user) await fetchProfile(session.user.id);
            setLoading(false);
        };

        initAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
            if (!mounted) return;
            setUser(session?.user ?? null);
            if (session?.user) {
                await fetchProfile(session.user.id);
            } else {
                setProfile(null);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, [fetchProfile]);

    const login = (email, password) =>
        supabase.auth.signInWithPassword({ email, password });

    const register = (email, password, fullName) =>
        supabase.auth.signUp({
            email,
            password,
            options: { data: { full_name: fullName } }
        });

    const logout = () => supabase.auth.signOut();

    const refreshProfile = () => user && fetchProfile(user.id);

    return (
        <AuthContext.Provider value={{ user, profile, loading, login, register, logout, refreshProfile }}>
            {children}
        </AuthContext.Provider>
    );
};
