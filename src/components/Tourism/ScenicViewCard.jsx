import React from 'react';
import { Link } from 'react-router-dom';
import PlaceImage from '../PlaceImage/PlaceImage';

const ScenicViewCard = ({ view, onAdd }) => {
    return (
        <div className="card fade-in" style={{ padding: '0', overflow: 'hidden' }}>
            <PlaceImage query={view.wiki || view.name} seed={`scenic${view.id}`} alt={view.name} style={{ width: '100%', height: '180px', display: 'block' }} />
            <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '18px', color: 'var(--dark)' }}>{view.name}</h3>
                    <div className="route-badge badge-safe">
                        <i className="fas fa-star" style={{ color: '#f59e0b', marginRight: '4px' }}></i>
                        {view.rating}
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '15px', fontSize: '13px', color: 'var(--muted)', marginBottom: '15px' }}>
                    <span><i className="fas fa-camera" style={{ marginRight: '6px' }}></i>{view.photos} photos</span>
                    <span><i className="fas fa-clock" style={{ marginRight: '6px' }}></i>Best: {view.bestTime}</span>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" style={{ flex: 1, padding: '10px' }} onClick={onAdd}>
                        <i className="fas fa-plus" style={{ marginRight: '8px' }}></i>Add to Itinerary
                    </button>
                    <Link to={`/tourism/scenic/${view.id}`} className="btn btn-secondary" style={{ padding: '10px 14px', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
                        Details
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ScenicViewCard;
