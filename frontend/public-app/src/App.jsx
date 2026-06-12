import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SiteContentRoute } from './public/SiteContentContext';
import { PublicPage } from './public/pages/PublicPage';
import { SimplePage, StatusPage } from './public/pages/SimplePages';

const SECTION_ROUTE_MAP = {
  '/services': 'services',
  '/booking': 'booking',
  '/request-appointment': 'booking',
  '/gallery': 'gallery',
  '/happy-customers': 'gallery',
  '/products': 'retail',
  '/reviews': 'reviews',
  '/about': 'about',
  '/contact': 'contact',
  '/faq': 'faq',
  '/policies': 'policies',
};

function PublicSectionRoute({ sectionId }) {
  return (
    <SiteContentRoute>
      <PublicPage routeSectionId={sectionId} />
    </SiteContentRoute>
  );
}

function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<SiteContentRoute><PublicPage /></SiteContentRoute>} />
        {Object.entries(SECTION_ROUTE_MAP).map(([path, sectionId]) => (
          <Route key={path} path={path} element={<PublicSectionRoute sectionId={sectionId} />} />
        ))}
        <Route path="/privacy" element={<SiteContentRoute><SimplePage fallbackTitle="Privacy Policy" blockKey="privacy" /></SiteContentRoute>} />
        <Route path="/terms" element={<SiteContentRoute><SimplePage fallbackTitle="Terms & Conditions" blockKey="terms" /></SiteContentRoute>} />
        <Route path="/status/access-denied" element={<StatusPage pageKey="accessDenied" />} />
        <Route path="/status/not-found" element={<StatusPage pageKey="notFound" />} />
        <Route path="/status/server-error" element={<StatusPage pageKey="serverError" />} />
        <Route path="/status/maintenance" element={<StatusPage pageKey="maintenance" />} />
        <Route path="*" element={<StatusPage pageKey="notFound" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
