import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';

const TITLES = {
    '/': 'Dashboard',
    '/new-trip': 'New Trip',
    '/journey': 'Live Journey',
    '/outfit': 'Smart Outfit',
    '/rides': 'Rides',
    '/subscription': 'Subscription',
    '/history': 'Trip History',
    '/tourism': 'Tourism Hub',
    '/statistics': 'Statistics',
    '/risk-analysis': 'Risk Analysis',
    '/analytics': 'Analytics',
    '/profile': 'Profile',
    '/account': 'My Account',
    '/settings': 'Settings',
    '/admin': 'Admin Panel'
};

const initials = (name) => (name || 'D').split(' ').map(s => s[0]).slice(0, 2).join('').toUpperCase();

const Topbar = ({ onMenu = () => {} }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { user, profile, logout } = useAuth();
    const { theme, setTheme, themes, compact, setCompact } = useTheme();

    const [q, setQ] = useState('');
    const [open, setOpen] = useState(null); // 'theme' | 'notif' | 'user' | null
    const [notes, setNotes] = useState([]);
    const ref = useRef(null);

    useEffect(() => {
        const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    useEffect(() => {
        if (!user) return;
        Promise.all([
            supabase.from('trips').select('*').eq('user_id', user.id)
                .order('created_at', { ascending: false }).limit(50),
            supabase.from('announcements').select('*').eq('active', true)
                .order('created_at', { ascending: false }).limit(5)
        ]).then(([{ data }, { data: anns }]) => {
            const t = data || [];
            const n = [];
            // Admin broadcasts first — most important
            (anns || []).forEach(a => n.push({
                icon: 'fa-bullhorn',
                type: a.type === 'danger' ? 'error' : a.type === 'warning' ? 'warning' : 'info',
                text: `${a.title}: ${a.message}`
            }));
            const high = t.filter(x => x.risk_level === 'High');
            if (high.length) n.push({ icon: 'fa-triangle-exclamation', type: 'error', text: `${high.length} high-risk trip${high.length !== 1 ? 's' : ''} logged. Review Risk Analysis.` });
            if (t.length === 0) n.push({ icon: 'fa-route', type: 'info', text: 'Plan your first trip to unlock insights.' });
            if (t[0]) n.push({ icon: 'fa-clock', type: 'info', text: `Last trip: ${t[0].start_location} → ${t[0].destination}` });
            n.push({ icon: 'fa-shield-halved', type: 'success', text: `Safety score: ${profile?.safety_score ?? 95}/100` });
            setNotes(n);
        });
    }, [user, profile]);

    const title = TITLES[location.pathname] || (location.pathname.startsWith('/tourism/scenic') ? 'Scenic Route' : 'SafeRoute');

    const submitSearch = (e) => {
        e.preventDefault();
        if (q.trim()) { navigate(`/history?q=${encodeURIComponent(q.trim())}`); setQ(''); }
    };

    const go = (path) => { setOpen(null); navigate(path); };
    const doLogout = async () => { setOpen(null); await logout(); navigate('/login'); };

    return (
        <div className="topbar" ref={ref}>
            <button className="tb-icon" title="Toggle menu" onClick={onMenu} style={{ flexShrink: 0 }}>
                <i className="fas fa-bars"></i>
            </button>
            <div className="topbar-title">
                <h2>{title}</h2>
                <span className="topbar-crumb">SafeRoute / {title}</span>
            </div>

            <form className="topbar-search" onSubmit={submitSearch}>
                <i className="fas fa-search"></i>
                <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search your trips & destinations..." />
            </form>

            <div className="topbar-actions">
                {/* Theme */}
                <div className="tb-pop-wrap">
                    <button className="tb-icon" title="Theme" onClick={() => setOpen(open === 'theme' ? null : 'theme')}>
                        <i className="fas fa-palette"></i>
                    </button>
                    {open === 'theme' && (
                        <div className="tb-pop">
                            <div className="tb-pop-title">Background Theme</div>
                            <div className="theme-grid">
                                {Object.entries(themes).map(([key, t]) => (
                                    <button
                                        key={key}
                                        className={`theme-swatch ${theme === key ? 'active' : ''}`}
                                        style={{ background: t.bg }}
                                        title={t.label}
                                        onClick={() => setTheme(key)}
                                    >
                                        {theme === key && <i className="fas fa-check"></i>}
                                    </button>
                                ))}
                            </div>
                            <div className="tb-pop-row" onClick={() => setCompact(!compact)} style={{ cursor: 'pointer' }}>
                                <span><i className="fas fa-compress" style={{ marginRight: '8px' }}></i>Compact density</span>
                                <span className={`mini-switch ${compact ? 'on' : ''}`}><span /></span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Notifications */}
                <div className="tb-pop-wrap">
                    <button className="tb-icon" title="Notifications" onClick={() => setOpen(open === 'notif' ? null : 'notif')}>
                        <i className="fas fa-bell"></i>
                        {notes.length > 0 && <span className="tb-badge">{notes.length}</span>}
                    </button>
                    {open === 'notif' && (
                        <div className="tb-pop" style={{ width: '300px' }}>
                            <div className="tb-pop-title">Notifications</div>
                            {notes.length === 0 && <div className="tb-empty">You're all caught up.</div>}
                            {notes.map((n, i) => (
                                <div key={i} className="tb-note">
                                    <i className={`fas ${n.icon} note-${n.type}`}></i>
                                    <span>{n.text}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* User */}
                <div className="tb-pop-wrap">
                    <button className="tb-user" onClick={() => setOpen(open === 'user' ? null : 'user')}>
                        <span className="tb-avatar">{initials(profile?.full_name)}</span>
                        <span className="tb-user-meta">
                            <span className="tb-user-name">{profile?.full_name?.split(' ')[0] || 'Driver'}</span>
                            <span className="tb-user-role">{profile?.role === 'admin' ? 'Admin' : 'Driver'}</span>
                        </span>
                        <i className="fas fa-chevron-down" style={{ fontSize: '11px' }}></i>
                    </button>
                    {open === 'user' && (
                        <div className="tb-pop" style={{ right: 0 }}>
                            <div className="tb-pop-title">{user?.email}</div>
                            <button className="tb-menu-item" onClick={() => go('/profile')}><i className="fas fa-user"></i>Profile</button>
                            <button className="tb-menu-item" onClick={() => go('/account')}><i className="fas fa-id-badge"></i>My Account</button>
                            <button className="tb-menu-item" onClick={() => go('/settings')}><i className="fas fa-cog"></i>Settings</button>
                            {profile?.role === 'admin' && (
                                <button className="tb-menu-item" onClick={() => go('/admin')}><i className="fas fa-shield-alt"></i>Admin Panel</button>
                            )}
                            <button className="tb-menu-item danger" onClick={doLogout}><i className="fas fa-sign-out-alt"></i>Logout</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Topbar;
