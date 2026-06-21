import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { geocodeOne, getRoutes, trafficFromSpeed } from '../utils/geo';
import { riskColor } from '../utils/helpers';
import LocationInput from '../components/LocationInput/LocationInput';
import RouteMap from '../components/RouteMap/RouteMap';

const DEFAULT_FORM = {
    start: '', destination: '',
    preference: 'Balanced (Safety + Speed)',
    driverProfile: 'Conservative Driver',
    roadType: 'Highway',
    season: 'Summer',
    difficulty: 'Easy',
    weather: 'Clear'
};

const baseRisk = (f) => {
    let r = 12;
    if (f.weather === 'Rainy') r += 12;
    if (f.weather === 'Snowy') r += 28;
    if (f.weather === 'Foggy') r += 18;
    if (f.difficulty === 'Intermediate') r += 10;
    if (f.difficulty === 'Expert') r += 22;
    if (f.season === 'Winter') r += 15;
    if (f.season === 'Autumn') r += 5;
    if (f.driverProfile === 'Aggressive Driver') r += 8;
    return r;
};

// Risk is derived from real route data (speed, distance) + trip conditions.
const computeRisk = (f, route, idx) => {
    let r = baseRisk(f);
    if (route.avgSpeed < 45) r += 10;
    else if (route.avgSpeed < 60) r += 4;
    if (route.distanceKm > 500) r += 6;
    else if (route.distanceKm > 300) r += 3;
    r += idx * 4; // alternatives are slightly less optimal than the best route
    return Math.min(Math.max(Math.round(r), 5), 92);
};

const levelFor = (r) => (r < 20 ? 'Low' : r < 45 ? 'Medium' : 'High');

const NewTrip = () => {
    const { user } = useAuth();
    const toast = useToast();
    const location = useLocation();
    const navigate = useNavigate();

    const [form, setForm] = useState({ ...DEFAULT_FORM, ...(location.state?.prefill || {}) });
    const [startPlace, setStartPlace] = useState(null);
    const [endPlace, setEndPlace] = useState(null);
    const [routes, setRoutes] = useState(null);
    const [selected, setSelected] = useState(0);
    const [analyzing, setAnalyzing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const resolved = routes?.meta; // { start, end }

    const resolvePlace = async (text, cached) => {
        if (cached && cached.name?.toLowerCase() === text.trim().toLowerCase()) return cached;
        return geocodeOne(text);
    };

    const findRoutes = useCallback(async (f = form, sCache = startPlace, eCache = endPlace) => {
        if (!f.start.trim() || !f.destination.trim()) {
            setError('Enter both a start location and destination.');
            return;
        }
        setError('');
        setSaved(false);
        setAnalyzing(true);
        setRoutes(null);

        const [s, e] = await Promise.all([
            resolvePlace(f.start, sCache),
            resolvePlace(f.destination, eCache)
        ]);

        if (!s || !e) {
            setAnalyzing(false);
            const msg = `Couldn't locate ${!s ? f.start : f.destination}. Try a more specific name.`;
            setError(msg);
            toast.error(msg);
            return;
        }

        const raw = await getRoutes(s, e);
        const labels = ['Optimal Route (Recommended)', 'Alternative Route A', 'Alternative Route B'];
        const opts = raw.slice(0, 3).map((rt, i) => {
            const risk = computeRisk(f, rt, i);
            return {
                name: labels[i] || `Route ${i + 1}`,
                badge: i === 0 && risk < 20 ? 'Safest' : risk < 45 ? 'Moderate' : 'High',
                risk,
                riskLevel: levelFor(risk),
                km: Math.round(rt.distanceKm),
                hrs: Math.round(rt.durationHours * 10) / 10,
                traffic: trafficFromSpeed(rt.avgSpeed),
                coordinates: rt.coordinates,
                estimated: rt.estimated
            };
        });

        setRoutes({ list: opts, meta: { start: { ...s, label: s.label }, end: { ...e, label: e.label } } });
        setSelected(0);
        setAnalyzing(false);
        if (opts[0]?.estimated) toast.warning('Routing service unavailable — showing a straight-line estimate.');
        else toast.success(`Found ${opts.length} real route${opts.length !== 1 ? 's' : ''} for ${s.name} → ${e.name}.`);
    }, [form, startPlace, endPlace, toast]);

    useEffect(() => {
        if (location.state?.autoSearch && location.state?.prefill) {
            findRoutes({ ...DEFAULT_FORM, ...location.state.prefill }, null, null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const saveTrip = async () => {
        if (!routes || selected === null) return;
        setSaving(true);
        const r = routes.list[selected];
        const { error: err } = await supabase.from('trips').insert({
            user_id: user.id,
            start_location: resolved.start.name,
            destination: resolved.end.name,
            route_name: r.name,
            distance_km: r.km,
            duration_hours: r.hrs,
            risk_score: r.risk,
            risk_level: r.riskLevel,
            status: 'Completed'
        });
        setSaving(false);
        if (err) { setError(err.message); toast.error(err.message); }
        else { setSaved(true); toast.success('Trip saved to your history!'); }
    };

    const set = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

    const sel = routes?.list[selected];
    const otherCoords = routes ? routes.list.filter((_, i) => i !== selected).map(r => r.coordinates) : [];

    return (
        <div className="main">
            <div className="header">
                <h1>Plan a New Trip</h1>
                <p>Search real destinations and get live driving routes with safety analysis</p>
            </div>

            {error && (
                <div className="alert alert-danger" style={{ marginBottom: '20px' }}>
                    <i className="fas fa-exclamation-circle"></i><span>{error}</span>
                </div>
            )}

            <div className="grid">
                {/* Planner form */}
                <div className="card fade-in">
                    <div className="card-title"><i className="fas fa-location-pin"></i>Route Planner</div>

                    <div className="form-group">
                        <label>Starting Location</label>
                        <LocationInput
                            value={form.start}
                            placeholder="Search, or tap the GPS button →"
                            icon="fa-circle-dot"
                            allowCurrent onError={m => toast.error(m)}
                            onChange={v => { set('start', v); setStartPlace(null); }}
                            onSelect={p => { set('start', p.name); setStartPlace(p); }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Destination</label>
                        <LocationInput
                            value={form.destination}
                            placeholder="Search a city or place..."
                            icon="fa-flag-checkered"
                            onChange={v => { set('destination', v); setEndPlace(null); }}
                            onSelect={p => { set('destination', p.name); setEndPlace(p); }}
                        />
                    </div>

                    <div className="form-group">
                        <label>Travel Preferences</label>
                        <select value={form.preference} onChange={e => set('preference', e.target.value)}>
                            <option>Balanced (Safety + Speed)</option>
                            <option>Safety First</option>
                            <option>Fastest Route</option>
                            <option>Comfort-Focused</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Driver Profile</label>
                        <select value={form.driverProfile} onChange={e => set('driverProfile', e.target.value)}>
                            <option>Conservative Driver</option>
                            <option>Moderate Driver</option>
                            <option>Aggressive Driver</option>
                        </select>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>Road Type</label>
                            <select value={form.roadType} onChange={e => set('roadType', e.target.value)}>
                                <option>Highway</option><option>Backroads</option><option>Scenic</option><option>Coastal</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Season</label>
                            <select value={form.season} onChange={e => set('season', e.target.value)}>
                                <option>Summer</option><option>Winter</option><option>Spring</option><option>Autumn</option>
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div className="form-group">
                            <label>Difficulty</label>
                            <select value={form.difficulty} onChange={e => set('difficulty', e.target.value)}>
                                <option>Easy</option><option>Intermediate</option><option>Expert</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Weather</label>
                            <select value={form.weather} onChange={e => set('weather', e.target.value)}>
                                <option>Clear</option><option>Rainy</option><option>Snowy</option><option>Foggy</option>
                            </select>
                        </div>
                    </div>

                    <button className="btn btn-primary" onClick={() => findRoutes()} disabled={analyzing}>
                        {analyzing
                            ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Analyzing routes...</>
                            : <><i className="fas fa-search" style={{ marginRight: '8px' }}></i>Find Safe Routes</>}
                    </button>
                </div>

                {/* Results */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {analyzing && (
                        <div className="card fade-in">
                            <div className="card-title"><i className="fas fa-route"></i>Finding routes…</div>
                            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '70px', marginBottom: '12px' }} />)}
                        </div>
                    )}

                    {!analyzing && routes && (
                        <>
                            <div className="card fade-in" style={{ padding: 0, overflow: 'hidden' }}>
                                <RouteMap
                                    start={resolved.start}
                                    end={resolved.end}
                                    route={sel?.coordinates}
                                    alternatives={otherCoords}
                                    height={260}
                                />
                            </div>

                            <div className="card fade-in">
                                <div className="card-title"><i className="fas fa-route"></i>Route Options</div>
                                <div className="alert alert-success">
                                    <i className="fas fa-check-circle"></i>
                                    <span><strong>{routes.list.length} route{routes.list.length !== 1 ? 's' : ''}</strong> for {resolved.start.name} → {resolved.end.name}{sel?.estimated ? ' (estimated)' : ''}</span>
                                </div>
                                <div className="routes-grid">
                                    {routes.list.map((r, i) => (
                                        <div key={i} className={`route-option ${selected === i ? 'selected' : ''}`} onClick={() => { setSelected(i); setSaved(false); }}>
                                            <div className="route-header">
                                                <span className="route-name">{r.name}</span>
                                                <span className="route-badge" style={{ background: `${riskColor(r.riskLevel)}22`, color: riskColor(r.riskLevel) }}>{r.badge}</span>
                                            </div>
                                            <div className="route-stats">
                                                <div className="stat"><i className="fas fa-hourglass-end"></i><span>{r.hrs}h</span></div>
                                                <div className="stat"><i className="fas fa-road"></i><span>{r.km} km</span></div>
                                                <div className="stat"><i className="fas fa-exclamation-triangle"></i><span>Risk: {r.risk}%</span></div>
                                                <div className="stat"><i className="fas fa-gauge"></i><span>{r.traffic}</span></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
                                    <button className="btn btn-primary" onClick={saveTrip} disabled={saving || saved} style={{ flex: 1, minWidth: '160px' }}>
                                        {saving ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Saving...</>
                                            : saved ? <><i className="fas fa-check" style={{ marginRight: '8px' }}></i>Trip Saved!</>
                                                : <><i className="fas fa-save" style={{ marginRight: '8px' }}></i>Save to History</>}
                                    </button>
                                    <button className="btn btn-ghost" style={{ flex: 1, minWidth: '160px' }}
                                        onClick={() => navigate('/journey', { state: { destination: resolved.end.name } })}>
                                        <i className="fas fa-satellite-dish" style={{ marginRight: '8px' }}></i>Start Live Journey
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {!analyzing && !routes && (
                        <div className="card fade-in">
                            <div className="card-title"><i className="fas fa-circle-info"></i>How it works</div>
                            <div style={{ color: 'var(--muted)', fontSize: '14px', lineHeight: 1.8 }}>
                                <p><i className="fas fa-1 fa-fw" style={{ color: 'var(--primary)' }}></i> Search and select real start &amp; destination cities.</p>
                                <p><i className="fas fa-2 fa-fw" style={{ color: 'var(--primary)' }}></i> We fetch live driving routes (distance &amp; time).</p>
                                <p><i className="fas fa-3 fa-fw" style={{ color: 'var(--primary)' }}></i> Each route gets a safety score from conditions &amp; road data.</p>
                                <p><i className="fas fa-4 fa-fw" style={{ color: 'var(--primary)' }}></i> Pick one and save it to your history.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NewTrip;
