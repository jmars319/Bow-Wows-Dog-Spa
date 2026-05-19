import { Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_BASE, AdminLayout, RequireAuth } from './AdminShell';
import { CalendarSyncPage } from '../pages/CalendarSyncPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { SystemPage } from '../pages/SystemPage';

export function AdminRoutes({ pages }) {
  const {
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
  } = pages;

  return (
    <Routes>
      <Route path="/" element={<Navigate to={`${ADMIN_BASE}/login`} replace />} />
      <Route path="/login" element={<Navigate to={`${ADMIN_BASE}/login`} replace />} />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route path={ADMIN_BASE} element={<Navigate to={`${ADMIN_BASE}/dashboard`} replace />} />
          <Route path={`${ADMIN_BASE}/dashboard`} element={<DashboardPage />} />
          <Route path={`${ADMIN_BASE}/booking`} element={<BookingRequestsPage />} />
          <Route path={`${ADMIN_BASE}/schedule`} element={<SchedulePage />} />
          <Route path={`${ADMIN_BASE}/services`} element={<ServicesPage />} />
          <Route path={`${ADMIN_BASE}/reviews`} element={<FeaturedReviewsPage />} />
          <Route path={`${ADMIN_BASE}/gallery`} element={<GalleryPage />} />
          <Route path={`${ADMIN_BASE}/happy-clients`} element={<Navigate to={`${ADMIN_BASE}/gallery`} replace />} />
          <Route path={`${ADMIN_BASE}/retail`} element={<RetailPage />} />
          <Route path={`${ADMIN_BASE}/content`} element={<ContentPage />} />
          <Route path={`${ADMIN_BASE}/contacts`} element={<ContactMessagesPage />} />
          <Route path={`${ADMIN_BASE}/media`} element={<MediaPage />} />
          <Route path={`${ADMIN_BASE}/audit`} element={<AuditLogPage />} />
          <Route path={`${ADMIN_BASE}/users`} element={<AdminUsersPage />} />
          <Route path={`${ADMIN_BASE}/calendar-sync`} element={<CalendarSyncPage />} />
          <Route path={`${ADMIN_BASE}/system`} element={<SystemPage />} />
        </Route>
      </Route>
      <Route path={`${ADMIN_BASE}/login`} element={<LoginPage />} />
      <Route path="*" element={<Navigate to={`${ADMIN_BASE}/login`} replace />} />
    </Routes>
  );
}
