import React, { createContext, useContext, useEffect, useState } from 'react';

// Dark background presets (reference: dark navy + violet fintech UI).
// Every preset is dark — only the tint and brand accent change.
export const THEMES = {
    violet: { label: 'Violet', bg: 'linear-gradient(135deg, #15182a 0%, #241d3f 100%)', primary: '#7c5cfc', accent: '#a78bfa', dot: '#241d3f' },
    ocean: { label: 'Ocean', bg: 'linear-gradient(135deg, #0e1626 0%, #142c4c 100%)', primary: '#3b82f6', accent: '#22d3ee', dot: '#142c4c' },
    aurora: { label: 'Aurora', bg: 'linear-gradient(135deg, #0b1a16 0%, #123a2e 100%)', primary: '#10b981', accent: '#34d399', dot: '#123a2e' },
    sunset: { label: 'Sunset', bg: 'linear-gradient(135deg, #1e0f1c 0%, #3a1030 100%)', primary: '#ec4899', accent: '#f59e0b', dot: '#3a1030' },
    slate: { label: 'Slate', bg: 'linear-gradient(135deg, #141620 0%, #232635 100%)', primary: '#6366f1', accent: '#38bdf8', dot: '#232635' }
};

const ThemeContext = createContext({});
export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => {
        const stored = localStorage.getItem('sr_theme');
        return THEMES[stored] ? stored : 'violet';
    });
    const [compact, setCompact] = useState(() => localStorage.getItem('sr_compact') === '1');

    useEffect(() => {
        const t = THEMES[theme] || THEMES.violet;
        const root = document.documentElement;
        root.style.setProperty('--app-bg', t.bg);
        root.style.setProperty('--primary', t.primary);
        root.style.setProperty('--accent', t.accent);
        document.body.style.background = t.bg;
        localStorage.setItem('sr_theme', theme);
    }, [theme]);

    useEffect(() => {
        document.documentElement.setAttribute('data-compact', compact ? '1' : '0');
        localStorage.setItem('sr_compact', compact ? '1' : '0');
    }, [compact]);

    return (
        <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES, compact, setCompact }}>
            {children}
        </ThemeContext.Provider>
    );
};
