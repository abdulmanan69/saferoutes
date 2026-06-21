import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => (
    <div className="main" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="card fade-in" style={{ textAlign: 'center', padding: '60px 40px', maxWidth: '440px' }}>
            <div style={{
                width: '80px', height: '80px', borderRadius: '20px', margin: '0 auto 20px',
                background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '36px'
            }}>
                <i className="fas fa-map-signs"></i>
            </div>
            <h1 style={{ fontSize: '64px', fontWeight: 800, color: 'var(--dark)', margin: 0 }}>404</h1>
            <p style={{ fontSize: '18px', fontWeight: 600, color: 'var(--dark)', marginBottom: '8px' }}>You took a wrong turn</p>
            <p style={{ color: 'var(--muted)', fontSize: '14px', marginBottom: '24px' }}>
                This route doesn't exist on the map. Let's get you back on track.
            </p>
            <Link to="/" className="btn btn-primary" style={{ width: 'auto', textDecoration: 'none', display: 'inline-block' }}>
                <i className="fas fa-house" style={{ marginRight: '8px' }}></i>Back to Dashboard
            </Link>
        </div>
    </div>
);

export default NotFound;
