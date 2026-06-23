import React, { useEffect, useRef, useState } from 'react';
import { searchCities, getCurrentPosition, reverseGeocode } from '../../utils/geo';

// Autocomplete city/place input backed by real Open-Meteo geocoding.
// `allowCurrent` adds a GPS button that fills in the user's real location.
const LocationInput = ({ value, onChange, onSelect, placeholder, icon = 'fa-location-dot', allowCurrent = false, onError }) => {
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [locating, setLocating] = useState(false);
    const skip = useRef(false);
    const ref = useRef(null);

    useEffect(() => {
        const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, []);

    useEffect(() => {
        if (skip.current) { skip.current = false; return; }
        if (!value || value.trim().length < 2) { setResults([]); setOpen(false); return; }
        setLoading(true);
        const t = setTimeout(async () => {
            const r = await searchCities(value);
            setResults(r);
            setLoading(false);
            setOpen(true);
        }, 280);
        return () => clearTimeout(t);
    }, [value]);

    const pick = (place) => {
        skip.current = true;
        onChange(place.name);
        onSelect?.(place);
        setResults([]);
        setOpen(false);
    };

    const useMyLocation = async () => {
        setLocating(true);
        try {
            const pos = await getCurrentPosition();
            const place = await reverseGeocode(pos.lat, pos.lng);
            pick({ ...place, id: 'gps' });
        } catch (e) {
            onError?.(e.message);
        }
        setLocating(false);
    };

    return (
        <div className="loc-input" ref={ref}>
            <div className="input-group">
                <span className="loc-icon"><i className={`fas ${icon}`}></i></span>
                <input
                    type="text"
                    value={value}
                    placeholder={placeholder}
                    onChange={e => onChange(e.target.value)}
                    onFocus={() => results.length && setOpen(true)}
                    autoComplete="off"
                />
                {loading && <i className="fas fa-spinner fa-spin loc-spin"></i>}
                {allowCurrent && (
                    <button type="button" className="icon-btn" title="Use my current location"
                        onClick={useMyLocation} disabled={locating}
                        style={{ flexShrink: 0 }}>
                        <i className={`fas ${locating ? 'fa-spinner fa-spin' : 'fa-location-crosshairs'}`}
                            style={{ color: 'var(--primary)' }}></i>
                    </button>
                )}
            </div>
            {open && (results.length > 0 || loading) && (
                <div className="loc-dropdown">
                    {loading && results.length === 0 && (
                        <div className="loc-item muted"><i className="fas fa-spinner fa-spin"></i> Searching…</div>
                    )}
                    {results.map(r => (
                        <div key={r.id} className="loc-item" onClick={() => pick(r)}>
                            <i className="fas fa-location-dot loc-pin"></i>
                            <div>
                                <div className="loc-name">{r.name}</div>
                                <div className="loc-sub">{[r.admin1, r.country].filter(Boolean).join(', ')}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default LocationInput;
