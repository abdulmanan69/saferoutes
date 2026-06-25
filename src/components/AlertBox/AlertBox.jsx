import React, { useEffect, useState } from 'react';
import { getWeather } from '../../utils/weather';

// Live hazard/advisory panel built from real weather + the user's own trip risk.
const AlertBox = ({ location = 'Skardu', trips = [] }) => {
    const [weather, setWeather] = useState(null);

    useEffect(() => {
        let active = true;
        setWeather(null);
        getWeather(location).then(w => { if (active) setWeather(w); });
        return () => { active = false; };
    }, [location]);

    const alerts = [];
    if (weather) {
        const c = weather.condition.toLowerCase();
        if (c.includes('snow'))
            alerts.push({ type: 'danger', icon: 'fa-snowflake', title: 'Snow Alert', text: `Snowfall around ${weather.location}. Carry tire chains and drive slowly.` });
        else if (c.includes('rain') || c.includes('shower') || c.includes('storm'))
            alerts.push({ type: 'warning', icon: 'fa-cloud-rain', title: 'Wet Roads', text: `Rain near ${weather.location}. Increase your following distance.` });
        else if (c.includes('fog'))
            alerts.push({ type: 'warning', icon: 'fa-smog', title: 'Low Visibility', text: `Fog near ${weather.location}. Use low-beam headlights.` });
        else
            alerts.push({ type: 'success', icon: 'fa-sun', title: 'Clear Conditions', text: `Good driving weather around ${weather.location} (${weather.temp}°C).` });

        if (weather.windSpeed > 25)
            alerts.push({ type: 'warning', icon: 'fa-wind', title: 'High Winds', text: `Winds of ${weather.windSpeed} km/h near ${weather.location} — watch for crosswinds.` });
    }

    const high = trips.filter(t => t.risk_level === 'High').length;
    if (high)
        alerts.push({ type: 'danger', icon: 'fa-triangle-exclamation', title: 'High-Risk Trips', text: `${high} of your saved trips are high-risk. Review them in Risk Analysis.` });

    if (weather && alerts.length === 0)
        alerts.push({ type: 'success', icon: 'fa-circle-check', title: 'All Clear', text: 'No active hazards detected for your area.' });

    return (
        <div className="card fade-in">
            <div className="card-title">
                <i className="fas fa-triangle-exclamation"></i>
                Live Hazards &amp; Advisories {weather && <span className="route-badge badge-safe" style={{ fontSize: '10px', marginLeft: '6px' }}>{weather.live ? 'LIVE' : 'EST.'}</span>}
            </div>

            {!weather && [1, 2].map(i => <div key={i} className="skeleton" style={{ height: '54px', marginBottom: '12px' }} />)}

            {alerts.map((a, i) => (
                <div key={i} className={`alert alert-${a.type}`}>
                    <i className={`fas ${a.icon}`}></i>
                    <span><strong>{a.title}:</strong> {a.text}</span>
                </div>
            ))}
        </div>
    );
};

export default AlertBox;
