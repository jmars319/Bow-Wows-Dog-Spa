import { createContext, useCallback, useContext, useRef, useState } from 'react';

const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolverRef = useRef(null);

  const close = useCallback((confirmed) => {
    const resolver = resolverRef.current;
    resolverRef.current = null;
    setDialog(null);
    resolver?.(confirmed);
  }, []);

  const confirm = useCallback((options) => {
    const next = typeof options === 'string' ? { message: options } : options || {};
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setDialog({
        title: next.title || 'Confirm action',
        message: next.message || 'Continue?',
        confirmLabel: next.confirmLabel || 'Continue',
        cancelLabel: next.cancelLabel || 'Cancel',
        tone: next.tone || 'warn',
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="modal" role="presentation">
          <div className="modal__backdrop" onClick={() => close(false)} />
          <div className="modal__content confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="admin-confirm-title">
            <div className="modal__header">
              <h2 id="admin-confirm-title">{dialog.title}</h2>
              <button className="btn btn-tertiary" onClick={() => close(false)}>
                Close
              </button>
            </div>
            <p>{dialog.message}</p>
            <div className="confirm-dialog__actions">
              <button className="btn btn-tertiary" onClick={() => close(false)}>
                {dialog.cancelLabel}
              </button>
              <button className={`btn ${dialog.tone === 'danger' ? 'btn-warn' : ''}`} onClick={() => close(true)}>
                {dialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useAdminConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error('useAdminConfirm must be used inside ConfirmProvider');
  }
  return confirm;
}
