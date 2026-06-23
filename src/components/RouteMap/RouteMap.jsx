import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icons broken by bundlers (done once, here).
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PAKISTAN = [30.3753, 69.3451];

const FitBounds = ({ coords, disabled }) => {
    const map = useMap();
    useEffect(() => {
        if (disabled) return;
        if (coords && coords.length > 1) {
            try { map.fitBounds(coords, { padding: [40, 40] }); } catch { /* ignore */ }
        } else if (coords && coords.length === 1) {
            map.setView(coords[0], 9);
        }
    }, [coords, map, disabled]);
    return null;
};

// Keeps the viewport locked on the live position while a journey is active.
const FollowPosition = ({ current, follow }) => {
    const map = useMap();
    useEffect(() => {
        if (follow && current) map.setView([current.lat, current.lng], Math.max(map.getZoom(), 11), { animate: true });
    }, [current, follow, map]);
    return null;
};

// start/end: { lat, lng, label }. route: [[lat,lng]...]. alternatives: [[[lat,lng]...]].
// current: live GPS position { lat, lng }. follow: keep the camera on `current`.
const RouteMap = ({ start, end, route, alternatives = [], height = 340, zoom = 6, current = null, follow = false }) => {
    const center = start ? [start.lat, start.lng] : PAKISTAN;
    const points = [];
    if (start) points.push([start.lat, start.lng]);
    if (end) points.push([end.lat, end.lng]);
    const fit = route?.length ? route : points;

    return (
        <MapContainer center={center} zoom={zoom} style={{ width: '100%', height }} scrollWheelZoom={false}>
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {alternatives.map((alt, i) => (
                <Polyline key={`alt-${i}`} positions={alt} pathOptions={{ color: '#94a3b8', weight: 4, opacity: 0.45, dashArray: '8 8' }} />
            ))}
            {route?.length > 0 && (
                <Polyline positions={route} pathOptions={{ color: '#2563eb', weight: 5, opacity: 0.9 }} />
            )}
            {start && <Marker position={[start.lat, start.lng]}><Popup>{start.label || 'Start'}</Popup></Marker>}
            {end && <Marker position={[end.lat, end.lng]}><Popup>{end.label || 'Destination'}</Popup></Marker>}
            {current && (
                <>
                    <CircleMarker center={[current.lat, current.lng]} radius={14}
                        pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.15, weight: 1 }} />
                    <CircleMarker center={[current.lat, current.lng]} radius={7}
                        pathOptions={{ color: 'white', fillColor: '#2563eb', fillOpacity: 1, weight: 3 }}>
                        <Popup>You are here</Popup>
                    </CircleMarker>
                </>
            )}
            <FitBounds coords={fit} disabled={follow} />
            <FollowPosition current={current} follow={follow} />
        </MapContainer>
    );
};

export default RouteMap;
