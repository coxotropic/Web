/**
 * coin-controller.js
 * Controlador para la página de detalle de criptomonedas
 * 
 * Este módulo gestiona toda la visualización e interacción en la página de detalle
 * de criptomonedas, incluyendo gráficos, datos fundamentales, análisis técnico,
 * noticias relacionadas y características sociales.
 * 
 * @module crypto/coin-controller
 */

// Importar servicios y utilidades necesarios
import { MarketDataService } from '../market/market-data-service.js';
import { EventBus } from '../utils/event-bus.js';
import { StorageManager } from '../utils/storage-manager.js';
import { NotificationService } from '../user/notification-service.js';
import { PortfolioManager } from '../portfolio/portfolio-manager.js';
import { CommentsService } from '../social/comments-service.js';
import { NewsService } from '../news/news-service.js';

/**
 * Clase principal para controlar la visualización y funcionalidad de la página
 * de detalle de criptomonedas.
 */
export class CoinController {
    /**
     * Constructor del controlador
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        // Opciones por defecto
        this.options = {
            // Selector del contenedor principal
            container: '#coin-detail-container',
            
            // Selectores de elementos principales
            selectors: {
                priceChart: '#price-chart',
                volumeChart: '#volume-chart',
                currentPrice: '#current-price',
                priceChange: '#price-change',
                tabButtons: '.nav-link',
                tabContent: '.tab-pane',
                timeframeButtons: '.timeframe-btn',
                chartTypeButtons: '.chart-type-btn',
                buyButton: '#buy-btn',
                sellButton: '#sell-btn',
                alertButton: '#set-alert-btn',
                watchlistButton: '#add-watchlist-btn',
                commentsContainer: '#comments-container'
            },
            
            // Períodos de tiempo disponibles para el gráfico
            timeframes: {
                '1d': { interval: '5m', limit: 288 },   // 5 minutos x 288 = 24 horas
                '1w': { interval: '1h', limit: 168 },   // 1 hora x 168 = 1 semana
                '1m': { interval: '4h', limit: 180 },   // 4 horas x 180 = 30 días
                '3m': { interval: '12h', limit: 180 },  // 12 horas x 180 = 90 días
                '1y': { interval: '1d', limit: 365 },   // 1 día x 365 = 1 año
                'all': { interval: '1w', limit: 500 }   // 1 semana x 500 = ~10 años
            },
            
            // Indicadores técnicos disponibles
            technicalIndicators: [
                { id: 'sma', name: 'Media Móvil Simple', params: { period: 20, color: '#3498db' } },
                { id: 'ema', name: 'Media Móvil Exponencial', params: { period: 50, color: '#2ecc71' } },
                { id: 'bb', name: 'Bandas de Bollinger', params: { period: 20, stdDev: 2, color: '#9b59b6' } },
                { id: 'rsi', name: 'RSI', params: { period: 14, overbought: 70, oversold: 30, color: '#e74c3c' } },
                { id: 'macd', name: 'MACD', params: { fastPeriod: 12, slowPeriod: 26, signalPeriod: 9, color: '#f39c12' } }
            ],
            
            // Opciones para comparar con otras criptomonedas
            compareOptions: ['BTC', 'ETH', 'BNB', 'XRP', 'ADA', 'SOL', 'AVAX', 'DOT'],
            
            // Actualizar datos cada 30 segundos
            refreshInterval: 30000,
            
            ...options
        };
        
        // Estado del controlador
        this.state = {
            coinId: null,              // ID de la criptomoneda actual
            coinData: null,            // Datos completos de la criptomoneda
            priceHistory: [],          // Historial de precios para gráficos
            currentTimeframe: '1m',    // Timeframe activo
            activeTab: 'overview',     // Pestaña activa
            chartType: 'candle',       // Tipo de gráfico (candle, line)
            activeIndicators: [],      // Indicadores técnicos activos
            comparingWith: null,       // Criptomoneda con la que se compara
            relatedNews: [],           // Noticias relacionadas
            userPreferences: null,     // Preferencias del usuario
            isInWatchlist: false,      // Si está en la lista de seguimiento
            isInPortfolio: false,      // Si está en el portfolio del usuario
            userAlerts: [],            // Alertas configuradas por el usuario
            chartInstance: null,       // Instancia del gráfico
            updateInterval: null       // Intervalo de actualización
        };
        
        // Servicios
        this.marketDataService = new MarketDataService();
        this.portfolioManager = new PortfolioManager();
        this.notificationService = new NotificationService();
        this.commentsService = new CommentsService();
        this.newsService = new NewsService();
        
        // Elementos DOM
        this.elements = {};
        
        // Inicializar controlador
        this.init();
    }
    
    /**
     * Inicializa el controlador
     */
    async init() {
        try {
            console.log('Inicializando CoinController...');
            
            // Obtener el ID de la criptomoneda de la URL
            this.state.coinId = this.getCoinIdFromUrl();
            
            if (!this.state.coinId) {
                throw new Error('ID de criptomoneda no encontrado en la URL');
            }
            
            // Cachear referencias a elementos DOM
            this.cacheElements();
            
            // Cargar preferencias del usuario
            this.loadUserPreferences();
            
            // Configurar eventos
            this.setupEventListeners();
            
            // Cargar datos iniciales
            await this.loadCoinData();
            
            // Inicializar interfaz
            this.initializeUI();
            
            // Configurar intervalo de actualización
            this.setupRefreshInterval();
            
            // Registrar visualización para analytics
            this.trackPageView();
            
            console.log(`CoinController inicializado para ${this.state.coinId}`);
            
            // Notificar que la página está lista
            EventBus.publish('coin.detail.ready', {
                coinId: this.state.coinId,
                coinData: this.state.coinData
            });
        } catch (error) {
            console.error('Error al inicializar CoinController:', error);
            this.showErrorMessage('No se pudo cargar la información de la criptomoneda');
        }
    }
    
    /**
     * Obtiene el ID de la criptomoneda de la URL
     * @returns {string} ID de la criptomoneda
     */
    getCoinIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const pathSegments = window.location.pathname.split('/');
        
        // Intentar obtener de parámetros de URL primero
        if (urlParams.has('coin')) {
            return urlParams.get('coin');
        }
        
        // Luego intentar de la ruta (ej. /crypto/bitcoin)
        const coinIndex = pathSegments.indexOf('crypto');
        if (coinIndex !== -1 && pathSegments.length > coinIndex + 1) {
            return pathSegments[coinIndex + 1];
        }
        
        // Fallback a bitcoin si no se encuentra
        return 'bitcoin';
    }
    
    /**
     * Guarda referencias a elementos DOM para mejor rendimiento
     */
    cacheElements() {
        const container = document.querySelector(this.options.container);
        if (!container) {
            throw new Error(`Contenedor ${this.options.container} no encontrado`);
        }
        
        // Cachear todos los elementos definidos en los selectores
        for (const [key, selector] of Object.entries(this.options.selectors)) {
            if (selector.startsWith('#')) {
                // Elementos individuales por ID
                this.elements[key] = container.querySelector(selector);
            } else {
                // Colecciones de elementos por clase o selector genérico
                this.elements[key] = container.querySelectorAll(selector);
            }
        }
    }
    
    /**
     * Carga preferencias del usuario desde el almacenamiento
     */
    loadUserPreferences() {
        try {
            // Cargar preferencias generales
            const generalPrefs = StorageManager.get('user.preferences') || {};
            
            // Cargar preferencias específicas para detalles de monedas
            const coinPrefs = StorageManager.get('user.preferences.coinDetail') || {};
            
            // Combinar preferencias
            this.state.userPreferences = {
                ...generalPrefs,
                ...coinPrefs
            };
            
            // Aplicar preferencias al estado
            if (coinPrefs.defaultTimeframe && this.options.timeframes[coinPrefs.defaultTimeframe]) {
                this.state.currentTimeframe = coinPrefs.defaultTimeframe;
            }
            
            if (coinPrefs.defaultChartType) {
                this.state.chartType = coinPrefs.defaultChartType;
            }
            
            if (Array.isArray(coinPrefs.activeIndicators)) {
                this.state.activeIndicators = coinPrefs.activeIndicators;
            }
            
            console.log('Preferencias de usuario cargadas:', this.state.userPreferences);
        } catch (error) {
            console.error('Error al cargar preferencias de usuario:', error);
            // Continuar con valores por defecto si hay error
        }
    }
    
    /**
     * Configura los listeners de eventos
     */
    setupEventListeners() {
        try {
            // Botones de timeframe
            if (this.elements.timeframeButtons) {
                this.elements.timeframeButtons.forEach(button => {
                    button.addEventListener('click', this.handleTimeframeChange.bind(this));
                });
            }
            
            // Botones de tipo de gráfico
            if (this.elements.chartTypeButtons) {
                this.elements.chartTypeButtons.forEach(button => {
                    button.addEventListener('click', this.handleChartTypeChange.bind(this));
                });
            }
            
            // Pestañas de información
            if (this.elements.tabButtons) {
                this.elements.tabButtons.forEach(button => {
                    button.addEventListener('click', this.handleTabChange.bind(this));
                });
            }
            
            // Botones de acción
            if (this.elements.buyButton) {
                this.elements.buyButton.addEventListener('click', this.handleBuyAction.bind(this));
            }
            
            if (this.elements.sellButton) {
                this.elements.sellButton.addEventListener('click', this.handleSellAction.bind(this));
            }
            
            if (this.elements.alertButton) {
                this.elements.alertButton.addEventListener('click', this.handleAlertAction.bind(this));
            }
            
            if (this.elements.watchlistButton) {
                this.elements.watchlistButton.addEventListener('click', this.handleWatchlistAction.bind(this));
            }
            
            // Eventos del bus de eventos global
            EventBus.subscribe('market.priceUpdate', this.handlePriceUpdate.bind(this));
            EventBus.subscribe('user.portfolio.change', this.checkPortfolioStatus.bind(this));
            EventBus.subscribe('user.watchlist.change', this.checkWatchlistStatus.bind(this));
            
            // Eventos de ventana
            window.addEventListener('resize', this.handleResize.bind(this));
            
            console.log('Event listeners configurados');
        } catch (error) {
            console.error('Error al configurar event listeners:', error);
        }
    }
    
    /**
     * Carga los datos de la criptomoneda
     */
    async loadCoinData() {
        try {
            console.log(`Cargando datos para ${this.state.coinId}...`);
            
            // Mostrar indicador de carga
            this.showLoading(true);
            
            // Cargar datos básicos de la moneda
            this.state.coinData = await this.marketDataService.getCoinData(this.state.coinId);
            
            if (!this.state.coinData) {
                throw new Error(`No se encontraron datos para ${this.state.coinId}`);
            }
            
            console.log('Datos de moneda cargados:', this.state.coinData);
            
            // Cargar datos históricos para el timeframe actual
            await this.loadPriceHistory();
            
            // Cargar noticias relacionadas
            this.loadRelatedNews();
            
            // Verificar si está en watchlist y portfolio
            this.checkWatchlistStatus();
            this.checkPortfolioStatus();
            
            // Cargar alertas del usuario para esta moneda
            this.loadUserAlerts();
            
            // Ocultar indicador de carga
            this.showLoading(false);
            
            return this.state.coinData;
        } catch (error) {
            console.error(`Error al cargar datos de ${this.state.coinId}:`, error);
            this.showLoading(false);
            this.showErrorMessage(`No se pudo cargar la información de ${this.state.coinId}`);
            throw error;
        }
    }
    
    /**
     * Carga el historial de precios para el timeframe seleccionado
     */
    async loadPriceHistory() {
        try {
            const { interval, limit } = this.options.timeframes[this.state.currentTimeframe];
            
            console.log(`Cargando historial de precios con intervalo ${interval}, límite ${limit}`);
            
            // Obtener historial de precios del servicio de datos
            this.state.priceHistory = await this.marketDataService.getCoinPriceHistory(
                this.state.coinId,
                {
                    interval,
                    limit,
                    vs_currency: this.state.userPreferences?.currency || 'usd'
                }
            );
            
            console.log(`Historial de precios cargado: ${this.state.priceHistory.length} puntos`);
            
            // Si hay una comparación activa, cargar también esos datos
            if (this.state.comparingWith) {
                const compareData = await this.marketDataService.getCoinPriceHistory(
                    this.state.comparingWith,
                    {
                        interval,
                        limit,
                        vs_currency: this.state.userPreferences?.currency || 'usd'
                    }
                );
                
                this.state.compareHistory = compareData;
            }
            
            // Actualizar el gráfico con los nuevos datos
            this.updatePriceChart();
            
            return this.state.priceHistory;
        } catch (error) {
            console.error('Error al cargar historial de precios:', error);
            this.showErrorMessage('No se pudo cargar el historial de precios');
            return [];
        }
    }
    
    /**
     * Carga noticias relacionadas con la criptomoneda
     */
    async loadRelatedNews() {
        try {
            // Obtener noticias relacionadas del servicio de noticias
            this.state.relatedNews = await this.newsService.getNewsByCategory(this.state.coinId, 5);
            
            // Actualizar la UI con las noticias
            this.updateRelatedNews();
            
            return this.state.relatedNews;
        } catch (error) {
            console.error('Error al cargar noticias relacionadas:', error);
            // No mostramos error al usuario ya que las noticias son contenido secundario
            return [];
        }
    }
    
    /**
     * Verifica si la moneda está en la lista de seguimiento del usuario
     */
    checkWatchlistStatus() {
        try {
            const watchlist = this.marketDataService.getUserWatchlist();
            this.state.isInWatchlist = watchlist.includes(this.state.coinId);
            
            // Actualizar UI
            this.updateWatchlistButton();
        } catch (error) {
            console.error('Error al verificar estado de watchlist:', error);
        }
    }
    
    /**
     * Verifica si la moneda está en el portfolio del usuario
     */
    checkPortfolioStatus() {
        try {
            const holdings = this.portfolioManager.getHoldings();
            this.state.isInPortfolio = holdings.some(h => h.coinId === this.state.coinId);
            
            // Si está en portfolio, obtener datos específicos
            if (this.state.isInPortfolio) {
                this.state.portfolioData = holdings.find(h => h.coinId === this.state.coinId);
            } else {
                this.state.portfolioData = null;
            }
            
            // Actualizar UI
            this.updatePortfolioSection();
        } catch (error) {
            console.error('Error al verificar estado de portfolio:', error);
        }
    }
    
    /**
     * Carga las alertas del usuario para esta moneda
     */
    async loadUserAlerts() {
        try {
            // Obtener alertas del servicio de notificaciones
            const allAlerts = await this.notificationService.getUserAlerts();
            
            // Filtrar alertas para esta moneda
            this.state.userAlerts = allAlerts.filter(alert => 
                alert.coinId === this.state.coinId && alert.active
            );
            
            // Actualizar UI
            this.updateAlertsSection();
        } catch (error) {
            console.error('Error al cargar alertas de usuario:', error);
        }
    }
    
    /**
     * Inicializa la interfaz de usuario
     */
    initializeUI() {
        try {
            // Actualizar datos básicos
            this.updateBasicInfo();
            
            // Inicializar gráfico
            this.initializePriceChart();
            
            // Activar las pestañas y timeframes correspondientes en la UI
            this.activateTab(this.state.activeTab);
            this.activateTimeframe(this.state.currentTimeframe);
            this.activateChartType(this.state.chartType);
            
            // Inicializar componentes específicos según las pestañas
            this.initializeTabComponents();
            
            // Cargar sistema de comentarios
            this.initializeComments();
        } catch (error) {
            console.error('Error al inicializar UI:', error);
        }
    }
    
    /**
     * Actualiza la información básica en la UI
     */
    updateBasicInfo() {
        try {
            const { coinData } = this.state;
            
            if (!coinData) return;
            
            // Actualizar título de la página
            document.title = `${coinData.name} (${coinData.symbol.toUpperCase()}) - Precio y Análisis`;
            
            // Actualizar elementos básicos
            if (this.elements.currentPrice) {
                this.elements.currentPrice.textContent = this.formatCurrency(coinData.current_price);
            }
            
            if (this.elements.priceChange) {
                const changePercent = coinData.price_change_percentage_24h;
                this.elements.priceChange.textContent = `${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%`;
                this.elements.priceChange.className = changePercent >= 0 ? 'price-change positive' : 'price-change negative';
                
                // Actualizar icono
                const icon = this.elements.priceChange.querySelector('i');
                if (icon) {
                    icon.className = changePercent >= 0 ? 'icon-trending-up' : 'icon-trending-down';
                }
            }
            
            // Actualizar otros elementos de la UI con datos de la moneda
            const selectors = {
                '#coin-name': coinData.name,
                '#coin-ticker': coinData.symbol.toUpperCase(),
                '#market-cap-value': this.formatCurrency(coinData.market_cap),
                '#volume-24h-value': this.formatCurrency(coinData.total_volume),
                '#circulating-supply': `${this.formatNumber(coinData.circulating_supply)} ${coinData.symbol.toUpperCase()}`
            };
            
            // Actualizar cada elemento si existe
            Object.entries(selectors).forEach(([selector, value]) => {
                const element = document.querySelector(selector);
                if (element) {
                    element.textContent = value;
                }
            });
            
            // Actualizar imagen de la moneda
            const coinIcon = document.querySelector('#coin-icon');
            if (coinIcon && coinData.image) {
                coinIcon.src = coinData.image;
                coinIcon.alt = coinData.name;
            }
        } catch (error) {
            console.error('Error al actualizar información básica:', error);
        }
    }
    
    /**
     * Inicializa el gráfico de precios
     */
    initializePriceChart() {
        try {
            // Verificar si el elemento del gráfico existe
            const chartElement = this.elements.priceChart;
            if (!chartElement) {
                console.error('Elemento de gráfico no encontrado');
                return;
            }
            
            // Si ya hay una instancia del gráfico, destruirla
            if (this.state.chartInstance) {
                this.state.chartInstance.destroy();
            }
            
            // Aquí iría la implementación específica con la biblioteca de gráficos elegida
            // (ej. TradingView, ApexCharts, Chart.js, Highcharts, etc.)
            
            // Ejemplo con estructura para una implementación genérica:
            this.state.chartInstance = new PriceChart(chartElement, {
                type: this.state.chartType,
                theme: this.state.userPreferences?.theme || 'dark',
                indicators: this.state.activeIndicators,
                onChartReady: () => {
                    this.updatePriceChart();
                }
            });
            
            console.log('Gráfico de precios inicializado');
        } catch (error) {
            console.error('Error al inicializar gráfico de precios:', error);
            // Mostrar un mensaje de error en el contenedor del gráfico
            if (this.elements.priceChart) {
                this.elements.priceChart.innerHTML = `
                    

                        
                        
No se pudo cargar el gráfico


                    

                `;
            }
        }
    }
    
    /**
     * Actualiza el gráfico de precios con los datos más recientes
     */
    updatePriceChart() {
        try {
            if (!this.state.chartInstance || !this.state.priceHistory || this.state.priceHistory.length === 0) {
                return;
            }
            
            // Actualizar datos del gráfico principal
            this.state.chartInstance.updateData({
                main: this.state.priceHistory,
                compare: this.state.compareHistory || null
            });
            
            // Actualizar eventos importantes en el gráfico si están disponibles
            if (this.state.coinData.important_events) {
                this.state.chartInstance.addEvents(this.state.coinData.important_events);
            }
            
            console.log('Gráfico de precios actualizado');
        } catch (error) {
            console.error('Error al actualizar gráfico de precios:', error);
        }
    }
    
    /**
     * Actualiza la sección de noticias relacionadas
     */
    updateRelatedNews() {
        try {
            const newsContainer = document.querySelector('.recent-news .card-body');
            if (!newsContainer || !this.state.relatedNews || this.state.relatedNews.length === 0) {
                return;
            }
            
            // Construir HTML para las noticias
            const newsHTML = this.state.relatedNews.map(news => `
                
                    
${this.formatTimeAgo(news.publishedAt)}

                    
${news.title}

                    
${news.source}

                
            `).join('');
            
            // Actualizar el contenedor
            newsContainer.innerHTML = newsHTML;
        } catch (error) {
            console.error('Error al actualizar noticias relacionadas:', error);
        }
    }
    
    /**
     * Inicializa los componentes específicos de cada pestaña
     */
    initializeTabComponents() {
        try {
            // Inicializar componentes diferentes según la pestaña activa
            
            // Pestaña de análisis técnico
            const technicalTab = document.querySelector('#technical-tab');
            if (technicalTab) {
                this.initializeTechnicalAnalysisTab();
            }
            
            // Pestaña de mercados
            const marketsTab = document.querySelector('#markets-tab');
            if (marketsTab) {
                this.initializeMarketsTab();
            }
            
            // Pestaña on-chain
            const onchainTab = document.querySelector('#onchain-tab');
            if (onchainTab) {
                this.initializeOnChainTab();
            }
            
            // Pestaña social
            const socialTab = document.querySelector('#social-tab');
            if (socialTab) {
                this.initializeSocialTab();
            }
        } catch (error) {
            console.error('Error al inicializar componentes de pestañas:', error);
        }
    }
    
    /**
     * Inicializa el sistema de comentarios
     */
    async initializeComments() {
        try {
            // Verificar si el contenedor de comentarios existe
            if (!this.elements.commentsContainer) {
                return;
            }
            
            // Inicializar sistema de comentarios
            await this.commentsService.initialize({
                container: this.elements.commentsContainer,
                entityType: 'coin',
                entityId: this.state.coinId
            });
            
            console.log('Sistema de comentarios inicializado');
        } catch (error) {
            console.error('Error al inicializar sistema de comentarios:', error);
            
            // Mostrar mensaje de error genérico
            if (this.elements.commentsContainer) {
                this.elements.commentsContainer.innerHTML = `
                    

                        
No se pudieron cargar los comentarios


                        Reintentar
                    

                `;
                
                // Añadir event listener para reintentar
                const retryButton = document.querySelector('#retry-comments');
                if (retryButton) {
                    retryButton.addEventListener('click', () => this.initializeComments());
                }
            }
        }
    }
    
    /**
     * Inicializa la pestaña de análisis técnico
     */
    initializeTechnicalAnalysisTab() {
        try {
            const tab = document.querySelector('#technical-tab');
            if (!tab) return;
            
            // Construir lista de indicadores técnicos disponibles
            const indicatorsContainer = tab.querySelector('.indicators-list');
            if (indicatorsContainer) {
                const indicatorsHTML = this.options.technicalIndicators.map(indicator => `
                    

                        

                            
                            
                                ${indicator.name}
                            
                        

                        

                            
                        

                    

                `).join('');
                
                indicatorsContainer.innerHTML = indicatorsHTML;
                
                // Añadir event listeners para los checkboxes
                const checkboxes = indicatorsContainer.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(checkbox => {
                    checkbox.addEventListener('change', this.handleIndicatorToggle.bind(this));
                });
            }
            
            // Inicializar otros componentes de análisis técnico
            // Esto dependerá de las bibliotecas específicas que se utilicen
        } catch (error) {
            console.error('Error al inicializar pestaña de análisis técnico:', error);
        }
    }
    
    /**
     * Inicializa la pestaña de mercados
     */
    initializeMarketsTab() {
        try {
            const tab = document.querySelector('#markets-tab');
            if (!tab) return;
            
            // Cargar datos de mercados donde se opera la moneda
            this.loadMarketData();
        } catch (error) {
            console.error('Error al inicializar pestaña de mercados:', error);
        }
    }
    
    /**
     * Inicializa la pestaña de métricas on-chain
     */
    initializeOnChainTab() {
        try {
            const tab = document.querySelector('#onchain-tab');
            if (!tab) return;
            
            // Cargar datos on-chain si están disponibles
            this.loadOnChainData();
        } catch (error) {
            console.error('Error al inicializar pestaña on-chain:', error);
        }
    }
    
    /**
     * Inicializa la pestaña social
     */
    initializeSocialTab() {
        try {
            const tab = document.querySelector('#social-tab');
            if (!tab) return;
            
            // Cargar datos sociales como menciones en redes, sentimiento, etc.
            this.loadSocialData();
        } catch (error) {
            console.error('Error al inicializar pestaña social:', error);
        }
    }
    
    /**
     * Configura el intervalo de actualización de datos
     */
    setupRefreshInterval() {
        // Limpiar intervalo existente si lo hay
        if (this.state.updateInterval) {
            clearInterval(this.state.updateInterval);
        }
        
        // Configurar nuevo intervalo
        this.state.updateInterval = setInterval(() => {
            // Actualizar solo los datos esenciales para no sobrecargar
            this.refreshEssentialData();
        }, this.options.refreshInterval);
        
        console.log(`Intervalo de actualización configurado: ${this.options.refreshInterval}ms`);
    }
    
    /**
     * Actualiza los datos esenciales periódicamente
     */
    async refreshEssentialData() {
        try {
            // Obtener solo datos básicos de precio
            const priceData = await this.marketDataService.getCoinPriceOnly(this.state.coinId);
            
            // Actualizar datos en el estado
            if (priceData && this.state.coinData) {
                this.state.coinData.current_price = priceData.current_price;
                this.state.coinData.price_change_percentage_24h = priceData.price_change_percentage_24h;
                
                // Actualizar UI con los nuevos datos
                this.updateBasicInfo();
                
                // Añadir el punto más reciente al historial si es un timeframe corto
                if (['1d', '1w'].includes(this.state.currentTimeframe) && this.state.priceHistory.length > 0) {
                    // Implementación específica según formato de datos
                    this.addLatestPricePoint(priceData);
                }
            }
        } catch (error) {
            console.error('Error al actualizar datos esenciales:', error);
            // No mostrar error al usuario para no interrumpir la experiencia
        }
    }
    
    /**
     * Añade el punto de precio más reciente al historial
     * @param {Object} priceData - Datos de precio actualizados
     */
    addLatestPricePoint(priceData) {
        try {
            if (!this.state.priceHistory || !this.state.chartInstance) return;
            
            // La implementación dependerá del formato de datos utilizado
            const latestPoint = {
                timestamp: new Date().getTime(),
                price: priceData.current_price,
                // Otros datos necesarios según la implementación del gráfico
            };
            
            // Actualizar historia de precios y gráfico
            this.state.priceHistory.push(latestPoint);
            this.state.chartInstance.addDataPoint(latestPoint);
        } catch (error) {
            console.error('Error al añadir punto de precio:', error);
        }
    }
    
    /**
     * Activa la pestaña seleccionada
     * @param {string} tabId - ID de la pestaña a activar
     */
    activateTab(tabId) {
        try {
            // Actualizar estado
            this.state.activeTab = tabId;
            
            // Actualizar UI
            if (!this.elements.tabButtons) return;
            
            // Desactivar todas las pestañas
            this.elements.tabButtons.forEach(tab => {
                tab.classList.remove('active');
                
                // Obtener el contenido de esta pestaña
                const tabContent = document.querySelector(tab.getAttribute('href'));
                if (tabContent) {
                    tabContent.classList.remove('active');
                }
            });
            
            // Activar la pestaña seleccionada
            const selectedTab = Array.from(this.elements.tabButtons).find(tab => {
                return tab.getAttribute('href') === `#${tabId}-tab` || tab.getAttribute('data-tab') === tabId;
            });
            
            if (selectedTab) {
                selectedTab.classList.add('active');
                
                // Activar contenido de esta pestaña
                const tabContent = document.querySelector(selectedTab.getAttribute('href'));
                if (tabContent) {
                    tabContent.classList.add('active');
                }
            }
        } catch (error) {
            console.error('Error al activar pestaña:', error);
        }
    }
    
    /**
     * Activa el timeframe seleccionado
     * @param {string} timeframe - Timeframe a activar
     */
    activateTimeframe(timeframe) {
        try {
            // Actualizar estado
            this.state.currentTimeframe = timeframe;
            
            // Actualizar UI
            if (!this.elements.timeframeButtons) return;
            
            // Desactivar todos los timeframes
            this.elements.timeframeButtons.forEach(button => {
                button.classList.remove('active');
            });
            
            // Activar el timeframe seleccionado
            const selectedButton = Array.from(this.elements.timeframeButtons).find(button => {
                return button.getAttribute('data-timeframe') === timeframe;
            });
            
            if (selectedButton) {
                selectedButton.classList.add('active');
            }
        } catch (error) {
            console.error('Error al activar timeframe:', error);
        }
    }
    
    /**
     * Activa el tipo de gráfico seleccionado
     * @param {string} chartType - Tipo de gráfico a activar
     */
    activateChartType(chartType) {
        try {
            // Actualizar estado
            this.state.chartType = chartType;
            
            // Actualizar UI
            if (!this.elements.chartTypeButtons) return;
            
            // Desactivar todos los tipos
            this.elements.chartTypeButtons.forEach(button => {
                button.classList.remove('active');
            });
            
            // Activar el tipo seleccionado
            const selectedButton = Array.from(this.elements.chartTypeButtons).find(button => {
                return button.getAttribute('data-chart-type') === chartType;
            });
            
            if (selectedButton) {
                selectedButton.classList.add('active');
            }
            
            // Actualizar tipo en el gráfico si existe
            if (this.state.chartInstance) {
                this.state.chartInstance.setChartType(chartType);
            }
        } catch (error) {
            console.error('Error al activar tipo de gráfico:', error);
        }
    }
    
    /**
     * Actualiza el botón de lista de seguimiento
     */
    updateWatchlistButton() {
        try {
            if (!this.elements.watchlistButton) return;
            
            // Actualizar texto e icono según estado
            if (this.state.isInWatchlist) {
                this.elements.watchlistButton.innerHTML = ' En Favoritos';
                this.elements.watchlistButton.classList.add('active');
            } else {
                this.elements.watchlistButton.innerHTML = ' Añadir a Favoritos';
                this.elements.watchlistButton.classList.remove('active');
            }
        } catch (error) {
            console.error('Error al actualizar botón de watchlist:', error);
        }
    }
    
    /**
     * Actualiza la sección de portfolio
     */
    updatePortfolioSection() {
        try {
            // Implementación según el diseño de la UI
            const portfolioSection = document.querySelector('.portfolio-section');
            if (!portfolioSection) return;
            
            if (this.state.isInPortfolio && this.state.portfolioData) {
                // Usuario tiene esta moneda, mostrar datos de la posición
                portfolioSection.innerHTML = `
                    

                        

                            
Tu Posición

                        

                        

                            

                                

                                    
Cantidad

                                    
${this.formatNumber(this.state.portfolioData.amount)} ${this.state.coinData.symbol.toUpperCase()}

                                

                                

                                    
Valor

                                    
${this.formatCurrency(this.state.portfolioData.amount * this.state.coinData.current_price)}

                                

                                

                                    
Precio promedio

                                    
${this.formatCurrency(this.state.portfolioData.averagePrice)}

                                

                                

                                    
P/L

                                    

                                        ${this.formatCurrency(this.state.portfolioData.profitLoss)} (${this.state.portfolioData.profitLossPercentage.toFixed(2)}%)
                                    

                                

                            

                            

                                Editar Posición
                                Ver Transacciones
                            

                        

                    

                `;
                
                // Añadir event listeners
                const editButton = portfolioSection.querySelector('#edit-position-btn');
                const viewButton = portfolioSection.querySelector('#view-transactions-btn');
                
                if (editButton) {
                    editButton.addEventListener('click', this.handleEditPosition.bind(this));
                }
                
                if (viewButton) {
                    viewButton.addEventListener('click', this.handleViewTransactions.bind(this));
                }
            } else {
                // Usuario no tiene esta moneda, mostrar CTA para añadir
                portfolioSection.innerHTML = `
                    

                        

                            
Añadir a Portfolio

                        

                        

                            
Aún no tienes ${this.state.coinData.name} en tu portfolio.


                            
                                 Añadir a Portfolio
                            
                        

                    

                `;
                
                // Añadir event listener
                const addButton = portfolioSection.querySelector('#add-to-portfolio-btn');
                if (addButton) {
                    addButton.addEventListener('click', this.handleAddToPortfolio.bind(this));
                }
            }
        } catch (error) {
            console.error('Error al actualizar sección de portfolio:', error);
        }
    }
    
    /**
     * Actualiza la sección de alertas
     */
    updateAlertsSection() {
        try {
            // Implementación según el diseño de la UI
            const alertsContainer = document.querySelector('.alerts-container');
            if (!alertsContainer) return;
            
            if (this.state.userAlerts && this.state.userAlerts.length > 0) {
                // Mostrar alertas existentes
                const alertsHTML = this.state.userAlerts.map(alert => `
                    

                        

                            

                                
                                ${this.getAlertTypeLabel(alert.type)}
                            

                            
${this.formatAlertValue(alert)}

                        

                        

                            
                                
                            
                            
                                
                            
                        

                    

                `).join('');
                
                alertsContainer.innerHTML = `
                    

                        

                            
Tus Alertas

                            
                                 Nueva Alerta
                            
                        

                        

                            

                                ${alertsHTML}
                            

                        

                    

                `;
                
                // Añadir event listeners
                const addButton = alertsContainer.querySelector('#add-alert-btn');
                if (addButton) {
                    addButton.addEventListener('click', this.handleAlertAction.bind(this));
                }
                
                const editButtons = alertsContainer.querySelectorAll('.edit-alert');
                editButtons.forEach(button => {
                    button.addEventListener('click', this.handleEditAlert.bind(this));
                });
                
                const deleteButtons = alertsContainer.querySelectorAll('.delete-alert');
                deleteButtons.forEach(button => {
                    button.addEventListener('click', this.handleDeleteAlert.bind(this));
                });
            } else {
                // No hay alertas, mostrar CTA para crear
                alertsContainer.innerHTML = `
                    

                        

                            
Alertas de Precio

                        

                        

                            

                                
                                
No tienes alertas configuradas para ${this.state.coinData.name}


                                
                                     Crear Primera Alerta
                                
                            

                        

                    

                `;
                
                // Añadir event listener
                const createButton = alertsContainer.querySelector('#create-first-alert-btn');
                if (createButton) {
                    createButton.addEventListener('click', this.handleAlertAction.bind(this));
                }
            }
        } catch (error) {
            console.error('Error al actualizar sección de alertas:', error);
        }
    }
    
    /* === Manejadores de eventos === */
    
    /**
     * Maneja el cambio de timeframe
     * @param {Event} event - Evento del DOM
     */
    async handleTimeframeChange(event) {
        try {
            const button = event.currentTarget;
            const timeframe = button.getAttribute('data-timeframe');
            
            if (!timeframe || timeframe === this.state.currentTimeframe) return;
            
            // Actualizar UI
            this.activateTimeframe(timeframe);
            
            // Cargar nuevos datos
            await this.loadPriceHistory();
            
            // Guardar preferencia si está logueado
            if (this.state.userPreferences) {
                const coinPrefs = StorageManager.get('user.preferences.coinDetail') || {};
                coinPrefs.defaultTimeframe = timeframe;
                StorageManager.set('user.preferences.coinDetail', coinPrefs);
            }
        } catch (error) {
            console.error('Error al cambiar timeframe:', error);
            this.showErrorMessage('No se pudo cargar el historial de precios');
        }
    }
    
    /**
     * Maneja el cambio de tipo de gráfico
     * @param {Event} event - Evento del DOM
     */
    handleChartTypeChange(event) {
        try {
            const button = event.currentTarget;
            const chartType = button.getAttribute('data-chart-type');
            
            if (!chartType || chartType === this.state.chartType) return;
            
            // Actualizar UI
            this.activateChartType(chartType);
            
            // Guardar preferencia si está logueado
            if (this.state.userPreferences) {
                const coinPrefs = StorageManager.get('user.preferences.coinDetail') || {};
                coinPrefs.defaultChartType = chartType;
                StorageManager.set('user.preferences.coinDetail', coinPrefs);
            }
        } catch (error) {
            console.error('Error al cambiar tipo de gráfico:', error);
        }
    }
    
    /**
     * Maneja el cambio de pestaña
     * @param {Event} event - Evento del DOM
     */
    handleTabChange(event) {
        try {
            event.preventDefault();
            
            const tab = event.currentTarget;
            const tabId = tab.getAttribute('data-tab') || tab.getAttribute('href').replace('#', '').replace('-tab', '');
            
            if (!tabId || tabId === this.state.activeTab) return;
            
            // Activar nueva pestaña
            this.activateTab(tabId);
            
            // Cargar datos específicos según la pestaña si es necesario
            switch (tabId) {
                case 'markets':
                    this.loadMarketData();
                    break;
                case 'onchain':
                    this.loadOnChainData();
                    break;
                case 'news':
                    this.loadRelatedNews();
                    break;
                case 'social':
                    this.loadSocialData();
                    break;
            }
        } catch (error) {
            console.error('Error al cambiar pestaña:', error);
        }
    }
    
    /**
     * Maneja el toggle de indicadores técnicos
     * @param {Event} event - Evento del DOM
     */
    handleIndicatorToggle(event) {
        try {
            const checkbox = event.currentTarget;
            const indicatorId = checkbox.getAttribute('data-indicator');
            
            if (!indicatorId) return;
            
            if (checkbox.checked) {
                // Añadir indicador si no está ya en la lista
                if (!this.state.activeIndicators.includes(indicatorId)) {
                    this.state.activeIndicators.push(indicatorId);
                }
                
                // Buscar configuración del indicador
                const indicatorConfig = this.options.technicalIndicators.find(i => i.id === indicatorId);
                
                if (indicatorConfig && this.state.chartInstance) {
                    // Añadir indicador al gráfico
                    this.state.chartInstance.addIndicator(indicatorId, indicatorConfig.params);
                }
            } else {
                // Quitar indicador de la lista
                this.state.activeIndicators = this.state.activeIndicators.filter(id => id !== indicatorId);
                
                // Quitar indicador del gráfico
                if (this.state.chartInstance) {
                    this.state.chartInstance.removeIndicator(indicatorId);
                }
            }
            
            // Guardar preferencias
            if (this.state.userPreferences) {
                const coinPrefs = StorageManager.get('user.preferences.coinDetail') || {};
                coinPrefs.activeIndicators = [...this.state.activeIndicators];
                StorageManager.set('user.preferences.coinDetail', coinPrefs);
            }
        } catch (error) {
            console.error('Error al toggle indicador:', error);
        }
    }
    
    /**
     * Maneja la acción de compra
     * @param {Event} event - Evento del DOM
     */
    handleBuyAction(event) {
        try {
            // Implementación específica según la lógica de la aplicación
            
            // Ejemplo: abrir modal de compra
            this.openTransactionModal('buy');
        } catch (error) {
            console.error('Error al manejar acción de compra:', error);
        }
    }
    
    /**
     * Maneja la acción de venta
     * @param {Event} event - Evento del DOM
     */
    handleSellAction(event) {
        try {
            // Implementación específica según la lógica de la aplicación
            
            // Ejemplo: abrir modal de venta
            this.openTransactionModal('sell');
        } catch (error) {
            console.error('Error al manejar acción de venta:', error);
        }
    }
    
    /**
     * Maneja la acción de crear/editar alerta
     * @param {Event} event - Evento del DOM
     */
    handleAlertAction(event) {
        try {
            // Implementación específica según la lógica de la aplicación
            
            // Ejemplo: abrir modal de alerta
            this.openAlertModal();
        } catch (error) {
            console.error('Error al manejar acción de alerta:', error);
        }
    }
    
    /**
     * Maneja la acción de añadir/quitar de la lista de seguimiento
     * @param {Event} event - Evento del DOM
     */
    async handleWatchlistAction(event) {
        try {
            if (this.state.isInWatchlist) {
                // Quitar de la lista de seguimiento
                await this.marketDataService.removeFromWatchlist(this.state.coinId);
                this.state.isInWatchlist = false;
            } else {
                // Añadir a la lista de seguimiento
                await this.marketDataService.addToWatchlist(this.state.coinId);
                this.state.isInWatchlist = true;
            }
            
            // Actualizar UI
            this.updateWatchlistButton();
            
            // Notificar al usuario
            const message = this.state.isInWatchlist 
                ? `${this.state.coinData.name} añadido a favoritos`
                : `${this.state.coinData.name} eliminado de favoritos`;
                
            this.showToast(message);
            
            // Emitir evento para otros componentes
            EventBus.publish('user.watchlist.change', {
                coinId: this.state.coinId,
                action: this.state.isInWatchlist ? 'add' : 'remove'
            });
        } catch (error) {
            console.error('Error al manejar acción de watchlist:', error);
            this.showErrorMessage('No se pudo actualizar la lista de favoritos');
        }
    }
    
    /**
     * Maneja la actualización de precio global
     * @param {Object} data - Datos del evento
     */
    handlePriceUpdate(data) {
        try {
            // Verificar si la actualización es para esta moneda
            if (data.coinId === this.state.coinId && data.price) {
                // Actualizar datos
                if (this.state.coinData) {
                    const oldPrice = this.state.coinData.current_price;
                    this.state.coinData.current_price = data.price;
                    
                    // Calcular cambio desde la última actualización
                    if (oldPrice) {
                        const changePercent = ((data.price - oldPrice) / oldPrice) * 100;
                        this.state.lastUpdate = {
                            price: data.price,
                            change: changePercent,
                            timestamp: new Date()
                        };
                    }
                    
                    // Actualizar UI
                    this.updateBasicInfo();
                    
                    // Añadir punto al gráfico si es un timeframe corto
                    if (['1d', '1w'].includes(this.state.currentTimeframe)) {
                        this.addLatestPricePoint({current_price: data.price});
                    }
                }
            }
        } catch (error) {
            console.error('Error al manejar actualización de precio:', error);
        }
    }
    
    /**
     * Maneja el redimensionamiento de la ventana
     */
    handleResize() {
        try {
            // Ajustar gráfico al nuevo tamaño si existe
            if (this.state.chartInstance) {
                this.state.chartInstance.resize();
            }
        } catch (error) {
            console.error('Error al manejar redimensionamiento:', error);
        }
    }
    
    /* === Métodos auxiliares === */
    
    /**
     * Muestra/oculta indicador de carga
     * @param {boolean} show - Si se debe mostrar el indicador
     */
    showLoading(show) {
        const loadingIndicator = document.querySelector('#loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = show ? 'flex' : 'none';
        }
    }
    
    /**
     * Muestra un mensaje de error
     * @param {string} message - Mensaje de error
     */
    showErrorMessage(message) {
        // Implementación específica según el diseño de la UI
        console.error(message);
        
        // Ejemplo: mostrar toast o alert
        this.showToast(message, 'error');
    }
    
    /**
     * Muestra un mensaje toast
     * @param {string} message - Mensaje a mostrar
     * @param {string} type - Tipo de mensaje (success, error, info)
     */
    showToast(message, type = 'info') {
        // Implementación específica según el diseño de la UI
        
        // Ejemplo simple:
        const toastContainer = document.querySelector('.toast-container') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            

                
                ${message}
            

            
                
            
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto-eliminar después de 5 segundos
        setTimeout(() => {
            toast.classList.add('toast-fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 5000);
        
        // Event listener para cerrar manualmente
        const closeButton = toast.querySelector('.toast-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                toast.classList.add('toast-fade-out');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            });
        }
    }
    
    /**
     * Crea el contenedor para toasts si no existe
     * @returns {HTMLElement} Contenedor de toasts
     */
    createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }
    
    /**
     * Formatea un número como moneda
     * @param {number} value - Valor a formatear
     * @returns {string} Valor formateado
     */
    formatCurrency(value) {
        if (value === null || value === undefined) return '-';
        
        const currency = this.state.userPreferences?.currency || 'USD';
        
        return new Intl.NumberFormat('es-ES', {
            style: 'currency',
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 6
        }).format(value);
    }
    
    /**
     * Formatea un número con separadores de miles
     * @param {number} value - Valor a formatear
     * @returns {string} Valor formateado
     */
    formatNumber(value) {
        if (value === null || value === undefined) return '-';
        
        return new Intl.NumberFormat('es-ES', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 8
        }).format(value);
    }
    
    /**
     * Formatea un timestamp a tiempo relativo (ej: "hace 2 horas")
     * @param {number|string|Date} timestamp - Timestamp a formatear
     * @returns {string} Tiempo relativo
     */
    formatTimeAgo(timestamp) {
        if (!timestamp) return '';
        
        const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        
        if (diffSec < 60) return 'Hace menos de un minuto';
        
        const diffMin = Math.floor(diffSec / 60);
        if (diffMin < 60) return `Hace ${diffMin} ${diffMin === 1 ? 'minuto' : 'minutos'}`;
        
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `Hace ${diffHour} ${diffHour === 1 ? 'hora' : 'horas'}`;
        
        const diffDay = Math.floor(diffHour / 24);
        if (diffDay < 30) return `Hace ${diffDay} ${diffDay === 1 ? 'día' : 'días'}`;
        
        const diffMonth = Math.floor(diffDay / 30);
        if (diffMonth < 12) return `Hace ${diffMonth} ${diffMonth === 1 ? 'mes' : 'meses'}`;
        
        const diffYear = Math.floor(diffDay / 365);
        return `Hace ${diffYear} ${diffYear === 1 ? 'año' : 'años'}`;
    }
    
    /**
     * Obtiene el icono para un tipo de alerta
     * @param {string} alertType - Tipo de alerta
     * @returns {string} Clase del icono
     */
    getAlertTypeIcon(alertType) {
        const icons = {
            'price_above': 'icon-trending-up',
            'price_below': 'icon-trending-down',
            'percent_change': 'icon-percent',
            'volume_spike': 'icon-bar-chart-2'
        };
        
        return icons[alertType] || 'icon-bell';
    }
    
    /**
     * Obtiene la etiqueta para un tipo de alerta
     * @param {string} alertType - Tipo de alerta
     * @returns {string} Etiqueta descriptiva
     */
    getAlertTypeLabel(alertType) {
        const labels = {
            'price_above': 'Precio por encima de',
            'price_below': 'Precio por debajo de',
            'percent_change': 'Cambio porcentual',
            'volume_spike': 'Pico de volumen'
        };
        
        return labels[alertType] || 'Alerta';
    }
    
    /**
     * Formatea el valor de una alerta para mostrar
     * @param {Object} alert - Objeto de alerta
     * @returns {string} Valor formateado
     */
    formatAlertValue(alert) {
        if (!alert) return '';
        
        if (alert.type === 'price_above' || alert.type === 'price_below') {
            return this.formatCurrency(alert.targetValue);
        } else if (alert.type === 'percent_change') {
            return `${alert.targetValue >= 0 ? '+' : ''}${alert.targetValue}%`;
        } else if (alert.type === 'volume_spike') {
            return `${alert.targetValue}x promedio`;
        }
        
        return alert.targetValue?.toString() || '';
    }
    
    /**
     * Registra la vista de la página para analytics
     */
    trackPageView() {
        // Implementación específica según el sistema de analytics usado
        
        // Ejemplo:
        if (window.gtag) {
            gtag('event', 'page_view', {
                page_title: `${this.state.coinData.name} (${this.state.coinData.symbol.toUpperCase()})`,
                page_path: `/crypto/${this.state.coinId}`
            });
        }
    }
    
    /**
     * Limpieza al destruir el controlador
     */
    dispose() {
        try {
            console.log('Limpiando CoinController...');
            
            // Limpiar intervalo de actualización
            if (this.state.updateInterval) {
                clearInterval(this.state.updateInterval);
            }
            
            // Destruir gráfico si existe
            if (this.state.chartInstance) {
                this.state.chartInstance.destroy();
            }
            
            // Cancelar suscripciones a eventos
            EventBus.unsubscribeAll(this);
            
            // Eliminar event listeners
            // (Esto podría requerir guardar referencias a los handlers o usar removeEventListener directo)
            
            console.log('CoinController limpiado correctamente');
        } catch (error) {
            console.error('Error al limpiar CoinController:', error);
        }
    }
}

/**
 * Clase placeholder para el gráfico de precios
 * Esta sería sustituida por la implementación real con la biblioteca elegida
 */
class PriceChart {
    constructor(element, options) {
        this.element = element;
        this.options = options;
        this.init();
    }
    
    init() {
        console.log('Inicializando gráfico con opciones:', this.options);
        
        // Aquí iría la inicialización real con la biblioteca elegida
        
        // Simulación de carga completada
        if (typeof this.options.onChartReady === 'function') {
            setTimeout(() => {
                this.options.onChartReady();
            }, 100);
        }
    }
    
    updateData(data) {
        console.log('Actualizando datos del gráfico:', data);
        // Implementación real con la biblioteca elegida
    }
    
    addDataPoint(point) {
        console.log('Añadiendo punto de datos:', point);
        // Implementación real con la biblioteca elegida
    }
    
    setChartType(type) {
        console.log('Cambiando tipo de gráfico a:', type);
        // Implementación real con la biblioteca elegida
    }
    
    addIndicator(id, params) {
        console.log('Añadiendo indicador:', id, params);
        // Implementación real con la biblioteca elegida
    }
    
    removeIndicator(id) {
        console.log('Eliminando indicador:', id);
        // Implementación real con la biblioteca elegida
    }
    
    addEvents(events) {
        console.log('Añadiendo eventos al gráfico:', events);
        // Implementación real con la biblioteca elegida
    }
    
    resize() {
        console.log('Redimensionando gráfico');
        // Implementación real con la biblioteca elegida
    }
    
    destroy() {
        console.log('Destruyendo gráfico');
        // Implementación real con la biblioteca elegida
    }
}

// Exportar el controlador
export default CoinController;