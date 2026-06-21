import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Sidebar = ({ collapsed = false, mobileOpen = false, onClose = () => {} }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { profile, logout } = useAuth();

    const active = (path) =>
        location.pathname === path ? 'active' : '';

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Close the mobile drawer whenever a nav link is tapped.
    const handleNavClick = (e) => {
        if (e.target.closest('a') || e.target.closest('.nav-item')) onClose();
    };

    return (
        <div
            className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'open' : ''}`}
            onClick={handleNavClick}
        >
            <div className="logo">
                <i className="fas fa-route"></i>
                <span>SafeRoute</span>
            </div>

            {/* User info */}
            {profile && (
                <div className="sidebar-user" style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '14px 15px', marginBottom: '20px',
                    background: 'rgba(255,255,255,0.08)', borderRadius: '10px'
                }}>
                    <div style={{
                        width: '38px', height: '38px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontSize: '16px', flexShrink: 0
                    }}>
                        <i className="fas fa-user"></i>
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: '600', fontSize: '13px', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {profile.full_name || 'Driver'}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--muted)' }}>
                            {profile.role === 'admin' ? '⭐ Admin' : 'Driver'}
                        </div>
                    </div>
                </div>
            )}

            <div className="nav-section">
                <div className="nav-title">Main</div>
                <Link to="/" className={`nav-item ${active('/')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-home"></i><span>Dashboard</span>
                </Link>
                <Link to="/new-trip" className={`nav-item ${active('/new-trip')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-map"></i><span>New Trip</span>
                </Link>
                <Link to="/journey" className={`nav-item ${active('/journey')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-satellite-dish"></i><span>Start Journey</span>
                </Link>
                <Link to="/rides" className={`nav-item ${active('/rides')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-taxi"></i><span>{profile?.user_type === 'driver' ? 'Driver Hub' : 'Book a Ride'}</span>
                </Link>
                <Link to="/history" className={`nav-item ${active('/history')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-history"></i><span>History</span>
                </Link>
                <Link to="/tourism" className={`nav-item ${active('/tourism')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-umbrella-beach"></i><span>Tourism Hub</span>
                </Link>
                <Link to="/outfit" className={`nav-item ${active('/outfit')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-shirt"></i><span>Smart Outfit</span>
                </Link>
            </div>

            <div className="nav-section">
                <div className="nav-title">Analytics</div>
                <Link to="/statistics" className={`nav-item ${active('/statistics')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-chart-line"></i><span>Statistics</span>
                </Link>
                <Link to="/risk-analysis" className={`nav-item ${active('/risk-analysis')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-exclamation-circle"></i><span>Risk Analysis</span>
                </Link>
                <Link to="/analytics" className={`nav-item ${active('/analytics')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-chart-bar"></i><span>Analytics</span>
                </Link>
            </div>

            <div className="nav-section">
                <div className="nav-title">Account</div>
                <Link to="/profile" className={`nav-item ${active('/profile')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-user"></i><span>Profile</span>
                </Link>
                <Link to="/account" className={`nav-item ${active('/account')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-id-badge"></i><span>My Account</span>
                </Link>
                <Link to="/subscription" className={`nav-item ${active('/subscription')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-crown"></i><span>Subscription</span>
                </Link>
                <Link to="/settings" className={`nav-item ${active('/settings')}`} style={{ textDecoration: 'none' }}>
                    <i className="fas fa-cog"></i><span>Settings</span>
                </Link>
                {profile?.role === 'admin' && (
                    <Link to="/admin" className={`nav-item ${active('/admin')}`} style={{ textDecoration: 'none' }}>
                        <i className="fas fa-shield-alt"></i><span>Admin Panel</span>
                    </Link>
                )}
                <div
                    className="nav-item"
                    onClick={handleLogout}
                    style={{ cursor: 'pointer', marginTop: '8px', color: '#ef4444' }}
                >
                    <i className="fas fa-sign-out-alt" style={{ color: '#ef4444' }}></i>
                    <span>Logout</span>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
