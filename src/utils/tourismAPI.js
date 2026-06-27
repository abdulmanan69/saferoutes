// Tourism data module - Pakistan Edition.
// Static dataset wrapped in async getters so the UI can treat it like a real API.

const SCENIC_VIEWS = [
    {
        id: 1,
        name: 'Karakoram Highway (KKH)',
        wiki: 'Karakoram Highway',
        images: ['https://picsum.photos/seed/kkh/400/250'],
        rating: 5.0,
        photos: 450,
        bestTime: 'Morning',
        durationHours: 6,
        location: 'Gilgit-Baltistan',
        summary: 'One of the highest paved roads on earth, tracing the ancient Silk Road.',
        lengthKm: 1300,
        maxElevationFt: 15397,
        description:
            'The Karakoram Highway (KKH) is one of the highest paved roads in the world, passing through the Karakoram mountain range. It follows the paths of the ancient Silk Road, offering views of Nanga Parbat, Rakaposhi, and the Passu Cones.',
        tips: [
            { icon: 'fa-snowflake', color: 'var(--accent)', text: 'Check Khunjerab Pass opening status during winter.' },
            { icon: 'fa-gas-pump', color: 'var(--danger)', text: 'Fill up your tank at Gilgit; fuel stations are sparse ahead.' },
            { icon: 'fa-camera-retro', color: 'var(--success)', text: 'Stop at the Junction of Three Mountain Ranges for photos.' }
        ]
    },
    {
        id: 2,
        name: 'Babusar Top',
        wiki: 'Babusar Pass',
        images: ['https://picsum.photos/seed/babusar/400/250'],
        rating: 4.9,
        photos: 320,
        bestTime: 'Afternoon',
        durationHours: 4,
        location: 'Mansehra / Gilgit-Baltistan',
        summary: 'The highest point on the Kaghan Valley road at 13,700 ft.',
        lengthKm: 150,
        maxElevationFt: 13700,
        description:
            'Babusar Top is the highest point in the Kaghan Valley, connecting it to Chilas on the Karakoram Highway. The pass is only open in summer and rewards travellers with sweeping alpine meadows and glacial streams.',
        tips: [
            { icon: 'fa-temperature-low', color: 'var(--accent)', text: 'Carry warm clothing — temperatures drop sharply at the top.' },
            { icon: 'fa-road', color: 'var(--danger)', text: 'Pass is typically open July–September only.' },
            { icon: 'fa-mug-hot', color: 'var(--success)', text: 'Try the roadside chai stalls at the summit.' }
        ]
    },
    {
        id: 3,
        name: 'Makran Coastal Highway',
        wiki: 'Makran Coastal Highway',
        images: ['https://picsum.photos/seed/makran/400/250'],
        rating: 4.8,
        photos: 280,
        bestTime: 'Sunset',
        durationHours: 5,
        location: 'Balochistan',
        summary: 'A 650 km coastal drive along the Arabian Sea past Hingol National Park.',
        lengthKm: 653,
        maxElevationFt: 300,
        description:
            'The Makran Coastal Highway (N-10) runs along the Arabian Sea, linking Karachi with Gwadar. It passes the dramatic mud volcanoes and rock formations of Hingol National Park, including the famous Princess of Hope.',
        tips: [
            { icon: 'fa-water', color: 'var(--accent)', text: 'Best light for the Princess of Hope is near sunset.' },
            { icon: 'fa-gas-pump', color: 'var(--danger)', text: 'Refuel in Ormara; long stretches have no services.' },
            { icon: 'fa-fish', color: 'var(--success)', text: 'Fresh seafood is available at Kund Malir.' }
        ]
    }
];

const HOTELS = [
    { id: 1, name: 'Pearl Continental Bhurban', wiki: 'Bhurban', images: ['https://picsum.photos/seed/pcbhurban/400/250'], price: 'Rs. 25,000', amenities: ['Spa', 'Mountain View', 'Luxury'], rooms: ['Deluxe', 'Executive Suite'] },
    { id: 2, name: 'Serena Shigar Fort', wiki: 'Shigar Fort', images: ['https://picsum.photos/seed/shigar/400/250'], price: 'Rs. 30,000', amenities: ['Heritage', 'Garden', 'Royal'], rooms: ['Raja Room', 'Standard'] },
    { id: 3, name: 'Shangrila Resort Skardu', wiki: 'Shangrila Resort', images: ['https://picsum.photos/seed/shangrila/400/250'], price: 'Rs. 18,000', amenities: ['Lake View', 'Boating'], rooms: ['Cottage'] }
];

const ATTRACTIONS = [
    { id: 1, name: 'Badshahi Mosque, Lahore', wiki: 'Badshahi Mosque', tags: ['History', 'Architecture'], hours: '8:00 - 20:00', price: 'Free', durationHours: 2 },
    { id: 2, name: 'Faisal Mosque, Islamabad', wiki: 'Faisal Mosque', tags: ['Iconic', 'Landmark'], hours: 'Open for Prayers', price: 'Free', durationHours: 1.5 },
    { id: 3, name: 'Attabad Lake', wiki: 'Attabad Lake', tags: ['Nature', 'Boating'], hours: 'Sunrise - Sunset', price: 'Rs. 500', durationHours: 3 }
];

const RESTAURANTS = [
    { id: 1, name: 'Monal Islamabad', cuisine: 'Traditional/Continental', priceRange: '$$$' },
    { id: 2, name: 'Kolachi Karachi', cuisine: 'Seafood/BBQ', priceRange: '$$$' },
    { id: 3, name: 'Butt Karahi Lahore', cuisine: 'Traditional', priceRange: '$$' }
];

// Deterministic "simulated" weather so different locations show different,
// stable results instead of a single hard-coded city.
const CONDITIONS = ['Sunny', 'Partly Cloudy', 'Cloudy', 'Rainy', 'Snow'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const hash = (str) => {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
};

export const tourismAPI = {
    getScenicViews: async () => SCENIC_VIEWS,
    getScenicDetail: async (id) => SCENIC_VIEWS.find(v => v.id === Number(id)) || null,
    getHotels: async () => HOTELS,
    getAttractions: async () => ATTRACTIONS,
    getRestaurants: async () => RESTAURANTS,
    getWeatherData: async (location) => {
        const loc = location || 'Skardu';
        const seed = hash(loc.toLowerCase());
        const baseTemp = 4 + (seed % 28); // 4°C – 31°C, stable per location
        const condition = CONDITIONS[seed % CONDITIONS.length];
        const startDay = new Date().getDay();
        const forecast = Array.from({ length: 3 }, (_, i) => {
            const d = hash(loc + i);
            return {
                day: DAYS[(startDay + i + 1) % 7],
                temp: 2 + (d % 30),
                condition: CONDITIONS[d % CONDITIONS.length]
            };
        });
        return {
            location: loc,
            temp: baseTemp,
            condition,
            humidity: 30 + (seed % 60),
            windSpeed: 5 + (seed % 35),
            forecast
        };
    }
};
