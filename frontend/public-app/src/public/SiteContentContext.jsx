import { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const SiteContentContext = createContext({ data: null, loading: true, error: null });

export function SiteContentProvider({ children }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let ignore = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('/api/public/site');
        const payload = response?.data;
        if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
          throw new Error(
            import.meta.env.DEV
              ? 'Public site data did not return valid JSON. Check /api/public/site and the backend connection.'
              : 'We could not load the site content right now.',
          );
        }

        if (!ignore) {
          setData(payload.data);
        }
      } catch (err) {
        if (!ignore) {
          setData(null);
          setError(err?.response?.data?.error?.message || err?.message || 'Unable to load site content.');
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      ignore = true;
    };
  }, []);

  return <SiteContentContext.Provider value={{ data, loading, error }}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent() {
  return useContext(SiteContentContext);
}

export function SiteContentRoute({ children }) {
  return <SiteContentProvider>{children}</SiteContentProvider>;
}
