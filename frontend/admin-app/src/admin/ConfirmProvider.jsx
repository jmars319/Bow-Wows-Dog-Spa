import { ConfirmProvider, useConfirm } from '@jamarq/cpanel-admin-kit/dialogs';

export { ConfirmProvider };

export function useAdminConfirm() {
  const confirm = useConfirm();
  return (options) => {
    const next = typeof options === 'string' ? { message: options } : options || {};
    return confirm({
      ...next,
      variant: next.tone === 'danger' ? 'destructive' : 'default',
    });
  };
}
