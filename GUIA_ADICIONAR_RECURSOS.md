# 🚀 Guia para Adicionar Novos Recursos

Este guia mostra como adicionar novas funcionalidades ao sistema seguindo a arquitetura implementada.

---

## 📋 Arquitetura Atual

```
┌──────────────┐
│   Frontend   │
│  (HTML/JS)   │
└──────┬───────┘
       │
       │ API.someFunction()
       │
┌──────▼───────┐
│    api.js    │ ← Cliente API
└──────┬───────┘
       │
       │ POST /api/agent/execute
       │ {agent_name, action, data}
       │
┌──────▼──────────┐
│  serverAgent.js │ ← Roteador
└──────┬──────────┘
       │
       │ handleRequest()
       │
┌──────▼──────────┐
│  data-agent.js  │ ← Handler de Actions
└──────┬──────────┘
       │
       │ execute(action, data)
       │
┌──────▼────────────────┐
│ *-queries.js          │ ← Query layer
│ (transaction, debt,   │
│  credit-card, etc)    │
└──────┬────────────────┘
       │
       │ MongoDB queries
       │
┌──────▼───────┐
│   MongoDB    │
└──────────────┘
```

---

## ✨ Exemplo 1: Adicionar Nova Feature "Categorias"

### Objetivo
Permitir que usuários categorizem transações (ex: Alimentação, Transporte, Lazer)

### Passo 1: Criar Schema
**Arquivo:** `server/src/database/schemas/category-schema.js`

```javascript
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  icon: {
    type: String, // emoji ou icon name
    default: '📁'
  },
  color: {
    type: String, // hex color
    default: '#3B82F6'
  },
  type: {
    type: String,
    enum: ['income', 'expense'],
    required: true
  }
}, {
  timestamps: true
});

// Compound index
categorySchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);
```

### Passo 2: Criar Queries
**Arquivo:** `server/src/agents/data/category-queries.js`

```javascript
const Category = require('../../database/schemas/category-schema');

/**
 * Get all categories for user
 */
async function getCategoriesByUser(userId, type = null) {
  const filter = { userId };
  if (type) filter.type = type;
  
  const categories = await Category.find(filter)
    .sort({ name: 1 })
    .lean();
  
  return {
    categories,
    count: categories.length
  };
}

/**
 * Create new category
 */
async function createCategory(userId, data) {
  const { name, icon, color, type } = data;
  
  // Check if exists
  const existing = await Category.findOne({ userId, name });
  if (existing) {
    throw new Error('Categoria já existe');
  }
  
  const category = await Category.create({
    userId,
    name,
    icon,
    color,
    type
  });
  
  return category;
}

/**
 * Update category
 */
async function updateCategory(userId, categoryId, updates) {
  const category = await Category.findOneAndUpdate(
    { _id: categoryId, userId },
    { $set: updates },
    { new: true, runValidators: true }
  );
  
  if (!category) {
    throw new Error('Categoria não encontrada');
  }
  
  return category;
}

/**
 * Delete category
 */
async function deleteCategory(userId, categoryId) {
  const category = await Category.findOneAndDelete({
    _id: categoryId,
    userId
  });
  
  if (!category) {
    throw new Error('Categoria não encontrada');
  }
  
  return { message: 'Categoria deletada', category };
}

module.exports = {
  getCategoriesByUser,
  createCategory,
  updateCategory,
  deleteCategory
};
```

### Passo 3: Adicionar Actions ao DataAgent
**Arquivo:** `server/src/agents/data/data-agent.js`

```javascript
// No topo, importar queries
const categoryQueries = require('./category-queries');

// Dentro da classe DataAgent, adicionar actions:

/**
 * Get user categories
 */
async getCategories(data) {
  const { userId, type } = data;
  
  // Check cache
  const cacheKey = `categories_${userId}_${type || 'all'}`;
  const cached = await this.getFromCache(cacheKey);
  if (cached) return cached;
  
  // Query database
  const result = await categoryQueries.getCategoriesByUser(userId, type);
  
  // Cache for 10 minutes
  await this.saveToCache(cacheKey, result, 600, ['categories', userId]);
  
  return result;
}

/**
 * Create category
 */
async createCategory(data) {
  const { userId, name, icon, color, type } = data;
  
  const category = await categoryQueries.createCategory(userId, {
    name,
    icon,
    color,
    type
  });
  
  // Invalidate cache
  await this.invalidateCache(['categories', userId]);
  
  return { message: 'Categoria criada', category };
}

/**
 * Update category
 */
async updateCategory(data) {
  const { userId, categoryId, updates } = data;
  
  const category = await categoryQueries.updateCategory(userId, categoryId, updates);
  
  // Invalidate cache
  await this.invalidateCache(['categories', userId]);
  
  return { message: 'Categoria atualizada', category };
}

/**
 * Delete category
 */
async deleteCategory(data) {
  const { userId, categoryId } = data;
  
  const result = await categoryQueries.deleteCategory(userId, categoryId);
  
  // Invalidate cache
  await this.invalidateCache(['categories', userId]);
  
  return result;
}
```

### Passo 4: Adicionar Funções na API (Frontend)
**Arquivo:** `client/js/api.js`

```javascript
// Adicionar seção de categorias no window.API

// ========== CATEGORIES ==========

/**
 * Get user categories
 */
async getCategories(type = null) {
  const data = { type };
  return await this._request('DataAgent', 'getCategories', data);
},

/**
 * Create category
 */
async createCategory(categoryData) {
  const { name, icon, color, type } = categoryData;
  
  if (!name || !type) {
    throw new Error('Nome e tipo são obrigatórios');
  }
  
  return await this._request('DataAgent', 'createCategory', {
    name,
    icon: icon || '📁',
    color: color || '#3B82F6',
    type
  });
},

/**
 * Update category
 */
async updateCategory(categoryId, updates) {
  if (!categoryId) {
    throw new Error('ID da categoria é obrigatório');
  }
  
  return await this._request('DataAgent', 'updateCategory', {
    categoryId,
    updates
  });
},

/**
 * Delete category
 */
async deleteCategory(categoryId) {
  if (!categoryId) {
    throw new Error('ID da categoria é obrigatório');
  }
  
  return await this._request('DataAgent', 'deleteCategory', {
    categoryId
  });
}
```

### Passo 5: Criar UI no Dashboard
**Arquivo:** `client/js/dashboard-ui.js` (adicionar funções)

```javascript
/**
 * Load and render categories
 */
async function loadCategories() {
  try {
    const result = await API.getCategories();
    renderCategoriesGrid(result.categories);
  } catch (error) {
    console.error('Error loading categories:', error);
    Utils.showToast('Erro ao carregar categorias', 'error');
  }
}

/**
 * Render categories grid
 */
function renderCategoriesGrid(categories) {
  const container = document.getElementById('categoriesGrid');
  if (!container) return;
  
  if (!categories || categories.length === 0) {
    Utils.showEmpty(container, 'Nenhuma categoria cadastrada');
    return;
  }
  
  container.innerHTML = '';
  
  categories.forEach(cat => {
    const div = document.createElement('div');
    div.className = 'category-card';
    div.style.borderLeft = `4px solid ${cat.color}`;
    
    div.innerHTML = `
      <div class="category-icon">${cat.icon}</div>
      <div class="category-name">${Utils.escapeHtml(cat.name)}</div>
      <div class="category-type ${cat.type}">${cat.type === 'income' ? 'Receita' : 'Despesa'}</div>
      <div class="category-actions">
        <button class="btn-edit" data-id="${cat._id}">Editar</button>
        <button class="btn-delete" data-id="${cat._id}">Excluir</button>
      </div>
    `;
    
    // Event listeners
    div.querySelector('.btn-edit').addEventListener('click', () => openEditCategoryModal(cat));
    div.querySelector('.btn-delete').addEventListener('click', () => deleteCategory(cat._id));
    
    container.appendChild(div);
  });
}

/**
 * Open create category modal
 */
function openCreateCategoryModal() {
  const modal = document.getElementById('categoryModal');
  if (!modal) return;
  
  // Reset form
  document.getElementById('categoryName').value = '';
  document.getElementById('categoryIcon').value = '📁';
  document.getElementById('categoryColor').value = '#3B82F6';
  document.getElementById('categoryType').value = 'expense';
  
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
}

/**
 * Save category (create or update)
 */
async function saveCategory(event) {
  event.preventDefault();
  
  const name = document.getElementById('categoryName').value.trim();
  const icon = document.getElementById('categoryIcon').value;
  const color = document.getElementById('categoryColor').value;
  const type = document.getElementById('categoryType').value;
  const categoryId = document.getElementById('categoryId').value;
  
  if (!name) {
    Utils.showToast('Nome é obrigatório', 'error');
    return;
  }
  
  try {
    if (categoryId) {
      // Update
      await API.updateCategory(categoryId, { name, icon, color, type });
      Utils.showToast('Categoria atualizada!', 'success');
    } else {
      // Create
      await API.createCategory({ name, icon, color, type });
      Utils.showToast('Categoria criada!', 'success');
    }
    
    // Reload categories
    await loadCategories();
    
    // Close modal
    closeCategoryModal();
  } catch (error) {
    console.error('Error saving category:', error);
    Utils.showToast('Erro ao salvar categoria', 'error');
  }
}

/**
 * Delete category
 */
async function deleteCategory(categoryId) {
  if (!confirm('Tem certeza que deseja excluir esta categoria?')) {
    return;
  }
  
  try {
    await API.deleteCategory(categoryId);
    Utils.showToast('Categoria excluída!', 'success');
    
    // Reload categories
    await loadCategories();
  } catch (error) {
    console.error('Error deleting category:', error);
    Utils.showToast('Erro ao excluir categoria', 'error');
  }
}
```

### Passo 6: Adicionar HTML
**Arquivo:** `client/html/dash.html` (adicionar card)

```html
<!-- Categories Card -->
<div class="card">
  <div class="card-header">
    <h3>Categorias</h3>
    <button id="addCategoryBtn" class="btn-add">+ Adicionar</button>
  </div>
  
  <div class="card-body">
    <div id="categoriesGrid" class="categories-grid">
      <!-- JS will populate -->
    </div>
  </div>
</div>

<!-- Category Modal -->
<div id="categoryModal" class="modal" aria-hidden="true">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="categoryModalTitle">Nova Categoria</h3>
      <button id="categoryModalClose" class="btn-close">×</button>
    </div>
    
    <form id="categoryForm" class="modal-body">
      <input type="hidden" id="categoryId">
      
      <div class="form-group">
        <label for="categoryName">Nome</label>
        <input type="text" id="categoryName" required maxlength="50">
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="categoryIcon">Ícone</label>
          <input type="text" id="categoryIcon" value="📁" maxlength="2">
        </div>
        
        <div class="form-group">
          <label for="categoryColor">Cor</label>
          <input type="color" id="categoryColor" value="#3B82F6">
        </div>
      </div>
      
      <div class="form-group">
        <label for="categoryType">Tipo</label>
        <select id="categoryType" required>
          <option value="income">Receita</option>
          <option value="expense">Despesa</option>
        </select>
      </div>
      
      <div class="modal-actions">
        <button type="submit" class="btn-primary">Salvar</button>
        <button type="button" class="btn-secondary" onclick="closeCategoryModal()">Cancelar</button>
      </div>
    </form>
  </div>
</div>
```

### Passo 7: Adicionar CSS
**Arquivo:** `client/css/dash.css`

```css
/* Categories Grid */
.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
}

.category-card {
  background: white;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  transition: transform 0.2s;
}

.category-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.15);
}

.category-icon {
  font-size: 2rem;
  text-align: center;
  margin-bottom: 0.5rem;
}

.category-name {
  font-weight: 600;
  font-size: 1rem;
  margin-bottom: 0.25rem;
  text-align: center;
}

.category-type {
  text-align: center;
  font-size: 0.875rem;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  margin-bottom: 0.75rem;
}

.category-type.income {
  background: #DEF7EC;
  color: #03543F;
}

.category-type.expense {
  background: #FDE8E8;
  color: #9B1C1C;
}

.category-actions {
  display: flex;
  gap: 0.5rem;
}

.category-actions button {
  flex: 1;
  padding: 0.5rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.875rem;
}

.btn-edit {
  background: #3B82F6;
  color: white;
}

.btn-edit:hover {
  background: #2563EB;
}

.btn-delete {
  background: #EF4444;
  color: white;
}

.btn-delete:hover {
  background: #DC2626;
}
```

---

## ✨ Exemplo 2: Adicionar Gráfico de Gastos

### Objetivo
Mostrar gráfico de pizza com distribuição de despesas por categoria

### Passo 1: Adicionar Query para Aggregate
**Arquivo:** `server/src/agents/data/transaction-queries.js`

```javascript
/**
 * Get expenses by category for chart
 */
async function getExpensesByCategory(userId, startDate, endDate) {
  const match = {
    userId: new mongoose.Types.ObjectId(userId),
    type: 'expense',
    section: 'statement'
  };
  
  if (startDate || endDate) {
    match.date = {};
    if (startDate) match.date.$gte = new Date(startDate);
    if (endDate) match.date.$lte = new Date(endDate);
  }
  
  const pipeline = [
    { $match: match },
    {
      $group: {
        _id: '$category', // Assumindo que transação tem campo category
        total: { $sum: '$amount' },
        count: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'categoryData'
      }
    },
    {
      $unwind: {
        path: '$categoryData',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 1,
        total: 1,
        count: 1,
        name: { $ifNull: ['$categoryData.name', 'Sem Categoria'] },
        color: { $ifNull: ['$categoryData.color', '#6B7280'] },
        icon: { $ifNull: ['$categoryData.icon', '📁'] }
      }
    },
    { $sort: { total: -1 } }
  ];
  
  const results = await Transaction.aggregate(pipeline);
  
  return {
    categories: results,
    totalExpenses: results.reduce((sum, cat) => sum + cat.total, 0)
  };
}

module.exports = {
  // ... outras funções
  getExpensesByCategory
};
```

### Passo 2: Adicionar Action no DataAgent
```javascript
async getExpensesByCategory(data) {
  const { userId, startDate, endDate } = data;
  
  const cacheKey = `expenses_by_category_${userId}_${startDate}_${endDate}`;
  const cached = await this.getFromCache(cacheKey);
  if (cached) return cached;
  
  const result = await transactionQueries.getExpensesByCategory(userId, startDate, endDate);
  
  await this.saveToCache(cacheKey, result, 300, ['transactions', userId]);
  
  return result;
}
```

### Passo 3: Adicionar no API.js
```javascript
async getExpensesByCategory(startDate = null, endDate = null) {
  return await this._request('DataAgent', 'getExpensesByCategory', {
    startDate,
    endDate
  });
}
```

### Passo 4: Criar Gráfico no Frontend
**Instalar Chart.js:** Adicionar no HTML

```html
<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
```

**Arquivo:** `client/js/dashboard-ui.js`

```javascript
let expensesChart = null;

/**
 * Load and render expenses chart
 */
async function loadExpensesChart(startDate, endDate) {
  try {
    const data = await API.getExpensesByCategory(startDate, endDate);
    renderExpensesChart(data);
  } catch (error) {
    console.error('Error loading expenses chart:', error);
  }
}

/**
 * Render expenses pie chart
 */
function renderExpensesChart(data) {
  const canvas = document.getElementById('expensesChart');
  if (!canvas) return;
  
  // Destroy previous chart
  if (expensesChart) {
    expensesChart.destroy();
  }
  
  const ctx = canvas.getContext('2d');
  
  expensesChart = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: data.categories.map(cat => cat.name),
      datasets: [{
        data: data.categories.map(cat => cat.total),
        backgroundColor: data.categories.map(cat => cat.color),
        borderWidth: 2,
        borderColor: '#fff'
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: 'bottom'
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              const value = context.parsed;
              const total = data.totalExpenses;
              const percentage = ((value / total) * 100).toFixed(1);
              return `${context.label}: ${Utils.formatAmount(value)} (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}
```

**HTML:**
```html
<div class="card">
  <div class="card-header">
    <h3>Despesas por Categoria</h3>
  </div>
  
  <div class="card-body">
    <canvas id="expensesChart" width="400" height="400"></canvas>
  </div>
</div>
```

---

## 🎯 Padrões a Seguir

### 1. **Sempre validar userId**
```javascript
if (!userId) {
  throw new Error('userId é obrigatório');
}
```

### 2. **Usar cache quando apropriado**
```javascript
const cacheKey = `resource_${userId}_${param}`;
const cached = await this.getFromCache(cacheKey);
if (cached) return cached;

// ... query database

await this.saveToCache(cacheKey, result, ttl, tags);
```

### 3. **Invalidar cache em mutations**
```javascript
await this.invalidateCache(['resource', userId]);
```

### 4. **Tratar erros amigavelmente**
```javascript
try {
  // operation
} catch (error) {
  console.error('Error:', error);
  Utils.showToast('Erro amigável', 'error');
}
```

### 5. **Usar loading states**
```javascript
Utils.showLoading(element, 'Carregando...');
const data = await API.getData();
renderData(data);
```

### 6. **Validar dados de entrada**
```javascript
if (!name || !type) {
  throw new Error('Campos obrigatórios não preenchidos');
}
```

### 7. **Usar índices no MongoDB**
```javascript
schema.index({ userId: 1, date: -1 });
```

### 8. **Documentar funções**
```javascript
/**
 * Get user transactions
 * @param {string} userId - User ID
 * @param {Object} filters - Query filters
 * @returns {Promise<Object>} Transactions and count
 */
async getTransactions(userId, filters) {
  // ...
}
```

---

## 📚 Recursos Úteis

### MongoDB Aggregation
- [Aggregation Pipeline](https://docs.mongodb.com/manual/core/aggregation-pipeline/)
- [Aggregation Operators](https://docs.mongodb.com/manual/reference/operator/aggregation/)

### Chart.js
- [Chart.js Docs](https://www.chartjs.org/docs/latest/)
- [Examples](https://www.chartjs.org/docs/latest/samples/)

### JWT
- [JWT.io](https://jwt.io/)
- [jsonwebtoken npm](https://www.npmjs.com/package/jsonwebtoken)

---

## ✅ Checklist para Nova Feature

- [ ] Schema criado com validações
- [ ] Queries implementadas e testadas
- [ ] Actions adicionadas no DataAgent
- [ ] Cache implementado
- [ ] Funções no api.js
- [ ] UI components criados
- [ ] CSS estilizado
- [ ] Validação de dados
- [ ] Tratamento de erros
- [ ] Loading states
- [ ] Documentação
- [ ] Testes manuais

---

Seguindo este guia, você pode adicionar qualquer nova funcionalidade ao sistema! 🚀
