import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { useToast } from './ToastContext';

/* App-wide ride engine: realtime ride updates, in-app WebRTC voice calls and
   system notifications ring EVERYWHERE in the app — not just on the Rides page. */

const RTC_CONFIG = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }] };

const RideLiveContext = createContext({});
export const useRideLive = () => useContext(RideLiveContext);

// System notification when the tab/app is hidden (toast covers the foreground).
const notifySystem = (title, body) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    if (!document.hidden) return;
    try {
        const n = new Notification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png' });
        n.onclick = () => { window.focus(); window.location.href = '/rides'; n.close(); };
    } catch { /* mobile requires SW notifications — handled by Web Push */ }
};

export const ensureNotifyPermission = () => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
};

export const RideLiveProvider = ({ children }) => {
    const { user, profile } = useAuth();
    const toast = useToast();
    const isDriver = profile?.user_type === 'driver';

    const [rides, setRides] = useState([]);
    const [names, setNames] = useState({});
    const [loading, setLoading] = useState(true);

    /* ---------- rides list + realtime ---------- */
    useEffect(() => {
        if (!user) { setRides([]); setLoading(true); return; }
        supabase.from('rides').select('*').order('created_at', { ascending: false })
            .then(({ data }) => { setRides(data || []); setLoading(false); });
    }, [user]);

    useEffect(() => {
        const ids = [...new Set(rides.flatMap(r => [r.customer_id, r.driver_id]).filter(Boolean))]
            .filter(id => !(id in names));
        if (!ids.length) return;
        supabase.from('profiles').select('id, full_name').in('id', ids).then(({ data }) => {
            if (data?.length) setNames(prev => ({ ...prev, ...Object.fromEntries(data.map(p => [p.id, p.full_name || 'User'])) }));
        });
    }, [rides, names]);

    useEffect(() => {
        if (!user) return;
        const onRides = supabase.channel('rides-live-global')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'rides' }, (payload) => {
                setRides(prev => {
                    if (payload.eventType === 'INSERT')
                        return prev.some(r => r.id === payload.new.id) ? prev : [payload.new, ...prev];
                    if (payload.eventType === 'UPDATE')
                        return prev.map(r => r.id === payload.new.id ? { ...r, ...payload.new } : r);
                    if (payload.eventType === 'DELETE')
                        return prev.filter(r => r.id !== payload.old.id);
                    return prev;
                });
                if (payload.eventType === 'INSERT' && payload.new.customer_id !== user.id && isDriver) {
                    toast.info(`🚕 New ride request: ${payload.new.pickup} → ${payload.new.destination}`);
                    notifySystem('🚕 New ride request', `${payload.new.pickup} → ${payload.new.destination} · Rs. ${Number(payload.new.fare).toLocaleString()}`);
                }
                if (payload.eventType === 'UPDATE' && payload.new.customer_id === user.id) {
                    if (payload.old?.status === 'requested' && payload.new.status === 'accepted') {
                        toast.success('A driver accepted your ride! Track them live.');
                        notifySystem('✅ Driver accepted', 'Your driver is on the way — open SafeRoute to track them.');
                    }
                    if (payload.old?.status === 'accepted' && payload.new.status === 'completed') {
                        toast.success('Ride completed — thanks for riding with SafeRoute!');
                        notifySystem('🏁 Ride completed', `${payload.new.pickup} → ${payload.new.destination}`);
                    }
                }
            })
            .subscribe();

        // Chat notifications app-wide (RLS only delivers messages for my rides)
        const onMsgs = supabase.channel('ride-msgs-global')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_messages' }, ({ new: m }) => {
                if (m.sender_id === user.id) return;
                if (window.location.pathname !== '/rides') toast.info(`💬 New ride message: ${m.message.slice(0, 60)}`);
                notifySystem('💬 New ride message', m.message.slice(0, 90));
            })
            .subscribe();

        return () => { supabase.removeChannel(onRides); supabase.removeChannel(onMsgs); };
    }, [user, isDriver, toast]);

    /* ---------- WebRTC voice-call engine (rings on every page) ---------- */
    const [call, setCall] = useState({ state: 'idle' });
    const pcRef = useRef(null);
    const streamRef = useRef(null);
    const audioRef = useRef(null);
    const chansRef = useRef({});
    const pendingIce = useRef([]);
    const offerRef = useRef(null);
    const callRef = useRef(call);
    useEffect(() => { callRef.current = call; }, [call]);

    const send = useCallback((rideId, event, payload = {}) => {
        chansRef.current[rideId]?.send({ type: 'broadcast', event, payload: { ...payload, from: user?.id } });
    }, [user]);

    const cleanup = useCallback(() => {
        try { pcRef.current?.close(); } catch { /* closed */ }
        pcRef.current = null;
        streamRef.current?.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        pendingIce.current = [];
        offerRef.current = null;
        setCall({ state: 'idle' });
    }, []);

    const hangup = useCallback(() => {
        const c = callRef.current;
        if (c.ride) send(c.ride.id, 'call-end');
        cleanup();
    }, [send, cleanup]);

    const makePc = useCallback((rideId) => {
        const pc = new RTCPeerConnection(RTC_CONFIG);
        pc.onicecandidate = (e) => e.candidate && send(rideId, 'call-ice', { candidate: e.candidate.toJSON() });
        pc.ontrack = (e) => {
            if (audioRef.current) {
                audioRef.current.srcObject = e.streams[0];
                audioRef.current.play().catch(() => {});
            }
        };
        pc.onconnectionstatechange = () => {
            if (['failed', 'disconnected'].includes(pc.connectionState)) cleanup();
        };
        pcRef.current = pc;
        return pc;
    }, [send, cleanup]);

    const mic = async () => {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = s;
        return s;
    };

    const flushIce = async () => {
        for (const c of pendingIce.current) {
            try { await pcRef.current?.addIceCandidate(c); } catch { /* stale */ }
        }
        pendingIce.current = [];
    };

    const startCall = useCallback(async (ride, peerName) => {
        if (callRef.current.state !== 'idle') return;
        try {
            const s = await mic();
            const pc = makePc(ride.id);
            s.getTracks().forEach(t => pc.addTrack(t, s));
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            send(ride.id, 'call-offer', { sdp: offer, name: profile?.full_name?.split(' ')[0] || 'SafeRoute user' });
            setCall({ state: 'calling', ride, peerName, muted: false });
        } catch {
            toast.error('Microphone unavailable. Allow mic access (needs HTTPS or localhost).');
            cleanup();
        }
    }, [makePc, send, profile, toast, cleanup]);

    const acceptCall = useCallback(async () => {
        const { ride } = callRef.current;
        const offer = offerRef.current;
        if (!ride || !offer) return;
        try {
            const s = await mic();
            const pc = makePc(ride.id);
            s.getTracks().forEach(t => pc.addTrack(t, s));
            await pc.setRemoteDescription(offer);
            await flushIce();
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            send(ride.id, 'call-answer', { sdp: answer });
            setCall(c => ({ ...c, state: 'active', muted: false, startedAt: Date.now() }));
        } catch {
            toast.error('Could not start audio. Allow mic access (needs HTTPS or localhost).');
            hangup();
        }
    }, [makePc, send, toast, hangup]);

    const toggleMute = useCallback(() => {
        const track = streamRef.current?.getAudioTracks()[0];
        if (!track) return;
        track.enabled = !track.enabled;
        setCall(c => ({ ...c, muted: !track.enabled }));
    }, []);

    // One signaling channel per active ride I'm part of — lives app-wide.
    useEffect(() => {
        if (!user) return;
        const mine = rides.filter(r => r.status === 'accepted' && (r.customer_id === user.id || r.driver_id === user.id));
        mine.forEach(r => {
            if (chansRef.current[r.id]) return;
            const ch = supabase.channel(`call-${r.id}`)
                .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
                    if (payload.from === user.id) return;
                    if (callRef.current.state !== 'idle') { send(r.id, 'call-end'); return; }
                    offerRef.current = payload.sdp;
                    setCall({ state: 'ringing', ride: r, peerName: payload.name || 'Caller' });
                    notifySystem('📞 Incoming call', `${payload.name || 'Your ride partner'} is calling — open SafeRoute to answer.`);
                })
                .on('broadcast', { event: 'call-answer' }, async ({ payload }) => {
                    if (payload.from === user.id || !pcRef.current) return;
                    try {
                        await pcRef.current.setRemoteDescription(payload.sdp);
                        await flushIce();
                        setCall(c => ({ ...c, state: 'active', startedAt: Date.now() }));
                    } catch { cleanup(); }
                })
                .on('broadcast', { event: 'call-ice' }, async ({ payload }) => {
                    if (payload.from === user.id) return;
                    if (pcRef.current?.remoteDescription) {
                        try { await pcRef.current.addIceCandidate(payload.candidate); } catch { /* ignore */ }
                    } else pendingIce.current.push(payload.candidate);
                })
                .on('broadcast', { event: 'call-end' }, ({ payload }) => {
                    if (payload.from === user.id) return;
                    if (callRef.current.state !== 'idle') { toast.info('Call ended.'); cleanup(); }
                })
                .subscribe();
            chansRef.current[r.id] = ch;
        });
        Object.keys(chansRef.current).forEach(id => {
            if (!mine.some(r => r.id === id)) {
                supabase.removeChannel(chansRef.current[id]);
                delete chansRef.current[id];
            }
        });
    }, [rides, user, send, cleanup, toast]);

    useEffect(() => () => {
        cleanup();
        Object.values(chansRef.current).forEach(ch => supabase.removeChannel(ch));
        chansRef.current = {};
    }, [cleanup]);

    return (
        <RideLiveContext.Provider value={{
            rides, setRides, names, loading, isDriver,
            call, startCall, acceptCall, hangup, toggleMute, ensureNotifyPermission
        }}>
            {children}
            <GlobalCallBar call={call} onAccept={acceptCall} onHangup={hangup} onMute={toggleMute} audioRef={audioRef} />
        </RideLiveContext.Provider>
    );
};

/* Floating call bar — rendered globally so calls ring on every page */
const GlobalCallBar = ({ call, onAccept, onHangup, onMute, audioRef }) => {
    const [, tick] = useState(0);
    useEffect(() => {
        if (call.state !== 'active') return;
        const t = setInterval(() => tick(x => x + 1), 1000);
        return () => clearInterval(t);
    }, [call.state]);

    if (call.state === 'idle') return <audio ref={audioRef} autoPlay style={{ display: 'none' }} />;

    const secs = call.startedAt ? Math.floor((Date.now() - call.startedAt) / 1000) : 0;
    const mmss = `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

    return (
        <div className="call-bar">
            <audio ref={audioRef} autoPlay style={{ display: 'none' }} />
            <div className="call-info">
                <i className={`fas ${call.state === 'ringing' ? 'fa-phone-volume ringing' : 'fa-phone'}`}></i>
                <div>
                    <div style={{ fontWeight: 700, fontSize: '14px' }}>
                        {call.state === 'ringing' ? `${call.peerName} is calling…`
                            : call.state === 'calling' ? `Calling ${call.peerName || ''}…`
                                : `In call · ${mmss}`}
                    </div>
                    <div style={{ fontSize: '11px', opacity: 0.8 }}>
                        {call.ride?.pickup} → {call.ride?.destination}
                    </div>
                </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                {call.state === 'ringing' && (
                    <button className="call-btn accept" onClick={onAccept} title="Answer">
                        <i className="fas fa-phone"></i>
                    </button>
                )}
                {call.state === 'active' && (
                    <button className={`call-btn ${call.muted ? 'muted' : ''}`} onClick={onMute} title={call.muted ? 'Unmute' : 'Mute'}>
                        <i className={`fas ${call.muted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                    </button>
                )}
                <button className="call-btn end" onClick={onHangup} title={call.state === 'ringing' ? 'Decline' : 'Hang up'}>
                    <i className="fas fa-phone-slash"></i>
                </button>
            </div>
        </div>
    );
};
