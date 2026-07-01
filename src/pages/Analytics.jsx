import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { summarizeTrips, tripsByMonth, efficiencyScore, riskColor } from '../utils/helpers';

const Analytics = () => {
    const { user } = useAuth();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!user) return;
        supabase
            .from('trips')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => { setTrips(data || []); setLoading(false); });
    }, [user]);

    if (loading) return (
        <div className="main">
            <div className="header"><h1>Analytics</h1><p>Deep dive into your driving behaviors and route trends</p></div>
            <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.7)' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px' }}></i>
            </div>
        </div>
    );

    const stats = summarizeTrips(trips);
    const months = tripsByMonth(trips, 6);
    const score = efficiencyScore(trips);
    const maxTrips = Math.max(1, ...months.map(m => m.trips));

    // Top destinations by frequency
    const destCount = {};
    trips.forEach(t => { if (t.destination) destCount[t.destination] = (destCount[t.destination] || 0) + 1; });
    const topDest = Object.entries(destCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxDest = Math.max(1, ...topDest.map(([, c]) => c));

    if (!trips.length) return (
        <div className="main">
            <div className="header"><h1>Analytics</h1><p>Deep dive into your driving behaviors and route trends</p></div>
            <div className="card fade-in" style={{ textAlign: 'center', padding: '60px 20px' }}>
                <i className="fas fa-chart-bar" style={{ fontSize: '48px', color: 'var(--muted)', marginBottom: '16px' }}></i>
                <p style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text)' }}>No analytics yet</p>
                <p style={{ color: 'var(--muted)', fontSize: '14px', marginTop: '8px' }}>Plan and save trips to unlock behavioral insights.</p>
            </div>
        </div>
    );

    const scoreColor = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';

    return (
        <div className="main">
            <div className="header">
                <h1>Analytics</h1>
                <p>Deep dive into your driving behaviors and route trends</p>
            </div>

            <div className="grid">
                {/* Trips per month */}
                <div className="card fade-in">
                    <div className="card-title"><i className="fas fa-chart-column"></i>Trips Per Month</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '200px', padding: '10px 0' }}>
                        {months.map(m => (
                            <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                                <div style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>{m.trips || ''}</div>
                                <div
                                    title={`${m.trips} trip(s)`}
                                    style={{
                                        width: '100%', maxWidth: '38px',
                                        height: `${(m.trips / maxTrips) * 100}%`,
                                        minHeight: m.trips ? '6px' : '2px',
                                        background: m.trips ? 'linear-gradient(180deg, var(--primary), var(--accent))' : 'var(--border)',
                                        borderRadius: '6px 6px 0 0', transition: 'height 0.5s ease'
                                    }}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>{m.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Efficiency score */}
                <div className="card fade-in">
                    <div className="card-title"><i className="fas fa-gauge-high"></i>Efficiency Score</div>
                    <div style={{ textAlign: 'center', padding: '20px 0' }}>
                        <div style={{ fontSize: '52px', fontWeight: 'bold', color: scoreColor }}>{score}%</div>
                        <div style={{ color: 'var(--muted)', marginBottom: '16px' }}>
                            {score >= 80 ? 'Excellent — low-risk routing!' : score >= 60 ? 'Good, with room to improve.' : 'Consider safer route choices.'}
                        </div>
                        <div style={{ height: '10px', background: 'var(--light)', borderRadius: '6px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${score}%`, background: scoreColor, transition: 'width 0.6s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '24px' }}>
                            <div>
                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#2563eb' }}>{stats.avgRisk}%</div>
                                <div className="stat-label">Avg Risk</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#10b981' }}>{stats.totalTrips}</div>
                                <div className="stat-label">Trips</div>
                            </div>
                            <div>
                                <div style={{ fontSize: '22px', fontWeight: 'bold', color: '#06b6d4' }}>{stats.totalDist}</div>
                                <div className="stat-label">km</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid">
                {/* Avg risk trend */}
                <div className="card fade-in">
                    <div className="card-title"><i className="fas fa-chart-line"></i>Average Risk Trend</div>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '14px', height: '180px', padding: '10px 0' }}>
                        {months.map(m => (
                            <div key={m.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--text)', marginBottom: '4px' }}>{m.trips ? `${m.avgRisk}%` : ''}</div>
                                <div
                                    style={{
                                        width: '100%', maxWidth: '38px',
                                        height: `${m.avgRisk}%`, minHeight: m.trips ? '6px' : '2px',
                                        background: m.trips ? riskColor(m.avgRisk < 20 ? 'Low' : m.avgRisk < 45 ? 'Medium' : 'High') : 'var(--border)',
                                        borderRadius: '6px 6px 0 0', transition: 'height 0.5s ease'
                                    }}
                                />
                                <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px' }}>{m.label}</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Top destinations */}
                <div className="card fade-in">
                    <div className="card-title"><i className="fas fa-location-dot"></i>Top Destinations</div>
                    {topDest.length === 0 && <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No destinations recorded.</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '6px' }}>
                        {topDest.map(([dest, count]) => (
                            <div key={dest}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text)' }}>{dest}</span>
                                    <span style={{ fontSize: '13px', color: '#2563eb', fontWeight: '700' }}>{count}×</span>
                                </div>
                                <div style={{ height: '8px', background: 'var(--light)', borderRadius: '4px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${(count / maxDest) * 100}%`, background: 'linear-gradient(90deg, var(--primary), var(--accent))', borderRadius: '4px', transition: 'width 0.6s ease' }} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Analytics;
