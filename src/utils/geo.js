// Real geocoding (Open-Meteo) + real driving routes (OSRM). Both free, no API key,
// CORS-enabled. Everything degrades gracefully to a straight-line estimate offline.

export const searchCities = async (q) => {
    if (!q || q.trim().length < 2) return [];
    try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q.trim())}&count=6&language=en&format=json`;
        const res = await fetch(url);
        const data = await res.json();
        return (data.results || []).map(r => ({
            id: `${r.id}`,
            name: r.name,
            country: r.country,
            admin1: r.admin1,
            lat: r.latitude,
            lng: r.longitude,
            label: [r.name, r.admin1, r.country].filter(Boolean).join(', ')
        }));
    } catch {
        return [];
    }
};

export const geocodeOne = async (q) => {
    const list = await searchCities(q);
    return list[0] || null;
};

// Coordinates → nearest place name (free BigDataCloud client API, no key).
export const reverseGeocode = async (lat, lng) => {
    try {
        const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`
        );
        const d = await res.json();
        const name = d.city || d.locality || d.principalSubdivision || 'Current location';
        return { lat, lng, name, country: d.countryName, label: [name, d.countryName].filter(Boolean).join(', ') };
    } catch {
        return { lat, lng, name: 'Current location', label: 'Current location' };
    }
};

// Browser geolocation as a promise → { lat, lng, accuracy }.
export const getCurrentPosition = (options = {}) =>
    new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('Geolocation is not supported by this browser.'));
        navigator.geolocation.getCurrentPosition(
            pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
            err => reject(new Error(
                err.code === 1 ? 'Location permission denied. Allow location access and try again.' :
                err.code === 2 ? 'Location unavailable. Check your device settings.' :
                'Location request timed out.'
            )),
            { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000, ...options }
        );
    });

const toRad = (d) => (d * Math.PI) / 180;
export const haversineKm = (a, b) => {
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(x));
};

// Public, keyless OSRM endpoints — tried in order so a route still loads if one is down.
const OSRM_HOSTS = [
    'https://router.project-osrm.org',
    'https://routing.openstreetmap.de/routed-car'
];

// Returns an array of real driving routes (optimal first), each:
// { distanceKm, durationHours, coordinates: [[lat,lng]...], avgSpeed, estimated }
export const getRoutes = async (start, end) => {
    const path = `/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}` +
        `?overview=full&geometries=geojson&alternatives=true`;

    for (const host of OSRM_HOSTS) {
        try {
            const res = await fetch(host + path);
            if (!res.ok) continue;
            const data = await res.json();
            if (data.code !== 'Ok' || !data.routes?.length) continue;
            return data.routes.map(r => {
                const distanceKm = r.distance / 1000;
                const durationHours = r.duration / 3600;
                return {
                    distanceKm,
                    durationHours,
                    avgSpeed: durationHours > 0 ? distanceKm / durationHours : 0,
                    coordinates: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
                    estimated: false
                };
            });
        } catch {
            // try next host
        }
    }

    // Offline / all hosts down: estimate from the real geocoded coordinates.
    const dist = haversineKm(start, end) * 1.3; // road-distance factor
    return [{
        distanceKm: dist,
        durationHours: dist / 60,
        avgSpeed: 60,
        coordinates: [[start.lat, start.lng], [end.lat, end.lng]],
        estimated: true
    }];
};

export const trafficFromSpeed = (kmh) =>
    kmh < 40 ? 'Heavy Traffic' : kmh < 65 ? 'Moderate Traffic' : 'Light Traffic';
