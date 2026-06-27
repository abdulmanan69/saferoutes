import React from 'react';
import PlaceImage from '../PlaceImage/PlaceImage';

const HotelCard = ({ hotel, onBook }) => {
    return (
        <div className="card fade-in" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ position: 'relative' }}>
                <PlaceImage query={hotel.wiki || hotel.name} seed={`hotel${hotel.id}`} alt={hotel.name} style={{ width: '100%', height: '180px', display: 'block' }} />
                <div style={{ position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--card)' }}></div>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }}></div>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }}></div>
                </div>
            </div>
            <div style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ fontSize: '18px', color: 'var(--dark)' }}>{hotel.name}</h3>
                    <span style={{ fontWeight: 'bold', color: 'var(--primary)', fontSize: '18px' }}>{hotel.price}</span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '15px' }}>
                    {hotel.amenities.map(a => (
                        <span key={a} style={{ fontSize: '11px', background: 'var(--light)', padding: '4px 8px', borderRadius: '4px', color: 'var(--muted)' }}>
                            {a}
                        </span>
                    ))}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
                    <i className="fas fa-bed" style={{ marginRight: '6px' }}></i>
                    {hotel.rooms.join(', ')}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" style={{ flex: '1', padding: '10px' }} onClick={onBook}>Book Now</button>
                </div>
            </div>
        </div>
    );
};

export default HotelCard;
