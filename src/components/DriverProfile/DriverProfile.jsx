import React from 'react';

const DriverProfile = ({ name = 'Driver', level = 'Conservative Driver', safetyScore = 95, trips = 0 }) => {
    return (
        <div className="card fade-in">
            <div className="card-title">
                <i className="fas fa-user-check"></i>
                Driver Profile
            </div>
            <div className="driver-profile">
                <div className="avatar">
                    <i className="fas fa-user"></i>
                </div>
                <div className="driver-name">{name}</div>
                <div className="driver-level">{level}</div>
            </div>
            <div className="stats-grid">
                <div className="stat-box">
                    <div className="stat-value">{safetyScore}</div>
                    <div className="stat-label">Safety Score</div>
                </div>
                <div className="stat-box">
                    <div className="stat-value">{trips}</div>
                    <div className="stat-label">Trips</div>
                </div>
            </div>
        </div>
    );
};

export default DriverProfile;
