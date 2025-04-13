/**
 * widget-service.js
 * Servicio para gestionar widgets personalizables en el dashboard del portal de criptomonedas.
 * 
 * Este servicio implementa una arquitectura modular para el registro, configuración,
 * renderizado y comunicación de widgets en el dashboard.
 */

import { EventBus } from '../utils/event-bus.js';
import { StorageManager } from '../utils/storage-manager.js';
import { MarketDataService } from '../market/market-data-service.js';
import { NewsService } from '../news/news-service.js';
import { AlertsService } from './alerts-service.js';

/**
 * Clase principal para gestionar widgets en el dashboard
 */
export class WidgetService {
    /**
     * Constructor del servicio de widgets
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        // Opciones por defecto
        this.options = {
            storageKey: 'dashboard.widgets',
            autoSave: true,
            updateInterval: 30000, // 30 segundos
            maxWidgets: 20,
            ...options
        };
        
        // Servicios dependientes
        this.marketDataService = options.marketDataService || new MarketDataService();
        this.newsService = options.newsService || new NewsService();
        this.alertsService = options.alertsService || new AlertsService();
        
        // Registro de tipos de widgets disponibles
        this.widgetTypes = {};
        
        // Widgets instanciados en el dashboard actual
        this.activeWidgets = {};
        
        // Intervalos de actualización
        this.updateIntervals = {};
        
        // Estado inicialización
        this.initialized = false;
    }
    
    /**
     * Inicializa el servicio de widgets
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;
        
        console.log('Inicializando servicio de widgets...');
        
        // Registrar tipos de widgets predefinidos
        this._registerPredefinedWidgetTypes();
        
        // Suscribirse a eventos relevantes
        this._setupEventListeners();
        
        // Marcar como inicializado
        this.initialized = true;
        
        console.log('Servicio de widgets inicializado correctamente');
        
        // Emitir evento de inicialización completada
        EventBus.publish('widgets.initialized', { service: this });
    }
    
    /**
     * Registra un nuevo tipo de widget
     * @param {string} typeId - Identificador único del tipo de widget
     * @param {Object} definition - Definición del tipo de widget
     * @returns {boolean} - Éxito del registro
     */
    registerWidgetType(typeId, definition) {
        if (this.widgetTypes[typeId]) {
            console.warn(`El tipo de widget "${typeId}" ya está registrado.`);
            return false;
        }
        
        // Validar definición
        if (!this._validateWidgetTypeDefinition(definition)) {
            console.error(`Definición inválida para el tipo de widget "${typeId}".`);
            return false;
        }
        
        // Registrar tipo
        this.widgetTypes[typeId] = {
            id: typeId,
            ...definition
        };
        
        console.log(`Tipo de widget "${typeId}" registrado correctamente.`);
        return true;
    }
    
    /**
     * Obtiene la lista de tipos de widgets disponibles
     * @param {Object} filters - Filtros para la búsqueda (categoría, etc.)
     * @returns {Array} - Lista de tipos de widgets
     */
    getAvailableWidgetTypes(filters = {}) {
        let types = Object.values(this.widgetTypes);
        
        // Aplicar filtros si existen
        if (filters.category) {
            types = types.filter(type => type.category === filters.category);
        }
        
        if (filters.level) {
            types = types.filter(type => !type.userLevel || type.userLevel === filters.level);
        }
        
        return types;
    }
    
    /**
     * Crea una nueva instancia de widget
     * @param {string} typeId - Tipo de widget a crear
     * @param {Object} config - Configuración inicial
     * @param {string} containerId - ID del contenedor donde se renderizará
     * @returns {string|null} - ID del widget creado o null si hay error
     */
    createWidget(typeId, config = {}, containerId) {
        // Verificar si el tipo existe
        if (!this.widgetTypes[typeId]) {
            console.error(`Tipo de widget "${typeId}" no encontrado.`);
            return null;
        }
        
        // Generar ID único para el widget
        const widgetId = `widget_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
        
        // Combinar configuración por defecto con la proporcionada
        const typeDefinition = this.widgetTypes[typeId];
        const defaultConfig = this._getDefaultConfig(typeDefinition);
        const fullConfig = {
            ...defaultConfig,
            ...config,
            id: widgetId,
            type: typeId,
            containerId: containerId
        };
        
        // Validar configuración
        if (!this._validateWidgetConfig(typeDefinition, fullConfig)) {
            console.error('Configuración de widget inválida.');
            return null;
        }
        
        // Crear instancia
        this.activeWidgets[widgetId] = {
            id: widgetId,
            type: typeId,
            config: fullConfig,
            state: {
                created: new Date(),
                lastUpdated: new Date(),
                isLoading: false,
                hasError: false,
                errorMessage: null
            }
        };
        
        // Renderizar widget
        this._renderWidget(widgetId);
        
        // Configurar actualización automática si es necesario
        this._setupWidgetUpdates(widgetId);
        
        // Guardar cambios si autoSave está activado
        if (this.options.autoSave) {
            this.saveDashboardConfig();
        }
        
        // Emitir evento de creación
        EventBus.publish('widgets.created', { widgetId, typeId, config: fullConfig });
        
        return widgetId;
    }
    
    /**
     * Actualiza la configuración de un widget existente
     * @param {string} widgetId - ID del widget
     * @param {Object} newConfig - Nueva configuración
     * @returns {boolean} - Éxito de la operación
     */
    updateWidgetConfig(widgetId, newConfig) {
        // Verificar si el widget existe
        if (!this.activeWidgets[widgetId]) {
            console.error(`Widget "${widgetId}" no encontrado.`);
            return false;
        }
        
        const widget = this.activeWidgets[widgetId];
        const typeDefinition = this.widgetTypes[widget.type];
        
        // Combinar configuración actual con la nueva
        const updatedConfig = {
            ...widget.config,
            ...newConfig
        };
        
        // Validar configuración
        if (!this._validateWidgetConfig(typeDefinition, updatedConfig)) {
            console.error('Configuración de widget inválida.');
            return false;
        }
        
        // Actualizar configuración
        widget.config = updatedConfig;
        widget.state.lastUpdated = new Date();
        
        // Re-renderizar widget
        this._renderWidget(widgetId);
        
        // Reconfiguar actualización automática si es necesario
        this._setupWidgetUpdates(widgetId);
        
        // Guardar cambios si autoSave está activado
        if (this.options.autoSave) {
            this.saveDashboardConfig();
        }
        
        // Emitir evento de actualización
        EventBus.publish('widgets.updated', { widgetId, config: updatedConfig });
        
        return true;
    }
    
    /**
     * Elimina un widget del dashboard
     * @param {string} widgetId - ID del widget a eliminar
     * @returns {boolean} - Éxito de la operación
     */
    removeWidget(widgetId) {
        // Verificar si el widget existe
        if (!this.activeWidgets[widgetId]) {
            console.error(`Widget "${widgetId}" no encontrado.`);
            return false;
        }
        
        // Cancelar intervalos de actualización
        if (this.updateIntervals[widgetId]) {
            clearInterval(this.updateIntervals[widgetId]);
            delete this.updateIntervals[widgetId];
        }
        
        // Obtener información del contenedor
        const containerId = this.activeWidgets[widgetId].config.containerId;
        
        // Eliminar del DOM
        if (containerId) {
            const container = document.getElementById(containerId);
            if (container) {
                // Buscar el elemento del widget dentro del contenedor
                const widgetElement = container.querySelector(`[data-widget-id="${widgetId}"]`);
                if (widgetElement) {
                    widgetElement.remove();
                }
            }
        }
        
        // Eliminar de la lista de widgets activos
        delete this.activeWidgets[widgetId];
        
        // Guardar cambios si autoSave está activado
        if (this.options.autoSave) {
            this.saveDashboardConfig();
        }
        
        // Emitir evento de eliminación
        EventBus.publish('widgets.removed', { widgetId });
        
        return true;
    }
    
    /**
     * Guarda la configuración actual del dashboard
     * @returns {boolean} - Éxito de la operación
     */
    saveDashboardConfig() {
        try {
            // Crear objeto de configuración serializable
            const dashboardConfig = {
                widgets: Object.values(this.activeWidgets).map(widget => ({
                    id: widget.id,
                    type: widget.type,
                    config: this._getSerializableConfig(widget.config)
                })),
                lastSaved: new Date().toISOString()
            };
            
            // Guardar en almacenamiento
            StorageManager.set(this.options.storageKey, dashboardConfig);
            
            // Emitir evento de guardado
            EventBus.publish('widgets.configSaved', { config: dashboardConfig });
            
            return true;
        } catch (error) {
            console.error('Error al guardar configuración del dashboard:', error);
            return false;
        }
    }
    
    /**
     * Carga la configuración del dashboard desde el almacenamiento
     * @returns {boolean} - Éxito de la operación
     */
    loadDashboardConfig() {
        try {
            // Obtener configuración guardada
            const dashboardConfig = StorageManager.get(this.options.storageKey);
            
            if (!dashboardConfig || !dashboardConfig.widgets || !Array.isArray(dashboardConfig.widgets)) {
                console.warn('No se encontró configuración guardada del dashboard.');
                return false;
            }
            
            // Limpiar widgets actuales
            this.clearDashboard();
            
            // Recrear widgets desde la configuración
            dashboardConfig.widgets.forEach(widgetConfig => {
                if (widgetConfig.type && this.widgetTypes[widgetConfig.type]) {
                    this.createWidget(
                        widgetConfig.type,
                        widgetConfig.config,
                        widgetConfig.config.containerId
                    );
                }
            });
            
            // Emitir evento de carga
            EventBus.publish('widgets.configLoaded', { config: dashboardConfig });
            
            return true;
        } catch (error) {
            console.error('Error al cargar configuración del dashboard:', error);
            return false;
        }
    }
    
    /**
     * Elimina todos los widgets del dashboard
     */
    clearDashboard() {
        // Cancelar todos los intervalos de actualización
        Object.keys(this.updateIntervals).forEach(widgetId => {
            clearInterval(this.updateIntervals[widgetId]);
            delete this.updateIntervals[widgetId];
        });
        
        // Eliminar widgets del DOM
        Object.values(this.activeWidgets).forEach(widget => {
            const containerId = widget.config.containerId;
            if (containerId) {
                const container = document.getElementById(containerId);
                if (container) {
                    const widgetElement = container.querySelector(`[data-widget-id="${widget.id}"]`);
                    if (widgetElement) {
                        widgetElement.remove();
                    }
                }
            }
        });
        
        // Reiniciar lista de widgets activos
        this.activeWidgets = {};
        
        // Emitir evento de limpieza
        EventBus.publish('widgets.dashboardCleared');
    }
    
    /**
     * Aplica una plantilla predefinida de dashboard
     * @param {string} templateId - Identificador de la plantilla
     * @returns {boolean} - Éxito de la operación
     */
    applyTemplate(templateId) {
        // Obtener definición de la plantilla
        const template = this.getDashboardTemplates().find(t => t.id === templateId);
        
        if (!template) {
            console.error(`Plantilla "${templateId}" no encontrada.`);
            return false;
        }
        
        // Limpiar dashboard actual
        this.clearDashboard();
        
        // Crear widgets según la plantilla
        template.widgets.forEach(widgetDef => {
            this.createWidget(
                widgetDef.type,
                widgetDef.config,
                widgetDef.containerId
            );
        });
        
        // Guardar configuración
        if (this.options.autoSave) {
            this.saveDashboardConfig();
        }
        
        // Emitir evento de aplicación de plantilla
        EventBus.publish('widgets.templateApplied', { templateId, template });
        
        return true;
    }
    
    /**
     * Obtiene la lista de plantillas de dashboard disponibles
     * @param {string} userLevel - Nivel del usuario (novato, intermedio, senior)
     * @returns {Array} - Lista de plantillas
     */
    getDashboardTemplates(userLevel = null) {
        const templates = [
            {
                id: 'novato',
                name: 'Dashboard para Principiantes',
                description: 'Configuración básica con información esencial para principiantes',
                userLevel: 'novato',
                widgets: [
                    {
                        type: 'price-widget',
                        containerId: 'widget-container-1',
                        config: {
                            coins: ['bitcoin', 'ethereum'],
                            showChange: true,
                            refreshInterval: 60000
                        }
                    },
                    {
                        type: 'news-widget',
                        containerId: 'widget-container-2',
                        config: {
                            limit: 5,
                            showImages: true
                        }
                    },
                    {
                        type: 'fear-greed-widget',
                        containerId: 'widget-container-3',
                        config: {
                            showHistorical: false
                        }
                    }
                ]
            },
            {
                id: 'intermedio',
                name: 'Dashboard para Nivel Intermedio',
                description: 'Dashboard equilibrado con análisis y herramientas más avanzadas',
                userLevel: 'intermedio',
                widgets: [
                    {
                        type: 'price-widget',
                        containerId: 'widget-container-1',
                        config: {
                            coins: ['bitcoin', 'ethereum', 'cardano', 'solana', 'polkadot'],
                            showChange: true,
                            showVolume: true,
                            refreshInterval: 30000
                        }
                    },
                    {
                        type: 'chart-widget',
                        containerId: 'widget-container-2',
                        config: {
                            coin: 'bitcoin',
                            timeframe: '1d',
                            chartType: 'candlestick',
                            indicators: ['ema', 'volume']
                        }
                    },
                    {
                        type: 'news-widget',
                        containerId: 'widget-container-3',
                        config: {
                            limit: 5,
                            showImages: true,
                            categories: ['bitcoin', 'ethereum', 'defi']
                        }
                    },
                    {
                        type: 'fear-greed-widget',
                        containerId: 'widget-container-4',
                        config: {
                            showHistorical: true
                        }
                    },
                    {
                        type: 'alerts-widget',
                        containerId: 'widget-container-5',
                        config: {
                            limit: 5,
                            showActiveOnly: true
                        }
                    }
                ]
            },
            {
                id: 'senior',
                name: 'Dashboard Profesional',
                description: 'Configuración avanzada con herramientas de análisis detallado',
                userLevel: 'senior',
                widgets: [
                    {
                        type: 'price-widget',
                        containerId: 'widget-container-1',
                        config: {
                            coins: ['bitcoin', 'ethereum', 'cardano', 'solana', 'polkadot', 'avalanche', 'chainlink'],
                            showChange: true,
                            showVolume: true,
                            showMarketCap: true,
                            refreshInterval: 15000
                        }
                    },
                    {
                        type: 'chart-widget',
                        containerId: 'widget-container-2',
                        config: {
                            coin: 'bitcoin',
                            timeframe: '1d',
                            chartType: 'candlestick',
                            indicators: ['ema', 'macd', 'rsi', 'volume']
                        }
                    },
                    {
                        type: 'market-overview-widget',
                        containerId: 'widget-container-3',
                        config: {
                            showDominance: true,
                            showGainers: true,
                            showLosers: true
                        }
                    },
                    {
                        type: 'news-widget',
                        containerId: 'widget-container-4',
                        config: {
                            limit: 3,
                            showImages: true,
                            categories: ['bitcoin', 'ethereum', 'defi', 'nft']
                        }
                    },
                    {
                        type: 'onchain-widget',
                        containerId: 'widget-container-5',
                        config: {
                            metrics: ['transactions', 'fees', 'addresses']
                        }
                    },
                    {
                        type: 'alerts-widget',
                        containerId: 'widget-container-6',
                        config: {
                            limit: 5,
                            showActiveOnly: true
                        }
                    },
                    {
                        type: 'fear-greed-widget',
                        containerId: 'widget-container-7',
                        config: {
                            showHistorical: true,
                            showPrediction: true
                        }
                    },
                    {
                        type: 'portfolio-summary-widget',
                        containerId: 'widget-container-8',
                        config: {
                            showAllocation: true,
                            showPerformance: true
                        }
                    }
                ]
            }
        ];
        
        // Filtrar por nivel de usuario si se especifica
        return userLevel ? templates.filter(t => t.userLevel === userLevel) : templates;
    }
    
    /**
     * Exporta la configuración actual del dashboard
     * @returns {Object} - Objeto de configuración serializable
     */
    exportDashboardConfig() {
        return {
            widgets: Object.values(this.activeWidgets).map(widget => ({
                id: widget.id,
                type: widget.type,
                config: this._getSerializableConfig(widget.config)
            })),
            exportedAt: new Date().toISOString(),
            version: '1.0'
        };
    }
    
    /**
     * Importa una configuración de dashboard
     * @param {Object|string} config - Configuración a importar (objeto o JSON string)
     * @returns {boolean} - Éxito de la operación
     */
    importDashboardConfig(config) {
        try {
            // Convertir a objeto si es string
            const dashboardConfig = typeof config === 'string' ? JSON.parse(config) : config;
            
            // Validar configuración
            if (!dashboardConfig || !dashboardConfig.widgets || !Array.isArray(dashboardConfig.widgets)) {
                console.error('Formato de configuración inválido.');
                return false;
            }
            
            // Limpiar dashboard actual
            this.clearDashboard();
            
            // Recrear widgets desde la configuración
            dashboardConfig.widgets.forEach(widgetConfig => {
                if (widgetConfig.type && this.widgetTypes[widgetConfig.type]) {
                    this.createWidget(
                        widgetConfig.type,
                        widgetConfig.config,
                        widgetConfig.config.containerId
                    );
                } else {
                    console.warn(`Tipo de widget "${widgetConfig.type}" no disponible, se omitirá.`);
                }
            });
            
            // Guardar configuración
            if (this.options.autoSave) {
                this.saveDashboardConfig();
            }
            
            // Emitir evento de importación
            EventBus.publish('widgets.configImported', { config: dashboardConfig });
            
            return true;
        } catch (error) {
            console.error('Error al importar configuración del dashboard:', error);
            return false;
        }
    }
    
    /**
     * Actualiza los datos de un widget específico
     * @param {string} widgetId - ID del widget a actualizar
     * @returns {Promise<boolean>} - Éxito de la operación
     */
    async updateWidgetData(widgetId) {
        // Verificar si el widget existe
        if (!this.activeWidgets[widgetId]) {
            console.error(`Widget "${widgetId}" no encontrado.`);
            return false;
        }
        
        const widget = this.activeWidgets[widgetId];
        const typeDefinition = this.widgetTypes[widget.type];
        
        // Establecer estado de carga
        widget.state.isLoading = true;
        widget.state.hasError = false;
        widget.state.errorMessage = null;
        
        try {
            // Actualizar elemento DOM si existe
            const containerId = widget.config.containerId;
            if (containerId) {
                const container = document.getElementById(containerId);
                if (container) {
                    const widgetElement = container.querySelector(`[data-widget-id="${widgetId}"]`);
                    if (widgetElement) {
                        widgetElement.classList.add('widget-loading');
                    }
                }
            }
            
            // Obtener datos según el tipo de widget
            let widgetData;
            
            switch (widget.type) {
                case 'price-widget':
                    widgetData = await this._fetchPriceWidgetData(widget.config);
                    break;
                case 'chart-widget':
                    widgetData = await this._fetchChartWidgetData(widget.config);
                    break;
                case 'news-widget':
                    widgetData = await this._fetchNewsWidgetData(widget.config);
                    break;
                case 'alerts-widget':
                    widgetData = await this._fetchAlertsWidgetData(widget.config);
                    break;
                case 'fear-greed-widget':
                    widgetData = await this._fetchFearGreedWidgetData(widget.config);
                    break;
                case 'portfolio-summary-widget':
                    widgetData = await this._fetchPortfolioWidgetData(widget.config);
                    break;
                case 'market-overview-widget':
                    widgetData = await this._fetchMarketOverviewWidgetData(widget.config);
                    break;
                case 'onchain-widget':
                    widgetData = await this._fetchOnchainWidgetData(widget.config);
                    break;
                default:
                    // Si el tipo tiene un método de datos personalizado, usarlo
                    if (typeDefinition.fetchData && typeof typeDefinition.fetchData === 'function') {
                        widgetData = await typeDefinition.fetchData(widget.config);
                    } else {
                        throw new Error(`Tipo de widget "${widget.type}" no tiene método de obtención de datos.`);
                    }
            }
            
            // Actualizar estado
            widget.state.lastUpdated = new Date();
            widget.state.isLoading = false;
            widget.state.data = widgetData;
            
            // Re-renderizar widget con nuevos datos
            this._renderWidget(widgetId);
            
            return true;
        } catch (error) {
            console.error(`Error al actualizar datos del widget "${widgetId}":`, error);
            
            // Actualizar estado de error
            widget.state.isLoading = false;
            widget.state.hasError = true;
            widget.state.errorMessage = error.message;
            
            // Re-renderizar widget con estado de error
            this._renderWidget(widgetId);
            
            return false;
        }
    }
    
    /**
     * Actualiza los datos de todos los widgets activos
     * @returns {Promise<Object>} - Resultados de las actualizaciones
     */
    async updateAllWidgets() {
        const results = {
            total: Object.keys(this.activeWidgets).length,
            success: 0,
            failed: 0,
            widgetResults: {}
        };
        
        // Actualizar cada widget
        for (const widgetId of Object.keys(this.activeWidgets)) {
            const success = await this.updateWidgetData(widgetId);
            
            results.widgetResults[widgetId] = success;
            
            if (success) {
                results.success++;
            } else {
                results.failed++;
            }
        }
        
        // Emitir evento de actualización global
        EventBus.publish('widgets.allUpdated', results);
        
        return results;
    }
    
    // ===== MÉTODOS PRIVADOS =====
    
    /**
     * Registra los tipos de widgets predefinidos
     * @private
     */
    _registerPredefinedWidgetTypes() {
        // Widget de precios
        this.registerWidgetType('price-widget', {
            name: 'Precios en Tiempo Real',
            description: 'Muestra precios actualizados de criptomonedas seleccionadas',
            category: 'market',
            defaultSize: { width: 2, height: 2 },
            minSize: { width: 1, height: 1 },
            maxSize: { width: 4, height: 4 },
            refreshInterval: 30000, // 30 segundos
            configSchema: {
                coins: {
                    type: 'array',
                    required: true,
                    default: ['bitcoin', 'ethereum']
                },
                showChange: {
                    type: 'boolean',
                    default: true
                },
                showVolume: {
                    type: 'boolean',
                    default: false
                },
                showMarketCap: {
                    type: 'boolean',
                    default: false
                },
                refreshInterval: {
                    type: 'number',
                    default: 30000
                }
            },
            render: this._renderPriceWidget.bind(this)
        });
        
        // Widget de gráfico
        this.registerWidgetType('chart-widget', {
            name: 'Gráfico de Precios',
            description: 'Muestra un gráfico interactivo de precios con indicadores técnicos',
            category: 'chart',
            defaultSize: { width: 4, height: 3 },
            minSize: { width: 2, height: 2 },
            maxSize: { width: 6, height: 4 },
            refreshInterval: 60000, // 1 minuto
            configSchema: {
                coin: {
                    type: 'string',
                    required: true,
                    default: 'bitcoin'
                },
                timeframe: {
                    type: 'string',
                    default: '1d',
                    enum: ['1h', '4h', '1d', '1w', '1m']
                },
                chartType: {
                    type: 'string',
                    default: 'candlestick',
                    enum: ['line', 'candlestick', 'area']
                },
                indicators: {
                    type: 'array',
                    default: ['volume']
                }
            },
            render: this._renderChartWidget.bind(this)
        });
        
        // Widget de noticias
        this.registerWidgetType('news-widget', {
            name: 'Últimas Noticias',
            description: 'Muestra las noticias más recientes del mundo de las criptomonedas',
            category: 'news',
            defaultSize: { width: 3, height: 2 },
            minSize: { width: 2, height: 1 },
            maxSize: { width: 4, height: 6 },
            refreshInterval: 300000, // 5 minutos
            configSchema: {
                limit: {
                    type: 'number',
                    default: 5
                },
                showImages: {
                    type: 'boolean',
                    default: true
                },
                categories: {
                    type: 'array',
                    default: []
                }
            },
            render: this._renderNewsWidget.bind(this)
        });
        
        // Widget de alertas
        this.registerWidgetType('alerts-widget', {
            name: 'Mis Alertas',
            description: 'Muestra y gestiona tus alertas de precios configuradas',
            category: 'tools',
            defaultSize: { width: 2, height: 2 },
            minSize: { width: 1, height: 1 },
            maxSize: { width: 3, height: 4 },
            refreshInterval: 60000, // 1 minuto
            configSchema: {
                limit: {
                    type: 'number',
                    default: 5
                },
                showActiveOnly: {
                    type: 'boolean',
                    default: true
                }
            },
            render: this._renderAlertsWidget.bind(this)
        });
        
        // Widget de Índice de Miedo y Codicia
        this.registerWidgetType('fear-greed-widget', {
            name: 'Índice de Miedo y Codicia',
            description: 'Muestra el índice actual de miedo y codicia del mercado',
            category: 'sentiment',
            defaultSize: { width: 2, height: 1 },
            minSize: { width: 1, height: 1 },
            maxSize: { width: 3, height: 3 },
            refreshInterval: 3600000, // 1 hora
            configSchema: {
                showHistorical: {
                    type: 'boolean',
                    default: false
                },
                showPrediction: {
                    type: 'boolean',
                    default: false
                }
            },
            render: this._renderFearGreedWidget.bind(this)
        });
        
        // Widget de resumen de portfolio
        this.registerWidgetType('portfolio-summary-widget', {
            name: 'Resumen de Portfolio',
            description: 'Muestra un resumen de tu portfolio de criptomonedas',
            category: 'portfolio',
            defaultSize: { width: 3, height: 2 },
            minSize: { width: 2, height: 1 },
            maxSize: { width: 4, height: 4 },
            refreshInterval: 300000, // 5 minutos
            configSchema: {
                showAllocation: {
                    type: 'boolean',
                    default: true
                },
                showPerformance: {
                    type: 'boolean',
                    default: true
                }
            },
            render: this._renderPortfolioWidget.bind(this)
        });
        
        // Widget de visión general del mercado
        this.registerWidgetType('market-overview-widget', {
            name: 'Visión General del Mercado',
            description: 'Muestra estadísticas generales del mercado de criptomonedas',
            category: 'market',
            defaultSize: { width: 4, height: 2 },
            minSize: { width: 2, height: 1 },
            maxSize: { width: 6, height: 3 },
            refreshInterval: 300000, // 5 minutos
            configSchema: {
                showDominance: {
                    type: 'boolean',
                    default: true
                },
                showGainers: {
                    type: 'boolean',
                    default: true
                },
                showLosers: {
                    type: 'boolean',
                    default: true
                }
            },
            render: this._renderMarketOverviewWidget.bind(this)
        });
        
        // Widget de métricas on-chain
        this.registerWidgetType('onchain-widget', {
            name: 'Métricas On-Chain',
            description: 'Muestra indicadores on-chain para análisis avanzado',
            category: 'analysis',
            defaultSize: { width: 3, height: 2 },
            minSize: { width: 2, height: 1 },
            maxSize: { width: 4, height: 4 },
            refreshInterval: 1800000, // 30 minutos
            configSchema: {
                metrics: {
                    type: 'array',
                    default: ['transactions', 'fees', 'addresses']
                }
            },
            render: this._renderOnchainWidget.bind(this)
        });
    }
    
    /**
     * Configura escuchadores de eventos
     * @private
     */
    _setupEventListeners() {
        // Escuchar eventos relevantes del sistema
        EventBus.subscribe('auth.userLoggedIn', this._handleUserLogin.bind(this));
        EventBus.subscribe('auth.userLoggedOut', this._handleUserLogout.bind(this));
        EventBus.subscribe('market.priceUpdate', this._handleMarketPriceUpdate.bind(this));
        EventBus.subscribe('news.updated', this._handleNewsUpdate.bind(this));
        EventBus.subscribe('alerts.triggered', this._handleAlertTriggered.bind(this));
        
        // Escuchar evento de cambio de tema
        EventBus.subscribe('theme.changed', this._handleThemeChange.bind(this));
    }
    
    /**
     * Valida la definición de un tipo de widget
     * @param {Object} definition - Definición a validar
     * @returns {boolean} - Validez de la definición
     * @private
     */
    _validateWidgetTypeDefinition(definition) {
        // Verificar campos obligatorios
        const requiredFields = ['name', 'description', 'render'];
        for (const field of requiredFields) {
            if (!definition[field]) {
                console.error(`Falta el campo obligatorio "${field}" en la definición del widget.`);
                return false;
            }
        }
        
        // Verificar que render sea una función
        if (typeof definition.render !== 'function') {
            console.error('El método "render" debe ser una función.');
            return false;
        }
        
        return true;
    }
    
    /**
     * Obtiene la configuración por defecto de un tipo de widget
     * @param {Object} typeDefinition - Definición del tipo
     * @returns {Object} - Configuración por defecto
     * @private
     */
    _getDefaultConfig(typeDefinition) {
        const defaultConfig = {};
        
        // Si no tiene esquema de configuración, devolver objeto vacío
        if (!typeDefinition.configSchema) {
            return defaultConfig;
        }
        
        // Recorrer campos del esquema
        for (const [key, schema] of Object.entries(typeDefinition.configSchema)) {
            // Si tiene valor por defecto, usarlo
            if ('default' in schema) {
                defaultConfig[key] = schema.default;
            }
        }
        
        // Añadir tamaño por defecto
        if (typeDefinition.defaultSize) {
            defaultConfig.size = { ...typeDefinition.defaultSize };
        }
        
        return defaultConfig;
    }
    
    /**
     * Valida la configuración de un widget
     * @param {Object} typeDefinition - Definición del tipo
     * @param {Object} config - Configuración a validar
     * @returns {boolean} - Validez de la configuración
     * @private
     */
    _validateWidgetConfig(typeDefinition, config) {
        // Si no tiene esquema de configuración, considerar válido
        if (!typeDefinition.configSchema) {
            return true;
        }
        
        // Verificar campos obligatorios
        for (const [key, schema] of Object.entries(typeDefinition.configSchema)) {
            if (schema.required && !(key in config)) {
                console.error(`Falta el campo obligatorio "${key}" en la configuración.`);
                return false;
            }
            
            // Si el campo está presente, validar tipo
            if (key in config) {
                const value = config[key];
                
                // Validar tipo
                if (schema.type === 'array' && !Array.isArray(value)) {
                    console.error(`El campo "${key}" debe ser un array.`);
                    return false;
                } else if (schema.type !== 'array' && typeof value !== schema.type) {
                    console.error(`El campo "${key}" debe ser de tipo ${schema.type}.`);
                    return false;
                }
                
                // Validar enumeración si existe
                if (schema.enum && !schema.enum.includes(value)) {
                    console.error(`El valor "${value}" no es válido para el campo "${key}". Valores permitidos: ${schema.enum.join(', ')}.`);
                    return false;
                }
            }
        }
        
        return true;
    }
    
    /**
     * Renderiza un widget en su contenedor
     * @param {string} widgetId - ID del widget a renderizar
     * @private
     */
    _renderWidget(widgetId) {
        const widget = this.activeWidgets[widgetId];
        if (!widget) return;
        
        const typeDefinition = this.widgetTypes[widget.type];
        if (!typeDefinition) return;
        
        const containerId = widget.config.containerId;
        if (!containerId) return;
        
        // Obtener contenedor
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Contenedor "${containerId}" no encontrado.`);
            return;
        }
        
        // Buscar si ya existe el widget en el contenedor
        let widgetElement = container.querySelector(`[data-widget-id="${widgetId}"]`);
        
        // Si no existe, crear elemento contenedor para el widget
        if (!widgetElement) {
            widgetElement = document.createElement('div');
            widgetElement.className = 'widget';
            widgetElement.setAttribute('data-widget-id', widgetId);
            widgetElement.setAttribute('data-widget-type', widget.type);
            container.appendChild(widgetElement);
        }
        
        // Actualizar clases según estado
        widgetElement.classList.toggle('widget-loading', widget.state.isLoading);
        widgetElement.classList.toggle('widget-error', widget.state.hasError);
        
        // Renderizar contenido del widget usando la función de renderizado del tipo
        try {
            typeDefinition.render(widgetElement, widget.config, widget.state);
        } catch (error) {
            console.error(`Error al renderizar widget "${widgetId}":`, error);
            
            // Mostrar mensaje de error
            widgetElement.innerHTML = `
                <div class="widget-error-content">
                    <div class="widget-error-icon"><i class="icon-alert-triangle"></i></div>
                    <div class="widget-error-message">Error al renderizar widget: ${error.message}</div>
                </div>
            `;
        }
    }
    
    /**
     * Configura actualizaciones automáticas para un widget
     * @param {string} widgetId - ID del widget
     * @private
     */
    _setupWidgetUpdates(widgetId) {
        const widget = this.activeWidgets[widgetId];
        if (!widget) return;
        
        const typeDefinition = this.widgetTypes[widget.type];
        if (!typeDefinition) return;
        
        // Cancelar intervalo existente si hay
        if (this.updateIntervals[widgetId]) {
            clearInterval(this.updateIntervals[widgetId]);
            delete this.updateIntervals[widgetId];
        }
        
        // Determinar intervalo de actualización
        let updateInterval = this.options.updateInterval; // Intervalo por defecto
        
        // Usar intervalo del tipo si está definido
        if (typeDefinition.refreshInterval) {
            updateInterval = typeDefinition.refreshInterval;
        }
        
        // La configuración del widget tiene prioridad si está definida
        if (widget.config.refreshInterval) {
            updateInterval = widget.config.refreshInterval;
        }
        
        // Si el intervalo es 0 o negativo, no configurar actualización automática
        if (updateInterval <= 0) return;
        
        // Configurar nuevo intervalo
        this.updateIntervals[widgetId] = setInterval(() => {
            this.updateWidgetData(widgetId).catch(error => {
                console.error(`Error en actualización automática de widget "${widgetId}":`, error);
            });
        }, updateInterval);
    }
    
    /**
     * Obtiene una configuración serializable del widget (sin funciones ni referencias circulares)
     * @param {Object} config - Configuración original
     * @returns {Object} - Configuración serializable
     * @private
     */
    _getSerializableConfig(config) {
        // Crear copia simple del objeto
        const result = { ...config };
        
        // Eliminar propiedades no serializables
        Object.keys(result).forEach(key => {
            const value = result[key];
            
            // Eliminar funciones
            if (typeof value === 'function') {
                delete result[key];
            }
            
            // Eliminar referencias a elementos DOM
            else if (value instanceof Element || value instanceof HTMLElement) {
                delete result[key];
            }
            
            // Procesar objetos anidados
            else if (typeof value === 'object' && value !== null) {
                result[key] = this._getSerializableConfig(value);
            }
        });
        
        return result;
    }
    
    // ===== MANEJADORES DE EVENTOS =====
    
    /**
     * Maneja el evento de inicio de sesión de usuario
     * @param {Object} data - Datos del evento
     * @private
     */
    _handleUserLogin(data) {
        console.log('Usuario ha iniciado sesión, cargando dashboard personalizado...');
        this.loadDashboardConfig();
    }
    
    /**
     * Maneja el evento de cierre de sesión de usuario
     * @param {Object} data - Datos del evento
     * @private
     */
    _handleUserLogout(data) {
        console.log('Usuario ha cerrado sesión, limpiando dashboard...');
        this.clearDashboard();
    }
    
    /**
     * Maneja actualizaciones de precios del mercado
     * @param {Object} data - Datos del evento
     * @private
     */
    _handleMarketPriceUpdate(data) {
        // Actualizar widgets de precio que incluyan esta moneda
        Object.values(this.activeWidgets).forEach(widget => {
            if (widget.type === 'price-widget' && 
                widget.config.coins && 
                widget.config.coins.includes(data.coin)) {
                
                // Actualizar datos sin rerenderizar completamente
                this._updateWidgetPriceData(widget.id, data);
            }
        });
    }
    
    /**
     * Maneja actualizaciones de noticias
     * @param {Object} data - Datos del evento
     * @private
     */
    _handleNewsUpdate(data) {
        // Actualizar widgets de noticias
        Object.values(this.activeWidgets).forEach(widget => {
            if (widget.type === 'news-widget') {
                this.updateWidgetData(widget.id);
            }
        });
    }
    
    /**
     * Maneja alertas activadas
     * @param {Object} data - Datos del evento
     * @private
     */
    _handleAlertTriggered(data) {
        // Actualizar widgets de alertas
        Object.values(this.activeWidgets).forEach(widget => {
            if (widget.type === 'alerts-widget') {
                this.updateWidgetData(widget.id);
            }
        });
    }
    
    /**
     * Maneja cambios de tema
     * @param {Object} data - Datos del evento
     * @private
     */
    _handleThemeChange(data) {
        // Actualizar todos los widgets para aplicar nuevo tema
        Object.keys(this.activeWidgets).forEach(widgetId => {
            this._renderWidget(widgetId);
        });
    }
    
    // ===== MÉTODOS DE ACTUALIZACIÓN DE DATOS =====
    
    /**
     * Obtiene datos para widget de precios
     * @param {Object} config - Configuración del widget
     * @returns {Promise<Object>} - Datos obtenidos
     * @private
     */
    async _fetchPriceWidgetData(config) {
        const coins = config.coins || ['bitcoin', 'ethereum'];
        
        try {
            // Obtener precios desde el servicio de datos de mercado
            const pricesData = await this.marketDataService.getPrices(coins);
            
            // Formatear respuesta
            return {
                prices: pricesData,
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error al obtener datos de precios:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene datos para widget de gráfico
     * @param {Object} config - Configuración del widget
     * @returns {Promise<Object>} - Datos obtenidos
     * @private
     */
    async _fetchChartWidgetData(config) {
        const coin = config.coin || 'bitcoin';
        const timeframe = config.timeframe || '1d';
        
        try {
            // Obtener datos históricos desde el servicio de datos de mercado
            const chartData = await this.marketDataService.getHistoricalData(coin, timeframe);
            
            // Formatear respuesta
            return {
                coin,
                timeframe,
                ohlcv: chartData,
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error al obtener datos de gráfico:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene datos para widget de noticias
     * @param {Object} config - Configuración del widget
     * @returns {Promise<Object>} - Datos obtenidos
     * @private
     */
    async _fetchNewsWidgetData(config) {
        const limit = config.limit || 5;
        const categories = config.categories || [];
        
        try {
            // Obtener noticias desde el servicio de noticias
            const newsData = await this.newsService.getLatestNews({ 
                limit, 
                categories
            });
            
            // Formatear respuesta
            return {
                news: newsData,
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error al obtener noticias:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene datos para widget de alertas
     * @param {Object} config - Configuración del widget
     * @returns {Promise<Object>} - Datos obtenidos
     * @private
     */
    async _fetchAlertsWidgetData(config) {
        const limit = config.limit || 5;
        const showActiveOnly = config.showActiveOnly !== undefined ? config.showActiveOnly : true;
        
        try {
            // Obtener alertas desde el servicio de alertas
            const alertsData = await this.alertsService.getUserAlerts({
                limit,
                activeOnly: showActiveOnly
            });
            
            // Formatear respuesta
            return {
                alerts: alertsData,
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error al obtener alertas:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene datos para widget de índice de miedo y codicia
     * @param {Object} config - Configuración del widget
     * @returns {Promise<Object>} - Datos obtenidos
     * @private
     */
    async _fetchFearGreedWidgetData(config) {
        const showHistorical = config.showHistorical !== undefined ? config.showHistorical : false;
        
        try {
            // Datos a obtener
            let fgiData = { value: 0, classification: '', timestamp: null };
            let historicalData = null;
            
            // Obtener índice actual
            fgiData = await this.marketDataService.getFearGreedIndex();
            
            // Obtener datos históricos si se solicitan
            if (showHistorical) {
                historicalData = await this.marketDataService.getHistoricalFearGreedIndex(30); // 30 días
            }
            
            // Formatear respuesta
            return {
                current: fgiData,
                historical: historicalData,
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error al obtener índice de miedo y codicia:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene datos para widget de portfolio
     * @param {Object} config - Configuración del widget
     * @returns {Promise<Object>} - Datos obtenidos
     * @private
     */
    async _fetchPortfolioWidgetData(config) {
        // Este método requeriría un servicio de portfolio, que no está disponible en este ejemplo
        // Simulamos una respuesta
        
        // Formatear respuesta ficticia
        return {
            totalValue: 12458.34,
            change24h: {
                value: 324.56,
                percentage: 2.67
            },
            allocation: [
                { coin: 'bitcoin', symbol: 'BTC', percentage: 45, value: 5606.25 },
                { coin: 'ethereum', symbol: 'ETH', percentage: 30, value: 3737.50 },
                { coin: 'cardano', symbol: 'ADA', percentage: 15, value: 1868.75 },
                { coin: 'others', symbol: 'OTROS', percentage: 10, value: 1245.84 }
            ],
            performance: {
                day: 2.67,
                week: -3.21,
                month: 8.67,
                year: 54.32
            },
            lastUpdated: new Date()
        };
    }
    
    /**
     * Obtiene datos para widget de visión general del mercado
     * @param {Object} config - Configuración del widget
     * @returns {Promise<Object>} - Datos obtenidos
     * @private
     */
    async _fetchMarketOverviewWidgetData(config) {
        try {
            // Obtener datos de mercado global
            const marketData = await this.marketDataService.getMarketOverview();
            
            // Obtener gainers y losers si se solicitan
            let gainersData = [];
            let losersData = [];
            
            if (config.showGainers || config.showLosers) {
                const topMovers = await this.marketDataService.getTopMovers();
                
                if (config.showGainers) {
                    gainersData = topMovers.gainers || [];
                }
                
                if (config.showLosers) {
                    losersData = topMovers.losers || [];
                }
            }
            
            // Formatear respuesta
            return {
                marketCap: marketData.totalMarketCap,
                volume24h: marketData.total24hVolume,
                btcDominance: marketData.btcDominance,
                gainers: gainersData,
                losers: losersData,
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error al obtener visión general del mercado:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene datos para widget de métricas on-chain
     * @param {Object} config - Configuración del widget
     * @returns {Promise<Object>} - Datos obtenidos
     * @private
     */
    async _fetchOnchainWidgetData(config) {
        const metrics = config.metrics || ['transactions', 'fees', 'addresses'];
        const coin = config.coin || 'bitcoin';
        
        try {
            // Este método requeriría un servicio de datos on-chain, que no está disponible en este ejemplo
            // Simulamos una respuesta
            
            // Formatear respuesta ficticia
            return {
                coin,
                metrics: {
                    transactions: {
                        value: 283546,
                        change24h: 2.4
                    },
                    fees: {
                        value: 25.6,
                        change24h: 3.8
                    },
                    addresses: {
                        value: 38245921,
                        change24h: 0.8
                    }
                },
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error al obtener métricas on-chain:', error);
            throw error;
        }
    }
    
    /**
     * Actualiza datos de precio en widget sin rerenderizar
     * @param {string} widgetId - ID del widget
     * @param {Object} priceData - Datos de precio actualizados
     * @private
     */
    _updateWidgetPriceData(widgetId, priceData) {
        const widget = this.activeWidgets[widgetId];
        if (!widget) return;
        
        const containerId = widget.config.containerId;
        if (!containerId) return;
        
        // Obtener contenedor
        const container = document.getElementById(containerId);
        if (!container) return;
        
        // Buscar elemento del widget
        const widgetElement = container.querySelector(`[data-widget-id="${widgetId}"]`);
        if (!widgetElement) return;
        
        // Buscar elemento de precio para esta moneda
        const priceElement = widgetElement.querySelector(`[data-coin="${priceData.coin}"]`);
        if (!priceElement) return;
        
        // Actualizar precio
        const priceValueElement = priceElement.querySelector('.price-value');
        if (priceValueElement) {
            priceValueElement.textContent = priceData.formattedPrice || `$${priceData.price.toLocaleString()}`;
        }
        
        // Actualizar cambio porcentual
        const changeElement = priceElement.querySelector('.price-change');
        if (changeElement) {
            // Actualizar valor
            changeElement.textContent = priceData.formattedChange || `${priceData.change > 0 ? '+' : ''}${priceData.change.toFixed(2)}%`;
            
            // Actualizar clase según el valor
            changeElement.classList.remove('positive', 'negative');
            changeElement.classList.add(priceData.change >= 0 ? 'positive' : 'negative');
        }
    }
    
    // ===== MÉTODOS DE RENDERIZADO DE WIDGETS =====
    
    /**
     * Renderiza widget de precios
     * @param {HTMLElement} container - Contenedor del widget
     * @param {Object} config - Configuración del widget
     * @param {Object} state - Estado del widget
     * @private
     */
    _renderPriceWidget(container, config, state) {
        // Si no hay datos o hay error, mostrar estado correspondiente
        if (state.hasError) {
            container.innerHTML = `
                <div class="widget-header">
                    <h3 class="widget-title">Precios en Tiempo Real</h3>
                    <div class="widget-actions">
                        <button class="widget-refresh-btn" title="Actualizar">
                            <i class="icon-refresh-cw"></i>
                        </button>
                    </div>
                </div>
                <div class="widget-error-content">
                    <div class="widget-error-icon"><i class="icon-alert-triangle"></i></div>
                    <div class="widget-error-message">${state.errorMessage || 'Error al cargar datos'}</div>
                </div>
            `;
            return;
        }
        
        // Si está cargando y no hay datos previos
        if (state.isLoading && !state.data) {
            container.innerHTML = `
                <div class="widget-header">
                    <h3 class="widget-title">Precios en Tiempo Real</h3>
                </div>
                <div class="widget-loading-content">
                    <div class="widget-spinner"></div>
                    <div class="widget-loading-text">Cargando precios...</div>
                </div>
            `;
            return;
        }
        
        // Preparar datos
        const prices = state.data?.prices || [];
        
        // Renderizar widget
        container.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Precios en Tiempo Real</h3>
                <div class="widget-actions">
                    <button class="widget-refresh-btn" title="Actualizar">
                        <i class="icon-refresh-cw"></i>
                    </button>
                </div>
            </div>
            <div class="widget-content">
                <div class="price-list">
                    ${prices.length === 0 ? `
                        <div class="no-data-message">
                            No hay datos disponibles
                        </div>
                    ` : ''}
                    
                    ${prices.map(coin => `
                        <div class="price-item" data-coin="${coin.id}">
                            <div class="price-coin">
                                <img src="assets/images/crypto/${coin.id}.svg" alt="${coin.name}" class="coin-icon">
                                <div class="coin-info">
                                    <div class="coin-name">${coin.name}</div>
                                    <div class="coin-symbol">${coin.symbol}</div>
                                </div>
                            </div>
                            <div class="price-data">
                                <div class="price-value">$${coin.price.toLocaleString('en-US', { 
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: coin.price >= 1 ? 2 : 8
                                })}</div>
                                ${config.showChange ? `
                                    <div class="price-change ${coin.change24h >= 0 ? 'positive' : 'negative'}">
                                        ${coin.change24h >= 0 ? '+' : ''}${coin.change24h.toFixed(2)}%
                                    </div>
                                ` : ''}
                            </div>
                            ${config.showVolume || config.showMarketCap ? `
                                <div class="price-details">
                                    ${config.showVolume ? `
                                        <div class="detail-item">
                                            <span class="detail-label">Vol 24h:</span>
                                            <span class="detail-value">$${(coin.volume24h/1000000).toFixed(2)}M</span>
                                        </div>
                                    ` : ''}
                                    ${config.showMarketCap ? `
                                        <div class="detail-item">
                                            <span class="detail-label">Cap. Mercado:</span>
                                            <span class="detail-value">$${(coin.marketCap/1000000000).toFixed(2)}B</span>
                                        </div>
                                    ` : ''}
                                </div>
                            ` : ''}
                        </div>
                    `).join('')}
                </div>
                ${state.data ? `
                    <div class="widget-footer">
                        <div class="last-updated">
                            Actualizado: ${new Date(state.data.lastUpdated).toLocaleTimeString()}
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Añadir listener al botón de actualización
        const refreshBtn = container.querySelector('.widget-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const widgetId = container.getAttribute('data-widget-id');
                if (widgetId) {
                    this.updateWidgetData(widgetId);
                }
            });
        }
    }
    
    /**
     * Renderiza widget de gráfico
     * @param {HTMLElement} container - Contenedor del widget
     * @param {Object} config - Configuración del widget
     * @param {Object} state - Estado del widget
     * @private
     */
    _renderChartWidget(container, config, state) {
        // Código simplificado de renderizado de gráfico
        // En una implementación real, aquí se utilizaría una biblioteca como Chart.js, Highcharts o D3.js
        
        container.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Gráfico de ${config.coin.charAt(0).toUpperCase() + config.coin.slice(1)}</h3>
                <div class="widget-actions">
                    <div class="timeframe-selector">
                        <button class="timeframe-btn ${config.timeframe === '1h' ? 'active' : ''}" data-timeframe="1h">1H</button>
                        <button class="timeframe-btn ${config.timeframe === '4h' ? 'active' : ''}" data-timeframe="4h">4H</button>
                        <button class="timeframe-btn ${config.timeframe === '1d' ? 'active' : ''}" data-timeframe="1d">1D</button>
                        <button class="timeframe-btn ${config.timeframe === '1w' ? 'active' : ''}" data-timeframe="1w">1S</button>
                        <button class="timeframe-btn ${config.timeframe === '1m' ? 'active' : ''}" data-timeframe="1m">1M</button>
                    </div>
                    <button class="widget-refresh-btn" title="Actualizar">
                        <i class="icon-refresh-cw"></i>
                    </button>
                </div>
            </div>
            <div class="widget-content">
                ${state.hasError ? `
                    <div class="widget-error-content">
                        <div class="widget-error-icon"><i class="icon-alert-triangle"></i></div>
                        <div class="widget-error-message">${state.errorMessage || 'Error al cargar datos'}</div>
                    </div>
                ` : state.isLoading && !state.data ? `
                    <div class="widget-loading-content">
                        <div class="widget-spinner"></div>
                        <div class="widget-loading-text">Cargando gráfico...</div>
                    </div>
                ` : `
                    <div class="chart-container" id="chart-${container.getAttribute('data-widget-id')}">
                        <div class="chart-placeholder">
                            <p>Gráfico de ${config.coin} (${config.timeframe})</p>
                            <p>Tipo: ${config.chartType}</p>
                            <p>Indicadores: ${config.indicators ? config.indicators.join(', ') : 'ninguno'}</p>
                            <p class="chart-note">Nota: En una implementación real, aquí se renderizaría un gráfico interactivo utilizando Chart.js, Highcharts o D3.js</p>
                        </div>
                    </div>
                    ${state.data ? `
                        <div class="widget-footer">
                            <div class="last-updated">
                                Actualizado: ${new Date(state.data.lastUpdated).toLocaleTimeString()}
                            </div>
                        </div>
                    ` : ''}
                `}
            </div>
        `;
        
        // Añadir listeners
        const widgetId = container.getAttribute('data-widget-id');
        
        // Listener para botón de actualización
        const refreshBtn = container.querySelector('.widget-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (widgetId) {
                    this.updateWidgetData(widgetId);
                }
            });
        }
        
        // Listeners para botones de timeframe
        const timeframeBtns = container.querySelectorAll('.timeframe-btn');
        timeframeBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const timeframe = btn.getAttribute('data-timeframe');
                if (timeframe && widgetId) {
                    // Actualizar configuración del widget
                    this.updateWidgetConfig(widgetId, { timeframe });
                }
            });
        });
    }
    
    /**
     * Renderiza widget de noticias
     * @param {HTMLElement} container - Contenedor del widget
     * @param {Object} config - Configuración del widget
     * @param {Object} state - Estado del widget
     * @private
     */
    _renderNewsWidget(container, config, state) {
        // Código simplificado de renderizado de noticias
        container.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Últimas Noticias</h3>
                <div class="widget-actions">
                    <button class="widget-refresh-btn" title="Actualizar">
                        <i class="icon-refresh-cw"></i>
                    </button>
                </div>
            </div>
            <div class="widget-content">
                ${state.hasError ? `
                    <div class="widget-error-content">
                        <div class="widget-error-icon"><i class="icon-alert-triangle"></i></div>
                        <div class="widget-error-message">${state.errorMessage || 'Error al cargar noticias'}</div>
                    </div>
                ` : state.isLoading && !state.data ? `
                    <div class="widget-loading-content">
                        <div class="widget-spinner"></div>
                        <div class="widget-loading-text">Cargando noticias...</div>
                    </div>
                ` : `
                    <div class="news-list">
                        ${!state.data || !state.data.news || state.data.news.length === 0 ? `
                            <div class="no-data-message">
                                No hay noticias disponibles
                            </div>
                        ` : ''}
                        
                        ${state.data && state.data.news ? state.data.news.map(news => `
                            <a href="${news.url}" class="news-item" target="_blank">
                                ${config.showImages && news.imageUrl ? `
                                    <div class="news-image">
                                        <img src="${news.imageUrl}" alt="${news.title}" class="news-img">
                                    </div>
                                ` : ''}
                                <div class="news-content">
                                    <div class="news-title">${news.title}</div>
                                    <div class="news-meta">
                                        <span class="news-source">${news.source}</span>
                                        <span class="news-date">${news.formattedDate || news.date}</span>
                                    </div>
                                </div>
                            </a>
                        `).join('') : ''}
                    </div>
                    ${state.data ? `
                        <div class="widget-footer">
                            <a href="/noticias" class="btn-link">Ver todas las noticias</a>
                            <div class="last-updated">
                                Actualizado: ${new Date(state.data.lastUpdated).toLocaleTimeString()}
                            </div>
                        </div>
                    ` : ''}
                `}
            </div>
        `;
        
        // Añadir listener al botón de actualización
        const refreshBtn = container.querySelector('.widget-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const widgetId = container.getAttribute('data-widget-id');
                if (widgetId) {
                    this.updateWidgetData(widgetId);
                }
            });
        }
    }
    
    /**
     * Renderiza widget de alertas
     * @param {HTMLElement} container - Contenedor del widget
     * @param {Object} config - Configuración del widget
     * @param {Object} state - Estado del widget
     * @private
     */
    _renderAlertsWidget(container, config, state) {
        container.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Mis Alertas</h3>
                <div class="widget-actions">
                    <button class="widget-action-btn" title="Añadir Alerta">
                        <i class="icon-plus"></i>
                    </button>
                    <button class="widget-refresh-btn" title="Actualizar">
                        <i class="icon-refresh-cw"></i>
                    </button>
                </div>
            </div>
            <div class="widget-content">
                ${state.hasError ? `
                    <div class="widget-error-content">
                        <div class="widget-error-icon"><i class="icon-alert-triangle"></i></div>
                        <div class="widget-error-message">${state.errorMessage || 'Error al cargar alertas'}</div>
                    </div>
                ` : state.isLoading && !state.data ? `
                    <div class="widget-loading-content">
                        <div class="widget-spinner"></div>
                        <div class="widget-loading-text">Cargando alertas...</div>
                    </div>
                ` : `
                    <div class="alerts-list">
                        ${!state.data || !state.data.alerts || state.data.alerts.length === 0 ? `
                            <div class="no-data-message">
                                <p>No tienes alertas configuradas</p>
                                <button class="btn btn-sm btn-outline">
                                    <i class="icon-plus"></i> Crear Alerta
                                </button>
                            </div>
                        ` : ''}
                        
                        ${state.data && state.data.alerts ? state.data.alerts.map(alert => `
                            <div class="alert-item ${alert.isActive ? 'active' : 'inactive'}">
                                <div class="alert-icon">
                                    <i class="icon-${alert.type === 'price_above' ? 'trending-up' : 'trending-down'}"></i>
                                </div>
                                <div class="alert-content">
                                    <div class="alert-title">
                                        <img src="assets/images/crypto/${alert.coin}.svg" alt="${alert.coin}" class="coin-icon-sm">
                                        ${alert.title || `${alert.coin.toUpperCase()} ${alert.type === 'price_above' ? 'por encima de' : 'por debajo de'} $${alert.targetPrice}`}
                                    </div>
                                    <div class="alert-details">
                                        <div class="alert-target">Objetivo: $${alert.targetPrice}</div>
                                        <div class="alert-current">Actual: $${alert.currentPrice}</div>
                                    </div>
                                </div>
                                <div class="alert-actions">
                                    <button class="btn-icon btn-sm" title="Editar">
                                        <i class="icon-edit-2"></i>
                                    </button>
                                    <button class="btn-icon btn-sm" title="Eliminar">
                                        <i class="icon-trash-2"></i>
                                    </button>
                                </div>
                            </div>
                        `).join('') : ''}
                    </div>
                    ${state.data ? `
                        <div class="widget-footer">
                            <a href="/herramientas/alertas" class="btn-link">Gestionar alertas</a>
                            <div class="last-updated">
                                Actualizado: ${new Date(state.data.lastUpdated).toLocaleTimeString()}
                            </div>
                        </div>
                    ` : ''}
                `}
            </div>
        `;
        
        // Añadir listeners
        const widgetId = container.getAttribute('data-widget-id');
        
        // Listener para botón de actualización
        const refreshBtn = container.querySelector('.widget-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (widgetId) {
                    this.updateWidgetData(widgetId);
                }
            });
        }
        
        // Listener para botón de nueva alerta
        const newAlertBtn = container.querySelector('.widget-action-btn');
        if (newAlertBtn) {
            newAlertBtn.addEventListener('click', () => {
                // En una implementación real, esto abriría un modal para crear una alerta
                EventBus.publish('alerts.createNew');
            });
        }
    }
    
    /**
     * Renderiza widget de índice de miedo y codicia
     * @param {HTMLElement} container - Contenedor del widget
     * @param {Object} config - Configuración del widget
     * @param {Object} state - Estado del widget
     * @private
     */
    _renderFearGreedWidget(container, config, state) {
        // Función para determinar la clase CSS según el valor del índice
        const getFGIClass = (value) => {
            if (value <= 25) return 'extreme-fear';
            if (value <= 40) return 'fear';
            if (value <= 60) return 'neutral';
            if (value <= 80) return 'greed';
            return 'extreme-greed';
        };
        
        // Función para obtener la etiqueta según el valor
        const getFGILabel = (value) => {
            if (value <= 25) return 'Miedo Extremo';
            if (value <= 40) return 'Miedo';
            if (value <= 60) return 'Neutral';
            if (value <= 80) return 'Codicia';
            return 'Codicia Extrema';
        };
        
        // Renderizar widget
        container.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Índice de Miedo y Codicia</h3>
                <div class="widget-actions">
                    <button class="widget-refresh-btn" title="Actualizar">
                        <i class="icon-refresh-cw"></i>
                    </button>
                </div>
            </div>
            <div class="widget-content">
                ${state.hasError ? `
                    <div class="widget-error-content">
                        <div class="widget-error-icon"><i class="icon-alert-triangle"></i></div>
                        <div class="widget-error-message">${state.errorMessage || 'Error al cargar datos'}</div>
                    </div>
                ` : state.isLoading && !state.data ? `
                    <div class="widget-loading-content">
                        <div class="widget-spinner"></div>
                        <div class="widget-loading-text">Cargando índice...</div>
                    </div>
                ` : state.data && state.data.current ? `
                    <div class="fear-greed-container">
                        <div class="fear-greed-value ${getFGIClass(state.data.current.value)}">
                            ${state.data.current.value}
                        </div>
                        <div class="fear-greed-label">
                            ${getFGILabel(state.data.current.value)}
                        </div>
                        <div class="fear-greed-meter">
                            <div class="meter-scale">
                                <div class="meter-section extreme-fear">Miedo Extremo</div>
                                <div class="meter-section fear">Miedo</div>
                                <div class="meter-section neutral">Neutral</div>
                                <div class="meter-section greed">Codicia</div>
                                <div class="meter-section extreme-greed">Codicia Extrema</div>
                                <div class="meter-indicator" style="left: ${state.data.current.value}%;"></div>
                            </div>
                        </div>
                        ${config.showHistorical && state.data.historical ? `
                            <div class="historical-chart">
                                <div class="chart-placeholder">
                                    <p>Histórico del Índice (30 días)</p>
                                    <p class="chart-note">En una implementación real, aquí se mostraría un gráfico histórico</p>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="widget-footer">
                        <a href="/herramientas/miedo-codicia" class="btn-link">Ver análisis completo</a>
                        <div class="last-updated">
                            Actualizado: ${new Date(state.data.lastUpdated).toLocaleTimeString()}
                        </div>
                    </div>
                ` : `
                    <div class="no-data-message">
                        No hay datos disponibles
                    </div>
                `}
            </div>
        `;
        
        // Añadir listener al botón de actualización
        const refreshBtn = container.querySelector('.widget-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const widgetId = container.getAttribute('data-widget-id');
                if (widgetId) {
                    this.updateWidgetData(widgetId);
                }
            });
        }
    }
    
    /**
     * Renderiza widget de resumen de portfolio
     * @param {HTMLElement} container - Contenedor del widget
     * @param {Object} config - Configuración del widget
     * @param {Object} state - Estado del widget
     * @private
     */
    _renderPortfolioWidget(container, config, state) {
        // Código simplificado para renderizar el widget de portfolio
        container.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Mi Portfolio</h3>
                <div class="widget-actions">
                    <button class="widget-action-btn" title="Añadir Activo">
                        <i class="icon-plus"></i>
                    </button>
                    <button class="widget-refresh-btn" title="Actualizar">
                        <i class="icon-refresh-cw"></i>
                    </button>
                </div>
            </div>
            <div class="widget-content">
                ${state.hasError ? `
                    <div class="widget-error-content">
                        <div class="widget-error-icon"><i class="icon-alert-triangle"></i></div>
                        <div class="widget-error-message">${state.errorMessage || 'Error al cargar portfolio'}</div>
                    </div>
                ` : state.isLoading && !state.data ? `
                    <div class="widget-loading-content">
                        <div class="widget-spinner"></div>
                        <div class="widget-loading-text">Cargando portfolio...</div>
                    </div>
                ` : !state.data ? `
                    <div class="no-data-message">
                        <p>No hay datos de portfolio disponibles</p>
                        <button class="btn btn-sm btn-outline">
                            <i class="icon-plus"></i> Añadir Activo
                        </button>
                    </div>
                ` : `
                    <div class="portfolio-summary">
                        <div class="total-value">
                            <div class="value-label">Valor Total</div>
                            <div class="value-amount">$${state.data.totalValue.toLocaleString()}</div>
                            <div class="value-change ${state.data.change24h.value >= 0 ? 'positive' : 'negative'}">
                                ${state.data.change24h.value >= 0 ? '+' : ''}$${state.data.change24h.value.toLocaleString()} (${state.data.change24h.percentage.toFixed(2)}%)
                            </div>
                        </div>
                        
                        ${config.showAllocation && state.data.allocation ? `
                            <div class="portfolio-allocation">
                                <div class="allocation-title">Distribución</div>
                                <div class="allocation-chart">
                                    <div class="chart-placeholder">
                                        <p>Distribución del Portfolio</p>
                                        ${state.data.allocation.map(item => `
                                            <div class="allocation-item">
                                                <div class="coin-info">
                                                    <img src="assets/images/crypto/${item.coin}.svg" alt="${item.symbol}" class="coin-icon-sm">
                                                    <span>${item.symbol}</span>
                                                </div>
                                                <div class="allocation-bar">
                                                    <div class="allocation-fill" style="width: ${item.percentage}%;"></div>
                                                </div>
                                                <div class="allocation-percentage">${item.percentage}%</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                        
                        ${config.showPerformance && state.data.performance ? `
                            <div class="portfolio-performance">
                                <div class="performance-title">Rendimiento</div>
                                <div class="performance-metrics">
                                    <div class="metric">
                                        <div class="metric-label">24h</div>
                                        <div class="metric-value ${state.data.performance.day >= 0 ? 'positive' : 'negative'}">
                                            ${state.data.performance.day >= 0 ? '+' : ''}${state.data.performance.day.toFixed(2)}%
                                        </div>
                                    </div>
                                    <div class="metric">
                                        <div class="metric-label">7d</div>
                                        <div class="metric-value ${state.data.performance.week >= 0 ? 'positive' : 'negative'}">
                                            ${state.data.performance.week >= 0 ? '+' : ''}${state.data.performance.week.toFixed(2)}%
                                        </div>
                                    </div>
                                    <div class="metric">
                                        <div class="metric-label">30d</div>
                                        <div class="metric-value ${state.data.performance.month >= 0 ? 'positive' : 'negative'}">
                                            ${state.data.performance.month >= 0 ? '+' : ''}${state.data.performance.month.toFixed(2)}%
                                        </div>
                                    </div>
                                    <div class="metric">
                                        <div class="metric-label">1a</div>
                                        <div class="metric-value ${state.data.performance.year >= 0 ? 'positive' : 'negative'}">
                                            ${state.data.performance.year >= 0 ? '+' : ''}${state.data.performance.year.toFixed(2)}%
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="widget-footer">
                        <a href="/portfolio" class="btn-link">Ver portfolio completo</a>
                        <div class="last-updated">
                            Actualizado: ${new Date(state.data.lastUpdated).toLocaleTimeString()}
                        </div>
                    </div>
                `}
            </div>
        `;
        
        // Añadir listeners
        const widgetId = container.getAttribute('data-widget-id');
        
        // Listener para botón de actualización
        const refreshBtn = container.querySelector('.widget-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                if (widgetId) {
                    this.updateWidgetData(widgetId);
                }
            });
        }
        
        // Listener para botón de añadir activo
        const addAssetBtn = container.querySelector('.widget-action-btn, .btn-outline');
        if (addAssetBtn) {
            addAssetBtn.addEventListener('click', () => {
                // En una implementación real, esto abriría un modal para añadir activo
                EventBus.publish('portfolio.addAsset');
            });
        }
    }
    
    /**
     * Renderiza widget de visión general del mercado
     * @param {HTMLElement} container - Contenedor del widget
     * @param {Object} config - Configuración del widget
     * @param {Object} state - Estado del widget
     * @private
     */
    _renderMarketOverviewWidget(container, config, state) {
        // Código simplificado para renderizar el widget de visión general del mercado
        container.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Visión General del Mercado</h3>
                <div class="widget-actions">
                    <button class="widget-refresh-btn" title="Actualizar">
                        <i class="icon-refresh-cw"></i>
                    </button>
                </div>
            </div>
            <div class="widget-content">
                ${state.hasError ? `
                    <div class="widget-error-content">
                        <div class="widget-error-icon"><i class="icon-alert-triangle"></i></div>
                        <div class="widget-error-message">${state.errorMessage || 'Error al cargar datos del mercado'}</div>
                    </div>
                ` : state.isLoading && !state.data ? `
                    <div class="widget-loading-content">
                        <div class="widget-spinner"></div>
                        <div class="widget-loading-text">Cargando datos del mercado...</div>
                    </div>
                ` : !state.data ? `
                    <div class="no-data-message">
                        No hay datos disponibles
                    </div>
                ` : `
                    <div class="market-metrics">
                        <div class="metric-card">
                            <div class="metric-title">Capitalización Total</div>
                            <div class="metric-value">$${(state.data.marketCap/1000000000).toFixed(2)}B</div>
                        </div>
                        <div class="metric-card">
                            <div class="metric-title">Volumen 24h</div>
                            <div class="metric-value">$${(state.data.volume24h/1000000000).toFixed(2)}B</div>
                        </div>
                        ${config.showDominance ? `
                            <div class="metric-card">
                                <div class="metric-title">Dominancia BTC</div>
                                <div class="metric-value">${state.data.btcDominance.toFixed(2)}%</div>
                            </div>
                        ` : ''}
                    </div>
                    
                    <div class="market-movers">
                        <div class="movers-row">
                            ${config.showGainers && state.data.gainers ? `
                                <div class="movers-column">
                                    <div class="movers-title positive">Mayores Ganancias (24h)</div>
                                    <div class="movers-list">
                                        ${state.data.gainers.slice(0, 3).map(coin => `
                                            <div class="mover-item">
                                                <div class="mover-coin">
                                                    <img src="assets/images/crypto/${coin.id}.svg" alt="${coin.symbol}" class="coin-icon-sm">
                                                    <span class="coin-symbol">${coin.symbol}</span>
                                                </div>
                                                <div class="mover-price">$${coin.price.toLocaleString()}</div>
                                                <div class="mover-change positive">+${coin.change24h.toFixed(2)}%</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            
                            ${config.showLosers && state.data.losers ? `
                                <div class="movers-column">
                                    <div class="movers-title negative">Mayores Pérdidas (24h)</div>
                                    <div class="movers-list">
                                        ${state.data.losers.slice(0, 3).map(coin => `
                                            <div class="mover-item">
                                                <div class="mover-coin">
                                                    <img src="assets/images/crypto/${coin.id}.svg" alt="${coin.symbol}" class="coin-icon-sm">
                                                    <span class="coin-symbol">${coin.symbol}</span>
                                                </div>
                                                <div class="mover-price">$${coin.price.toLocaleString()}</div>
                                                <div class="mover-change negative">${coin.change24h.toFixed(2)}%</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    
                    <div class="widget-footer">
                        <a href="/mercado" class="btn-link">Ver mercado completo</a>
                        <div class="last-updated">
                            Actualizado: ${new Date(state.data.lastUpdated).toLocaleTimeString()}
                        </div>
                    </div>
                `}
            </div>
        `;
        
        // Añadir listener al botón de actualización
        const refreshBtn = container.querySelector('.widget-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const widgetId = container.getAttribute('data-widget-id');
                if (widgetId) {
                    this.updateWidgetData(widgetId);
                }
            });
        }
    }
    
    /**
     * Renderiza widget de métricas on-chain
     * @param {HTMLElement} container - Contenedor del widget
     * @param {Object} config - Configuración del widget
     * @param {Object} state - Estado del widget
     * @private
     */
    _renderOnchainWidget(container, config, state) {
        // Código simplificado para renderizar el widget de métricas on-chain
        container.innerHTML = `
            <div class="widget-header">
                <h3 class="widget-title">Métricas On-Chain</h3>
                <div class="widget-actions">
                    <button class="widget-refresh-btn" title="Actualizar">
                        <i class="icon-refresh-cw"></i>
                    </button>
                </div>
            </div>
            <div class="widget-content">
                ${state.hasError ? `
                    <div class="widget-error-content">
                        <div class="widget-error-icon"><i class="icon-alert-triangle"></i></div>
                        <div class="widget-error-message">${state.errorMessage || 'Error al cargar métricas on-chain'}</div>
                    </div>
                ` : state.isLoading && !state.data ? `
                    <div class="widget-loading-content">
                        <div class="widget-spinner"></div>
                        <div class="widget-loading-text">Cargando métricas on-chain...</div>
                    </div>
                ` : !state.data ? `
                    <div class="no-data-message">
                        No hay datos disponibles
                    </div>
                ` : `
                    <div class="onchain-header">
                        <div class="coin-info">
                            <img src="assets/images/crypto/${state.data.coin}.svg" alt="${state.data.coin}" class="coin-icon">
                            <span class="coin-name">${state.data.coin.charAt(0).toUpperCase() + state.data.coin.slice(1)}</span>
                        </div>
                    </div>
                    
                    <div class="onchain-metrics">
                        ${Object.entries(state.data.metrics).map(([key, metric]) => `
                            <div class="metric-card">
                                <div class="metric-title">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
                                <div class="metric-value">${metric.value.toLocaleString()}</div>
                                <div class="metric-change ${metric.change24h >= 0 ? 'positive' : 'negative'}">
                                    ${metric.change24h >= 0 ? '+' : ''}${metric.change24h.toFixed(2)}%
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="widget-footer">
                        <a href="/analisis/onchain/${state.data.coin}" class="btn-link">Ver análisis completo</a>
                        <div class="last-updated">
                            Actualizado: ${new Date(state.data.lastUpdated).toLocaleTimeString()}
                        </div>
                    </div>
                `}
            </div>
        `;
        
        // Añadir listener al botón de actualización
        const refreshBtn = container.querySelector('.widget-refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                const widgetId = container.getAttribute('data-widget-id');
                if (widgetId) {
                    this.updateWidgetData(widgetId);
                }
            });
        }
    }
}

// Exportar la clase y una instancia por defecto
export default WidgetService;
export const widgetService = new WidgetService();
