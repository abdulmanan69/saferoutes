import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useRideLive, ensureNotifyPermission } from '../context/RideLiveContext';
import { geocodeOne, getRoutes, haversineKm } from '../utils/geo';
import LocationInput from '../components/LocationInput/LocationInput';
import RouteMap from '../components/RouteMap/RouteMap';
import Modal, { ConfirmDialog } from '../components/Modal/Modal';

// Simple transparent pricing, like real ride apps show up-front.
const BASE_FARE = 200;      // Rs.
const PER_KM = 45;          // Rs.
const fareFor = (km) => Math.round(BASE_FARE + km * PER_KM);

const STATUS_STYLE = {
    requested: { color: '#f59e0b', icon: 'fa-hourglass-half', label: 'Finding driver' },
    accepted: { color: '#2563eb', icon: 'fa-car-side', label: 'Driver on the way' },
    completed: { color: '#10b981', icon: 'fa-circle-check', label: 'Completed' },
    cancelled: { color: '#ef4444', icon: 'fa-ban', label: 'Cancelled' }
};

const RideRow = ({ ride, who, actions }) => {
    const s = STATUS_STYLE[ride.status];
    return (
        <div className="ride-row pop-in">
            <div className="ride-status-dot" style={{ background: s.color }} />
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {ride.pickup} → {ride.destination}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <span><i className="fas fa-road" style={{ marginRight: '4px' }}></i>{ride.distance_km} km</span>
                    <span style={{ fontWeight: 700, color: 'var(--dark)' }}>Rs. {Number(ride.fare).toLocaleString()}</span>
                    <span>{new Date(ride.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                    {who && <span><i className="fas fa-user" style={{ marginRight: '4px' }}></i>{who}</span>}
                </div>
            </div>
            <span className="route-badge" style={{ background: `${s.color}22`, color: s.color, whiteSpace: 'nowrap' }}>
                <i className={`fas ${s.icon}`} style={{ marginRight: '5px' }}></i>{s.label}
            </span>
            {actions}
        </div>
    );
};

/* ============ Live tracking + chat modal ============ */
const RideModal = ({ ride, meId, names, onClose, onCall }) => {
    const toast = useToast();
    const [msgs, setMsgs] = useState([]);
    const [text, setText] = useState('');
    const [sending, setSending] = useState(false);
    const [otherProfile, setOtherProfile] = useState(null);
    const listRef = useRef(null);

    const otherId = meId === ride.customer_id ? ride.driver_id : ride.customer_id;
    const otherName = names[otherId] || 'them';
    const driverPos = ride.driver_lat != null ? { lat: Number(ride.driver_lat), lng: Number(ride.driver_lng) } : null;
    const pickupPos = ride.pickup_lat != null ? { lat: Number(ride.pickup_lat), lng: Number(ride.pickup_lng), label: `Pickup: ${ride.pickup}` } : null;
    const destPos = ride.dest_lat != null ? { lat: Number(ride.dest_lat), lng: Number(ride.dest_lng), label: ride.destination } : null;
    const etaMin = driverPos && pickupPos && ride.status === 'accepted'
        ? Math.max(1, Math.round((haversineKm(driverPos, pickupPos) / 30) * 60)) : null;

    useEffect(() => {
        let active = true;
        supabase.from('ride_messages').select('*').eq('ride_id', ride.id).order('created_at')
            .then(({ data }) => { if (active) setMsgs(data || []); });

        const ch = supabase.channel(`ride-chat-${ride.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: `ride_id=eq.${ride.id}` },
                payload => setMsgs(prev => prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]))
            .subscribe();

        if (otherId) {
            supabase.from('profiles').select('id, full_name, phone').eq('id', otherId).single()
                .then(({ data }) => { if (active) setOtherProfile(data); });
        }
        return () => { active = false; supabase.removeChannel(ch); };
    }, [ride.id, otherId]);

    useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [msgs]);

    const send = async () => {
        const t = text.trim();
        if (!t) return;
        setSending(true);
        const { data, error } = await supabase.from('ride_messages')
            .insert({ ride_id: ride.id, sender_id: meId, message: t }).select().single();
        setSending(false);
        if (error) return toast.error(error.message);
        setMsgs(prev => prev.some(m => m.id === data.id) ? prev : [...prev, data]);
        setText('');
    };

    return (
        <Modal open onClose={onClose} title={`${ride.pickup} → ${ride.destination}`} icon="fa-taxi" width={620}>
            <div style={{ borderRadius: '12px', overflow: 'hidden', marginBottom: '10px' }}>
                <RouteMap start={pickupPos} end={destPos} current={driverPos} height={230} zoom={11} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                <span style={{ fontSize: '13px', color: 'var(--muted)' }}>
                    {ride.status === 'accepted'
                        ? (driverPos
                            ? <><i className="fas fa-location-arrow" style={{ color: 'var(--primary)', marginRight: '6px' }}></i>Driver live · ~{etaMin} min to pickup</>
                            : <><i className="fas fa-satellite-dish pulse" style={{ marginRight: '6px' }}></i>Waiting for driver's GPS signal…</>)
                        : STATUS_STYLE[ride.status].label}
                </span>
                <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {ride.status === 'accepted' && otherId && (
                        <button className="btn btn-primary btn-sm" style={{ width: 'auto' }}
                            onClick={() => onCall(ride, otherProfile?.full_name?.split(' ')[0] || otherName)}>
                            <i className="fas fa-phone-volume" style={{ marginRight: '6px' }}></i>Call in app
                        </button>
                    )}
                    {otherProfile?.phone && (
                        <a href={`tel:${otherProfile.phone}`} className="btn btn-ghost btn-sm" style={{ width: 'auto', textDecoration: 'none' }}>
                            <i className="fas fa-phone" style={{ marginRight: '6px' }}></i>Phone
                        </a>
                    )}
                </span>
            </div>

            <div className="chat-box">
                <div className="chat-list" ref={listRef}>
                    {msgs.length === 0 && (
                        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '14px 0' }}>
                            Say hello to {otherName} 👋 — messages are live.
                        </p>
                    )}
                    {msgs.map(m => (
                        <div key={m.id} className={`chat-bubble ${m.sender_id === meId ? 'mine' : ''}`}>
                            {m.message}
                            <span className="chat-time">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                    ))}
                </div>
                <div className="chat-input">
                    <input value={text} placeholder="Type a message…"
                        onChange={e => setText(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && send()} />
                    <button className="btn btn-primary" style={{ width: 'auto', padding: '10px 18px' }} onClick={send} disabled={sending}>
                        <i className="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </Modal>
    );
};

const Rides = () => {
    const { user, profile } = useAuth();
    const toast = useToast();
    const { rides, setRides, names, loading, isDriver, startCall } = useRideLive();

    const [openRide, setOpenRide] = useState(null);
    const [pickup, setPickup] = useState('');
    const [dest, setDest] = useState('');
    const [quote, setQuote] = useState(null);
    const [quoting, setQuoting] = useState(false);
    const [booking, setBooking] = useState(false);
    const [cancelId, setCancelId] = useState(null);
    const [busy, setBusy] = useState(false);

    /* ---------- DRIVER: share live GPS while on an active ride ---------- */
    const activeJobIds = rides.filter(r => r.driver_id === user?.id && r.status === 'accepted').map(r => r.id).join(',');
    useEffect(() => {
        if (!isDriver || !activeJobIds || !navigator.geolocation) return;
        let last = 0;
        const watch = navigator.geolocation.watchPosition(pos => {
            const now = Date.now();
            if (now - last < 5000) return;
            last = now;
            const patch = {
                driver_lat: pos.coords.latitude,
                driver_lng: pos.coords.longitude,
                updated_at: new Date().toISOString()
            };
            activeJobIds.split(',').forEach(id => {
                supabase.from('rides').update(patch).eq('id', id).then(() => {});
            });
        }, () => {}, { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 });
        return () => navigator.geolocation.clearWatch(watch);
    }, [isDriver, activeJobIds]);

    /* ---------- customer: quote + book ---------- */
    const getQuote = async () => {
        if (!pickup.trim() || !dest.trim()) return toast.warning('Enter both pickup and destination.');
        setQuoting(true);
        setQuote(null);
        const [s, e] = await Promise.all([geocodeOne(pickup), geocodeOne(dest)]);
        if (!s || !e) { setQuoting(false); return toast.error(`Couldn't locate ${!s ? pickup : dest}.`); }
        const [route] = await getRoutes(s, e);
        const km = Math.round(route.distanceKm * 10) / 10;
        setQuote({ km, fare: fareFor(km), eta: Math.round(route.durationHours * 60), from: s.name, to: e.name, s, e, estimated: route.estimated });
        setQuoting(false);
    };

    const bookRide = async () => {
        if (!quote) return;
        ensureNotifyPermission();
        setBooking(true);
        const { data, error } = await supabase.from('rides').insert({
            customer_id: user.id,
            pickup: quote.from,
            destination: quote.to,
            distance_km: quote.km,
            fare: quote.fare,
            pickup_lat: quote.s.lat, pickup_lng: quote.s.lng,
            dest_lat: quote.e.lat, dest_lng: quote.e.lng
        }).select().single();
        setBooking(false);
        if (error) return toast.error(error.message);
        setRides(prev => prev.some(r => r.id === data.id) ? prev : [data, ...prev]);
        setQuote(null); setPickup(''); setDest('');
        toast.success('Ride requested! Nearby drivers see it instantly.');
    };

    const cancelRide = async () => {
        setBusy(true);
        const { error } = await supabase.from('rides')
            .update({ status: 'cancelled', updated_at: new Date().toISOString() })
            .eq('id', cancelId);
        setBusy(false);
        if (error) return toast.error(error.message);
        setRides(prev => prev.map(r => r.id === cancelId ? { ...r, status: 'cancelled' } : r));
        setCancelId(null);
        toast.info('Ride cancelled.');
    };

    /* ---------- driver: accept + complete ---------- */
    const acceptRide = async (ride) => {
        ensureNotifyPermission();
        const { error } = await supabase.from('rides')
            .update({ driver_id: user.id, status: 'accepted', updated_at: new Date().toISOString() })
            .eq('id', ride.id).eq('status', 'requested');
        if (error) return toast.error(error.message);
        setRides(prev => prev.map(r => r.id === ride.id ? { ...r, driver_id: user.id, status: 'accepted' } : r));
        toast.success('Ride accepted — your live location is now shared with the customer.');
        setOpenRide(ride.id);
    };

    const completeRide = async (ride) => {
        const { error } = await supabase.from('rides')
            .update({ status: 'completed', updated_at: new Date().toISOString() })
            .eq('id', ride.id);
        if (error) return toast.error(error.message);
        setRides(prev => prev.map(r => r.id === ride.id ? { ...r, status: 'completed' } : r));
        toast.success(`Ride completed — Rs. ${Number(ride.fare).toLocaleString()} earned! 🎉`);
    };

    /* ---------- derived ---------- */
    const myRides = rides.filter(r => r.customer_id === user?.id);
    const openRequests = rides.filter(r => r.status === 'requested' && r.customer_id !== user?.id);
    const myJobs = rides.filter(r => r.driver_id === user?.id);
    const earnings = myJobs.filter(r => r.status === 'completed').reduce((s, r) => s + Number(r.fare || 0), 0);
    const activeJobs = myJobs.filter(r => r.status === 'accepted');
    const modalRide = rides.find(r => r.id === openRide);

    const trackBtn = (r) => ['accepted', 'completed'].includes(r.status) && (
        <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={() => setOpenRide(r.id)}>
            <i className={`fas ${r.status === 'accepted' ? 'fa-location-crosshairs' : 'fa-comments'}`} style={{ marginRight: '6px' }}></i>
            {r.status === 'accepted' ? 'Track & Chat' : 'Chat'}
        </button>
    );

    return (
        <div className="main">
            <div className="header">
                <h1>{isDriver ? 'Driver Hub' : 'Book a Ride'}</h1>
                <p>{isDriver
                    ? 'Requests arrive in realtime — accept, drive, chat, and earn'
                    : 'Up-front pricing, live driver tracking, and in-ride chat & calls'}</p>
            </div>

            {isDriver ? (
                <>
                    <div className="kpi-row">
                        {[
                            { label: 'Total Earnings', value: `Rs. ${earnings.toLocaleString()}`, icon: 'fa-coins', color: '#10b981' },
                            { label: 'Completed Rides', value: myJobs.filter(r => r.status === 'completed').length, icon: 'fa-circle-check', color: '#2563eb' },
                            { label: 'Active Rides', value: activeJobs.length, icon: 'fa-car-side', color: '#f59e0b' },
                            { label: 'Open Requests', value: openRequests.length, icon: 'fa-bell', color: '#8b5cf6' }
                        ].map(k => (
                            <div key={k.label} className="stat-card fade-in" style={{ padding: '20px' }}>
                                <i className={`fas ${k.icon}`} style={{ fontSize: '22px', color: k.color, marginBottom: '8px' }}></i>
                                <div className="stat-value" style={{ color: k.color, fontSize: '22px' }}>{k.value}</div>
                                <div className="stat-label">{k.label}</div>
                            </div>
                        ))}
                    </div>

                    {activeJobs.length > 0 && (
                        <div className="alert alert-success" style={{ marginBottom: '20px' }}>
                            <i className="fas fa-satellite-dish pulse"></i>
                            <span><strong>Live tracking on:</strong> your GPS position is being shared with your customer{activeJobs.length > 1 ? 's' : ''}.</span>
                        </div>
                    )}

                    <div className="grid">
                        <div className="card fade-in">
                            <div className="card-title">
                                <i className="fas fa-bell"></i>Ride Requests
                                <span className="route-badge badge-safe" style={{ fontSize: '9px' }}>REALTIME</span>
                            </div>
                            {loading && <div className="skeleton" style={{ height: '120px' }} />}
                            {!loading && openRequests.length === 0 && (
                                <div className="empty-state"><i className="fas fa-mug-hot"></i>
                                    <p style={{ fontWeight: 600 }}>No open requests right now</p>
                                    <p style={{ fontSize: '13px', marginTop: '6px' }}>New requests appear here instantly — no refresh needed.</p>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {openRequests.map(r => (
                                    <RideRow key={r.id} ride={r} who={names[r.customer_id]}
                                        actions={
                                            <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={() => acceptRide(r)}>
                                                <i className="fas fa-check" style={{ marginRight: '6px' }}></i>Accept
                                            </button>
                                        } />
                                ))}
                            </div>
                        </div>

                        <div className="card fade-in">
                            <div className="card-title"><i className="fas fa-route"></i>My Rides</div>
                            {!loading && myJobs.length === 0 && (
                                <p style={{ color: 'var(--muted)', fontSize: '14px' }}>Accept a request to start earning.</p>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {myJobs.map(r => (
                                    <RideRow key={r.id} ride={r} who={names[r.customer_id]}
                                        actions={
                                            <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {trackBtn(r)}
                                                {r.status === 'accepted' && (
                                                    <button className="btn btn-sm" style={{ width: 'auto', background: 'rgba(52,211,153,0.15)', color: '#34d399', border: '1px solid rgba(52,211,153,0.4)' }}
                                                        onClick={() => completeRide(r)}>
                                                        <i className="fas fa-flag-checkered" style={{ marginRight: '6px' }}></i>Complete
                                                    </button>
                                                )}
                                            </span>
                                        } />
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            ) : (
                <div className="grid">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        <div className="card fade-in">
                            <div className="card-title"><i className="fas fa-taxi"></i>Where to?</div>
                            <div className="form-group">
                                <label>Pickup</label>
                                <LocationInput value={pickup} placeholder="Your pickup point (or use GPS →)" icon="fa-circle-dot"
                                    allowCurrent onError={m => toast.error(m)}
                                    onChange={v => { setPickup(v); setQuote(null); }}
                                    onSelect={p => { setPickup(p.name); setQuote(null); }} />
                            </div>
                            <div className="form-group">
                                <label>Destination</label>
                                <LocationInput value={dest} placeholder="Where are you going?" icon="fa-flag-checkered"
                                    onChange={v => { setDest(v); setQuote(null); }}
                                    onSelect={p => { setDest(p.name); setQuote(null); }} />
                            </div>

                            {quote && (
                                <div className="quote-box pop-in">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
                                        <div>
                                            <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Up-front fare{quote.estimated ? ' (estimated)' : ''}</div>
                                            <div style={{ fontSize: '30px', fontWeight: 800, color: 'var(--dark)' }}>Rs. {quote.fare.toLocaleString()}</div>
                                        </div>
                                        <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--muted)' }}>
                                            <div><i className="fas fa-road" style={{ marginRight: '6px' }}></i>{quote.km} km</div>
                                            <div><i className="fas fa-clock" style={{ marginRight: '6px' }}></i>~{quote.eta} min</div>
                                            <div style={{ fontSize: '11px', marginTop: '4px' }}>Rs. {BASE_FARE} base + Rs. {PER_KM}/km</div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
                                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={getQuote} disabled={quoting}>
                                    {quoting ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-calculator" style={{ marginRight: '8px' }}></i>Get Fare</>}
                                </button>
                                <button className="btn btn-primary" style={{ flex: 1.4 }} onClick={bookRide} disabled={!quote || booking}>
                                    {booking ? <i className="fas fa-spinner fa-spin"></i> : <><i className="fas fa-taxi" style={{ marginRight: '8px' }}></i>Request Ride</>}
                                </button>
                            </div>
                        </div>

                        <div className="card fade-in">
                            <div className="card-title">
                                <i className="fas fa-clock-rotate-left"></i>My Rides
                                <span className="route-badge badge-safe" style={{ fontSize: '9px' }}>REALTIME</span>
                            </div>
                            {loading && <div className="skeleton" style={{ height: '100px' }} />}
                            {!loading && myRides.length === 0 && (
                                <div className="empty-state"><i className="fas fa-taxi"></i>
                                    <p style={{ fontWeight: 600 }}>No rides yet</p>
                                    <p style={{ fontSize: '13px', marginTop: '6px' }}>Get a fare quote above and request your first ride.</p>
                                </div>
                            )}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {myRides.map(r => (
                                    <RideRow key={r.id} ride={r} who={r.driver_id ? `Driver: ${names[r.driver_id] || '…'}` : null}
                                        actions={
                                            <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                                {trackBtn(r)}
                                                {['requested', 'accepted'].includes(r.status) && (
                                                    <button className="icon-action danger" title="Cancel ride" onClick={() => setCancelId(r.id)}>
                                                        <i className="fas fa-times"></i>
                                                    </button>
                                                )}
                                            </span>
                                        } />
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="card fade-in" style={{ height: 'fit-content' }}>
                        <div className="card-title"><i className="fas fa-circle-info"></i>How it works</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '14px', color: 'var(--muted)' }}>
                            {[
                                ['fa-calculator', 'Get an up-front fare from real road distance — no surprises.'],
                                ['fa-taxi', 'Request the ride; drivers see it instantly (realtime).'],
                                ['fa-location-crosshairs', 'Once accepted, track your driver live on the map with ETA.'],
                                ['fa-comments', 'Chat in-app, call in-app, or phone them directly.'],
                                ['fa-bell', 'Enable push in Settings to get alerts even when the app is closed.'],
                                ['fa-id-badge', 'Want to earn instead? Switch to a Driver account in your Profile.']
                            ].map(([ic, t]) => (
                                <div key={t} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <i className={`fas ${ic}`} style={{ color: 'var(--primary)', width: '20px', marginTop: '2px' }}></i>{t}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {modalRide && (
                <RideModal ride={modalRide} meId={user?.id} names={names} onClose={() => setOpenRide(null)}
                    onCall={(r, peerName) => startCall(r, peerName)} />
            )}

            <ConfirmDialog
                open={!!cancelId}
                onClose={() => setCancelId(null)}
                onConfirm={cancelRide}
                loading={busy}
                title="Cancel this ride?"
                message="The request will be withdrawn. If a driver already accepted, they'll be notified."
                confirmLabel="Cancel Ride"
            />
        </div>
    );
};

export default Rides;
