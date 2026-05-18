export function createRetailCategoryForm() {
  return {
    id: null,
    name: '',
    is_published: true,
  };
}

export function createRetailProductForm(categoryId = '') {
  return {
    id: null,
    category_id: categoryId ? String(categoryId) : '',
    name: '',
    sku: '',
    description: '',
    price: '',
    media: null,
    online_sale_status: 'catalog_only',
    inventory_status: 'untracked',
    fulfillment_mode: 'undecided',
    is_published: true,
  };
}
