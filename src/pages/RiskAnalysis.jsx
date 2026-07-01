import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { summarizeTrips, tripsByMonth, riskColor } from '../utils/helpers';
import { BarChart, DonutChart } from '../components/Charts/Charts';

const CHECKLIST = [
    { id: 'tires', icon: 'fa-circle-dot', text: 'Tire pressure & tread checked (incl. spare)' },
    { id: 'brakes', icon: 'fa-car-burst', text: 'Brakes and lights working' },
    { id: 'fuel', icon: 'fa-gas-pump', text: 'Full tank / charged battery' },
    { id: 'fluids', icon: 'fa-oil-can', text: 'Engine oil & coolant topped up' },
    { id: 'firstaid', icon: 'fa-kit-medical', text: 'First-aid kit on board' },
    { id: 'water', icon: 'fa-bottle-water', text: 'Water & snacks packed' },
    { id: 'phone', icon: 'fa-battery-full', text: 'Phone charged + car charger' },
    { id: 'docs', icon: 'fa-id-card', text: 'License, registration & insurance' },
    { id: 'contact', icon: 'fa-phone', text: 'Shared trip plan with emergency contact' },
    { id: 'weather', icon: 'fa-cloud-sun', text: 'Checked weather & road conditions' }
];

const loadChecks = (uid) => {
    try { return JSON.parse(localStorage.getItem(`sr_checklist_${uid || 'guest'}`)) || []; }
    catch { return []; }
};

const RiskAnalysis = () => {
    const { user } = useAuth();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checked, setChecked] = useState(() => loadChecks(user?.id));

    useEffect(() => {
        localStorage.setItem(`sr_checklist_${user?.id || 'guest'}`, JSON.stringify(checked));
    }, [checked, user]);

    const toggleCheck = (id) =>
        setChecked(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

    useEffect(() => {
        if (!user) return;
        supabase
            .from('trips')
            .select('*')
            .eq('user_id', user.id)
            .order('risk_score', { ascending: false })
            .then(({ data }) => { setTrips(data || []); setLoading(false); });
    }, [user]);

    if (loading) return (
        <div className="main">
            <div className="header"><h1>Risk Analysis</h1><p>AI-powered assessment of your travel routes</p></div>
            <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.7)' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px' }}></i>
            </div>
        </div>
    );

    const stats = summarizeTrips(trips);
    const riskiest = trips.slice(0, 5);
    const riskMonths = tripsByMonth(trips, 6).map(m => ({
        label: m.label,
        value: m.avgRisk,
        color: m.avgRisk >= 45 ? '#ef4444' : m.avgRisk >= 20 ? '#f59e0b' : '#10b981'
    }));
    const riskSegments = [
        { label: 'Low', value: stats.lowRisk, color: '#10b981' },
        { label: 'Medium', value: stats.medRisk, color: '#f59e0b' },
        { label: 'High', value: stats.highRisk, color: '#ef4444' }
    ];

    // Recommendations derived from the user's own data.
    const recs = [];
    if (stats.highRisk > 0)
        recs.push({ type: 'danger', icon: 'fa-exclamation-circle', text: `You have ${stats.highRisk} high-risk trip${stats.highRisk !== 1 ? 's' : ''}. Prefer "Safety First" routing for similar journeys.` });
    if (stats.avgRisk >= 45)
        recs.push({ type: 'danger', icon: 'fa-triangle-exclamation', text: `Your average risk score is ${stats.avgRisk}% — high. Avoid expert-difficulty routes in winter conditions.` });
    else if (stats.avgRisk >= 20)
        recs.push({ type: 'warning', icon: 'fa-cloud-rain', text: `Average risk is moderate (${stats.avgRisk}%). Check weather before mountain segments like Babusar Top.` });
    else if (stats.totalTrips > 0)
        recs.push({ type: 'success', icon: 'fa-circle-check', text: `Great driving profile — average risk is only ${stats.avgRisk}%. Keep choosing safer routes.` });
    if (!stats.totalTrips)
        recs.push({ type: 'warning', icon: 'fa-circle-info', text: 'No trips analyzed yet. Plan a trip to get personalized risk insights.' });

    // General safety guidance (educational, not trip-specific).
    const factors = [
        { icon: 'fa-mountain', label: 'Steep gradients on mountain routes' },
        { icon: 'fa-temperature-arrow-down', label: 'Brake-failure risk on long descents' },
        { icon: 'fa-smog', label: 'Reduced visibility in fog' },
        { icon: 'fa-snowflake', label: 'Snow / landslides on northern passes' }
    ];

    return (
        <div className="main">
            <div className="header">
                <h1>Risk Analysis</h1>
                <p>AI-powered assessment of your travel routes</p>
            </div>

            {/* Overall risk summary */}
            <div className="kpi-row">
                {[
                    { label: 'Avg Risk Score', value: stats.totalTrips ? `${stats.avgRisk}%` : '—', color: stats.avgRisk < 20 ? '#10b981' : stats.avgRisk < 45 ? '#f59e0b' : '#ef4444', icon: 'fa-gauge-high' },
                    { label: 'Low Risk', value: stats.lowRisk, color: '#10b981', icon: 'fa-shield-halved' },
                    { label: 'Medium Risk', value: stats.medRisk, color: '#f59e0b', icon: 'fa-triangle-exclamation' },
                    { label: 'High Risk', value: stats.highRisk, color: '#ef4444', icon: 'fa-radiation' }
                ].map(({ label, value, color, icon }) => (
                    <div key={label} className="stat-card fade-in">
                        <i className={`fas ${icon}`} style={{ fontSize: '26px', color, marginBottom: '10px' }}></i>
                        <div className="stat-value" style={{ color }}>{value}</div>
                        <div className="stat-label">{label}</div>
                    </div>
                ))}
            </div>

            {/* Charts */}
            {stats.totalTrips > 0 && (
                <div className="grid">
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-chart-pie"></i>Risk Mix</div>
                        <DonutChart segments={riskSegments} centerTop={`${stats.avgRisk}%`} centerBottom="Avg Risk" />
                    </div>
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-chart-line"></i>Risk Trend (6 mo)</div>
                        <BarChart data={riskMonths} height={180} format={v => `${v}%`} />
                    </div>
                </div>
            )}

            <div className="grid">
                {/* Recommendations */}
                <div className="card fade-in">
                    <div className="card-title"><i className="fas fa-wand-magic-sparkles"></i>Proactive Risk Mitigation</div>
                    {recs.map((r, i) => (
                        <div key={i} className={`alert alert-${r.type}`}>
                            <i className={`fas ${r.icon}`}></i>
                            <span>{r.text}</span>
                        </div>
                    ))}
                    <div style={{ marginTop: '20px' }}>
                        <h3 style={{ fontSize: '15px', color: 'var(--text)', marginBottom: '12px' }}>Common Risk Factors</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {factors.map(f => (
                                <div key={f.label} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', color: 'var(--muted)' }}>
                                    <i className={`fas ${f.icon}`} style={{ color: 'var(--accent)', width: '20px' }}></i>
                                    {f.label}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Riskiest trips */}
                <div className="card fade-in">
                    <div className="card-title"><i className="fas fa-ranking-star"></i>Your Highest-Risk Trips</div>
                    {riskiest.length === 0 && (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--muted)' }}>
                            <i className="fas fa-shield-heart" style={{ fontSize: '40px', opacity: 0.4, marginBottom: '12px' }}></i>
                            <p style={{ fontWeight: '600' }}>No trips to analyze yet</p>
                            <p style={{ fontSize: '13px', marginTop: '6px' }}>Save trips to see where your risk concentrates.</p>
                        </div>
                    )}
                    {riskiest.map(t => (
                        <div key={t.id} style={{ padding: '14px 0', borderBottom: '1px solid var(--light)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontWeight: '600', fontSize: '14px' }}>{t.start_location} → {t.destination}</span>
                                <span style={{ fontWeight: '700', color: riskColor(t.risk_level) }}>{t.risk_score}%</span>
                            </div>
                            <div style={{ height: '8px', background: 'var(--light)', borderRadius: '4px', overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${Math.min(t.risk_score, 100)}%`, background: riskColor(t.risk_level), borderRadius: '4px', transition: 'width 0.6s ease' }} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Pre-trip safety checklist */}
            <div className="card fade-in" style={{ marginTop: '30px' }}>
                <div className="card-title" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                    <span style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <i className="fas fa-clipboard-check"></i>Pre-Trip Safety Checklist
                    </span>
                    <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={() => setChecked([])}>
                        <i className="fas fa-rotate-left" style={{ marginRight: '6px' }}></i>Reset
                    </button>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                    <div style={{ flex: 1, height: '10px', background: 'var(--light)', borderRadius: '6px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: '6px',
                            width: `${(checked.length / CHECKLIST.length) * 100}%`,
                            background: checked.length === CHECKLIST.length ? 'var(--success)' : 'linear-gradient(90deg, var(--primary), var(--accent))',
                            transition: 'width 0.4s ease'
                        }} />
                    </div>
                    <strong style={{ color: checked.length === CHECKLIST.length ? 'var(--success)' : 'var(--dark)', fontSize: '14px', whiteSpace: 'nowrap' }}>
                        {checked.length}/{CHECKLIST.length} {checked.length === CHECKLIST.length ? '· Ready to go! 🎉' : 'done'}
                    </strong>
                </div>
                <div className="checklist-grid">
                    {CHECKLIST.map((c, idx) => {
                        const done = checked.includes(c.id);
                        return (
                            <button key={c.id} className={`check-item pop-in ${done ? 'done' : ''}`}
                                style={{ animationDelay: `${idx * 0.04}s` }} onClick={() => toggleCheck(c.id)}>
                                <span className="check-box">{done && <i className="fas fa-check"></i>}</span>
                                <i className={`fas ${c.icon}`} style={{ color: done ? 'var(--success)' : 'var(--accent)', width: '20px' }}></i>
                                <span style={{ textDecoration: done ? 'line-through' : 'none', opacity: done ? 0.65 : 1 }}>{c.text}</span>
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default RiskAnalysis;
