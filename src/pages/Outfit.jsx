import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { getWeather } from '../utils/weather';
import {
    classifyWeather, getSuitableWeather, clothingEmoji,
    CATEGORIES, SUGGESTIONS, loadItems, saveItems
} from '../utils/outfitModel';
import LocationInput from '../components/LocationInput/LocationInput';

const Outfit = () => {
    const { user } = useAuth();
    const toast = useToast();

    const [city, setCity] = useState('');
    const [weather, setWeather] = useState(null);
    const [loading, setLoading] = useState(true);

    const [closet, setCloset] = useState(() => loadItems('closet', user?.id));
    const [wishlist, setWishlist] = useState(() => loadItems('wishlist', user?.id));
    const [tab, setTab] = useState('closet');
    const [newItem, setNewItem] = useState('');

    const fetchWeather = async (loc) => {
        setLoading(true);
        const w = await getWeather(loc);
        setWeather(w);
        setLoading(false);
    };

    useEffect(() => { fetchWeather('Islamabad'); }, []);
    useEffect(() => { saveItems('closet', user?.id, closet); }, [closet, user]);
    useEffect(() => { saveItems('wishlist', user?.id, wishlist); }, [wishlist, user]);

    // The ported decision-tree prediction.
    const category = weather ? classifyWeather(weather) : 'mild';
    const cat = CATEGORIES[category];

    const closetMatches = useMemo(
        () => closet.filter(i => i.category === category),
        [closet, category]
    );

    const addItem = (kind) => {
        const name = newItem.trim();
        if (!name) return;
        const item = {
            id: Date.now(),
            name,
            emoji: clothingEmoji(name),
            category: getSuitableWeather(name)
        };
        if (kind === 'closet') setCloset(prev => [item, ...prev]);
        else setWishlist(prev => [item, ...prev]);
        setNewItem('');
        toast.success(`"${name}" added to your ${kind} (${CATEGORIES[item.category].label} weather).`);
    };

    const removeItem = (kind, id) => {
        if (kind === 'closet') setCloset(prev => prev.filter(i => i.id !== id));
        else setWishlist(prev => prev.filter(i => i.id !== id));
    };

    const moveToCloset = (item) => {
        setWishlist(prev => prev.filter(i => i.id !== item.id));
        setCloset(prev => [item, ...prev]);
        toast.success(`"${item.name}" moved to your closet. 🎉`);
    };

    const items = tab === 'closet' ? closet : wishlist;

    return (
        <div className="main">
            <div className="header">
                <h1>Smart Outfit</h1>
                <p>AI weather classification + your own closet — know exactly what to wear</p>
            </div>

            {/* Animated category hero */}
            <div className="outfit-hero fade-in" style={{ background: cat.gradient }}>
                <div className="outfit-hero-emojis" aria-hidden="true">
                    {[...Array(6)].map((_, i) => (
                        <span key={i} className="float-emoji" style={{ left: `${8 + i * 16}%`, animationDelay: `${i * 0.9}s` }}>
                            {cat.emoji}
                        </span>
                    ))}
                </div>
                <div className="outfit-hero-content">
                    <div style={{ flex: 1, minWidth: '220px' }}>
                        <div className="outfit-cat-badge">
                            <i className={`fas ${cat.icon}`}></i>
                            {loading ? 'Analyzing…' : `${cat.label} Weather`}
                        </div>
                        {weather && !loading && (
                            <>
                                <div className="outfit-temp">{weather.temp}°C</div>
                                <div className="outfit-meta">
                                    {weather.location} · {weather.condition} · wind {weather.windSpeed} km/h · humidity {weather.humidity}%
                                </div>
                                <div className="outfit-meta" style={{ opacity: 0.85, marginTop: '4px', fontSize: '12px' }}>
                                    <i className="fas fa-brain" style={{ marginRight: '6px' }}></i>
                                    Decision-tree model classified this as <strong>{cat.label.toLowerCase()}</strong>
                                </div>
                            </>
                        )}
                        {loading && <div className="skeleton" style={{ height: '58px', width: '200px', marginTop: '10px', opacity: 0.4 }} />}
                    </div>
                    <div style={{ width: '260px', maxWidth: '100%' }}>
                        <LocationInput
                            value={city}
                            placeholder="Check another city..."
                            icon="fa-location-dot"
                            allowCurrent onError={m => toast.error(m)}
                            onChange={setCity}
                            onSelect={p => { setCity(p.name); fetchWeather(p.name); }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid">
                {/* Recommendations */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-wand-magic-sparkles"></i>From Your Closet</div>
                        {closetMatches.length === 0 ? (
                            <p style={{ color: 'var(--muted)', fontSize: '14px' }}>
                                {closet.length === 0
                                    ? 'Your closet is empty — add your clothes on the right, and I\'ll pick outfits from what you own.'
                                    : `Nothing in your closet suits ${cat.label.toLowerCase()} weather yet. Check the suggestions below or add more items.`}
                            </p>
                        ) : (
                            <div className="outfit-grid">
                                {closetMatches.map((i, idx) => (
                                    <div key={i.id} className="outfit-item pop-in" style={{ animationDelay: `${idx * 0.06}s` }}>
                                        <span className="outfit-item-emoji">{i.emoji}</span>
                                        <span className="outfit-item-name">{i.name}</span>
                                        <span className="route-badge badge-safe" style={{ fontSize: '9px' }}>YOURS</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-lightbulb"></i>Suggested for {cat.label} Weather</div>
                        <div className="outfit-grid">
                            {SUGGESTIONS[category].map((s, idx) => {
                                const owned = closet.some(i => i.name.toLowerCase() === s.toLowerCase());
                                return (
                                    <div key={s} className="outfit-item pop-in" style={{ animationDelay: `${idx * 0.06}s` }}>
                                        <span className="outfit-item-emoji">{clothingEmoji(s)}</span>
                                        <span className="outfit-item-name">{s}</span>
                                        {owned
                                            ? <span className="route-badge badge-safe" style={{ fontSize: '9px' }}>OWNED</span>
                                            : <button className="outfit-mini-btn" title="Add to wishlist"
                                                onClick={() => { setWishlist(prev => [{ id: Date.now(), name: s, emoji: clothingEmoji(s), category }, ...prev]); toast.success(`"${s}" added to wishlist.`); }}>
                                                <i className="fas fa-heart"></i>
                                            </button>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Closet manager */}
                <div className="card fade-in" style={{ height: 'fit-content' }}>
                    <div className="card-title"><i className="fas fa-door-open"></i>My Wardrobe</div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <button className={`chip ${tab === 'closet' ? 'active' : ''}`} onClick={() => setTab('closet')}>
                            <i className="fas fa-shirt"></i>Closet ({closet.length})
                        </button>
                        <button className={`chip ${tab === 'wishlist' ? 'active' : ''}`} onClick={() => setTab('wishlist')}>
                            <i className="fas fa-heart"></i>Wishlist ({wishlist.length})
                        </button>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                        <input
                            type="text" value={newItem} placeholder="e.g. Denim Jacket"
                            onChange={e => setNewItem(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && addItem(tab)}
                            style={{ flex: 1 }}
                        />
                        <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 16px' }} onClick={() => addItem(tab)}>
                            <i className="fas fa-plus"></i>
                        </button>
                    </div>

                    {items.length === 0 && (
                        <p style={{ color: 'var(--muted)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>
                            {tab === 'closet' ? 'Add the clothes you own — auto-categorized for you.' : 'Save items you want to buy later.'}
                        </p>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
                        {items.map((i, idx) => (
                            <div key={i.id} className="closet-row pop-in" style={{ animationDelay: `${idx * 0.04}s` }}>
                                <span style={{ fontSize: '22px' }}>{i.emoji}</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{i.name}</div>
                                    <span className="route-badge" style={{ fontSize: '9px', background: `${CATEGORIES[i.category].color}22`, color: CATEGORIES[i.category].color }}>
                                        {CATEGORIES[i.category].label}
                                    </span>
                                </div>
                                {tab === 'wishlist' && (
                                    <button className="icon-action" title="Got it! Move to closet" onClick={() => moveToCloset(i)}>
                                        <i className="fas fa-check"></i>
                                    </button>
                                )}
                                <button className="icon-action danger" title="Remove" onClick={() => removeItem(tab, i.id)}>
                                    <i className="fas fa-times"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Outfit;
