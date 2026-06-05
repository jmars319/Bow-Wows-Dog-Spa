import { BrowserRouter } from 'react-router-dom';
import { ConfirmProvider } from './admin/ConfirmProvider';
import { AuthProvider, DirtyStateProvider } from './admin/AdminShell';
import { AdminRoutes } from './admin/AdminRoutes';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ConfirmProvider>
          <DirtyStateProvider>
            <AdminRoutes />
          </DirtyStateProvider>
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
