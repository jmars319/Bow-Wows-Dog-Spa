import { test, expect } from '@playwright/test';
import { loadFixtures, rootAssetPath, uniqueLabel } from './helpers/fixtures.js';

const fixtures = loadFixtures();

async function acceptDialogs(page) {
  page.on('dialog', async (dialog) => {
    await dialog.accept();
  });
}

async function login(page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email or username').fill(fixtures.admin_email);
  await page.getByLabel('Password').fill(fixtures.admin_password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard$/);
}

test.describe.serial('stability smoke suite', () => {
  test('content edits publish to the public site', async ({ page }) => {
    const heroHeadline = uniqueLabel('E2E Hero Headline');

    await login(page);
    await page.goto('/admin/content');

    const heroSection = page.locator('[data-editor-section="hero"]');
    await heroSection.getByLabel('Hero headline').fill(heroHeadline);
    await page.getByRole('button', { name: 'Save Content' }).click();
    await expect(page.getByText('Site content saved.')).toBeVisible();

    await page.goto('/');
    await expect(page.getByRole('heading', { name: heroHeadline })).toBeVisible();
  });

  test('category and product changes appear publicly and can be removed cleanly', async ({ page }) => {
    const categoryName = uniqueLabel('E2E Category');
    const categoryNameUpdated = `${categoryName} Updated`;
    const productName = uniqueLabel('E2E Product');
    const productNameUpdated = `${productName} Updated`;

    await acceptDialogs(page);
    await login(page);
    await page.goto('/admin/retail');

    const categoryForm = page.locator('[data-retail-form="category"]');
    await categoryForm.getByLabel('Category name').fill(categoryName);
    await categoryForm.getByRole('button', { name: 'Save category' }).click();
    await expect(page.getByText('Category created.')).toBeVisible();

    const categoryCard = page.locator('.retail-category-card').filter({ hasText: categoryName }).first();
    await categoryCard.getByRole('button', { name: 'Edit' }).click();
    await categoryForm.getByLabel('Category name').fill(categoryNameUpdated);
    await categoryForm.getByRole('button', { name: 'Update category' }).click();
    await expect(page.getByText('Category updated.')).toBeVisible();

    const productForm = page.locator('[data-retail-form="product"]');
    await productForm.getByLabel('Category').selectOption({ label: categoryNameUpdated });
    await productForm.getByLabel('Product name').fill(productName);
    await productForm.getByLabel('Price').fill('12.50');
    await productForm.getByLabel('Short note').fill('E2E catalog check.');
    await productForm.getByRole('button', { name: 'Save product' }).click();
    await expect(page.getByText('Product saved.')).toBeVisible();

    await page.goto('/');
    await expect(page.getByText(productName)).toBeVisible();

    await page.goto('/admin/retail');
    const updatedCategoryCard = page.locator('.retail-category-card').filter({ hasText: categoryNameUpdated }).first();
    const productRow = updatedCategoryCard.locator('.retail-product-row').filter({ hasText: productName }).first();
    await productRow.getByRole('button', { name: 'Edit' }).click();
    await productForm.getByLabel('Product name').fill(productNameUpdated);
    await productForm.getByRole('button', { name: 'Update product' }).click();
    await expect(page.getByText('Product updated.')).toBeVisible();

    await page.goto('/');
    await expect(page.getByText(productNameUpdated)).toBeVisible();

    await page.goto('/admin/retail');
    const categoryCardForDelete = page.locator('.retail-category-card').filter({ hasText: categoryNameUpdated }).first();
    await categoryCardForDelete.locator('.retail-product-row').filter({ hasText: productNameUpdated }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Product deleted.')).toBeVisible();
    await categoryCardForDelete.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Category deleted.')).toBeVisible();

    await page.goto('/');
    await expect(page.getByText(productNameUpdated)).toHaveCount(0);
  });

  test('public booking requests can be confirmed and cancelled in admin', async ({ page }) => {
    const ownerName = uniqueLabel('E2E Owner');
    const ownerEmail = `${ownerName.toLowerCase().replace(/[^a-z0-9]+/g, '.')}@example.com`;

    await acceptDialogs(page);
    await page.goto('/#booking');
    await page.getByRole('button', { name: /Pawdicure & Face Trim/i }).click();
    await page.getByRole('button', { name: 'Continue to available times' }).click();
    await page.getByLabel('Preferred date').fill(fixtures.booking_date);
    await page.locator('[data-slot-time="09:00:00"]').click();
    await page.locator('#booking-owner-name').fill(ownerName);
    await page.locator('#booking-owner-phone').fill('(336) 555-0101');
    await page.locator('#booking-owner-email').fill(ownerEmail);
    await page.locator('#booking-dog-name-0').fill('Milo');
    await page.locator('#booking-dog-weight-0').fill('18 lbs');
    await page.getByRole('button', { name: 'Review request' }).click();
    await page.getByRole('button', { name: 'Submit appointment request' }).click();
    await expect(page.getByText('Request submitted. Our team will review it and confirm within 24 hours.')).toBeVisible();

    await login(page);
    await page.goto('/admin/booking');
    const requestCard = page.locator('.booking-card').filter({ hasText: ownerName }).first();
    const detailPanel = page.locator('.booking-detail');
    await requestCard.click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('Booking confirmed.')).toBeVisible();
    await expect(detailPanel.locator('.status-badge')).toContainText('Confirmed');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('Booking cancelled.')).toBeVisible();
    await expect(detailPanel.locator('.status-badge')).toContainText('Cancelled');
  });

  test('media still attached to products cannot be deleted', async ({ page }) => {
    const mediaTitle = uniqueLabel('E2E Media');
    const mediaAlt = `${mediaTitle} Alt`;
    const categoryName = uniqueLabel('E2E Media Category');
    const productName = uniqueLabel('E2E Media Product');
    const uploadFile = rootAssetPath('frontend/public-app/src/assets/logos/logo-primary.png');

    await acceptDialogs(page);
    await login(page);
    await page.goto('/admin/media');
    await page.getByLabel('Alt text').fill(mediaAlt);
    await page.getByLabel('Title').fill(mediaTitle);
    await page.getByLabel('Library category').selectOption('retail');
    await page.getByLabel('File').setInputFiles(uploadFile);
    await page.getByRole('button', { name: 'Upload' }).click();
    await expect(page.getByText('Upload complete')).toBeVisible();

    await page.goto('/admin/retail');
    const categoryForm = page.locator('[data-retail-form="category"]');
    await categoryForm.getByLabel('Category name').fill(categoryName);
    await categoryForm.getByRole('button', { name: 'Save category' }).click();
    await expect(page.getByText('Category created.')).toBeVisible();

    const productForm = page.locator('[data-retail-form="product"]');
    await productForm.getByLabel('Category').selectOption({ label: categoryName });
    await productForm.getByLabel('Product name').fill(productName);
    await productForm.getByRole('button', { name: 'Choose image' }).click();
    const picker = page.getByRole('dialog', { name: 'Select media' });
    await picker.getByAltText(mediaAlt).click();
    await productForm.getByRole('button', { name: 'Save product' }).click();
    await expect(page.getByText('Product saved.')).toBeVisible();

    await page.goto('/admin/media');
    await page.getByRole('button', { name: 'retail' }).click();
    const mediaCard = page.locator('[data-media-id]').filter({ hasText: mediaTitle }).first();
    await mediaCard.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(/still being used by 1 product/i)).toBeVisible();
  });
});
