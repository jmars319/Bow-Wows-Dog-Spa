export function keepBookingStageInView(target) {
  if (typeof window === 'undefined' || !(target instanceof HTMLElement)) {
    return;
  }

  const siteHeader = document.querySelector('.site-header');
  const headerHeight = siteHeader instanceof HTMLElement ? siteHeader.getBoundingClientRect().height : 0;
  const topOffset = headerHeight + 18;
  const rect = target.getBoundingClientRect();
  const topIsVisible = rect.top >= topOffset && rect.top <= window.innerHeight - 48;

  if (topIsVisible) {
    return;
  }

  window.scrollTo({
    top: Math.max(0, window.scrollY + rect.top - topOffset),
    behavior: 'smooth',
  });
}
