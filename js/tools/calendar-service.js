/**
 * calendar-service.js
 * Servicio para gestionar el calendario de eventos de criptomonedas
 * 
 * Este servicio proporciona funcionalidades para gestionar, filtrar y visualizar
 * eventos relacionados con criptomonedas, incluyendo lanzamientos, actualizaciones,
 * conferencias, etc.
 * 
 * @version 1.0.0
 * @author Coxotropic CryptoInvest Team
 */

import { MarketDataService } from '../market/market-data-service.js';
import { EventBus } from '../utils/event-bus.js';
import { StorageManager } from '../utils/storage-manager.js';
import { NotificationService } from '../user/notification-service.js';

export class CalendarService {
    /**
     * Constructor del servicio de calendario
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        // Opciones por defecto
        this.options = {
            refreshInterval: 3600000, // 1 hora en ms
            maxCacheAge: 86400000, // 24 horas en ms para caché
            defaultView: 'month',   // 'day', 'week', 'month'
            eventSources: [
                'coinmarketcal', 
                'cryptocompare',
                'coindar',
                'blockfolio',
                'user' // Eventos añadidos por el usuario
            ],
            autoRefresh: true,
            ...options
        };

        // Servicios necesarios
        this.marketDataService = new MarketDataService();
        this.notificationService = new NotificationService();
        
        // Almacenamiento de eventos
        this.events = [];
        this.userEvents = [];
        
        // Estado interno
        this.currentView = this.options.defaultView;
        this.filters = {
            categories: [],
            coins: [],
            importance: [], // 'high', 'medium', 'low'
            dateRange: {
                start: null,
                end: null
            }
        };
        
        // Estado de caché
        this.lastUpdated = null;
        this.isUpdating = false;
        this.refreshInterval = null;
        
        // Inicializar
        if (this.options.autoRefresh) {
            this.init();
        }
    }
    
    /**
     * Inicializa el servicio de calendario
     */
    async init() {
        console.log('Inicializando CalendarService...');
        
        try {
            // Cargar eventos de caché si existen
            await this._loadFromCache();
            
            // Obtener eventos actualizados
            await this.refreshEvents();
            
            // Configurar actualización periódica
            this._setupAutoRefresh();
            
            // Configurar escuchadores de eventos
            this._setupEventListeners();
            
            // Notificar que el calendario está listo
            EventBus.publish('calendar.ready', { 
                eventsCount: this.events.length 
            });
            
            console.log(`CalendarService inicializado con ${this.events.length} eventos`);
        } catch (error) {
            console.error('Error al inicializar CalendarService:', error);
            EventBus.publish('calendar.error', { error });
        }
    }
    
    /**
     * Obtiene eventos actualizados de todas las fuentes configuradas
     * @returns {Promise<Array>} Lista actualizada de eventos
     */
    async refreshEvents() {
        if (this.isUpdating) {
            console.log('Ya hay una actualización en progreso');
            return this.events;
        }
        
        this.isUpdating = true;
        console.log('Actualizando eventos del calendario...');
        
        try {
            // Obtener eventos de cada fuente configurada
            const eventPromises = this.options.eventSources
                .filter(source => source !== 'user') // Filtrar eventos de usuario
                .map(source => this._fetchEventsFromSource(source));
            
            // Esperar a que se resuelvan todas las promesas
            const eventsBySource = await Promise.allSettled(eventPromises);
            
            // Filtrar y aplanar los resultados
            const newEvents = eventsBySource
                .filter(result => result.status === 'fulfilled')
                .flatMap(result => result.value);
                
            // Añadir eventos del usuario
            const allEvents = [...newEvents, ...this.userEvents];
            
            // Eliminar duplicados
            this.events = this._removeDuplicateEvents(allEvents);
            
            // Ordenar por fecha
            this.events.sort((a, b) => new Date(a.date) - new Date(b.date));
            
            // Actualizar caché
            this._saveToCache();
            
            // Actualizar marca de tiempo
            this.lastUpdated = new Date();
            
            // Notificar sobre la actualización
            EventBus.publish('calendar.updated', { 
                timestamp: this.lastUpdated,
                count: this.events.length
            });
            
            console.log(`Eventos actualizados: ${this.events.length} eventos en total`);
            
            // Verificar eventos próximos para notificaciones
            this._checkUpcomingEvents();
            
            return this.events;
        } catch (error) {
            console.error('Error al actualizar eventos:', error);
            EventBus.publish('calendar.error', { error });
            throw error;
        } finally {
            this.isUpdating = false;
        }
    }
    
    /**
     * Obtiene eventos de una fuente específica
     * @param {string} source - Nombre de la fuente
     * @returns {Promise<Array>} Eventos obtenidos de la fuente
     * @private
     */
    async _fetchEventsFromSource(source) {
        console.log(`Obteniendo eventos de fuente: ${source}`);
        
        try {
            let events = [];
            
            switch(source) {
                case 'coinmarketcal':
                    events = await this._fetchCoinMarketCalEvents();
                    break;
                    
                case 'cryptocompare':
                    events = await this._fetchCryptoCompareEvents();
                    break;
                    
                case 'coindar':
                    events = await this._fetchCoindarEvents();
                    break;
                    
                case 'blockfolio':
                    events = await this._fetchBlockfolioEvents();
                    break;
                    
                default:
                    console.warn(`Fuente desconocida: ${source}`);
                    return [];
            }
            
            // Normalizar y anotar eventos
            return events.map(event => ({
                ...event,
                source,
                importDateTime: new Date().toISOString()
            }));
        } catch (error) {
            console.error(`Error al obtener eventos de ${source}:`, error);
            // Devolver array vacío en caso de error para no bloquear otras fuentes
            return [];
        }
    }
    
    /**
     * Obtiene eventos desde la API de CoinMarketCal
     * @returns {Promise<Array>} Eventos normalizados
     * @private
     */
    async _fetchCoinMarketCalEvents() {
        // En una implementación real, aquí se realizaría la petición a la API
        // Ejemplo simulado con datos de prueba
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([
                    {
                        id: 'cmc-1',
                        title: 'Bitcoin Halving',
                        description: 'The block reward will decrease from 6.25 to 3.125 BTC per block',
                        date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 días en el futuro
                        coins: ['BTC'],
                        category: 'halving',
                        importance: 'high',
                        url: 'https://coinmarketcal.com/event/bitcoin-halving-2024',
                        proof: 'https://github.com/bitcoin/bitcoin/wiki/Halving'
                    },
                    {
                        id: 'cmc-2',
                        title: 'Ethereum Shanghai Upgrade',
                        description: 'New upgrade allowing withdrawals of staked ETH',
                        date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 días en el futuro
                        coins: ['ETH'],
                        category: 'upgrade',
                        importance: 'high',
                        url: 'https://coinmarketcal.com/event/shanghai-upgrade',
                        proof: 'https://ethereum.org/upgrades/'
                    }
                ]);
            }, 100);
        });
    }
    
    /**
     * Obtiene eventos desde la API de CryptoCompare
     * @returns {Promise<Array>} Eventos normalizados
     * @private
     */
    async _fetchCryptoCompareEvents() {
        // Similar a _fetchCoinMarketCalEvents
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([
                    {
                        id: 'cc-1',
                        title: 'Cardano Vasil Hardfork',
                        description: 'Major upgrade to the Cardano network introducing new features',
                        date: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 días en el futuro
                        coins: ['ADA'],
                        category: 'hardfork',
                        importance: 'high',
                        url: 'https://cryptocompare.com/events/cardano-vasil',
                        proof: 'https://roadmap.cardano.org/en/vasil/'
                    }
                ]);
            }, 150);
        });
    }
    
    /**
     * Obtiene eventos desde la API de Coindar
     * @returns {Promise<Array>} Eventos normalizados
     * @private
     */
    async _fetchCoindarEvents() {
        // Similar a los anteriores
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([
                    {
                        id: 'coindar-1',
                        title: 'Polkadot Conference 2024',
                        description: 'Annual Polkadot ecosystem conference',
                        date: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(), // 45 días en el futuro
                        coins: ['DOT'],
                        category: 'conference',
                        importance: 'medium',
                        url: 'https://coindar.org/event/polkadot-conference-2024',
                        proof: 'https://polkadot.network/events/'
                    }
                ]);
            }, 120);
        });
    }
    
    /**
     * Obtiene eventos desde la API de Blockfolio
     * @returns {Promise<Array>} Eventos normalizados
     * @private
     */
    async _fetchBlockfolioEvents() {
        // Similar a los anteriores
        return new Promise(resolve => {
            setTimeout(() => {
                resolve([
                    {
                        id: 'bf-1',
                        title: 'Binance Coin Burn Q2 2024',
                        description: 'Quarterly BNB token burn event',
                        date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // 20 días en el futuro
                        coins: ['BNB'],
                        category: 'token_burn',
                        importance: 'medium',
                        url: 'https://blockfolio.com/event/bnb-burn-q2-2024',
                        proof: 'https://www.binance.com/en/blog/ecosystem/'
                    }
                ]);
            }, 130);
        });
    }
    
    /**
     * Elimina eventos duplicados basándose en similitud
     * @param {Array} events - Lista de eventos a procesar
     * @returns {Array} Lista de eventos sin duplicados
     * @private
     */
    _removeDuplicateEvents(events) {
        const uniqueEvents = [];
        const eventMap = new Map();
        
        for (const event of events) {
            // Crear un identificador basado en fecha, título y monedas
            const coins = Array.isArray(event.coins) ? event.coins.sort().join(',') : event.coins;
            const dateStr = new Date(event.date).toDateString();
            const key = `${dateStr}|${event.title.toLowerCase()}|${coins}`;
            
            // Si ya existe y no es un evento de usuario, omitirlo
            if (eventMap.has(key) && event.source !== 'user') {
                continue;
            }
            
            // Si ya existe pero es de mejor calidad, reemplazar
            if (eventMap.has(key) && event.importance === 'high') {
                const existingIndex = eventMap.get(key);
                uniqueEvents[existingIndex] = {
                    ...uniqueEvents[existingIndex],
                    ...event,
                    // Preservar fuentes múltiples
                    sources: [...new Set([
                        ...(uniqueEvents[existingIndex].sources || [uniqueEvents[existingIndex].source]),
                        event.source
                    ])]
                };
                // Eliminar propiedad source individual
                delete uniqueEvents[existingIndex].source;
            } else if (!eventMap.has(key)) {
                // Si no existe, añadirlo
                eventMap.set(key, uniqueEvents.length);
                uniqueEvents.push(event);
            }
        }
        
        return uniqueEvents;
    }
    
    /**
     * Verifica eventos próximos para enviar notificaciones
     * @private
     */
    _checkUpcomingEvents() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        // Filtrar eventos que ocurren en las próximas 24 horas
        const upcomingEvents = this.events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate >= now && eventDate <= tomorrow;
        });
        
        // Notificar sobre eventos próximos
        if (upcomingEvents.length > 0) {
            upcomingEvents.forEach(event => {
                this.notificationService.notify({
                    type: 'calendar_event',
                    title: `Evento próximo: ${event.title}`,
                    message: `${event.title} está programado para ${new Date(event.date).toLocaleString()}`,
                    data: event,
                    priority: event.importance === 'high' ? 'high' : 'medium'
                });
            });
            
            // Publicar evento para actualizar la interfaz
            EventBus.publish('calendar.upcomingEvents', { events: upcomingEvents });
        }
    }
    
    /**
     * Configura la actualización automática de eventos
     * @private
     */
    _setupAutoRefresh() {
        // Limpiar intervalo existente si lo hay
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Configurar nuevo intervalo
        this.refreshInterval = setInterval(() => {
            this.refreshEvents()
                .catch(error => console.error('Error en actualización automática:', error));
        }, this.options.refreshInterval);
        
        console.log(`Actualización automática configurada cada ${this.options.refreshInterval / 60000} minutos`);
    }
    
    /**
     * Configura escuchadores de eventos del sistema
     * @private
     */
    _setupEventListeners() {
        // Escuchar cambios significativos de precio
        EventBus.subscribe('market.significantChange', async (data) => {
            // Analizar correlación con eventos
            const correlatedEvents = await this.findCorrelatedEvents(data.coin, data.changePercent);
            
            if (correlatedEvents.length > 0) {
                EventBus.publish('calendar.eventCorrelation', {
                    coin: data.coin,
                    priceChange: data.changePercent,
                    events: correlatedEvents
                });
            }
        });
    }
    
    /**
     * Guarda eventos en caché
     * @private
     */
    _saveToCache() {
        try {
            StorageManager.set('calendar.events', this.events, {
                expires: this.options.maxCacheAge
            });
            
            StorageManager.set('calendar.userEvents', this.userEvents);
            
            StorageManager.set('calendar.lastUpdated', this.lastUpdated?.toISOString() || null);
            
            console.log('Eventos guardados en caché');
        } catch (error) {
            console.error('Error al guardar eventos en caché:', error);
        }
    }
    
    /**
     * Carga eventos desde caché
     * @private
     */
    async _loadFromCache() {
        try {
            // Cargar eventos de APIs
            const cachedEvents = StorageManager.get('calendar.events') || [];
            this.events = cachedEvents;
            
            // Cargar eventos de usuario
            this.userEvents = StorageManager.get('calendar.userEvents') || [];
            
            // Cargar marca de tiempo
            const lastUpdatedStr = StorageManager.get('calendar.lastUpdated');
            this.lastUpdated = lastUpdatedStr ? new Date(lastUpdatedStr) : null;
            
            // Si los datos son demasiado antiguos o no hay caché, no usar
            const isCacheValid = this.lastUpdated && 
                (new Date() - this.lastUpdated) < this.options.maxCacheAge;
                
            if (cachedEvents.length === 0 || !isCacheValid) {
                console.log('Caché no válida o vacía, se requiere actualización');
                return false;
            }
            
            console.log(`Eventos cargados desde caché: ${this.events.length} eventos`);
            return true;
        } catch (error) {
            console.error('Error al cargar eventos desde caché:', error);
            return false;
        }
    }
    
    /**
     * Obtiene eventos filtrados según criterios
     * @param {Object} filters - Criterios de filtrado
     * @returns {Array} Eventos filtrados
     */
    getEvents(filters = {}) {
        // Combinar con filtros actuales
        const activeFilters = {
            ...this.filters,
            ...filters
        };
        
        // Aplicar filtros
        return this.events.filter(event => {
            // Filtrar por categoría
            if (activeFilters.categories.length > 0 && 
                !activeFilters.categories.includes(event.category)) {
                return false;
            }
            
            // Filtrar por moneda
            if (activeFilters.coins.length > 0 && 
                !event.coins.some(coin => activeFilters.coins.includes(coin))) {
                return false;
            }
            
            // Filtrar por importancia
            if (activeFilters.importance.length > 0 && 
                !activeFilters.importance.includes(event.importance)) {
                return false;
            }
            
            // Filtrar por rango de fechas
            if (activeFilters.dateRange.start || activeFilters.dateRange.end) {
                const eventDate = new Date(event.date);
                
                if (activeFilters.dateRange.start && 
                    eventDate < new Date(activeFilters.dateRange.start)) {
                    return false;
                }
                
                if (activeFilters.dateRange.end && 
                    eventDate > new Date(activeFilters.dateRange.end)) {
                    return false;
                }
            }
            
            // Si pasa todos los filtros
            return true;
        });
    }
    
    /**
     * Obtiene eventos para un período específico
     * @param {string} view - Tipo de vista ('day', 'week', 'month')
     * @param {Date} date - Fecha de referencia
     * @returns {Array} Eventos en el período
     */
    getEventsByPeriod(view = 'month', date = new Date()) {
        const startDate = new Date(date);
        const endDate = new Date(date);
        
        // Ajustar rango según vista
        switch(view) {
            case 'day':
                startDate.setHours(0, 0, 0, 0);
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'week':
                // Ajustar al inicio de la semana (lunes)
                const day = startDate.getDay();
                const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
                startDate.setDate(diff);
                startDate.setHours(0, 0, 0, 0);
                
                // Final de la semana (domingo)
                endDate.setTime(startDate.getTime());
                endDate.setDate(startDate.getDate() + 6);
                endDate.setHours(23, 59, 59, 999);
                break;
                
            case 'month':
                startDate.setDate(1);
                startDate.setHours(0, 0, 0, 0);
                
                endDate.setMonth(endDate.getMonth() + 1);
                endDate.setDate(0); // Último día del mes
                endDate.setHours(23, 59, 59, 999);
                break;
                
            default:
                throw new Error(`Vista no soportada: ${view}`);
        }
        
        // Obtener eventos en el rango de fechas
        return this.getEvents({
            dateRange: {
                start: startDate,
                end: endDate
            }
        });
    }
    
    /**
     * Añade un evento personalizado del usuario
     * @param {Object} event - Datos del evento
     * @returns {Object} Evento creado
     */
    addUserEvent(event) {
        // Validar datos mínimos
        if (!event.title || !event.date) {
            throw new Error('El evento debe tener al menos título y fecha');
        }
        
        // Crear un ID único
        const eventId = `user-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        
        // Crear objeto de evento con valores por defecto
        const newEvent = {
            id: eventId,
            title: event.title,
            description: event.description || '',
            date: new Date(event.date).toISOString(),
            coins: Array.isArray(event.coins) ? event.coins : [],
            category: event.category || 'other',
            importance: event.importance || 'medium',
            url: event.url || '',
            source: 'user',
            createdAt: new Date().toISOString(),
            createdBy: event.userId || 'anonymous',
            isUserEvent: true
        };
        
        // Añadir a la lista de eventos de usuario
        this.userEvents.push(newEvent);
        
        // Actualizar lista completa de eventos
        this.events = this._removeDuplicateEvents([...this.events, newEvent]);
        
        // Guardar en caché
        this._saveToCache();
        
        // Notificar sobre el nuevo evento
        EventBus.publish('calendar.eventAdded', { event: newEvent });
        
        return newEvent;
    }
    
    /**
     * Edita un evento personalizado del usuario
     * @param {string} eventId - ID del evento a editar
     * @param {Object} updatedData - Datos actualizados
     * @returns {Object} Evento actualizado
     */
    editUserEvent(eventId, updatedData) {
        // Buscar el evento
        const eventIndex = this.userEvents.findIndex(e => e.id === eventId);
        
        if (eventIndex === -1) {
            throw new Error(`Evento no encontrado: ${eventId}`);
        }
        
        // Verificar que es un evento del usuario
        if (this.userEvents[eventIndex].source !== 'user') {
            throw new Error('Solo se pueden editar eventos creados por el usuario');
        }
        
        // Actualizar datos
        const updatedEvent = {
            ...this.userEvents[eventIndex],
            ...updatedData,
            updatedAt: new Date().toISOString()
        };
        
        // Si se actualiza la fecha, asegurar formato ISO
        if (updatedData.date) {
            updatedEvent.date = new Date(updatedData.date).toISOString();
        }
        
        // Actualizar en lista de eventos de usuario
        this.userEvents[eventIndex] = updatedEvent;
        
        // Actualizar en lista completa
        const mainEventIndex = this.events.findIndex(e => e.id === eventId);
        if (mainEventIndex !== -1) {
            this.events[mainEventIndex] = updatedEvent;
        }
        
        // Guardar en caché
        this._saveToCache();
        
        // Notificar sobre la actualización
        EventBus.publish('calendar.eventUpdated', { event: updatedEvent });
        
        return updatedEvent;
    }
    
    /**
     * Elimina un evento personalizado del usuario
     * @param {string} eventId - ID del evento a eliminar
     * @returns {boolean} true si se eliminó correctamente
     */
    deleteUserEvent(eventId) {
        // Buscar el evento
        const eventIndex = this.userEvents.findIndex(e => e.id === eventId);
        
        if (eventIndex === -1) {
            throw new Error(`Evento no encontrado: ${eventId}`);
        }
        
        // Verificar que es un evento del usuario
        if (this.userEvents[eventIndex].source !== 'user') {
            throw new Error('Solo se pueden eliminar eventos creados por el usuario');
        }
        
        // Eliminar de la lista de eventos de usuario
        const deletedEvent = this.userEvents.splice(eventIndex, 1)[0];
        
        // Eliminar de la lista completa
        this.events = this.events.filter(e => e.id !== eventId);
        
        // Guardar en caché
        this._saveToCache();
        
        // Notificar sobre la eliminación
        EventBus.publish('calendar.eventDeleted', { eventId, event: deletedEvent });
        
        return true;
    }
    
    /**
     * Establece los filtros activos para los eventos
     * @param {Object} filters - Filtros a aplicar
     */
    setFilters(filters) {
        this.filters = {
            ...this.filters,
            ...filters
        };
        
        // Notificar cambio de filtros
        EventBus.publish('calendar.filtersChanged', { filters: this.filters });
    }
    
    /**
     * Limpia todos los filtros activos
     */
    clearFilters() {
        this.filters = {
            categories: [],
            coins: [],
            importance: [],
            dateRange: {
                start: null,
                end: null
            }
        };
        
        // Notificar limpieza de filtros
        EventBus.publish('calendar.filtersCleared');
    }
    
    /**
     * Analiza el impacto histórico de eventos en el precio
     * @param {string} category - Categoría de eventos a analizar
     * @param {string} coinSymbol - Símbolo de la criptomoneda
     * @returns {Promise<Object>} Estadísticas de impacto
     */
    async analyzeEventImpact(category, coinSymbol) {
        try {
            // Obtener eventos históricos de la categoría para la moneda
            const relevantEvents = this.events.filter(event => 
                event.category === category && 
                event.coins.includes(coinSymbol) &&
                new Date(event.date) < new Date() // Solo eventos pasados
            );
            
            if (relevantEvents.length === 0) {
                return {
                    category,
                    coin: coinSymbol,
                    eventsCount: 0,
                    averageImpact: null,
                    sentiment: 'neutral',
                    confidence: 0
                };
            }
            
            // Para cada evento, analizar cambio de precio
            const impactData = await Promise.all(
                relevantEvents.map(async event => {
                    // Obtener precios antes y después del evento
                    const eventDate = new Date(event.date);
                    
                    // 7 días antes
                    const beforeDate = new Date(eventDate);
                    beforeDate.setDate(beforeDate.getDate() - 7);
                    
                    // 7 días después
                    const afterDate = new Date(eventDate);
                    afterDate.setDate(afterDate.getDate() + 7);
                    
                    try {
                        // Obtener precios históricos
                        const beforePrice = await this.marketDataService.getHistoricalPrice(
                            coinSymbol, 
                            beforeDate.toISOString()
                        );
                        
                        const afterPrice = await this.marketDataService.getHistoricalPrice(
                            coinSymbol, 
                            afterDate.toISOString()
                        );
                        
                        if (!beforePrice || !afterPrice) {
                            return null;
                        }
                        
                        // Calcular cambio porcentual
                        const percentChange = ((afterPrice - beforePrice) / beforePrice) * 100;
                        
                        return {
                            event,
                            beforePrice,
                            afterPrice,
                            percentChange
                        };
                    } catch (error) {
                        console.error(`Error al analizar impacto del evento ${event.id}:`, error);
                        return null;
                    }
                })
            );
            
            // Filtrar datos nulos
            const validImpacts = impactData.filter(data => data !== null);
            
            if (validImpacts.length === 0) {
                return {
                    category,
                    coin: coinSymbol,
                    eventsCount: relevantEvents.length,
                    averageImpact: null,
                    sentiment: 'neutral',
                    confidence: 0
                };
            }
            
            // Calcular estadísticas
            const totalImpact = validImpacts.reduce(
                (sum, data) => sum + data.percentChange, 
                0
            );
            
            const averageImpact = totalImpact / validImpacts.length;
            
            // Determinar sentimiento basado en el impacto promedio
            let sentiment = 'neutral';
            if (averageImpact > 3) sentiment = 'positive';
            if (averageImpact > 10) sentiment = 'very_positive';
            if (averageImpact < -3) sentiment = 'negative';
            if (averageImpact < -10) sentiment = 'very_negative';
            
            // Calcular nivel de confianza basado en cantidad de datos
            // Más datos = mayor confianza, hasta un límite
            const confidence = Math.min(validImpacts.length / 10, 1);
            
            return {
                category,
                coin: coinSymbol,
                eventsCount: relevantEvents.length,
                analyzedEvents: validImpacts.length,
                averageImpact,
                sentiment,
                confidence,
                eventImpacts: validImpacts.map(data => ({
                    eventId: data.event.id,
                    eventDate: data.event.date,
                    eventTitle: data.event.title,
                    percentChange: data.percentChange
                }))
            };
        } catch (error) {
            console.error(`Error al analizar impacto de eventos ${category} para ${coinSymbol}:`, error);
            throw error;
        }
    }
    
    /**
     * Encuentra eventos correlacionados con un cambio significativo de precio
     * @param {string} coinSymbol - Símbolo de la criptomoneda
     * @param {number} changePercent - Cambio porcentual
     * @returns {Promise<Array>} Eventos potencialmente correlacionados
     */
    async findCorrelatedEvents(coinSymbol, changePercent) {
        // Umbral para considerar una correlación significativa (días)
        const correlationThreshold = 5;
        
        try {
            const now = new Date();
            const recentEvents = this.events.filter(event => {
                // Eventos para la moneda específica
                if (!event.coins.includes(coinSymbol)) {
                    return false;
                }
                
                // Comprobar si el evento es reciente
                const eventDate = new Date(event.date);
                const diffDays = Math.abs((now - eventDate) / (1000 * 60 * 60 * 24));
                
                return diffDays <= correlationThreshold;
            });
            
            // Si no hay eventos recientes, no hay correlación
            if (recentEvents.length === 0) {
                return [];
            }
            
            // Ordenar por proximidad temporal
            recentEvents.sort((a, b) => {
                const dateA = new Date(a.date);
                const dateB = new Date(b.date);
                return Math.abs(now - dateA) - Math.abs(now - dateB);
            });
            
            // Enriquecer con metadata de correlación
            return recentEvents.map(event => {
                const eventDate = new Date(event.date);
                const diffDays = Math.abs((now - eventDate) / (1000 * 60 * 60 * 24));
                
                // Calcular fuerza de correlación (1.0 = mismo día, 0.0 = umbral)
                const correlationStrength = 1 - (diffDays / correlationThreshold);
                
                return {
                    ...event,
                    correlationStrength,
                    correlationInfo: {
                        daysFromEvent: diffDays.toFixed(1),
                        priceChange: changePercent,
                        priceChangeAbs: Math.abs(changePercent),
                        direction: changePercent > 0 ? 'up' : 'down'
                    }
                };
            });
        } catch (error) {
            console.error(`Error al buscar eventos correlacionados para ${coinSymbol}:`, error);
            return [];
        }
    }
    
    /**
     * Exporta eventos a formato iCalendar
     * @param {Array} events - Eventos a exportar (por defecto todos)
     * @returns {string} Contenido en formato iCalendar
     */
    exportToICal(events = this.events) {
        const icalContent = [
            'BEGIN:VCALENDAR',
            'VERSION:2.0',
            'PRODID:-//CryptoInvest//Calendar//ES',
            'CALSCALE:GREGORIAN',
            'METHOD:PUBLISH',
            'X-WR-CALNAME:CryptoInvest Calendar',
            'X-WR-TIMEZONE:UTC'
        ];
        
        // Añadir cada evento
        events.forEach(event => {
            // Crear ID único para el evento
            const uid = `${event.id || 'event'}-${Date.now()}@cryptoinvest.com`;
            
            // Formatear fecha para iCal (yyyyMMddTHHmmssZ)
            const formatDate = (dateStr) => {
                const date = new Date(dateStr);
                return date.toISOString().replace(/[-:]/g, '').replace(/\.\d+/g, '');
            };
            
            const eventDate = formatDate(event.date);
            
            // Crear evento iCal
            icalContent.push('BEGIN:VEVENT');
            icalContent.push(`UID:${uid}`);
            icalContent.push(`DTSTAMP:${formatDate(new Date())}`);
            icalContent.push(`DTSTART:${eventDate}`);
            
            // Establecer fin del evento (por defecto 1 hora después)
            const endDate = new Date(event.date);
            endDate.setHours(endDate.getHours() + 1);
            icalContent.push(`DTEND:${formatDate(endDate)}`);
            
            // Añadir título y descripción
            icalContent.push(`SUMMARY:${event.title}`);
            icalContent.push(`DESCRIPTION:${event.description || ''}`);
            
            // Añadir categoría y monedas como tags
            if (event.category) {
                icalContent.push(`CATEGORIES:${event.category}`);
            }
            
            if (event.coins && event.coins.length > 0) {
                icalContent.push(`X-CRYPTOINVEST-COINS:${event.coins.join(',')}`);
            }
            
            // Añadir URL si existe
            if (event.url) {
                icalContent.push(`URL:${event.url}`);
            }
            
            // Establecer prioridad basada en importancia
            let priority = 5; // Normal
            if (event.importance === 'high') priority = 1;
            if (event.importance === 'medium') priority = 3;
            if (event.importance === 'low') priority = 7;
            icalContent.push(`PRIORITY:${priority}`);
            
            // Fin del evento
            icalContent.push('END:VEVENT');
        });
        
        // Cerrar calendario
        icalContent.push('END:VCALENDAR');
        
        // Devolver contenido
        return icalContent.join('\r\n');
    }
    
    /**
     * Exporta eventos al calendario de Google
     * @param {Array} events - Eventos a exportar (por defecto todos)
     * @returns {string} URL para añadir eventos a Google Calendar
     */
    getGoogleCalendarUrl(events = this.events) {
        if (events.length === 0) {
            throw new Error('No hay eventos para exportar');
        }
        
        // Para múltiples eventos, mostrar solo el primero en la URL
        // Google Calendar no permite añadir múltiples eventos en una sola URL
        const event = events[0];
        
        // Formatear fecha
        const formatDate = (dateStr) => {
            const date = new Date(dateStr);
            return date.toISOString().replace(/-|:|\.\d+/g, '');
        };
        
        // Construir URL
        const baseUrl = 'https://calendar.google.com/calendar/render?action=TEMPLATE';
        const title = `text=${encodeURIComponent(event.title)}`;
        const dates = `dates=${formatDate(event.date)}/${formatDate(new Date(new Date(event.date).getTime() + 3600000))}`; // +1 hora
        const details = `details=${encodeURIComponent(event.description || '')}`;
        const location = event.location ? `location=${encodeURIComponent(event.location)}` : '';
        
        return `${baseUrl}&${title}&${dates}&${details}${location ? '&' + location : ''}`;
    }
    
    /**
     * Obtiene categorías únicas de eventos disponibles
     * @returns {Array} Lista de categorías
     */
    getAvailableCategories() {
        const categories = new Set();
        
        this.events.forEach(event => {
            if (event.category) {
                categories.add(event.category);
            }
        });
        
        return [...categories].sort();
    }
    
    /**
     * Obtiene monedas únicas de eventos disponibles
     * @returns {Array} Lista de monedas
     */
    getAvailableCoins() {
        const coins = new Set();
        
        this.events.forEach(event => {
            if (event.coins && Array.isArray(event.coins)) {
                event.coins.forEach(coin => coins.add(coin));
            }
        });
        
        return [...coins].sort();
    }
    
    /**
     * Obtiene los eventos más importantes próximos
     * @param {number} limit - Número máximo de eventos a devolver
     * @returns {Array} Eventos próximos importantes
     */
    getUpcomingImportantEvents(limit = 5) {
        const now = new Date();
        
        // Filtrar eventos futuros importantes
        const upcomingEvents = this.events
            .filter(event => {
                const eventDate = new Date(event.date);
                return eventDate > now && event.importance === 'high';
            })
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .slice(0, limit);
            
        return upcomingEvents;
    }
    
    /**
     * Destruye el servicio y limpia recursos
     */
    destroy() {
        // Limpiar intervalo de actualización
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        // Guardar eventos en caché antes de destruir
        this._saveToCache();
        
        console.log('CalendarService destruido');
    }
}

// Exportar una instancia predeterminada para uso rápido
export const calendarService = new CalendarService();
