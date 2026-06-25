// Real geotagged photos of places near a coordinate, via the free Wikipedia
// geosearch API (no key, CORS-enabled). Returns actual photos of real landmarks
// around the given point — what you'd genuinely see at that location.
const cache = {};

export const getPhotosNear = async (lat, lng, { radius = 10000, limit = 8 } = {}) => {
    const key = `${lat.toFixed(2)},${lng.toFixed(2)}:${radius}`;
    if (cache[key]) return cache[key];

    try {
        const url = `https://en.wikipedia.org/w/api.php?action=query&generator=geosearch` +
            `&ggscoord=${lat}%7C${lng}&ggsradius=${radius}&ggslimit=${limit}` +
            `&prop=pageimages%7Ccoordinates%7Cdescription&piprop=thumbnail&pithumbsize=600` +
            `&format=json&origin=*`;
        const res = await fetch(url);
        const data = await res.json();
        const pages = Object.values(data?.query?.pages || {});
        const photos = pages
            .filter(p => p.thumbnail?.source)
            .map(p => ({
                id: p.pageid,
                title: p.title,
                description: p.description || '',
                url: p.thumbnail.source,
                lat: p.coordinates?.[0]?.lat,
                lng: p.coordinates?.[0]?.lon,
                link: `https://en.wikipedia.org/?curid=${p.pageid}`
            }));
        cache[key] = photos;
        return photos;
    } catch {
        return [];
    }
};
