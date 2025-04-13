/**
 * market-controller.js
 * Controlador para la página de visión general del mercado de criptomonedas
 */

import { MarketDataService } from './market-data-service.js';
import { EventBus } from '../utils/event-bus.js';
import { StorageManager } from '../utils/storage-manager.js';
import { deviceDetector } from '../utils/device-detector.js';

export class MarketController {
    constructor(options = {}) {
        this.options = {
            // Selectores para elementos DOM
            tableContainerId: 'crypto-table-container',
            tableId: 'crypto-table',
            marketCapChartId: 'market-cap-chart',
            searchInputId: 'crypto-search',
            filtersId: 'market-filters',
            paginationId: 'market-pagination',
            refreshBtnId: 'refresh-market-btn',
            lastUpdatedId: 'last-updated',
            // Configuración
            autoRefreshInterval: 60000, // 60 segundos
            rowsPerPage: 50,
            chartPeriod: '30d',
            storageNamespace: 'market.preferences',
            // Fusionar opciones personalizadas
            ...options
        };

        // Servicios y objetos de estado
        this.marketService = new MarketDataService();
        this.currentData = null;
        this.filteredData = null;
        this.isLoading = false;
        this.refreshTimer = null;
        this.chartInstances = {};
        
        // Estado de UI y filtros
        this.uiState = {
            currentPage: 1,
            sortColumn: 'market_cap',
            sortDirection: 'desc',
            filterCategory: 'all',
            filterMarketCap: 'all',
            searchQuery: '',
            viewMode: 'all',  // 'all' o 'favorites'
            selectedColumns: this._getDefaultColumns()
        };
        
        // Referencias a elementos DOM
        this.elements = {};
    }

    /**
     * Inicializa el controlador de mercado
     */
    async init() {
        try {
            console.log('Inicializando Market Controller...');
            
            // Cargar preferencias guardadas
            this._loadPreferences();
            
            // Inicializar referencias a elementos DOM
            this._initDOMReferences();
            
            // Configurar event listeners
            this._setupEventListeners();
            
            // Suscribirse a eventos globales
            this._subscribeToEvents();
            
            // Cargar datos iniciales
            await this.refreshData();
            
            // Configurar refreshes automáticos
            this._setupAutoRefresh();
            
            console.log('Market Controller inicializado correctamente');
            
            // Notificar que el controlador ha sido inicializado
            EventBus.publish('market.controller.initialized');
        } catch (error) {
            console.error('Error al inicializar Market Controller:', error);
            this._showError('Error al cargar los datos del mercado. Por favor, inténtalo de nuevo más tarde.');
        }
    }

    /**
     * Refresca los datos del mercado
     */
    async refreshData() {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            this._showLoading(true);
            
            // Obtener datos actualizados del mercado
            const marketData = await this.marketService.getMarketOverview();
            this.currentData = marketData;
            
            // Actualizar timestamp de última actualización
            this._updateLastUpdated();
            
            // Aplicar filtros actuales y actualizar la visualización
            this._applyFilters();
            this._renderMarketTable();
            this._renderMarketCharts();
            this._renderTrendingSections();
            
            // Notificar que los datos se han actualizado
            EventBus.publish('market.data.updated', { timestamp: new Date() });
            
            this.isLoading = false;
            this._showLoading(false);
        } catch (error) {
            console.error('Error al actualizar datos del mercado:', error);
            this._showError('Error al actualizar los datos del mercado.');
            this.isLoading = false;
            this._showLoading(false);
        }
    }

    /**
     * Aplica filtros a los datos del mercado
     * @private
     */
    _applyFilters() {
        if (!this.currentData || !this.currentData.coins) {
            this.filteredData = [];
            return;
        }
        
        let result = [...this.currentData.coins];
        
        // Aplicar filtro de búsqueda
        if (this.uiState.searchQuery) {
            const query = this.uiState.searchQuery.toLowerCase();
            result = result.filter(coin => 
                coin.name.toLowerCase().includes(query) || 
                coin.symbol.toLowerCase().includes(query)
            );
        }
        
        // Aplicar filtro de categoría
        if (this.uiState.filterCategory !== 'all') {
            result = result.filter(coin => 
                coin.category === this.uiState.filterCategory
            );
        }
        
        // Aplicar filtro de capitalización
        if (this.uiState.filterMarketCap !== 'all') {
            switch (this.uiState.filterMarketCap) {
                case 'large':
                    result = result.filter(coin => coin.market_cap >= 10000000000); // $10B+
                    break;
                case 'medium':
                    result = result.filter(coin => coin.market_cap >= 1000000000 && coin.market_cap < 10000000000); // $1B-$10B
                    break;
                case 'small':
                    result = result.filter(coin => coin.market_cap >= 100000000 && coin.market_cap < 1000000000); // $100M-$1B
                    break;
                case 'micro':
                    result = result.filter(coin => coin.market_cap < 100000000); // <$100M
                    break;
            }
        }
        
        // Aplicar filtro de vista (todos o favoritos)
        if (this.uiState.viewMode === 'favorites') {
            const favorites = this._getFavorites();
            result = result.filter(coin => favorites.includes(coin.id));
        }
        
        // Aplicar ordenación
        result = this._sortData(result);
        
        this.filteredData = result;
    }

    /**
     * Ordena los datos según la columna seleccionada
     * @param {Array} data - Datos a ordenar
     * @returns {Array} Datos ordenados
     * @private
     */
    _sortData(data) {
        const { sortColumn, sortDirection } = this.uiState;
        const direction = sortDirection === 'asc' ? 1 : -1;
        
        return [...data].sort((a, b) => {
            if (sortColumn === 'name') {
                return direction * a.name.localeCompare(b.name);
            }
            
            // Manejo especial para cambios porcentuales
            if (['price_change_24h', 'price_change_7d', 'price_change_30d'].includes(sortColumn)) {
                const aValue = a[sortColumn] || 0;
                const bValue = b[sortColumn] || 0;
                return direction * (aValue - bValue);
            }
            
            // Ordenación numérica por defecto
            return direction * (a[sortColumn] - b[sortColumn]);
        });
    }

    /**
     * Renderiza la tabla de criptomonedas
     * @private
     */
    _renderMarketTable() {
        const tableContainer = this.elements.tableContainer;
        if (!tableContainer) return;
        
        const table = this.elements.table;
        const tbody = table.querySelector('tbody');
        
        // Limpiar contenido actual
        tbody.innerHTML = '';
        
        // Calcular rango de datos para paginación
        const { currentPage, rowsPerPage } = this.uiState;
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        const paginatedData = this.filteredData.slice(startIndex, endIndex);
        
        // Obtener favoritos
        const favorites = this._getFavorites();
        
        // Generar filas de la tabla
        if (paginatedData.length === 0) {
            // Mostrar mensaje si no hay resultados
            const noDataRow = document.createElement('tr');
            noDataRow.innerHTML = `
                <td colspan="9" class="no-data-message">
                    <div class="empty-state">
                        <i class="icon-search"></i>
                        <p>No se encontraron resultados con los filtros actuales.</p>
                        <button class="btn btn-outline btn-sm" id="clear-filters-btn">
                            Limpiar Filtros
                        </button>
                    </div>
                </td>
            `;
            tbody.appendChild(noDataRow);
            
            // Añadir listener al botón de limpiar filtros
            const clearBtn = noDataRow.querySelector('#clear-filters-btn');
            if (clearBtn) {
                clearBtn.addEventListener('click', () => this._resetFilters());
            }
        } else {
            // Generar filas normales con datos
            paginatedData.forEach((coin, index) => {
                const row = document.createElement('tr');
                const rowNumber = startIndex + index + 1;
                
                // Aplicar clase si el precio ha cambiado recientemente
                if (coin.recentlyUpdated) {
                    row.classList.add('recently-updated');
                    // Eliminar la clase después de la animación
                    setTimeout(() => {
                        row.classList.remove('recently-updated');
                    }, 2000);
                }
                
                // Verificar si está en favoritos
                const isFavorite = favorites.includes(coin.id);
                
                // Crear HTML de la fila
                row.innerHTML = this._createCoinRowHTML(coin, rowNumber, isFavorite);
                tbody.appendChild(row);
                
                // Agregar event listeners a la fila
                this._attachRowEventListeners(row, coin);
            });
        }
        
        // Actualizar paginación
        this._updatePagination();
    }

    /**
     * Crea el HTML para una fila de la tabla de criptomonedas
     * @param {Object} coin - Datos de la moneda
     * @param {number} rowNumber - Número de fila
     * @param {boolean} isFavorite - Si la moneda está en favoritos
     * @returns {string} HTML de la fila
     * @private
     */
    _createCoinRowHTML(coin, rowNumber, isFavorite) {
        const { selectedColumns } = this.uiState;
        const priceChangeClass = coin.price_change_24h >= 0 ? 'positive' : 'negative';
        const price7dChangeClass = coin.price_change_7d >= 0 ? 'positive' : 'negative';
        
        // Crear HTML basado en columnas seleccionadas
        let html = `
            <td class="td-rank">${rowNumber}</td>
            <td class="td-name">
                <div class="coin-info">
                    <div class="coin-star">
                        <i class="icon-${isFavorite ? 'star' : 'star-empty'}" data-coin-id="${coin.id}"></i>
                    </div>
                    <img src="${coin.image}" alt="${coin.name}" class="coin-icon">
                    <div class="coin-name-info">
                        <div class="coin-name">${coin.name}</div>
                        <div class="coin-symbol">${coin.symbol.toUpperCase()}</div>
                    </div>
                </div>
            </td>
        `;
        
        // Añadir columnas según selección del usuario
        if (selectedColumns.includes('price')) {
            html += `
                <td class="td-price">$${this._formatNumber(coin.current_price)}</td>
            `;
        }
        
        if (selectedColumns.includes('24h')) {
            html += `
                <td class="td-24h ${priceChangeClass}">${coin.price_change_24h > 0 ? '+' : ''}${coin.price_change_24h.toFixed(2)}%</td>
            `;
        }
        
        if (selectedColumns.includes('7d')) {
            html += `
                <td class="td-7d ${price7dChangeClass}">${coin.price_change_7d > 0 ? '+' : ''}${coin.price_change_7d.toFixed(2)}%</td>
            `;
        }
        
        if (selectedColumns.includes('market-cap')) {
            html += `
                <td class="td-market-cap">$${this._formatNumber(coin.market_cap)}</td>
            `;
        }
        
        if (selectedColumns.includes('volume')) {
            html += `
                <td class="td-volume">$${this._formatNumber(coin.total_volume)}</td>
            `;
        }
        
        if (selectedColumns.includes('circulating')) {
            html += `
                <td class="td-circulating">${this._formatNumber(coin.circulating_supply)} ${coin.symbol.toUpperCase()}</td>
            `;
        }
        
        if (selectedColumns.includes('chart')) {
            const chartClass = coin.price_change_7d >= 0 ? 'positive' : 'negative';
            html += `
                <td class="td-chart">
                    <div class="sparkline-chart ${chartClass}">
                        <canvas id="spark-${coin.id}" width="100" height="30" class="sparkline"></canvas>
                    </div>
                </td>
            `;
        }
        
        // Columna de acciones siempre visible
        html += `
            <td class="td-actions">
                <div class="dropdown">
                    <button class="btn btn-icon dropdown-toggle" id="action-dropdown-${coin.id}" aria-label="Acciones">
                        <i class="icon-more-horizontal"></i>
                    </button>
                    <div class="dropdown-menu dropdown-menu-right">
                        <a href="/crypto/${coin.id}" class="dropdown-item">
                            <i class="icon-info"></i> Ver detalles
                        </a>
                        <a href="#" class="dropdown-item" data-action="add-to-portfolio" data-coin="${coin.id}">
                            <i class="icon-briefcase"></i> Añadir a Portfolio
                        </a>
                        <a href="#" class="dropdown-item" data-action="set-alert" data-coin="${coin.id}">
                            <i class="icon-bell"></i> Crear Alerta
                        </a>
                        <a href="#" class="dropdown-item" data-action="toggle-favorite" data-coin="${coin.id}">
                            <i class="icon-${isFavorite ? 'star' : 'star-empty'}"></i> ${isFavorite ? 'Quitar de' : 'Añadir a'} Favoritos
                        </a>
                    </div>
                </div>
            </td>
        `;
        
        return html;
    }

    /**
     * Agrega event listeners a una fila de la tabla
     * @param {HTMLElement} row - Elemento de fila de la tabla
     * @param {Object} coin - Datos de la moneda
     * @private
     */
    _attachRowEventListeners(row, coin) {
        // Event listener para icono de favoritos
        const favoriteIcon = row.querySelector('.coin-star i');
        if (favoriteIcon) {
            favoriteIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const coinId = e.target.dataset.coinId;
                this._toggleFavorite(coinId);
            });
        }
        
        // Event listeners para acciones del dropdown
        const dropdownItems = row.querySelectorAll('.dropdown-item[data-action]');
        dropdownItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const action = e.target.closest('.dropdown-item').dataset.action;
                const coinId = e.target.closest('.dropdown-item').dataset.coin;
                
                // Ejecutar acción correspondiente
                switch (action) {
                    case 'add-to-portfolio':
                        this._handleAddToPortfolio(coinId);
                        break;
                    case 'set-alert':
                        this._handleSetAlert(coinId);
                        break;
                    case 'toggle-favorite':
                        this._toggleFavorite(coinId);
                        break;
                }
            });
        });
        
        // Dibujar mini gráfico (sparkline) si existe el canvas
        const sparklineCanvas = row.querySelector(`#spark-${coin.id}`);
        if (sparklineCanvas && coin.sparkline_data && coin.sparkline_data.length > 0) {
            this._drawSparkline(sparklineCanvas, coin.sparkline_data, coin.price_change_7d >= 0);
        }
    }

    /**
     * Dibuja un mini gráfico sparkline
     * @param {HTMLElement} canvas - Elemento canvas
     * @param {Array} data - Datos para el gráfico
     * @param {boolean} isPositive - Si la tendencia es positiva
     * @private
     */
    _drawSparkline(canvas, data, isPositive) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        // Configuración básica
        const width = canvas.width;
        const height = canvas.height;
        const padding = 2;
        const color = isPositive ? '#16c784' : '#ea3943';
        
        // Encontrar valores mínimo y máximo
        const minValue = Math.min(...data);
        const maxValue = Math.max(...data);
        const valueRange = maxValue - minValue;
        
        // Limpiar canvas
        ctx.clearRect(0, 0, width, height);
        
        // Dibujar línea
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        
        data.forEach((value, index) => {
            const x = (index / (data.length - 1)) * width;
            // Normalizar valor entre 0 y height, con padding
            const normalizedValue = valueRange === 0 ? height / 2 : 
                                    ((value - minValue) / valueRange);
            const y = height - (normalizedValue * (height - padding * 2) + padding);
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
    }

    /**
     * Renderiza gráficos de mercado global
     * @private
     */
    _renderMarketCharts() {
        // Verificar si tenemos los datos necesarios
        if (!this.currentData || !this.currentData.globalData) return;
        
        const marketCapChartEl = document.getElementById(this.options.marketCapChartId);
        if (!marketCapChartEl) return;
        
        // Si ya existe una instancia del gráfico, destruirla
        if (this.chartInstances.marketCap) {
            this.chartInstances.marketCap.destroy();
        }
        
        // Obtener datos para el gráfico
        const { globalMarketCapData, timestamps } = this.currentData.globalData;
        
        // Configurar el contexto del gráfico
        const ctx = marketCapChartEl.getContext('2d');
        
        // Crear nueva instancia de gráfico
        // Nota: Aquí asumo que estás usando una biblioteca como Chart.js
        // Esta es una implementación básica, la real dependería de la biblioteca específica
        this.chartInstances.marketCap = new Chart(ctx, {
            type: 'line',
            data: {
                labels: timestamps.map(ts => new Date(ts).toLocaleDateString()),
                datasets: [{
                    label: 'Capitalización Total del Mercado',
                    data: globalMarketCapData,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                let value = context.raw;
                                return `Capitalización: $${this._formatNumber(value)}`;
                            }.bind(this)
                        }
                    },
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(200, 200, 200, 0.1)'
                        },
                        ticks: {
                            callback: function(value) {
                                return '$' + this._formatCompactNumber(value);
                            }.bind(this)
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
    }

    /**
     * Renderiza secciones de tendencias (gainers, losers, trending)
     * @private
     */
    _renderTrendingSections() {
        if (!this.currentData) return;
        
        // Implementación de la lógica para mostrar top gainers, losers y trending
        // Esta es una implementación simplificada, la real dependería de la estructura del DOM
        this._renderTopGainers();
        this._renderTopLosers();
        this._renderTrending();
    }

    /**
     * Renderiza la sección de top gainers
     * @private
     */
    _renderTopGainers() {
        const gainersContainer = document.getElementById('top-gainers-list');
        if (!gainersContainer || !this.currentData.topGainers) return;
        
        gainersContainer.innerHTML = '';
        
        this.currentData.topGainers.slice(0, 5).forEach(coin => {
            const item = document.createElement('div');
            item.className = 'trend-item';
            item.innerHTML = `
                <div class="coin-info mini">
                    <img src="${coin.image}" alt="${coin.name}" class="coin-icon-sm">
                    <div class="coin-name-info">
                        <div class="coin-name">${coin.name}</div>
                        <div class="coin-symbol">${coin.symbol.toUpperCase()}</div>
                    </div>
                </div>
                <div class="trend-change positive">+${coin.price_change_24h.toFixed(2)}%</div>
            `;
            gainersContainer.appendChild(item);
        });
    }

    /**
     * Renderiza la sección de top losers
     * @private
     */
    _renderTopLosers() {
        const losersContainer = document.getElementById('top-losers-list');
        if (!losersContainer || !this.currentData.topLosers) return;
        
        losersContainer.innerHTML = '';
        
        this.currentData.topLosers.slice(0, 5).forEach(coin => {
            const item = document.createElement('div');
            item.className = 'trend-item';
            item.innerHTML = `
                <div class="coin-info mini">
                    <img src="${coin.image}" alt="${coin.name}" class="coin-icon-sm">
                    <div class="coin-name-info">
                        <div class="coin-name">${coin.name}</div>
                        <div class="coin-symbol">${coin.symbol.toUpperCase()}</div>
                    </div>
                </div>
                <div class="trend-change negative">${coin.price_change_24h.toFixed(2)}%</div>
            `;
            losersContainer.appendChild(item);
        });
    }

    /**
     * Renderiza la sección de trending coins
     * @private
     */
    _renderTrending() {
        const trendingContainer = document.getElementById('trending-list');
        if (!trendingContainer || !this.currentData.trending) return;
        
        trendingContainer.innerHTML = '';
        
        this.currentData.trending.slice(0, 5).forEach(coin => {
            const item = document.createElement('div');
            item.className = 'trend-item';
            item.innerHTML = `
                <div class="coin-info mini">
                    <img src="${coin.image}" alt="${coin.name}" class="coin-icon-sm">
                    <div class="coin-name-info">
                        <div class="coin-name">${coin.name}</div>
                        <div class="coin-symbol">${coin.symbol.toUpperCase()}</div>
                    </div>
                </div>
                <div class="trend-volume">$${this._formatNumber(coin.total_volume)}</div>
            `;
            trendingContainer.appendChild(item);
        });
    }

    /**
     * Actualiza la paginación de la tabla
     * @private
     */
    _updatePagination() {
        const paginationContainer = document.getElementById(this.options.paginationId);
        if (!paginationContainer) return;
        
        const { currentPage, rowsPerPage } = this.uiState;
        const totalItems = this.filteredData.length;
        const totalPages = Math.ceil(totalItems / rowsPerPage);
        
        // Actualizar información de paginación
        const infoElement = paginationContainer.querySelector('.pagination-info');
        if (infoElement) {
            const startItem = totalItems === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1;
            const endItem = Math.min(currentPage * rowsPerPage, totalItems);
            infoElement.innerHTML = `Mostrando <span>${startItem}-${endItem}</span> de <span>${totalItems}</span> criptomonedas`;
        }
        
        // Actualizar controles de paginación
        const pageButtons = paginationContainer.querySelector('.pagination-pages');
        if (pageButtons) {
            pageButtons.innerHTML = '';
            
            // Determinar rango de páginas a mostrar
            let startPage = Math.max(1, currentPage - 2);
            let endPage = Math.min(totalPages, startPage + 4);
            startPage = Math.max(1, endPage - 4);
            
            // Crear botones de página
            for (let i = startPage; i <= endPage; i++) {
                const pageBtn = document.createElement('button');
                pageBtn.className = `page-btn ${i === currentPage ? 'active' : ''}`;
                pageBtn.textContent = i;
                pageBtn.addEventListener('click', () => this._goToPage(i));
                pageButtons.appendChild(pageBtn);
            }
            
            // Agregar separador y última página si es necesario
            if (endPage < totalPages) {
                const separator = document.createElement('span');
                separator.className = 'page-separator';
                separator.textContent = '...';
                pageButtons.appendChild(separator);
                
                const lastPageBtn = document.createElement('button');
                lastPageBtn.className = 'page-btn';
                lastPageBtn.textContent = totalPages;
                lastPageBtn.addEventListener('click', () => this._goToPage(totalPages));
                pageButtons.appendChild(lastPageBtn);
            }
        }
        
        // Actualizar estado de botones de navegación
        const prevBtn = paginationContainer.querySelector('.pagination-btn[data-action="prev"]');
        const nextBtn = paginationContainer.querySelector('.pagination-btn[data-action="next"]');
        const firstBtn = paginationContainer.querySelector('.pagination-btn[data-action="first"]');
        const lastBtn = paginationContainer.querySelector('.pagination-btn[data-action="last"]');
        
        if (prevBtn) prevBtn.disabled = currentPage === 1;
        if (nextBtn) nextBtn.disabled = currentPage === totalPages;
        if (firstBtn) firstBtn.disabled = currentPage === 1;
        if (lastBtn) lastBtn.disabled = currentPage === totalPages;
    }

    /**
     * Navega a una página específica
     * @param {number} page - Número de página
     * @private
     */
    _goToPage(page) {
        if (page === this.uiState.currentPage) return;
        
        this.uiState.currentPage = page;
        this._savePreferences();
        this._renderMarketTable();
        
        // Scroll al inicio de la tabla
        if (this.elements.tableContainer) {
            this.elements.tableContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    /**
     * Aplica ordenación por columna
     * @param {string} column - Columna a ordenar
     * @private
     */
    _sortByColumn(column) {
        if (this.uiState.sortColumn === column) {
            // Cambiar dirección si ya está ordenado por esta columna
            this.uiState.sortDirection = this.uiState.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            // Nueva columna, ordenar descendente por defecto
            this.uiState.sortColumn = column;
            this.uiState.sortDirection = 'desc';
        }
        
        // Aplicar ordenación
        this._applyFilters();
        this._renderMarketTable();
        this._savePreferences();
        
        // Actualizar indicadores visuales
        this._updateSortIndicators();
    }

    /**
     * Actualiza indicadores visuales de ordenación
     * @private
     */
    _updateSortIndicators() {
        if (!this.elements.table) return;
        
        // Quitar todas las clases de ordenación
        const headers = this.elements.table.querySelectorAll('th.sortable');
        headers.forEach(header => {
            header.classList.remove('sort-asc', 'sort-desc');
        });
        
        // Añadir clase a la columna actual
        const currentHeader = this.elements.table.querySelector(`th[data-sort="${this.uiState.sortColumn}"]`);
        if (currentHeader) {
            currentHeader.classList.add(`sort-${this.uiState.sortDirection}`);
        }
    }

    /**
     * Alternar favorito
     * @param {string} coinId - ID de la moneda
     * @private
     */
    _toggleFavorite(coinId) {
        const favorites = this._getFavorites();
        const index = favorites.indexOf(coinId);
        
        if (index === -1) {
            // Añadir a favoritos
            favorites.push(coinId);
            this._showToast(`${this._getCoinName(coinId)} añadido a favoritos`);
        } else {
            // Quitar de favoritos
            favorites.splice(index, 1);
            this._showToast(`${this._getCoinName(coinId)} eliminado de favoritos`);
        }
        
        // Guardar favoritos actualizados
        StorageManager.set('user.favorites.coins', favorites);
        
        // Actualizar visualización
        if (this.uiState.viewMode === 'favorites') {
            // Recargar si estamos en vista de favoritos
            this._applyFilters();
        }
        
        this._renderMarketTable();
        
        // Notificar cambio en favoritos
        EventBus.publish('user.favorites.updated', { favorites });
    }

    /**
     * Obtiene el nombre de una moneda por su ID
     * @param {string} coinId - ID de la moneda
     * @returns {string} Nombre de la moneda
     * @private
     */
    _getCoinName(coinId) {
        if (!this.currentData || !this.currentData.coins) return coinId;
        
        const coin = this.currentData.coins.find(c => c.id === coinId);
        return coin ? coin.name : coinId;
    }

    /**
     * Maneja la acción de añadir a portfolio
     * @param {string} coinId - ID de la moneda
     * @private
     */
    _handleAddToPortfolio(coinId) {
        // Publicar evento para que el componente de portfolio lo maneje
        EventBus.publish('portfolio.add.request', { coinId });
    }

    /**
     * Maneja la acción de configurar alerta
     * @param {string} coinId - ID de la moneda
     * @private
     */
    _handleSetAlert(coinId) {
        // Publicar evento para que el componente de alertas lo maneje
        EventBus.publish('alerts.create.request', { coinId });
    }

    /**
     * Inicializa referencias a elementos DOM
     * @private
     */
    _initDOMReferences() {
        // Referencias principales
        this.elements.tableContainer = document.getElementById(this.options.tableContainerId);
        this.elements.table = document.getElementById(this.options.tableId);
        this.elements.searchInput = document.getElementById(this.options.searchInputId);
        this.elements.filters = document.getElementById(this.options.filtersId);
        this.elements.refreshBtn = document.getElementById(this.options.refreshBtnId);
        this.elements.lastUpdated = document.getElementById(this.options.lastUpdatedId);
        
        // Referencias adicionales para filtros y ordenación
        if (this.elements.filters) {
            this.elements.categoryFilter = this.elements.filters.querySelector('[data-filter="category"]');
            this.elements.marketCapFilter = this.elements.filters.querySelector('[data-filter="market-cap"]');
            this.elements.viewModeToggle = this.elements.filters.querySelector('.view-mode-toggle');
            this.elements.columnSelector = this.elements.filters.querySelector('#columns-dropdown');
        }
    }

    /**
     * Configura event listeners
     * @private
     */
    _setupEventListeners() {
        // Botón de refresco
        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.addEventListener('click', () => {
                this.refreshData();
            });
        }
        
        // Campo de búsqueda con debounce
        if (this.elements.searchInput) {
            this.elements.searchInput.addEventListener('input', this._debounce(() => {
                this.uiState.searchQuery = this.elements.searchInput.value;
                this.uiState.currentPage = 1; // Resetear a primera página
                this._applyFilters();
                this._renderMarketTable();
                this._savePreferences();
            }, 300));
        }
        
        // Escuchadores para filtros de categoría
        if (this.elements.categoryFilter) {
            const categoryOptions = this.elements.categoryFilter.querySelectorAll('[data-value]');
            categoryOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.preventDefault();
                    const value = e.target.dataset.value;
                    
                    // Actualizar UI
                    categoryOptions.forEach(opt => opt.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    // Aplicar filtro
                    this.uiState.filterCategory = value;
                    this.uiState.currentPage = 1;
                    this._applyFilters();
                    this._renderMarketTable();
                    this._savePreferences();
                });
            });
        }
        
        // Escuchadores para filtros de capitalización
        if (this.elements.marketCapFilter) {
            const marketCapOptions = this.elements.marketCapFilter.querySelectorAll('[data-value]');
            marketCapOptions.forEach(option => {
                option.addEventListener('click', (e) => {
                    e.preventDefault();
                    const value = e.target.dataset.value;
                    
                    // Actualizar UI
                    marketCapOptions.forEach(opt => opt.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    // Aplicar filtro
                    this.uiState.filterMarketCap = value;
                    this.uiState.currentPage = 1;
                    this._applyFilters();
                    this._renderMarketTable();
                    this._savePreferences();
                });
            });
        }
        
        // Escuchadores para toggle de vista (todos/favoritos)
        if (this.elements.viewModeToggle) {
            const viewModeButtons = this.elements.viewModeToggle.querySelectorAll('[data-view]');
            viewModeButtons.forEach(button => {
                button.addEventListener('click', (e) => {
                    const view = e.target.dataset.view;
                    
                    // Actualizar UI
                    viewModeButtons.forEach(btn => btn.classList.remove('active'));
                    e.target.classList.add('active');
                    
                    // Aplicar filtro
                    this.uiState.viewMode = view;
                    this.uiState.currentPage = 1;
                    this._applyFilters();
                    this._renderMarketTable();
                    this._savePreferences();
                });
            });
        }
        
        // Escuchadores para selector de columnas
        if (this.elements.columnSelector) {
            const columnCheckboxes = this.elements.columnSelector.querySelectorAll('input[type="checkbox"]');
            columnCheckboxes.forEach(checkbox => {
                checkbox.addEventListener('change', () => {
                    // Recopilar columnas seleccionadas
                    const selectedColumns = Array.from(columnCheckboxes)
                        .filter(cb => cb.checked)
                        .map(cb => cb.id.replace('col-', ''));
                    
                    this.uiState.selectedColumns = selectedColumns;
                    this._renderMarketTable();
                    this._savePreferences();
                });
            });
        }
        
        // Escuchadores para ordenación por columna
        if (this.elements.table) {
            const sortableHeaders = this.elements.table.querySelectorAll('th.sortable');
            sortableHeaders.forEach(header => {
                header.addEventListener('click', () => {
                    const column = header.dataset.sort;
                    if (column) {
                        this._sortByColumn(column);
                    }
                });
            });
        }
        
        // Escuchadores para paginación
        const paginationContainer = document.getElementById(this.options.paginationId);
        if (paginationContainer) {
            // Botón anterior
            const prevBtn = paginationContainer.querySelector('.pagination-btn[data-action="prev"]');
            if (prevBtn) {
                prevBtn.addEventListener('click', () => {
                    if (this.uiState.currentPage > 1) {
                        this._goToPage(this.uiState.currentPage - 1);
                    }
                });
            }
            
            // Botón siguiente
            const nextBtn = paginationContainer.querySelector('.pagination-btn[data-action="next"]');
            if (nextBtn) {
                nextBtn.addEventListener('click', () => {
                    const totalPages = Math.ceil(this.filteredData.length / this.uiState.rowsPerPage);
                    if (this.uiState.currentPage < totalPages) {
                        this._goToPage(this.uiState.currentPage + 1);
                    }
                });
            }
            
            // Botón primera página
            const firstBtn = paginationContainer.querySelector('.pagination-btn[data-action="first"]');
            if (firstBtn) {
                firstBtn.addEventListener('click', () => {
                    this._goToPage(1);
                });
            }
            
            // Botón última página
            const lastBtn = paginationContainer.querySelector('.pagination-btn[data-action="last"]');
            if (lastBtn) {
                lastBtn.addEventListener('click', () => {
                    const totalPages = Math.ceil(this.filteredData.length / this.uiState.rowsPerPage);
                    this._goToPage(totalPages);
                });
            }
            
            // Selector de tamaño de página
            const pageSizeSelect = paginationContainer.querySelector('#page-size-select');
            if (pageSizeSelect) {
                pageSizeSelect.addEventListener('change', () => {
                    this.uiState.rowsPerPage = parseInt(pageSizeSelect.value);
                    this.uiState.currentPage = 1; // Resetear a primera página
                    this._renderMarketTable();
                    this._savePreferences();
                });
            }
        }
    }

    /**
     * Suscribe a eventos globales
     * @private
     */
    _subscribeToEvents() {
        // Suscribirse a actualizaciones de datos de mercado
        this._eventSubscriptions = [
            EventBus.subscribe('market.data.update', () => {
                this.refreshData();
            }),
            
            EventBus.subscribe('user.favorites.external.update', () => {
                this._renderMarketTable();
            }),
            
            EventBus.subscribe('app.theme.change', () => {
                // Actualizar gráficos si cambia el tema
                this._renderMarketCharts();
            }),
            
            EventBus.subscribe('device.change', () => {
                // Adaptar la vista si cambia el tipo de dispositivo
                this._adaptToDevice();
            })
        ];
    }

    /**
     * Adapta la visualización al tipo de dispositivo
     * @private
     */
    _adaptToDevice() {
        const isMobile = deviceDetector.isMobile();
        
        if (isMobile) {
            // Reducir columnas visibles en móvil
            this.uiState.selectedColumns = ['price', '24h', 'chart'];
        } else {
            // Restaurar columnas predeterminadas en desktop
            this.uiState.selectedColumns = this._getDefaultColumns();
        }
        
        this._renderMarketTable();
    }

    /**
     * Configura la actualización automática
     * @private
     */
    _setupAutoRefresh() {
        // Limpiar timer existente si lo hay
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        
        // Configurar nuevo timer
        this.refreshTimer = setInterval(() => {
            this.refreshData();
        }, this.options.autoRefreshInterval);
    }

    /**
     * Carga preferencias guardadas
     * @private
     */
    _loadPreferences() {
        const savedPrefs = StorageManager.get(this.options.storageNamespace);
        
        if (savedPrefs) {
            // Combinar preferencias guardadas con el estado actual
            this.uiState = {
                ...this.uiState,
                ...savedPrefs
            };
        }
    }

    /**
     * Guarda preferencias del usuario
     * @private
     */
    _savePreferences() {
        StorageManager.set(this.options.storageNamespace, {
            currentPage: this.uiState.currentPage,
            sortColumn: this.uiState.sortColumn,
            sortDirection: this.uiState.sortDirection,
            filterCategory: this.uiState.filterCategory,
            filterMarketCap: this.uiState.filterMarketCap,
            viewMode: this.uiState.viewMode,
            selectedColumns: this.uiState.selectedColumns,
            rowsPerPage: this.uiState.rowsPerPage
        });
    }

    /**
     * Obtiene las columnas predeterminadas
     * @returns {Array} Lista de columnas predeterminadas
     * @private
     */
    _getDefaultColumns() {
        return ['price', '24h', '7d', 'market-cap', 'volume', 'chart'];
    }

    /**
     * Obtiene la lista de favoritos del usuario
     * @returns {Array} Lista de IDs de monedas favoritas
     * @private
     */
    _getFavorites() {
        return StorageManager.get('user.favorites.coins') || [];
    }

    /**
     * Resetea los filtros a su estado por defecto
     * @private
     */
    _resetFilters() {
        this.uiState.searchQuery = '';
        this.uiState.filterCategory = 'all';
        this.uiState.filterMarketCap = 'all';
        this.uiState.currentPage = 1;
        
        // Actualizar campo de búsqueda
        if (this.elements.searchInput) {
            this.elements.searchInput.value = '';
        }
        
        // Actualizar UI de filtros
        if (this.elements.categoryFilter) {
            const allCategoryBtn = this.elements.categoryFilter.querySelector('[data-value="all"]');
            if (allCategoryBtn) {
                const allOptions = this.elements.categoryFilter.querySelectorAll('[data-value]');
                allOptions.forEach(opt => opt.classList.remove('active'));
                allCategoryBtn.classList.add('active');
            }
        }
        
        if (this.elements.marketCapFilter) {
            const allMarketCapBtn = this.elements.marketCapFilter.querySelector('[data-value="all"]');
            if (allMarketCapBtn) {
                const allOptions = this.elements.marketCapFilter.querySelectorAll('[data-value]');
                allOptions.forEach(opt => opt.classList.remove('active'));
                allMarketCapBtn.classList.add('active');
            }
        }
        
        // Aplicar cambios
        this._applyFilters();
        this._renderMarketTable();
        this._savePreferences();
    }

    /**
     * Actualiza el indicador de última actualización
     * @private
     */
    _updateLastUpdated() {
        if (this.elements.lastUpdated) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString();
            this.elements.lastUpdated.innerHTML = `Última actualización: <span>${timeStr}</span>`;
        }
    }

    /**
     * Muestra/oculta indicador de carga
     * @param {boolean} show - Si se debe mostrar el indicador
     * @private
     */
    _showLoading(show) {
        // Implementación dependiente de la estructura de la UI
        const loadingIndicator = document.querySelector('.loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.toggle('visible', show);
        }
        
        // Mostrar spinner en botón de refresco
        if (this.elements.refreshBtn) {
            this.elements.refreshBtn.classList.toggle('loading', show);
        }
    }

    /**
     * Muestra un mensaje de error
     * @param {string} message - Mensaje de error
     * @private
     */
    _showError(message) {
        // Implementación básica, podría usar un sistema de notificaciones más complejo
        console.error(message);
        
        // Mostrar mensaje de error en la UI
        const errorContainer = document.querySelector('.error-message');
        if (errorContainer) {
            errorContainer.textContent = message;
            errorContainer.classList.remove('hidden');
            
            // Ocultar después de un tiempo
            setTimeout(() => {
                errorContainer.classList.add('hidden');
            }, 5000);
        }
    }

    /**
     * Muestra un mensaje toast
     * @param {string} message - Mensaje a mostrar
     * @private
     */
    _showToast(message) {
        // Buscar contenedor de toasts o crearlo si no existe
        let toastContainer = document.getElementById('toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Crear toast
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = message;
        
        // Añadir al contenedor
        toastContainer.appendChild(toast);
        
        // Mostrar con animación
        setTimeout(() => {
            toast.classList.add('show');
        }, 10);
        
        // Ocultar después de un tiempo
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 3000);
    }

    /**
     * Formatea un número para visualización
     * @param {number} num - Número a formatear
     * @returns {string} Número formateado
     * @private
     */
    _formatNumber(num) {
        if (num === null || num === undefined) return '-';
        
        // Para números grandes, usar formato compacto
        if (num >= 1000000000) {
            return (num / 1000000000).toFixed(2) + 'B';
        } else if (num >= 1000000) {
            return (num / 1000000).toFixed(2) + 'M';
        } else if (num >= 1000) {
            return (num / 1000).toFixed(2) + 'K';
        } else if (num < 0.01 && num > 0) {
            return num.toFixed(6);
        } else {
            return num.toLocaleString(undefined, { 
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
    }

    /**
     * Formatea un número en formato compacto
     * @param {number} num - Número a formatear
     * @returns {string} Número formateado
     * @private
     */
    _formatCompactNumber(num) {
        if (num === null || num === undefined) return '-';
        
        // Usar formato compacto para representación en ejes
        const formatter = new Intl.NumberFormat('en-US', {
            notation: 'compact',
            compactDisplay: 'short'
        });
        
        return formatter.format(num);
    }

    /**
     * Función de utilidad para limitar la frecuencia de ejecución (debounce)
     * @param {Function} func - Función a ejecutar
     * @param {number} wait - Tiempo de espera en ms
     * @returns {Function} Función con límite de frecuencia
     * @private
     */
    _debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    /**
     * Limpia recursos cuando el controlador ya no se necesita
     */
    destroy() {
        // Limpiar timer de auto-refresh
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        
        // Destruir instancias de gráficos
        for (const chart in this.chartInstances) {
            if (this.chartInstances[chart] && this.chartInstances[chart].destroy) {
                this.chartInstances[chart].destroy();
            }
        }
        
        // Cancelar suscripciones a eventos
        if (this._eventSubscriptions) {
            this._eventSubscriptions.forEach(unsub => unsub());
        }
        
        console.log('Market Controller destruido correctamente');
    }
}

// Exportar controlador para uso en otros módulos
export default MarketController;
