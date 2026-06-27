// Real place photos via the free Wikipedia REST API (no key, CORS-enabled).
// Falls back to a deterministic placeholder if a page/image isn't found.
const cache = {};

export const getPlaceImage = async (query, seed) => {
    const key = query || seed || 'place';
    if (cache[key]) return cache[key];

    try {
        const title = encodeURIComponent(key.replace(/\s+/g, '_'));
        const res = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${title}`);
        if (res.ok) {
            const d = await res.json();
            const url = d.originalimage?.source || d.thumbnail?.source;
            if (url) { cache[key] = url; return url; }
        }
    } catch {
        // ignore and fall through to placeholder
    }

    const fb = `https://picsum.photos/seed/${encodeURIComponent(seed || key)}/600/400`;
    cache[key] = fb;
    return fb;
};
