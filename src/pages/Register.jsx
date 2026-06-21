import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Register = () => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [loading, setLoading] = useState(false);
    const { register } = useAuth();
    const navigate = useNavigate();

    const inputStyle = {
        width: '100%', padding: '13px 16px',
        border: '2px solid var(--border)', borderRadius: '10px',
        fontSize: '14px', fontFamily: 'inherit',
        outline: 'none', transition: 'border-color 0.2s'
    };

    const labelStyle = {
        display: 'block', fontSize: '12px', fontWeight: '600',
        color: 'var(--text)', marginBottom: '8px',
        textTransform: 'uppercase', letterSpacing: '0.5px'
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(''); setSuccess('');
        if (password !== confirm) return setError('Passwords do not match.');
        if (password.length < 6) return setError('Password must be at least 6 characters.');
        setLoading(true);
        const { data, error: err } = await register(email, password, fullName);
        setLoading(false);
        if (err) {
            setError(err.message);
        } else if (data?.session) {
            navigate('/');
        } else {
            setSuccess('Account created! Check your email to confirm, then sign in.');
        }
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #15182a 0%, #241d3f 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
        }}>
            <div style={{
                background: 'var(--card)', borderRadius: '24px', padding: '50px 44px',
                width: '100%', maxWidth: '440px', boxShadow: '0 30px 80px rgba(0,0,0,0.25)'
            }}>
                <div style={{ textAlign: 'center', marginBottom: '36px' }}>
                    <div style={{
                        width: '72px', height: '72px', borderRadius: '20px',
                        background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 18px', fontSize: '34px', color: 'white',
                        boxShadow: '0 8px 24px rgba(37,99,235,0.35)'
                    }}>
                        <i className="fas fa-route"></i>
                    </div>
                    <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--dark)', margin: '0 0 6px' }}>
                        Join SafeRoute
                    </h1>
                    <p style={{ color: 'var(--muted)', fontSize: '14px', margin: 0 }}>
                        Create your driver profile
                    </p>
                </div>

                {error && (
                    <div style={{
                        background: '#fee2e2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444',
                        borderRadius: '10px', padding: '14px 16px', marginBottom: '20px',
                        display: 'flex', alignItems: 'center', gap: '10px', color: '#7f1d1d', fontSize: '13px'
                    }}>
                        <i className="fas fa-exclamation-circle" style={{ color: '#ef4444' }}></i>
                        <span>{error}</span>
                    </div>
                )}
                {success && (
                    <div style={{
                        background: '#d1fae5', border: '1px solid #a7f3d0', borderLeft: '4px solid #10b981',
                        borderRadius: '10px', padding: '14px 16px', marginBottom: '20px',
                        display: 'flex', alignItems: 'center', gap: '10px', color: '#065f46', fontSize: '13px'
                    }}>
                        <i className="fas fa-check-circle" style={{ color: '#10b981' }}></i>
                        <span>{success}</span>
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>Full Name</label>
                        <input type="text" placeholder="Muhammad Hammad" value={fullName}
                            onChange={e => setFullName(e.target.value)} required style={inputStyle}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>Email Address</label>
                        <input type="email" placeholder="you@example.com" value={email}
                            onChange={e => setEmail(e.target.value)} required style={inputStyle}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                    </div>
                    <div style={{ marginBottom: '16px' }}>
                        <label style={labelStyle}>Password</label>
                        <input type="password" placeholder="Min 6 characters" value={password}
                            onChange={e => setPassword(e.target.value)} required style={inputStyle}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                    </div>
                    <div style={{ marginBottom: '24px' }}>
                        <label style={labelStyle}>Confirm Password</label>
                        <input type="password" placeholder="Repeat password" value={confirm}
                            onChange={e => setConfirm(e.target.value)} required style={inputStyle}
                            onFocus={e => e.target.style.borderColor = 'var(--primary)'}
                            onBlur={e => e.target.style.borderColor = 'var(--border)'} />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '14px',
                            background: loading ? '#5b5086' : 'linear-gradient(135deg, var(--primary), var(--secondary))',
                            color: 'white', border: 'none', borderRadius: '10px',
                            fontSize: '15px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
                        }}
                    >
                        {loading
                            ? <><i className="fas fa-spinner fa-spin"></i> Creating account...</>
                            : <><i className="fas fa-user-plus"></i> Create Account</>
                        }
                    </button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '14px', color: 'var(--muted)' }}>
                    Already have an account?{' '}
                    <Link to="/login" style={{ color: 'var(--primary)', fontWeight: '600', textDecoration: 'none' }}>
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Register;
