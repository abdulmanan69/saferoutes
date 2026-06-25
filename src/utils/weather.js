// Real weather + geocoding via Open-Meteo (free, no API key, CORS-enabled).
// Falls back to a deterministic simulation if the network call fails.
import { tourismAPI } from './tourismAPI';

const WMO = {
    0: { label: 'Clear', icon: 'fa-sun' },
    1: { label: 'Mainly Clear', icon: 'fa-sun' },
    2: { label: 'Partly Cloudy', icon: 'fa-cloud-sun' },
    3: { label: 'Cloudy', icon: 'fa-cloud' },
    45: { label: 'Foggy', icon: 'fa-smog' },
    48: { label: 'Foggy', icon: 'fa-smog' },
    51: { label: 'Light Drizzle', icon: 'fa-cloud-rain' },
    61: { label: 'Rainy', icon: 'fa-cloud-showers-heavy' },
    63: { label: 'Rainy', icon: 'fa-cloud-showers-heavy' },
    65: { label: 'Heavy Rain', icon: 'fa-cloud-showers-water' },
    71: { label: 'Snow', icon: 'fa-snowflake' },
    73: { label: 'Snow', icon: 'fa-snowflake' },
    75: { label: 'Heavy Snow', icon: 'fa-snowflake' },
    80: { label: 'Showers', icon: 'fa-cloud-showers-heavy' },
    95: { label: 'Thunderstorm', icon: 'fa-cloud-bolt' }
};

const codeToInfo = (code) => WMO[code] || { label: 'Cloudy', icon: 'fa-cloud' };
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const geocode = async (place) => {
    const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`;
    const res = await fetch(url);
    const data = await res.json();
    const r = data?.results?.[0];
    return r ? { lat: r.latitude, lng: r.longitude, name: r.name, country: r.country } : null;
};

// What to wear / carry, derived from real conditions. Returns [{ icon, text }].
export const outfitAdvice = (w) => {
    if (!w) return [];
    const tips = [];
    const c = (w.condition || '').toLowerCase();
    const t = w.temp;

    // Layers by temperature
    if (t <= 0) tips.push({ icon: 'fa-mitten', text: 'Freezing — heavy winter coat, thermal layers, gloves and a beanie.' });
    else if (t <= 8) tips.push({ icon: 'fa-user-shield', text: 'Cold — warm jacket or fleece with a scarf; layer up.' });
    else if (t <= 16) tips.push({ icon: 'fa-shirt', text: 'Cool — light jacket or hoodie over a full-sleeve shirt.' });
    else if (t <= 26) tips.push({ icon: 'fa-shirt', text: 'Pleasant — comfortable cottons; carry a light layer for the evening.' });
    else if (t <= 34) tips.push({ icon: 'fa-temperature-high', text: 'Warm — light breathable clothes; keep water with you.' });
    else tips.push({ icon: 'fa-fire', text: 'Hot — loose light-colored clothing, cap, and plenty of water.' });

    // Condition-specific gear
    if (c.includes('rain') || c.includes('drizzle') || c.includes('shower') || c.includes('storm'))
        tips.push({ icon: 'fa-umbrella', text: 'Rain expected — waterproof jacket or umbrella, and non-slip shoes.' });
    if (c.includes('snow'))
        tips.push({ icon: 'fa-snowflake', text: 'Snow — insulated waterproof boots; pack tire chains for the drive.' });
    if (c.includes('fog'))
        tips.push({ icon: 'fa-smog', text: 'Fog — wear bright/reflective clothing if walking near roads.' });
    if ((c.includes('clear') || c.includes('sun')) && t >= 20)
        tips.push({ icon: 'fa-glasses', text: 'Sunny — sunglasses, sunscreen (SPF 30+) and a cap.' });
    if (w.windSpeed >= 25)
        tips.push({ icon: 'fa-wind', text: `Windy (${w.windSpeed} km/h) — a windbreaker will help; secure loose items.` });
    if (w.humidity >= 80 && t >= 22)
        tips.push({ icon: 'fa-droplet', text: 'Humid — moisture-wicking fabrics; take extra water breaks.' });

    return tips.slice(0, 4);
};

// Live weather for exact coordinates (used by Journey mode).
export const getWeatherByCoords = async (lat, lng, name = 'Current location') => {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
        `&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m` +
        `&daily=weather_code,temperature_2m_max&forecast_days=4&timezone=auto`;
    const res = await fetch(url);
    const d = await res.json();
    const cur = d.current;
    const info = codeToInfo(cur.weather_code);
    const forecast = (d.daily?.time || []).slice(1, 4).map((iso, i) => {
        const di = codeToInfo(d.daily.weather_code[i + 1]);
        return {
            day: DAY[new Date(iso).getDay()],
            temp: Math.round(d.daily.temperature_2m_max[i + 1]),
            condition: di.label,
            icon: di.icon
        };
    });
    return {
        location: name,
        temp: Math.round(cur.temperature_2m),
        condition: info.label,
        icon: info.icon,
        humidity: Math.round(cur.relative_humidity_2m),
        windSpeed: Math.round(cur.wind_speed_10m),
        forecast,
        live: true
    };
};

export const getWeather = async (location) => {
    const loc = location || 'Skardu';
    try {
        const geo = await geocode(loc);
        if (!geo) throw new Error('no geo');
        return await getWeatherByCoords(geo.lat, geo.lng, geo.name);
    } catch {
        // graceful fallback to the bundled simulation
        const sim = await tourismAPI.getWeatherData(loc);
        return { ...sim, icon: codeToInfo(0).icon, live: false };
    }
};
