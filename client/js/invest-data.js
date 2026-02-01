/**
 * Investment Data Manager
 * Handles data fetching, chart rendering and data synchronization for the investment dashboard.
 */

class InvestDataManager {
    constructor() {
        this.charts = {
            patrimonio: null,
            comparar: null,
            alocacao: null
        };
        
        this.activeTab = 'patrimonio';
        
        this.data = {
            patrimonio: [],
            comparar: [],
            alocacao: {
                classes: [],
                assets: {} // details per class
            },
            metas: [],
            noticias: [],
            dividendos: []
        };

        this.filters = {
            patrimonio: { time: 'Tudo', view: 'bruto' },
            comparar: { time: 'YTD', index: 'IBOV' },
            alocacao: { time: 'presente' },
            metas: {},
            noticias: { scope: 'carteira', sentiment: 'all' },
            dividendos: { time: 'anual' }
        };
        
        this.colors = {
            yellow: '#facc15',
            blue: '#3b82f6',
            gray: '#9ca3af',
            green: '#10b981',
            red: '#ef4444',
            purple: '#8b5cf6',
            orange: '#f59e0b',
            cyan: '#06b6d4',
            palette: ['#facc15', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#06b6d4', '#ef4444', '#9ca3af']
        };
    }

    /**
     * Set active tab and update relevant chart
     */
    setActiveTab(tabId) {
        // Prevent update if same tab
        if (this.activeTab === tabId) return;
        
        this.activeTab = tabId;
        console.log(`[InvestDataManager] Tab ativa: ${tabId}`);
        this.updateActiveChart();
    }

    /**
     * Update filter state and refresh chart
     */
    setFilter(type, value) {
        if (this.filters[this.activeTab]) {
            this.filters[this.activeTab][type] = value;
            this.updateActiveChart();
        }
    }

    /**
     * Update only the currently visible chart
     */
    updateActiveChart() {
        switch(this.activeTab) {
            case 'patrimonio':
                this.updatePatrimonioChart();
                break;
            case 'comparar':
                this.updateCompararChart();
                break;
            case 'alocacao':
                this.updateAlocacaoChart();
                break;
            case 'metas':
                this.updateMetasUI();
                break;
            case 'noticias':
                this.updateNoticiasUI();
                break;
            case 'dividendos':
                this.updateDividendosUI();
                break;
        }
    }

    // ========================================================================
    // PATRIMONIO CHART
    // ========================================================================

    initPatrimonioChart() {
        const ctx = document.getElementById('patrimonioChart');
        if (!ctx) return;

        const gradient = ctx.getContext('2d').createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(250, 204, 21, 0.4)');
        gradient.addColorStop(1, 'rgba(250, 204, 21, 0)');

        this.charts.patrimonio = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Patrimônio',
                    data: [],
                    borderColor: this.colors.yellow,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    borderWidth: 2
                }]
            },
            options: this.getCommonOptions('currency')
        });
    }

    updatePatrimonioChart() {
        if (!this.charts.patrimonio || !this.data.patrimonio.length) return;

        let filtered = this.filterByTime(this.data.patrimonio, this.filters.patrimonio.time);
        
        const labels = filtered.map(d => this.formatDate(d.date));
        const values = filtered.map(d => this.filters.patrimonio.view === 'bruto' ? d.bruto : d.liquido);

        this.charts.patrimonio.data.labels = labels;
        this.charts.patrimonio.data.datasets[0].data = values;
        this.charts.patrimonio.update();
    }

    // ========================================================================
    // COMPARAR CHART (Multi-axis Line Chart)
    // ========================================================================

    initCompararChart() {
        const ctx = document.getElementById('compararChart');
        if (!ctx) return;

        this.charts.comparar = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Minha Carteira (%)',
                        data: [],
                        borderColor: this.colors.yellow,
                        backgroundColor: 'transparent',
                        borderWidth: 3,
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        yAxisID: 'y'
                    },
                    {
                        label: 'Índice (%)',
                        data: [],
                        borderColor: this.colors.blue,
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        tension: 0.3,
                        pointRadius: 0,
                        pointHoverRadius: 6,
                        yAxisID: 'y'
                    }
                ]
            },
            options: this.getCommonOptions('percent')
        });
    }

    updateCompararChart() {
        if (!this.charts.comparar || !this.data.comparar.length) return;

        const indexName = this.filters.comparar.index;
        let filtered = this.filterByTime(this.data.comparar, this.filters.comparar.time);

        const labels = filtered.map(d => this.formatDate(d.date));
        const userValues = filtered.map(d => d.userPerf);
        const indexValues = filtered.map(d => d[indexName.toLowerCase()] || 0);

        this.charts.comparar.data.labels = labels;
        this.charts.comparar.data.datasets[0].data = userValues;
        this.charts.comparar.data.datasets[1].label = `${indexName} (%)`;
        this.charts.comparar.data.datasets[1].data = indexValues;
        this.charts.comparar.update();
    }

    // ========================================================================
    // ALOCACAO CHART (Donut with Drill-down)
    // ========================================================================

    initAlocacaoChart() {
        const ctx = document.getElementById('alocacaoDonutChart');
        if (!ctx) return;

        // Versões com opacidade para atender ao pedido do usuário
        const baseColors = [
            'rgba(250, 204, 21, 0.35)', 
            'rgba(59, 130, 246, 0.35)', 
            'rgba(16, 185, 129, 0.35)', 
            'rgba(139, 92, 246, 0.35)', 
            'rgba(245, 158, 11, 0.35)', 
            'rgba(6, 182, 212, 0.35)', 
            'rgba(239, 68, 68, 0.35)', 
            'rgba(156, 163, 175, 0.35)'
        ];
        
        const hoverColors = baseColors.map(c => c.replace('0.35', '0.55'));

        this.charts.alocacao = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: baseColors,
                    hoverBackgroundColor: hoverColors,
                    borderWidth: 0,
                    hoverOffset: 15,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '75%', // Define a espessura da rosca
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: { size: 12, weight: '500' },
                            padding: 20,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 16, 20, 0.95)',
                        padding: 12,
                        callbacks: {
                            label: (context) => {
                                const val = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((val / total) * 100).toFixed(1) + '%';
                                return ` ${context.label}: R$ ${val.toLocaleString('pt-BR')} (${percentage})`;
                            }
                        }
                    }
                },
                onHover: (event, chartElement) => {
                    event.native.target.style.cursor = chartElement[0] ? 'pointer' : 'default';
                },
                onClick: (evt, elements) => {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const label = this.charts.alocacao.data.labels[index];
                        this.showAlocacaoDetails(label);
                    }
                }
            }
        });
    }

    updateAlocacaoChart() {
        if (!this.charts.alocacao) return;

        const classes = this.data.alocacao.classes;
        const labels = classes.map(c => c.name);
        const values = classes.map(c => c.value);
        const total = values.reduce((a, b) => a + b, 0);

        this.charts.alocacao.data.labels = labels;
        this.charts.alocacao.data.datasets[0].data = values;
        this.charts.alocacao.update();

        // Update center text
        const totalEl = document.querySelector('#alocacao-total-center .value');
        if (totalEl) {
            totalEl.textContent = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(total);
        }
    }

    showAlocacaoDetails(className) {
        const mainView = document.querySelector('#alocacao-main-view');
        const detailsView = document.querySelector('#alocacao-details-view');
        const breadcrumb = document.querySelector('#breadcrumb-text');
        
        if (!mainView || !detailsView) return;

        breadcrumb.textContent = `Carteira > ${className}`;
        mainView.classList.add('hidden');
        detailsView.classList.remove('hidden');

        // Render assets ranking
        this.renderAssetsRanking(className);
        this.renderClassMetrics(className);
    }

    renderAssetsRanking(className) {
        const container = document.querySelector('#assets-ranking-container');
        if (!container) return;

        const assets = this.data.alocacao.assets[className] || [];
        // Sort assets by value descending
        assets.sort((a, b) => b.value - a.value);

        const maxValue = assets.length > 0 ? assets[0].value : 1;

        container.innerHTML = assets.map(asset => `
            <div class="ranking-item">
                <div class="ranking-info">
                    <span>${asset.ticker}</span>
                    <span>R$ ${asset.value.toLocaleString('pt-BR')}</span>
                </div>
                <div class="ranking-bar-bg">
                    <div class="ranking-bar-fill" style="width: 0%;" data-width="${(asset.value / maxValue) * 100}%"></div>
                </div>
            </div>
        `).join('');

        // Animate bars
        setTimeout(() => {
            container.querySelectorAll('.ranking-bar-fill').forEach(bar => {
                bar.style.width = bar.dataset.width;
            });
        }, 100);
    }

    renderClassMetrics(className) {
        // Mock metrics based on class
        const perfs = {
            'Ações': '+12.4%',
            'FIIs': '+5.2%',
            'Renda Fixa': '+10.1%',
            'Exterior': '-2.3%'
        };
        const risk = {
            'Ações': 'Alto',
            'FIIs': 'Médio',
            'Renda Fixa': 'Baixo',
            'Exterior': 'Alto'
        };

        const perfEl = document.querySelector('#metric-performance');
        const riskEl = document.querySelector('#metric-risk');
        
        if (perfEl) perfEl.textContent = perfs[className] || '+0.0%';
        if (riskEl) {
            riskEl.textContent = risk[className] || 'Médio';
            // Simple color logic
            riskEl.style.color = risk[className] === 'Alto' ? '#ef4444' : (risk[className] === 'Baixo' ? '#10b981' : '#f59e0b');
            riskEl.style.backgroundColor = risk[className] === 'Alto' ? 'rgba(239, 68, 68, 0.1)' : (risk[className] === 'Baixo' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)');
        }
    }

    // ========================================================================
    // METAS FINANCEIRAS
    // ========================================================================

    addMeta(meta) {
        if (this.data.metas.length >= 10) {
            return { success: false, message: 'Limite de 10 metas atingido.' };
        }

        const currentTotal = this.data.metas.reduce((acc, m) => acc + parseFloat(m.allocation), 0);
        const newTotal = currentTotal + parseFloat(meta.allocation);

        if (newTotal > 100) {
            return { success: false, message: `A alocação total não pode exceder 100%. Disponível: ${(100 - currentTotal).toFixed(1)}%` };
        }

        meta.id = Date.now().toString();
        meta.progress = 0; // Inicia em 0
        this.data.metas.push(meta);
        this.updateMetasUI();
        return { success: true };
    }

    deleteMeta(id) {
        this.data.metas = this.data.metas.filter(m => m.id !== id);
        this.updateMetasUI();
    }

    updateMetasUI() {
        const grid = document.getElementById('metas-grid');
        const countEl = document.getElementById('active-goals-count');
        const totalAllocEl = document.getElementById('total-allocation-value');
        const fillEl = document.getElementById('total-allocation-bar');

        if (!grid) return;

        const totalAlloc = this.data.metas.reduce((acc, m) => acc + parseFloat(m.allocation), 0);
        
        if (countEl) countEl.textContent = `${this.data.metas.length}/10`;
        if (totalAllocEl) totalAllocEl.textContent = `${totalAlloc.toFixed(1)}%`;
        if (fillEl) fillEl.style.width = `${totalAlloc}%`;

        if (this.data.metas.length === 0) {
            grid.innerHTML = `
                <div class="meta-empty-state">
                    <i class="fas fa-bullseye"></i>
                    <p>Nenhuma meta cadastrada</p>
                    <span>Comece a planejar seu futuro financeiro definindo seus objetivos agora.</span>
                </div>
            `;
            return;
        }

        grid.innerHTML = this.data.metas.map(meta => `
            <div class="meta-card fade-in" data-id="${meta.id}">
                <button class="btn-delete-meta" onclick="investData.deleteMeta('${meta.id}')">
                    <i class="fas fa-times"></i>
                </button>
                <div class="meta-card__header">
                    <div class="meta-card__title">${meta.title}</div>
                    <span class="meta-priority-badge ${meta.priority.toLowerCase()}">${meta.priority}</span>
                </div>
                
                <div class="meta-card__progress">
                    <div class="progress-info">
                        <span class="pct">${meta.progress}%</span>
                        <span class="goal-val">R$ ${parseFloat(meta.target).toLocaleString('pt-BR')}</span>
                    </div>
                    <div class="mini-progress" style="width: 100%">
                        <div class="fill" style="width: ${meta.progress}%"></div>
                    </div>
                </div>

                <p style="font-size: 12px; color: rgba(255,255,255,0.4); margin: 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                    ${meta.description}
                </p>

                <div class="meta-card__footer">
                    <div class="footer-item">
                        <span class="label">ALOCAÇÃO</span>
                        <span class="val">${meta.allocation}%</span>
                    </div>
                    <div class="footer-item" style="text-align: right;">
                        <span class="label">PRAZO</span>
                        <span class="val">${this.formatDeadline(meta.deadline)}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    formatDeadline(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    }

    // ========================================================================
    // NOTÍCIAS
    // ========================================================================

    updateNoticiasUI() {
        const grid = document.getElementById('news-grid');
        if (!grid) return;

        let filtered = this.data.noticias;

        // Apply filters
        if (this.filters.noticias.scope === 'carteira') {
            filtered = filtered.filter(n => n.relatedAssets && n.relatedAssets.length > 0);
        } else if (this.filters.noticias.scope === 'mercado') {
            filtered = filtered.filter(n => n.category === 'Macro' || n.category === 'Global');
        }

        if (this.filters.noticias.sentiment !== 'all') {
            filtered = filtered.filter(n => n.sentiment === this.filters.noticias.sentiment);
        }

        if (filtered.length === 0) {
            grid.innerHTML = `
                <div class="news-empty-state">
                    <i class="fas fa-newspaper"></i>
                    <p>Nenhuma notícia encontrada</p>
                    <span>Tente ajustar os filtros para ver mais conteúdos.</span>
                </div>
            `;
            return;
        }

        grid.innerHTML = filtered.map(news => `
            <div class="news-card fade-in">
                <div class="news-card__header">
                    <span class="news-tag">#${news.category}</span>
                    <span class="news-date">${news.time}</span>
                </div>
                <div class="news-card__title">
                    <span class="sentiment-dot ${news.sentiment}"></span>
                    ${news.title}
                </div>
                <p class="news-card__desc">${news.description}</p>
                
                <div class="news-impact-box">
                    <div class="impact-header">
                        <span class="impact-label">Impacto na Carteira</span>
                        <div class="related-assets">
                            <span style="font-size: 9px; color: rgba(255,255,255,0.4); margin-right: 4px;">Relacionado a:</span>
                            ${news.relatedAssets.map(asset => `<span class="asset-pill">${asset}</span>`).join('')}
                        </div>
                    </div>
                    <p class="impact-text">${news.impactText}</p>
                </div>

                <div class="news-card__footer">
                    <span class="news-source">Fonte: ${news.source}</span>
                    <a href="${news.link}" target="_blank" class="news-link">
                        Saiba mais <i class="fas fa-external-link-alt"></i>
                    </a>
                </div>
            </div>
        `).join('');
    }

    // ========================================================================
    // DIVIDENDOS
    // ========================================================================

    updateDividendosUI() {
        const container = document.getElementById('dividendos-ranking-container');
        if (!container) return;

        // Mock data context if empty
        if (this.data.dividendos.length === 0) {
            this.data.dividendos = [
                { asset: 'IVVB11', total: 1250.40, yield: '4.2%', color: '#3a86ff' },
                { asset: 'PETR4', total: 980.20, yield: '15.4%', color: '#00b0ff' },
                { asset: 'KLBN11', total: 450.15, yield: '8.1%', color: '#4cc9f0' },
                { asset: 'XPML11', total: 320.00, yield: '9.2%', color: '#4895ef' },
                { asset: 'HGLG11', total: 210.30, yield: '8.8%', color: '#4361ee' }
            ];
        }

        const ranking = this.data.dividendos;
        const maxVal = Math.max(...ranking.map(r => r.total));

        container.innerHTML = ranking.map(item => `
            <div class="ranking-wrapper" id="wrapper-${item.asset}">
                <div class="ranking-item clickable" onclick="investData.toggleDividendDetails('${item.asset}')">
                    <div class="ranking-label">
                        <span class="asset-name">${item.asset}</span>
                        <span class="asset-value">R$ ${item.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                    </div>
                    <div class="ranking-bar-bg">
                        <div class="ranking-bar-fill" style="width: ${(item.total / maxVal) * 100}%; background: ${item.color}"></div>
                    </div>
                    <div class="ranking-footer" style="margin-top: 5px;">
                        <span class="yield-tag">Yield: ${item.yield}</span>
                    </div>
                </div>
                <div id="details-${item.asset}" class="dividend-details-context hidden fade-in">
                    <div class="table-wrapper">
                        <table class="dividend-table">
                            <thead>
                                <tr>
                                    <th>Data</th>
                                    <th>Tipo</th>
                                    <th>Valor</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody id="body-${item.asset}">
                                <!-- Preenchido dinamicamente -->
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `).join('');
    }

    toggleDividendDetails(asset) {
        const detailsEl = document.getElementById(`details-${asset}`);
        const allDetails = document.querySelectorAll('.dividend-details-context');
        
        // Se já está visível, apenas esconde
        const isVisible = detailsEl && !detailsEl.classList.contains('hidden');
        
        // Esconde todos primeiro
        allDetails.forEach(el => el.classList.add('hidden'));

        if (!isVisible && detailsEl) {
            // Mock history data
            const history = [
                { date: '15/05/26', asset: asset, type: 'DIV', amount: 'R$ 150,00', status: 'Pago', statusClass: 'status-paid' },
                { date: '12/04/26', asset: asset, type: 'JCP', amount: 'R$ 85,40', status: 'Pago', statusClass: 'status-paid' },
                { date: '15/06/26', asset: asset, type: 'DIV', amount: 'R$ 160,00', status: 'Prov.', statusClass: 'status-pending' }
            ];

            const tbody = document.getElementById(`body-${asset}`);
            if (tbody) {
                tbody.innerHTML = history.map(row => `
                    <tr>
                        <td style="font-size: 11px;">${row.date}</td>
                        <td style="font-size: 11px;">${row.type}</td>
                        <td class="text-positive" style="color: #10b981; font-weight: bold; font-size: 11px;">${row.amount}</td>
                        <td><span class="status-badge ${row.statusClass}" style="scale: 0.8; transform-origin: left;">${row.status}</span></td>
                    </tr>
                `).join('');
            }

            detailsEl.classList.remove('hidden');
        }
    }

    showDividendDetails(asset) {
        // Redireciona para a nova função de toggle
        this.toggleDividendDetails(asset);
    }

    // ========================================================================
    // UTILS & HELPERS
    // ========================================================================

    getCommonOptions(formatType) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    yAlign: 'bottom',
                    backgroundColor: 'rgba(15, 16, 20, 0.95)',
                    titleColor: '#ffffff',
                    bodyColor: '#ffffff',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: (context) => {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                if (formatType === 'currency') {
                                    label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                                } else {
                                    label += context.parsed.y.toFixed(2) + '%';
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest'
            },
            scales: {
                x: {
                    grid: { display: true, color: 'rgba(255, 255, 255, 0.05)', drawBorder: false },
                    ticks: { color: '#ffffff', font: { size: 11, weight: '600' } }
                },
                y: {
                    grid: { color: 'rgba(255, 255, 255, 0.03)', drawBorder: false },
                    ticks: {
                        color: '#ffffff',
                        font: { size: 11, weight: '600' },
                        callback: (value) => {
                            if (formatType === 'percent') return value + '%';
                            if (value >= 1000) return 'R$ ' + (value / 1000) + 'k';
                            return 'R$ ' + value;
                        }
                    }
                }
            }
        };
    }

    filterByTime(data, time) {
        const now = new Date();
        const startOfCurrentYear = new Date(now.getFullYear(), 0, 1);
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        switch(time) {
            case '1M':
                const oneMonthAgo = new Date(now);
                oneMonthAgo.setMonth(now.getMonth() - 1);
                return data.filter(d => new Date(d.date) >= oneMonthAgo);
            case '6M':
                const sixMonthsAgo = new Date(now);
                sixMonthsAgo.setMonth(now.getMonth() - 6);
                return data.filter(d => new Date(d.date) >= sixMonthsAgo);
            case '1Y':
            case '12M':
                const oneYearAgo = new Date(now);
                oneYearAgo.setFullYear(now.getFullYear() - 1);
                return data.filter(d => new Date(d.date) >= oneYearAgo);
            case '24M':
                const twoYearsAgo = new Date(now);
                twoYearsAgo.setFullYear(now.getFullYear() - 2);
                return data.filter(d => new Date(d.date) >= twoYearsAgo);
            case 'MTD':
                return data.filter(d => new Date(d.date) >= startOfCurrentMonth);
            case 'YTD':
                return data.filter(d => new Date(d.date) >= startOfCurrentYear);
            default:
                return data;
        }
    }

    formatDate(dateStr) {
        const date = new Date(dateStr);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
    }

    // ========================================================================
    // MOCK DATA GENERATORS
    // ========================================================================

    generateInitialMockData() {
        // Patrimonio
        this.data.patrimonio = this.generatePatrimonioMock(100);
        
        // Comparar
        this.data.comparar = this.generateCompararMock(100);

        // Alocacao
        this.data.alocacao = {
            classes: [
                { name: 'Ações', value: 45000 },
                { name: 'Renda Fixa', value: 35000 },
                { name: 'FIIs', value: 15000 },
                { name: 'Exterior', value: 5000 }
            ],
            assets: {
                'Ações': [
                    { ticker: 'PETR4', value: 15000 },
                    { ticker: 'VALE3', value: 12000 },
                    { ticker: 'ITUB4', value: 8000 },
                    { ticker: 'BBAS3', value: 10000 }
                ],
                'Renda Fixa': [
                    { ticker: 'CDB Inter', value: 20000 },
                    { ticker: 'Tesouro Selic', value: 15000 }
                ],
                'FIIs': [
                    { ticker: 'HGLG11', value: 8000 },
                    { ticker: 'KNIP11', value: 7000 }
                ],
                'Exterior': [
                    { ticker: 'IVV', value: 5000 }
                ]
            }
        };

        // Metas Iniciais
        this.data.metas = [
            { id: '1', title: 'Reserva de Emergência', description: 'Garantir 6 meses de custo fixo para segurança financeira.', target: 30000, deadline: '2025-12-31', allocation: 40, priority: 'Alta', progress: 85 },
            { id: '2', title: 'Liberdade Financeira', description: 'Acúmulo de patrimônio para viver de renda passiva.', target: 1000000, deadline: '2045-01-01', allocation: 30, priority: 'Média', progress: 5 },
            { id: '3', title: 'Viagem Europa', description: 'Viagem de 15 dias visitando Portugal e Espanha.', target: 20000, deadline: '2026-06-15', allocation: 15, priority: 'Baixa', progress: 40 }
        ];

        // Noticias Iniciais
        this.data.noticias = this.generateNoticiasMock(15);

        // Dividendos Iniciais
        this.data.dividendos = [
            { asset: 'IVVB11', total: 1250.40, yield: '4.2%', color: '#3a86ff' },
            { asset: 'PETR4', total: 980.20, yield: '15.4%', color: '#00b0ff' },
            { asset: 'KLBN11', total: 450.15, yield: '8.1%', color: '#4cc9f0' },
            { asset: 'XPML11', total: 320.00, yield: '9.2%', color: '#4895ef' },
            { asset: 'HGLG11', total: 210.30, yield: '8.8%', color: '#4361ee' }
        ];
    }

    generateNoticiasMock(count) {
        const categories = ['Ações', 'Macro', 'FIIs', 'Cripto', 'Global'];
        const sentiments = ['positive', 'neutral', 'negative'];
        const sources = ['Valor Econômico', 'InfoMoney', 'Bloomberg', 'Exame', 'O Globo'];
        const assets = ['VALE3', 'PETR4', 'ITUB4', 'B3SA3', 'HGLG11', 'BTC', 'ETH'];
        
        const noticias = [];
        
        for (let i = 0; i < count; i++) {
            const sentiment = sentiments[Math.floor(Math.random() * sentiments.length)];
            const category = categories[Math.floor(Math.random() * categories.length)];
            const related = Math.random() > 0.3 ? [assets[Math.floor(Math.random() * assets.length)]] : [];
            if (related.length > 0 && Math.random() > 0.7) related.push(assets[Math.floor(Math.random() * assets.length)]);

            noticias.push({
                id: i,
                category: category,
                time: `${i + 1}h atrás`,
                title: this.getMockTitle(category, sentiment),
                description: 'O índice oficial registrou variação puxada por diversos setores. O resultado veio ligeiramente fora das projeções iniciais dos analistas do mercado financeiro.',
                impactText: this.getMockImpact(category, sentiment, related),
                relatedAssets: related,
                sentiment: sentiment,
                source: sources[Math.floor(Math.random() * sources.length)],
                link: '#'
            });
        }
        return noticias;
    }

    getMockTitle(cat, sent) {
        if (cat === 'Macro') return 'IPCA-15 apresenta variação em linha com o esperado';
        if (cat === 'Ações' && sent === 'negative') return 'Setor de mineração sofre pressão de preços na China';
        if (cat === 'Ações' && sent === 'positive') return 'Bancos apresentam lucros recordes no trimestre';
        return `Notícia relevante sobre ${cat} impacta o mercado hoje`;
    }

    getMockImpact(cat, sent, related) {
        if (related.length > 0) {
            return `Como você possui ${related.join(', ')} na carteira, este fato pode trazer volatilidade no curto prazo. A IA sugere monitorar os suportes de preço.`;
        }
        return 'Impacto macroeconômico que pode afetar a curva de juros e o custo de capital das empresas brasileiras no médio prazo.';
    }

    generatePatrimonioMock(count) {
        const data = [];
        const now = new Date();
        let val = 80000;
        for (let i = count; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            val += (Math.random() - 0.45) * 500;
            data.push({ date: date.toISOString().split('T')[0], bruto: val, liquido: val * 0.85 });
        }
        return data;
    }

    generateCompararMock(count) {
        const data = [];
        const now = new Date();
        let userAcc = 0;
        let ibovAcc = 0;
        let cdiAcc = 0;
        for (let i = count; i >= 0; i--) {
            const date = new Date(now);
            date.setDate(date.getDate() - i);
            userAcc += (Math.random() - 0.4) * 0.5;
            ibovAcc += (Math.random() - 0.48) * 0.4;
            cdiAcc += 0.04; // steady
            data.push({
                date: date.toISOString().split('T')[0],
                userPerf: userAcc,
                ibov: ibovAcc,
                cdi: cdiAcc,
                ipca: cdiAcc * 0.4
            });
        }
        return data;
    }

    /**
     * Populate data via console script
     */
    populateData(config) {
        if (config.patrimonio) this.data.patrimonio = config.patrimonio;
        if (config.comparar) this.data.comparar = config.comparar;
        if (config.alocacao) this.data.alocacao = config.alocacao;
        if (config.metas) this.data.metas = config.metas;
        if (config.noticias) this.data.noticias = config.noticias;
        
        this.updateActiveChart();
    }

    populaNoticiasExemplo() {
        console.log('%c[InvestData] Simulando carga de 15 notícias IA...', 'color: #10b981; font-weight: bold;');
        this.data.noticias = this.generateNoticiasMock(15);
        this.updateNoticiasUI();
    }
}

// Global scope initialization
const investData = new InvestDataManager();
window.investData = investData;
window.populaNoticiasExemplo = () => investData.populaNoticiasExemplo();

document.addEventListener('DOMContentLoaded', () => {
    // Check if we are on the Invest page
    const investCard = document.querySelector('.invest-card');
    if (investCard) {
        investData.initPatrimonioChart();
        investData.initCompararChart();
        investData.initAlocacaoChart();
        
        // Load initial data
        investData.generateInitialMockData();
        investData.updateActiveChart();
        investData.updateMetasUI();

        // Bind tab switching events to InvestDataManager
        const tabs = document.querySelectorAll('.invest-tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                investData.setActiveTab(tab.dataset.tab);
            });
        });
    }
});
