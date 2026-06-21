import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

const Statistics = () => {
    const { user } = useAuth();
    const [stats, setStats] = useState(null);
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        const fetchStats = async () => {
            const { data } = await supabase
                .from('trips')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });
            const t = data || [];
            setTrips(t);
            const totalDist = Math.round(t.reduce((s, x) => s + (x.distance_km || 0), 0));
            const totalHours = Math.round(t.reduce((s, x) => s + (x.duration_hours || 0), 0));
            const cities = new Set([...t.map(x => x.start_location), ...t.map(x => x.destination)]);
            const avgRisk = t.length ? Math.round(t.reduce((s, x) => s + (x.risk_score || 0), 0) / t.length) : 0;
            const lowRisk = t.filter(x => x.risk_level === 'Low').length;
            const medRisk = t.filter(x => x.risk_level === 'Medium').length;
            const highRisk = t.filter(x => x.risk_level === 'High').length;
            setStats({ totalDist, totalHours, cities: cities.size, totalTrips: t.length, avgRisk, lowRisk, medRisk, highRisk });
            setLoading(false);
        };
        fetchStats();
    }, [user]);

    if (loading) return (
        <div className="main">
            <div className="header"><h1>Statistics</h1><p>Your journey in numbers</p></div>
            <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.7)' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px' }}></i>
            </div>
        </div>
    );

    const bigCards = [
        { label: 'Total Distance', value: stats.totalDist ? `${stats.totalDist} km` : '0 km', icon: 'fa-road', color: '#2563eb' },
        { label: 'Total Hours', value: stats.totalHours ? `${stats.totalHours}h` : '0h', icon: 'fa-clock', color: '#06b6d4' },
        { label: 'Cities Visited', value: stats.cities, icon: 'fa-city', color: '#10b981' },
        { label: 'Total Trips', value: stats.totalTrips, icon: 'fa-route', color: '#f59e0b' }
    ];

    return (
        <div className="main">
            <div className="header">
                <h1>Statistics</h1>
                <p>Your journey in numbers</p>
            </div>

            {/* Main stats */}
            <div className="kpi-row">
                {bigCards.map(({ label, value, icon, color }) => (
                    <div key={label} className="stat-card fade-in">
                        <i className={`fas ${icon}`} style={{ fontSize: '28px', color, marginBottom: '12px' }}></i>
                        <div className="stat-value" style={{ color }}>{value}</div>
                        <div className="stat-label">{label}</div>
                    </div>
                ))}
            </div>

            {stats.totalTrips > 0 ? (
                <div className="grid">
                    {/* Risk breakdown */}
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-chart-pie"></i>Risk Breakdown</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {[
                                { label: 'Low Risk', count: stats.lowRisk, color: '#10b981' },
                                { label: 'Medium Risk', count: stats.medRisk, color: '#f59e0b' },
                                { label: 'High Risk', count: stats.highRisk, color: '#ef4444' }
                            ].map(({ label, count, color }) => (
                                <div key={label}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                        <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{label}</span>
                                        <span style={{ fontSize: '13px', color, fontWeight: '700' }}>
                                            {count} trip{count !== 1 ? 's' : ''}
                                        </span>
                                    </div>
                                    <div style={{ height: '8px', background: 'var(--light)', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%', borderRadius: '4px', background: color,
                                            width: `${stats.totalTrips ? (count / stats.totalTrips) * 100 : 0}%`,
                                            transition: 'width 0.6s ease'
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: '24px', padding: '16px', background: 'var(--light)', borderRadius: '10px', textAlign: 'center' }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: stats.avgRisk < 20 ? '#10b981' : stats.avgRisk < 45 ? '#f59e0b' : '#ef4444' }}>
                                {stats.avgRisk}%
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>Average Risk Score</div>
                        </div>
                    </div>

                    {/* Recent activity */}
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-list-alt"></i>Recent Activity</div>
                        {trips.slice(0, 6).map(t => (
                            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--light)' }}>
                                <div>
                                    <div style={{ fontWeight: '600', fontSize: '13px' }}>
                                        {t.start_location} → {t.destination}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '2px' }}>
                                        {t.distance_km} km • {new Date(t.created_at).toLocaleDateString()}
                                    </div>
                                </div>
                                <span className={`route-badge ${t.risk_level === 'Low' ? 'badge-safe' : 'badge-moderate'}`} style={{ fontSize: '10px' }}>
                                    {t.risk_level}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="card fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
                    <i className="fas fa-chart-line" style={{ fontSize: '48px', color: 'var(--muted)', marginBottom: '16px' }}></i>
                    <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>No statistics yet</p>
                    <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px' }}>Complete your first trip to see stats.</p>
                </div>
            )}
        </div>
    );
};

export default Statistics;
