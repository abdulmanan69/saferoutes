import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { summarizeTrips } from '../utils/helpers';

const Account = () => {
    const { user, profile, logout } = useAuth();
    const navigate = useNavigate();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        supabase
            .from('trips')
            .select('*')
            .eq('user_id', user.id)
            .then(({ data }) => { setTrips(data || []); setLoading(false); });
    }, [user]);

    const stats = summarizeTrips(trips);
    const isAdmin = profile?.role === 'admin';
    const memberSince = profile?.created_at
        ? new Date(profile.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : '—';

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <div className="main">
            <div className="header">
                <h1>My Account</h1>
                <p>Manage your account settings and preferences</p>
            </div>

            {/* Account summary */}
            <div className="card fade-in" style={{ padding: '0', overflow: 'hidden', marginBottom: '30px' }}>
                <div style={{ height: '110px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', position: 'relative' }}>
                    <div style={{
                        position: 'absolute', bottom: '-36px', left: '30px',
                        width: '72px', height: '72px', borderRadius: '50%',
                        background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '30px', color: '#2563eb', border: '4px solid white',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        <i className="fas fa-user"></i>
                    </div>
                </div>
                <div style={{ padding: '48px 30px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <h2 style={{ fontSize: '20px', margin: '0 0 4px', color: 'var(--dark)' }}>{profile?.full_name || 'Your Name'}</h2>
                        <p style={{ color: 'var(--muted)', margin: 0, fontSize: '14px' }}>{user?.email}</p>
                    </div>
                    <span className={`route-badge ${isAdmin ? 'badge-safe' : 'badge-moderate'}`}>
                        {isAdmin ? '⭐ Admin Account' : 'Standard Account'}
                    </span>
                </div>
            </div>

            {/* Usage stats */}
            <div className="kpi-row">
                {[
                    { label: 'Trips Planned', value: loading ? '…' : stats.totalTrips, icon: 'fa-route', color: '#2563eb' },
                    { label: 'Total Distance', value: loading ? '…' : `${stats.totalDist} km`, icon: 'fa-road', color: '#06b6d4' },
                    { label: 'Safety Score', value: profile?.safety_score ?? 95, icon: 'fa-shield-halved', color: '#10b981' },
                    { label: 'Cities Visited', value: loading ? '…' : stats.cities, icon: 'fa-city', color: '#f59e0b' }
                ].map(({ label, value, icon, color }) => (
                    <div key={label} className="stat-card fade-in">
                        <i className={`fas ${icon}`} style={{ fontSize: '24px', color, marginBottom: '10px' }}></i>
                        <div className="stat-value" style={{ color }}>{value}</div>
                        <div className="stat-label">{label}</div>
                    </div>
                ))}
            </div>

            {/* Subscription */}
            <div className="card fade-in" style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="action-icon" style={{ background: 'rgba(139,92,246,0.14)', color: '#8b5cf6' }}>
                        <i className="fas fa-crown"></i>
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Subscription</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)' }}>{profile?.plan || 'Free'} Plan</div>
                        <div style={{ fontSize: '13px', color: 'var(--muted)' }}>{(profile?.plan || 'Free') === 'Free' ? 'Upgrade for analytics, alternatives & more.' : 'Thanks for being a subscriber!'}</div>
                    </div>
                </div>
                <Link to="/subscription" className="btn btn-primary" style={{ width: 'auto', textDecoration: 'none' }}>
                    <i className="fas fa-arrow-up-right-dots" style={{ marginRight: '8px' }}></i>Manage Plan
                </Link>
            </div>

            <div className="grid">
                <div className="card fade-in">
                    <div className="card-title"><i className="fas fa-id-card"></i>Account Details</div>
                    {[
                        ['Full Name', profile?.full_name || '—'],
                        ['Email', user?.email || '—'],
                        ['Phone', profile?.phone || '—'],
                        ['Default Vehicle', profile?.vehicle || '—'],
                        ['Role', isAdmin ? 'Administrator' : 'Driver'],
                        ['Member Since', memberSince]
                    ].map(([label, value]) => (
                        <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--light)' }}>
                            <span style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: '600' }}>{label}</span>
                            <span style={{ fontSize: '14px', color: 'var(--dark)', fontWeight: '500', textAlign: 'right' }}>{value}</span>
                        </div>
                    ))}
                </div>

                <div className="card fade-in" style={{ height: 'fit-content' }}>
                    <div className="card-title"><i className="fas fa-bolt"></i>Quick Actions</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <Link to="/profile" className="btn btn-secondary" style={{ textAlign: 'left', textDecoration: 'none' }}>
                            <i className="fas fa-user-pen" style={{ marginRight: '10px', color: 'var(--muted)' }}></i>Edit Profile
                        </Link>
                        <Link to="/settings" className="btn btn-secondary" style={{ textAlign: 'left', textDecoration: 'none' }}>
                            <i className="fas fa-cog" style={{ marginRight: '10px', color: 'var(--muted)' }}></i>Preferences & Security
                        </Link>
                        <Link to="/history" className="btn btn-secondary" style={{ textAlign: 'left', textDecoration: 'none' }}>
                            <i className="fas fa-clock-rotate-left" style={{ marginRight: '10px', color: 'var(--muted)' }}></i>Trip History
                        </Link>
                        {isAdmin && (
                            <Link to="/admin" className="btn btn-secondary" style={{ textAlign: 'left', textDecoration: 'none' }}>
                                <i className="fas fa-shield-alt" style={{ marginRight: '10px', color: 'var(--muted)' }}></i>Admin Panel
                            </Link>
                        )}
                        <button
                            className="btn"
                            style={{ background: '#fff7ed', color: '#ea580c', border: '1px solid #fed7aa', textAlign: 'left' }}
                            onClick={handleLogout}
                        >
                            <i className="fas fa-sign-out-alt" style={{ marginRight: '10px' }}></i>Sign Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Account;
