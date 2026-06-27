import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ScenicViewCard from '../components/Tourism/ScenicViewCard';
import HotelCard from '../components/Tourism/HotelCard';
import AttractionCard from '../components/Tourism/AttractionCard';
import LocationInput from '../components/LocationInput/LocationInput';
import { tourismAPI } from '../utils/tourismAPI';
import { getPhotosNear } from '../utils/photos';
import { geocodeOne, haversineKm } from '../utils/geo';

const loadItin = (uid) => {
    try { return JSON.parse(localStorage.getItem(`sr_itinerary_${uid || 'guest'}`)) || []; }
    catch { return []; }
};

const Tourism = () => {
    const { user } = useAuth();
    const toast = useToast();

    const [activeTab, setActiveTab] = useState('explore');
    const [data, setData] = useState({ scenic: [], hotels: [], attractions: [] });
    const [loading, setLoading] = useState(true);

    // Explore any real city
    const [query, setQuery] = useState('');
    const [center, setCenter] = useState(null);
    const [places, setPlaces] = useState([]);
    const [exploring, setExploring] = useState(false);

    // Persistent itinerary
    const [itinerary, setItinerary] = useState(() => loadItin(user?.id));
    useEffect(() => {
        localStorage.setItem(`sr_itinerary_${user?.id || 'guest'}`, JSON.stringify(itinerary));
    }, [itinerary, user]);

    useEffect(() => {
        Promise.all([tourismAPI.getScenicViews(), tourismAPI.getHotels(), tourismAPI.getAttractions()])
            .then(([scenic, hotels, attractions]) => { setData({ scenic, hotels, attractions }); setLoading(false); });
    }, []);

    const explore = useCallback(async (place) => {
        setExploring(true);
        setPlaces([]);
        const p = place?.lat ? place : await geocodeOne(place?.name || query);
        if (!p) { toast.error('Could not find that city.'); setExploring(false); return; }
        setCenter(p);
        const found = await getPhotosNear(p.lat, p.lng, { radius: 10000, limit: 14 });
        const withDist = found
            .map(f => ({ ...f, km: f.lat ? Math.round(haversineKm(p, f) * 10) / 10 : null }))
            .sort((a, b) => (a.km ?? 99) - (b.km ?? 99));
        setPlaces(withDist);
        setExploring(false);
        if (withDist.length === 0) toast.info(`No documented sights found around ${p.name}. Try a bigger city.`);
        else toast.success(`Found ${withDist.length} real places around ${p.name}.`);
    }, [query, toast]);

    // Load something real immediately
    useEffect(() => { explore({ name: 'Lahore' }); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    const addItem = (item, kind, durationHours = 2) => {
        const key = `${kind}-${item.id}`;
        if (itinerary.some(i => i.key === key)) { toast.warning(`"${item.name || item.title}" is already in your itinerary.`); return; }
        setItinerary(prev => [...prev, { key, name: item.name || item.title, kind, durationHours, city: center?.name }]);
        toast.success(`Added "${item.name || item.title}" to itinerary.`);
    };

    const removeItem = (key) => setItinerary(prev => prev.filter(i => i.key !== key));
    const optimizeTrip = () => {
        setItinerary(prev => [...prev].sort((a, b) => a.durationHours - b.durationHours));
        toast.success('Itinerary optimized for time efficiency.');
    };

    const totalHours = itinerary.reduce((s, i) => s + i.durationHours, 0);
    const kindIcon = { scenic: 'fa-mountain-sun', attraction: 'fa-landmark', hotel: 'fa-hotel', place: 'fa-location-dot' };

    const TABS = [
        { key: 'explore', icon: 'fa-compass', label: 'Explore' },
        { key: 'scenic', icon: 'fa-mountain-sun', label: 'Scenic Routes' },
        { key: 'hotels', icon: 'fa-hotel', label: 'Hotels' },
        { key: 'attractions', icon: 'fa-landmark', label: 'Attractions' },
        { key: 'itinerary', icon: 'fa-map-signs', label: `Itinerary (${itinerary.length})` }
    ];

    return (
        <div className="main">
            <div className="header">
                <h1>Tourism Hub</h1>
                <p>Explore real places in any city, plan your itinerary, and discover scenic routes</p>
            </div>

            <div className="tabs">
                {TABS.map(t => (
                    <button key={t.key} className={`tab-btn ${activeTab === t.key ? 'active' : ''}`} onClick={() => setActiveTab(t.key)}>
                        <i className={`fas ${t.icon}`} style={{ marginRight: '8px' }}></i>{t.label}
                    </button>
                ))}
            </div>

            {/* EXPLORE — real places in any city */}
            {activeTab === 'explore' && (
                <>
                    <div className="card fade-in" style={{ marginBottom: '24px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: '220px' }}>
                                <label>Which city do you want to explore?</label>
                                <LocationInput value={query} placeholder="Try Istanbul, Hunza, Paris…" icon="fa-compass"
                                    allowCurrent onError={m => toast.error(m)}
                                    onChange={setQuery}
                                    onSelect={p => { setQuery(p.name); explore(p); }} />
                            </div>
                            <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => explore()} disabled={exploring}>
                                {exploring ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-magnifying-glass-location" style={{ marginRight: '8px' }}></i>Explore</>}
                            </button>
                        </div>
                        {center && !exploring && (
                            <p style={{ marginTop: '12px', fontSize: '13px', color: 'var(--muted)' }}>
                                <i className="fas fa-location-dot" style={{ marginRight: '6px', color: 'var(--primary)' }}></i>
                                Showing real documented places within 10 km of <strong>{center.name}</strong>{center.country ? `, ${center.country}` : ''} — photos & info from Wikipedia.
                            </p>
                        )}
                    </div>

                    {exploring && (
                        <div className="place-grid">
                            {[...Array(6)].map((_, i) => <div key={i} className="skeleton" style={{ height: '250px', borderRadius: '16px' }} />)}
                        </div>
                    )}

                    {!exploring && (
                        <div className="place-grid">
                            {places.map((p, idx) => (
                                <div key={p.id} className="place-card pop-in" style={{ animationDelay: `${Math.min(idx * 0.05, 0.4)}s` }}>
                                    <div className="place-img">
                                        <img src={p.url} alt={p.title} loading="lazy" />
                                        {p.km != null && <span className="place-dist"><i className="fas fa-route"></i> {p.km} km</span>}
                                    </div>
                                    <div className="place-body">
                                        <h3>{p.title}</h3>
                                        {p.description && <p className="place-desc">{p.description}</p>}
                                        <div className="place-actions">
                                            <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={() => addItem(p, 'place')}>
                                                <i className="fas fa-plus" style={{ marginRight: '6px' }}></i>Itinerary
                                            </button>
                                            <a href={p.link} target="_blank" rel="noopener noreferrer" className="icon-action" title="Read more" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                                                <i className="fas fa-book-open"></i>
                                            </a>
                                            <a href={`https://www.google.com/maps/search/${encodeURIComponent(p.title)}`} target="_blank" rel="noopener noreferrer" className="icon-action" title="Open in maps" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none' }}>
                                                <i className="fas fa-map-location-dot"></i>
                                            </a>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Curated tabs */}
            {activeTab === 'scenic' && (
                <div className="place-grid">
                    {loading ? [...Array(3)].map((_, i) => <div key={i} className="skeleton" style={{ height: '300px', borderRadius: '16px' }} />)
                        : data.scenic.map(v => <ScenicViewCard key={v.id} view={v} onAdd={() => addItem(v, 'scenic', v.durationHours)} />)}
                </div>
            )}
            {activeTab === 'hotels' && (
                <div className="place-grid">
                    {data.hotels.map(h => <HotelCard key={h.id} hotel={h} onBook={() => toast.success(`Booking request sent for ${h.name}.`)} />)}
                </div>
            )}
            {activeTab === 'attractions' && (
                <div className="place-grid">
                    {data.attractions.map(a => <AttractionCard key={a.id} attraction={a} onAdd={() => addItem(a, 'attraction', a.durationHours)} />)}
                </div>
            )}

            {/* ITINERARY — persistent day plan */}
            {activeTab === 'itinerary' && (
                <div className="grid">
                    <div className="card fade-in">
                        <div className="card-title" style={{ justifyContent: 'space-between' }}>
                            <span style={{ display: 'flex', gap: '12px', alignItems: 'center' }}><i className="fas fa-map-signs"></i>Your Day Plan</span>
                            {itinerary.length > 1 && (
                                <button className="btn btn-ghost btn-sm" style={{ width: 'auto' }} onClick={optimizeTrip}>
                                    <i className="fas fa-wand-magic-sparkles" style={{ marginRight: '6px' }}></i>Optimize
                                </button>
                            )}
                        </div>
                        {itinerary.length === 0 ? (
                            <div className="empty-state">
                                <i className="fas fa-map-signs"></i>
                                <p style={{ fontWeight: 600 }}>Your itinerary is empty</p>
                                <p style={{ fontSize: '13px', marginTop: '6px' }}>Explore a city and add places to build your day plan. It's saved automatically.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {itinerary.map((item, idx) => (
                                    <div key={item.key} className="closet-row pop-in" style={{ animationDelay: `${idx * 0.05}s` }}>
                                        <span style={{ fontWeight: 800, color: 'var(--primary)', width: '22px', textAlign: 'center' }}>{idx + 1}</span>
                                        <i className={`fas ${kindIcon[item.kind] || 'fa-location-dot'}`} style={{ color: 'var(--accent)' }}></i>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                                            <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{item.durationHours}h visit{item.city ? ` · ${item.city}` : ''}</div>
                                        </div>
                                        <button className="icon-action danger" title="Remove" onClick={() => removeItem(item.key)}>
                                            <i className="fas fa-times"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="card fade-in" style={{ height: 'fit-content' }}>
                        <div className="card-title"><i className="fas fa-clock"></i>Plan Summary</div>
                        <div style={{ textAlign: 'center', padding: '10px 0 20px', borderBottom: '1px solid var(--border)' }}>
                            <div className="stat-value" style={{ fontSize: '34px' }}>{totalHours}h</div>
                            <div className="stat-label">{itinerary.length} stop{itinerary.length !== 1 ? 's' : ''} planned</div>
                        </div>
                        <div style={{ paddingTop: '16px', fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>
                            <p><i className="fas fa-lightbulb" style={{ color: 'var(--warning)', marginRight: '8px' }}></i>A comfortable day covers 6–8 hours of visits.</p>
                            <p style={{ marginTop: '8px' }}><i className="fas fa-floppy-disk" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>Your plan is saved on this device automatically.</p>
                        </div>
                        {itinerary.length > 0 && (
                            <button className="btn btn-ghost" style={{ marginTop: '16px' }} onClick={() => { setItinerary([]); toast.info('Itinerary cleared.'); }}>
                                <i className="fas fa-trash" style={{ marginRight: '8px' }}></i>Clear Plan
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Tourism;
