import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGet, apiPost, apiPut, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock('../admin/adminApi', () => ({
  api: {
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
  },
  publicApi: {
    get: apiGet,
    post: apiPost,
    put: apiPut,
    delete: apiDelete,
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
    cleanup();
    apiGet.mockReset();
    apiPost.mockReset();
    apiPut.mockReset();
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
    fireEvent.click(screen.getByRole('button', { name: 'Preview current copy' }));
    expect(await screen.findByText('Current Copy Preview')).toBeInTheDocument();
    expect(screen.getByText('Calm grooming care')).toBeInTheDocument();
  });

  it('renders service visibility and removal controls for seasonal services', async () => {
    window.history.pushState({}, '', '/admin/services');
    apiGet.mockImplementation((url) => {
      if (url === '/me') {
        return Promise.resolve({
          data: {
            data: {
              user: { email: 'admin@example.com', role: 'super_admin' },
              allowed_sections: ['*'],
            },
          },
        });
      }

      if (url === '/services') {
        return Promise.resolve({
          data: {
            data: {
              items: [
                {
                  id: 9,
                  name: 'Seasonal Shed Treatment',
                  short_summary: 'Spring coat support',
                  duration_minutes: 30,
                  price_label: '$35+',
                  breed_weight_note: '',
                  sort_order: 0,
                  is_active: 1,
                },
              ],
            },
          },
        });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    apiPost.mockResolvedValue({ data: { success: true } });

    render(<App />);

    expect(await screen.findByText('Seasonal Shed Treatment')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit service' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide service' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Hide service' }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/services/9/active', { is_active: 0 });
    });
  });

  it('renders the change-password form and posts the expected payload', async () => {
    window.history.pushState({}, '', '/admin/change-password');
    apiGet.mockImplementation((url) => {
      if (url === '/me') {
        return Promise.resolve({
          data: {
            data: {
              user: { email: 'admin@example.com', role: 'super_admin' },
              allowed_sections: ['dashboard'],
            },
          },
        });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    apiPost.mockResolvedValue({ data: { success: true } });

    render(<App />);

    fireEvent.change(await screen.findByLabelText('Current password'), { target: { value: 'old-password' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'new-password' } });
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'new-password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Update Password' }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/change-password', {
        current_password: 'old-password',
        new_password: 'new-password',
        confirm_password: 'new-password',
      });
    });
    expect(await screen.findByText('Password updated.')).toBeInTheDocument();
  });

  it('renders media library filters, usage badges, diagnostics, and metadata editing', async () => {
    window.history.pushState({}, '', '/admin/media');
    apiGet.mockImplementation((url) => {
      if (url === '/me') {
        return Promise.resolve({
          data: {
            data: {
              user: { email: 'admin@example.com', role: 'super_admin' },
              allowed_sections: ['*'],
            },
          },
        });
      }

      if (url === '/media') {
        return Promise.resolve({
          data: {
            data: {
              items: [
                {
                  id: 7,
                  original_url: '/uploads/originals/dog.jpg',
                  fallback_url: '/uploads/originals/dog.jpg',
                  category: 'gallery',
                  mime_type: 'image/jpeg',
                  asset_type: 'image',
                  is_image: true,
                  title: 'Happy customer',
                  alt_text: '',
                  caption: 'Before pickup',
                  object_position: '50% 40%',
                  focal_x: 50,
                  focal_y: 40,
                  is_archived: false,
                  usages: [{ type: 'gallery', count: 1, label: '1 gallery item', admin_path: '/admin/gallery' }],
                  usage_labels: ['1 gallery item'],
                  diagnostics: [{ code: 'missing_alt', label: 'Alt text needed' }],
                  can_delete: false,
                },
              ],
            },
          },
        });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });
    apiPut.mockResolvedValue({ data: { success: true } });

    render(<App />);

    expect(await screen.findByText('Media Library')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(await screen.findByText('Happy customer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Used by: 1 gallery item' })).toHaveAttribute('href', '/admin/gallery');
    expect(screen.getAllByText('Alt text needed').length).toBeGreaterThan(1);

    const card = screen.getByText('Happy customer').closest('.card');
    fireEvent.click(within(card).getByRole('button', { name: 'Edit details' }));
    fireEvent.change(screen.getAllByLabelText('Alt text')[1], { target: { value: 'Dog after grooming' } });
    fireEvent.change(screen.getByLabelText('Crop focus X'), { target: { value: '42' } });
    fireEvent.change(screen.getByLabelText('Crop focus Y'), { target: { value: '38' } });
    fireEvent.click(screen.getByLabelText('Archived'));
    fireEvent.click(screen.getByRole('button', { name: 'Save details' }));

    await waitFor(() => {
      expect(apiPut).toHaveBeenCalledWith('/media/7', expect.objectContaining({
        alt_text: 'Dog after grooming',
        focal_x: '42',
        focal_y: '38',
        is_archived: true,
      }));
    });
  });

  it('renders dashboard task list shortcuts', async () => {
    window.history.pushState({}, '', '/admin/dashboard');
    apiGet.mockImplementation((url) => {
      if (url === '/me') {
        return Promise.resolve({
          data: {
            data: {
              user: { email: 'admin@example.com', role: 'super_admin' },
              allowed_sections: ['*'],
            },
          },
        });
      }

      if (url === '/dashboard') {
        return Promise.resolve({
          data: {
            data: {
              stats: { new_requests: 1, pending_confirmation: 1, confirmed_today: 0, confirmed_week: 2 },
              tasks: [
                {
                  id: 'missing_alt',
                  label: '2 images need alt text',
                  message: 'Add simple descriptions.',
                  href: '/admin/media',
                  tone: 'warning',
                },
              ],
              recent_activity: [],
            },
          },
        });
      }

      return Promise.reject(new Error(`Unexpected GET ${url}`));
    });

    render(<App />);

    expect(await screen.findByText('Task List')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /2 images need alt text/i })).toHaveAttribute('href', '/admin/media');
  });
});
