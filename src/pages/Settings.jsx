import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/Modal/Modal';
import { pushSupported, getPushSubscription, enablePush, disablePush } from '../utils/push';

const defaultSettings = {
    language: 'English (UK)',
    units: 'Kilometers (km)',
    auto_night_mode: true,
    route_risk_alerts: true,
    tourism_highlights: true,
    fatigue_prompts: true,
    share_trip_progress: false
};

const ToggleRow = ({ label, desc, active, onToggle, border = true }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: border ? '1px solid var(--border)' : 'none' }}>
        <div>
            <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--dark)' }}>{label}</div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>{desc}</div>
        </div>
        <div
            onClick={onToggle}
            style={{
                width: '44px', height: '24px', borderRadius: '12px',
                background: active ? '#2563eb' : 'var(--border)',
                cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0
            }}
        >
            <div style={{
                position: 'absolute', top: '2px', left: active ? '22px' : '2px',
                width: '20px', height: '20px', borderRadius: '50%',
                background: 'var(--card)', boxShadow: '0 1px 4px rgba(0,0,0,0.2)', transition: 'left 0.2s'
            }} />
        </div>
    </div>
);

const Settings = () => {
    const { user, profile, logout } = useAuth();
    const { theme, setTheme, themes, compact, setCompact } = useTheme();
    const toast = useToast();
    const navigate = useNavigate();
    const [settings, setSettings] = useState(defaultSettings);
    const [saving, setSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Change-password inline form
    const [showPwd, setShowPwd] = useState(false);
    const [pwd, setPwd] = useState({ next: '', confirm: '' });
    const [pwdSaving, setPwdSaving] = useState(false);
    const [confirmDel, setConfirmDel] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Background push notifications
    const [pushOn, setPushOn] = useState(false);
    const [pushBusy, setPushBusy] = useState(false);
    useEffect(() => { getPushSubscription().then(s => setPushOn(!!s)); }, []);

    const togglePush = async () => {
        setPushBusy(true);
        try {
            if (pushOn) {
                await disablePush();
                setPushOn(false);
                toast.info('Background notifications turned off.');
            } else {
                await enablePush(user.id);
                setPushOn(true);
                toast.success('Background notifications on — you\'ll get ride alerts even when the app is closed.');
            }
        } catch (e) {
            toast.error(e.message);
        }
        setPushBusy(false);
    };

    const changePassword = async () => {
        if (pwd.next.length < 6) return toast.error('Password must be at least 6 characters.');
        if (pwd.next !== pwd.confirm) return toast.error('Passwords do not match.');
        setPwdSaving(true);
        const { error } = await supabase.auth.updateUser({ password: pwd.next });
        setPwdSaving(false);
        if (error) return toast.error(error.message);
        setShowPwd(false);
        setPwd({ next: '', confirm: '' });
        toast.success('Password updated successfully.');
    };

    const downloadData = async () => {
        const [{ data: trips }, { data: userSettings }] = await Promise.all([
            supabase.from('trips').select('*').eq('user_id', user.id),
            supabase.from('user_settings').select('*').eq('user_id', user.id).single()
        ]);
        const payload = {
            exported_at: new Date().toISOString(),
            account: { id: user.id, email: user.email },
            profile,
            settings: userSettings,
            trips: trips || []
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `saferoute-data-${user.id.slice(0, 8)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Your data export has been downloaded.');
    };

    const deleteAccount = async () => {
        setDeleting(true);
        await supabase.from('trips').delete().eq('user_id', user.id);
        await supabase.from('user_settings').delete().eq('user_id', user.id);
        await supabase.from('profiles').delete().eq('id', user.id);
        await logout();
        navigate('/login');
    };

    useEffect(() => {
        if (!user) return;
        const fetchSettings = async () => {
            const { data } = await supabase
                .from('user_settings')
                .select('*')
                .eq('user_id', user.id)
                .single();
            if (data) setSettings(data);
            setLoading(false);
        };
        fetchSettings();
    }, [user]);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: user.id,
                ...settings,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });
        setSaving(false);
        if (error) toast.error(error.message);
        else toast.success('Settings saved!');
    };

    const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

    if (loading) return (
        <div className="main">
            <div className="header"><h1>Settings</h1></div>
            <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.7)' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px' }}></i>
            </div>
        </div>
    );

    return (
        <div className="main">
            <div className="header">
                <h1>Application Settings</h1>
                <p>Configure and personalize your SafeRoute experience</p>
            </div>

            {/* Appearance */}
            <div className="card fade-in" style={{ marginBottom: '30px' }}>
                <div className="card-title"><i className="fas fa-palette"></i>Appearance</div>
                <label>Background Theme</label>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', margin: '8px 0 20px' }}>
                    {Object.entries(themes).map(([key, t]) => (
                        <button
                            key={key}
                            onClick={() => setTheme(key)}
                            title={t.label}
                            style={{
                                width: '92px', height: '58px', borderRadius: '12px', cursor: 'pointer',
                                background: t.bg, color: 'white', fontSize: '12px', fontWeight: 600,
                                border: theme === key ? '3px solid var(--dark)' : '3px solid transparent',
                                boxShadow: theme === key ? '0 0 0 2px white inset' : 'none',
                                display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '6px'
                            }}
                        >
                            {theme === key && <i className="fas fa-check" style={{ marginRight: '4px' }}></i>}{t.label}
                        </button>
                    ))}
                </div>
                <ToggleRow label="Compact Density" desc="Tighter spacing to fit more on screen"
                    active={compact} onToggle={() => setCompact(!compact)} border={false} />
            </div>

            <div className="grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div className="card fade-in">
                        <div className="card-title">
                            <i className="fas fa-sliders-h"></i>
                            General Preferences
                        </div>
                        <div className="form-group">
                            <label>Language</label>
                            <select value={settings.language} onChange={e => setSettings({ ...settings, language: e.target.value })}>
                                <option>English (UK)</option>
                                <option>Urdu (پاکستانی)</option>
                                <option>English (US)</option>
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Distance Units</label>
                            <select value={settings.units} onChange={e => setSettings({ ...settings, units: e.target.value })}>
                                <option>Kilometers (km)</option>
                                <option>Miles (mi)</option>
                            </select>
                        </div>
                        <div style={{ paddingTop: '8px' }}>
                            <ToggleRow label="Automatic Night Mode" desc="Switch theme based on local time"
                                active={settings.auto_night_mode} onToggle={() => toggle('auto_night_mode')} border={false} />
                        </div>
                    </div>

                    <div className="card fade-in">
                        <div className="card-title">
                            <i className="fas fa-bell"></i>
                            Notifications
                        </div>
                        <ToggleRow label="Route Risk Alerts" desc="Real-time hazard notifications"
                            active={settings.route_risk_alerts} onToggle={() => toggle('route_risk_alerts')} />
                        <ToggleRow label="Tourism Highlights" desc="Points of interest suggestions"
                            active={settings.tourism_highlights} onToggle={() => toggle('tourism_highlights')} />
                        <ToggleRow label="Driver Fatigue Prompts" desc="AI-suggested break reminders"
                            active={settings.fatigue_prompts} onToggle={() => toggle('fatigue_prompts')} border={false} />
                        {pushSupported() && (
                            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px', marginTop: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--dark)' }}>
                                            Background Push Notifications
                                            <span className="route-badge" style={{ background: '#ede9fe', color: '#6d28d9', fontSize: '9px', marginLeft: '8px' }}>NEW</span>
                                        </div>
                                        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                                            Ride requests, driver updates & messages — even when the app is closed
                                        </div>
                                    </div>
                                    <button className={`btn btn-sm ${pushOn ? 'btn-ghost' : 'btn-primary'}`} style={{ width: 'auto', flexShrink: 0 }}
                                        onClick={togglePush} disabled={pushBusy}>
                                        {pushBusy ? <i className="fas fa-spinner fa-spin"></i> : pushOn ? 'Turn Off' : 'Enable'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div className="card fade-in">
                        <div className="card-title">
                            <i className="fas fa-shield-alt"></i>
                            Privacy & Security
                        </div>
                        <ToggleRow label="Share Trip Progress" desc="Allow emergency contacts to track you"
                            active={settings.share_trip_progress} onToggle={() => toggle('share_trip_progress')} border={false} />
                        <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button className="btn btn-secondary" style={{ textAlign: 'left' }} onClick={() => setShowPwd(s => !s)}>
                                <i className="fas fa-key" style={{ marginRight: '10px', color: 'var(--muted)' }}></i>
                                Change Password
                            </button>

                            {showPwd && (
                                <div style={{ background: 'var(--light)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>New Password</label>
                                        <input type="password" placeholder="Min 6 characters"
                                            value={pwd.next} onChange={e => setPwd({ ...pwd, next: e.target.value })} />
                                    </div>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label>Confirm Password</label>
                                        <input type="password" placeholder="Repeat password"
                                            value={pwd.confirm} onChange={e => setPwd({ ...pwd, confirm: e.target.value })} />
                                    </div>
                                    <button className="btn btn-primary" onClick={changePassword} disabled={pwdSaving}>
                                        {pwdSaving
                                            ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Updating...</>
                                            : <><i className="fas fa-check" style={{ marginRight: '8px' }}></i>Update Password</>}
                                    </button>
                                </div>
                            )}

                            <button className="btn btn-secondary" style={{ textAlign: 'left' }} onClick={downloadData}>
                                <i className="fas fa-download" style={{ marginRight: '10px', color: 'var(--muted)' }}></i>
                                Download My Data
                            </button>
                        </div>
                    </div>

                    <div className="card fade-in">
                        <div className="card-title" style={{ color: '#ef4444' }}>
                            <i className="fas fa-exclamation-triangle"></i>
                            Danger Zone
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: '1.6', marginBottom: '16px' }}>
                            Logging out will end your current session. Account deletion is permanent.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button
                                className="btn"
                                style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', textAlign: 'left' }}
                                onClick={logout}
                            >
                                <i className="fas fa-sign-out-alt" style={{ marginRight: '10px' }}></i>
                                Sign Out
                            </button>
                            <button
                                className="btn"
                                style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', textAlign: 'left' }}
                                onClick={() => setConfirmDel(true)}
                            >
                                <i className="fas fa-trash" style={{ marginRight: '10px' }}></i>
                                Delete Account
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '30px' }}>
                <button
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '12px 32px' }}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving
                        ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Saving...</>
                        : <><i className="fas fa-save" style={{ marginRight: '8px' }}></i>Save Settings</>
                    }
                </button>
            </div>

            <ConfirmDialog
                open={confirmDel}
                onClose={() => setConfirmDel(false)}
                onConfirm={deleteAccount}
                loading={deleting}
                title="Delete your account?"
                message="This permanently deletes your profile, settings and all saved trips, then signs you out. This cannot be undone."
                confirmLabel="Delete Everything"
            />
        </div>
    );
};

export default Settings;
