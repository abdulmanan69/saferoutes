import React from 'react';
import PlaceImage from '../PlaceImage/PlaceImage';

const AttractionCard = ({ attraction, onAdd }) => {
    return (
        <div className="card fade-in" style={{ padding: 0, overflow: 'hidden' }}>
            <PlaceImage query={attraction.wiki || attraction.name} seed={`attr${attraction.id}`} alt={attraction.name} style={{ width: '100%', height: '160px', display: 'block' }} />
            <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                {attraction.tags.map(tag => (
                    <span key={tag} className="route-badge badge-moderate" style={{ fontSize: '10px' }}>{tag}</span>
                ))}
            </div>
            <h3 style={{ fontSize: '18px', color: 'var(--dark)', marginBottom: '8px' }}>{attraction.name}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'var(--muted)', marginBottom: '15px' }}>
                <span><i className="fas fa-clock" style={{ width: '18px' }}></i>{attraction.hours}</span>
                <span><i className="fas fa-ticket-alt" style={{ width: '18px' }}></i>From {attraction.price}</span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
                <button className="btn btn-primary" style={{ flex: '1', padding: '10px' }} onClick={onAdd}>
                    <i className="fas fa-calendar-plus" style={{ marginRight: '8px' }}></i>Add to Trip
                </button>
                <a
                    href={`https://www.google.com/maps/search/${encodeURIComponent(attraction.name)}`}
                    target="_blank" rel="noopener noreferrer"
                    className="icon-btn" style={{ width: '40px', height: '40px', textDecoration: 'none' }}
                    title="View on map"
                >
                    <i className="fas fa-map-marker-alt"></i>
                </a>
            </div>
            </div>
        </div>
    );
};

export default AttractionCard;
