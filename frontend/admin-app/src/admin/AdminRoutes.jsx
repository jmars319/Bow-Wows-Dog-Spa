import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { ADMIN_BASE, AdminLayout, RequireAuth } from './AdminShell';
import { CalendarSyncPage } from '../pages/CalendarSyncPage';
import { DashboardPage } from '../pages/DashboardPage';
import { LoginPage } from '../pages/LoginPage';
import { SystemPage } from '../pages/SystemPage';

const lazyNamed = (loader, exportName) => lazy(() => loader().then((module) => ({ default: module[exportName] })));

const BookingRequestsPage = lazyNamed(() => import('./pages/BookingRequestsPage'), 'BookingRequestsPage');
const SchedulePage = lazyNamed(() => import('./pages/SchedulePage'), 'SchedulePage');
const ServicesPage = lazyNamed(() => import('./pages/CatalogPages'), 'ServicesPage');
const FeaturedReviewsPage = lazyNamed(() => import('./pages/CatalogPages'), 'FeaturedReviewsPage');
const GalleryPage = lazyNamed(() => import('./pages/CatalogPages'), 'GalleryPage');
const ContactMessagesPage = lazyNamed(() => import('./pages/CatalogPages'), 'ContactMessagesPage');
const RetailPage = lazyNamed(() => import('./pages/RetailPage'), 'RetailPage');
const ContentPage = lazyNamed(() => import('./pages/ContentPage'), 'ContentPage');
const MediaPage = lazyNamed(() => import('./pages/MediaSystemPages'), 'MediaPage');
const AuditLogPage = lazyNamed(() => import('./pages/MediaSystemPages'), 'AuditLogPage');
const AdminUsersPage = lazyNamed(() => import('./pages/MediaSystemPages'), 'AdminUsersPage');
const ChangePasswordPage = lazyNamed(() => import('./pages/MediaSystemPages'), 'ChangePasswordPage');

const lazyRoute = (Component) => (
  <Suspense fallback={<div className="card">Loading admin section...</div>}>
    <Component />
  </Suspense>
);

export function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to={`${ADMIN_BASE}/login`} replace />} />
      <Route path="/login" element={<Navigate to={`${ADMIN_BASE}/login`} replace />} />
      <Route element={<RequireAuth />}>
        <Route element={<AdminLayout />}>
          <Route path={ADMIN_BASE} element={<Navigate to={`${ADMIN_BASE}/dashboard`} replace />} />
          <Route path={`${ADMIN_BASE}/dashboard`} element={<DashboardPage />} />
          <Route path={`${ADMIN_BASE}/booking`} element={lazyRoute(BookingRequestsPage)} />
          <Route path={`${ADMIN_BASE}/schedule`} element={lazyRoute(SchedulePage)} />
          <Route path={`${ADMIN_BASE}/services`} element={lazyRoute(ServicesPage)} />
          <Route path={`${ADMIN_BASE}/reviews`} element={lazyRoute(FeaturedReviewsPage)} />
          <Route path={`${ADMIN_BASE}/gallery`} element={lazyRoute(GalleryPage)} />
          <Route path={`${ADMIN_BASE}/happy-clients`} element={<Navigate to={`${ADMIN_BASE}/gallery`} replace />} />
          <Route path={`${ADMIN_BASE}/retail`} element={lazyRoute(RetailPage)} />
          <Route path={`${ADMIN_BASE}/content`} element={lazyRoute(ContentPage)} />
          <Route path={`${ADMIN_BASE}/contacts`} element={lazyRoute(ContactMessagesPage)} />
          <Route path={`${ADMIN_BASE}/media`} element={lazyRoute(MediaPage)} />
          <Route path={`${ADMIN_BASE}/audit`} element={lazyRoute(AuditLogPage)} />
          <Route path={`${ADMIN_BASE}/users`} element={lazyRoute(AdminUsersPage)} />
          <Route path={`${ADMIN_BASE}/change-password`} element={lazyRoute(ChangePasswordPage)} />
          <Route path={`${ADMIN_BASE}/calendar-sync`} element={<CalendarSyncPage />} />
          <Route path={`${ADMIN_BASE}/system`} element={<SystemPage />} />
        </Route>
      </Route>
      <Route path={`${ADMIN_BASE}/login`} element={<LoginPage />} />
      <Route path="*" element={<Navigate to={`${ADMIN_BASE}/login`} replace />} />
    </Routes>
  );
}
