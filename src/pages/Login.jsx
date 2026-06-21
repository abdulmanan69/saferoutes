import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setInfo('');
        setLoading(true);
        const { error: err } = await login(email, password);
        setLoading(false);
        if (err) setError(err.message);
        else navigate('/');
    };

    const handleReset = async () => {
        setError(''); setInfo('');
        if (!email) { setError('Enter your email above, then tap "Forgot password?".'); return; }
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/login'
        });
        if (err) setError(err.message);
        else setInfo(`Password reset link sent to ${email}.`);
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #15182a 0%, #241d3f 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px',
            fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }}>
            <div style={{
                background: 'var(--card)',
                borderRadius: '24px',
                padding: '50px 44px',
                width: '100%',
                maxWidth: '440px',
                boxShadow: '0 30px 80px rgba(0,0,0,0.25)'
            }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                    <div style={{
                        width: '72px', height: '72px',
                        borderRadius: '20px',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 18px',
                        fontSize: '34px', color: 'white',
                        boxShadow: '0 8px 24px rgba(37,99,235,0.35)'
                    }}>
                        <i className="fas fa-route"></i>
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--dark)', margin: '0 0 6px' }}>
                        SafeRoute
                    </h1>
                    <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
                        Sign in to continue your journey
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: '#fee2e2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444',
                        borderRadius: '10px', padding: '14px 16px', marginBottom: '20px',
                        display: 'flex', alignItems: 'center', gap: '10px',
                        color: '#7f1d1d', fontSize: '13px'
                    }}>
                        <i className="fas fa-exclamation-circle" style={{ color: '#ef4444' }}></i>
                        <span>{error}</span>
                    </div>
                )}
                {info && (
                    <div style={{
                        background: '#d1fae5', border: '1px solid #a7f3d0', borderLeft: '4px solid #10b981',
                        borderRadius: '10px', padding: '14px 16px', marginBottom: '20px',
                        display: 'flex', alignItems: 'center', gap: '10px', color: '#065f46', fontSize: '13px'
                    }}>
                        <i className="fas fa-check-circle" style={{ color: '#10b981' }}></i>
                        <span>{info}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '18px' }}>
                        <label style={{
                            display: 'block', fontSize: '12px', fontWeight: '600',
                            color: 'var(--text)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>Email Address</label>
                        <input
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                            style={{
                                width: '100%', padding: '13px 16px',
                                border: '2px solid var(--border)', borderRadius: '10px',
                                fontSize: '14px', fontFamily: 'inherit',
                                outline: 'none', transition: 'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                        <label style={{
                            display: 'block', fontSize: '12px', fontWeight: '600',
                            color: 'var(--text)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px'
                        }}>Password</label>
                        <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                            style={{
                                width: '100%', padding: '13px 16px',
                                border: '2px solid var(--border)', borderRadius: '10px',
                                fontSize: '14px', fontFamily: 'inherit',
                                outline: 'none', transition: 'border-color 0.2s'
                            }}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'}
                        />
                    </div>

                    <div style={{ textAlign: 'right', marginBottom: '24px' }}>
                        <span onClick={handleReset} style={{ fontSize: '13px', color: 'var(--primary)', cursor: 'pointer', fontWeight: '500' }}>
                            Forgot password?
                        </span>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '14px',
                            background: loading ? '#5b5086' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                            color: 'white', border: 'none', borderRadius: '10px',
                            fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s', letterSpacing: '0.3px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                        }}
                    >
                        {loading ? (
                            <><i className="fas fa-spinner fa-spin"></i> Signing in...</>
                        ) : (
                            <><i className="fas fa-sign-in-alt"></i> Sign In</>
                        )}
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '14px', color: 'var(--muted)' }}>
                    Don't have an account?{' '}
                    <Link to="/register" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                        Create one free
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
