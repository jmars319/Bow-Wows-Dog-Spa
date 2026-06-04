import { useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { BrandLockup } from '../Branding';
import { STATUS_PAGE_CONTENT, computeLegalSections, isSectionEnabled } from '../siteConfig';
import { applySeo, applyStructuredData, buildLocalBusinessSchema, buildSimpleSeo, buildStatusSeo } from '../seo';
import { useSiteContent } from '../SiteContentContext';
import { Footer, StatusFooter } from '../components/SiteLayout';

export function SimplePage({ fallbackTitle, blockKey }) {
  const { data, loading, error } = useSiteContent();
  const section = data?.sections?.[blockKey] || {};
  const items = section.items || [];
  const title = section.title || fallbackTitle;
  const legalSections = computeLegalSections(data?.sections || {});
  const settings = data?.settings || {};
  const galleryItems = Array.isArray(data?.gallery_items) ? data.gallery_items : [];
  const showFooter = isSectionEnabled(data?.sections?.footer || {});

  useEffect(() => {
    if (loading || error || !data) {
      return;
    }

    applySeo(buildSimpleSeo(blockKey, title, items, section.enabled !== false, settings));
    applyStructuredData(buildLocalBusinessSchema(settings, data?.sections?.hero?.media, galleryItems));
  }, [blockKey, title, items, section.enabled, settings, galleryItems, loading, error, data]);

  if (loading) {
    return (
      <div className="section">
        <div className="container">
          <p>Loading…</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="section">
        <div className="container">
          <p className="status-text status-text--error">{error || 'Unable to load this page right now.'}</p>
        </div>
      </div>
    );
  }

  if (section.enabled === false) {
    return (
      <>
        <section className="section">
          <div className="container simple-page">
            <Link to="/">Back to site</Link>
            <h1>{title}</h1>
            <p className="muted-text">This page is currently unavailable.</p>
          </div>
        </section>
        {showFooter && <Footer sections={[]} legalSections={legalSections} settings={settings} content={data.sections?.footer || {}} />}
      </>
    );
  }

  return (
    <>
      <section className="section">
        <div className="container simple-page">
          <Link to="/">Back to site</Link>
          <h1>{title}</h1>
          {items.map((item, index) => (
            <article key={index} className="simple-page__item">
              {item.title && <h3>{item.title}</h3>}
              <div dangerouslySetInnerHTML={{ __html: item.body || item.text || '' }} />
            </article>
          ))}
        </div>
      </section>
      {showFooter && <Footer sections={[]} legalSections={legalSections} settings={settings} content={data.sections?.footer || {}} />}
    </>
  );
}


export function StatusPage({ pageKey }) {
  const navigate = useNavigate();
  const location = useLocation();
  const page = STATUS_PAGE_CONTENT[pageKey] || STATUS_PAGE_CONTENT.notFound;
  const showRequestedPath = page.status === 404 && location.pathname !== page.path;

  useEffect(() => {
    applySeo(buildStatusSeo(page));
    applyStructuredData(null);
  }, [page]);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate('/', { replace: true });
  };

  return (
    <div className="site-shell">
      <main>
        <section className="section status-section">
          <div className="container status-page">
            <article className="status-panel">
              <BrandLockup />
              <p className="eyebrow">{page.eyebrow}</p>
              <h1>{page.title}</h1>
              <p className="section-intro">{page.body}</p>
              {showRequestedPath && (
                <p className="status-path">
                  Requested path: <code>{location.pathname}</code>
                </p>
              )}
              <div className="status-actions">
                <button type="button" className="btn btn-outline" onClick={goBack}>
                  Back
                </button>
                <Link className="btn btn-primary" to="/">
                  Home
                </Link>
              </div>
            </article>
          </div>
        </section>
      </main>
      <StatusFooter />
    </div>
  );
}
