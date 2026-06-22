import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { PublicPreviewLink, PublishState, SortOrderTools, reorderedItems } from '@jamarq/cpanel-admin-kit/convenience';
import { useAdminConfirm } from '../ConfirmProvider';
import { api, useAuth } from '../AdminShell';
import { BOOKING_STAT_LABELS, BOOKING_STAT_ORDER, StatusBadge, getBookingActions, parseServices, summarizePets, summarizeServices } from '../bookingDisplay';
import { EditorSection, ListEditor, RichTextEditor, SectionEnabledToggle } from '../ContentEditorControls';
import { ManualBookingLauncher } from '../ManualBooking';
import { MediaPicker, MediaPicture } from '../MediaPicker';
import { formatDateLabel, formatDateTime, formatMetadata, formatTimeAgo, formatTimeLabel, formatTimeRange, renderHoldExpiry, truncateText, getHoldInfo } from '../formatters';
import { createRetailCategoryForm, createRetailProductForm } from '../retailDefaults';
import { buildScheduleTimeOptions, formatScheduleTime, minutesToScheduleValue, normalizeAdminTimeInput, sortScheduleTimes, timeValueToMinutes, toggleScheduleTime } from '../scheduleTime';

export const DEFAULT_RETAIL_PRODUCT_OPTIONS = {
  online_sale_status: [
    { value: 'catalog_only', label: 'Catalog only for now' },
    { value: 'ready', label: 'Okay to sell online later' },
    { value: 'in_store_only', label: 'Keep in-store only' },
  ],
  inventory_status: [
    { value: 'untracked', label: 'Not tracked yet' },
    { value: 'in_stock', label: 'In stock' },
    { value: 'limited', label: 'Low or limited' },
    { value: 'out_of_stock', label: 'Out of stock' },
  ],
  fulfillment_mode: [
    { value: 'undecided', label: 'Undecided' },
    { value: 'pickup_only', label: 'Pickup only' },
    { value: 'ship_or_pickup', label: 'Can ship or pickup' },
  ],
};

export function RetailPage() {
  const confirm = useAdminConfirm();

  // Retail catalog state
  const [categories, setCategories] = useState([]);
  const [commerce, setCommerce] = useState({ mode: 'catalog_only', mode_label: 'Catalog only', checkout_enabled: false });
  const [productOptions, setProductOptions] = useState(DEFAULT_RETAIL_PRODUCT_OPTIONS);
  const [loading, setLoading] = useState(true);
  const [categoryForm, setCategoryForm] = useState(createRetailCategoryForm());
  const [productForm, setProductForm] = useState(createRetailProductForm());
  const [categoryFeedback, setCategoryFeedback] = useState(null);
  const [productFeedback, setProductFeedback] = useState(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [savingProduct, setSavingProduct] = useState(false);
  const [draggedCategory, setDraggedCategory] = useState(null);
  const [draggedProduct, setDraggedProduct] = useState(null);
  const [retailSearch, setRetailSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get('/retail');
      setCategories(response.data.data.categories || []);
      setCommerce(response.data.data.commerce || { mode: 'catalog_only', mode_label: 'Catalog only', checkout_enabled: false });
      setProductOptions(response.data.data.product_options || DEFAULT_RETAIL_PRODUCT_OPTIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (productForm.id || productForm.category_id || categories.length === 0) {
      return;
    }

    setProductForm((current) => ({
      ...current,
      category_id: String(categories[0].id),
    }));
  }, [categories, productForm.category_id, productForm.id]);

  const resetCategoryForm = () => {
    setCategoryForm(createRetailCategoryForm());
  };

  const resetProductForm = (nextCategoryId = '') => {
    const fallbackCategoryId = nextCategoryId || (categories[0] ? String(categories[0].id) : '');
    setProductForm(createRetailProductForm(fallbackCategoryId));
  };

  // Retail save workflow
  const saveCategory = async (event) => {
    event.preventDefault();
    setSavingCategory(true);
    setCategoryFeedback(null);

    try {
      const response = await api.post('/retail/categories', {
        id: categoryForm.id || undefined,
        name: categoryForm.name,
        is_published: categoryForm.is_published ? 1 : 0,
        ...(categoryForm.id || Number(categoryForm.sort_order) > 0 ? { sort_order: Number(categoryForm.sort_order) || 0 } : {}),
      });

      const savedCategory = response.data.data.category;
      await load();
      resetCategoryForm();
      setCategoryFeedback({
        tone: 'success',
        message: categoryForm.id ? 'Category updated.' : 'Category created.',
      });
      setProductForm((current) => {
        if (current.category_id) {
          return current;
        }

        return {
          ...current,
          category_id: String(savedCategory.id),
        };
      });
    } catch (err) {
      setCategoryFeedback({
        tone: 'error',
        message: err.response?.data?.error?.message ?? 'Unable to save category.',
      });
    } finally {
      setSavingCategory(false);
    }
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    setSavingProduct(true);
    setProductFeedback(null);

    try {
      const response = await api.post('/retail', {
        id: productForm.id || undefined,
        category_id: productForm.category_id ? Number(productForm.category_id) : null,
        name: productForm.name,
        sku: productForm.sku,
        description: productForm.description,
        price_cents: productForm.price ? Math.round(Number(productForm.price) * 100) : null,
        media_id: productForm.media?.id ?? null,
        online_sale_status: productForm.online_sale_status,
        inventory_status: productForm.inventory_status,
        fulfillment_mode: productForm.fulfillment_mode,
        is_published: productForm.is_published ? 1 : 0,
        ...(productForm.id || Number(productForm.sort_order) > 0 ? { sort_order: Number(productForm.sort_order) || 0 } : {}),
      });

      const savedItem = response.data.data.item;
      await load();
      resetProductForm(savedItem.category_id ? String(savedItem.category_id) : '');
      setProductFeedback({
        tone: 'success',
        message: productForm.id ? 'Product updated.' : 'Product saved.',
      });
    } catch (err) {
      setProductFeedback({
        tone: 'error',
        message: err.response?.data?.error?.message ?? 'Unable to save product.',
      });
    } finally {
      setSavingProduct(false);
    }
  };

  const editCategory = (category) => {
    setCategoryFeedback(null);
    setCategoryForm({
      id: category.id,
      name: category.name,
      is_published: Boolean(category.is_published),
      sort_order: category.sort_order || 0,
    });
  };

  const editProduct = (item) => {
    setProductFeedback(null);
    setProductForm({
      id: item.id,
      category_id: item.category_id ? String(item.category_id) : '',
      name: item.name,
      sku: item.sku || '',
      description: item.description ?? '',
      price: item.price_cents ? (item.price_cents / 100).toFixed(2) : '',
      media: item.media ?? null,
      online_sale_status: item.online_sale_status || 'catalog_only',
      inventory_status: item.inventory_status || 'untracked',
      fulfillment_mode: item.fulfillment_mode || 'undecided',
      is_published: Boolean(item.is_published),
      sort_order: item.sort_order || 0,
    });
  };

  const duplicateCategory = (category) => {
    setCategoryFeedback({ tone: 'success', message: 'Category copied into the editor. Review it, then save.' });
    setCategoryForm({
      id: null,
      name: `${category.name} copy`,
      is_published: Boolean(category.is_published),
      sort_order: Number(category.sort_order || 0) + 10,
    });
  };

  const duplicateProduct = (item) => {
    setProductFeedback({ tone: 'success', message: 'Product copied into the editor. Review it, then save.' });
    setProductForm({
      id: null,
      category_id: item.category_id ? String(item.category_id) : '',
      name: `${item.name} copy`,
      sku: '',
      description: item.description ?? '',
      price: item.price_cents ? (item.price_cents / 100).toFixed(2) : '',
      media: item.media ?? null,
      online_sale_status: item.online_sale_status || 'catalog_only',
      inventory_status: item.inventory_status || 'untracked',
      fulfillment_mode: item.fulfillment_mode || 'undecided',
      is_published: Boolean(item.is_published),
      sort_order: Number(item.sort_order || 0) + 10,
    });
  };

  const startProductForCategory = (categoryId) => {
    setProductFeedback(null);
    setProductForm(createRetailProductForm(String(categoryId)));
  };

  // Retail delete workflow
  const deleteCategory = async (category) => {
    if (!(await confirm({
      message: `Delete "${category.name}"? Categories can only be deleted when they are empty.`,
      confirmLabel: 'Delete category',
      tone: 'danger',
    }))) {
      return;
    }

    setCategoryFeedback(null);
    const remainingCategoryId = categories.find((item) => item.id !== category.id)?.id;
    try {
      await api.delete(`/retail/categories/${category.id}`);
      await load();
      if (categoryForm.id === category.id) {
        resetCategoryForm();
      }
      if (productForm.category_id === String(category.id)) {
        resetProductForm(remainingCategoryId ? String(remainingCategoryId) : '');
      }
      setCategoryFeedback({ tone: 'success', message: 'Category deleted.' });
    } catch (err) {
      setCategoryFeedback({
        tone: 'error',
        message: err.response?.data?.error?.message ?? 'Unable to delete category.',
      });
    }
  };

  const deleteProduct = async (item) => {
    if (!(await confirm({ message: `Delete "${item.name}"?`, confirmLabel: 'Delete product', tone: 'danger' }))) {
      return;
    }

    setProductFeedback(null);
    try {
      await api.delete(`/retail/items/${item.id}`);
      await load();
      if (productForm.id === item.id) {
        resetProductForm(item.category_id ? String(item.category_id) : '');
      }
      setProductFeedback({ tone: 'success', message: 'Product deleted.' });
    } catch (err) {
      setProductFeedback({
        tone: 'error',
        message: err.response?.data?.error?.message ?? 'Unable to delete product.',
      });
    }
  };

  const totalProducts = categories.reduce((sum, category) => sum + (category.items?.length || 0), 0);

  // Retail catalog surface
  const filteredCategories = useMemo(() => {
    const query = retailSearch.trim().toLowerCase();
    if (!query) {
      return categories;
    }
    return categories
      .map((category) => {
        const categoryMatches = [category.name].filter(Boolean).join(' ').toLowerCase().includes(query);
        const matchingItems = (category.items || []).filter((item) => [item.name, item.description, item.sku, item.price_label]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query));
        return categoryMatches ? category : { ...category, items: matchingItems };
      })
      .filter((category) => category.name.toLowerCase().includes(query) || (category.items || []).length > 0);
  }, [categories, retailSearch]);

  const saveCategoryOrder = async (nextCategories) => {
    setCategories(nextCategories);
    try {
      await Promise.all(nextCategories.map((category) => api.post('/retail/categories', {
        id: category.id,
        name: category.name,
        is_published: category.is_published ? 1 : 0,
        sort_order: Number(category.sort_order) || 0,
      })));
      setCategoryFeedback({ tone: 'success', message: 'Category order saved.' });
      load();
    } catch (err) {
      setCategoryFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save category order.' });
      load();
    }
  };

  const saveProductOrder = async (category, nextItems) => {
    setCategories((current) => current.map((entry) => entry.id === category.id ? { ...entry, items: nextItems } : entry));
    try {
      await Promise.all(nextItems.map((item) => api.post('/retail', {
        id: item.id,
        category_id: item.category_id,
        name: item.name,
        sku: item.sku || '',
        description: item.description || '',
        price_cents: item.price_cents,
        media_id: item.media_id,
        online_sale_status: item.online_sale_status,
        inventory_status: item.inventory_status,
        fulfillment_mode: item.fulfillment_mode,
        is_published: item.is_published ? 1 : 0,
        sort_order: Number(item.sort_order) || 0,
      })));
      setProductFeedback({ tone: 'success', message: 'Product order saved.' });
      load();
    } catch (err) {
      setProductFeedback({ tone: 'error', message: err.response?.data?.error?.message ?? 'Unable to save product order.' });
      load();
    }
  };

  return (
    <div className="stack gap-md">
      <div className="page-header">
        <div>
          <h1>Products</h1>
          <p className="muted">Create simple categories, add products under each one, and the public site updates automatically.</p>
        </div>
        <PublicPreviewLink href="/#products" label="View products" />
      </div>

      <div className="card">
        <strong>Online sales are not live yet.</strong>
        <p className="muted small-text" style={{ margin: '0.5rem 0 0' }}>
          Current shop mode: {commerce.mode_label}. The extra sales-prep fields below are internal pre-launch notes only; there is no live cart, checkout, payment, shipping, or order management on the public site.
        </p>
      </div>

      <div className="retail-admin-layout">
        <form className="card stack gap-sm" data-retail-form="category" onSubmit={saveCategory}>
          <div>
            <h2>{categoryForm.id ? 'Edit category' : 'Add category'}</h2>
            <p className="muted small-text">Start with broad groups customers will recognize right away.</p>
          </div>
          <label className="field-block">
            <span className="field-label">Category name</span>
            <input
              placeholder="Shampoos & coat care"
              value={categoryForm.name}
              onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value }))}
              required
            />
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={categoryForm.is_published}
              onChange={(event) => setCategoryForm((current) => ({ ...current, is_published: event.target.checked }))}
            />
            {categoryForm.is_published ? 'Visible on website' : 'Hidden from website'}
          </label>
          <label className="field-block">
            <span className="field-label">Display order</span>
            <input
              type="number"
              value={categoryForm.sort_order || 0}
              onChange={(event) => setCategoryForm((current) => ({ ...current, sort_order: event.target.value }))}
            />
          </label>
          <div className="form-actions">
            <button className="btn" disabled={savingCategory}>
              {savingCategory ? 'Saving…' : categoryForm.id ? 'Update category' : 'Save category'}
            </button>
            {categoryForm.id && (
              <button type="button" className="btn btn-link" onClick={resetCategoryForm}>
                Cancel edit
              </button>
            )}
          </div>
          {categoryFeedback && (
            <p
              role={categoryFeedback.tone === 'error' ? 'alert' : 'status'}
              className={`save-feedback ${categoryFeedback.tone === 'error' ? 'is-error' : 'is-success'}`}
            >
              {categoryFeedback.message}
            </p>
          )}
        </form>

        <form className="card stack gap-sm" data-retail-form="product" onSubmit={saveProduct}>
          <div>
            <h2>{productForm.id ? 'Edit product' : 'Add product'}</h2>
            <p className="muted small-text">Keep it simple: category, name, price, photo, and a short note if needed.</p>
          </div>
          {categories.length === 0 ? (
            <div className="inline-note">Create a category first, then products can be added underneath it.</div>
          ) : (
            <>
              <label className="field-block">
                <span className="field-label">Category</span>
                <select
                  value={productForm.category_id}
                  onChange={(event) => setProductForm((current) => ({ ...current, category_id: event.target.value }))}
                  required
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field-block">
                <span className="field-label">Product name</span>
                <input
                  id="retail-product-name"
                  placeholder="Blueberry facial"
                  value={productForm.name}
                  onChange={(event) => setProductForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </label>
              <label className="field-block">
                <span className="field-label">SKU (optional)</span>
                <input
                  placeholder="BWDS-BLUEBERRY-001"
                  value={productForm.sku}
                  onChange={(event) => setProductForm((current) => ({ ...current, sku: event.target.value }))}
                />
              </label>
              <div className="grid two-col gap-sm">
                <label className="field-block">
                  <span className="field-label">Price</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    placeholder="Leave blank to hide the price"
                    value={productForm.price}
                    onChange={(event) => setProductForm((current) => ({ ...current, price: event.target.value }))}
                  />
                </label>
                <label className="toggle retail-toggle">
                  <input
                    type="checkbox"
                    checked={productForm.is_published}
                    onChange={(event) => setProductForm((current) => ({ ...current, is_published: event.target.checked }))}
                  />
                  {productForm.is_published ? 'Visible on website' : 'Hidden from website'}
                </label>
              </div>
              <label className="field-block">
                <span className="field-label">Short note</span>
                <textarea
                  placeholder="Optional details customers should know."
                  value={productForm.description}
                  onChange={(event) => setProductForm((current) => ({ ...current, description: event.target.value }))}
                />
              </label>
              <MediaPicker
                label="Product image"
                media={productForm.media}
                onChange={(media) => setProductForm((current) => ({ ...current, media }))}
                libraryCategory="retail"
                uploadCategory="retail"
              />
              <details className="retail-sales-prep">
                <summary>Future online sales prep</summary>
                <p className="muted small-text">Optional only. Leave these at the defaults until you actually decide to sell online.</p>
                <div className="grid two-col gap-sm">
                  <label className="field-block">
                    <span className="field-label">Online sales plan</span>
                    <select
                      value={productForm.online_sale_status}
                      onChange={(event) => setProductForm((current) => ({ ...current, online_sale_status: event.target.value }))}
                    >
                      {productOptions.online_sale_status.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block">
                    <span className="field-label">Stock status</span>
                    <select
                      value={productForm.inventory_status}
                      onChange={(event) => setProductForm((current) => ({ ...current, inventory_status: event.target.value }))}
                    >
                      {productOptions.inventory_status.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field-block">
                    <span className="field-label">Fulfillment later</span>
                    <select
                      value={productForm.fulfillment_mode}
                      onChange={(event) => setProductForm((current) => ({ ...current, fulfillment_mode: event.target.value }))}
                    >
                      {productOptions.fulfillment_mode.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </details>
              <div className="form-actions">
                <button className="btn" disabled={savingProduct}>
                  {savingProduct ? 'Saving…' : productForm.id ? 'Update product' : 'Save product'}
                </button>
                {productForm.id && (
                  <button type="button" className="btn btn-link" onClick={() => resetProductForm(productForm.category_id)}>
                    Cancel edit
                  </button>
                )}
              </div>
            </>
          )}
          {productFeedback && (
            <p
              role={productFeedback.tone === 'error' ? 'alert' : 'status'}
              className={`save-feedback ${productFeedback.tone === 'error' ? 'is-error' : 'is-success'}`}
            >
              {productFeedback.message}
            </p>
          )}
        </form>
      </div>

      <div className="retail-summary-bar">
        <div className="card">
          <strong>{categories.length}</strong>
          <p className="muted small-text">Categories</p>
        </div>
        <div className="card">
          <strong>{totalProducts}</strong>
          <p className="muted small-text">Products</p>
        </div>
      </div>

      <div className="card section-search-card">
        <label className="field-block">
          <span className="field-label">Find a category or product</span>
          <input value={retailSearch} placeholder="Search products, SKUs, notes..." onChange={(event) => setRetailSearch(event.target.value)} />
        </label>
      </div>

      {loading ? (
        <div className="card">Loading products…</div>
      ) : categories.length === 0 ? (
        <div className="card">No categories yet. Add the first category to start building the product section.</div>
      ) : (
        <div className="retail-category-stack">
          {filteredCategories.map((category) => (
            <article key={category.id} className="card retail-category-card">
              <div className="retail-category-card__header">
                <div>
                  <h3>{category.name}</h3>
                  <p className="muted small-text">
                    {category.is_published ? 'Visible on the site' : 'Hidden from the site'} · {category.items?.length || 0} product
                    {(category.items?.length || 0) === 1 ? '' : 's'}
                  </p>
                  <PublishState isPublished={category.is_published} publishedLabel="Visible on website" hiddenLabel="Hidden from website" />
                </div>
                <div className="retail-inline-actions">
                  <button type="button" className="btn btn-tertiary" onClick={() => startProductForCategory(category.id)}>
                    Add product
                  </button>
                  <button type="button" className="btn btn-link" onClick={() => editCategory(category)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-link" onClick={() => duplicateCategory(category)}>
                    Duplicate
                  </button>
                  <button type="button" className="btn btn-link danger" onClick={() => deleteCategory(category)}>
                    Delete
                  </button>
                </div>
              </div>
              {!retailSearch.trim() && (
                <SortOrderTools
                  item={category}
                  index={categories.findIndex((entry) => entry.id === category.id)}
                  total={categories.length}
                  onMove={(item, offset) => saveCategoryOrder(reorderedItems(categories, item.id, { offset }))}
                  onDragStart={setDraggedCategory}
                  onDrop={(target) => {
                    if (draggedCategory && draggedCategory.id !== target.id) {
                      saveCategoryOrder(reorderedItems(categories, draggedCategory.id, { targetId: target.id }));
                    }
                    setDraggedCategory(null);
                  }}
                />
              )}

              {category.items?.length ? (
                <div className="retail-product-list">
                  {category.items.map((item, index) => (
                    <div key={item.id} className="retail-product-row">
                      {item.media ? (
                        <img
                          className="retail-product-row__image"
                          src={item.media.fallback_url || item.media.original_url}
                          alt={item.media.alt_text || item.name}
                          style={item.media.object_position ? { objectPosition: item.media.object_position } : undefined}
                        />
                      ) : (
                        <div className="retail-product-row__placeholder" aria-hidden="true">
                          {item.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <div className="retail-product-row__details">
                        <div className="retail-product-row__heading">
                          <strong>{item.name}</strong>
                          <span className="small-text muted">{item.price_label || 'Ask in spa'}</span>
                        </div>
                        {item.description ? <p className="muted small-text">{item.description}</p> : <p className="muted small-text">No extra notes.</p>}
                        <p className="small-text muted">{item.is_published ? 'Visible on the site' : 'Hidden from the site'}</p>
                        {!retailSearch.trim() && (
                          <SortOrderTools
                            item={item}
                            index={index}
                            total={category.items.length}
                            onMove={(entry, offset) => saveProductOrder(category, reorderedItems(category.items, entry.id, { offset }))}
                            onDragStart={setDraggedProduct}
                            onDrop={(target) => {
                              if (draggedProduct && draggedProduct.id !== target.id) {
                                saveProductOrder(category, reorderedItems(category.items, draggedProduct.id, { targetId: target.id }));
                              }
                              setDraggedProduct(null);
                            }}
                          />
                        )}
                      </div>
                      <div className="retail-inline-actions">
                        <button type="button" className="btn btn-link" onClick={() => editProduct(item)}>
                          Edit
                        </button>
                        <button type="button" className="btn btn-link" onClick={() => duplicateProduct(item)}>
                          Duplicate
                        </button>
                        <button type="button" className="btn btn-link danger" onClick={() => deleteProduct(item)}>
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="inline-note">No products in this category yet.</div>
              )}
            </article>
          ))}
          {categories.length > 0 && filteredCategories.length === 0 && <div className="card">No categories or products match that search.</div>}
        </div>
      )}
    </div>
  );
}
