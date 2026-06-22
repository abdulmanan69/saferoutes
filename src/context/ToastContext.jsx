import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext({});
export const useToast = () => useContext(ToastContext);

let counter = 0;

const ICONS = {
    success: 'fa-circle-check',
    error: 'fa-circle-exclamation',
    warning: 'fa-triangle-exclamation',
    info: 'fa-circle-info'
};

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const remove = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);

    const push = useCallback((message, type = 'success', timeout = 3500) => {
        const id = ++counter;
        setToasts(t => [...t, { id, message, type }]);
        if (timeout) setTimeout(() => remove(id), timeout);
        return id;
    }, [remove]);

    const toast = {
        success: (m, t) => push(m, 'success', t),
        error: (m, t) => push(m, 'error', t),
        warning: (m, t) => push(m, 'warning', t),
        info: (m, t) => push(m, 'info', t)
    };

    return (
        <ToastContext.Provider value={toast}>
            {children}
            <div className="toast-wrap">
                {toasts.map(t => (
                    <div key={t.id} className={`toast toast-${t.type}`} onClick={() => remove(t.id)}>
                        <i className={`fas ${ICONS[t.type]}`}></i>
                        <span>{t.message}</span>
                        <i className="fas fa-times toast-close"></i>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
