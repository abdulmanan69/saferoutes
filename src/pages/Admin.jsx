import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { summarizeTrips, tripsByMonth, riskColor } from '../utils/helpers';
import { downloadCSV } from '../utils/csv';
import { BarChart, DonutChart } from '../components/Charts/Charts';
import Modal, { ConfirmDialog } from '../components/Modal/Modal';

const PAGE = 8;

const Admin = () => {
    const { profile: me } = useAuth();
    const toast = useToast();
    const [users, setUsers] = useState([]);
    const [trips, setTrips] = useState([]);
    const [tab, setTab] = useState('overview');
    const [loading, setLoading] = useState(true);

    // user table controls
    const [uSearch, setUSearch] = useState('');
    const [uRole, setURole] = useState('All');
    const [uSort, setUSort] = useState({ key: 'created_at', dir: 'desc' });
    const [uPage, setUPage] = useState(1);

    // trip table controls
    const [tSearch, setTSearch] = useState('');
    const [tRisk, setTRisk] = useState('All');
    const [tSort, setTSort] = useState({ key: 'created_at', dir: 'desc' });
    const [tPage, setTPage] = useState(1);

    const [drill, setDrill] = useState(null);        // user being inspected
    const [confirm, setConfirm] = useState(null);     // { kind, id, label }
    const [busy, setBusy] = useState(false);
    const [editUser, setEditUser] = useState(null);   // user being edited
    const [editForm, setEditForm] = useState({});
    const [savingUser, setSavingUser] = useState(false);

    const [ann, setAnn] = useState([]);
    const [annForm, setAnnForm] = useState({ title: '', message: '', type: 'info' });
    const [annSaving, setAnnSaving] = useState(false);

    const loadData = async () => {
        setLoading(true);
        const [{ data: u }, { data: t }, { data: a }] = await Promise.all([
            supabase.from('profiles').select('*').order('created_at', { ascending: false }),
            supabase.from('trips').select('*').order('created_at', { ascending: false }),
            supabase.from('announcements').select('*').order('created_at', { ascending: false })
        ]);
        setUsers(u || []);
        setTrips(t || []);
        setAnn(a || []);
        setLoading(false);
    };
    useEffect(() => { loadData(); }, []);

    /* ---- Broadcast actions ---- */
    const publishAnn = async () => {
        if (!annForm.title.trim() || !annForm.message.trim()) return toast.warning('Add a title and a message.');
        setAnnSaving(true);
        const { data, error } = await supabase.from('announcements')
            .insert({ ...annForm, created_by: me?.id }).select().single();
        setAnnSaving(false);
        if (error) return toast.error(error.message);
        setAnn(prev => [data, ...prev]);
        setAnnForm({ title: '', message: '', type: 'info' });
        toast.success('Announcement published to all users.');
    };

    const toggleAnn = async (a) => {
        const { error } = await supabase.from('announcements').update({ active: !a.active }).eq('id', a.id);
        if (error) return toast.error(error.message);
        setAnn(prev => prev.map(x => x.id === a.id ? { ...x, active: !a.active } : x));
        toast.success(a.active ? 'Announcement hidden.' : 'Announcement is live.');
    };

    const deleteAnn = async (id) => {
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (error) return toast.error(error.message);
        setAnn(prev => prev.filter(x => x.id !== id));
        toast.success('Announcement deleted.');
    };

    /* ---- Revenue (demo billing: Pro Rs.1,499 / Fleet Rs.4,999 per month) ---- */
    const PRICES = { Free: 0, Pro: 1499, Fleet: 4999 };
    const planCount = (p) => users.filter(u => (u.plan || 'Free') === p).length;
    const mrr = planCount('Pro') * PRICES.Pro + planCount('Fleet') * PRICES.Fleet;
    const payingUsers = users.filter(u => (u.plan || 'Free') !== 'Free');

    const stats = summarizeTrips(trips);
    const [now] = useState(() => Date.now());
    const WEEK = 7 * 24 * 3600 * 1000;
    const newUsers = users.filter(u => u.created_at && now - new Date(u.created_at).getTime() < WEEK).length;
    const activeTrips = trips.filter(t => now - new Date(t.created_at).getTime() < WEEK).length;
    const adminCount = users.filter(u => u.role === 'admin').length;

    // --- charts ---
    const signupSeries = tripsByMonth(users, 6).map(m => ({ label: m.label, value: m.trips }));
    const tripSeries = tripsByMonth(trips, 6).map(m => ({ label: m.label, value: m.trips }));
    const riskSegments = [
        { label: 'Low', value: stats.lowRisk, color: '#10b981' },
        { label: 'Medium', value: stats.medRisk, color: '#f59e0b' },
        { label: 'High', value: stats.highRisk, color: '#ef4444' }
    ];
    const destCount = {};
    trips.forEach(t => { if (t.destination) destCount[t.destination] = (destCount[t.destination] || 0) + 1; });
    const topDest = Object.entries(destCount).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value }));

    // --- filtered/sorted/paged users ---
    const visUsers = useMemo(() => {
        let list = [...users];
        const q = uSearch.trim().toLowerCase();
        if (q) list = list.filter(u => [u.full_name, u.email, u.phone].filter(Boolean).join(' ').toLowerCase().includes(q));
        if (uRole !== 'All') list = list.filter(u => (u.role || 'user') === uRole.toLowerCase());
        list.sort((a, b) => {
            let av = a[uSort.key] || '', bv = b[uSort.key] || '';
            if (uSort.key === 'created_at') { av = new Date(a.created_at); bv = new Date(b.created_at); }
            return (av < bv ? -1 : av > bv ? 1 : 0) * (uSort.dir === 'asc' ? 1 : -1);
        });
        return list;
    }, [users, uSearch, uRole, uSort]);
    const uPages = Math.max(1, Math.ceil(visUsers.length / PAGE));
    const uSlice = visUsers.slice((uPage - 1) * PAGE, uPage * PAGE);

    // --- filtered/sorted/paged trips ---
    const visTrips = useMemo(() => {
        let list = [...trips];
        const q = tSearch.trim().toLowerCase();
        if (q) list = list.filter(t => [t.start_location, t.destination, t.route_name].filter(Boolean).join(' ').toLowerCase().includes(q));
        if (tRisk !== 'All') list = list.filter(t => t.risk_level === tRisk);
        list.sort((a, b) => {
            let av = a[tSort.key], bv = b[tSort.key];
            if (tSort.key === 'created_at') { av = new Date(av); bv = new Date(bv); }
            return (av < bv ? -1 : av > bv ? 1 : 0) * (tSort.dir === 'asc' ? 1 : -1);
        });
        return list;
    }, [trips, tSearch, tRisk, tSort]);
    const tPages = Math.max(1, Math.ceil(visTrips.length / PAGE));
    const tSlice = visTrips.slice((tPage - 1) * PAGE, tPage * PAGE);

    const sortIcon = (s, key) => s.key !== key ? 'fa-sort' : s.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down';

    // --- actions ---
    const toggleRole = async (u) => {
        const role = u.role === 'admin' ? 'user' : 'admin';
        const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id);
        if (error) return toast.error(error.message);
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, role } : x));
        toast.success(`${u.full_name || 'User'} is now ${role}.`);
    };

    const resetScore = async (u) => {
        const { error } = await supabase.from('profiles').update({ safety_score: 95 }).eq('id', u.id);
        if (error) return toast.error(error.message);
        setUsers(prev => prev.map(x => x.id === u.id ? { ...x, safety_score: 95 } : x));
        toast.success('Safety score reset to 95.');
    };

    const openEdit = (u) => {
        setEditUser(u);
        setEditForm({
            full_name: u.full_name || '', phone: u.phone || '', vehicle: u.vehicle || '',
            safety_score: u.safety_score ?? 95, role: u.role || 'user', plan: u.plan || 'Free'
        });
    };

    const saveUser = async () => {
        setSavingUser(true);
        const patch = {
            full_name: editForm.full_name,
            phone: editForm.phone,
            vehicle: editForm.vehicle,
            safety_score: Number(editForm.safety_score),
            role: editForm.role,
            plan: editForm.plan,
            updated_at: new Date().toISOString()
        };
        const { error } = await supabase.from('profiles').update(patch).eq('id', editUser.id);
        setSavingUser(false);
        if (error) return toast.error(error.message);
        setUsers(prev => prev.map(x => x.id === editUser.id ? { ...x, ...patch } : x));
        setEditUser(null);
        toast.success('User updated.');
    };

    const runConfirm = async () => {
        if (!confirm) return;
        setBusy(true);
        if (confirm.kind === 'trip') {
            const { error } = await supabase.from('trips').delete().eq('id', confirm.id);
            if (error) { setBusy(false); return toast.error(error.message); }
            setTrips(prev => prev.filter(t => t.id !== confirm.id));
            toast.success('Trip deleted.');
        } else if (confirm.kind === 'user') {
            await supabase.from('trips').delete().eq('user_id', confirm.id);
            await supabase.from('user_settings').delete().eq('user_id', confirm.id);
            const { error } = await supabase.from('profiles').delete().eq('id', confirm.id);
            if (error) { setBusy(false); return toast.error(error.message); }
            setUsers(prev => prev.filter(u => u.id !== confirm.id));
            setTrips(prev => prev.filter(t => t.user_id !== confirm.id));
            toast.success('User data deleted.');
        }
        setBusy(false);
        setConfirm(null);
    };

    const exportUsers = () => {
        downloadCSV(visUsers, `saferoute-users-${Date.now()}.csv`, [
            { key: 'full_name', label: 'Name' }, { key: 'email', label: 'Email' },
            { key: 'phone', label: 'Phone' }, { key: 'role', label: 'Role' },
            { key: 'safety_score', label: 'Safety Score' },
            { key: 'created_at', label: 'Joined', format: v => v ? new Date(v).toLocaleDateString() : '' }
        ]);
        toast.success(`Exported ${visUsers.length} user(s).`);
    };
    const exportTrips = () => {
        downloadCSV(visTrips, `saferoute-all-trips-${Date.now()}.csv`, [
            { key: 'start_location', label: 'Start' }, { key: 'destination', label: 'Destination' },
            { key: 'distance_km', label: 'Distance' }, { key: 'risk_level', label: 'Risk' },
            { key: 'risk_score', label: 'Score' }, { key: 'status', label: 'Status' },
            { key: 'created_at', label: 'Date', format: v => new Date(v).toLocaleDateString() }
        ]);
        toast.success(`Exported ${visTrips.length} trip(s).`);
    };

    const userTrips = (uid) => trips.filter(t => t.user_id === uid);

    if (loading) return (
        <div className="main">
            <div className="header"><h1><i className="fas fa-shield-alt" style={{ marginRight: '12px' }}></i>Admin Panel</h1></div>
            <div className="empty-state" style={{ color: 'white' }}><i className="fas fa-spinner fa-spin"></i><p>Loading admin data...</p></div>
        </div>
    );

    const TABS = [
        { key: 'overview', icon: 'fa-chart-pie', label: 'Overview' },
        { key: 'users', icon: 'fa-users', label: `Users (${users.length})` },
        { key: 'trips', icon: 'fa-route', label: `Trips (${trips.length})` },
        { key: 'analytics', icon: 'fa-chart-line', label: 'Analytics' },
        { key: 'revenue', icon: 'fa-coins', label: 'Revenue' },
        { key: 'broadcast', icon: 'fa-bullhorn', label: `Broadcast (${ann.filter(a => a.active).length})` }
    ];

    return (
        <div className="main">
            <div className="header">
                <h1><i className="fas fa-shield-alt" style={{ marginRight: '12px' }}></i>Admin Panel</h1>
                <p>Manage users, trips and monitor platform activity</p>
            </div>

            {/* KPIs */}
            <div className="kpi-row">
                {[
                    { label: 'Total Users', value: users.length, icon: 'fa-users', color: '#2563eb' },
                    { label: 'Admins', value: adminCount, icon: 'fa-user-shield', color: '#8b5cf6' },
                    { label: 'New (7d)', value: newUsers, icon: 'fa-user-plus', color: '#10b981' },
                    { label: 'Total Trips', value: trips.length, icon: 'fa-route', color: '#06b6d4' },
                    { label: 'Trips (7d)', value: activeTrips, icon: 'fa-bolt', color: '#f59e0b' },
                    { label: 'Total Distance', value: `${stats.totalDist} km`, icon: 'fa-road', color: '#0ea5e9' },
                    { label: 'Avg Risk', value: `${stats.avgRisk}%`, icon: 'fa-gauge-high', color: '#ef4444' },
                    { label: 'High-Risk', value: stats.highRisk, icon: 'fa-triangle-exclamation', color: '#dc2626' }
                ].map(k => (
                    <div key={k.label} className="stat-card fade-in" style={{ padding: '20px' }}>
                        <i className={`fas ${k.icon}`} style={{ fontSize: '22px', color: k.color, marginBottom: '8px' }}></i>
                        <div className="stat-value" style={{ color: k.color, fontSize: '24px' }}>{k.value}</div>
                        <div className="stat-label">{k.label}</div>
                    </div>
                ))}
            </div>

            {/* Tabs */}
            <div className="tabs">
                {TABS.map(t => (
                    <button key={t.key} className={`tab-btn ${tab === t.key ? 'active' : ''}`} onClick={() => setTab(t.key)}>
                        <i className={`fas ${t.icon}`} style={{ marginRight: '8px' }}></i>{t.label}
                    </button>
                ))}
                <button className="tab-btn" style={{ marginLeft: 'auto' }} onClick={loadData}>
                    <i className="fas fa-sync-alt" style={{ marginRight: '8px' }}></i>Refresh
                </button>
            </div>

            {/* OVERVIEW */}
            {tab === 'overview' && (
                <div className="grid">
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-user-clock"></i>Recent Signups</div>
                        {users.slice(0, 7).map(u => (
                            <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--light)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="tb-avatar" style={{ borderRadius: '50%' }}>{(u.full_name || 'U')[0].toUpperCase()}</div>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{u.full_name || 'Unnamed'}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{u.email}</div>
                                    </div>
                                </div>
                                <span className={`route-badge ${u.role === 'admin' ? 'badge-info' : 'badge-moderate'}`}>{u.role || 'user'}</span>
                            </div>
                        ))}
                    </div>
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-clock-rotate-left"></i>Recent Trips</div>
                        {trips.length === 0 && <div className="empty-state"><i className="fas fa-route"></i><p>No trips yet.</p></div>}
                        {trips.slice(0, 7).map(t => (
                            <div key={t.id} style={{ padding: '12px 0', borderBottom: '1px solid var(--light)' }}>
                                <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{t.start_location} → {t.destination}</div>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                    <span className="route-badge" style={{ background: `${riskColor(t.risk_level)}22`, color: riskColor(t.risk_level), fontSize: '10px' }}>{t.risk_level}</span>
                                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{t.distance_km} km • {new Date(t.created_at).toLocaleDateString()}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* USERS */}
            {tab === 'users' && (
                <div className="card fade-in">
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px' }}>
                        <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                            <input placeholder="Search users..." value={uSearch} onChange={e => { setUSearch(e.target.value); setUPage(1); }} />
                        </div>
                        {['All', 'Admin', 'User'].map(r => (
                            <button key={r} className={`chip ${uRole === r ? 'active' : ''}`} onClick={() => { setURole(r); setUPage(1); }}>{r}</button>
                        ))}
                        <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={exportUsers}><i className="fas fa-file-csv" style={{ marginRight: '8px' }}></i>CSV</button>
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th onClick={() => setUSort(s => ({ key: 'full_name', dir: s.key === 'full_name' && s.dir === 'asc' ? 'desc' : 'asc' }))}>User <i className={`fas ${sortIcon(uSort, 'full_name')}`}></i></th>
                                    <th>Phone</th>
                                    <th onClick={() => setUSort(s => ({ key: 'safety_score', dir: s.key === 'safety_score' && s.dir === 'asc' ? 'desc' : 'asc' }))}>Score <i className={`fas ${sortIcon(uSort, 'safety_score')}`}></i></th>
                                    <th>Trips</th>
                                    <th>Role</th>
                                    <th>Plan</th>
                                    <th onClick={() => setUSort(s => ({ key: 'created_at', dir: s.key === 'created_at' && s.dir === 'asc' ? 'desc' : 'asc' }))}>Joined <i className={`fas ${sortIcon(uSort, 'created_at')}`}></i></th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {uSlice.map(u => (
                                    <tr key={u.id} style={{ background: u.id === me?.id ? 'rgba(37,99,235,0.06)' : undefined }}>
                                        <td>
                                            <div style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--primary)' }} onClick={() => setDrill(u)}>{u.full_name || 'Unnamed'}</div>
                                            <div style={{ color: 'var(--muted)', fontSize: '12px' }}>{u.email}</div>
                                        </td>
                                        <td style={{ color: 'var(--muted)' }}>{u.phone || '—'}</td>
                                        <td><strong style={{ color: (u.safety_score ?? 95) >= 90 ? '#10b981' : '#f59e0b' }}>{u.safety_score ?? 95}</strong></td>
                                        <td style={{ color: 'var(--muted)' }}>{userTrips(u.id).length}</td>
                                        <td><span className={`route-badge ${u.role === 'admin' ? 'badge-info' : 'badge-moderate'}`}>{u.role || 'user'}</span></td>
                                        <td><span className="route-badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>{u.plan || 'Free'}</span></td>
                                        <td style={{ color: 'var(--muted)' }}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
                                        <td>
                                            {u.id !== me?.id ? (
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button className="icon-action" title="Inspect" onClick={() => setDrill(u)}><i className="fas fa-eye"></i></button>
                                                    <button className="icon-action" title="Edit user" onClick={() => openEdit(u)}><i className="fas fa-pen"></i></button>
                                                    <button className="icon-action" title={u.role === 'admin' ? 'Remove admin' : 'Make admin'} onClick={() => toggleRole(u)}><i className={`fas ${u.role === 'admin' ? 'fa-user-minus' : 'fa-user-shield'}`}></i></button>
                                                    <button className="icon-action" title="Reset score" onClick={() => resetScore(u)}><i className="fas fa-rotate-left"></i></button>
                                                    <button className="icon-action danger" title="Delete user data" onClick={() => setConfirm({ kind: 'user', id: u.id, label: u.full_name || u.email })}><i className="fas fa-trash"></i></button>
                                                </div>
                                            ) : <span style={{ fontSize: '12px', color: 'var(--muted)' }}>You</span>}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pager page={uPage} pages={uPages} onPage={setUPage} count={visUsers.length} />
                </div>
            )}

            {/* TRIPS */}
            {tab === 'trips' && (
                <div className="card fade-in">
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '18px' }}>
                        <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                            <input placeholder="Search trips..." value={tSearch} onChange={e => { setTSearch(e.target.value); setTPage(1); }} />
                        </div>
                        {['All', 'Low', 'Medium', 'High'].map(r => (
                            <button key={r} className={`chip ${tRisk === r ? 'active' : ''}`} onClick={() => { setTRisk(r); setTPage(1); }}>{r}</button>
                        ))}
                        <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={exportTrips}><i className="fas fa-file-csv" style={{ marginRight: '8px' }}></i>CSV</button>
                    </div>
                    {visTrips.length === 0 ? (
                        <div className="empty-state"><i className="fas fa-route"></i><p>No trips match.</p></div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Route</th>
                                        <th onClick={() => setTSort(s => ({ key: 'distance_km', dir: s.key === 'distance_km' && s.dir === 'asc' ? 'desc' : 'asc' }))}>Distance <i className={`fas ${sortIcon(tSort, 'distance_km')}`}></i></th>
                                        <th onClick={() => setTSort(s => ({ key: 'risk_score', dir: s.key === 'risk_score' && s.dir === 'asc' ? 'desc' : 'asc' }))}>Risk <i className={`fas ${sortIcon(tSort, 'risk_score')}`}></i></th>
                                        <th>Status</th>
                                        <th onClick={() => setTSort(s => ({ key: 'created_at', dir: s.key === 'created_at' && s.dir === 'asc' ? 'desc' : 'asc' }))}>Date <i className={`fas ${sortIcon(tSort, 'created_at')}`}></i></th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tSlice.map(t => (
                                        <tr key={t.id}>
                                            <td>
                                                <div style={{ fontWeight: 600 }}>{t.start_location} → {t.destination}</div>
                                                {t.route_name && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{t.route_name}</div>}
                                            </td>
                                            <td style={{ color: 'var(--muted)' }}>{t.distance_km ? `${t.distance_km} km` : '—'}</td>
                                            <td><span className="route-badge" style={{ background: `${riskColor(t.risk_level)}22`, color: riskColor(t.risk_level) }}>{t.risk_level} ({t.risk_score}%)</span></td>
                                            <td style={{ fontWeight: 600, fontSize: '13px' }}>{t.status}</td>
                                            <td style={{ color: 'var(--muted)' }}>{new Date(t.created_at).toLocaleDateString()}</td>
                                            <td><button className="icon-action danger" onClick={() => setConfirm({ kind: 'trip', id: t.id, label: `${t.start_location} → ${t.destination}` })}><i className="fas fa-trash"></i></button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <Pager page={tPage} pages={tPages} onPage={setTPage} count={visTrips.length} />
                </div>
            )}

            {/* ANALYTICS */}
            {tab === 'analytics' && (
                <>
                    <div className="grid">
                        <div className="card fade-in">
                            <div className="card-title"><i className="fas fa-user-plus"></i>User Signups (6 mo)</div>
                            <BarChart data={signupSeries} />
                        </div>
                        <div className="card fade-in">
                            <div className="card-title"><i className="fas fa-route"></i>Trips Created (6 mo)</div>
                            <BarChart data={tripSeries} />
                        </div>
                    </div>
                    <div className="grid">
                        <div className="card fade-in">
                            <div className="card-title"><i className="fas fa-chart-pie"></i>Platform Risk Distribution</div>
                            <DonutChart segments={riskSegments} centerTop={`${stats.avgRisk}%`} centerBottom="Avg Risk" />
                        </div>
                        <div className="card fade-in">
                            <div className="card-title"><i className="fas fa-location-dot"></i>Most Popular Destinations</div>
                            {topDest.length === 0 ? <div className="empty-state"><i className="fas fa-map"></i><p>No data.</p></div> : <BarChart data={topDest} height={180} />}
                        </div>
                    </div>
                </>
            )}

            {/* REVENUE */}
            {tab === 'revenue' && (
                <>
                    <div className="kpi-row">
                        {[
                            { label: 'Monthly Revenue (MRR)', value: `Rs. ${mrr.toLocaleString()}`, icon: 'fa-coins', color: '#10b981' },
                            { label: 'Annual Run-Rate', value: `Rs. ${(mrr * 12).toLocaleString()}`, icon: 'fa-chart-line', color: '#2563eb' },
                            { label: 'Paying Users', value: payingUsers.length, icon: 'fa-user-check', color: '#8b5cf6' },
                            { label: 'Conversion', value: users.length ? `${Math.round((payingUsers.length / users.length) * 100)}%` : '0%', icon: 'fa-percent', color: '#f59e0b' }
                        ].map(k => (
                            <div key={k.label} className="stat-card fade-in" style={{ padding: '22px' }}>
                                <i className={`fas ${k.icon}`} style={{ fontSize: '22px', color: k.color, marginBottom: '8px' }}></i>
                                <div className="stat-value" style={{ color: k.color, fontSize: '22px' }}>{k.value}</div>
                                <div className="stat-label">{k.label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="grid">
                        <div className="card fade-in">
                            <div className="card-title"><i className="fas fa-chart-pie"></i>Plan Distribution</div>
                            <DonutChart
                                segments={[
                                    { label: `Free (Rs. 0)`, value: planCount('Free'), color: 'var(--muted)' },
                                    { label: `Pro (Rs. ${PRICES.Pro.toLocaleString()})`, value: planCount('Pro'), color: '#2563eb' },
                                    { label: `Fleet (Rs. ${PRICES.Fleet.toLocaleString()})`, value: planCount('Fleet'), color: '#8b5cf6' }
                                ]}
                                centerTop={users.length} centerBottom="Users"
                            />
                            <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '14px' }}>
                                <i className="fas fa-circle-info" style={{ marginRight: '6px' }}></i>
                                Demo billing — revenue is computed from each user's saved plan, no real charges.
                            </p>
                        </div>
                        <div className="card fade-in">
                            <div className="card-title"><i className="fas fa-crown"></i>Subscribers</div>
                            {payingUsers.length === 0 && (
                                <div className="empty-state"><i className="fas fa-coins"></i><p>No paid subscribers yet.</p></div>
                            )}
                            {payingUsers.map(u => (
                                <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--light)' }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{u.full_name || 'Unnamed'}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{u.email}</div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <span className="route-badge" style={{ background: '#ede9fe', color: '#6d28d9' }}>{u.plan}</span>
                                        <div style={{ fontSize: '12px', color: '#10b981', fontWeight: 700, marginTop: '4px' }}>
                                            +Rs. {PRICES[u.plan]?.toLocaleString()}/mo
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* BROADCAST */}
            {tab === 'broadcast' && (
                <div className="grid">
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-bullhorn"></i>New Announcement</div>
                        <p style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '-8px', marginBottom: '16px' }}>
                            Published announcements appear on every user's Dashboard and in their notification bell.
                        </p>
                        <div className="form-group">
                            <label>Title</label>
                            <input value={annForm.title} placeholder="e.g. Landslide warning on KKH"
                                onChange={e => setAnnForm({ ...annForm, title: e.target.value })} />
                        </div>
                        <div className="form-group">
                            <label>Message</label>
                            <textarea rows={3} value={annForm.message} placeholder="Details every driver should know..."
                                onChange={e => setAnnForm({ ...annForm, message: e.target.value })}
                                style={{ width: '100%', padding: '12px 15px', border: '2px solid var(--border)', borderRadius: '10px', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical' }} />
                        </div>
                        <div className="form-group">
                            <label>Type</label>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                {[['info', 'fa-circle-info'], ['success', 'fa-circle-check'], ['warning', 'fa-triangle-exclamation'], ['danger', 'fa-circle-exclamation']].map(([t, ic]) => (
                                    <button key={t} className={`chip ${annForm.type === t ? 'active' : ''}`} onClick={() => setAnnForm({ ...annForm, type: t })}>
                                        <i className={`fas ${ic}`}></i>{t}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <button className="btn btn-primary" onClick={publishAnn} disabled={annSaving}>
                            {annSaving ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-paper-plane" style={{ marginRight: '8px' }}></i>Publish to All Users</>}
                        </button>
                    </div>
                    <div className="card fade-in">
                        <div className="card-title"><i className="fas fa-list"></i>Published ({ann.length})</div>
                        {ann.length === 0 && <div className="empty-state"><i className="fas fa-bullhorn"></i><p>Nothing published yet.</p></div>}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '480px', overflowY: 'auto' }}>
                            {ann.map(a => (
                                <div key={a.id} className={`alert alert-${a.type === 'info' ? 'success' : a.type}`} style={{ margin: 0, opacity: a.active ? 1 : 0.5, alignItems: 'flex-start' }}>
                                    <i className={`fas ${a.type === 'danger' ? 'fa-circle-exclamation' : a.type === 'warning' ? 'fa-triangle-exclamation' : 'fa-circle-info'}`} style={{ marginTop: '3px' }}></i>
                                    <span style={{ flex: 1 }}>
                                        <strong>{a.title}</strong> — {a.message}
                                        <span style={{ display: 'block', fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                                            {new Date(a.created_at).toLocaleString()} · {a.active ? 'LIVE' : 'hidden'}
                                        </span>
                                    </span>
                                    <span style={{ display: 'flex', gap: '6px' }}>
                                        <button className="icon-action" title={a.active ? 'Hide' : 'Publish'} onClick={() => toggleAnn(a)}>
                                            <i className={`fas ${a.active ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                        </button>
                                        <button className="icon-action danger" title="Delete" onClick={() => deleteAnn(a.id)}>
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit user */}
            <Modal
                open={!!editUser}
                onClose={() => setEditUser(null)}
                title="Edit User"
                icon="fa-user-pen"
                footer={
                    <>
                        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setEditUser(null)}>Cancel</button>
                        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={saveUser} disabled={savingUser}>
                            {savingUser ? <i className="fas fa-spinner fa-spin"></i> : 'Save Changes'}
                        </button>
                    </>
                }
            >
                {editUser && (
                    <>
                        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '14px' }}>{editUser.email}</p>
                        <div className="form-group"><label>Full Name</label>
                            <input value={editForm.full_name} onChange={e => setEditForm({ ...editForm, full_name: e.target.value })} /></div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                            <div className="form-group"><label>Phone</label>
                                <input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                            <div className="form-group"><label>Vehicle</label>
                                <input value={editForm.vehicle} onChange={e => setEditForm({ ...editForm, vehicle: e.target.value })} /></div>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                            <div className="form-group"><label>Role</label>
                                <select value={editForm.role} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
                                    <option value="user">user</option><option value="admin">admin</option>
                                </select></div>
                            <div className="form-group"><label>Plan</label>
                                <select value={editForm.plan} onChange={e => setEditForm({ ...editForm, plan: e.target.value })}>
                                    <option>Free</option><option>Pro</option><option>Fleet</option>
                                </select></div>
                            <div className="form-group"><label>Safety</label>
                                <input type="number" min="0" max="100" value={editForm.safety_score}
                                    onChange={e => setEditForm({ ...editForm, safety_score: e.target.value })} /></div>
                        </div>
                    </>
                )}
            </Modal>

            {/* User drilldown */}
            <Modal open={!!drill} onClose={() => setDrill(null)} title={drill?.full_name || 'User'} icon="fa-user" width={560}>
                {drill && (() => {
                    const ut = userTrips(drill.id);
                    const us = summarizeTrips(ut);
                    return (
                        <>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px', fontSize: '13px', color: 'var(--muted)' }}>
                                <span><i className="fas fa-envelope" style={{ marginRight: '6px' }}></i>{drill.email}</span>
                                <span><i className="fas fa-phone" style={{ marginRight: '6px' }}></i>{drill.phone || '—'}</span>
                                <span><i className="fas fa-car" style={{ marginRight: '6px' }}></i>{drill.vehicle || '—'}</span>
                            </div>
                            <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: '16px' }}>
                                {[
                                    ['Trips', us.totalTrips], ['Distance', `${us.totalDist}km`],
                                    ['Avg Risk', `${us.avgRisk}%`], ['Score', drill.safety_score ?? 95]
                                ].map(([l, v]) => (
                                    <div key={l} className="stat-box"><div className="stat-value">{v}</div><div className="stat-label">{l}</div></div>
                                ))}
                            </div>
                            <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                                {ut.length === 0 ? <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '20px' }}>No trips for this user.</p> :
                                    ut.map(t => (
                                        <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--light)', fontSize: '13px' }}>
                                            <span>{t.start_location} → {t.destination}</span>
                                            <span style={{ color: riskColor(t.risk_level), fontWeight: 600 }}>{t.risk_score}%</span>
                                        </div>
                                    ))}
                            </div>
                        </>
                    );
                })()}
            </Modal>

            <ConfirmDialog
                open={!!confirm}
                onClose={() => setConfirm(null)}
                onConfirm={runConfirm}
                loading={busy}
                title={confirm?.kind === 'user' ? 'Delete user data?' : 'Delete trip?'}
                message={confirm?.kind === 'user'
                    ? `This permanently removes all trips, settings and the profile for "${confirm?.label}". The login record can only be fully removed from the Supabase dashboard. Continue?`
                    : `Permanently delete "${confirm?.label}"?`}
                confirmLabel="Delete"
            />
        </div>
    );
};

const Pager = ({ page, pages, onPage, count }) => (
    <div className="pagination">
        <span style={{ marginRight: 'auto', color: 'var(--muted)', fontSize: '13px' }}>{count} result{count !== 1 ? 's' : ''}</span>
        <button onClick={() => onPage(p => Math.max(1, p - 1))} disabled={page <= 1}><i className="fas fa-chevron-left"></i></button>
        <span style={{ fontSize: '13px', color: 'var(--text)' }}>Page {page} / {pages}</span>
        <button onClick={() => onPage(p => Math.min(pages, p + 1))} disabled={page >= pages}><i className="fas fa-chevron-right"></i></button>
    </div>
);

export default Admin;
