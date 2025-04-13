/**
 * chart-controller.js
 * Controlador centralizado para la gestión de gráficos interactivos en el portal de criptomonedas.
 * Este módulo proporciona una capa de abstracción sobre diferentes bibliotecas de gráficos
 * y ofrece funcionalidades avanzadas para análisis técnico y visualización de datos.
 * 
 * @module ChartController
 * @author Coxotropic
 * @version 1.0.0
 */

import { EventBus } from '../utils/event-bus.js';
import { StorageManager } from '../utils/storage-manager.js';
import { MarketDataService } from '../market/market-data-service.js';

/**
 * Clase principal para la gestión de gráficos en la aplicación
 */
export class ChartController {
    /**
     * Constructor del controlador de gráficos
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        // Opciones por defecto
        this.options = {
            // Biblioteca de gráficos a utilizar ('chartjs', 'tradingview', 'highcharts')
            library: 'tradingview',
            // Tema por defecto ('light', 'dark')
            theme: 'dark',
            // Almacenar configuración de usuario
            storeUserSettings: true,
            // Actualización automática de datos
            autoUpdate: true,
            // Intervalo de actualización (ms)
            updateInterval: 30000,
            // Compresión de datos
            dataCompression: true,
            // Idioma
            language: 'es',
            // Opciones avanzadas específicas para cada biblioteca
            libraryOptions: {},
            ...options
        };

        // Estado interno
        this.state = {
            charts: new Map(), // Mapa de instancias de gráficos activos
            activeIndicators: new Map(), // Indicadores activos por gráfico
            drawingTools: new Map(), // Herramientas de dibujo por gráfico
            timeframes: {
                '1m': 60, // 1 minuto (segundos)
                '5m': 300,
                '15m': 900,
                '30m': 1800,
                '1h': 3600,
                '4h': 14400,
                '1d': 86400,
                '1w': 604800,
                '1M': 2592000 // 1 mes (aprox.)
            },
            currentTheme: this.options.theme,
            initialized: false,
            chartsData: {}, // Datos actuales de los gráficos
            selectedTimeframe: '1d', // Timeframe por defecto
            dataProviderStatus: 'disconnected'
        };

        // Servicio de datos de mercado
        this.marketDataService = new MarketDataService();
        
        // Inicialización
        this._init();
    }

    /**
     * Inicializa el controlador de gráficos
     * @private
     */
    _init() {
        // Cargar configuración guardada del usuario
        this._loadUserSettings();
        
        // Inicializar biblioteca de gráficos
        this._initializeChartLibrary();
        
        // Suscribirse a eventos relevantes
        this._setupEventListeners();
        
        // Establecer como inicializado
        this.state.initialized = true;
        
        // Emitir evento de inicialización completada
        EventBus.publish('charts.initialized', { controller: this });
    }

    /**
     * Carga las preferencias guardadas del usuario
     * @private
     */
    _loadUserSettings() {
        if (!this.options.storeUserSettings) return;
        
        try {
            const savedSettings = StorageManager.get('user.chartSettings');
            if (savedSettings) {
                if (savedSettings.theme) {
                    this.state.currentTheme = savedSettings.theme;
                    this.options.theme = savedSettings.theme;
                }
                
                if (savedSettings.selectedTimeframe) {
                    this.state.selectedTimeframe = savedSettings.selectedTimeframe;
                }
                
                // Otras configuraciones guardadas
                console.log('Configuración de gráficos cargada:', savedSettings);
            }
        } catch (error) {
            console.warn('Error al cargar configuración de gráficos:', error);
        }
    }

    /**
     * Guarda las preferencias del usuario
     * @private
     */
    _saveUserSettings() {
        if (!this.options.storeUserSettings) return;
        
        try {
            const settingsToSave = {
                theme: this.state.currentTheme,
                selectedTimeframe: this.state.selectedTimeframe,
                // Otras configuraciones a guardar
            };
            
            StorageManager.set('user.chartSettings', settingsToSave);
        } catch (error) {
            console.warn('Error al guardar configuración de gráficos:', error);
        }
    }

    /**
     * Inicializa la biblioteca de gráficos seleccionada
     * @private
     */
    _initializeChartLibrary() {
        switch (this.options.library) {
            case 'tradingview':
                this._initTradingViewLibrary();
                break;
            case 'chartjs':
                this._initChartJsLibrary();
                break;
            case 'highcharts':
                this._initHighchartsLibrary();
                break;
            default:
                throw new Error(`Biblioteca de gráficos '${this.options.library}' no soportada`);
        }
    }

    /**
     * Inicializa TradingView como biblioteca de gráficos
     * @private
     */
    _initTradingViewLibrary() {
        // Verificar si ya está cargada
        if (window.TradingView) {
            console.log('TradingView ya está cargado');
            return;
        }
        
        // Cargar librería TradingView desde CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/lightweight-charts/dist/lightweight-charts.standalone.production.js';
        script.async = true;
        script.onload = () => {
            console.log('Biblioteca TradingView cargada correctamente');
            EventBus.publish('charts.library.loaded', { library: 'tradingview' });
        };
        script.onerror = (error) => {
            console.error('Error al cargar biblioteca TradingView:', error);
            // Intentar con biblioteca de respaldo
            this.options.library = 'chartjs';
            this._initializeChartLibrary();
        };
        
        document.head.appendChild(script);
    }

    /**
     * Inicializa Chart.js como biblioteca de gráficos
     * @private
     */
    _initChartJsLibrary() {
        // Verificar si ya está cargada
        if (window.Chart) {
            console.log('Chart.js ya está cargado');
            return;
        }
        
        // Cargar librería Chart.js desde CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/chart.js@3.9.1/dist/chart.min.js';
        script.async = true;
        script.onload = () => {
            console.log('Biblioteca Chart.js cargada correctamente');
            
            // Cargar plugin de anotaciones
            const annotationPlugin = document.createElement('script');
            annotationPlugin.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@1.4.0/dist/chartjs-plugin-annotation.min.js';
            annotationPlugin.async = true;
            document.head.appendChild(annotationPlugin);
            
            EventBus.publish('charts.library.loaded', { library: 'chartjs' });
        };
        script.onerror = (error) => {
            console.error('Error al cargar biblioteca Chart.js:', error);
            // Intentar con biblioteca de respaldo
            this.options.library = 'highcharts';
            this._initializeChartLibrary();
        };
        
        document.head.appendChild(script);
    }

    /**
     * Inicializa Highcharts como biblioteca de gráficos
     * @private
     */
    _initHighchartsLibrary() {
        // Verificar si ya está cargada
        if (window.Highcharts) {
            console.log('Highcharts ya está cargado');
            return;
        }
        
        // Cargar librería Highcharts desde CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/highcharts@10.3.3/highcharts.js';
        script.async = true;
        script.onload = () => {
            console.log('Biblioteca Highcharts cargada correctamente');
            
            // Cargar módulos adicionales
            const stockModule = document.createElement('script');
            stockModule.src = 'https://cdn.jsdelivr.net/npm/highcharts@10.3.3/modules/stock.js';
            stockModule.async = true;
            document.head.appendChild(stockModule);
            
            const indicatorsModule = document.createElement('script');
            indicatorsModule.src = 'https://cdn.jsdelivr.net/npm/highcharts@10.3.3/modules/indicators.js';
            indicatorsModule.async = true;
            document.head.appendChild(indicatorsModule);
            
            EventBus.publish('charts.library.loaded', { library: 'highcharts' });
        };
        script.onerror = (error) => {
            console.error('Error al cargar biblioteca Highcharts:', error);
            console.warn('No se pudo cargar ninguna biblioteca de gráficos');
        };
        
        document.head.appendChild(script);
    }

    /**
     * Configura los escuchadores de eventos
     * @private
     */
    _setupEventListeners() {
        // Escuchar actualizaciones de datos de mercado
        EventBus.subscribe('market.dataUpdated', (data) => {
            this._handleMarketDataUpdate(data);
        });
        
        // Escuchar cambios de tema
        EventBus.subscribe('app.themeChanged', (data) => {
            this.setTheme(data.theme);
        });
        
        // Escuchar cambios en el dispositivo
        EventBus.subscribe('device.changed', (data) => {
            this._handleDeviceChange(data);
        });
    }

    /**
     * Maneja actualizaciones de datos de mercado
     * @param {Object} data - Datos actualizados
     * @private
     */
    _handleMarketDataUpdate(data) {
        if (!this.options.autoUpdate) return;
        
        // Actualizar datos en cada gráfico activo
        this.state.charts.forEach((chart, chartId) => {
            const symbol = chart.config.symbol;
            if (data.symbols && data.symbols[symbol]) {
                this.updateChartData(chartId, data.symbols[symbol]);
            }
        });
    }

    /**
     * Maneja cambios en el dispositivo (tamaño de pantalla, orientación)
     * @param {Object} deviceData - Información del dispositivo
     * @private
     */
    _handleDeviceChange(deviceData) {
        // Adaptar gráficos a nuevo tamaño/orientación
        this.state.charts.forEach((chart, chartId) => {
            this.resizeChart(chartId);
        });
    }

    /**
     * Crea un nuevo gráfico
     * @param {string} containerId - ID del elemento contenedor
     * @param {Object} config - Configuración del gráfico
     * @returns {string} ID del gráfico creado
     */
    createChart(containerId, config = {}) {
        if (!this.state.initialized) {
            throw new Error('ChartController no inicializado correctamente');
        }
        
        // Obtener elemento contenedor
        const container = document.getElementById(containerId);
        if (!container) {
            throw new Error(`Contenedor con ID "${containerId}" no encontrado`);
        }
        
        // Configuración por defecto
        const defaultConfig = {
            symbol: 'BTC/USD',
            type: 'candlestick', // 'candlestick', 'line', 'area', 'bar'
            timeframe: this.state.selectedTimeframe,
            autoResize: true,
            theme: this.state.currentTheme,
            indicators: [],
            comparison: [],
            annotations: [],
            fromDate: this._getDefaultFromDate(),
            toDate: new Date(),
            toolbar: true,
            // Más opciones de configuración...
        };
        
        // Combinar configuración
        const chartConfig = { ...defaultConfig, ...config };
        
        // Generar ID único para el gráfico
        const chartId = `chart_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        // Crear gráfico según biblioteca seleccionada
        let chartInstance;
        
        switch (this.options.library) {
            case 'tradingview':
                chartInstance = this._createTradingViewChart(container, chartConfig);
                break;
            case 'chartjs':
                chartInstance = this._createChartJsChart(container, chartConfig);
                break;
            case 'highcharts':
                chartInstance = this._createHighchartsChart(container, chartConfig);
                break;
            default:
                throw new Error(`Biblioteca de gráficos '${this.options.library}' no soportada`);
        }
        
        // Almacenar instancia en el mapa
        this.state.charts.set(chartId, {
            instance: chartInstance,
            config: chartConfig,
            container,
            indicators: new Map(),
            drawings: new Map()
        });
        
        // Cargar datos iniciales
        this._loadChartData(chartId, chartConfig.symbol, chartConfig.timeframe, chartConfig.fromDate, chartConfig.toDate);
        
        // Agregar indicadores iniciales
        if (chartConfig.indicators && chartConfig.indicators.length > 0) {
            chartConfig.indicators.forEach(indicator => {
                this.addIndicator(chartId, indicator.type, indicator.options);
            });
        }
        
        // Configurar comparaciones
        if (chartConfig.comparison && chartConfig.comparison.length > 0) {
            chartConfig.comparison.forEach(symbol => {
                this.addComparisonSymbol(chartId, symbol);
            });
        }
        
        // Emitir evento de creación
        EventBus.publish('charts.created', { chartId, config: chartConfig });
        
        return chartId;
    }

    /**
     * Obtiene la fecha predeterminada para el inicio del rango del gráfico
     * @returns {Date} Fecha de inicio predeterminada
     * @private
     */
    _getDefaultFromDate() {
        const now = new Date();
        const timeframeDays = {
            '1m': 1,
            '5m': 1,
            '15m': 1,
            '30m': 2,
            '1h': 7,
            '4h': 14,
            '1d': 90,
            '1w': 365,
            '1M': 1095 // 3 años aprox.
        };
        
        const days = timeframeDays[this.state.selectedTimeframe] || 90;
        return new Date(now.setDate(now.getDate() - days));
    }

    /**
     * Crea un gráfico utilizando TradingView
     * @param {HTMLElement} container - Elemento contenedor
     * @param {Object} config - Configuración del gráfico
     * @returns {Object} Instancia del gráfico
     * @private
     */
    _createTradingViewChart(container, config) {
        // Verificar que la biblioteca esté cargada
        if (!window.LightweightCharts) {
            throw new Error('Biblioteca TradingView (LightweightCharts) no cargada');
        }
        
        // Configurar opciones según tema
        const chartOptions = {
            width: container.clientWidth,
            height: container.clientHeight || 400,
            layout: {
                background: { color: config.theme === 'dark' ? '#1E222D' : '#FFFFFF' },
                textColor: config.theme === 'dark' ? '#D9D9D9' : '#191919',
            },
            grid: {
                vertLines: { color: config.theme === 'dark' ? '#2B2B43' : '#E6E6E6' },
                horzLines: { color: config.theme === 'dark' ? '#2B2B43' : '#E6E6E6' },
            },
            crosshair: {
                mode: 0, // 0 - normal, 1 - magnet
            },
            priceScale: {
                borderColor: config.theme === 'dark' ? '#2B2B43' : '#E6E6E6',
            },
            timeScale: {
                borderColor: config.theme === 'dark' ? '#2B2B43' : '#E6E6E6',
                timeVisible: true,
            },
            ...this.options.libraryOptions.tradingview
        };
        
        // Crear instancia de gráfico
        const chart = window.LightweightCharts.createChart(container, chartOptions);
        
        // Preparar para resize automático si es necesario
        if (config.autoResize) {
            window.addEventListener('resize', () => {
                chart.applyOptions({
                    width: container.clientWidth,
                    height: container.clientHeight || 400
                });
            });
        }
        
        return chart;
    }

    /**
     * Crea un gráfico utilizando Chart.js
     * @param {HTMLElement} container - Elemento contenedor
     * @param {Object} config - Configuración del gráfico
     * @returns {Object} Instancia del gráfico
     * @private
     */
    _createChartJsChart(container, config) {
        // Verificar que la biblioteca esté cargada
        if (!window.Chart) {
            throw new Error('Biblioteca Chart.js no cargada');
        }
        
        // Crear canvas para el gráfico
        const canvas = document.createElement('canvas');
        container.appendChild(canvas);
        
        // Configurar opciones según tema y tipo
        const chartOptions = {
            type: this._mapChartType(config.type, 'chartjs'),
            data: {
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: config.theme === 'dark' ? '#D9D9D9' : '#191919'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                },
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: this._getTimeUnitForChartJs(config.timeframe)
                        },
                        grid: {
                            color: config.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: config.theme === 'dark' ? '#D9D9D9' : '#191919'
                        }
                    },
                    y: {
                        grid: {
                            color: config.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: config.theme === 'dark' ? '#D9D9D9' : '#191919'
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        };
        
        // Crear instancia de gráfico
        const chart = new Chart(canvas, chartOptions);
        
        return chart;
    }

    /**
     * Mapea tipos de gráficos entre diferentes bibliotecas
     * @param {string} type - Tipo de gráfico en formato interno
     * @param {string} library - Biblioteca de destino
     * @returns {string} Tipo de gráfico para la biblioteca especificada
     * @private
     */
    _mapChartType(type, library) {
        const mappings = {
            'chartjs': {
                'candlestick': 'bar', // Chart.js no tiene candlestick nativo
                'line': 'line',
                'area': 'line', // Con fill: true
                'bar': 'bar'
            },
            'tradingview': {
                'candlestick': 'candlestick',
                'line': 'line',
                'area': 'area',
                'bar': 'bar'
            },
            'highcharts': {
                'candlestick': 'candlestick',
                'line': 'line',
                'area': 'area',
                'bar': 'column'
            }
        };
        
        return mappings[library][type] || type;
    }

    /**
     * Obtiene la unidad de tiempo apropiada para Chart.js según el timeframe
     * @param {string} timeframe - Timeframe seleccionado
     * @returns {string} Unidad de tiempo para Chart.js
     * @private
     */
    _getTimeUnitForChartJs(timeframe) {
        const mappings = {
            '1m': 'minute',
            '5m': 'minute',
            '15m': 'minute',
            '30m': 'minute',
            '1h': 'hour',
            '4h': 'hour',
            '1d': 'day',
            '1w': 'week',
            '1M': 'month'
        };
        
        return mappings[timeframe] || 'day';
    }

    /**
     * Crea un gráfico utilizando Highcharts
     * @param {HTMLElement} container - Elemento contenedor
     * @param {Object} config - Configuración del gráfico
     * @returns {Object} Instancia del gráfico
     * @private
     */
    _createHighchartsChart(container, config) {
        // Verificar que la biblioteca esté cargada
        if (!window.Highcharts) {
            throw new Error('Biblioteca Highcharts no cargada');
        }
        
        // Configurar opciones según tema y tipo
        const chartOptions = {
            chart: {
                type: this._mapChartType(config.type, 'highcharts'),
                backgroundColor: config.theme === 'dark' ? '#1E222D' : '#FFFFFF',
                style: {
                    fontFamily: "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
                }
            },
            title: {
                text: config.title || config.symbol,
                style: {
                    color: config.theme === 'dark' ? '#D9D9D9' : '#191919'
                }
            },
            time: {
                useUTC: false
            },
            rangeSelector: {
                enabled: config.toolbar,
                buttons: [
                    { type: 'day', count: 1, text: '1D' },
                    { type: 'week', count: 1, text: '1W' },
                    { type: 'month', count: 1, text: '1M' },
                    { type: 'month', count: 3, text: '3M' },
                    { type: 'year', count: 1, text: '1Y' },
                    { type: 'all', text: 'Todo' }
                ],
                selected: 2,
                inputEnabled: true
            },
            xAxis: {
                type: 'datetime',
                labels: {
                    style: {
                        color: config.theme === 'dark' ? '#D9D9D9' : '#191919'
                    }
                },
                gridLineColor: config.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            },
            yAxis: {
                labels: {
                    style: {
                        color: config.theme === 'dark' ? '#D9D9D9' : '#191919'
                    }
                },
                gridLineColor: config.theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            },
            plotOptions: {
                series: {
                    showInLegend: true
                }
            },
            legend: {
                enabled: true,
                itemStyle: {
                    color: config.theme === 'dark' ? '#D9D9D9' : '#191919'
                }
            },
            tooltip: {
                split: false,
                shared: true
            },
            series: [],
            responsive: {
                rules: [{
                    condition: {
                        maxWidth: 500
                    },
                    chartOptions: {
                        legend: {
                            layout: 'horizontal',
                            align: 'center',
                            verticalAlign: 'bottom'
                        }
                    }
                }]
            },
            credits: {
                enabled: false
            },
            ...this.options.libraryOptions.highcharts
        };
        
        // Crear instancia de gráfico
        const chart = Highcharts.stockChart(container, chartOptions);
        
        return chart;
    }

    /**
     * Carga datos para un gráfico
     * @param {string} chartId - ID del gráfico
     * @param {string} symbol - Símbolo a cargar
     * @param {string} timeframe - Timeframe
     * @param {Date} fromDate - Fecha de inicio
     * @param {Date} toDate - Fecha de fin
     * @private
     */
    async _loadChartData(chartId, symbol, timeframe, fromDate, toDate) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return;
        }
        
        try {
            // Mostrar indicador de carga
            this._showChartLoading(chartId, true);
            
            // Obtener datos históricos
            const historicalData = await this.marketDataService.getHistoricalData(
                symbol,
                timeframe,
                fromDate.getTime(),
                toDate.getTime()
            );
            
            // Procesar y comprimir datos si es necesario
            const processedData = this.options.dataCompression 
                ? this._compressChartData(historicalData, timeframe) 
                : historicalData;
            
            // Guardar datos procesados
            this.state.chartsData[chartId] = {
                symbol,
                timeframe,
                data: processedData,
                lastUpdated: new Date()
            };
            
            // Representar datos en el gráfico
            this._renderChartData(chartId, processedData);
            
            // Ocultar indicador de carga
            this._showChartLoading(chartId, false);
            
            // Emitir evento de datos cargados
            EventBus.publish('charts.dataLoaded', { 
                chartId, 
                symbol,
                timeframe,
                dataPoints: processedData.length
            });
            
        } catch (error) {
            console.error(`Error al cargar datos para el gráfico ${chartId}:`, error);
            
            // Ocultar indicador de carga
            this._showChartLoading(chartId, false);
            
            // Mostrar mensaje de error en el gráfico
            this._showChartError(chartId, 'Error al cargar datos. Intente nuevamente.');
            
            // Emitir evento de error
            EventBus.publish('charts.error', { 
                chartId, 
                symbol,
                timeframe,
                error: error.message 
            });
        }
    }

    /**
     * Comprime datos del gráfico para optimizar rendimiento
     * @param {Array} data - Datos originales
     * @param {string} timeframe - Timeframe actual
     * @returns {Array} Datos comprimidos
     * @private
     */
    _compressChartData(data, timeframe) {
        // Si hay pocos datos, no comprimir
        if (data.length < 1000) return data;
        
        // Factor de compresión según timeframe
        const compressionFactors = {
            '1m': 4,  // Cada 4 puntos
            '5m': 3,  // Cada 3 puntos
            '15m': 2, // Cada 2 puntos
            '30m': 2,
            '1h': 1,  // Sin compresión para timeframes mayores
            '4h': 1,
            '1d': 1,
            '1w': 1,
            '1M': 1
        };
        
        const factor = compressionFactors[timeframe] || 1;
        if (factor === 1) return data; // No comprimir
        
        // Algoritmo simple: tomar 1 de cada N puntos
        // En una implementación real, se usaría un algoritmo más sofisticado
        // como LTTB (Largest-Triangle-Three-Buckets) para preservar características visuales
        
        const compressed = [];
        for (let i = 0; i < data.length; i += factor) {
            compressed.push(data[i]);
        }
        
        console.log(`Compresión de datos: ${data.length} -> ${compressed.length} puntos (factor ${factor})`);
        return compressed;
    }

    /**
     * Muestra/oculta indicador de carga en un gráfico
     * @param {string} chartId - ID del gráfico
     * @param {boolean} show - Mostrar u ocultar
     * @private
     */
    _showChartLoading(chartId, show) {
        const chart = this.state.charts.get(chartId);
        if (!chart) return;
        
        const container = chart.container;
        
        // Verificar si ya existe el indicador
        let loadingIndicator = container.querySelector('.chart-loading-indicator');
        
        if (show) {
            if (!loadingIndicator) {
                loadingIndicator = document.createElement('div');
                loadingIndicator.className = 'chart-loading-indicator';
                loadingIndicator.innerHTML = `
                    <div class="spinner"></div>
                    <div class="loading-text">Cargando datos...</div>
                `;
                
                // Estilar el indicador
                loadingIndicator.style.position = 'absolute';
                loadingIndicator.style.top = '0';
                loadingIndicator.style.left = '0';
                loadingIndicator.style.width = '100%';
                loadingIndicator.style.height = '100%';
                loadingIndicator.style.display = 'flex';
                loadingIndicator.style.flexDirection = 'column';
                loadingIndicator.style.alignItems = 'center';
                loadingIndicator.style.justifyContent = 'center';
                loadingIndicator.style.backgroundColor = 'rgba(0, 0, 0, 0.3)';
                loadingIndicator.style.color = '#ffffff';
                loadingIndicator.style.zIndex = '1000';
                loadingIndicator.style.backdropFilter = 'blur(2px)';
                
                // Estilar el spinner
                const spinner = loadingIndicator.querySelector('.spinner');
                spinner.style.border = '4px solid rgba(255, 255, 255, 0.3)';
                spinner.style.borderTop = '4px solid #ffffff';
                spinner.style.borderRadius = '50%';
                spinner.style.width = '30px';
                spinner.style.height = '30px';
                spinner.style.animation = 'spin 1s linear infinite';
                
                // Crear keyframes para la animación
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes spin {
                        0% { transform: rotate(0deg); }
                        100% { transform: rotate(360deg); }
                    }
                `;
                document.head.appendChild(style);
                
                // Asegurar posición relativa en el contenedor
                if (window.getComputedStyle(container).position === 'static') {
                    container.style.position = 'relative';
                }
                
                container.appendChild(loadingIndicator);
            }
        } else {
            if (loadingIndicator) {
                loadingIndicator.remove();
            }
        }
    }

    /**
     * Muestra un mensaje de error en el gráfico
     * @param {string} chartId - ID del gráfico
     * @param {string} message - Mensaje de error
     * @private
     */
    _showChartError(chartId, message) {
        const chart = this.state.charts.get(chartId);
        if (!chart) return;
        
        const container = chart.container;
        
        // Verificar si ya existe el mensaje de error
        let errorMessage = container.querySelector('.chart-error-message');
        
        if (!errorMessage) {
            errorMessage = document.createElement('div');
            errorMessage.className = 'chart-error-message';
            
            // Estilar el mensaje
            errorMessage.style.position = 'absolute';
            errorMessage.style.top = '0';
            errorMessage.style.left = '0';
            errorMessage.style.width = '100%';
            errorMessage.style.height = '100%';
            errorMessage.style.display = 'flex';
            errorMessage.style.flexDirection = 'column';
            errorMessage.style.alignItems = 'center';
            errorMessage.style.justifyContent = 'center';
            errorMessage.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
            errorMessage.style.color = '#ffffff';
            errorMessage.style.zIndex = '1000';
            errorMessage.style.padding = '20px';
            errorMessage.style.textAlign = 'center';
            
            // Asegurar posición relativa en el contenedor
            if (window.getComputedStyle(container).position === 'static') {
                container.style.position = 'relative';
            }
            
            container.appendChild(errorMessage);
        }
        
        // Actualizar mensaje de error
        errorMessage.innerHTML = `
            <div><i class="icon-alert-triangle" style="font-size: 48px; color: #e74c3c;"></i></div>
            <div style="margin-top: 15px; font-size: 16px;">${message}</div>
            <button class="btn btn-sm btn-outline" style="margin-top: 15px;" id="retry-chart-${chartId}">
                <i class="icon-refresh-cw"></i> Reintentar
            </button>
        `;
        
        // Añadir evento al botón de reintentar
        const retryButton = errorMessage.querySelector(`#retry-chart-${chartId}`);
        if (retryButton) {
            retryButton.addEventListener('click', (e) => {
                e.preventDefault();
                errorMessage.remove();
                const config = chart.config;
                this._loadChartData(chartId, config.symbol, config.timeframe, config.fromDate, config.toDate);
            });
        }
    }

    /**
     * Renderiza datos en un gráfico
     * @param {string} chartId - ID del gráfico
     * @param {Array} data - Datos a renderizar
     * @private
     */
    _renderChartData(chartId, data) {
        const chart = this.state.charts.get(chartId);
        if (!chart) return;
        
        const { instance, config } = chart;
        
        switch (this.options.library) {
            case 'tradingview':
                this._renderTradingViewData(instance, data, config);
                break;
            case 'chartjs':
                this._renderChartJsData(instance, data, config);
                break;
            case 'highcharts':
                this._renderHighchartsData(instance, data, config);
                break;
        }
    }

    /**
     * Renderiza datos en un gráfico TradingView
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {Array} data - Datos a renderizar
     * @param {Object} config - Configuración del gráfico
     * @private
     */
    _renderTradingViewData(chartInstance, data, config) {
        // Formatear datos para TradingView
        const formattedData = data.map(item => ({
            time: item.time,
            open: item.open,
            high: item.high,
            low: item.low,
            close: item.close
        }));
        
        // Crear serie según tipo de gráfico
        let series;
        
        if (config.type === 'candlestick') {
            series = chartInstance.addCandlestickSeries({
                upColor: '#26a69a',
                downColor: '#ef5350',
                borderVisible: false,
                wickUpColor: '#26a69a',
                wickDownColor: '#ef5350'
            });
        } else if (config.type === 'line') {
            series = chartInstance.addLineSeries({
                color: '#2962FF',
                lineWidth: 2
            });
        } else if (config.type === 'area') {
            series = chartInstance.addAreaSeries({
                topColor: 'rgba(41, 98, 255, 0.3)',
                bottomColor: 'rgba(41, 98, 255, 0.0)',
                lineColor: 'rgba(41, 98, 255, 1)',
                lineWidth: 2
            });
        } else if (config.type === 'bar') {
            series = chartInstance.addBarSeries({
                upColor: '#26a69a',
                downColor: '#ef5350'
            });
        }
        
        // Establecer datos
        if (series) {
            series.setData(formattedData);
        }
        
        // Guardar referencia a la serie principal
        chartInstance.mainSeries = series;
        
        // Ajustar a los datos
        chartInstance.timeScale().fitContent();
    }

    /**
     * Renderiza datos en un gráfico Chart.js
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {Array} data - Datos a renderizar
     * @param {Object} config - Configuración del gráfico
     * @private
     */
    _renderChartJsData(chartInstance, data, config) {
        // Limpiar datasets existentes
        chartInstance.data.datasets = [];
        
        if (config.type === 'candlestick') {
            // Chart.js no tiene candlestick nativo, simulamos con barras
            const openData = [];
            const highData = [];
            const lowData = [];
            const closeData = [];
            const labels = [];
            
            data.forEach(item => {
                const date = new Date(item.time * 1000);
                labels.push(date);
                openData.push(item.open);
                highData.push(item.high);
                lowData.push(item.low);
                closeData.push(item.close);
            });
            
            chartInstance.data.labels = labels;
            
            // Añadir líneas para OHLC
            chartInstance.data.datasets.push({
                label: 'Precio de cierre',
                data: closeData,
                borderColor: '#2962FF',
                backgroundColor: 'rgba(41, 98, 255, 0.1)',
                fill: false,
                tension: 0.1,
                borderWidth: 2
            });
            
        } else if (config.type === 'line' || config.type === 'area') {
            const prices = [];
            const labels = [];
            
            data.forEach(item => {
                const date = new Date(item.time * 1000);
                labels.push(date);
                prices.push(item.close);
            });
            
            chartInstance.data.labels = labels;
            
            chartInstance.data.datasets.push({
                label: config.symbol,
                data: prices,
                borderColor: '#2962FF',
                backgroundColor: config.type === 'area' ? 'rgba(41, 98, 255, 0.1)' : 'rgba(0, 0, 0, 0)',
                fill: config.type === 'area',
                tension: 0.1,
                borderWidth: 2
            });
            
        } else if (config.type === 'bar') {
            const volumes = [];
            const labels = [];
            const colors = [];
            
            data.forEach(item => {
                const date = new Date(item.time * 1000);
                labels.push(date);
                volumes.push(item.volume || 0);
                colors.push(item.close >= item.open ? 'rgba(38, 166, 154, 0.6)' : 'rgba(239, 83, 80, 0.6)');
            });
            
            chartInstance.data.labels = labels;
            
            chartInstance.data.datasets.push({
                label: 'Volumen',
                data: volumes,
                backgroundColor: colors,
                borderColor: colors.map(color => color.replace('0.6', '1')),
                borderWidth: 1
            });
        }
        
        // Actualizar el gráfico
        chartInstance.update();
    }

    /**
     * Renderiza datos en un gráfico Highcharts
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {Array} data - Datos a renderizar
     * @param {Object} config - Configuración del gráfico
     * @private
     */
    _renderHighchartsData(chartInstance, data, config) {
        // Formatear datos para Highcharts
        const ohlc = [];
        const volume = [];
        
        data.forEach(item => {
            const timestamp = item.time * 1000; // Convertir a milisegundos
            
            // Datos OHLC
            ohlc.push([
                timestamp,
                item.open,
                item.high,
                item.low,
                item.close
            ]);
            
            // Datos de volumen
            if (item.volume !== undefined) {
                volume.push([
                    timestamp,
                    item.volume
                ]);
            }
        });
        
        // Limpiar series existentes
        while (chartInstance.series.length > 0) {
            chartInstance.series[0].remove(false);
        }
        
        // Añadir serie principal según tipo de gráfico
        if (config.type === 'candlestick') {
            chartInstance.addSeries({
                type: 'candlestick',
                name: config.symbol,
                data: ohlc,
                color: '#ef5350',
                upColor: '#26a69a',
                lineColor: '#ef5350',
                upLineColor: '#26a69a',
                tooltip: {
                    valueDecimals: 2
                }
            }, false);
        } else if (config.type === 'line') {
            chartInstance.addSeries({
                type: 'line',
                name: config.symbol,
                data: ohlc.map(item => [item[0], item[4]]), // Usar precio de cierre
                color: '#2962FF',
                tooltip: {
                    valueDecimals: 2
                }
            }, false);
        } else if (config.type === 'area') {
            chartInstance.addSeries({
                type: 'area',
                name: config.symbol,
                data: ohlc.map(item => [item[0], item[4]]), // Usar precio de cierre
                color: '#2962FF',
                fillColor: {
                    linearGradient: {
                        x1: 0,
                        y1: 0,
                        x2: 0,
                        y2: 1
                    },
                    stops: [
                        [0, 'rgba(41, 98, 255, 0.3)'],
                        [1, 'rgba(41, 98, 255, 0.0)']
                    ]
                },
                tooltip: {
                    valueDecimals: 2
                }
            }, false);
        } else if (config.type === 'bar' || config.type === 'column') {
            chartInstance.addSeries({
                type: 'column',
                name: config.symbol,
                data: ohlc.map((item, index) => ({
                    x: item[0],
                    y: item[4], // Precio de cierre
                    color: item[4] >= item[1] ? '#26a69a' : '#ef5350' // Verde si close >= open, rojo en caso contrario
                })),
                tooltip: {
                    valueDecimals: 2
                }
            }, false);
        }
        
        // Añadir volumen si está disponible
        if (volume.length > 0) {
            chartInstance.addSeries({
                type: 'column',
                name: 'Volumen',
                data: volume,
                yAxis: 1,
                color: 'rgba(144, 144, 144, 0.5)'
            }, false);
        }
        
        // Actualizar el gráfico
        chartInstance.redraw();
    }

    /**
     * Actualiza los datos de un gráfico existente
     * @param {string} chartId - ID del gráfico
     * @param {Object} newData - Nuevos datos para actualizar
     */
    updateChartData(chartId, newData) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return;
        }
        
        const storedData = this.state.chartsData[chartId];
        if (!storedData) {
            console.warn(`No hay datos almacenados para el gráfico ${chartId}`);
            return;
        }
        
        // Actualizar último dato o añadir uno nuevo
        const lastData = storedData.data[storedData.data.length - 1];
        const newTimestamp = Math.floor(Date.now() / 1000);
        
        if (lastData && this._isInSameCandle(newTimestamp, lastData.time, storedData.timeframe)) {
            // Actualizar candle actual
            lastData.close = newData.price;
            lastData.high = Math.max(lastData.high, newData.price);
            lastData.low = Math.min(lastData.low, newData.price);
            lastData.volume = (lastData.volume || 0) + (newData.volume || 0);
        } else {
            // Añadir nuevo candle
            storedData.data.push({
                time: newTimestamp,
                open: newData.price,
                high: newData.price,
                low: newData.price,
                close: newData.price,
                volume: newData.volume || 0
            });
        }
        
        // Volver a renderizar datos
        this._renderChartData(chartId, storedData.data);
        
        // Actualizar timestamp
        storedData.lastUpdated = new Date();
    }

    /**
     * Verifica si un timestamp está en la misma vela que otro
     * @param {number} newTime - Nuevo timestamp
     * @param {number} existingTime - Timestamp existente
     * @param {string} timeframe - Timeframe actual
     * @returns {boolean} True si están en la misma vela
     * @private
     */
    _isInSameCandle(newTime, existingTime, timeframe) {
        const timeframeSecs = this.state.timeframes[timeframe];
        if (!timeframeSecs) return false;
        
        const newCandleStart = Math.floor(newTime / timeframeSecs) * timeframeSecs;
        const existingCandleStart = Math.floor(existingTime / timeframeSecs) * timeframeSecs;
        
        return newCandleStart === existingCandleStart;
    }

    /**
     * Cambia el timeframe de un gráfico
     * @param {string} chartId - ID del gráfico
     * @param {string} newTimeframe - Nuevo timeframe
     */
    changeTimeframe(chartId, newTimeframe) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return;
        }
        
        // Validar timeframe
        if (!this.state.timeframes[newTimeframe]) {
            console.error(`Timeframe "${newTimeframe}" no válido`);
            return;
        }
        
        // Actualizar configuración
        chart.config.timeframe = newTimeframe;
        
        // Cargar nuevos datos
        this._loadChartData(
            chartId,
            chart.config.symbol,
            newTimeframe,
            chart.config.fromDate,
            chart.config.toDate
        );
        
        // Actualizar timeframe seleccionado
        this.state.selectedTimeframe = newTimeframe;
        
        // Guardar preferencias
        this._saveUserSettings();
        
        // Emitir evento
        EventBus.publish('charts.timeframeChanged', { 
            chartId, 
            timeframe: newTimeframe 
        });
    }

    /**
     * Cambia el símbolo de un gráfico
     * @param {string} chartId - ID del gráfico
     * @param {string} newSymbol - Nuevo símbolo
     */
    changeSymbol(chartId, newSymbol) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return;
        }
        
        // Actualizar configuración
        chart.config.symbol = newSymbol;
        
        // Cargar nuevos datos
        this._loadChartData(
            chartId,
            newSymbol,
            chart.config.timeframe,
            chart.config.fromDate,
            chart.config.toDate
        );
        
        // Emitir evento
        EventBus.publish('charts.symbolChanged', { 
            chartId, 
            symbol: newSymbol 
        });
    }

    /**
     * Cambia el rango de fechas de un gráfico
     * @param {string} chartId - ID del gráfico
     * @param {Date} fromDate - Nueva fecha de inicio
     * @param {Date} toDate - Nueva fecha de fin
     */
    changeDateRange(chartId, fromDate, toDate) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return;
        }
        
        // Validar fechas
        if (fromDate >= toDate) {
            console.error('La fecha de inicio debe ser anterior a la fecha de fin');
            return;
        }
        
        // Actualizar configuración
        chart.config.fromDate = fromDate;
        chart.config.toDate = toDate;
        
        // Cargar nuevos datos
        this._loadChartData(
            chartId,
            chart.config.symbol,
            chart.config.timeframe,
            fromDate,
            toDate
        );
        
        // Emitir evento
        EventBus.publish('charts.dateRangeChanged', { 
            chartId, 
            fromDate, 
            toDate 
        });
    }

    /**
     * Cambia el tipo de gráfico
     * @param {string} chartId - ID del gráfico
     * @param {string} newType - Nuevo tipo ('candlestick', 'line', 'area', 'bar')
     */
    changeChartType(chartId, newType) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return;
        }
        
        // Validar tipo
        const validTypes = ['candlestick', 'line', 'area', 'bar'];
        if (!validTypes.includes(newType)) {
            console.error(`Tipo de gráfico "${newType}" no válido`);
            return;
        }
        
        // Actualizar configuración
        chart.config.type = newType;
        
        // Re-renderizar datos con nuevo tipo
        const data = this.state.chartsData[chartId]?.data;
        if (data) {
            this._renderChartData(chartId, data);
        }
        
        // Emitir evento
        EventBus.publish('charts.typeChanged', { 
            chartId, 
            type: newType 
        });
    }

    /**
     * Añade un indicador técnico al gráfico
     * @param {string} chartId - ID del gráfico
     * @param {string} indicatorType - Tipo de indicador
     * @param {Object} options - Opciones del indicador
     * @returns {string} ID del indicador añadido
     */
    addIndicator(chartId, indicatorType, options = {}) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return null;
        }
        
        // Opciones por defecto según tipo de indicador
        const defaultOptions = this._getDefaultIndicatorOptions(indicatorType);
        
        // Combinar opciones
        const indicatorOptions = { ...defaultOptions, ...options };
        
        // Generar ID único para el indicador
        const indicatorId = `indicator_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        // Crear indicador según biblioteca
        let indicatorInstance;
        
        switch (this.options.library) {
            case 'tradingview':
                indicatorInstance = this._createTradingViewIndicator(chart.instance, indicatorType, indicatorOptions);
                break;
            case 'chartjs':
                indicatorInstance = this._createChartJsIndicator(chart.instance, indicatorType, indicatorOptions);
                break;
            case 'highcharts':
                indicatorInstance = this._createHighchartsIndicator(chart.instance, indicatorType, indicatorOptions);
                break;
        }
        
        // Guardar referencia al indicador
        chart.indicators.set(indicatorId, {
            type: indicatorType,
            options: indicatorOptions,
            instance: indicatorInstance
        });
        
        // Emitir evento
        EventBus.publish('charts.indicatorAdded', { 
            chartId, 
            indicatorId,
            type: indicatorType
        });
        
        return indicatorId;
    }

    /**
     * Obtiene opciones por defecto para un tipo de indicador
     * @param {string} indicatorType - Tipo de indicador
     * @returns {Object} Opciones por defecto
     * @private
     */
    _getDefaultIndicatorOptions(indicatorType) {
        const defaults = {
            'sma': {
                period: 20,
                field: 'close',
                color: '#2962FF'
            },
            'ema': {
                period: 20,
                field: 'close',
                color: '#FF6D00'
            },
            'bollinger': {
                period: 20,
                field: 'close',
                stdDev: 2,
                upperColor: 'rgba(41, 98, 255, 0.5)',
                middleColor: 'rgba(41, 98, 255, 0.8)',
                lowerColor: 'rgba(41, 98, 255, 0.5)',
                fillColor: 'rgba(41, 98, 255, 0.1)'
            },
            'rsi': {
                period: 14,
                overbought: 70,
                oversold: 30,
                color: '#2962FF',
                overboughtColor: 'rgba(239, 83, 80, 0.2)',
                oversoldColor: 'rgba(38, 166, 154, 0.2)'
            },
            'macd': {
                fastPeriod: 12,
                slowPeriod: 26,
                signalPeriod: 9,
                macdColor: '#2962FF',
                signalColor: '#FF6D00',
                histogramColor: 'rgba(144, 144, 144, 0.5)'
            },
            'atr': {
                period: 14,
                color: '#7B1FA2'
            },
            'volume': {
                upColor: 'rgba(38, 166, 154, 0.5)',
                downColor: 'rgba(239, 83, 80, 0.5)'
            }
        };
        
        return defaults[indicatorType] || {};
    }

    /**
     * Crea un indicador para TradingView
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {string} indicatorType - Tipo de indicador
     * @param {Object} options - Opciones del indicador
     * @returns {Object} Instancia del indicador
     * @private
     */
    _createTradingViewIndicator(chartInstance, indicatorType, options) {
        if (!chartInstance.mainSeries) {
            console.error('Series principal no inicializada');
            return null;
        }
        
        let indicator = null;
        
        switch (indicatorType) {
            case 'sma':
                indicator = chartInstance.addLineSeries({
                    color: options.color,
                    lineWidth: 1,
                    priceScaleId: 'right',
                    title: `SMA(${options.period})`
                });
                
                // En una implementación real, aquí se calcularía el SMA
                // y se asignarían los datos a la serie
                
                break;
                
            case 'bollinger':
                // Series para bandas de Bollinger
                const upperBand = chartInstance.addLineSeries({
                    color: options.upperColor,
                    lineWidth: 1,
                    priceScaleId: 'right',
                    title: `BB Upper(${options.period}, ${options.stdDev})`
                });
                
                const middleBand = chartInstance.addLineSeries({
                    color: options.middleColor,
                    lineWidth: 1,
                    priceScaleId: 'right',
                    title: `BB Middle(${options.period})`
                });
                
                const lowerBand = chartInstance.addLineSeries({
                    color: options.lowerColor,
                    lineWidth: 1,
                    priceScaleId: 'right',
                    title: `BB Lower(${options.period}, ${options.stdDev})`
                });
                
                // En una implementación real, aquí se calcularían las bandas de Bollinger
                // y se asignarían los datos a cada serie
                
                indicator = {
                    upperBand,
                    middleBand,
                    lowerBand
                };
                
                break;
                
            // Implementar otros indicadores: RSI, MACD, etc.
            
            default:
                console.error(`Indicador ${indicatorType} no implementado para TradingView`);
        }
        
        return indicator;
    }

    /**
     * Crea un indicador para Chart.js
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {string} indicatorType - Tipo de indicador
     * @param {Object} options - Opciones del indicador
     * @returns {Object} Instancia del indicador
     * @private
     */
    _createChartJsIndicator(chartInstance, indicatorType, options) {
        // Verificar que el gráfico tiene datos
        if (!chartInstance.data || !chartInstance.data.datasets || chartInstance.data.datasets.length === 0) {
            console.error('El gráfico no tiene datasets inicializados');
            return null;
        }
        
        // Obtener datos de precio de cierre
        const labels = chartInstance.data.labels;
        let priceData = [];
        
        if (chartInstance.data.datasets.length > 0) {
            priceData = chartInstance.data.datasets[0].data;
        }
        
        if (!labels || !priceData || labels.length === 0) {
            console.error('No hay datos suficientes para calcular el indicador');
            return null;
        }
        
        let dataset = null;
        
        switch (indicatorType) {
            case 'sma':
                // Calcular SMA (versión simplificada)
                const smaData = this._calculateSMA(priceData, options.period);
                
                // Crear dataset
                dataset = {
                    label: `SMA(${options.period})`,
                    data: smaData,
                    borderColor: options.color,
                    backgroundColor: 'rgba(0, 0, 0, 0)',
                    borderWidth: 1,
                    pointRadius: 0,
                    fill: false
                };
                
                // Añadir al gráfico
                chartInstance.data.datasets.push(dataset);
                chartInstance.update();
                
                break;
                
            // Implementar otros indicadores
                
            default:
                console.error(`Indicador ${indicatorType} no implementado para Chart.js`);
        }
        
        return dataset;
    }

    /**
     * Cálculo simplificado de SMA para el ejemplo
     * @param {Array} data - Datos de precio
     * @param {number} period - Período
     * @returns {Array} Valores SMA
     * @private
     */
    _calculateSMA(data, period) {
        const result = [];
        
        // Rellenar con nulos para los primeros N-1 períodos
        for (let i = 0; i < period - 1; i++) {
            result.push(null);
        }
        
        // Calcular SMA para cada punto desde el período N
        for (let i = period - 1; i < data.length; i++) {
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += data[i - j];
            }
            result.push(sum / period);
        }
        
        return result;
    }

    /**
     * Crea un indicador para Highcharts
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {string} indicatorType - Tipo de indicador
     * @param {Object} options - Opciones del indicador
     * @returns {Object} Instancia del indicador
     * @private
     */
    _createHighchartsIndicator(chartInstance, indicatorType, options) {
        if (!chartInstance || !chartInstance.series || chartInstance.series.length === 0) {
            console.error('El gráfico no tiene series inicializadas');
            return null;
        }
        
        let indicator = null;
        
        switch (indicatorType) {
            case 'sma':
                indicator = chartInstance.addSeries({
                    type: 'sma',
                    linkedTo: 0, // Vincular a la primera serie
                    params: {
                        period: options.period
                    },
                    color: options.color,
                    name: `SMA (${options.period})`
                });
                break;
                
            case 'ema':
                indicator = chartInstance.addSeries({
                    type: 'ema',
                    linkedTo: 0,
                    params: {
                        period: options.period
                    },
                    color: options.color,
                    name: `EMA (${options.period})`
                });
                break;
                
            case 'bollinger':
                indicator = chartInstance.addSeries({
                    type: 'bb',
                    linkedTo: 0,
                    params: {
                        period: options.period,
                        standardDeviation: options.stdDev
                    },
                    bottomLine: {
                        styles: {
                            lineColor: options.lowerColor
                        }
                    },
                    topLine: {
                        styles: {
                            lineColor: options.upperColor
                        }
                    },
                    name: `Bollinger Bands (${options.period}, ${options.stdDev})`
                });
                break;
                
            case 'rsi':
                // Crear nuevo eje Y para el RSI
                if (!chartInstance.get('rsi-axis')) {
                    chartInstance.addAxis({
                        id: 'rsi-axis',
                        title: {
                            text: 'RSI'
                        },
                        lineWidth: 1,
                        lineColor: '#cccccc',
                        min: 0,
                        max: 100,
                        height: '30%',
                        top: '70%',
                        offset: 0,
                        showLastLabel: true
                    });
                }
                
                // Añadir bandas de sobrecompra/sobreventa
                if (!chartInstance.get('rsi-overbought')) {
                    chartInstance.addSeries({
                        id: 'rsi-overbought',
                        name: 'Sobrecompra',
                        data: [[chartInstance.xAxis[0].min, options.overbought], [chartInstance.xAxis[0].max, options.overbought]],
                        yAxis: 'rsi-axis',
                        color: options.overboughtColor,
                        enableMouseTracking: false,
                        showInLegend: false
                    });
                }
                
                if (!chartInstance.get('rsi-oversold')) {
                    chartInstance.addSeries({
                        id: 'rsi-oversold',
                        name: 'Sobreventa',
                        data: [[chartInstance.xAxis[0].min, options.oversold], [chartInstance.xAxis[0].max, options.oversold]],
                        yAxis: 'rsi-axis',
                        color: options.oversoldColor,
                        enableMouseTracking: false,
                        showInLegend: false
                    });
                }
                
                // Añadir indicador RSI
                indicator = chartInstance.addSeries({
                    type: 'rsi',
                    linkedTo: 0,
                    yAxis: 'rsi-axis',
                    params: {
                        period: options.period
                    },
                    color: options.color,
                    name: `RSI (${options.period})`
                });
                break;
                
            // Implementar otros indicadores
                
            default:
                console.error(`Indicador ${indicatorType} no implementado para Highcharts`);
        }
        
        return indicator;
    }

    /**
     * Elimina un indicador del gráfico
     * @param {string} chartId - ID del gráfico
     * @param {string} indicatorId - ID del indicador a eliminar
     */
    removeIndicator(chartId, indicatorId) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return;
        }
        
        const indicator = chart.indicators.get(indicatorId);
        if (!indicator) {
            console.error(`Indicador con ID "${indicatorId}" no encontrado`);
            return;
        }
        
        // Eliminar indicador según biblioteca
        switch (this.options.library) {
            case 'tradingview':
                this._removeTradingViewIndicator(chart.instance, indicator);
                break;
            case 'chartjs':
                this._removeChartJsIndicator(chart.instance, indicator);
                break;
            case 'highcharts':
                this._removeHighchartsIndicator(chart.instance, indicator);
                break;
        }
        
        // Eliminar del mapa de indicadores
        chart.indicators.delete(indicatorId);
        
        // Emitir evento
        EventBus.publish('charts.indicatorRemoved', { 
            chartId, 
            indicatorId,
            type: indicator.type
        });
    }

    /**
     * Elimina un indicador de TradingView
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {Object} indicator - Indicador a eliminar
     * @private
     */
    _removeTradingViewIndicator(chartInstance, indicator) {
        if (indicator.instance) {
            if (Array.isArray(indicator.instance) || typeof indicator.instance === 'object') {
                // Para indicadores con múltiples series (como Bollinger Bands)
                for (const key in indicator.instance) {
                    if (indicator.instance[key] && typeof indicator.instance[key].remove === 'function') {
                        chartInstance.removeSeries(indicator.instance[key]);
                    }
                }
            } else if (typeof indicator.instance.remove === 'function') {
                chartInstance.removeSeries(indicator.instance);
            }
        }
    }

    /**
     * Elimina un indicador de Chart.js
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {Object} indicator - Indicador a eliminar
     * @private
     */
    _removeChartJsIndicator(chartInstance, indicator) {
        if (indicator.instance) {
            // Encontrar índice del dataset
            const index = chartInstance.data.datasets.indexOf(indicator.instance);
            if (index !== -1) {
                chartInstance.data.datasets.splice(index, 1);
                chartInstance.update();
            }
        }
    }

    /**
     * Elimina un indicador de Highcharts
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {Object} indicator - Indicador a eliminar
     * @private
     */
    _removeHighchartsIndicator(chartInstance, indicator) {
        if (indicator.instance && indicator.instance.remove) {
            indicator.instance.remove();
        }
    }

    /**
     * Añade un símbolo de comparación al gráfico
     * @param {string} chartId - ID del gráfico
     * @param {string} symbol - Símbolo a comparar
     * @returns {string} ID de la comparación
     */
    addComparisonSymbol(chartId, symbol) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return null;
        }
        
        // Verificar que el símbolo no es el mismo que el principal
        if (symbol === chart.config.symbol) {
            console.error('No se puede comparar con el mismo símbolo principal');
            return null;
        }
        
        // Generar ID único para la comparación
        const comparisonId = `comparison_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        try {
            // Obtener datos históricos del símbolo a comparar
            this.marketDataService.getHistoricalData(
                symbol,
                chart.config.timeframe,
                chart.config.fromDate.getTime(),
                chart.config.toDate.getTime()
            ).then(data => {
                // Procesar y normalizar datos para comparación
                const normalizedData = this._normalizeComparisonData(data, chartId);
                
                // Añadir al gráfico según biblioteca
                let comparisonInstance;
                
                switch (this.options.library) {
                    case 'tradingview':
                        comparisonInstance = this._addTradingViewComparison(chart.instance, symbol, normalizedData);
                        break;
                    case 'chartjs':
                        comparisonInstance = this._addChartJsComparison(chart.instance, symbol, normalizedData);
                        break;
                    case 'highcharts':
                        comparisonInstance = this._addHighchartsComparison(chart.instance, symbol, normalizedData);
                        break;
                }
                
                // Actualizar configuración
                if (!chart.config.comparison) {
                    chart.config.comparison = [];
                }
                chart.config.comparison.push(symbol);
                
                // Guardar referencia
                if (!chart.comparisons) {
                    chart.comparisons = new Map();
                }
                
                chart.comparisons.set(comparisonId, {
                    symbol,
                    instance: comparisonInstance,
                    data: normalizedData
                });
                
                // Emitir evento
                EventBus.publish('charts.comparisonAdded', { 
                    chartId, 
                    comparisonId,
                    symbol
                });
            });
            
            return comparisonId;
            
        } catch (error) {
            console.error(`Error al añadir símbolo de comparación ${symbol}:`, error);
            return null;
        }
    }

    /**
     * Normaliza datos para comparación
     * @param {Array} data - Datos originales
     * @param {string} chartId - ID del gráfico base
     * @returns {Array} Datos normalizados
     * @private
     */
    _normalizeComparisonData(data, chartId) {
        const baseData = this.state.chartsData[chartId];
        if (!baseData || !baseData.data || baseData.data.length === 0) {
            // Si no hay datos base, devolver datos sin normalizar
            return data;
        }
        
        // Normalizar a base 100 para facilitar comparación porcentual
        const baseFirstClose = baseData.data[0].close;
        const compFirstClose = data[0].close;
        
        return data.map(item => ({
            ...item,
            // Valor normalizado para comparación porcentual
            normalizedClose: (item.close / compFirstClose) * 100,
            // Mantener el valor original también
            originalClose: item.close
        }));
    }

    /**
     * Añade comparación en TradingView
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {string} symbol - Símbolo a comparar
     * @param {Array} data - Datos normalizados
     * @returns {Object} Instancia de la comparación
     * @private
     */
    _addTradingViewComparison(chartInstance, symbol, data) {
        // Crear serie para la comparación
        const comparisonSeries = chartInstance.addLineSeries({
            title: symbol,
            color: this._getRandomColor(),
            lineWidth: 2,
            priceFormat: {
                type: 'percent',
                precision: 2,
                minMove: 0.01,
            }
        });
        
        // Formatear datos
        const formattedData = data.map(item => ({
            time: item.time,
            value: item.normalizedClose
        }));
        
        // Asignar datos
        comparisonSeries.setData(formattedData);
        
        return comparisonSeries;
    }

    /**
     * Añade comparación en Chart.js
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {string} symbol - Símbolo a comparar
     * @param {Array} data - Datos normalizados
     * @returns {Object} Instancia de la comparación
     * @private
     */
    _addChartJsComparison(chartInstance, symbol, data) {
        // Crear nuevo dataset
        const comparisonColor = this._getRandomColor();
        const dataset = {
            label: symbol,
            data: data.map(item => ({
                x: new Date(item.time * 1000),
                y: item.normalizedClose
            })),
            borderColor: comparisonColor,
            backgroundColor: 'rgba(0, 0, 0, 0)',
            borderWidth: 2,
            pointRadius: 0,
            fill: false
        };
        
        // Añadir dataset
        chartInstance.data.datasets.push(dataset);
        
        // Actualizar gráfico
        chartInstance.update();
        
        return dataset;
    }

    /**
     * Añade comparación en Highcharts
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {string} symbol - Símbolo a comparar
     * @param {Array} data - Datos normalizados
     * @returns {Object} Instancia de la comparación
     * @private
     */
    _addHighchartsComparison(chartInstance, symbol, data) {
        // Formatear datos
        const formattedData = data.map(item => [
            item.time * 1000,
            item.normalizedClose
        ]);
        
        // Añadir serie
        const series = chartInstance.addSeries({
            name: symbol,
            data: formattedData,
            type: 'line',
            color: this._getRandomColor(),
            tooltip: {
                valueDecimals: 2,
                valueSuffix: '%'
            }
        });
        
        return series;
    }

    /**
     * Genera un color aleatorio para series
     * @returns {string} Color en formato hexadecimal
     * @private
     */
    _getRandomColor() {
        const colors = [
            '#2962FF', // Azul
            '#FF6D00', // Naranja
            '#2E7D32', // Verde
            '#7B1FA2', // Púrpura
            '#C2185B', // Rosa
            '#00838F', // Cyan
            '#FF8F00', // Ámbar
            '#6D4C41', // Marrón
            '#455A64', // Azul grisáceo
            '#D81B60'  // Rosa intenso
        ];
        
        return colors[Math.floor(Math.random() * colors.length)];
    }

    /**
     * Elimina un símbolo de comparación
     * @param {string} chartId - ID del gráfico
     * @param {string} comparisonId - ID de la comparación
     */
    removeComparisonSymbol(chartId, comparisonId) {
        const chart = this.state.charts.get(chartId);
        if (!chart || !chart.comparisons) {
            console.error(`Gráfico con ID "${chartId}" no encontrado o no tiene comparaciones`);
            return;
        }
        
        const comparison = chart.comparisons.get(comparisonId);
        if (!comparison) {
            console.error(`Comparación con ID "${comparisonId}" no encontrada`);
            return;
        }
        
        // Eliminar según biblioteca
        switch (this.options.library) {
            case 'tradingview':
                if (comparison.instance) {
                    chart.instance.removeSeries(comparison.instance);
                }
                break;
            case 'chartjs':
                const index = chart.instance.data.datasets.indexOf(comparison.instance);
                if (index !== -1) {
                    chart.instance.data.datasets.splice(index, 1);
                    chart.instance.update();
                }
                break;
            case 'highcharts':
                if (comparison.instance) {
                    comparison.instance.remove();
                }
                break;
        }
        
        // Actualizar configuración
        const symbolIndex = chart.config.comparison.indexOf(comparison.symbol);
        if (symbolIndex !== -1) {
            chart.config.comparison.splice(symbolIndex, 1);
        }
        
        // Eliminar del mapa
        chart.comparisons.delete(comparisonId);
        
        // Emitir evento
        EventBus.publish('charts.comparisonRemoved', { 
            chartId, 
            comparisonId,
            symbol: comparison.symbol
        });
    }

    /**
     * Añade una herramienta de dibujo al gráfico
     * @param {string} chartId - ID del gráfico
     * @param {string} toolType - Tipo de herramienta
     * @param {Object} options - Opciones de la herramienta
     * @returns {string} ID de la herramienta
     */
    addDrawingTool(chartId, toolType, options = {}) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return null;
        }
        
        // Opciones por defecto según tipo
        const defaultOptions = this._getDefaultDrawingToolOptions(toolType);
        
        // Combinar opciones
        const toolOptions = { ...defaultOptions, ...options };
        
        // Generar ID único
        const toolId = `drawing_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        // Implementación depende de la biblioteca
        // En una implementación real, esto conectaría con las funcionalidades de dibujo
        // de la biblioteca elegida (TradingView, Highcharts, etc.)
        
        console.log(`Herramienta de dibujo ${toolType} añadida al gráfico ${chartId} con opciones:`, toolOptions);
        
        // Guardar referencia
        if (!chart.drawings) {
            chart.drawings = new Map();
        }
        
        chart.drawings.set(toolId, {
            type: toolType,
            options: toolOptions,
            // Aquí iría la instancia real de la herramienta
            instance: {}
        });
        
        // Emitir evento
        EventBus.publish('charts.drawingToolAdded', { 
            chartId, 
            toolId,
            type: toolType
        });
        
        return toolId;
    }

    /**
     * Obtiene opciones por defecto para herramienta de dibujo
     * @param {string} toolType - Tipo de herramienta
     * @returns {Object} Opciones por defecto
     * @private
     */
    _getDefaultDrawingToolOptions(toolType) {
        const defaults = {
            'trendline': {
                color: '#2962FF',
                lineWidth: 2,
                lineStyle: 'solid' // 'solid', 'dashed', 'dotted'
            },
            'fibonacci': {
                color: '#FF6D00',
                lineWidth: 1,
                levels: [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
            },
            'rectangle': {
                borderColor: '#2962FF',
                backgroundColor: 'rgba(41, 98, 255, 0.1)',
                borderWidth: 1
            },
            'ellipse': {
                borderColor: '#2962FF',
                backgroundColor: 'rgba(41, 98, 255, 0.1)',
                borderWidth: 1
            },
            'text': {
                color: '#333333',
                fontSize: 14,
                fontFamily: 'Arial',
                backgroundColor: 'rgba(255, 255, 255, 0.75)'
            }
        };
        
        return defaults[toolType] || {};
    }

    /**
     * Elimina una herramienta de dibujo
     * @param {string} chartId - ID del gráfico
     * @param {string} toolId - ID de la herramienta
     */
    removeDrawingTool(chartId, toolId) {
        const chart = this.state.charts.get(chartId);
        if (!chart || !chart.drawings) {
            console.error(`Gráfico con ID "${chartId}" no encontrado o no tiene herramientas de dibujo`);
            return;
        }
        
        const tool = chart.drawings.get(toolId);
        if (!tool) {
            console.error(`Herramienta con ID "${toolId}" no encontrada`);
            return;
        }
        
        // Implementación depende de la biblioteca
        
        console.log(`Herramienta de dibujo ${tool.type} (${toolId}) eliminada del gráfico ${chartId}`);
        
        // Eliminar del mapa
        chart.drawings.delete(toolId);
        
        // Emitir evento
        EventBus.publish('charts.drawingToolRemoved', { 
            chartId, 
            toolId,
            type: tool.type
        });
    }

    /**
     * Añade una anotación al gráfico
     * @param {string} chartId - ID del gráfico
     * @param {Object} annotation - Datos de la anotación
     * @returns {string} ID de la anotación
     */
    addAnnotation(chartId, annotation) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return null;
        }
        
        // Validar anotación
        if (!annotation.time) {
            console.error('La anotación debe incluir un timestamp (time)');
            return null;
        }
        
        // Generar ID único
        const annotationId = `annotation_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
        
        // Opciones por defecto
        const defaultAnnotation = {
            text: '',
            position: 'top', // 'top', 'bottom', 'left', 'right'
            color: '#2962FF',
            textColor: '#FFFFFF',
            fontSize: 12,
            backgroundColor: '#2962FF',
            marker: {
                enabled: true,
                shape: 'circle', // 'circle', 'square', 'diamond'
                size: 5,
                color: '#2962FF'
            }
        };
        
        // Combinar con opciones proporcionadas
        const finalAnnotation = { ...defaultAnnotation, ...annotation };
        
        // Implementación según biblioteca
        let annotationInstance;
        
        switch (this.options.library) {
            case 'tradingview':
                annotationInstance = this._addTradingViewAnnotation(chart.instance, finalAnnotation);
                break;
            case 'chartjs':
                annotationInstance = this._addChartJsAnnotation(chart.instance, finalAnnotation);
                break;
            case 'highcharts':
                annotationInstance = this._addHighchartsAnnotation(chart.instance, finalAnnotation);
                break;
        }
        
        // Guardar referencia
        if (!chart.annotations) {
            chart.annotations = new Map();
        }
        
        chart.annotations.set(annotationId, {
            data: finalAnnotation,
            instance: annotationInstance
        });
        
        // Emitir evento
        EventBus.publish('charts.annotationAdded', { 
            chartId, 
            annotationId,
            annotation: finalAnnotation
        });
        
        return annotationId;
    }

    /**
     * Añade anotación en TradingView
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {Object} annotation - Datos de la anotación
     * @returns {Object} Instancia de la anotación
     * @private
     */
    _addTradingViewAnnotation(chartInstance, annotation) {
        // TradingView LightWeight tiene capacidades limitadas para anotaciones
        // En una implementación real, esto dependerá de las capacidades de la biblioteca
        
        // Un enfoque es usar marcadores en la serie principal
        if (chartInstance.mainSeries) {
            const marker = {
                time: annotation.time,
                position: annotation.position,
                color: annotation.color,
                shape: annotation.marker.shape === 'circle' ? 'circle' : 'square',
                size: annotation.marker.size
            };
            
            if (annotation.text) {
                marker.text = annotation.text;
            }
            
            chartInstance.mainSeries.setMarkers([marker]);
            
            return marker;
        }
        
        return null;
    }

    /**
     * Añade anotación en Chart.js
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {Object} annotation - Datos de la anotación
     * @returns {Object} Instancia de la anotación
     * @private
     */
    _addChartJsAnnotation(chartInstance, annotation) {
        // Requiere el plugin chartjs-plugin-annotation
        if (!chartInstance.options.plugins) {
            chartInstance.options.plugins = {};
        }
        
        if (!chartInstance.options.plugins.annotation) {
            chartInstance.options.plugins.annotation = {
                annotations: {}
            };
        }
        
        const annotationObj = {
            type: 'point',
            xValue: new Date(annotation.time * 1000),
            yValue: annotation.price || null,
            backgroundColor: annotation.backgroundColor,
            borderColor: annotation.color,
            borderWidth: 2,
            radius: annotation.marker.size,
            label: {
                enabled: !!annotation.text,
                content: annotation.text,
                position: annotation.position,
                color: annotation.textColor,
                font: {
                    size: annotation.fontSize
                },
                backgroundColor: annotation.backgroundColor
            }
        };
        
        // Generar ID único para la anotación
        const annotationKey = `annotation_${Date.now()}`;
        chartInstance.options.plugins.annotation.annotations[annotationKey] = annotationObj;
        
        // Actualizar gráfico
        chartInstance.update();
        
        return {
            key: annotationKey,
            data: annotationObj
        };
    }

    /**
     * Añade anotación en Highcharts
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {Object} annotation - Datos de la anotación
     * @returns {Object} Instancia de la anotación
     * @private
     */
    _addHighchartsAnnotation(chartInstance, annotation) {
        // Highcharts tiene soporte nativo para anotaciones
        const annotationObj = {
            labels: [{
                point: {
                    x: annotation.time * 1000,
                    y: annotation.price || null,
                    xAxis: 0,
                    yAxis: 0
                },
                text: annotation.text,
                backgroundColor: annotation.backgroundColor,
                style: {
                    color: annotation.textColor,
                    fontSize: `${annotation.fontSize}px`
                },
                shape: 'callout',
                borderWidth: 0
            }],
            shapes: [{
                type: annotation.marker.shape === 'circle' ? 'circle' : 'rect',
                point: {
                    x: annotation.time * 1000,
                    y: annotation.price || null,
                    xAxis: 0,
                    yAxis: 0
                },
                r: annotation.marker.size,
                width: annotation.marker.size * 2,
                height: annotation.marker.size * 2,
                fill: annotation.marker.color
            }]
        };
        
        // Añadir anotación al gráfico
        const annotationId = chartInstance.addAnnotation(annotationObj);
        
        return {
            id: annotationId,
            data: annotationObj
        };
    }

    /**
     * Elimina una anotación
     * @param {string} chartId - ID del gráfico
     * @param {string} annotationId - ID de la anotación
     */
    removeAnnotation(chartId, annotationId) {
        const chart = this.state.charts.get(chartId);
        if (!chart || !chart.annotations) {
            console.error(`Gráfico con ID "${chartId}" no encontrado o no tiene anotaciones`);
            return;
        }
        
        const annotation = chart.annotations.get(annotationId);
        if (!annotation) {
            console.error(`Anotación con ID "${annotationId}" no encontrada`);
            return;
        }
        
        // Eliminar según biblioteca
        switch (this.options.library) {
            case 'tradingview':
                if (chart.instance.mainSeries) {
                    // Eliminar marcador - en una implementación real, esto
                    // requeriría mantener una lista de marcadores y recrearla
                    chart.instance.mainSeries.setMarkers([]);
                }
                break;
            case 'chartjs':
                if (annotation.instance && annotation.instance.key) {
                    if (chart.instance.options.plugins && 
                        chart.instance.options.plugins.annotation && 
                        chart.instance.options.plugins.annotation.annotations) {
                        delete chart.instance.options.plugins.annotation.annotations[annotation.instance.key];
                        chart.instance.update();
                    }
                }
                break;
            case 'highcharts':
                if (annotation.instance && annotation.instance.id) {
                    chart.instance.removeAnnotation(annotation.instance.id);
                }
                break;
        }
        
        // Eliminar del mapa
        chart.annotations.delete(annotationId);
        
        // Emitir evento
        EventBus.publish('charts.annotationRemoved', { 
            chartId, 
            annotationId
        });
    }

    /**
     * Exporta un gráfico como imagen
     * @param {string} chartId - ID del gráfico
     * @param {Object} options - Opciones de exportación
     * @returns {Promise<string>} URL de la imagen generada
     */
    exportChartAsImage(chartId, options = {}) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            return Promise.reject(new Error(`Gráfico con ID "${chartId}" no encontrado`));
        }
        
        const defaultOptions = {
            width: null, // Automático
            height: null, // Automático
            format: 'png', // 'png', 'jpeg'
            quality: 0.9, // Para JPEG
            scale: window.devicePixelRatio || 1,
            backgroundColor: null // Automático
        };
        
        const exportOptions = { ...defaultOptions, ...options };
        
        // Implementación según biblioteca
        switch (this.options.library) {
            case 'tradingview':
                return this._exportTradingViewAsImage(chart.instance, chart.container, exportOptions);
            case 'chartjs':
                return this._exportChartJsAsImage(chart.instance, exportOptions);
            case 'highcharts':
                return this._exportHighchartsAsImage(chart.instance, exportOptions);
            default:
                return Promise.reject(new Error(`Biblioteca ${this.options.library} no soporta exportación`));
        }
    }

    /**
     * Exporta gráfico TradingView como imagen
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {HTMLElement} container - Contenedor del gráfico
     * @param {Object} options - Opciones de exportación
     * @returns {Promise<string>} URL de la imagen generada
     * @private
     */
    _exportTradingViewAsImage(chartInstance, container, options) {
        return new Promise((resolve, reject) => {
            try {
                // TradingView LightWeight no tiene método nativo de exportación
                // Usamos técnica de captura de canvas
                html2canvas(container, {
                    scale: options.scale,
                    backgroundColor: options.backgroundColor || null,
                    width: options.width || container.clientWidth,
                    height: options.height || container.clientHeight
                }).then(canvas => {
                    const imageUrl = canvas.toDataURL(`image/${options.format}`, options.quality);
                    resolve(imageUrl);
                }).catch(error => {
                    reject(new Error(`Error al exportar gráfico: ${error.message}`));
                });
            } catch (error) {
                // Si html2canvas no está disponible, intentamos un enfoque alternativo
                if (!window.html2canvas) {
                    console.warn('html2canvas no está disponible, usando enfoque alternativo');
                    
                    // Crear canvas temporal
                    const canvas = document.createElement('canvas');
                    const context = canvas.getContext('2d');
                    
                    // Dimensiones
                    const width = options.width || container.clientWidth;
                    const height = options.height || container.clientHeight;
                    
                    canvas.width = width * options.scale;
                    canvas.height = height * options.scale;
                    
                    // Escalar
                    context.scale(options.scale, options.scale);
                    
                    // Fondo
                    if (options.backgroundColor) {
                        context.fillStyle = options.backgroundColor;
                        context.fillRect(0, 0, width, height);
                    }
                    
                    // Esta es una solución muy básica - solo captura lo que hay en el DOM
                    // No capturará correctamente elementos canvas internos
                    try {
                        const imageUrl = canvas.toDataURL(`image/${options.format}`, options.quality);
                        resolve(imageUrl);
                    } catch (err) {
                        reject(new Error(`Error al exportar gráfico: ${err.message}`));
                    }
                } else {
                    reject(error);
                }
            }
        });
    }

    /**
     * Exporta gráfico Chart.js como imagen
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {Object} options - Opciones de exportación
     * @returns {Promise<string>} URL de la imagen generada
     * @private
     */
    _exportChartJsAsImage(chartInstance, options) {
        return new Promise((resolve, reject) => {
            try {
                // Chart.js tiene canvas directamente accesible
                const canvas = chartInstance.canvas;
                
                // Si se especifican dimensiones, crear un canvas temporal
                if (options.width || options.height) {
                    const tempCanvas = document.createElement('canvas');
                    const tempCtx = tempCanvas.getContext('2d');
                    
                    // Dimensiones
                    const width = options.width || canvas.width;
                    const height = options.height || canvas.height;
                    
                    tempCanvas.width = width * options.scale;
                    tempCanvas.height = height * options.scale;
                    
                    // Escalar
                    tempCtx.scale(options.scale, options.scale);
                    
                    // Fondo
                    if (options.backgroundColor) {
                        tempCtx.fillStyle = options.backgroundColor;
                        tempCtx.fillRect(0, 0, width, height);
                    }
                    
                    // Dibujar original en temporal
                    tempCtx.drawImage(canvas, 0, 0, width, height);
                    
                    // Exportar
                    const imageUrl = tempCanvas.toDataURL(`image/${options.format}`, options.quality);
                    resolve(imageUrl);
                } else {
                    // Exportar directamente
                    const imageUrl = canvas.toDataURL(`image/${options.format}`, options.quality);
                    resolve(imageUrl);
                }
            } catch (error) {
                reject(new Error(`Error al exportar gráfico: ${error.message}`));
            }
        });
    }

    /**
     * Exporta gráfico Highcharts como imagen
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {Object} options - Opciones de exportación
     * @returns {Promise<string>} URL de la imagen generada
     * @private
     */
    _exportHighchartsAsImage(chartInstance, options) {
        return new Promise((resolve, reject) => {
            try {
                // Highcharts tiene método nativo de exportación
                const exportSettings = {
                    type: options.format,
                    scale: options.scale,
                    sourceWidth: options.width,
                    sourceHeight: options.height,
                    backgroundColor: options.backgroundColor
                };
                
                // Llamar método de exportación
                chartInstance.exportChartLocal(exportSettings, chart => {
                    // Este callback recibe el chart pero necesitamos obtener la URL de la imagen
                    // En una implementación real, Highcharts proporciona métodos para esto
                    // Para este ejemplo, simulamos obtener la URL
                    setTimeout(() => {
                        // Simular URL de imagen
                        const imageUrl = `data:image/${options.format};base64,iVBORw0KGgoAAAANSUhEUgAA...`;
                        resolve(imageUrl);
                    }, 100);
                });
            } catch (error) {
                // Si el método de exportación falla, intentar método alternativo
                try {
                    // Obtener SVG del gráfico
                    const svg = chartInstance.getSVG({
                        sourceWidth: options.width,
                        sourceHeight: options.height,
                        backgroundColor: options.backgroundColor
                    });
                    
                    // Convertir SVG a imagen (en una implementación real, esto
                    // requeriría una biblioteca como canvg)
                    const imageUrl = `data:image/svg+xml;base64,${btoa(svg)}`;
                    resolve(imageUrl);
                } catch (err) {
                    reject(new Error(`Error al exportar gráfico: ${err.message}`));
                }
            }
        });
    }

    /**
     * Redimensiona un gráfico
     * @param {string} chartId - ID del gráfico
     * @param {number} width - Nuevo ancho (null para automático)
     * @param {number} height - Nueva altura (null para automático)
     */
    resizeChart(chartId, width = null, height = null) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return;
        }
        
        // Determinar dimensiones
        const container = chart.container;
        const newWidth = width || container.clientWidth;
        const newHeight = height || container.clientHeight || 400;
        
        // Redimensionar según biblioteca
        switch (this.options.library) {
            case 'tradingview':
                chart.instance.applyOptions({
                    width: newWidth,
                    height: newHeight
                });
                break;
            case 'chartjs':
                // Chart.js maneja el redimensionado automáticamente si responsive: true
                // Pero podemos forzar un update para asegurar
                chart.instance.resize(newWidth, newHeight);
                break;
            case 'highcharts':
                chart.instance.setSize(newWidth, newHeight);
                break;
        }
        
        // Emitir evento
        EventBus.publish('charts.resized', { 
            chartId, 
            width: newWidth,
            height: newHeight
        });
    }

    /**
     * Cambia el tema de visualización
     * @param {string} theme - Nuevo tema ('light' o 'dark')
     */
    setTheme(theme) {
        if (theme !== 'light' && theme !== 'dark') {
            console.error(`Tema "${theme}" no válido. Usar 'light' o 'dark'`);
            return;
        }
        
        // Actualizar tema global
        this.state.currentTheme = theme;
        this.options.theme = theme;
        
        // Aplicar a todos los gráficos
        this.state.charts.forEach((chart, chartId) => {
            chart.config.theme = theme;
            
            // Aplicar según biblioteca
            switch (this.options.library) {
                case 'tradingview':
                    this._applyTradingViewTheme(chart.instance, theme);
                    break;
                case 'chartjs':
                    this._applyChartJsTheme(chart.instance, theme);
                    break;
                case 'highcharts':
                    this._applyHighchartsTheme(chart.instance, theme);
                    break;
            }
        });
        
        // Guardar preferencia
        this._saveUserSettings();
        
        // Emitir evento
        EventBus.publish('charts.themeChanged', { theme });
    }

    /**
     * Aplica tema a un gráfico TradingView
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {string} theme - Tema a aplicar
     * @private
     */
    _applyTradingViewTheme(chartInstance, theme) {
        const options = {
            layout: {
                background: { color: theme === 'dark' ? '#1E222D' : '#FFFFFF' },
                textColor: theme === 'dark' ? '#D9D9D9' : '#191919',
            },
            grid: {
                vertLines: { color: theme === 'dark' ? '#2B2B43' : '#E6E6E6' },
                horzLines: { color: theme === 'dark' ? '#2B2B43' : '#E6E6E6' },
            },
            priceScale: {
                borderColor: theme === 'dark' ? '#2B2B43' : '#E6E6E6',
            },
            timeScale: {
                borderColor: theme === 'dark' ? '#2B2B43' : '#E6E6E6',
            }
        };
        
        chartInstance.applyOptions(options);
    }

    /**
     * Aplica tema a un gráfico Chart.js
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {string} theme - Tema a aplicar
     * @private
     */
    _applyChartJsTheme(chartInstance, theme) {
        const options = {
            options: {
                plugins: {
                    legend: {
                        labels: {
                            color: theme === 'dark' ? '#D9D9D9' : '#191919'
                        }
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: theme === 'dark' ? '#D9D9D9' : '#191919'
                        }
                    },
                    y: {
                        grid: {
                            color: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                        },
                        ticks: {
                            color: theme === 'dark' ? '#D9D9D9' : '#191919'
                        }
                    }
                }
            }
        };
        
        chartInstance.options.plugins.legend.labels.color = options.options.plugins.legend.labels.color;
        chartInstance.options.scales.x.grid.color = options.options.scales.x.grid.color;
        chartInstance.options.scales.x.ticks.color = options.options.scales.x.ticks.color;
        chartInstance.options.scales.y.grid.color = options.options.scales.y.grid.color;
        chartInstance.options.scales.y.ticks.color = options.options.scales.y.ticks.color;
        
        chartInstance.update();
    }

    /**
     * Aplica tema a un gráfico Highcharts
     * @param {Object} chartInstance - Instancia del gráfico
     * @param {string} theme - Tema a aplicar
     * @private
     */
    _applyHighchartsTheme(chartInstance, theme) {
        const options = {
            chart: {
                backgroundColor: theme === 'dark' ? '#1E222D' : '#FFFFFF',
            },
            title: {
                style: {
                    color: theme === 'dark' ? '#D9D9D9' : '#191919'
                }
            },
            xAxis: {
                labels: {
                    style: {
                        color: theme === 'dark' ? '#D9D9D9' : '#191919'
                    }
                },
                gridLineColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            },
            yAxis: {
                labels: {
                    style: {
                        color: theme === 'dark' ? '#D9D9D9' : '#191919'
                    }
                },
                gridLineColor: theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
            },
            legend: {
                itemStyle: {
                    color: theme === 'dark' ? '#D9D9D9' : '#191919'
                }
            }
        };
        
        chartInstance.update(options);
    }

    /**
     * Destruye un gráfico y libera recursos
     * @param {string} chartId - ID del gráfico a destruir
     */
    destroyChart(chartId) {
        const chart = this.state.charts.get(chartId);
        if (!chart) {
            console.error(`Gráfico con ID "${chartId}" no encontrado`);
            return;
        }
        
        // Destruir según biblioteca
        switch (this.options.library) {
            case 'tradingview':
                // TradingView no tiene método destroy explícito
                // Limpiar referencias
                break;
            case 'chartjs':
                chart.instance.destroy();
                break;
            case 'highcharts':
                chart.instance.destroy();
                break;
        }
        
        // Eliminar datos
        delete this.state.chartsData[chartId];
        
        // Eliminar del mapa
        this.state.charts.delete(chartId);
        
        // Emitir evento
        EventBus.publish('charts.destroyed', { chartId });
    }

    /**
     * Limpia todos los recursos y destruye la instancia
     */
    destroy() {
        // Destruir todos los gráficos
        Array.from(this.state.charts.keys()).forEach(chartId => {
            this.destroyChart(chartId);
        });
        
        // Cancelar actualizaciones
        if (this.options.autoUpdate) {
            clearInterval(this._updateInterval);
        }
        
        // Eliminar suscripciones de eventos
        // Esto depende de cómo se implementen las suscripciones
        
        console.log('ChartController destruido');
        
        // Emitir evento
        EventBus.publish('charts.controllerDestroyed');
    }
}

// Exportar también una instancia predeterminada para uso rápido
export const chartController = new ChartController();
