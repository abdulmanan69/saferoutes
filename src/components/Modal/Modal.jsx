import React from 'react';

export const Modal = ({ open, onClose, title, icon, children, footer, width = 480 }) => {
    if (!open) return null;
    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-box" style={{ maxWidth: width }} onClick={e => e.stopPropagation()}>
                <div className="modal-head">
                    <div className="card-title" style={{ margin: 0 }}>
                        {icon && <i className={`fas ${icon}`}></i>}
                        {title}
                    </div>
                    <button className="modal-x" onClick={onClose}><i className="fas fa-times"></i></button>
                </div>
                <div className="modal-body">{children}</div>
                {footer && <div className="modal-foot">{footer}</div>}
            </div>
        </div>
    );
};

export const ConfirmDialog = ({ open, onClose, onConfirm, title = 'Are you sure?', message, confirmLabel = 'Confirm', danger = true, loading = false }) => (
    <Modal open={open} onClose={onClose} title={title} icon={danger ? 'fa-triangle-exclamation' : 'fa-circle-question'} width={420}
        footer={
            <>
                <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={onClose} disabled={loading}>Cancel</button>
                <button
                    className="btn"
                    style={{ width: 'auto', background: danger ? '#ef4444' : 'var(--primary)', color: 'white' }}
                    onClick={onConfirm}
                    disabled={loading}
                >
                    {loading ? <i className="fas fa-spinner fa-spin"></i> : confirmLabel}
                </button>
            </>
        }
    >
        <p style={{ color: 'var(--text)', lineHeight: 1.6, fontSize: '14px' }}>{message}</p>
    </Modal>
);

export default Modal;
