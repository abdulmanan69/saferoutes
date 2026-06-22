import React from 'react';

// Simple, dependency-free vertical bar chart.
export const BarChart = ({ data = [], height = 200, format = (v) => v }) => {
    const max = Math.max(1, ...data.map(d => d.value));
    return (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height, padding: '10px 0' }}>
            {data.map((d, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
                        {d.value ? format(d.value) : ''}
                    </div>
                    <div
                        title={`${d.label}: ${format(d.value)}`}
                        style={{
                            width: '100%', maxWidth: '40px',
                            height: `${(d.value / max) * 100}%`,
                            minHeight: d.value ? '6px' : '2px',
                            background: d.value ? (d.color || `linear-gradient(180deg, var(--primary), var(--accent))`) : 'var(--border)',
                            borderRadius: '6px 6px 0 0', transition: 'height 0.5s ease'
                        }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--muted, var(--muted))', marginTop: '6px', whiteSpace: 'nowrap' }}>{d.label}</div>
                </div>
            ))}
        </div>
    );
};

// SVG donut chart with a centre label.
export const DonutChart = ({ segments = [], size = 160, thickness = 22, centerTop, centerBottom }) => {
    const total = segments.reduce((s, x) => s + x.value, 0);
    const r = (size - thickness) / 2;
    const c = 2 * Math.PI * r;
    let offset = 0;

    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ flexShrink: 0 }}>
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
                {total > 0 && segments.map((seg, i) => {
                    const len = (seg.value / total) * c;
                    const el = (
                        <circle
                            key={i}
                            cx={size / 2} cy={size / 2} r={r}
                            fill="none" stroke={seg.color} strokeWidth={thickness}
                            strokeDasharray={`${len} ${c - len}`}
                            strokeDashoffset={-offset}
                            transform={`rotate(-90 ${size / 2} ${size / 2})`}
                            style={{ transition: 'stroke-dasharray 0.6s ease' }}
                        />
                    );
                    offset += len;
                    return el;
                })}
                <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '24px', fontWeight: 'bold', fill: 'var(--dark)' }}>
                    {centerTop}
                </text>
                <text x="50%" y="62%" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '10px', fill: 'var(--muted)', textTransform: 'uppercase' }}>
                    {centerBottom}
                </text>
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {segments.map((seg, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                        <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: seg.color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text)' }}>{seg.label}</span>
                        <strong style={{ marginLeft: 'auto', color: 'var(--dark)' }}>{seg.value}</strong>
                    </div>
                ))}
            </div>
        </div>
    );
};
