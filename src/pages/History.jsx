import React, { useState, useEffect, useMemo } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { summarizeTrips, riskColor } from '../utils/helpers';
import { downloadCSV } from '../utils/csv';
import { geocodeOne, getRoutes } from '../utils/geo';
import Modal, { ConfirmDialog } from '../components/Modal/Modal';
import RouteMap from '../components/RouteMap/RouteMap';

const RISK_FILTERS = ['All', 'Low', 'Medium', 'High'];
const STATUS_OPTS = ['Completed', 'In Progress', 'Cancelled'];

const History = () => {
    const { user, profile } = useAuth();
    const toast = useToast();
    const navigate = useNavigate();
    const [params] = useSearchParams();
    const [upsell, setUpsell] = useState(false);
    const isPro = (profile?.plan || 'Free') !== 'Free';

    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState(params.get('q') || '');
    const [riskFilter, setRiskFilter] = useState('All');
    const [sort, setSort] = useState({ key: 'created_at', dir: 'desc' });

    const [editing, setEditing] = useState(null);
    const [editForm, setEditForm] = useState({ status: 'Completed', notes: '' });
    const [savingEdit, setSavingEdit] = useState(false);
    const [confirmId, setConfirmId] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const [viewTrip, setViewTrip] = useState(null);
    const [viewRoute, setViewRoute] = useState(null);
    const [viewLoading, setViewLoading] = useState(false);

    const openView = async (trip) => {
        setViewTrip(trip);
        setViewRoute(null);
        setViewLoading(true);
        const [s, e] = await Promise.all([geocodeOne(trip.start_location), geocodeOne(trip.destination)]);
        if (s && e) {
            const [route] = await getRoutes(s, e);
            setViewRoute({ start: { ...s, label: trip.start_location }, end: { ...e, label: trip.destination }, coords: route.coordinates });
        }
        setViewLoading(false);
    };

    const planAgain = (trip) => {
        navigate('/new-trip', { state: { prefill: { start: trip.start_location, destination: trip.destination }, autoSearch: true } });
    };

    useEffect(() => {
        if (!user) return;
        supabase.from('trips').select('*').eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => { setTrips(data || []); setLoading(false); });
    }, [user]);

    useEffect(() => { setSearch(params.get('q') || ''); }, [params]);

    const stats = summarizeTrips(trips);

    const visible = useMemo(() => {
        let list = [...trips];
        const q = search.trim().toLowerCase();
        if (q) list = list.filter(t =>
            [t.start_location, t.destination, t.route_name].filter(Boolean).join(' ').toLowerCase().includes(q));
        if (riskFilter !== 'All') list = list.filter(t => t.risk_level === riskFilter);
        list.sort((a, b) => {
            let av = a[sort.key], bv = b[sort.key];
            if (sort.key === 'created_at') { av = new Date(av); bv = new Date(bv); }
            if (av < bv) return sort.dir === 'asc' ? -1 : 1;
            if (av > bv) return sort.dir === 'asc' ? 1 : -1;
            return 0;
        });
        return list;
    }, [trips, search, riskFilter, sort]);

    const toggleSort = (key) =>
        setSort(s => s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' });

    const sortIcon = (key) => sort.key !== key ? 'fa-sort' : sort.dir === 'asc' ? 'fa-sort-up' : 'fa-sort-down';

    const openEdit = (trip) => {
        setEditing(trip);
        setEditForm({ status: trip.status || 'Completed', notes: trip.notes || '' });
    };

    const saveEdit = async () => {
        setSavingEdit(true);
        const { error } = await supabase.from('trips')
            .update({ status: editForm.status, notes: editForm.notes })
            .eq('id', editing.id);
        setSavingEdit(false);
        if (error) return toast.error(error.message);
        setTrips(prev => prev.map(t => t.id === editing.id ? { ...t, ...editForm } : t));
        setEditing(null);
        toast.success('Trip updated.');
    };

    const doDelete = async () => {
        setDeleting(true);
        const { error } = await supabase.from('trips').delete().eq('id', confirmId);
        setDeleting(false);
        if (error) return toast.error(error.message);
        setTrips(prev => prev.filter(t => t.id !== confirmId));
        setConfirmId(null);
        toast.success('Trip deleted.');
    };

    const exportCsv = () => {
        if (!isPro) { setUpsell(true); return; }
        downloadCSV(visible, `saferoute-trips-${Date.now()}.csv`, [
            { key: 'start_location', label: 'Start' },
            { key: 'destination', label: 'Destination' },
            { key: 'route_name', label: 'Route' },
            { key: 'distance_km', label: 'Distance (km)' },
            { key: 'duration_hours', label: 'Duration (h)' },
            { key: 'risk_level', label: 'Risk Level' },
            { key: 'risk_score', label: 'Risk Score' },
            { key: 'status', label: 'Status' },
            { key: 'created_at', label: 'Date', format: v => new Date(v).toLocaleDateString() }
        ]);
        toast.success(`Exported ${visible.length} trip(s) to CSV.`);
    };

    const statusColor = (s) => s === 'Completed' ? '#10b981' : s === 'In Progress' ? '#2563eb' : '#ef4444';

    return (
        <div className="main">
            <div className="header">
                <h1>Trip History</h1>
                <p>Review, edit and export your past journeys</p>
            </div>

            {/* Summary */}
            <div className="kpi-row">
                {[
                    { label: 'Total Trips', value: stats.totalTrips, color: '#2563eb' },
                    { label: 'Total Distance', value: `${stats.totalDist} km`, color: '#10b981' },
                    { label: 'Low Risk', value: stats.lowRisk, color: '#06b6d4' },
                    { label: 'Avg Risk', value: stats.totalTrips ? `${stats.avgRisk}%` : '—', color: '#f59e0b' }
                ].map(c => (
                    <div key={c.label} className="stat-card fade-in">
                        <div className="stat-value" style={{ color: c.color }}>{c.value}</div>
                        <div className="stat-label">{c.label}</div>
                    </div>
                ))}
            </div>

            <div className="card">
                {/* Toolbar */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '20px' }}>
                    <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                        <input type="text" placeholder="Search routes & destinations..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {RISK_FILTERS.map(r => (
                            <button key={r} className={`chip ${riskFilter === r ? 'active' : ''}`} onClick={() => setRiskFilter(r)}>{r}</button>
                        ))}
                    </div>
                    <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={exportCsv} disabled={!visible.length}>
                        <i className="fas fa-file-csv" style={{ marginRight: '8px' }}></i>Export CSV
                        {!isPro && <span className="route-badge" style={{ background: '#ede9fe', color: '#6d28d9', marginLeft: '8px', fontSize: '9px' }}>PRO</span>}
                    </button>
                </div>

                {loading && (
                    <div className="empty-state"><i className="fas fa-spinner fa-spin"></i><p>Loading trips...</p></div>
                )}

                {!loading && trips.length === 0 && (
                    <div className="empty-state">
                        <i className="fas fa-route"></i>
                        <p style={{ fontSize: '16px', fontWeight: 600 }}>No trips yet</p>
                        <p style={{ fontSize: '14px', marginTop: '8px' }}>Plan your first trip using New Trip.</p>
                    </div>
                )}

                {!loading && trips.length > 0 && visible.length === 0 && (
                    <div className="empty-state"><i className="fas fa-magnifying-glass"></i><p>No trips match your filters.</p></div>
                )}

                {!loading && visible.length > 0 && (
                    <div style={{ overflowX: 'auto' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th onClick={() => toggleSort('destination')}>Route <i className={`fas ${sortIcon('destination')}`}></i></th>
                                    <th onClick={() => toggleSort('distance_km')}>Distance <i className={`fas ${sortIcon('distance_km')}`}></i></th>
                                    <th onClick={() => toggleSort('duration_hours')}>Duration <i className={`fas ${sortIcon('duration_hours')}`}></i></th>
                                    <th onClick={() => toggleSort('risk_score')}>Risk <i className={`fas ${sortIcon('risk_score')}`}></i></th>
                                    <th>Status</th>
                                    <th onClick={() => toggleSort('created_at')}>Date <i className={`fas ${sortIcon('created_at')}`}></i></th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map(trip => (
                                    <tr key={trip.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{trip.start_location} → {trip.destination}</div>
                                            {trip.route_name && <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{trip.route_name}</div>}
                                            {trip.notes && <div style={{ fontSize: '11px', color: 'var(--muted)', fontStyle: 'italic', marginTop: '2px' }}><i className="fas fa-note-sticky" style={{ marginRight: '4px' }}></i>{trip.notes}</div>}
                                        </td>
                                        <td style={{ color: 'var(--muted)' }}>{trip.distance_km ? `${trip.distance_km} km` : '—'}</td>
                                        <td style={{ color: 'var(--muted)' }}>{trip.duration_hours ? `${trip.duration_hours}h` : '—'}</td>
                                        <td>
                                            <span className="route-badge" style={{ background: `${riskColor(trip.risk_level)}22`, color: riskColor(trip.risk_level) }}>
                                                {trip.risk_level} ({trip.risk_score}%)
                                            </span>
                                        </td>
                                        <td><span style={{ color: statusColor(trip.status), fontWeight: 600, fontSize: '13px' }}>{trip.status}</span></td>
                                        <td style={{ color: 'var(--muted)' }}>{new Date(trip.created_at).toLocaleDateString()}</td>
                                        <td>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button className="icon-action" title="View route" onClick={() => openView(trip)}><i className="fas fa-map-location-dot"></i></button>
                                                <button className="icon-action" title="Edit" onClick={() => openEdit(trip)}><i className="fas fa-pen"></i></button>
                                                <button className="icon-action danger" title="Delete" onClick={() => setConfirmId(trip.id)}><i className="fas fa-trash"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Edit modal */}
            <Modal
                open={!!editing}
                onClose={() => setEditing(null)}
                title="Edit Trip"
                icon="fa-pen"
                footer={
                    <>
                        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setEditing(null)}>Cancel</button>
                        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={saveEdit} disabled={savingEdit}>
                            {savingEdit ? <i className="fas fa-spinner fa-spin"></i> : 'Save Changes'}
                        </button>
                    </>
                }
            >
                {editing && (
                    <>
                        <p style={{ fontWeight: 600, marginBottom: '16px' }}>{editing.start_location} → {editing.destination}</p>
                        <div className="form-group">
                            <label>Status</label>
                            <select value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                                {STATUS_OPTS.map(s => <option key={s}>{s}</option>)}
                            </select>
                        </div>
                        <div className="form-group" style={{ marginBottom: 0 }}>
                            <label>Notes</label>
                            <textarea
                                value={editForm.notes}
                                onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                                placeholder="Add a note about this trip..."
                                rows={3}
                                style={{ width: '100%', padding: '12px 15px', border: '2px solid var(--border)', borderRadius: '10px', fontFamily: 'inherit', fontSize: '14px', resize: 'vertical' }}
                            />
                        </div>
                    </>
                )}
            </Modal>

            {/* View route modal */}
            <Modal
                open={!!viewTrip}
                onClose={() => setViewTrip(null)}
                title={viewTrip ? `${viewTrip.start_location} → ${viewTrip.destination}` : ''}
                icon="fa-map-location-dot"
                width={620}
                footer={
                    <>
                        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setViewTrip(null)}>Close</button>
                        <button className="btn btn-ghost" style={{ width: 'auto' }}
                            onClick={() => navigate('/journey', { state: { destination: viewTrip.destination } })}>
                            <i className="fas fa-satellite-dish" style={{ marginRight: '8px' }}></i>Start Journey
                        </button>
                        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => planAgain(viewTrip)}>
                            <i className="fas fa-rotate" style={{ marginRight: '8px' }}></i>Plan Again
                        </button>
                    </>
                }
            >
                {viewTrip && (
                    <>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px', marginBottom: '16px' }}>
                            {[
                                ['Distance', viewTrip.distance_km ? `${viewTrip.distance_km} km` : '—'],
                                ['Duration', viewTrip.duration_hours ? `${viewTrip.duration_hours}h` : '—'],
                                ['Risk', `${viewTrip.risk_level} (${viewTrip.risk_score}%)`],
                                ['Status', viewTrip.status]
                            ].map(([l, v]) => (
                                <div key={l} className="stat-box"><div style={{ fontWeight: 700, fontSize: '14px' }}>{v}</div><div className="stat-label">{l}</div></div>
                            ))}
                        </div>
                        <div style={{ borderRadius: '12px', overflow: 'hidden' }}>
                            {viewLoading
                                ? <div className="skeleton" style={{ height: '300px' }} />
                                : <RouteMap start={viewRoute?.start} end={viewRoute?.end} route={viewRoute?.coords} height={300} />}
                        </div>
                        {viewTrip.notes && (
                            <p style={{ marginTop: '14px', fontSize: '13px', color: 'var(--muted)' }}>
                                <i className="fas fa-note-sticky" style={{ marginRight: '6px' }}></i>{viewTrip.notes}
                            </p>
                        )}
                    </>
                )}
            </Modal>

            <ConfirmDialog
                open={!!confirmId}
                onClose={() => setConfirmId(null)}
                onConfirm={doDelete}
                loading={deleting}
                title="Delete this trip?"
                message="This permanently removes the trip from your history. This cannot be undone."
                confirmLabel="Delete"
            />

            {/* Pro upsell */}
            <Modal open={upsell} onClose={() => setUpsell(false)} title="Unlock CSV Export" icon="fa-crown" width={430}
                footer={
                    <>
                        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setUpsell(false)}>Not now</button>
                        <button className="btn btn-primary" style={{ width: 'auto' }} onClick={() => navigate('/subscription')}>
                            <i className="fas fa-crown" style={{ marginRight: '8px' }}></i>View Plans
                        </button>
                    </>
                }>
                <div style={{ textAlign: 'center', padding: '6px 0 4px' }}>
                    <div className="action-icon" style={{ background: 'rgba(139,92,246,0.14)', color: '#8b5cf6', margin: '0 auto 14px', width: '58px', height: '58px', fontSize: '24px' }}>
                        <i className="fas fa-file-csv"></i>
                    </div>
                    <p style={{ fontWeight: 700, color: 'var(--dark)', marginBottom: '8px' }}>CSV export is a Pro feature</p>
                    <p style={{ fontSize: '13px', color: 'var(--muted)', lineHeight: 1.7 }}>
                        Upgrade to <strong>Pro</strong> to export your trips, unlock advanced analytics,
                        route comparisons and priority hazard alerts. Trip planning always stays free.
                    </p>
                </div>
            </Modal>
        </div>
    );
};

export default History;
