import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { axiosGet, axiosPost } = vi.hoisted(() => ({
  axiosGet: vi.fn(),
  axiosPost: vi.fn(),
}));

vi.mock('axios', () => ({
  default: {
    get: axiosGet,
    post: axiosPost,
  },
}));

import App from '../App';

function createPayload(overrides = {}) {
  const base = {
    settings: {
      business_name: "Bow Wow's Dog Spa",
      phone: '(336) 842-3723',
      email: 'hello@example.com',
      address: '11141 Old U.S. Hwy 52 #4',
      hours: 'Mon-Thurs 10a-5p',
      social_facebook: '',
      social_instagram: '',
      maps_url: '',
      google_reviews_url: '',
      google_review_rating: '',
      google_review_count: '',
    },
    sections: {
      hero: { enabled: true, headline: 'Calm grooming care', subheading: '<p>Comfort-first visits.</p>' },
      trust: { enabled: false, points: [] },
      services: { enabled: false },
      booking: { enabled: false },
      gallery: { enabled: false },
      retail: { enabled: true, title: 'Boutique Products', body: '<p>Shop the shelf.</p>' },
      reviews: { enabled: false },
      about: { enabled: false },
      location: { enabled: false },
      contact: { enabled: false },
      faq: { enabled: false, items: [] },
      policies: { enabled: false, items: [] },
      privacy: { enabled: true, title: 'Privacy Policy', items: [{ title: 'Info use', body: '<p>We only use intake info to schedule care.</p>' }] },
      terms: { enabled: true, title: 'Terms & Conditions', items: [{ title: 'Appointments', body: '<p>Requests are reviewed before confirmation.</p>' }] },
      footer: { enabled: false, tagline: 'Trusted neighborhood boutique grooming for Greater Winston-Salem and Triad families.' },
    },
    services: [],
    featured_reviews: [],
    gallery_items: [],
    retail_categories: [
      {
        id: 1,
        name: 'Treats',
        items: [
          {
            id: 11,
            category_id: 1,
            name: 'Blueberry Biscuits',
            description: 'Front-counter favorite',
            price_label: '$8.99',
            media: null,
          },
        ],
      },
    ],
  };

  return {
    data: {
      ...base,
      ...overrides,
      settings: {
        ...base.settings,
        ...(overrides.settings || {}),
      },
      sections: {
        ...base.sections,
        ...(overrides.sections || {}),
      },
    },
  };
}

describe('public app', () => {
  beforeEach(() => {
    axiosGet.mockReset();
    axiosPost.mockReset();
    window.history.pushState({}, '', '/');
    document.head.innerHTML = '';
  });

  it('renders the live products section and hides the footer when disabled', async () => {
    axiosGet.mockResolvedValueOnce({ data: createPayload() });

    render(<App />);

    expect(await screen.findByText('Boutique Products')).toBeInTheDocument();
    expect(screen.getByText('Blueberry Biscuits')).toBeInTheDocument();
    expect(screen.queryByText('Trusted neighborhood boutique grooming for Greater Winston-Salem and Triad families.')).not.toBeInTheDocument();
  });

  it('shows unavailable messaging for disabled legal pages without rendering the footer', async () => {
    window.history.pushState({}, '', '/privacy');
    axiosGet.mockResolvedValueOnce({
      data: createPayload({
        sections: {
          privacy: { enabled: false, title: 'Privacy Policy', items: [] },
          footer: { enabled: false, tagline: 'Hidden footer' },
        },
      }),
    });

    render(<App />);

    expect(await screen.findByText('This page is currently unavailable.')).toBeInTheDocument();
    expect(screen.queryByText('Hidden footer')).not.toBeInTheDocument();
  });

  it('uses client-demo form semantics and stable brand image sizing on visible public sections', async () => {
    axiosGet.mockResolvedValueOnce({
      data: createPayload({
        sections: {
          retail: { enabled: false },
          contact: { enabled: true, title: 'Contact Us' },
          location: { enabled: true, title: 'Location & hours' },
        },
        retail_categories: [],
      }),
    });

    render(<App />);

    expect(await screen.findByRole('button', { name: 'Send Message' })).toBeInTheDocument();

    const logo = screen.getAllByAltText("Bow Wow's Dog Spa logo")[0];
    expect(logo).toHaveAttribute('width', '1536');
    expect(logo).toHaveAttribute('height', '1024');

    const skipLink = screen.getAllByRole('link', { name: 'Skip to main content' })[0];
    expect(skipLink).toHaveAttribute('href', '#main-content');

    const emailInput = screen.getByLabelText('Email');
    expect(emailInput).toHaveAttribute('type', 'email');
    expect(emailInput).toHaveAttribute('autocomplete', 'email');
    expect(emailInput).toHaveAttribute('spellcheck', 'false');

    const phoneInput = screen.getByLabelText('Phone');
    expect(phoneInput).toHaveAttribute('type', 'tel');
    expect(phoneInput).toHaveAttribute('autocomplete', 'tel');
    expect(phoneInput).toHaveAttribute('inputmode', 'tel');
  });

  it('opens a full mobile navigation drawer when the menu button is pressed', async () => {
    axiosGet.mockResolvedValueOnce({ data: createPayload() });

    render(<App />);

    const [menuButton] = await screen.findAllByRole('button', { name: 'Open site navigation' });
    expect(document.getElementById('site-nav-drawer')).not.toBeInTheDocument();

    fireEvent.click(menuButton);

    expect(document.getElementById('site-nav-drawer')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Privacy' })).toBeInTheDocument();
    expect(document.body).toHaveClass('has-site-nav-open');
  });
});
