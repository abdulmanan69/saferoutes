import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

const Profile = () => {
    const { user, profile: authProfile, refreshProfile } = useAuth();
    const toast = useToast();
    const [form, setForm] = useState({
        full_name: '', email: '', phone: '',
        vehicle: '', plate: '', emergency_contact: '', emergency_phone: '',
        user_type: 'customer'
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (authProfile) {
            setForm({
                full_name: authProfile.full_name || '',
                email: authProfile.email || user?.email || '',
                phone: authProfile.phone || '',
                vehicle: authProfile.vehicle || '',
                plate: authProfile.plate || '',
                emergency_contact: authProfile.emergency_contact || '',
                emergency_phone: authProfile.emergency_phone || '',
                user_type: authProfile.user_type || 'customer'
            });
        }
    }, [authProfile, user]);

    const handleSave = async () => {
        setSaving(true);
        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: form.full_name,
                phone: form.phone,
                vehicle: form.vehicle,
                plate: form.plate,
                emergency_contact: form.emergency_contact,
                emergency_phone: form.emergency_phone,
                user_type: form.user_type,
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);
        setSaving(false);
        if (error) {
            toast.error(error.message);
        } else {
            toast.success('Profile updated successfully!');
            refreshProfile();
        }
    };

    const field = (label, key, type = 'text', placeholder = '') => (
        <div className="form-group">
            <label>{label}</label>
            <input
                type={type}
                placeholder={placeholder || label}
                value={form[key]}
                onChange={e => setForm({ ...form, [key]: e.target.value })}
            />
        </div>
    );

    return (
        <div className="main">
            <div className="header">
                <h1>User Profile</h1>
                <p>Manage your professional driver profile and personal information</p>
            </div>

            {/* Profile header banner */}
            <div className="card fade-in" style={{ padding: '0', overflow: 'hidden', marginBottom: '30px' }}>
                <div style={{ height: '120px', background: 'linear-gradient(135deg, var(--primary), var(--accent))', position: 'relative' }}>
                    <div style={{
                        position: 'absolute', bottom: '-40px', left: '30px',
                        width: '80px', height: '80px', borderRadius: '50%',
                        background: 'var(--card)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '32px', color: '#2563eb', border: '4px solid white',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                    }}>
                        <i className="fas fa-user-tie"></i>
                    </div>
                </div>
                <div style={{ padding: '55px 30px 24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                            <h2 style={{ fontSize: '22px', margin: '0 0 4px', color: 'var(--dark)' }}>
                                {authProfile?.full_name || 'Your Name'}
                            </h2>
                            <p style={{ color: 'var(--muted)', margin: 0, fontSize: '14px' }}>
                                {authProfile?.role === 'admin' ? '⭐ Admin • ' : ''}{user?.email}
                            </p>
                        </div>
                        <div style={{
                            textAlign: 'center', background: 'var(--light)', padding: '12px 24px', borderRadius: '12px'
                        }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#10b981' }}>
                                {authProfile?.safety_score || 95}
                            </div>
                            <div style={{ fontSize: '11px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: '600' }}>
                                Safety Score
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid">
                {/* Personal details */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div className="card fade-in">
                        <div className="card-title">
                            <i className="fas fa-id-card"></i>
                            Personal Details
                        </div>
                        {field('Full Name', 'full_name', 'text', 'Your full name')}
                        {field('Email Address', 'email', 'email', 'you@example.com')}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Phone Number</label>
                            <input
                                type="tel"
                                placeholder="+92 300 1234567"
                                value={form.phone}
                                onChange={e => setForm({ ...form, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="card fade-in">
                        <div className="card-title">
                            <i className="fas fa-heartbeat"></i>
                            Emergency Contact
                        </div>
                        {field('Contact Name', 'emergency_contact', 'text', 'Emergency contact name')}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            {field('Contact Phone', 'emergency_phone', 'tel', '+92 300 1234567')}
                        </div>
                    </div>
                </div>

                {/* Vehicle info + account type */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    <div className="card fade-in">
                        <div className="card-title">
                            <i className="fas fa-id-badge"></i>
                            Account Type
                        </div>
                        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '-8px', marginBottom: '14px' }}>
                            Customers book rides; drivers accept requests and earn per ride.
                        </p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            {[
                                { key: 'customer', icon: 'fa-user', label: 'Customer', desc: 'Book rides & plan trips' },
                                { key: 'driver', icon: 'fa-id-card-clip', label: 'Driver', desc: 'Accept rides & earn' }
                            ].map(t => (
                                <button key={t.key}
                                    className={`check-item ${form.user_type === t.key ? 'done' : ''}`}
                                    style={{ flexDirection: 'column', textAlign: 'center', gap: '6px', padding: '16px 10px' }}
                                    onClick={() => setForm({ ...form, user_type: t.key })}>
                                    <i className={`fas ${t.icon}`} style={{ fontSize: '22px', color: form.user_type === t.key ? 'var(--success)' : 'var(--muted)' }}></i>
                                    <strong style={{ color: 'var(--dark)' }}>{t.label}</strong>
                                    <span style={{ fontSize: '11px', color: 'var(--muted)' }}>{t.desc}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="card fade-in">
                        <div className="card-title">
                            <i className="fas fa-car-side"></i>
                            Vehicle Information
                        </div>
                        {field('Default Vehicle', 'vehicle', 'text', 'e.g. Toyota Corolla Cross (AWD)')}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            {field('Plate Number', 'plate', 'text', 'e.g. ABC-1234')}
                        </div>
                    </div>
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '15px', marginTop: '30px' }}>
                <button
                    className="btn btn-secondary"
                    style={{ width: 'auto' }}
                    onClick={() => {
                        if (authProfile) {
                            setForm({
                                full_name: authProfile.full_name || '',
                                email: authProfile.email || user?.email || '',
                                phone: authProfile.phone || '',
                                vehicle: authProfile.vehicle || '',
                                plate: authProfile.plate || '',
                                emergency_contact: authProfile.emergency_contact || '',
                                emergency_phone: authProfile.emergency_phone || ''
                            });
                        }
                    }}
                >
                    Discard
                </button>
                <button
                    className="btn btn-primary"
                    style={{ width: 'auto', padding: '12px 32px' }}
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving
                        ? <><i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>Saving...</>
                        : <><i className="fas fa-save" style={{ marginRight: '8px' }}></i>Save Profile</>
                    }
                </button>
            </div>
        </div>
    );
};

export default Profile;
