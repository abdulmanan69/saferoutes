import React, { useEffect, useState } from 'react';

const isStandalone = () =>
    window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// Floating "Install App" pill. Uses the real browser install prompt on
// Chrome/Edge/Android (beforeinstallprompt); shows instructions on iOS.
const InstallPrompt = () => {
    const [deferred, setDeferred] = useState(null);
    const [showIOS, setShowIOS] = useState(false);
    const [hidden, setHidden] = useState(() => localStorage.getItem('sr_install_dismissed') === '1');

    useEffect(() => {
        if (isStandalone()) return; // already installed
        const onPrompt = (e) => {
            e.preventDefault();
            setDeferred(e);
        };
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', () => { setDeferred(null); setHidden(true); });

        // iOS never fires beforeinstallprompt — offer instructions instead.
        if (isIOS()) setShowIOS(true);

        return () => window.removeEventListener('beforeinstallprompt', onPrompt);
    }, []);

    const install = async () => {
        if (deferred) {
            deferred.prompt();
            const { outcome } = await deferred.userChoice;
            if (outcome === 'accepted') setHidden(true);
            setDeferred(null);
        } else if (showIOS) {
            alert('Install SafeRoute on iPhone/iPad:\n\n1. Tap the Share button (square with arrow)\n2. Scroll and tap "Add to Home Screen"\n3. Tap Add — SafeRoute appears as an app!');
        }
    };

    const dismiss = () => {
        setHidden(true);
        localStorage.setItem('sr_install_dismissed', '1');
    };

    if (hidden || isStandalone() || (!deferred && !showIOS)) return null;

    return (
        <div className="install-pill pop-in">
            <button className="install-btn" onClick={install}>
                <i className="fas fa-download"></i>
                Install SafeRoute App
            </button>
            <button className="install-x" onClick={dismiss} title="Dismiss">
                <i className="fas fa-times"></i>
            </button>
        </div>
    );
};

export default InstallPrompt;
