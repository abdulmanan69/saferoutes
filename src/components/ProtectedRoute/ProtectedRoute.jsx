import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const LoadingScreen = () => (
    <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #15182a 0%, #241d3f 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: '20px'
    }}>
        <div style={{
            width: '72px', height: '72px', borderRadius: '20px',
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '34px', color: 'white'
        }}>
            <i className="fas fa-route"></i>
        </div>
        <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'white' }}>SafeRoute</div>
        <i className="fas fa-spinner fa-spin" style={{ fontSize: '22px', color: 'rgba(255,255,255,0.75)' }}></i>
    </div>
);

const ProtectedRoute = () => {
    const { user, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    return user ? <Outlet /> : <Navigate to="/login" replace />;
};

export const AdminRoute = () => {
    const { user, profile, loading } = useAuth();
    if (loading) return <LoadingScreen />;
    if (!user) return <Navigate to="/login" replace />;
    if (!profile) return <LoadingScreen />;
    if (profile.role !== 'admin') return <Navigate to="/" replace />;
    return <Outlet />;
};

export default ProtectedRoute;
