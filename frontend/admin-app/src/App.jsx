import { BrowserRouter } from 'react-router-dom';
import { ConfirmProvider } from './admin/ConfirmProvider';
import { AuthProvider, DirtyStateProvider } from './admin/AdminShell';
import { AdminRoutes } from './admin/AdminRoutes';
import { AdminUsersPage, AuditLogPage, BookingRequestsPage, ContactMessagesPage, ContentPage, FeaturedReviewsPage, GalleryPage, MediaPage, RetailPage, SchedulePage, ServicesPage } from './admin/pages';

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <ConfirmProvider>
          <DirtyStateProvider>
            <AdminRoutes
              pages={{
                BookingRequestsPage,
                SchedulePage,
                ServicesPage,
                FeaturedReviewsPage,
                GalleryPage,
                RetailPage,
                ContentPage,
                ContactMessagesPage,
                MediaPage,
                AuditLogPage,
                AdminUsersPage,
              }}
            />
          </DirtyStateProvider>
        </ConfirmProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
