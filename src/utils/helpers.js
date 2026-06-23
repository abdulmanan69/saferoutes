// Helper functions for common transformations
export const formatDate = (date) => new Date(date).toLocaleDateString();

export const calculateRiskLevel = (score) => {
    if (score < 20) return 'Low';
    if (score < 45) return 'Medium';
    return 'High';
};

export const riskColor = (level) => {
    if (level === 'Low') return '#10b981';
    if (level === 'Medium') return '#f59e0b';
    return '#ef4444';
};

// Aggregate a list of trip rows into the numbers used across the app.
export const summarizeTrips = (trips = []) => {
    const totalTrips = trips.length;
    const totalDist = Math.round(trips.reduce((s, t) => s + (t.distance_km || 0), 0));
    const totalHours = Math.round(trips.reduce((s, t) => s + (t.duration_hours || 0), 0));
    const avgRisk = totalTrips
        ? Math.round(trips.reduce((s, t) => s + (t.risk_score || 0), 0) / totalTrips)
        : 0;
    const lowRisk = trips.filter(t => t.risk_level === 'Low').length;
    const medRisk = trips.filter(t => t.risk_level === 'Medium').length;
    const highRisk = trips.filter(t => t.risk_level === 'High').length;
    const cities = new Set([
        ...trips.map(t => t.start_location),
        ...trips.map(t => t.destination)
    ].filter(Boolean));
    return { totalTrips, totalDist, totalHours, avgRisk, lowRisk, medRisk, highRisk, cities: cities.size };
};

// Group trips into the last `count` calendar months for charting.
export const tripsByMonth = (trips = [], count = 6) => {
    const now = new Date();
    const buckets = [];
    for (let i = count - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        buckets.push({
            key: `${d.getFullYear()}-${d.getMonth()}`,
            label: d.toLocaleString('default', { month: 'short' }),
            trips: 0,
            distance: 0,
            riskSum: 0
        });
    }
    const index = Object.fromEntries(buckets.map((b, i) => [b.key, i]));
    trips.forEach(t => {
        const d = new Date(t.created_at);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        if (key in index) {
            const b = buckets[index[key]];
            b.trips += 1;
            b.distance += t.distance_km || 0;
            b.riskSum += t.risk_score || 0;
        }
    });
    return buckets.map(b => ({
        ...b,
        avgRisk: b.trips ? Math.round(b.riskSum / b.trips) : 0
    }));
};

// A 0–100 "efficiency" score: lower average risk = higher score.
export const efficiencyScore = (trips = []) => {
    if (!trips.length) return 0;
    const avgRisk = trips.reduce((s, t) => s + (t.risk_score || 0), 0) / trips.length;
    return Math.max(0, Math.min(100, Math.round(100 - avgRisk * 0.9)));
};
