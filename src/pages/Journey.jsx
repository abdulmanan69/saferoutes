import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { geocodeOne, getRoutes, haversineKm, getCurrentPosition, reverseGeocode } from '../utils/geo';
import { getWeatherByCoords, outfitAdvice } from '../utils/weather';
import { classifyWeather, CATEGORIES } from '../utils/outfitModel';
import { getPhotosNear } from '../utils/photos';
import LocationInput from '../components/LocationInput/LocationInput';
import RouteMap from '../components/RouteMap/RouteMap';

const speak = (text, enabled) => {
    if (!enabled || !('speechSynthesis' in window)) return;
    try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.rate = 1;
        window.speechSynthesis.speak(u);
    } catch { /* voice unavailable */ }
};

// Downsample a polyline so progress lookups stay cheap.
const downsample = (coords, n = 240) => {
    if (coords.length <= n) return coords;
    const step = coords.length / n;
    return Array.from({ length: n }, (_, i) => coords[Math.floor(i * step)]);
};

const nearestIndex = (coords, p) => {
    let best = 0, bestD = Infinity;
    coords.forEach(([lat, lng], i) => {
        const d = (lat - p.lat) ** 2 + (lng - p.lng) ** 2;
        if (d < bestD) { bestD = d; best = i; }
    });
    return best;
};

const Journey = () => {
    const { user } = useAuth();
    const toast = useToast();
    const location = useLocation();

    // setup | active | arrived
    const [phase, setPhase] = useState('setup');
    const [startText, setStartText] = useState('');
    const [destText, setDestText] = useState(location.state?.destination || '');
    const [startPlace, setStartPlace] = useState(null);
    const [destPlace, setDestPlace] = useState(null);
    const [starting, setStarting] = useState(false);
    const [voice, setVoice] = useState(true);
    const voiceRef = useRef(true);
    useEffect(() => { voiceRef.current = voice; }, [voice]);

    const [journey, setJourney] = useState(null); // { start, end, coords, sampled, totalKm }
    const [pos, setPos] = useState(null);
    const [speed, setSpeed] = useState(0);
    const [progress, setProgress] = useState(0);
    const [startedAt, setStartedAt] = useState(null);
    const [weather, setWeather] = useState(null);
    const [photos, setPhotos] = useState([]);
    const [photosLoading, setPhotosLoading] = useState(false);
    const [placeName, setPlaceName] = useState('');
    const [simulating, setSimulating] = useState(false);

    const watchRef = useRef(null);
    const simRef = useRef(null);
    const lastPhotoAt = useRef(null);
    const lastQuarter = useRef(0);
    const lastPos = useRef(null);

    const stopTracking = useCallback(() => {
        if (watchRef.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchRef.current);
        if (simRef.current) clearInterval(simRef.current);
        watchRef.current = null;
        simRef.current = null;
        setSimulating(false);
    }, []);

    useEffect(() => () => { stopTracking(); window.speechSynthesis?.cancel(); }, [stopTracking]);

    // Refresh photos + place name when we've moved a few km.
    const refreshSurroundings = useCallback(async (p) => {
        lastPhotoAt.current = p;
        setPhotosLoading(true);
        const [ph, place] = await Promise.all([getPhotosNear(p.lat, p.lng), reverseGeocode(p.lat, p.lng)]);
        setPhotos(ph);
        setPlaceName(place.name);
        setPhotosLoading(false);
    }, []);

    const handlePosition = useCallback((p, j) => {
        setPos(p);
        // speed: prefer device-reported, else derive from last fix
        if (p.speedKmh != null) setSpeed(Math.round(p.speedKmh));
        else if (lastPos.current) {
            const dt = (Date.now() - lastPos.current.t) / 3600000;
            if (dt > 0) setSpeed(Math.min(160, Math.round(haversineKm(lastPos.current, p) / dt)));
        }
        lastPos.current = { ...p, t: Date.now() };

        const idx = nearestIndex(j.sampled, p);
        const frac = idx / (j.sampled.length - 1);
        setProgress(frac);

        // spoken milestones
        const quarter = Math.floor(frac * 4);
        if (quarter > lastQuarter.current && quarter < 4) {
            lastQuarter.current = quarter;
            const remaining = Math.round(j.totalKm * (1 - frac));
            speak(`You have completed ${quarter * 25} percent of your journey. ${remaining} kilometers remaining to ${j.end.name}.`, voiceRef.current);
        }

        // arrival within ~1.5 km of destination
        if (haversineKm(p, j.end) < 1.5) {
            stopTracking();
            setPhase('arrived');
            speak(`You have arrived at ${j.end.name}. Journey complete. Drive safe!`, voiceRef.current);
        }

        // refresh photos every ~4 km
        if (!lastPhotoAt.current || haversineKm(lastPhotoAt.current, p) > 4) refreshSurroundings(p);
    }, [refreshSurroundings, stopTracking]);

    const beginTracking = useCallback((j) => {
        if (!navigator.geolocation) { toast.warning('No GPS on this device — use Demo Drive instead.'); return; }
        watchRef.current = navigator.geolocation.watchPosition(
            gp => handlePosition({
                lat: gp.coords.latitude, lng: gp.coords.longitude,
                speedKmh: gp.coords.speed != null ? gp.coords.speed * 3.6 : null
            }, j),
            () => toast.warning('GPS signal lost — you can use Demo Drive to preview the journey.'),
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );
    }, [handlePosition, toast]);

    // Demo drive: steps along the real route (great on desktops without GPS).
    const startSimulation = useCallback((j) => {
        stopTracking();
        setSimulating(true);
        let i = 0;
        const coords = j.sampled;
        simRef.current = setInterval(() => {
            i = Math.min(i + 2, coords.length - 1);
            handlePosition({ lat: coords[i][0], lng: coords[i][1], speedKmh: 80 }, j);
            if (i >= coords.length - 1) clearInterval(simRef.current);
        }, 900);
    }, [handlePosition, stopTracking]);

    const startJourney = async () => {
        if (!startText.trim() || !destText.trim()) { toast.warning('Set both a start and a destination.'); return; }
        setStarting(true);
        try {
            const s = startPlace?.name?.toLowerCase() === startText.trim().toLowerCase() ? startPlace : await geocodeOne(startText);
            const e = destPlace?.name?.toLowerCase() === destText.trim().toLowerCase() ? destPlace : await geocodeOne(destText);
            if (!s || !e) { toast.error(`Couldn't locate ${!s ? startText : destText}.`); setStarting(false); return; }

            const [route] = await getRoutes(s, e);
            const j = {
                start: s, end: e,
                coords: route.coordinates,
                sampled: downsample(route.coordinates),
                totalKm: Math.round(route.distanceKm),
                hrs: Math.round(route.durationHours * 10) / 10,
                estimated: route.estimated
            };
            setJourney(j);
            setPhase('active');
            setStartedAt(Date.now());
            lastQuarter.current = 0;
            lastPos.current = null;
            lastPhotoAt.current = null;

            const startP = { lat: s.lat, lng: s.lng };
            setPos(startP);
            refreshSurroundings(startP);
            getWeatherByCoords(e.lat, e.lng, e.name).then(setWeather).catch(() => {});
            beginTracking(j);
            speak(`Journey started from ${s.name} to ${e.name}. Total distance ${j.totalKm} kilometers, estimated ${j.hrs} hours. Have a safe trip!`, voiceRef.current);
            toast.success(`Journey started — ${j.totalKm} km to ${e.name}.`);
        } catch {
            toast.error('Could not start the journey. Check your connection.');
        }
        setStarting(false);
    };

    const endJourney = async (save) => {
        stopTracking();
        window.speechSynthesis?.cancel();
        if (save && journey && user) {
            const coveredKm = Math.round(journey.totalKm * progress);
            const hrs = startedAt ? Math.round(((Date.now() - startedAt) / 3600000) * 10) / 10 : 0;
            const { error } = await supabase.from('trips').insert({
                user_id: user.id,
                start_location: journey.start.name,
                destination: journey.end.name,
                route_name: 'Live Journey',
                distance_km: phase === 'arrived' ? journey.totalKm : coveredKm,
                duration_hours: hrs,
                risk_score: 12, risk_level: 'Low',
                status: phase === 'arrived' ? 'Completed' : 'Cancelled',
                notes: phase === 'arrived' ? 'Completed with live tracking' : `Ended early at ${Math.round(progress * 100)}%`
            });
            if (error) toast.error(error.message);
            else toast.success('Journey saved to your history.');
        }
        setPhase('setup');
        setJourney(null);
        setPos(null);
        setProgress(0);
        setWeather(null);
        setPhotos([]);
    };

    const remainingKm = journey ? Math.max(0, Math.round(journey.totalKm * (1 - progress))) : 0;
    const etaH = remainingKm / Math.max(speed, 45);
    const eta = journey ? new Date(Date.now() + etaH * 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
    const elapsedMin = startedAt ? Math.round((Date.now() - startedAt) / 60000) : 0;
    const tips = outfitAdvice(weather);

    /* ---------- SETUP ---------- */
    if (phase === 'setup') return (
        <div className="main">
            <div className="header">
                <h1>Start a Journey</h1>
                <p>Live GPS tracking, voice guidance, real photos of what's around you, and weather-based advice</p>
            </div>
            <div className="grid">
                <div className="card fade-in">
                    <div className="card-title"><i className="fas fa-location-arrow"></i>Where are you going?</div>
                    <div className="form-group">
                        <label>Starting Point</label>
                        <LocationInput value={startText} placeholder="Search, or tap the GPS button →" icon="fa-circle-dot"
                            allowCurrent onError={m => toast.error(m)}
                            onChange={v => { setStartText(v); setStartPlace(null); }}
                            onSelect={p => { setStartText(p.name); setStartPlace(p); }} />
                    </div>
                    <div className="form-group">
                        <label>Destination</label>
                        <LocationInput value={destText} placeholder="Search a city or place..." icon="fa-flag-checkered"
                            onChange={v => { setDestText(v); setDestPlace(null); }}
                            onSelect={p => { setDestText(p.name); setDestPlace(p); }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 0 16px' }}>
                        <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                            <i className="fas fa-volume-high" style={{ marginRight: '6px' }}></i>Voice announcements
                        </span>
                        <span className={`mini-switch ${voice ? 'on' : ''}`} onClick={() => setVoice(!voice)} style={{ cursor: 'pointer' }}><span /></span>
                    </div>
                    <button className="btn btn-primary" onClick={startJourney} disabled={starting}>
                        {starting
                            ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Preparing route...</>
                            : <><i className="fas fa-play" style={{ marginRight: '8px' }}></i>Start Journey</>}
                    </button>
                </div>
                <div className="card fade-in" style={{ height: 'fit-content' }}>
                    <div className="card-title"><i className="fas fa-circle-info"></i>What Journey Mode does</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', color: 'var(--muted)' }}>
                        {[
                            ['fa-satellite-dish', 'Tracks your live GPS position on the route map.'],
                            ['fa-volume-high', 'Speaks progress updates at every quarter of the trip.'],
                            ['fa-camera', 'Shows real photos of landmarks around your current location.'],
                            ['fa-shirt', 'Recommends what to wear from live destination weather.'],
                            ['fa-flag-checkered', 'Detects arrival and saves the trip to your history.'],
                            ['fa-gamepad', 'No GPS? Use Demo Drive to simulate the trip along the real route.']
                        ].map(([ic, t]) => (
                            <div key={t} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                <i className={`fas ${ic}`} style={{ color: 'var(--primary)', width: '20px', marginTop: '2px' }}></i>{t}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );

    /* ---------- ACTIVE / ARRIVED ---------- */
    return (
        <div className="main journey-main">
            <div className="journey-split">
                {/* MAP */}
                <div className="card journey-map-card">
                    <RouteMap start={journey.start} end={journey.end} route={journey.coords}
                        current={pos} follow={phase === 'active'} height="100%" />
                    <div className="journey-map-badge">
                        <i className={`fas ${simulating ? 'fa-gamepad' : 'fa-satellite-dish'} ${phase === 'active' ? 'pulse' : ''}`}></i>
                        {phase === 'arrived' ? 'Arrived' : simulating ? 'Demo Drive' : 'Live GPS'}
                        {placeName && <span className="journey-place"> · near {placeName}</span>}
                    </div>
                </div>

                {/* PANEL */}
                <div className="journey-panel">
                    <div className="card" style={{ padding: '20px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div style={{ fontWeight: 700, color: 'var(--dark)', fontSize: '15px' }}>
                                {journey.start.name} → {journey.end.name}
                            </div>
                            <button className="icon-action" title={voice ? 'Mute voice' : 'Unmute voice'} onClick={() => setVoice(!voice)}>
                                <i className={`fas ${voice ? 'fa-volume-high' : 'fa-volume-xmark'}`}></i>
                            </button>
                        </div>
                        {phase === 'arrived' && (
                            <div className="alert alert-success"><i className="fas fa-flag-checkered"></i>
                                <span><strong>You've arrived!</strong> Journey complete.</span></div>
                        )}
                        <div style={{ height: '10px', background: 'var(--light)', borderRadius: '6px', overflow: 'hidden', marginBottom: '8px' }}>
                            <div style={{ height: '100%', width: `${Math.round(progress * 100)}%`, background: 'linear-gradient(90deg, var(--primary), var(--accent))', transition: 'width 0.8s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--muted)', marginBottom: '14px' }}>
                            <span>{Math.round(progress * 100)}% complete</span>
                            <span>{remainingKm} km left</span>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                            {[
                                [speed, 'km/h'], [remainingKm, 'km left'],
                                [phase === 'arrived' ? '—' : eta, 'ETA'], [`${elapsedMin}m`, 'elapsed']
                            ].map(([v, l]) => (
                                <div key={l} className="stat-box" style={{ padding: '10px 6px' }}>
                                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--dark)' }}>{v}</div>
                                    <div className="stat-label" style={{ fontSize: '10px' }}>{l}</div>
                                </div>
                            ))}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
                            {phase === 'active' && !simulating && (
                                <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => startSimulation(journey)}>
                                    <i className="fas fa-gamepad" style={{ marginRight: '6px' }}></i>Demo Drive
                                </button>
                            )}
                            <button className="btn btn-sm" style={{ flex: 1, background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca' }}
                                onClick={() => endJourney(true)}>
                                <i className="fas fa-stop" style={{ marginRight: '6px' }}></i>{phase === 'arrived' ? 'Save & Finish' : 'End & Save'}
                            </button>
                        </div>
                    </div>

                    {/* Weather + outfit at destination */}
                    <div className="card" style={{ padding: '20px' }}>
                        <div className="card-title" style={{ fontSize: '15px', marginBottom: '12px' }}>
                            <i className="fas fa-shirt"></i>Wear for {journey.end.name}
                        </div>
                        {!weather ? <div className="skeleton" style={{ height: '70px' }} /> : (
                            <>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                    <i className={`fas ${weather.icon}`} style={{ fontSize: '26px', color: 'var(--primary)' }}></i>
                                    <div style={{ flex: 1 }}>
                                        <strong style={{ color: 'var(--dark)' }}>{weather.temp}°C · {weather.condition}</strong>
                                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>wind {weather.windSpeed} km/h · humidity {weather.humidity}%</div>
                                    </div>
                                    {(() => { const c = CATEGORIES[classifyWeather(weather)]; return (
                                        <span className="route-badge" style={{ background: `${c.color}22`, color: c.color }}>
                                            {c.emoji} {c.label}
                                        </span>
                                    ); })()}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                                    {tips.map((t, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--text)', alignItems: 'flex-start' }}>
                                            <i className={`fas ${t.icon}`} style={{ color: 'var(--accent)', width: '18px', marginTop: '2px' }}></i>{t.text}
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Real photos around current position */}
                    <div className="card" style={{ padding: '20px' }}>
                        <div className="card-title" style={{ fontSize: '15px', marginBottom: '12px' }}>
                            <i className="fas fa-camera"></i>Around you{placeName ? ` — ${placeName}` : ''}
                        </div>
                        {photosLoading && <div className="skeleton" style={{ height: '90px' }} />}
                        {!photosLoading && photos.length === 0 && (
                            <p style={{ fontSize: '13px', color: 'var(--muted)' }}>No documented landmarks nearby yet — photos appear as you travel.</p>
                        )}
                        <div className="journey-photos">
                            {photos.map(p => (
                                <a key={p.id} href={p.link} target="_blank" rel="noopener noreferrer" className="journey-photo" title={p.title}>
                                    <img src={p.url} alt={p.title} loading="lazy" />
                                    <span>{p.title}</span>
                                </a>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Journey;
