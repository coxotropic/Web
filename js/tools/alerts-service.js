/**
 * alerts-service.js
 * Servicio para gestionar las alertas de precio y eventos en el portal de criptomonedas.
 * Este servicio permite crear, editar, eliminar y activar alertas basadas en diferentes
 * condiciones como precio, cambio porcentual y volumen.
 */

// Importaciones necesarias
import { EventBus } from '../utils/event-bus.js';
import { StorageManager } from '../utils/storage-manager.js';
import { MarketDataService } from '../market/market-data-service.js';
import { NotificationService } from '../user/notification-service.js';

/**
 * Tipos de alerta soportados
 * @enum {string}
 */
export const AlertType = {
    PRICE_ABOVE: 'price_above',
    PRICE_BELOW: 'price_below',
    PERCENT_CHANGE: 'percent_change',
    VOLUME_SPIKE: 'volume_spike',
    MARKET_CAP: 'market_cap'
};

/**
 * Estados posibles de una alerta
 * @enum {string}
 */
export const AlertStatus = {
    ACTIVE: 'active',
    TRIGGERED: 'triggered',
    EXPIRED: 'expired',
    DISABLED: 'disabled'
};

/**
 * Opciones de repetición para alertas
 * @enum {string}
 */
export const RepeatOption = {
    ONCE: 'once',
    ALWAYS: 'always',
    DAILY: 'daily',
    HOURLY: 'hourly'
};

/**
 * Servicio principal para la gestión de alertas
 */
export class AlertsService {
    /**
     * @constructor
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        // Opciones por defecto
        this.options = {
            checkInterval: 60000, // Intervalo de verificación: 1 minuto por defecto
            storageKey: 'crypto.alerts',
            historyKey: 'crypto.alerts.history',
            maxHistoryItems: 100,
            maxAlertsPerUser: 50,
            ...options
        };

        // Servicios dependientes
        this.marketDataService = new MarketDataService();
        this.notificationService = new NotificationService();
        
        // Estado interno
        this.alerts = [];
        this.alertsHistory = [];
        this.checkIntervalId = null;
        this.isInitialized = false;
        
        // Estadísticas
        this.stats = {
            active: 0,
            triggered: 0,
            pending: 0,
            total: 0
        };
        
        // Métodos vinculados para mantener el contexto
        this.checkAlerts = this.checkAlerts.bind(this);
    }
    
    /**
     * Inicializa el servicio de alertas
     * @returns {Promise<void>}
     */
    async init() {
        if (this.isInitialized) {
            console.warn('El servicio de alertas ya está inicializado');
            return;
        }
        
        try {
            console.log('Inicializando servicio de alertas...');
            
            // Cargar alertas desde almacenamiento
            await this.loadAlerts();
            
            // Cargar historial
            await this.loadAlertsHistory();
            
            // Actualizar estadísticas
            this.updateStats();
            
            // Iniciar verificación periódica
            this.startChecking();
            
            // Suscribirse a eventos relevantes
            this.setupEventListeners();
            
            this.isInitialized = true;
            console.log('Servicio de alertas inicializado con éxito');
            
            // Notificar que el servicio está listo
            EventBus.publish('alerts.initialized', { service: this });
            
            return true;
        } catch (error) {
            console.error('Error al inicializar el servicio de alertas:', error);
            throw error;
        }
    }
    
    /**
     * Configura los escuchadores de eventos
     * @private
     */
    setupEventListeners() {
        // Escuchar actualizaciones de precio para verificar alertas relevantes
        EventBus.subscribe('market.priceUpdate', data => {
            // Verificar solo alertas relacionadas con la moneda actualizada para optimizar
            this.checkSpecificAlerts(data.coin, data);
        });
        
        // Escuchar cambios de red
        window.addEventListener('online', () => {
            console.log('Conexión restaurada, reiniciando verificación de alertas');
            this.startChecking();
        });
        
        window.addEventListener('offline', () => {
            console.log('Conexión perdida, pausando verificación de alertas');
            this.stopChecking();
        });
    }
    
    /**
     * Carga las alertas desde el almacenamiento
     * @private
     * @returns {Promise<void>}
     */
    async loadAlerts() {
        try {
            const storedAlerts = await StorageManager.get(this.options.storageKey);
            
            if (storedAlerts && Array.isArray(storedAlerts)) {
                this.alerts = storedAlerts;
                console.log(`Cargadas ${this.alerts.length} alertas desde almacenamiento`);
            } else {
                this.alerts = [];
                console.log('No se encontraron alertas guardadas, inicializando lista vacía');
            }
        } catch (error) {
            console.error('Error al cargar alertas:', error);
            this.alerts = [];
        }
    }
    
    /**
     * Carga el historial de alertas desde el almacenamiento
     * @private
     * @returns {Promise<void>}
     */
    async loadAlertsHistory() {
        try {
            const storedHistory = await StorageManager.get(this.options.historyKey);
            
            if (storedHistory && Array.isArray(storedHistory)) {
                this.alertsHistory = storedHistory;
                console.log(`Cargados ${this.alertsHistory.length} registros de historial`);
            } else {
                this.alertsHistory = [];
                console.log('No se encontró historial, inicializando lista vacía');
            }
        } catch (error) {
            console.error('Error al cargar historial de alertas:', error);
            this.alertsHistory = [];
        }
    }
    
    /**
     * Guarda las alertas en el almacenamiento
     * @private
     * @returns {Promise<void>}
     */
    async saveAlerts() {
        try {
            await StorageManager.set(this.options.storageKey, this.alerts);
        } catch (error) {
            console.error('Error al guardar alertas:', error);
            // Notificar error
            EventBus.publish('alerts.error', { 
                message: 'Error al guardar alertas', 
                error 
            });
        }
    }
    
    /**
     * Guarda el historial de alertas en el almacenamiento
     * @private
     * @returns {Promise<void>}
     */
    async saveAlertsHistory() {
        try {
            // Limitar el tamaño del historial
            if (this.alertsHistory.length > this.options.maxHistoryItems) {
                this.alertsHistory = this.alertsHistory.slice(-this.options.maxHistoryItems);
            }
            
            await StorageManager.set(this.options.historyKey, this.alertsHistory);
        } catch (error) {
            console.error('Error al guardar historial de alertas:', error);
        }
    }
    
    /**
     * Inicia la verificación periódica de alertas
     */
    startChecking() {
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
        }
        
        // Verificar inmediatamente al iniciar
        this.checkAlerts();
        
        // Configurar verificación periódica
        this.checkIntervalId = setInterval(this.checkAlerts, this.options.checkInterval);
        console.log(`Verificación de alertas iniciada (intervalo: ${this.options.checkInterval}ms)`);
    }
    
    /**
     * Detiene la verificación periódica de alertas
     */
    stopChecking() {
        if (this.checkIntervalId) {
            clearInterval(this.checkIntervalId);
            this.checkIntervalId = null;
            console.log('Verificación de alertas detenida');
        }
    }
    
    /**
     * Verifica todas las alertas activas
     * @async
     */
    async checkAlerts() {
        try {
            const activeAlerts = this.alerts.filter(alert => 
                alert.status === AlertStatus.ACTIVE || 
                alert.status === AlertStatus.PENDING
            );
            
            if (activeAlerts.length === 0) {
                return;
            }
            
            console.log(`Verificando ${activeAlerts.length} alertas activas...`);
            
            // Agrupar alertas por moneda para minimizar llamadas a la API
            const alertsByCoin = this.groupAlertsByCoin(activeAlerts);
            
            // Verificar cada grupo de alertas
            for (const [coinId, alerts] of Object.entries(alertsByCoin)) {
                try {
                    // Obtener datos actuales de la moneda
                    const coinData = await this.marketDataService.getCoinData(coinId);
                    
                    if (!coinData) {
                        console.warn(`No se pudieron obtener datos para ${coinId}, omitiendo verificación de alertas`);
                        continue;
                    }
                    
                    // Verificar cada alerta para esta moneda
                    for (const alert of alerts) {
                        this.evaluateAlert(alert, coinData);
                    }
                } catch (error) {
                    console.error(`Error al verificar alertas para ${coinId}:`, error);
                }
            }
            
            // Guardar cambios después de verificar todas las alertas
            await this.saveAlerts();
            await this.saveAlertsHistory();
            
            // Actualizar estadísticas
            this.updateStats();
            
        } catch (error) {
            console.error('Error al verificar alertas:', error);
        }
    }
    
    /**
     * Verifica alertas específicas para una moneda
     * @param {string} coinId - Identificador de la moneda
     * @param {Object} coinData - Datos actuales de la moneda
     */
    checkSpecificAlerts(coinId, coinData) {
        if (!coinId || !coinData) return;
        
        const coinAlerts = this.alerts.filter(alert => 
            alert.coinId === coinId && 
            (alert.status === AlertStatus.ACTIVE || alert.status === AlertStatus.PENDING)
        );
        
        if (coinAlerts.length === 0) return;
        
        // Verificar cada alerta para esta moneda
        for (const alert of coinAlerts) {
            this.evaluateAlert(alert, coinData);
        }
        
        // Guardar cambios
        this.saveAlerts();
        this.saveAlertsHistory();
        
        // Actualizar estadísticas
        this.updateStats();
    }
    
    /**
     * Evalúa si una alerta debe activarse según los datos actuales
     * @param {Object} alert - Alerta a evaluar
     * @param {Object} coinData - Datos actuales de la moneda
     * @returns {boolean} - Verdadero si la alerta se activó
     */
    evaluateAlert(alert, coinData) {
        if (!alert || !coinData) return false;
        
        let isTriggered = false;
        
        // Obtener el precio actual y otros datos relevantes
        const currentPrice = coinData.price || coinData.current_price || 0;
        const currentVolume = coinData.volume || coinData.total_volume || 0;
        const marketCap = coinData.market_cap || 0;
        const priceChange24h = coinData.price_change_percentage_24h || 0;
        
        // Evaluar según el tipo de alerta
        switch (alert.type) {
            case AlertType.PRICE_ABOVE:
                isTriggered = currentPrice >= alert.targetValue;
                break;
                
            case AlertType.PRICE_BELOW:
                isTriggered = currentPrice <= alert.targetValue;
                break;
                
            case AlertType.PERCENT_CHANGE:
                // Si es cambio porcentual, el valor objetivo es un porcentaje
                if (alert.direction === 'up') {
                    isTriggered = priceChange24h >= alert.targetValue;
                } else {
                    isTriggered = priceChange24h <= -alert.targetValue;
                }
                break;
                
            case AlertType.VOLUME_SPIKE:
                // Si es pico de volumen, el valor objetivo es un multiplicador del volumen normal
                const averageVolume = alert.averageVolume || currentVolume;
                isTriggered = currentVolume >= (averageVolume * alert.targetValue);
                break;
                
            case AlertType.MARKET_CAP:
                if (alert.direction === 'above') {
                    isTriggered = marketCap >= alert.targetValue;
                } else {
                    isTriggered = marketCap <= alert.targetValue;
                }
                break;
                
            default:
                console.warn(`Tipo de alerta no reconocido: ${alert.type}`);
                return false;
        }
        
        // Si la alerta se disparó
        if (isTriggered) {
            this.triggerAlert(alert, coinData);
            return true;
        }
        
        return false;
    }
    
    /**
     * Activa una alerta y realiza las acciones correspondientes
     * @param {Object} alert - Alerta a activar
     * @param {Object} coinData - Datos actuales de la moneda
     */
    triggerAlert(alert, coinData) {
        console.log(`¡Alerta activada! ${alert.name || alert.id}`);
        
        // Actualizar estado de la alerta
        const previousStatus = alert.status;
        alert.status = AlertStatus.TRIGGERED;
        alert.triggeredAt = new Date().toISOString();
        alert.triggeredData = {
            price: coinData.price || coinData.current_price,
            volume: coinData.volume || coinData.total_volume,
            marketCap: coinData.market_cap,
            changePercentage: coinData.price_change_percentage_24h
        };
        
        // Añadir al historial
        this.addToHistory(alert, coinData);
        
        // Si es repetible, restaurar a activo después de un tiempo
        if (alert.repeat !== RepeatOption.ONCE) {
            // Para repetición diaria, horaria, etc.
            const repeatDelay = this.getRepeatDelay(alert.repeat);
            
            if (repeatDelay > 0) {
                setTimeout(() => {
                    alert.status = AlertStatus.ACTIVE;
                    this.saveAlerts();
                }, repeatDelay);
            } else {
                // Si es "siempre", reactivar inmediatamente
                alert.status = AlertStatus.ACTIVE;
            }
        }
        
        // Enviar notificación
        this.sendAlertNotification(alert, coinData);
        
        // Emitir evento de alerta activada
        EventBus.publish('alerts.triggered', { 
            alert, 
            coinData,
            previousStatus
        });
    }
    
    /**
     * Añade una alerta activada al historial
     * @param {Object} alert - Alerta activada
     * @param {Object} coinData - Datos de la moneda en el momento de activación
     */
    addToHistory(alert, coinData) {
        const historyItem = {
            id: `hist_${Date.now()}_${alert.id}`,
            alertId: alert.id,
            coinId: alert.coinId,
            coinSymbol: alert.coinSymbol,
            type: alert.type,
            targetValue: alert.targetValue,
            direction: alert.direction,
            triggeredAt: new Date().toISOString(),
            price: coinData.price || coinData.current_price,
            volume: coinData.volume || coinData.total_volume,
            marketCap: coinData.market_cap
        };
        
        this.alertsHistory.unshift(historyItem);
        
        // Limitar tamaño del historial
        if (this.alertsHistory.length > this.options.maxHistoryItems) {
            this.alertsHistory = this.alertsHistory.slice(0, this.options.maxHistoryItems);
        }
    }
    
    /**
     * Envía una notificación para una alerta activada
     * @param {Object} alert - Alerta activada
     * @param {Object} coinData - Datos de la moneda
     */
    sendAlertNotification(alert, coinData) {
        const price = coinData.price || coinData.current_price;
        
        // Crear mensaje según tipo de alerta
        let title, message;
        
        switch(alert.type) {
            case AlertType.PRICE_ABOVE:
                title = `${alert.coinSymbol} superó el precio objetivo`;
                message = `${alert.coinSymbol} ha alcanzado $${price.toLocaleString()} (objetivo: $${alert.targetValue.toLocaleString()})`;
                break;
                
            case AlertType.PRICE_BELOW:
                title = `${alert.coinSymbol} cayó por debajo del precio objetivo`;
                message = `${alert.coinSymbol} ha caído a $${price.toLocaleString()} (objetivo: $${alert.targetValue.toLocaleString()})`;
                break;
                
            case AlertType.PERCENT_CHANGE:
                const direction = alert.direction === 'up' ? 'subido' : 'bajado';
                title = `${alert.coinSymbol} ha ${direction} más de ${alert.targetValue}%`;
                message = `${alert.coinSymbol} ha ${direction} un ${Math.abs(coinData.price_change_percentage_24h).toFixed(2)}% en las últimas 24h`;
                break;
                
            case AlertType.VOLUME_SPIKE:
                title = `Pico de volumen en ${alert.coinSymbol}`;
                message = `El volumen de ${alert.coinSymbol} ha aumentado significativamente a $${coinData.volume.toLocaleString()}`;
                break;
                
            default:
                title = `Alerta de ${alert.coinSymbol}`;
                message = `Se ha activado tu alerta para ${alert.coinSymbol}`;
        }
        
        // Enviar notificación a través del servicio de notificaciones
        this.notificationService.notify({
            type: 'price_alert',
            title,
            message,
            data: {
                alertId: alert.id,
                coinId: alert.coinId,
                coinSymbol: alert.coinSymbol,
                price,
                targetValue: alert.targetValue,
                type: alert.type
            },
            actions: [
                {
                    label: 'Ver detalles',
                    action: 'view_coin',
                    url: `/crypto/${alert.coinId}`
                },
                {
                    label: 'Editar alerta',
                    action: 'edit_alert',
                    url: `/tools/alerts?edit=${alert.id}`
                }
            ],
            priority: 'high',
            icon: `assets/icons/crypto/${alert.coinId}.svg`
        });
    }
    
    /**
     * Obtiene el tiempo de espera para repetir una alerta según su configuración
     * @param {string} repeatOption - Opción de repetición
     * @returns {number} - Tiempo en milisegundos
     */
    getRepeatDelay(repeatOption) {
        switch (repeatOption) {
            case RepeatOption.ALWAYS:
                return 0; // Sin retraso
            case RepeatOption.HOURLY:
                return 60 * 60 * 1000; // 1 hora
            case RepeatOption.DAILY:
                return 24 * 60 * 60 * 1000; // 24 horas
            default:
                return 0;
        }
    }
    
    /**
     * Agrupa alertas por moneda para optimizar verificaciones
     * @param {Array} alerts - Lista de alertas
     * @returns {Object} - Alertas agrupadas por coinId
     * @private
     */
    groupAlertsByCoin(alerts) {
        const result = {};
        
        for (const alert of alerts) {
            if (!alert.coinId) continue;
            
            if (!result[alert.coinId]) {
                result[alert.coinId] = [];
            }
            
            result[alert.coinId].push(alert);
        }
        
        return result;
    }
    
    /**
     * Actualiza las estadísticas de alertas
     * @private
     */
    updateStats() {
        this.stats = {
            active: this.alerts.filter(alert => alert.status === AlertStatus.ACTIVE).length,
            triggered: this.alerts.filter(alert => alert.status === AlertStatus.TRIGGERED).length,
            pending: this.alerts.filter(alert => alert.status === AlertStatus.PENDING).length,
            total: this.alerts.length
        };
        
        // Notificar actualización de estadísticas
        EventBus.publish('alerts.stats', this.stats);
    }
    
    /**
     * Crea una nueva alerta
     * @param {Object} alertData - Datos de la alerta
     * @returns {Promise<Object>} - La alerta creada
     */
    async createAlert(alertData) {
        try {
            // Validar datos de entrada
            this.validateAlertData(alertData);
            
            // Verificar límite de alertas por usuario
            if (this.alerts.length >= this.options.maxAlertsPerUser) {
                throw new Error(`Límite de alertas alcanzado (${this.options.maxAlertsPerUser})`);
            }
            
            // Crear objeto de alerta
            const newAlert = {
                id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                status: AlertStatus.ACTIVE,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                repeat: RepeatOption.ONCE,
                notificationChannels: ['app', 'email'],
                ...alertData
            };
            
            // Añadir alerta a la lista
            this.alerts.push(newAlert);
            
            // Guardar cambios
            await this.saveAlerts();
            
            // Actualizar estadísticas
            this.updateStats();
            
            // Notificar creación
            EventBus.publish('alerts.created', { alert: newAlert });
            
            return newAlert;
        } catch (error) {
            console.error('Error al crear alerta:', error);
            
            // Notificar error
            EventBus.publish('alerts.error', { 
                action: 'create', 
                message: error.message, 
                error 
            });
            
            throw error;
        }
    }
    
    /**
     * Valida los datos de una alerta
     * @param {Object} data - Datos a validar
     * @throws {Error} Si los datos son inválidos
     * @private
     */
    validateAlertData(data) {
        if (!data.coinId) {
            throw new Error('Se requiere el ID de la criptomoneda');
        }
        
        if (!data.coinSymbol) {
            throw new Error('Se requiere el símbolo de la criptomoneda');
        }
        
        if (!data.type || !Object.values(AlertType).includes(data.type)) {
            throw new Error(`Tipo de alerta inválido: ${data.type}`);
        }
        
        if (data.targetValue === undefined || data.targetValue === null || isNaN(data.targetValue)) {
            throw new Error('Se requiere un valor objetivo válido');
        }
        
        // Validaciones específicas según tipo
        if (data.type === AlertType.PERCENT_CHANGE && !data.direction) {
            throw new Error('Se requiere la dirección del cambio porcentual (up/down)');
        }
    }
    
    /**
     * Actualiza una alerta existente
     * @param {string} alertId - ID de la alerta a actualizar
     * @param {Object} updateData - Datos a actualizar
     * @returns {Promise<Object>} - La alerta actualizada
     */
    async updateAlert(alertId, updateData) {
        try {
            // Buscar la alerta
            const alertIndex = this.alerts.findIndex(a => a.id === alertId);
            
            if (alertIndex === -1) {
                throw new Error(`Alerta no encontrada: ${alertId}`);
            }
            
            const alert = this.alerts[alertIndex];
            
            // Actualizar campos
            const updatedAlert = {
                ...alert,
                ...updateData,
                updatedAt: new Date().toISOString()
            };
            
            // Validar datos actualizados
            this.validateAlertData(updatedAlert);
            
            // Guardar alerta actualizada
            this.alerts[alertIndex] = updatedAlert;
            
            // Guardar cambios
            await this.saveAlerts();
            
            // Actualizar estadísticas
            this.updateStats();
            
            // Notificar actualización
            EventBus.publish('alerts.updated', { 
                alert: updatedAlert, 
                previousAlert: alert 
            });
            
            return updatedAlert;
        } catch (error) {
            console.error(`Error al actualizar alerta ${alertId}:`, error);
            
            // Notificar error
            EventBus.publish('alerts.error', { 
                action: 'update', 
                alertId, 
                message: error.message, 
                error 
            });
            
            throw error;
        }
    }
    
    /**
     * Elimina una alerta
     * @param {string} alertId - ID de la alerta a eliminar
     * @returns {Promise<boolean>} - true si la operación fue exitosa
     */
    async deleteAlert(alertId) {
        try {
            // Buscar la alerta
            const alertIndex = this.alerts.findIndex(a => a.id === alertId);
            
            if (alertIndex === -1) {
                throw new Error(`Alerta no encontrada: ${alertId}`);
            }
            
            const deletedAlert = this.alerts[alertIndex];
            
            // Eliminar alerta
            this.alerts.splice(alertIndex, 1);
            
            // Guardar cambios
            await this.saveAlerts();
            
            // Actualizar estadísticas
            this.updateStats();
            
            // Notificar eliminación
            EventBus.publish('alerts.deleted', { alert: deletedAlert });
            
            return true;
        } catch (error) {
            console.error(`Error al eliminar alerta ${alertId}:`, error);
            
            // Notificar error
            EventBus.publish('alerts.error', { 
                action: 'delete', 
                alertId, 
                message: error.message, 
                error 
            });
            
            return false;
        }
    }
    
    /**
     * Cambia el estado de una alerta
     * @param {string} alertId - ID de la alerta
     * @param {string} newStatus - Nuevo estado
     * @returns {Promise<Object>} - La alerta actualizada
     */
    async changeAlertStatus(alertId, newStatus) {
        if (!Object.values(AlertStatus).includes(newStatus)) {
            throw new Error(`Estado inválido: ${newStatus}`);
        }
        
        // Usar updateAlert para cambiar el estado
        return this.updateAlert(alertId, { status: newStatus });
    }
    
    /**
     * Obtiene una alerta por su ID
     * @param {string} alertId - ID de la alerta
     * @returns {Object|null} - La alerta o null si no se encuentra
     */
    getAlert(alertId) {
        return this.alerts.find(a => a.id === alertId) || null;
    }
    
    /**
     * Obtiene todas las alertas
     * @param {Object} filters - Filtros a aplicar
     * @returns {Array} - Lista de alertas filtradas
     */
    getAlerts(filters = {}) {
        let result = [...this.alerts];
        
        // Aplicar filtros
        if (filters.status) {
            result = result.filter(a => a.status === filters.status);
        }
        
        if (filters.coinId) {
            result = result.filter(a => a.coinId === filters.coinId);
        }
        
        if (filters.type) {
            result = result.filter(a => a.type === filters.type);
        }
        
        // Aplicar ordenación
        if (filters.sort) {
            result = this.sortAlerts(result, filters.sort);
        } else {
            // Por defecto, ordenar por fecha de creación (más recientes primero)
            result = this.sortAlerts(result, 'created_desc');
        }
        
        return result;
    }
    
    /**
     * Ordena una lista de alertas
     * @param {Array} alerts - Lista de alertas a ordenar
     * @param {string} sortOption - Opción de ordenación
     * @returns {Array} - Lista ordenada
     * @private
     */
    sortAlerts(alerts, sortOption) {
        switch (sortOption) {
            case 'created_asc':
                return alerts.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
                
            case 'created_desc':
                return alerts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                
            case 'updated_asc':
                return alerts.sort((a, b) => new Date(a.updatedAt) - new Date(b.updatedAt));
                
            case 'updated_desc':
                return alerts.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                
            case 'coin_asc':
                return alerts.sort((a, b) => a.coinSymbol.localeCompare(b.coinSymbol));
                
            case 'coin_desc':
                return alerts.sort((a, b) => b.coinSymbol.localeCompare(a.coinSymbol));
                
            case 'value_asc':
                return alerts.sort((a, b) => a.targetValue - b.targetValue);
                
            case 'value_desc':
                return alerts.sort((a, b) => b.targetValue - a.targetValue);
                
            default:
                return alerts;
        }
    }
    
    /**
     * Obtiene el historial de alertas
     * @param {Object} filters - Filtros a aplicar
     * @returns {Array} - Historial de alertas
     */
    getAlertsHistory(filters = {}) {
        let result = [...this.alertsHistory];
        
        // Aplicar filtros
        if (filters.coinId) {
            result = result.filter(h => h.coinId === filters.coinId);
        }
        
        if (filters.type) {
            result = result.filter(h => h.type === filters.type);
        }
        
        if (filters.dateFrom) {
            const fromDate = new Date(filters.dateFrom);
            result = result.filter(h => new Date(h.triggeredAt) >= fromDate);
        }
        
        if (filters.dateTo) {
            const toDate = new Date(filters.dateTo);
            result = result.filter(h => new Date(h.triggeredAt) <= toDate);
        }
        
        // Aplicar ordenación (por defecto, más recientes primero)
        if (filters.sort === 'oldest') {
            result = result.sort((a, b) => new Date(a.triggeredAt) - new Date(b.triggeredAt));
        } else {
            result = result.sort((a, b) => new Date(b.triggeredAt) - new Date(a.triggeredAt));
        }
        
        // Aplicar límite
        if (filters.limit && filters.limit > 0) {
            result = result.slice(0, filters.limit);
        }
        
        return result;
    }
    
    /**
     * Limpia el historial de alertas
     * @returns {Promise<boolean>} - true si la operación fue exitosa
     */
    async clearHistory() {
        try {
            this.alertsHistory = [];
            await this.saveAlertsHistory();
            
            // Notificar limpieza
            EventBus.publish('alerts.historyCleared');
            
            return true;
        } catch (error) {
            console.error('Error al limpiar historial de alertas:', error);
            
            // Notificar error
            EventBus.publish('alerts.error', { 
                action: 'clearHistory', 
                message: error.message, 
                error 
            });
            
            return false;
        }
    }
    
    /**
     * Obtiene estadísticas de alertas
     * @returns {Object} - Estadísticas
     */
    getStats() {
        return { ...this.stats };
    }
    
    /**
     * Exporta todas las alertas a formato JSON
     * @returns {string} - JSON con las alertas
     */
    exportAlerts() {
        try {
            return JSON.stringify({
                alerts: this.alerts,
                exportDate: new Date().toISOString(),
                version: '1.0'
            });
        } catch (error) {
            console.error('Error al exportar alertas:', error);
            throw error;
        }
    }
    
    /**
     * Importa alertas desde formato JSON
     * @param {string} jsonData - Datos JSON a importar
     * @param {Object} options - Opciones de importación
     * @returns {Promise<Object>} - Resultado de la importación
     */
    async importAlerts(jsonData, options = { merge: true }) {
        try {
            const importedData = JSON.parse(jsonData);
            
            if (!importedData || !Array.isArray(importedData.alerts)) {
                throw new Error('Formato de datos inválido');
            }
            
            // Validar alertas importadas
            const validAlerts = [];
            const invalidAlerts = [];
            
            for (const alert of importedData.alerts) {
                try {
                    this.validateAlertData(alert);
                    validAlerts.push(alert);
                } catch (error) {
                    invalidAlerts.push({ alert, error: error.message });
                }
            }
            
            // Aplicar importación según modo
            if (options.merge) {
                // Modo fusionar: añadir nuevas alertas
                const existingIds = new Set(this.alerts.map(a => a.id));
                const newAlerts = validAlerts.filter(a => !existingIds.has(a.id));
                
                this.alerts = [...this.alerts, ...newAlerts];
            } else {
                // Modo reemplazar: sustituir todas las alertas
                this.alerts = validAlerts;
            }
            
            // Guardar cambios
            await this.saveAlerts();
            
            // Actualizar estadísticas
            this.updateStats();
            
            // Notificar importación
            EventBus.publish('alerts.imported', { 
                count: validAlerts.length,
                invalid: invalidAlerts.length,
                mode: options.merge ? 'merge' : 'replace'
            });
            
            return {
                success: true,
                imported: validAlerts.length,
                invalid: invalidAlerts.length,
                invalidAlerts
            };
        } catch (error) {
            console.error('Error al importar alertas:', error);
            
            // Notificar error
            EventBus.publish('alerts.error', { 
                action: 'import', 
                message: error.message, 
                error 
            });
            
            throw error;
        }
    }
}

// Exportar instancia predeterminada para uso rápido
export const alertsService = new AlertsService();
