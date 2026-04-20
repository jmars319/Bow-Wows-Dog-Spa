import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet, apiPost, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    create: () => ({
      get: apiGet,
      post: apiPost,
      delete: apiDelete,
    }),
  },
}));

vi.mock('../RichTextEditor', () => ({
  default: ({ value = '', onChange }) => (
    <textarea
      aria-label="Rich text editor"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

import App from '../App';

function createContentPayload() {
  return {
    settings: {
      business_name: "Bow Wow's Dog Spa",
      phone: '(336) 842-3723',
      email: 'hello@example.com',
      address: '11141 Old U.S. Hwy 52 #4',
      hours: 'Mon-Thurs 10a-5p',
    },
    sections: {
      hero: { enabled: true, headline: 'Calm grooming care', subheading: '<p>Comfort-first visits.</p>' },
      trust: { enabled: false, points: [] },
      services: { enabled: false },
      booking: { enabled: false },
      gallery: { enabled: false },
      reviews: { enabled: false },
      about: { enabled: false },
      location: { enabled: true, title: 'Location & hours', note: '<p>Neighborhood shop.</p>' },
      contact: { enabled: true, title: 'Contact Bow Wow’s', note: '<p>Questions welcome.</p>' },
      retail: { enabled: true, title: 'Boutique Products', body: '<p>Updates automatically.</p>' },
      footer: { enabled: true, tagline: 'Trusted neighborhood boutique grooming for Greater Winston-Salem and Triad families.' },
      faq: { enabled: false, items: [] },
      policies: { enabled: false, items: [] },
      privacy: { enabled: true, title: 'Privacy Policy', items: [] },
      terms: { enabled: true, title: 'Terms & Conditions', items: [] },
    },
  };
}

describe('admin app', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiDelete.mockReset();
    window.history.pushState({}, '', '/admin/content');

    apiGet.mockImplementation((url) => {
      if (url === '/me') {
        return Promise.resolve({
          data: {
            data: {
              user: { email: 'admin@example.com', role: 'super_admin' },
              allowed_sections: ['dashboard', 'content'],
            },
          },
        });
      }

      if (url === '/content/site') {
        return Promise.resolve({
          data: {
            data: createContentPayload(),
          },
        });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
  });

  it('renders products and footer controls inside the content editor', async () => {
    render(<App />);

    expect(await screen.findByText('Products Section')).toBeInTheDocument();
    expect(screen.getByLabelText('Show products section')).toBeInTheDocument();
    expect(screen.getByLabelText('Show footer')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Boutique Products')).toBeInTheDocument();
  });
});
