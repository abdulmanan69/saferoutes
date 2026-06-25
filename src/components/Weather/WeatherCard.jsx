import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { getWeather, outfitAdvice } from '../../utils/weather';

const WeatherCard = ({ location }) => {
    const [weather, setWeather] = useState(null);

    useEffect(() => {
        let active = true;
        setWeather(null);
        getWeather(location).then(d => { if (active) setWeather(d); });
        return () => { active = false; };
    }, [location]);

    if (!weather) return (
        <div className="card fade-in">
            <div className="card-title"><i className="fas fa-temperature-half"></i>Regional Weather</div>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                <div className="skeleton" style={{ width: '60px', height: '60px', borderRadius: '12px' }} />
                <div style={{ flex: 1 }}>
                    <div className="skeleton" style={{ height: '28px', width: '60%', marginBottom: '8px' }} />
                    <div className="skeleton" style={{ height: '14px', width: '40%' }} />
                </div>
            </div>
        </div>
    );

    const cond = weather.condition.toLowerCase();
    const isSnow = cond.includes('snow');
    const isRain = cond.includes('rain') || cond.includes('shower') || cond.includes('storm');

    return (
        <div className="card fade-in">
            <div className="card-title" style={{ justifyContent: 'space-between' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <i className="fas fa-temperature-half"></i>
                    Weather · {weather.location}
                </span>
                <span className={`route-badge ${weather.live ? 'badge-safe' : 'badge-moderate'}`} style={{ fontSize: '10px' }}>
                    {weather.live ? 'LIVE' : 'EST.'}
                </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                    <i className={`fas ${weather.icon || 'fa-cloud'}`} style={{ fontSize: '48px', color: 'var(--primary)' }}></i>
                    <div>
                        <div style={{ fontSize: '32px', fontWeight: 'bold', color: 'var(--dark)' }}>{weather.temp}°C</div>
                        <div style={{ color: 'var(--muted)' }}>{weather.condition}</div>
                    </div>
                </div>
                <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--muted)' }}>
                    <div><i className="fas fa-droplet" style={{ marginRight: '6px' }}></i>{weather.humidity}%</div>
                    <div><i className="fas fa-wind" style={{ marginRight: '6px' }}></i>{weather.windSpeed} km/h</div>
                </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '15px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-around' }}>
                    {weather.forecast.map((day, i) => (
                        <div key={i} style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '4px' }}>{day.day}</div>
                            <i className={`fas ${day.icon || 'fa-cloud'}`} style={{ color: 'var(--accent)', marginBottom: '4px' }}></i>
                            <div style={{ fontWeight: 'bold', color: 'var(--dark)' }}>{day.temp}°</div>
                        </div>
                    ))}
                </div>
            </div>

            {isSnow && (
                <div className="alert alert-danger" style={{ marginTop: '15px', marginBottom: 0 }}>
                    <i className="fas fa-snowflake"></i><span>Snow conditions — carry tire chains.</span>
                </div>
            )}
            {isRain && !isSnow && (
                <div className="alert alert-warning" style={{ marginTop: '15px', marginBottom: 0 }}>
                    <i className="fas fa-cloud-rain"></i><span>Wet roads expected — reduce speed.</span>
                </div>
            )}

            {/* What to wear — derived from live conditions */}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: '15px', paddingTop: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--muted)' }}>
                        <i className="fas fa-shirt" style={{ marginRight: '6px', color: 'var(--accent)' }}></i>What to wear
                    </span>
                    <Link to="/outfit" style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none' }}>
                        Smart Outfit →
                    </Link>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {outfitAdvice(weather).map((t, i) => (
                        <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '13px', color: 'var(--text)', alignItems: 'flex-start' }}>
                            <i className={`fas ${t.icon}`} style={{ color: 'var(--accent)', width: '18px', marginTop: '2px' }}></i>
                            {t.text}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default WeatherCard;
