/**
 * dashboard-controller.js
 * Módulo para gestionar el dashboard personalizable del portal de criptomonedas
 * 
 * Este controlador gestiona:
 * - Disposición y configuración del dashboard
 * - Widgets arrastrables y redimensionables
 * - Persistencia de configuraciones de usuario
 * - Comunicación entre widgets y servicios
 * - Plantillas para diferentes niveles de usuario
 */

import { MarketDataService } from '../market/market-data-service.js';
import { PortfolioManager } from '../portfolio/portfolio-manager.js';
import { NotificationService } from '../utils/notification-service.js';
import { DeviceDetector } from '../utils/device-detector.js';

// Librería de tipos de widgets disponibles
const WIDGET_TYPES = {
    PRICE_CHART: 'price-chart',
    PORTFOLIO_SUMMARY: 'portfolio-summary',
    MARKET_OVERVIEW: 'market-overview',
    FEAR_GREED: 'fear-greed-index',
    NEWS_FEED: 'news-feed',
    WATCHLIST: 'watchlist',
    ALERTS: 'alerts',
    CALENDAR: 'calendar',
    CONVERTER: 'converter',
    PERFORMANCE: 'performance',
    HEATMAP: 'heatmap',
    TOP_MOVERS: 'top-movers',
    TECHNICAL_INDICATOR: 'technical-indicator'
};

// Plantillas de dashboard predefinidas para diferentes perfiles de usuario
const DASHBOARD_TEMPLATES = {
    NOVATO: {
        layout: [
            { id: 'widget-1', type: WIDGET_TYPES.MARKET_OVERVIEW, position: { x: 0, y: 0, w: 12, h: 4 }, config: {} },
            { id: 'widget-2', type: WIDGET_TYPES.PRICE_CHART, position: { x: 0, y: 4, w: 8, h: 6 }, config: { symbol: 'BTC' } },
            { id: 'widget-3', type: WIDGET_TYPES.FEAR_GREED, position: { x: 8, y: 4, w: 4, h: 6 }, config: {} },
            { id: 'widget-4', type: WIDGET_TYPES.NEWS_FEED, position: { x: 0, y: 10, w: 12, h: 5 }, config: {} }
        ],
        settings: {
            refreshInterval: 60000, // 1 minuto
            theme: 'light',
            compact: false
        }
    },
    INTERMEDIO: {
        layout: [
            { id: 'widget-1', type: WIDGET_TYPES.PORTFOLIO_SUMMARY, position: { x: 0, y: 0, w: 6, h: 4 }, config: {} },
            { id: 'widget-2', type: WIDGET_TYPES.WATCHLIST, position: { x: 6, y: 0, w: 6, h: 4 }, config: {} },
            { id: 'widget-3', type: WIDGET_TYPES.PRICE_CHART, position: { x: 0, y: 4, w: 8, h: 6 }, config: { symbol: 'BTC' } },
            { id: 'widget-4', type: WIDGET_TYPES.TECHNICAL_INDICATOR, position: { x: 8, y: 4, w: 4, h: 3 }, config: { indicators: ['RSI', 'MACD'] } },
            { id: 'widget-5', type: WIDGET_TYPES.FEAR_GREED, position: { x: 8, y: 7, w: 4, h: 3 }, config: {} },
            { id: 'widget-6', type: WIDGET_TYPES.NEWS_FEED, position: { x: 0, y: 10, w: 12, h: 5 }, config: {} }
        ],
        settings: {
            refreshInterval: 30000, // 30 segundos
            theme: 'dark',
            compact: false
        }
    },
    SENIOR: {
        layout: [
            { id: 'widget-1', type: WIDGET_TYPES.PORTFOLIO_SUMMARY, position: { x: 0, y: 0, w: 4, h: 4 }, config: {} },
            { id: 'widget-2', type: WIDGET_TYPES.PERFORMANCE, position: { x: 4, y: 0, w: 4, h: 4 }, config: {} },
            { id: 'widget-3', type: WIDGET_TYPES.WATCHLIST, position: { x: 8, y: 0, w: 4, h: 4 }, config: {} },
            { id: 'widget-4', type: WIDGET_TYPES.PRICE_CHART, position: { x: 0, y: 4, w: 6, h: 6 }, config: { symbol: 'BTC' } },
            { id: 'widget-5', type: WIDGET_TYPES.HEATMAP, position: { x: 6, y: 4, w: 6, h: 6 }, config: {} },
            { id: 'widget-6', type: WIDGET_TYPES.TOP_MOVERS, position: { x: 0, y: 10, w: 4, h: 5 }, config: {} },
            { id: 'widget-7', type: WIDGET_TYPES.CALENDAR, position: { x: 4, y: 10, w: 4, h: 5 }, config: {} },
            { id: 'widget-8', type: WIDGET_TYPES.NEWS_FEED, position: { x: 8, y: 10, w: 4, h: 5 }, config: { filter: 'trending' } }
        ],
        settings: {
            refreshInterval: 15000, // 15 segundos
            theme: 'dark',
            compact: true
        }
    }
};

/**
 * Clase principal para gestionar el dashboard personalizable
 */
export class DashboardController {
    /**
     * Constructor del controlador de dashboard
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        this.options = {
            containerId: 'dashboard-container',
            widgetContainerId: 'widget-container',
            widgetLibraryId: 'widget-library',
            storageKey: 'user_dashboard_config',
            gridColumns: 12,
            gridRowHeight: 60,
            gridGap: 10,
            defaultUserLevel: 'NOVATO',
            ...options
        };
        
        // Referencias a elementos del DOM
        this.container = null;
        this.widgetContainer = null;
        this.widgetLibrary = null;
        
        // Referencias a servicios
        this.marketDataService = new MarketDataService();
        this.portfolioManager = new PortfolioManager();
        this.notificationService = new NotificationService();
        this.deviceDetector = new DeviceDetector();
        
        // Estado interno del dashboard
        this.state = {
            layout: [],               // Widgets actuales y sus posiciones
            activeWidgets: {},        // Referencias a instancias de widgets activos
            isDragging: false,        // Estado de arrastre
            isResizing: false,        // Estado de redimensión
            autoRefreshIntervals: {}, // Referencias a intervalos de actualización
            userLevel: null,          // Nivel del usuario (NOVATO, INTERMEDIO, SENIOR)
            settings: {               // Configuración general
                refreshInterval: 60000,
                theme: 'light',
                compact: false
            },
            dirty: false              // Indicador de cambios sin guardar
        };
        
        // Registro de escuchadores de eventos
        this.eventListeners = {
            widgetData: new Map(),    // Eventos para actualización de datos de widgets
            widgetAction: new Map(),  // Eventos para acciones de widgets
            dashboard: new Map()      // Eventos del dashboard en general
        };
        
        // Mapa de widgets registrados para agregar
        this.registeredWidgets = new Map();
    }
    
    /**
     * Inicializa el controlador del dashboard
     */
    async init() {
        try {
            console.log('Inicializando controlador de dashboard...');
            
            // Obtener referencias a elementos del DOM
            this.container = document.getElementById(this.options.containerId);
            if (!this.container) {
                throw new Error(`Contenedor de dashboard no encontrado: #${this.options.containerId}`);
            }
            
            this.widgetContainer = document.getElementById(this.options.widgetContainerId);
            if (!this.widgetContainer) {
                throw new Error(`Contenedor de widgets no encontrado: #${this.options.widgetContainerId}`);
            }
            
            this.widgetLibrary = document.getElementById(this.options.widgetLibraryId);
            
            // Detectar nivel de usuario (podría venir de la sesión de usuario)
            await this._detectUserLevel();
            
            // Cargar configuración guardada o usar plantilla predeterminada
            await this._loadDashboardConfig();
            
            // Configurar la cuadrícula e inicializar arrastrar y soltar
            this._setupGrid();
            
            // Inicializar widgets desde la configuración
            await this._initializeWidgets();
            
            // Configurar actualizaciones automáticas
            this._setupAutoRefresh();
            
            // Configurar listeners de eventos
            this._setupEventListeners();
            
            // Aplicar configuración visual
            this._applyVisualSettings();
            
            console.log('Dashboard inicializado correctamente');
            
            // Notificar que el dashboard está listo
            this._triggerEvent('dashboard', 'ready', { layout: this.state.layout });
            
            return true;
        } catch (error) {
            console.error('Error al inicializar dashboard:', error);
            this.notificationService.showError('No se pudo inicializar el dashboard. Por favor, recarga la página.');
            return false;
        }
    }
    
    /**
     * Registra un nuevo tipo de widget en el sistema
     * @param {string} type - Tipo de widget
     * @param {Object} config - Configuración del widget
     */
    registerWidget(type, config) {
        if (!type || !config || !config.component) {
            console.error('Datos de widget inválidos', { type, config });
            return false;
        }
        
        this.registeredWidgets.set(type, {
            type,
            title: config.title || 'Widget',
            description: config.description || '',
            icon: config.icon || 'widget',
            component: config.component,
            defaultConfig: config.defaultConfig || {},
            defaultSize: config.defaultSize || { w: 4, h: 4 },
            allowedSizes: config.allowedSizes || { min: { w: 2, h: 2 }, max: { w: 12, h: 12 } }
        });
        
        // Si existe el contenedor de biblioteca, actualizar la lista de widgets disponibles
        if (this.widgetLibrary) {
            this._renderWidgetLibrary();
        }
        
        return true;
    }
    
    /**
     * Agrega un nuevo widget al dashboard
     * @param {string} type - Tipo de widget a añadir
     * @param {Object} config - Configuración específica del widget
     * @param {Object} position - Posición inicial (opcional)
     * @returns {string} ID del widget creado o null si falla
     */
    async addWidget(type, config = {}, position = null) {
        try {
            // Verificar que el tipo de widget está registrado
            if (!this.registeredWidgets.has(type)) {
                throw new Error(`Tipo de widget no registrado: ${type}`);
            }
            
            const widgetInfo = this.registeredWidgets.get(type);
            const widgetId = `widget-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            
            // Determinar posición, si no se proporciona, calcular la mejor posición disponible
            const widgetPosition = position || this._calculateBestPosition(widgetInfo.defaultSize);
            
            // Combinar configuración por defecto con la proporcionada
            const widgetConfig = {
                ...widgetInfo.defaultConfig,
                ...config
            };
            
            // Crear objeto de datos del widget
            const widgetData = {
                id: widgetId,
                type: type,
                position: widgetPosition,
                config: widgetConfig
            };
            
            // Añadir a la disposición
            this.state.layout.push(widgetData);
            
            // Crear elemento DOM del widget
            await this._createWidgetElement(widgetData);
            
            // Marcar dashboard como modificado
            this.state.dirty = true;
            
            // Guardar configuración actualizada
            this._saveDashboardConfig();
            
            // Notificar sobre el widget añadido
            this._triggerEvent('dashboard', 'widgetAdded', { widget: widgetData });
            
            return widgetId;
        } catch (error) {
            console.error('Error al añadir widget:', error);
            this.notificationService.showError(`No se pudo añadir el widget: ${error.message}`);
            return null;
        }
    }
    
    /**
     * Elimina un widget del dashboard
     * @param {string} widgetId - ID del widget a eliminar
     */
    removeWidget(widgetId) {
        try {
            // Encontrar el widget en la disposición
            const widgetIndex = this.state.layout.findIndex(w => w.id === widgetId);
            if (widgetIndex === -1) {
                throw new Error(`Widget no encontrado: ${widgetId}`);
            }
            
            // Eliminar los intervalos de actualización asociados
            if (this.state.autoRefreshIntervals[widgetId]) {
                clearInterval(this.state.autoRefreshIntervals[widgetId]);
                delete this.state.autoRefreshIntervals[widgetId];
            }
            
            // Eliminar el widget de la disposición
            this.state.layout.splice(widgetIndex, 1);
            
            // Eliminar la instancia del widget si existe
            if (this.state.activeWidgets[widgetId]) {
                const widgetInstance = this.state.activeWidgets[widgetId];
                if (widgetInstance && typeof widgetInstance.destroy === 'function') {
                    widgetInstance.destroy();
                }
                delete this.state.activeWidgets[widgetId];
            }
            
            // Eliminar el elemento DOM
            const widgetElement = document.getElementById(widgetId);
            if (widgetElement) {
                widgetElement.remove();
            }
            
            // Marcar dashboard como modificado
            this.state.dirty = true;
            
            // Guardar configuración actualizada
            this._saveDashboardConfig();
            
            // Notificar sobre el widget eliminado
            this._triggerEvent('dashboard', 'widgetRemoved', { widgetId });
            
            return true;
        } catch (error) {
            console.error('Error al eliminar widget:', error);
            this.notificationService.showError(`No se pudo eliminar el widget: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Actualiza la configuración de un widget existente
     * @param {string} widgetId - ID del widget a actualizar
     * @param {Object} newConfig - Nueva configuración del widget
     */
    updateWidgetConfig(widgetId, newConfig) {
        try {
            // Encontrar el widget en la disposición
            const widget = this.state.layout.find(w => w.id === widgetId);
            if (!widget) {
                throw new Error(`Widget no encontrado: ${widgetId}`);
            }
            
            // Actualizar configuración
            widget.config = {
                ...widget.config,
                ...newConfig
            };
            
            // Actualizar widget activo si existe
            if (this.state.activeWidgets[widgetId]) {
                const widgetInstance = this.state.activeWidgets[widgetId];
                if (widgetInstance && typeof widgetInstance.updateConfig === 'function') {
                    widgetInstance.updateConfig(widget.config);
                }
            }
            
            // Marcar dashboard como modificado
            this.state.dirty = true;
            
            // Guardar configuración actualizada
            this._saveDashboardConfig();
            
            // Notificar sobre la actualización del widget
            this._triggerEvent('dashboard', 'widgetUpdated', { widget });
            
            return true;
        } catch (error) {
            console.error('Error al actualizar configuración de widget:', error);
            this.notificationService.showError(`No se pudo actualizar el widget: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Actualiza la posición y tamaño de un widget
     * @param {string} widgetId - ID del widget a actualizar
     * @param {Object} position - Nueva posición/tamaño { x, y, w, h }
     */
    updateWidgetPosition(widgetId, position) {
        try {
            // Encontrar el widget en la disposición
            const widget = this.state.layout.find(w => w.id === widgetId);
            if (!widget) {
                throw new Error(`Widget no encontrado: ${widgetId}`);
            }
            
            // Actualizar posición
            widget.position = {
                ...widget.position,
                ...position
            };
            
            // Actualizar elemento DOM
            const widgetElement = document.getElementById(widgetId);
            if (widgetElement) {
                this._applyWidgetPosition(widgetElement, widget.position);
            }
            
            // Marcar dashboard como modificado
            this.state.dirty = true;
            
            // Guardar configuración actualizada
            this._saveDashboardConfig();
            
            // Notificar sobre la reposición del widget
            this._triggerEvent('dashboard', 'widgetMoved', { widget });
            
            return true;
        } catch (error) {
            console.error('Error al actualizar posición de widget:', error);
            return false;
        }
    }
    
    /**
     * Cambia a una plantilla predefinida de dashboard
     * @param {string} templateName - Nombre de la plantilla (NOVATO, INTERMEDIO, SENIOR)
     */
    async changeTemplate(templateName) {
        try {
            if (!DASHBOARD_TEMPLATES[templateName]) {
                throw new Error(`Plantilla no encontrada: ${templateName}`);
            }
            
            // Confirmar con el usuario si hay widgets personalizados
            if (this.state.dirty) {
                const confirmed = confirm('Cambiar a una nueva plantilla reemplazará tu configuración actual. ¿Deseas continuar?');
                if (!confirmed) {
                    return false;
                }
            }
            
            // Limpiar todos los widgets actuales y sus intervalos
            this._clearAllWidgets();
            
            // Cargar la nueva plantilla
            const template = DASHBOARD_TEMPLATES[templateName];
            this.state.layout = JSON.parse(JSON.stringify(template.layout)); // Copia profunda
            this.state.settings = { ...template.settings };
            
            // Inicializar los nuevos widgets
            await this._initializeWidgets();
            
            // Configurar nuevos intervalos de actualización
            this._setupAutoRefresh();
            
            // Aplicar configuración visual
            this._applyVisualSettings();
            
            // Marcar como limpio ya que acabamos de cargar una plantilla predefinida
            this.state.dirty = false;
            
            // Guardar la nueva configuración
            this._saveDashboardConfig();
            
            // Notificar sobre el cambio de plantilla
            this._triggerEvent('dashboard', 'templateChanged', { templateName });
            
            return true;
        } catch (error) {
            console.error('Error al cambiar plantilla:', error);
            this.notificationService.showError(`No se pudo cargar la plantilla: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Actualiza la configuración general del dashboard
     * @param {Object} newSettings - Nuevas configuraciones
     */
    updateSettings(newSettings) {
        try {
            // Actualizar configuración
            this.state.settings = {
                ...this.state.settings,
                ...newSettings
            };
            
            // Aplicar cambios visuales
            this._applyVisualSettings();
            
            // Actualizar intervalos de actualización si es necesario
            if (newSettings.refreshInterval && newSettings.refreshInterval !== this.state.settings.refreshInterval) {
                this._setupAutoRefresh();
            }
            
            // Marcar dashboard como modificado
            this.state.dirty = true;
            
            // Guardar configuración actualizada
            this._saveDashboardConfig();
            
            // Notificar sobre la actualización de configuración
            this._triggerEvent('dashboard', 'settingsUpdated', { settings: this.state.settings });
            
            return true;
        } catch (error) {
            console.error('Error al actualizar configuración del dashboard:', error);
            this.notificationService.showError(`No se pudo actualizar la configuración: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Exporta la configuración actual del dashboard
     * @returns {Object} Configuración completa del dashboard
     */
    exportDashboardConfig() {
        const configToExport = {
            layout: this.state.layout,
            settings: this.state.settings,
            version: '1.0',
            exportedAt: new Date().toISOString()
        };
        
        return configToExport;
    }
    
    /**
     * Importa una configuración de dashboard
     * @param {Object|string} config - Configuración a importar (objeto o string JSON)
     */
    async importDashboardConfig(config) {
        try {
            // Parsear la configuración si es un string
            const dashboardConfig = typeof config === 'string' ? JSON.parse(config) : config;
            
            // Validar la configuración
            if (!dashboardConfig || !dashboardConfig.layout || !Array.isArray(dashboardConfig.layout)) {
                throw new Error('Formato de configuración inválido');
            }
            
            // Confirmar con el usuario
            const confirmed = confirm('Importar esta configuración reemplazará tu dashboard actual. ¿Deseas continuar?');
            if (!confirmed) {
                return false;
            }
            
            // Limpiar todos los widgets actuales
            this._clearAllWidgets();
            
            // Cargar la nueva configuración
            this.state.layout = dashboardConfig.layout;
            this.state.settings = dashboardConfig.settings || this.state.settings;
            
            // Inicializar los nuevos widgets
            await this._initializeWidgets();
            
            // Configurar nuevos intervalos de actualización
            this._setupAutoRefresh();
            
            // Aplicar configuración visual
            this._applyVisualSettings();
            
            // Marcar como modificado
            this.state.dirty = true;
            
            // Guardar la nueva configuración
            this._saveDashboardConfig();
            
            // Notificar sobre la importación
            this._triggerEvent('dashboard', 'configImported', { config: dashboardConfig });
            
            return true;
        } catch (error) {
            console.error('Error al importar configuración:', error);
            this.notificationService.showError(`No se pudo importar la configuración: ${error.message}`);
            return false;
        }
    }
    
    /**
     * Actualiza manualmente todos los widgets del dashboard
     */
    refreshAllWidgets() {
        Object.keys(this.state.activeWidgets).forEach(widgetId => {
            this.refreshWidget(widgetId);
        });
        
        this._triggerEvent('dashboard', 'manualRefresh', {});
    }
    
    /**
     * Actualiza un widget específico
     * @param {string} widgetId - ID del widget a actualizar
     */
    refreshWidget(widgetId) {
        const widgetInstance = this.state.activeWidgets[widgetId];
        if (widgetInstance && typeof widgetInstance.refresh === 'function') {
            widgetInstance.refresh();
        }
    }
    
    /**
     * Suscribe a eventos del dashboard o de widgets específicos
     * @param {string} eventType - Tipo de evento ('widgetData', 'widgetAction', 'dashboard')
     * @param {string} eventName - Nombre del evento
     * @param {Function} callback - Función a ejecutar cuando ocurra el evento
     */
    subscribe(eventType, eventName, callback) {
        if (!this.eventListeners[eventType]) {
            console.error(`Tipo de evento desconocido: ${eventType}`);
            return false;
        }
        
        if (!this.eventListeners[eventType].has(eventName)) {
            this.eventListeners[eventType].set(eventName, []);
        }
        
        this.eventListeners[eventType].get(eventName).push(callback);
        return true;
    }
    
    /**
     * Cancela la suscripción a un evento
     * @param {string} eventType - Tipo de evento
     * @param {string} eventName - Nombre del evento
     * @param {Function} callback - Función a eliminar
     */
    unsubscribe(eventType, eventName, callback) {
        if (!this.eventListeners[eventType] || !this.eventListeners[eventType].has(eventName)) {
            return false;
        }
        
        const listeners = this.eventListeners[eventType].get(eventName);
        const index = listeners.indexOf(callback);
        
        if (index !== -1) {
            listeners.splice(index, 1);
            return true;
        }
        
        return false;
    }
    
    /* MÉTODOS PRIVADOS */
    
    /**
     * Detecta el nivel del usuario actual
     * @private
     */
    async _detectUserLevel() {
        try {
            // Aquí normalmente consultaríamos al servicio de autenticación
            // Para este ejemplo, usamos el valor predeterminado de las opciones
            this.state.userLevel = this.options.defaultUserLevel;
            
            console.log(`Nivel de usuario detectado: ${this.state.userLevel}`);
            
            return this.state.userLevel;
        } catch (error) {
            console.error('Error al detectar nivel de usuario:', error);
            // En caso de error, usar el nivel predeterminado
            this.state.userLevel = this.options.defaultUserLevel;
            return this.state.userLevel;
        }
    }
    
    /**
     * Carga la configuración del dashboard desde el almacenamiento o usa una plantilla predeterminada
     * @private
     */
    async _loadDashboardConfig() {
        try {
            // Intentar cargar desde localStorage
            const savedConfig = localStorage.getItem(this.options.storageKey);
            
            if (savedConfig) {
                const parsedConfig = JSON.parse(savedConfig);
                
                // Verificar que la configuración es válida
                if (parsedConfig && parsedConfig.layout && Array.isArray(parsedConfig.layout)) {
                    console.log('Configuración de dashboard cargada desde almacenamiento local');
                    this.state.layout = parsedConfig.layout;
                    this.state.settings = parsedConfig.settings || this.state.settings;
                    return true;
                }
            }
            
            // Si no hay configuración guardada o es inválida, usar plantilla predeterminada
            console.log(`No se encontró configuración guardada. Usando plantilla para ${this.state.userLevel}`);
            const template = DASHBOARD_TEMPLATES[this.state.userLevel];
            
            if (!template) {
                throw new Error(`No se encontró plantilla para nivel: ${this.state.userLevel}`);
            }
            
            this.state.layout = JSON.parse(JSON.stringify(template.layout)); // Copia profunda
            this.state.settings = { ...template.settings };
            
            return true;
        } catch (error) {
            console.error('Error al cargar configuración del dashboard:', error);
            
            // En caso de error, usar la plantilla NOVATO como fallback
            console.log('Usando plantilla NOVATO como fallback');
            this.state.layout = JSON.parse(JSON.stringify(DASHBOARD_TEMPLATES.NOVATO.layout));
            this.state.settings = { ...DASHBOARD_TEMPLATES.NOVATO.settings };
            
            return false;
        }
    }
    
    /**
     * Guarda la configuración actual del dashboard en el almacenamiento local
     * @private
     */
    _saveDashboardConfig() {
        try {
            const configToSave = {
                layout: this.state.layout,
                settings: this.state.settings
            };
            
            localStorage.setItem(this.options.storageKey, JSON.stringify(configToSave));
            
            return true;
        } catch (error) {
            console.error('Error al guardar configuración del dashboard:', error);
            this.notificationService.showWarning('No se pudo guardar tu configuración de dashboard');
            return false;
        }
    }
    
    /**
     * Configura la cuadrícula del dashboard e inicializa funcionalidades de arrastrar y soltar
     * @private
     */
    _setupGrid() {
        // Aplicar estilos base a la cuadrícula
        this.widgetContainer.style.display = 'grid';
        this.widgetContainer.style.gridTemplateColumns = `repeat(${this.options.gridColumns}, 1fr)`;
        this.widgetContainer.style.gridGap = `${this.options.gridGap}px`;
        this.widgetContainer.style.position = 'relative';
        
        // Configurar variables CSS para uso en cálculos de posición
        document.documentElement.style.setProperty('--grid-columns', this.options.gridColumns);
        document.documentElement.style.setProperty('--grid-row-height', `${this.options.gridRowHeight}px`);
        document.documentElement.style.setProperty('--grid-gap', `${this.options.gridGap}px`);
        
        // Inicializar eventos de arrastrar y soltar
        this._initDragAndDrop();
    }
    
    /**
     * Inicializa todos los widgets desde la configuración actual
     * @private
     */
    async _initializeWidgets() {
        try {
            // Limpiar contenedor de widgets
            this.widgetContainer.innerHTML = '';
            this.state.activeWidgets = {};
            
            // Crear cada widget en el DOM
            for (const widgetData of this.state.layout) {
                await this._createWidgetElement(widgetData);
            }
            
            return true;
        } catch (error) {
            console.error('Error al inicializar widgets:', error);
            return false;
        }
    }
    
    /**
     * Crea un elemento DOM para un widget y lo inicializa
     * @param {Object} widgetData - Datos del widget
     * @private
     */
    async _createWidgetElement(widgetData) {
        try {
            // Verificar si el tipo de widget está registrado
            if (!this.registeredWidgets.has(widgetData.type)) {
                console.warn(`Tipo de widget no registrado: ${widgetData.type}. Omitiendo.`);
                return null;
            }
            
            const widgetInfo = this.registeredWidgets.get(widgetData.type);
            
            // Crear elemento contenedor del widget
            const widgetElement = document.createElement('div');
            widgetElement.id = widgetData.id;
            widgetElement.className = 'dashboard-widget';
            widgetElement.setAttribute('data-widget-type', widgetData.type);
            
            // Crear header del widget
            const widgetHeader = document.createElement('div');
            widgetHeader.className = 'widget-header';
            
            // Título del widget con ícono
            const widgetTitle = document.createElement('div');
            widgetTitle.className = 'widget-title';
            widgetTitle.innerHTML = `
                <i class="icon-${widgetInfo.icon}"></i>
                <span>${widgetInfo.title}</span>
            `;
            
            // Controles del widget
            const widgetControls = document.createElement('div');
            widgetControls.className = 'widget-controls';
            
            // Botón de refresco
            const refreshBtn = document.createElement('button');
            refreshBtn.className = 'widget-control-btn refresh-btn';
            refreshBtn.innerHTML = '<i class="icon-refresh-cw"></i>';
            refreshBtn.title = 'Actualizar';
            refreshBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.refreshWidget(widgetData.id);
            });
            
            // Botón de configuración
            const configBtn = document.createElement('button');
            configBtn.className = 'widget-control-btn config-btn';
            configBtn.innerHTML = '<i class="icon-settings"></i>';
            configBtn.title = 'Configurar';
            configBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._openWidgetConfig(widgetData.id);
            });
            
            // Botón de eliminar
            const removeBtn = document.createElement('button');
            removeBtn.className = 'widget-control-btn remove-btn';
            removeBtn.innerHTML = '<i class="icon-x"></i>';
            removeBtn.title = 'Eliminar';
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removeWidget(widgetData.id);
            });
            
            // Agregar controles al header
            widgetControls.appendChild(refreshBtn);
            widgetControls.appendChild(configBtn);
            widgetControls.appendChild(removeBtn);
            
            // Completar header y agregar al widget
            widgetHeader.appendChild(widgetTitle);
            widgetHeader.appendChild(widgetControls);
            widgetElement.appendChild(widgetHeader);
            
            // Contenido del widget
            const widgetContent = document.createElement('div');
            widgetContent.className = 'widget-content';
            widgetContent.innerHTML = '<div class="widget-loading"><i class="icon-loader"></i></div>';
            widgetElement.appendChild(widgetContent);
            
            // Configurar resize handle
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'widget-resize-handle';
            resizeHandle.innerHTML = '<i class="icon-corner-right-down"></i>';
            widgetElement.appendChild(resizeHandle);
            
            // Aplicar posición inicial
            this._applyWidgetPosition(widgetElement, widgetData.position);
            
            // Agregar al contenedor
            this.widgetContainer.appendChild(widgetElement);
            
            // Inicializar el widget con su componente específico
            await this._initializeWidgetComponent(widgetData, widgetContent);
            
            // Configurar los eventos de arrastrar y redimensionar
            this._setupWidgetDragAndResize(widgetElement, widgetData.id, resizeHandle);
            
            return widgetElement;
        } catch (error) {
            console.error(`Error al crear elemento para widget ${widgetData.id}:`, error);
            return null;
        }
    }
    
    /**
     * Inicializa el componente específico de un widget
     * @param {Object} widgetData - Datos del widget
     * @param {HTMLElement} contentContainer - Contenedor del contenido del widget
     * @private
     */
    async _initializeWidgetComponent(widgetData, contentContainer) {
        try {
            // Obtener información del tipo de widget
            const widgetInfo = this.registeredWidgets.get(widgetData.type);
            if (!widgetInfo || !widgetInfo.component) {
                throw new Error(`Componente no encontrado para widget: ${widgetData.type}`);
            }
            
            // Inicializar el componente
            const WidgetComponent = widgetInfo.component;
            const widgetInstance = new WidgetComponent({
                containerId: contentContainer,
                config: widgetData.config,
                marketDataService: this.marketDataService,
                portfolioManager: this.portfolioManager,
                onUpdate: (data) => this._handleWidgetUpdate(widgetData.id, data),
                onAction: (action, data) => this._handleWidgetAction(widgetData.id, action, data)
            });
            
            // Guardar la referencia a la instancia
            this.state.activeWidgets[widgetData.id] = widgetInstance;
            
            // Inicializar el widget
            await widgetInstance.init();
            
            return widgetInstance;
        } catch (error) {
            console.error(`Error al inicializar componente de widget ${widgetData.id}:`, error);
            
            // Mostrar mensaje de error en el widget
            contentContainer.innerHTML = `
                <div class="widget-error">
                    <i class="icon-alert-triangle"></i>
                    <p>Error al cargar widget</p>
                </div>
            `;
            
            return null;
        }
    }
    
    /**
     * Configura los eventos de arrastrar y redimensionar para un widget
     * @param {HTMLElement} widgetElement - Elemento DOM del widget
     * @param {string} widgetId - ID del widget
     * @param {HTMLElement} resizeHandle - Manejador de redimensión
     * @private
     */
    _setupWidgetDragAndResize(widgetElement, widgetId, resizeHandle) {
        // Variables para seguimiento del arrastre
        let isDragging = false;
        let startX, startY;
        let startLeft, startTop;
        let startGridX, startGridY;
        
        // Variables para seguimiento de la redimensión
        let isResizing = false;
        let startWidth, startHeight;
        let startGridW, startGridH;
        
        // Obtener el widget header para iniciar arrastre
        const widgetHeader = widgetElement.querySelector('.widget-header');
        
        // Evento de inicio de arrastre
        widgetHeader.addEventListener('mousedown', (e) => {
            // Solo manejar clic izquierdo
            if (e.button !== 0) return;
            
            e.preventDefault();
            
            // Iniciar arrastre
            isDragging = true;
            this.state.isDragging = true;
            
            // Guardar posición inicial
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = widgetElement.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            
            // Obtener posición en la cuadrícula
            const position = this._getWidgetPosition(widgetId);
            startGridX = position.x;
            startGridY = position.y;
            
            // Agregar clases de arrastre
            widgetElement.classList.add('widget-dragging');
            document.body.classList.add('dragging-active');
            
            // Crear marcador de posición para mostrar donde se colocará el widget
            this._createDragPlaceholder(widgetId);
        });
        
        // Evento de inicio de redimensión
        resizeHandle.addEventListener('mousedown', (e) => {
            // Solo manejar clic izquierdo
            if (e.button !== 0) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            // Iniciar redimensión
            isResizing = true;
            this.state.isResizing = true;
            
            // Guardar tamaño inicial
            startX = e.clientX;
            startY = e.clientY;
            
            const rect = widgetElement.getBoundingClientRect();
            startWidth = rect.width;
            startHeight = rect.height;
            
            // Obtener tamaño en la cuadrícula
            const position = this._getWidgetPosition(widgetId);
            startGridW = position.w;
            startGridH = position.h;
            
            // Agregar clases de redimensión
            widgetElement.classList.add('widget-resizing');
            document.body.classList.add('resizing-active');
            
            // Crear marcador de posición para mostrar el nuevo tamaño
            this._createResizePlaceholder(widgetId);
        });
        
        // Eventos de movimiento del ratón
        document.addEventListener('mousemove', (e) => {
            if (!isDragging && !isResizing) return;
            
            if (isDragging) {
                // Calcular desplazamiento
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                // Calcular nueva posición
                const newLeft = startLeft + deltaX;
                const newTop = startTop + deltaY;
                
                // Convertir píxeles a coordenadas de cuadrícula
                const cellWidth = this._getCellWidth();
                const cellHeight = this._getCellHeight();
                
                // Calcular desplazamiento en celdas (redondeado al más cercano)
                const gridDeltaX = Math.round(deltaX / cellWidth);
                const gridDeltaY = Math.round(deltaY / cellHeight);
                
                // Calcular nueva posición en la cuadrícula
                let newGridX = startGridX + gridDeltaX;
                let newGridY = startGridY + gridDeltaY;
                
                // Obtener el tamaño del widget
                const widgetSize = this._getWidgetPosition(widgetId);
                
                // Asegurar que no se salga de los límites
                newGridX = Math.max(0, Math.min(newGridX, this.options.gridColumns - widgetSize.w));
                newGridY = Math.max(0, newGridY);
                
                // Actualizar posición del placeholder
                this._updateDragPlaceholder(widgetId, {
                    x: newGridX,
                    y: newGridY,
                    w: widgetSize.w,
                    h: widgetSize.h
                });
            }
            
            if (isResizing) {
                // Calcular desplazamiento
                const deltaX = e.clientX - startX;
                const deltaY = e.clientY - startY;
                
                // Calcular nuevo tamaño
                const newWidth = startWidth + deltaX;
                const newHeight = startHeight + deltaY;
                
                // Convertir píxeles a coordenadas de cuadrícula
                const cellWidth = this._getCellWidth();
                const cellHeight = this._getCellHeight();
                
                // Calcular nuevo tamaño en celdas (redondeado al más cercano)
                let newGridW = Math.max(1, Math.round(newWidth / cellWidth));
                let newGridH = Math.max(1, Math.round(newHeight / cellHeight));
                
                // Obtener la información del widget
                const widgetInfo = this.registeredWidgets.get(
                    this.state.layout.find(w => w.id === widgetId).type
                );
                
                // Aplicar restricciones de tamaño si están definidas
                if (widgetInfo && widgetInfo.allowedSizes) {
                    const { min, max } = widgetInfo.allowedSizes;
                    if (min) {
                        newGridW = Math.max(min.w || 1, newGridW);
                        newGridH = Math.max(min.h || 1, newGridH);
                    }
                    if (max) {
                        newGridW = Math.min(max.w || this.options.gridColumns, newGridW);
                        newGridH = Math.min(max.h || 20, newGridH);
                    }
                }
                
                // Asegurar que no se salga de los límites
                const position = this._getWidgetPosition(widgetId);
                newGridW = Math.min(newGridW, this.options.gridColumns - position.x);
                
                // Actualizar posición del placeholder
                this._updateResizePlaceholder(widgetId, {
                    x: position.x,
                    y: position.y,
                    w: newGridW,
                    h: newGridH
                });
            }
        });
        
        // Eventos de finalización de arrastre o redimensión
        document.addEventListener('mouseup', (e) => {
            if (isDragging) {
                // Finalizar arrastre
                isDragging = false;
                this.state.isDragging = false;
                
                // Eliminar clases de arrastre
                widgetElement.classList.remove('widget-dragging');
                document.body.classList.remove('dragging-active');
                
                // Obtener posición final del placeholder
                const placeholder = document.querySelector('.drag-placeholder');
                if (placeholder) {
                    const newPosition = {
                        x: parseInt(placeholder.getAttribute('data-grid-x')),
                        y: parseInt(placeholder.getAttribute('data-grid-y')),
                        w: parseInt(placeholder.getAttribute('data-grid-w')),
                        h: parseInt(placeholder.getAttribute('data-grid-h'))
                    };
                    
                    // Actualizar posición del widget
                    this.updateWidgetPosition(widgetId, newPosition);
                    
                    // Eliminar placeholder
                    placeholder.remove();
                }
            }
            
            if (isResizing) {
                // Finalizar redimensión
                isResizing = false;
                this.state.isResizing = false;
                
                // Eliminar clases de redimensión
                widgetElement.classList.remove('widget-resizing');
                document.body.classList.remove('resizing-active');
                
                // Obtener tamaño final del placeholder
                const placeholder = document.querySelector('.resize-placeholder');
                if (placeholder) {
                    const newSize = {
                        w: parseInt(placeholder.getAttribute('data-grid-w')),
                        h: parseInt(placeholder.getAttribute('data-grid-h'))
                    };
                    
                    // Actualizar tamaño del widget
                    this.updateWidgetPosition(widgetId, newSize);
                    
                    // Eliminar placeholder
                    placeholder.remove();
                }
            }
        });
    }
    
    /**
     * Crea un marcador de posición durante el arrastre
     * @param {string} widgetId - ID del widget
     * @private
     */
    _createDragPlaceholder(widgetId) {
        // Eliminar cualquier placeholder existente
        this._removePlaceholders();
        
        // Obtener posición actual del widget
        const position = this._getWidgetPosition(widgetId);
        
        // Crear elemento placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'drag-placeholder';
        placeholder.setAttribute('data-widget-id', widgetId);
        placeholder.setAttribute('data-grid-x', position.x);
        placeholder.setAttribute('data-grid-y', position.y);
        placeholder.setAttribute('data-grid-w', position.w);
        placeholder.setAttribute('data-grid-h', position.h);
        
        // Aplicar posición
        this._applyWidgetPosition(placeholder, position);
        
        // Agregar al contenedor
        this.widgetContainer.appendChild(placeholder);
    }
    
    /**
     * Actualiza la posición del marcador de arrastre
     * @param {string} widgetId - ID del widget
     * @param {Object} position - Nueva posición
     * @private
     */
    _updateDragPlaceholder(widgetId, position) {
        const placeholder = document.querySelector('.drag-placeholder');
        if (!placeholder) return;
        
        // Actualizar atributos
        placeholder.setAttribute('data-grid-x', position.x);
        placeholder.setAttribute('data-grid-y', position.y);
        
        // Aplicar nueva posición
        this._applyWidgetPosition(placeholder, position);
    }
    
    /**
     * Crea un marcador de posición durante la redimensión
     * @param {string} widgetId - ID del widget
     * @private
     */
    _createResizePlaceholder(widgetId) {
        // Eliminar cualquier placeholder existente
        this._removePlaceholders();
        
        // Obtener posición actual del widget
        const position = this._getWidgetPosition(widgetId);
        
        // Crear elemento placeholder
        const placeholder = document.createElement('div');
        placeholder.className = 'resize-placeholder';
        placeholder.setAttribute('data-widget-id', widgetId);
        placeholder.setAttribute('data-grid-x', position.x);
        placeholder.setAttribute('data-grid-y', position.y);
        placeholder.setAttribute('data-grid-w', position.w);
        placeholder.setAttribute('data-grid-h', position.h);
        
        // Aplicar posición
        this._applyWidgetPosition(placeholder, position);
        
        // Agregar al contenedor
        this.widgetContainer.appendChild(placeholder);
    }
    
    /**
     * Actualiza el tamaño del marcador de redimensión
     * @param {string} widgetId - ID del widget
     * @param {Object} position - Nueva posición y tamaño
     * @private
     */
    _updateResizePlaceholder(widgetId, position) {
        const placeholder = document.querySelector('.resize-placeholder');
        if (!placeholder) return;
        
        // Actualizar atributos
        placeholder.setAttribute('data-grid-w', position.w);
        placeholder.setAttribute('data-grid-h', position.h);
        
        // Aplicar nueva posición y tamaño
        this._applyWidgetPosition(placeholder, position);
    }
    
    /**
     * Elimina todos los marcadores de posición
     * @private
     */
    _removePlaceholders() {
        const placeholders = document.querySelectorAll('.drag-placeholder, .resize-placeholder');
        placeholders.forEach(el => el.remove());
    }
    
    /**
     * Aplica posición y tamaño a un elemento según coordenadas de cuadrícula
     * @param {HTMLElement} element - Elemento DOM
     * @param {Object} position - Posición { x, y, w, h }
     * @private
     */
    _applyWidgetPosition(element, position) {
        // Convertir posición de cuadrícula a estilo grid-area
        element.style.gridColumn = `${position.x + 1} / span ${position.w}`;
        element.style.gridRow = `${position.y + 1} / span ${position.h}`;
        
        // Guardar posición como atributos de datos
        element.setAttribute('data-grid-x', position.x);
        element.setAttribute('data-grid-y', position.y);
        element.setAttribute('data-grid-w', position.w);
        element.setAttribute('data-grid-h', position.h);
    }
    
    /**
     * Obtiene la posición actual de un widget
     * @param {string} widgetId - ID del widget
     * @returns {Object} Posición { x, y, w, h }
     * @private
     */
    _getWidgetPosition(widgetId) {
        const widget = this.state.layout.find(w => w.id === widgetId);
        if (!widget) return { x: 0, y: 0, w: 4, h: 4 };
        return { ...widget.position };
    }
    
    /**
     * Calcula el ancho de una celda en la cuadrícula
     * @returns {number} Ancho de celda en píxeles
     * @private
     */
    _getCellWidth() {
        const containerWidth = this.widgetContainer.clientWidth;
        const totalGapWidth = (this.options.gridColumns - 1) * this.options.gridGap;
        return (containerWidth - totalGapWidth) / this.options.gridColumns;
    }
    
    /**
     * Calcula la altura de una celda en la cuadrícula
     * @returns {number} Altura de celda en píxeles
     * @private
     */
    _getCellHeight() {
        return this.options.gridRowHeight + this.options.gridGap;
    }
    
    /**
     * Calcula la mejor posición disponible para un nuevo widget
     * @param {Object} size - Tamaño del widget { w, h }
     * @returns {Object} Posición { x, y, w, h }
     * @private
     */
    _calculateBestPosition(size) {
        // Por simplicidad, para este ejemplo colocamos el widget al final
        // En una implementación real, buscaríamos espacios disponibles
        
        // Encontrar la posición Y más alta
        let maxY = 0;
        for (const widget of this.state.layout) {
            const bottomY = widget.position.y + widget.position.h;
            maxY = Math.max(maxY, bottomY);
        }
        
        return {
            x: 0,
            y: maxY,
            w: Math.min(size.w, this.options.gridColumns),
            h: size.h
        };
    }
    
    /**
     * Configura las actualizaciones automáticas de los widgets
     * @private
     */
    _setupAutoRefresh() {
        // Limpiar intervalos existentes
        for (const intervalId of Object.values(this.state.autoRefreshIntervals)) {
            clearInterval(intervalId);
        }
        this.state.autoRefreshIntervals = {};
        
        // Configurar nuevos intervalos por widget
        for (const widget of this.state.layout) {
            // Obtener intervalo personalizado del widget o usar el global
            const widgetConfig = this.registeredWidgets.get(widget.type) || {};
            const refreshInterval = widget.config.refreshInterval || 
                                   widgetConfig.defaultRefreshInterval || 
                                   this.state.settings.refreshInterval;
            
            // Solo crear intervalo si es mayor que cero
            if (refreshInterval > 0) {
                this.state.autoRefreshIntervals[widget.id] = setInterval(() => {
                    this.refreshWidget(widget.id);
                }, refreshInterval);
            }
        }
    }
    
    /**
     * Configura los escuchadores de eventos
     * @private
     */
    _setupEventListeners() {
        // Escuchar cambios en el tamaño de la ventana para adaptar la cuadrícula
        window.addEventListener('resize', this._handleWindowResize.bind(this));
        
        // Escuchar eventos del dispositivo
        document.addEventListener('deviceChanged', this._handleDeviceChange.bind(this));
        
        // Escuchar eventos de teclado para atajos
        document.addEventListener('keydown', this._handleKeyboard.bind(this));
    }
    
    /**
     * Maneja cambios en el tamaño de la ventana
     * @param {Event} event - Evento de cambio de tamaño
     * @private
     */
    _handleWindowResize(event) {
        // Reajustar widgets si es necesario
        this._adjustResponsiveLayout();
    }
    
    /**
     * Maneja cambios en el dispositivo
     * @param {CustomEvent} event - Evento de cambio de dispositivo
     * @private
     */
    _handleDeviceChange(event) {
        // Reajustar diseño según tipo de dispositivo
        this._adjustResponsiveLayout();
    }
    
    /**
     * Maneja eventos de teclado
     * @param {KeyboardEvent} event - Evento de teclado
     * @private
     */
    _handleKeyboard(event) {
        // Implementar atajos de teclado si es necesario
    }
    
    /**
     * Ajusta el diseño para diferentes tamaños de pantalla
     * @private
     */
    _adjustResponsiveLayout() {
        // Detectar tipo de dispositivo
        const isMobile = this.deviceDetector.isMobile();
        const isTablet = this.deviceDetector.isTablet();
        
        // Adaptar columnas de la cuadrícula según el dispositivo
        if (isMobile) {
            // En móvil, reducir a 4 columnas y apilar widgets
            document.documentElement.style.setProperty('--grid-columns', '4');
            this._adaptLayoutForMobile();
        } else if (isTablet) {
            // En tablet, usar 8 columnas
            document.documentElement.style.setProperty('--grid-columns', '8');
            this._adaptLayoutForTablet();
        } else {
            // En desktop, volver a las columnas configuradas
            document.documentElement.style.setProperty('--grid-columns', this.options.gridColumns);
            this._restoreDefaultLayout();
        }
    }
    
    /**
     * Adapta el diseño para dispositivos móviles
     * @private
     */
    _adaptLayoutForMobile() {
        // Guardar la disposición original si no se ha guardado
        if (!this._originalLayout) {
            this._originalLayout = JSON.parse(JSON.stringify(this.state.layout));
        }
        
        // Ajustar cada widget para ocupar todo el ancho y apilarse
        this.state.layout.forEach((widget, index) => {
            const newPosition = {
                x: 0,
                y: index * 4, // Apilar con altura fija por widget
                w: 4,         // Ancho completo (4 columnas en móvil)
                h: widget.position.h <= 3 ? widget.position.h : 4 // Limitar altura
            };
            
            // Actualizar posición en la disposición
            widget.position = newPosition;
            
            // Actualizar elemento DOM
            const widgetElement = document.getElementById(widget.id);
            if (widgetElement) {
                this._applyWidgetPosition(widgetElement, newPosition);
            }
        });
    }
    
    /**
     * Adapta el diseño para tablets
     * @private
     */
    _adaptLayoutForTablet() {
        // Guardar la disposición original si no se ha guardado
        if (!this._originalLayout) {
            this._originalLayout = JSON.parse(JSON.stringify(this.state.layout));
        }
        
        // Ajustar cada widget adaptando proporcionalmente la posición
        this.state.layout.forEach((widget) => {
            const originalPos = this._findOriginalWidgetPosition(widget.id);
            if (!originalPos) return;
            
            // Adaptar a 8 columnas
            const newPosition = {
                x: Math.floor(originalPos.x * 8 / 12),
                y: originalPos.y,
                w: Math.min(Math.floor(originalPos.w * 8 / 12), 8),
                h: originalPos.h
            };
            
            // Actualizar posición en la disposición
            widget.position = newPosition;
            
            // Actualizar elemento DOM
            const widgetElement = document.getElementById(widget.id);
            if (widgetElement) {
                this._applyWidgetPosition(widgetElement, newPosition);
            }
        });
    }
    
    /**
     * Restaura el diseño original
     * @private
     */
    _restoreDefaultLayout() {
        // Si no hay disposición original guardada, no hacer nada
        if (!this._originalLayout) return;
        
        // Restaurar cada widget a su posición original
        this.state.layout.forEach((widget) => {
            const originalWidget = this._originalLayout.find(w => w.id === widget.id);
            if (!originalWidget) return;
            
            // Restaurar posición original
            widget.position = { ...originalWidget.position };
            
            // Actualizar elemento DOM
            const widgetElement = document.getElementById(widget.id);
            if (widgetElement) {
                this._applyWidgetPosition(widgetElement, widget.position);
            }
        });
    }
    
    /**
     * Busca la posición original de un widget
     * @param {string} widgetId - ID del widget
     * @returns {Object|null} Posición original
     * @private
     */
    _findOriginalWidgetPosition(widgetId) {
        if (!this._originalLayout) return null;
        
        const originalWidget = this._originalLayout.find(w => w.id === widgetId);
        return originalWidget ? { ...originalWidget.position } : null;
    }
    
    /**
     * Aplica la configuración visual del dashboard
     * @private
     */
    _applyVisualSettings() {
        // Aplicar tema
        if (this.state.settings.theme) {
            document.body.classList.remove('theme-light', 'theme-dark');
            document.body.classList.add(`theme-${this.state.settings.theme}`);
        }
        
        // Aplicar modo compacto
        if (this.state.settings.compact) {
            this.widgetContainer.classList.add('compact-mode');
        } else {
            this.widgetContainer.classList.remove('compact-mode');
        }
    }
    
    /**
     * Renderiza la biblioteca de widgets disponibles
     * @private
     */
    _renderWidgetLibrary() {
        // Asegurarse de que existe el contenedor
        if (!this.widgetLibrary) return;
        
        // Limpiar contenido existente
        this.widgetLibrary.innerHTML = '';
        
        // Crear encabezado
        const header = document.createElement('div');
        header.className = 'widget-library-header';
        header.innerHTML = '<h3>Widgets Disponibles</h3>';
        this.widgetLibrary.appendChild(header);
        
        // Crear lista de widgets
        const widgetList = document.createElement('div');
        widgetList.className = 'widget-library-list';
        
        // Añadir cada widget registrado
        this.registeredWidgets.forEach((widgetInfo, type) => {
            const widgetItem = document.createElement('div');
            widgetItem.className = 'widget-library-item';
            widgetItem.setAttribute('data-widget-type', type);
            
            widgetItem.innerHTML = `
                <div class="widget-library-icon">
                    <i class="icon-${widgetInfo.icon}"></i>
                </div>
                <div class="widget-library-info">
                    <div class="widget-library-title">${widgetInfo.title}</div>
                    <div class="widget-library-description">${widgetInfo.description || ''}</div>
                </div>
            `;
            
            // Añadir evento para añadir widget al hacer clic
            widgetItem.addEventListener('click', () => {
                this.addWidget(type);
            });
            
            widgetList.appendChild(widgetItem);
        });
        
        this.widgetLibrary.appendChild(widgetList);
    }
    
    /**
     * Abre el diálogo de configuración de un widget
     * @param {string} widgetId - ID del widget
     * @private
     */
    _openWidgetConfig(widgetId) {
        // Encontrar el widget en la disposición
        const widget = this.state.layout.find(w => w.id === widgetId);
        if (!widget) return;
        
        // Obtener información del tipo de widget
        const widgetInfo = this.registeredWidgets.get(widget.type);
        if (!widgetInfo) return;
        
        // Aquí se implementaría la apertura de un modal de configuración
        // Simplificado para este ejemplo:
        const configStr = JSON.stringify(widget.config, null, 2);
        const newConfig = prompt(`Configuración para ${widgetInfo.title}:`, configStr);
        
        if (newConfig) {
            try {
                const parsedConfig = JSON.parse(newConfig);
                this.updateWidgetConfig(widgetId, parsedConfig);
            } catch (e) {
                alert('Error: Formato JSON inválido');
            }
        }
    }
    
    /**
     * Inicializa funcionalidad de arrastrar y soltar para los widgets
     * @private
     */
    _initDragAndDrop() {
        // La implementación de arrastrar y soltar se realiza por widget en _setupWidgetDragAndResize
    }
    
    /**
     * Limpia todos los widgets activos
     * @private
     */
    _clearAllWidgets() {
        // Limpiar todos los intervalos
        for (const intervalId of Object.values(this.state.autoRefreshIntervals)) {
            clearInterval(intervalId);
        }
        this.state.autoRefreshIntervals = {};
        
        // Destruir instancias de widgets
        for (const [widgetId, widgetInstance] of Object.entries(this.state.activeWidgets)) {
            if (widgetInstance && typeof widgetInstance.destroy === 'function') {
                widgetInstance.destroy();
            }
        }
        this.state.activeWidgets = {};
        
        // Limpiar contenedor de widgets
        this.widgetContainer.innerHTML = '';
    }
    
    /**
     * Maneja actualizaciones de datos de widgets
     * @param {string} widgetId - ID del widget
     * @param {Object} data - Datos actualizados
     * @private
     */
    _handleWidgetUpdate(widgetId, data) {
        // Emitir evento de actualización de datos
        this._triggerEvent('widgetData', 'update', { widgetId, data });
    }
    
    /**
     * Maneja acciones iniciadas por widgets
     * @param {string} widgetId - ID del widget
     * @param {string} action - Acción realizada
     * @param {Object} data - Datos adicionales
     * @private
     */
    _handleWidgetAction(widgetId, action, data) {
        // Emitir evento de acción
        this._triggerEvent('widgetAction', action, { widgetId, data });
        
        // Manejar acciones especiales si es necesario
        if (action === 'resize') {
            // El widget solicita cambiar su tamaño
            if (data && data.size) {
                this.updateWidgetPosition(widgetId, data.size);
            }
        } else if (action === 'refresh') {
            // El widget solicita actualización
            this.refreshWidget(widgetId);
        }
    }
    
    /**
     * Dispara eventos para los suscriptores
     * @param {string} eventType - Tipo de evento
     * @param {string} eventName - Nombre del evento
     * @param {Object} data - Datos del evento
     * @private
     */
    _triggerEvent(eventType, eventName, data) {
        if (!this.eventListeners[eventType] || !this.eventListeners[eventType].has(eventName)) {
            return;
        }
        
        const listeners = this.eventListeners[eventType].get(eventName);
        listeners.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error en listener de evento ${eventType}.${eventName}:`, error);
            }
        });
    }
}

/**
 * Clase base para widgets del dashboard
 * Los desarrolladores pueden extender esta clase para crear widgets personalizados
 */
export class DashboardWidget {
    constructor(options) {
        this.container = typeof options.containerId === 'string' 
            ? document.getElementById(options.containerId) 
            : options.containerId;
        
        this.config = options.config || {};
        this.marketDataService = options.marketDataService;
        this.onUpdate = options.onUpdate || (() => {});
        this.onAction = options.onAction || (() => {});
    }
    
    /**
     * Inicializa el widget
     */
    async init() {
        // Implementación base
        this.render();
        return true;
    }
    
    /**
     * Renderiza el contenido del widget
     */
    render() {
        // Debe ser implementado por las subclases
        this.container.innerHTML = '<div class="widget-not-implemented">Widget no implementado</div>';
    }
    
    /**
     * Actualiza la configuración del widget
     * @param {Object} newConfig - Nueva configuración
     */
    updateConfig(newConfig) {
        this.config = {
            ...this.config,
            ...newConfig
        };
        
        // Re-renderizar con la nueva configuración
        this.render();
    }
    
    /**
     * Actualiza los datos del widget
     */
    refresh() {
        // Debe ser implementado por las subclases
    }
    
    /**
     * Limpia los recursos del widget
     */
    destroy() {
        // Implementación base
        this.container.innerHTML = '';
    }
    
    /**
     * Envía datos actualizados a los suscriptores
     * @param {Object} data - Datos a enviar
     */
    emitUpdate(data) {
        if (typeof this.onUpdate === 'function') {
            this.onUpdate(data);
        }
    }
    
    /**
     * Envía una acción a los suscriptores
     * @param {string} action - Nombre de la acción
     * @param {Object} data - Datos asociados a la acción
     */
    emitAction(action, data) {
        if (typeof this.onAction === 'function') {
            this.onAction(action, data);
        }
    }
}

// Exportar instancia predeterminada para uso rápido
export const dashboardController = new DashboardController();
