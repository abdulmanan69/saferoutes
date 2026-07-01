import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ConfirmDialog } from '../components/Modal/Modal';

export const PLANS = [
    {
        id: 'Free', price: 'Rs. 0', period: 'forever', color: 'var(--muted)', icon: 'fa-leaf',
        tagline: 'Get started with the essentials',
        features: ['Unlimited trip planning', 'Basic risk analysis', 'Trip history', 'Live weather', '1 saved driver profile']
    },
    {
        id: 'Pro', price: 'Rs. 1,499', period: 'per month', color: '#2563eb', icon: 'fa-rocket', popular: true,
        tagline: 'For frequent road-trippers',
        features: ['Everything in Free', 'Advanced analytics & charts', 'Route alternatives & comparison', 'Priority hazard alerts', 'CSV data export', 'Tourism itinerary planner']
    },
    {
        id: 'Fleet', price: 'Rs. 4,999', period: 'per month', color: '#8b5cf6', icon: 'fa-truck-fast',
        tagline: 'For teams & businesses',
        features: ['Everything in Pro', 'Up to 25 driver profiles', 'Team trip dashboard', 'Admin management tools', 'API access (coming soon)', 'Dedicated support']
    }
];

const Subscription = () => {
    const { user, profile, refreshProfile } = useAuth();
    const toast = useToast();
    const [target, setTarget] = useState(null);
    const [busy, setBusy] = useState(false);
    const current = profile?.plan || 'Free';

    const changePlan = async () => {
        setBusy(true);
        const { error } = await supabase.from('profiles')
            .update({ plan: target.id, updated_at: new Date().toISOString() })
            .eq('id', user.id);
        setBusy(false);
        if (error) { toast.error(error.message); setTarget(null); return; }
        await refreshProfile();
        toast.success(target.id === 'Free' ? 'Switched to the Free plan.' : `You're now on the ${target.id} plan! 🎉`);
        setTarget(null);
    };

    return (
        <div className="main">
            <div className="header">
                <h1>Subscription &amp; Billing</h1>
                <p>Choose the plan that fits your journey. Change or cancel anytime.</p>
            </div>

            <div className="card fade-in" style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div className="action-icon" style={{ background: 'rgba(37,99,235,0.12)', color: 'var(--primary)' }}>
                        <i className="fas fa-crown"></i>
                    </div>
                    <div>
                        <div style={{ fontSize: '12px', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 700 }}>Current Plan</div>
                        <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--dark)' }}>{current}</div>
                    </div>
                </div>
                <span className="route-badge badge-safe"><i className="fas fa-circle-check" style={{ marginRight: '6px' }}></i>Active</span>
            </div>

            <div className="plans-grid">
                {PLANS.map(p => {
                    const isCurrent = p.id === current;
                    return (
                        <div key={p.id} className={`plan-card ${p.popular ? 'popular' : ''} ${isCurrent ? 'current' : ''}`}>
                            {p.popular && <div className="plan-ribbon">Most Popular</div>}
                            <div className="plan-icon" style={{ background: `${p.color}18`, color: p.color }}>
                                <i className={`fas ${p.icon}`}></i>
                            </div>
                            <h3 className="plan-name">{p.id}</h3>
                            <p className="plan-tagline">{p.tagline}</p>
                            <div className="plan-price">
                                <span style={{ fontSize: '30px', fontWeight: 800, color: 'var(--dark)' }}>{p.price}</span>
                                <span style={{ fontSize: '13px', color: 'var(--muted)' }}> / {p.period}</span>
                            </div>
                            <ul className="plan-features">
                                {p.features.map(f => (
                                    <li key={f}><i className="fas fa-check" style={{ color: p.color }}></i>{f}</li>
                                ))}
                            </ul>
                            <button
                                className="btn btn-primary"
                                style={{ background: isCurrent ? 'var(--border)' : `linear-gradient(135deg, ${p.color}, ${p.color}cc)`, color: isCurrent ? 'var(--muted)' : 'white', cursor: isCurrent ? 'default' : 'pointer' }}
                                disabled={isCurrent}
                                onClick={() => setTarget(p)}
                            >
                                {isCurrent ? 'Current Plan' : p.id === 'Free' ? 'Downgrade' : `Upgrade to ${p.id}`}
                            </button>
                        </div>
                    );
                })}
            </div>

            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: '13px', marginTop: '24px' }}>
                <i className="fas fa-lock" style={{ marginRight: '6px' }}></i>
                Demo billing — no real payment is taken. Your plan is saved to your profile.
            </p>

            <ConfirmDialog
                open={!!target}
                onClose={() => setTarget(null)}
                onConfirm={changePlan}
                loading={busy}
                danger={false}
                title={target?.id === 'Free' ? 'Switch to Free?' : `Subscribe to ${target?.id}?`}
                message={target?.id === 'Free'
                    ? 'You will move to the Free plan and lose Pro/Fleet features.'
                    : `Confirm switching to the ${target?.id} plan (${target?.price} / ${target?.period}). This is a demo — no payment is charged.`}
                confirmLabel={target?.id === 'Free' ? 'Switch' : 'Confirm & Subscribe'}
            />
        </div>
    );
};

export default Subscription;
