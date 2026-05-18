import logoPrimaryPng from '../assets/logos/logo-primary.png';
import logoPrimaryWebp from '../assets/logos/logo-primary.webp';

const LOGO_WIDTH = 1536;
const LOGO_HEIGHT = 1024;
const COMPLIASSURE_SITE_SEAL = {
  imageUrl: 'https://www.rapidscansecure.com/siteseal/Seal.aspx?code=65,1A16737D200DD8330060FA24C50C3C48F287EC3C',
  verifyUrl: 'https://www.rapidscansecure.com/siteseal/Verify.aspx?code=65,1A16737D200DD8330060FA24C50C3C48F287EC3C',
};

export function BrandLockup({ compact = false }) {
  return (
    <div className={`brand-lockup ${compact ? 'brand-lockup--compact' : ''}`}>
      <picture className="brand-logo">
        <source srcSet={logoPrimaryWebp} type="image/webp" />
        <img
          src={logoPrimaryPng}
          alt="Bow Wow's Dog Spa logo"
          width={LOGO_WIDTH}
          height={LOGO_HEIGHT}
          fetchpriority="high"
        />
      </picture>
      <div>
        <strong>Bow Wow’s Dog Spa</strong>
        <span>Trusted neighborhood boutique</span>
      </div>
    </div>
  );
}

export function ResponsivePicture({ media, alt, loading = 'lazy', fetchPriority = undefined }) {
  if (!media) {
    return null;
  }

  return (
    <picture className="responsive-picture">
      {media.webp_srcset && <source type="image/webp" srcSet={media.webp_srcset} />}
      {media.optimized_srcset && <source srcSet={media.optimized_srcset} />}
      <img
        src={media.fallback_url || media.original_url}
        alt={alt || media.alt_text || media.title || "Bow Wow's Dog Spa gallery image"}
        width={media.intrinsic_width || undefined}
        height={media.intrinsic_height || undefined}
        loading={loading}
        fetchPriority={fetchPriority}
      />
    </picture>
  );
}

export function SiteSecuritySeal() {
  return (
    <div className="site-seal">
      <div className="site-seal__label">Site Security</div>
      <a
        className="site-seal__link"
        href={COMPLIASSURE_SITE_SEAL.verifyUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Verify Bow Wow's Dog Spa site security"
      >
        <img
          src={COMPLIASSURE_SITE_SEAL.imageUrl}
          alt="CompliAssure SiteSeal"
          width="160"
          height="69"
          loading="lazy"
          decoding="async"
        />
      </a>
    </div>
  );
}
