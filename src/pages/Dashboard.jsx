import React, { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { supabase } from '../lib/supabase';
import { summarizeTrips, tripsByMonth, riskColor } from '../utils/helpers';
import { tourismAPI } from '../utils/tourismAPI';
import { geocodeOne, getRoutes } from '../utils/geo';
import { BarChart, DonutChart } from '../components/Charts/Charts';
import DriverProfile from '../components/DriverProfile/DriverProfile';
import AlertBox from '../components/AlertBox/AlertBox';
import WeatherCard from '../components/Weather/WeatherCard';
import LocationInput from '../components/LocationInput/LocationInput';
import RouteMap from '../components/RouteMap/RouteMap';
import PlaceImage from '../components/PlaceImage/PlaceImage';

const POPULAR = [
    ['Islamabad', 'Skardu'],
    ['Lahore', 'Murree'],
    ['Karachi', 'Hyderabad'],
    ['Islamabad', 'Hunza']
];

const driverLevel = (score) => score >= 90 ? 'Conservative Driver' : score >= 75 ? 'Moderate Driver' : 'Aggressive Driver';

const Dashboard = () => {
    const { user, profile } = useAuth();
    const navigate = useNavigate();
    const toast = useToast();
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [scenic, setScenic] = useState([]);
    const [plan, setPlan] = useState({ start: '', destination: '' });
    const [dashRoute, setDashRoute] = useState(null); // real route of latest trip
    const [announcements, setAnnouncements] = useState([]);

    useEffect(() => {
        supabase.from('announcements').select('*').eq('active', true)
            .order('created_at', { ascending: false }).limit(3)
            .then(({ data }) => setAnnouncements(data || []));
    }, []);

    useEffect(() => {
        if (!user) return;
        supabase.from('trips').select('*').eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => { setTrips(data || []); setLoading(false); });
    }, [user]);

    useEffect(() => { tourismAPI.getScenicViews().then(setScenic); }, []);

    // Draw the most recent trip's real driving route on the map.
    useEffect(() => {
        if (!trips.length) return;
        const t = trips[0];
        let active = true;
        (async () => {
            const [s, e] = await Promise.all([geocodeOne(t.start_location), geocodeOne(t.destination)]);
            if (!active || !s || !e) return;
            const [route] = await getRoutes(s, e);
            if (active) setDashRoute({ start: { ...s, label: t.start_location }, end: { ...e, label: t.destination }, coords: route.coordinates });
        })();
        return () => { active = false; };
    }, [trips]);

    const stats = summarizeTrips(trips);
    const safetyScore = profile?.safety_score ?? 95;
    const months = tripsByMonth(trips, 6).map(m => ({ label: m.label, value: m.trips }));
    const riskSegments = [
        { label: 'Low', value: stats.lowRisk, color: '#10b981' },
        { label: 'Medium', value: stats.medRisk, color: '#f59e0b' },
        { label: 'High', value: stats.highRisk, color: '#ef4444' }
    ];
    const firstName = profile?.full_name?.split(' ')[0] || 'Driver';

    // Quick-plan hands off to the full New Trip planner.
    const openPlanner = (start, destination) => {
        const s = (start ?? plan.start).trim();
        const d = (destination ?? plan.destination).trim();
        if (!s || !d) { toast.warning('Enter both a start and destination.'); return; }
        navigate('/new-trip', { state: { prefill: { start: s, destination: d }, autoSearch: true } });
    };

    const actions = [
        { to: '/journey', icon: 'fa-satellite-dish', label: 'Start Journey', desc: 'Live GPS tracking', color: '#10b981' },
        { to: '/new-trip', icon: 'fa-plus', label: 'Plan New Trip', desc: 'Find safe routes', color: '#2563eb' },
        { to: '/tourism', icon: 'fa-umbrella-beach', label: 'Tourism Hub', desc: 'Explore Pakistan', color: '#06b6d4' },
        { to: '/risk-analysis', icon: 'fa-shield-halved', label: 'Risk Analysis', desc: 'Safety insights', color: '#f59e0b' }
    ];

    return (
        <div className="main">
            <div className="header">
                <h1>Welcome back, {firstName}! 👋</h1>
                <p>Your AI-powered road-trip companion — plan safer journeys across Pakistan.</p>
            </div>

            {/* Admin broadcasts */}
            {announcements.map(a => (
                <div key={a.id} className={`alert alert-${a.type === 'info' ? 'success' : a.type}`} style={{ marginBottom: '14px' }}>
                    <i className={`fas ${a.type === 'danger' ? 'fa-circle-exclamation' : a.type === 'warning' ? 'fa-triangle-exclamation' : 'fa-bullhorn'}`}></i>
                    <span><strong>{a.title}:</strong> {a.message}</span>
                </div>
            ))}

            {/* Quick actions */}
            <div className="quick-actions">
                {actions.map(a => (
                    <Link key={a.to} to={a.to} className="action-tile">
                        <div className="action-icon" style={{ background: `${a.color}18`, color: a.color }}>
                            <i className={`fas ${a.icon}`}></i>
                        </div>
                        <div>
                            <div className="action-label">{a.label}</div>
                            <div className="action-desc">{a.desc}</div>
                        </div>
                        <i className="fas fa-chevron-right action-arrow"></i>
                    </Link>
                ))}
            </div>

            {/* KPIs */}
            <div className="kpi-row">
                {[
                    { label: 'Total Trips', value: loading ? '…' : stats.totalTrips, icon: 'fa-route', color: '#2563eb' },
                    { label: 'Distance', value: loading ? '…' : `${stats.totalDist} km`, icon: 'fa-road', color: '#06b6d4' },
                    { label: 'Avg Risk', value: loading ? '…' : (stats.totalTrips ? `${stats.avgRisk}%` : '—'), icon: 'fa-gauge-high', color: riskColor(stats.avgRisk < 20 ? 'Low' : stats.avgRisk < 45 ? 'Medium' : 'High') },
                    { label: 'Safety Score', value: safetyScore, icon: 'fa-shield-halved', color: '#10b981' }
                ].map(c => (
                    <div key={c.label} className="stat-card fade-in">
                        <i className={`fas ${c.icon}`} style={{ fontSize: '24px', color: c.color, marginBottom: '8px' }}></i>
                        <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
                        <div className="stat-label">{c.label}</div>
                    </div>
                ))}
            </div>

            <div className="grid">
                {/* LEFT */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    {/* Quick plan */}
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-bolt"></i>Quick Plan</div>
                        <p style={{ color: 'var(--muted)', fontSize: '13px', marginTop: '-10px', marginBottom: '16px' }}>
                            Enter a route and we'll open it in the <strong>New Trip</strong> planner with safe-route analysis.
                        </p>
                        <div className="quick-plan-row">
                            <div className="form-group" style={{ margin: 0, flex: 1 }}>
                                <label>From</label>
                                <LocationInput value={plan.start} placeholder="Search city or use GPS →" icon="fa-circle-dot"
                                    allowCurrent onError={m => toast.error(m)}
                                    onChange={v => setPlan({ ...plan, start: v })}
                                    onSelect={p => setPlan({ ...plan, start: p.name })} />
                            </div>
                            <i className="fas fa-arrow-right-long" style={{ color: 'var(--muted)', marginTop: '24px' }}></i>
                            <div className="form-group" style={{ margin: 0, flex: 1 }}>
                                <label>To</label>
                                <LocationInput value={plan.destination} placeholder="Search city..." icon="fa-flag-checkered"
                                    onChange={v => setPlan({ ...plan, destination: v })}
                                    onSelect={p => setPlan({ ...plan, destination: p.name })} />
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '14px 0' }}>
                            {POPULAR.map(([s, d]) => (
                                <button key={`${s}-${d}`} className="chip" onClick={() => openPlanner(s, d)}>
                                    <i className="fas fa-location-arrow" style={{ fontSize: '10px' }}></i>{s} → {d}
                                </button>
                            ))}
                        </div>
                        <button className="btn btn-primary" onClick={() => openPlanner()}>
                            <i className="fas fa-route" style={{ marginRight: '8px' }}></i>Open in Trip Planner
                        </button>
                    </div>

                    {/* Recent trips */}
                    <div className="card fade-in">
                        <div className="card-title" style={{ justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><i className="fas fa-clock-rotate-left"></i>Recent Trips</span>
                            {trips.length > 0 && <Link to="/history" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>View all →</Link>}
                        </div>
                        {loading ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '52px' }} />)}
                            </div>
                        ) : trips.length === 0 ? (
                            <div className="empty-state" style={{ padding: '30px 20px' }}>
                                <i className="fas fa-route"></i>
                                <p style={{ fontWeight: 600 }}>No trips yet</p>
                                <button className="btn btn-primary" style={{ width: 'auto', marginTop: '12px' }} onClick={() => navigate('/new-trip')}>
                                    <i className="fas fa-plus" style={{ marginRight: '8px' }}></i>Plan your first trip
                                </button>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                {trips.slice(0, 5).map(t => (
                                    <div key={t.id} className="recent-row">
                                        <div className="recent-dot" style={{ background: riskColor(t.risk_level) }} />
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {t.start_location} → {t.destination}
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                                                {t.distance_km} km · {new Date(t.created_at).toLocaleDateString()}
                                            </div>
                                        </div>
                                        <span className="route-badge" style={{ background: `${riskColor(t.risk_level)}22`, color: riskColor(t.risk_level), fontSize: '10px' }}>
                                            {t.risk_level}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Map */}
                    <div className="card fade-in" style={{ padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '20px 20px 0', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 600, fontSize: '18px', color: 'var(--dark)' }}>
                            <i className="fas fa-map-marked-alt" style={{ color: 'var(--accent)', fontSize: '22px' }}></i>
                            {dashRoute ? 'Latest Trip Route' : 'Route Map'}
                        </div>
                        <div style={{ marginTop: '16px' }}>
                            <RouteMap
                                start={dashRoute?.start}
                                end={dashRoute?.end}
                                route={dashRoute?.coords}
                                height={340}
                                zoom={dashRoute ? 7 : 5}
                            />
                        </div>
                        {!dashRoute && (
                            <div style={{ padding: '12px 20px', fontSize: '12px', color: 'var(--muted)' }}>
                                <i className="fas fa-circle-info" style={{ marginRight: '6px' }}></i>
                                Plan a trip to see your route drawn here.
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <DriverProfile name={firstName} level={driverLevel(safetyScore)} safetyScore={safetyScore} trips={stats.totalTrips} />
                    <WeatherCard location={trips[0]?.destination || 'Skardu'} />

                    {/* Risk distribution */}
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-chart-pie"></i>Risk Distribution</div>
                        {stats.totalTrips > 0
                            ? <DonutChart segments={riskSegments} centerTop={`${stats.avgRisk}%`} centerBottom="Avg Risk" size={150} />
                            : <p style={{ color: 'var(--muted)', fontSize: '14px', textAlign: 'center', padding: '20px 0' }}>Save trips to see your risk mix.</p>}
                    </div>

                    {/* Activity */}
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-chart-column"></i>Activity (6 mo)</div>
                        <BarChart data={months} height={150} />
                    </div>
                </div>
            </div>

            {/* Tourism highlights */}
            <div className="card fade-in">
                <div className="card-title" style={{ justifyContent: 'space-between' }}>
                    <span style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><i className="fas fa-mountain-sun"></i>Tourism Highlights</span>
                    <Link to="/tourism" style={{ fontSize: '13px', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Explore all →</Link>
                </div>
                <div className="highlight-grid">
                    {scenic.map(v => (
                        <Link key={v.id} to={`/tourism/scenic/${v.id}`} className="highlight-tile">
                            <PlaceImage query={v.wiki || v.name} seed={`scenic${v.id}`} alt={v.name} className="highlight-img" />
                            <div className="highlight-overlay">
                                <span className="highlight-rating"><i className="fas fa-star"></i> {v.rating}</span>
                                <div className="highlight-name">{v.name}</div>
                                <div className="highlight-meta">{v.location} · Best: {v.bestTime}</div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Alerts */}
            <AlertBox location={trips[0]?.destination || 'Skardu'} trips={trips} />
        </div>
    );
};

export default Dashboard;
