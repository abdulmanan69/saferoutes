import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { RideLiveProvider } from './context/RideLiveContext';
import ProtectedRoute, { AdminRoute } from './components/ProtectedRoute/ProtectedRoute';
import Sidebar from './components/Sidebar/Sidebar';
import Topbar from './components/Topbar/Topbar';
import InstallPrompt from './components/InstallPrompt/InstallPrompt';

import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewTrip from './pages/NewTrip';
import Journey from './pages/Journey';
import Outfit from './pages/Outfit';
import Rides from './pages/Rides';
import History from './pages/History';
import Tourism from './pages/Tourism';
import ScenicRouteDetail from './pages/ScenicRouteDetail';
import Statistics from './pages/Statistics';
import RiskAnalysis from './pages/RiskAnalysis';
import Analytics from './pages/Analytics';
import Profile from './pages/Profile';
import Account from './pages/Account';
import Settings from './pages/Settings';
import Subscription from './pages/Subscription';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';

import './styles/index.css';

const Layout = () => {
    const [collapsed, setCollapsed] = useState(false);   // desktop: icon rail
    const [mobileOpen, setMobileOpen] = useState(false); // mobile: drawer

    const toggleMenu = () => {
        if (window.innerWidth <= 768) setMobileOpen(o => !o);
        else setCollapsed(c => !c);
    };

    return (
        <div className="container">
            <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />
            {mobileOpen && <div className="sidebar-backdrop" onClick={() => setMobileOpen(false)} />}
            <div className="content">
                <Topbar onMenu={toggleMenu} />
                <Outlet />
            </div>
            <InstallPrompt />
        </div>
    );
};

function App() {
    return (
        <BrowserRouter>
            <ThemeProvider>
                <AuthProvider>
                    <ToastProvider>
                        <RideLiveProvider>
                        <Routes>
                    {/* Public routes */}
                    <Route path="/login" element={<Login />} />
                    <Route path="/register" element={<Register />} />

                    {/* Protected routes */}
                    <Route element={<ProtectedRoute />}>
                        <Route element={<Layout />}>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/new-trip" element={<NewTrip />} />
                            <Route path="/journey" element={<Journey />} />
                            <Route path="/outfit" element={<Outfit />} />
                            <Route path="/rides" element={<Rides />} />
                            <Route path="/history" element={<History />} />
                            <Route path="/tourism" element={<Tourism />} />
                            <Route path="/tourism/scenic/:id" element={<ScenicRouteDetail />} />
                            <Route path="/statistics" element={<Statistics />} />
                            <Route path="/risk-analysis" element={<RiskAnalysis />} />
                            <Route path="/analytics" element={<Analytics />} />
                            <Route path="/profile" element={<Profile />} />
                            <Route path="/account" element={<Account />} />
                            <Route path="/subscription" element={<Subscription />} />
                            <Route path="/settings" element={<Settings />} />

                            {/* Admin-only routes */}
                            <Route element={<AdminRoute />}>
                                <Route path="/admin" element={<Admin />} />
                            </Route>

                            {/* Catch-all 404 */}
                            <Route path="*" element={<NotFound />} />
                        </Route>
                    </Route>
                        </Routes>
                        </RideLiveProvider>
                    </ToastProvider>
                </AuthProvider>
            </ThemeProvider>
        </BrowserRouter>
    );
}

export default App;
