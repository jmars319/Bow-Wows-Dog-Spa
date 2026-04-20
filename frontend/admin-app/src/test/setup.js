import '@testing-library/jest-dom/vitest';

window.confirm = () => true;

Object.defineProperty(window, 'scrollTo', {
  value: () => {},
  writable: true,
});
