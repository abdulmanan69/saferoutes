import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { tourismAPI } from '../utils/tourismAPI';
import PlaceImage from '../components/PlaceImage/PlaceImage';

const ScenicRouteDetail = () => {
    const { id } = useParams();
    const [view, setView] = useState(undefined); // undefined = loading, null = not found

    useEffect(() => {
        tourismAPI.getScenicDetail(id).then(setView);
    }, [id]);

    if (view === undefined) return (
        <div className="main">
            <div className="header"><h1>Scenic Route</h1></div>
            <div style={{ textAlign: 'center', padding: '60px', color: 'rgba(255,255,255,0.7)' }}>
                <i className="fas fa-spinner fa-spin" style={{ fontSize: '32px' }}></i>
            </div>
        </div>
    );

    if (view === null) return (
        <div className="main">
            <div className="header"><h1>Route Not Found</h1><p>We couldn't find that scenic route.</p></div>
            <div className="card fade-in" style={{ textAlign: 'center', padding: '50px 20px' }}>
                <i className="fas fa-map-location-dot" style={{ fontSize: '44px', color: 'var(--muted)', marginBottom: '16px' }}></i>
                <Link to="/tourism" className="btn btn-primary" style={{ width: 'auto', textDecoration: 'none', display: 'inline-block' }}>
                    Back to Tourism Hub
                </Link>
            </div>
        </div>
    );

    return (
        <div className="main">
            <div className="header">
                <h1>{view.name}</h1>
                <p>{view.summary}</p>
            </div>

            <div className="card fade-in" style={{ padding: '0', overflow: 'hidden', marginBottom: '30px' }}>
                <PlaceImage query={view.wiki || view.name} seed={`scenic${view.id}`} alt={view.name} style={{ width: '100%', height: '280px', display: 'block' }} />
            </div>

            <div className="grid">
                <div className="card fade-in">
                    <div className="card-title"><i className="fas fa-circle-info"></i>Route Overview</div>
                    <p style={{ color: 'var(--muted)', lineHeight: '1.7' }}>{view.description}</p>
                    <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                        <div className="stat-box">
                            <div className="stat-value">{view.lengthKm.toLocaleString()} km</div>
                            <div className="stat-label">Total Length</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-value">{view.maxElevationFt.toLocaleString()} ft</div>
                            <div className="stat-label">Max Elevation</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-value"><i className="fas fa-star" style={{ color: '#f59e0b' }}></i> {view.rating}</div>
                            <div className="stat-label">Rating</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-value">{view.bestTime}</div>
                            <div className="stat-label">Best Time</div>
                        </div>
                    </div>
                </div>

                <div className="card fade-in">
                    <div className="card-title"><i className="fas fa-lightbulb"></i>Travel Tips</div>
                    <ul style={{ listStyle: 'none', padding: 0, color: 'var(--muted)', fontSize: '14px' }}>
                        {view.tips.map((tip, i) => (
                            <li key={i} style={{ marginBottom: '14px', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                <i className={`fas ${tip.icon}`} style={{ color: tip.color, marginTop: '3px' }}></i>
                                <span>{tip.text}</span>
                            </li>
                        ))}
                    </ul>
                    <Link to="/tourism" className="btn btn-secondary" style={{ width: 'auto', textDecoration: 'none', display: 'inline-block', marginTop: '10px' }}>
                        <i className="fas fa-arrow-left" style={{ marginRight: '8px' }}></i>Back to Tourism Hub
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ScenicRouteDetail;
