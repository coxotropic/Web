/**
 * watchlist-service.js
 * Servicio para gestionar listas de seguimiento de criptomonedas en el portal.
 * Este servicio permite a los usuarios crear y gestionar múltiples listas de
 * criptomonedas para seguimiento, con actualizaciones de precios en tiempo real,
 * estadísticas, y personalización.
 */

import { MarketDataService } from '../market/market-data-service.js';
import { EventBus } from '../utils/event-bus.js';
import { StorageManager } from '../utils/storage-manager.js';
import { NotificationService } from '../user/notification-service.js';
import { AlertsService } from '../tools/alerts-service.js';

/**
 * Clase principal para gestionar las listas de seguimiento de criptomonedas
 */
export class WatchlistService {
    /**
     * Constructor del servicio de watchlist
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        // Configuración predeterminada con opciones personalizadas
        this.config = {
            updateInterval: 30000, // Intervalo de actualización en ms (30 seg)
            maxWatchlists: 10,     // Número máximo de listas permitidas
            maxCoinsPerList: 100,  // Máximo de monedas por lista
            storageKey: 'user.watchlists',
            cacheExpiry: 5 * 60 * 1000, // 5 minutos
            ...options
        };
        
        // Servicios externos
        this.marketService = new MarketDataService();
        this.notificationService = new NotificationService();
        this.alertsService = new AlertsService();
        
        // Estado interno
        this.watchlists = [];      // Array de listas de seguimiento
        this.activeWatchlist = null; // ID de la lista activa
        this.isInitialized = false;
        this.updateTimer = null;
        this.cachedPrices = {};    // Caché de precios actualizados
        this.lastUpdateTime = 0;   // Timestamp de última actualización
        
        // Registro de columnas disponibles
        this.availableColumns = [
            { id: 'rank', name: 'Ranking', default: true },
            { id: 'name', name: 'Nombre', default: true },
            { id: 'price', name: 'Precio', default: true },
            { id: 'change_24h', name: 'Cambio 24h', default: true },
            { id: 'change_7d', name: 'Cambio 7d', default: true },
            { id: 'market_cap', name: 'Cap. Mercado', default: false },
            { id: 'volume_24h', name: 'Volumen 24h', default: false },
            { id: 'supply', name: 'Suministro', default: false },
            { id: 'added_date', name: 'Fecha añadido', default: false },
            { id: 'price_bought', name: 'Precio compra', default: false },
            { id: 'chart', name: 'Gráfico', default: true },
            { id: 'actions', name: 'Acciones', default: true }
        ];
    }
    
    /**
     * Inicializa el servicio de watchlist
     * @returns {Promise<boolean>} - Promesa que resuelve a true si se inicializó correctamente
     */
    async init() {
        if (this.isInitialized) {
            return true;
        }
        
        try {
            console.log('Inicializando servicio de watchlist...');
            
            // Cargar listas guardadas
            await this.loadWatchlists();
            
            // Si no hay listas, crear una predeterminada
            if (this.watchlists.length === 0) {
                await this.createWatchlist('Mi primera lista', 'Lista principal de seguimiento');
            }
            
            // Establecer la primera lista como activa si no hay ninguna
            if (!this.activeWatchlist && this.watchlists.length > 0) {
                this.activeWatchlist = this.watchlists[0].id;
            }
            
            // Configurar actualizaciones en tiempo real
            this.startRealTimeUpdates();
            
            // Suscribirse a eventos relevantes
            this.setupEventSubscriptions();
            
            this.isInitialized = true;
            console.log('Servicio de watchlist inicializado correctamente');
            
            // Notificar que el servicio está listo
            EventBus.publish('watchlist.ready', { service: this });
            
            return true;
        } catch (error) {
            console.error('Error al inicializar el servicio de watchlist:', error);
            return false;
        }
    }
    
    /**
     * Configura las suscripciones a eventos
     * @private
     */
    setupEventSubscriptions() {
        // Escuchar cambios en los datos de mercado
        EventBus.subscribe('market.priceUpdate', (data) => {
            this.updateCachedPrices(data.updates);
        });
        
        // Escuchar eventos de autenticación
        EventBus.subscribe('auth.login', () => {
            this.syncWatchlists();
        });
        
        EventBus.subscribe('auth.logout', () => {
            this.resetToDefaultWatchlists();
        });
    }
    
    /**
     * Carga las listas de seguimiento desde el almacenamiento
     * @private
     * @returns {Promise<Array>} - Promesa que resuelve a un array de listas
     */
    async loadWatchlists() {
        try {
            const savedWatchlists = await StorageManager.get(this.config.storageKey);
            
            if (savedWatchlists && Array.isArray(savedWatchlists)) {
                this.watchlists = savedWatchlists;
                
                // Recuperar el ID de la lista activa
                const activeId = await StorageManager.get('user.watchlists.active');
                if (activeId && this.watchlists.some(list => list.id === activeId)) {
                    this.activeWatchlist = activeId;
                }
                
                console.log(`Cargadas ${this.watchlists.length} listas de seguimiento`);
                return this.watchlists;
            } else {
                console.log('No se encontraron listas de seguimiento guardadas');
                this.watchlists = [];
                return [];
            }
        } catch (error) {
            console.error('Error al cargar listas de seguimiento:', error);
            this.watchlists = [];
            return [];
        }
    }
    
    /**
     * Guarda las listas de seguimiento en el almacenamiento
     * @private
     * @returns {Promise<boolean>} - Promesa que resuelve a true si se guardó correctamente
     */
    async saveWatchlists() {
        try {
            await StorageManager.set(this.config.storageKey, this.watchlists);
            
            // Guardar también el ID de la lista activa
            if (this.activeWatchlist) {
                await StorageManager.set('user.watchlists.active', this.activeWatchlist);
            }
            
            // Publicar evento de actualización
            EventBus.publish('watchlist.updated', {
                watchlists: this.watchlists,
                activeWatchlist: this.activeWatchlist
            });
            
            return true;
        } catch (error) {
            console.error('Error al guardar listas de seguimiento:', error);
            return false;
        }
    }
    
    /**
     * Inicia las actualizaciones en tiempo real de los precios
     * @private
     */
    startRealTimeUpdates() {
        // Limpiar timer existente si lo hay
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        // Realizar una actualización inicial
        this.updateWatchlistPrices();
        
        // Configurar actualizaciones periódicas
        this.updateTimer = setInterval(() => {
            this.updateWatchlistPrices();
        }, this.config.updateInterval);
        
        console.log(`Actualizaciones en tiempo real configuradas cada ${this.config.updateInterval / 1000} segundos`);
    }
    
    /**
     * Detiene las actualizaciones en tiempo real
     */
    stopRealTimeUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
            console.log('Actualizaciones en tiempo real detenidas');
        }
    }
    
    /**
     * Actualiza los precios de todas las criptomonedas en las listas de seguimiento
     * @private
     * @returns {Promise<boolean>} - Promesa que resuelve a true si se actualizó correctamente
     */
    async updateWatchlistPrices() {
        try {
            // Recopilar todas las monedas únicas de todas las listas
            const uniqueCoins = this.getAllUniqueCoins();
            
            if (uniqueCoins.length === 0) {
                return true; // No hay monedas que actualizar
            }
            
            // Verificar si podemos usar la caché
            const now = Date.now();
            const cacheIsValid = (now - this.lastUpdateTime) < this.config.cacheExpiry;
            
            // Si la caché no es válida o no tiene todos los datos, obtener nuevos datos
            if (!cacheIsValid || !this.allCoinsInCache(uniqueCoins)) {
                const priceData = await this.marketService.getPricesForCoins(uniqueCoins);
                
                if (priceData) {
                    this.updateCachedPrices(priceData);
                    this.lastUpdateTime = now;
                }
            }
            
            // Actualizar cada lista con los precios en caché
            this.watchlists = this.watchlists.map(watchlist => {
                const updatedCoins = watchlist.coins.map(coin => {
                    const cachedData = this.cachedPrices[coin.id] || {};
                    return {
                        ...coin,
                        price: cachedData.price || coin.price,
                        price_change_24h: cachedData.price_change_24h || coin.price_change_24h,
                        price_change_7d: cachedData.price_change_7d || coin.price_change_7d,
                        last_updated: cachedData.last_updated || coin.last_updated
                    };
                });
                
                return {
                    ...watchlist,
                    coins: updatedCoins,
                    last_updated: now
                };
            });
            
            // Publicar evento de precios actualizados
            EventBus.publish('watchlist.pricesUpdated', {
                timestamp: now,
                watchlists: this.watchlists
            });
            
            return true;
        } catch (error) {
            console.error('Error al actualizar precios de listas de seguimiento:', error);
            return false;
        }
    }
    
    /**
     * Actualiza la caché de precios con nuevos datos
     * @private
     * @param {Object} priceData - Datos de precios por ID de moneda
     */
    updateCachedPrices(priceData) {
        if (!priceData) return;
        
        // Actualizar la caché con los nuevos datos
        Object.keys(priceData).forEach(coinId => {
            this.cachedPrices[coinId] = {
                ...this.cachedPrices[coinId],
                ...priceData[coinId],
                last_updated: Date.now()
            };
        });
    }
    
    /**
     * Verifica si todas las monedas requeridas están en la caché
     * @private
     * @param {Array<string>} coinIds - Array de IDs de monedas
     * @returns {boolean} - True si todas las monedas están en caché
     */
    allCoinsInCache(coinIds) {
        return coinIds.every(id => {
            const cached = this.cachedPrices[id];
            return cached && (Date.now() - cached.last_updated < this.config.cacheExpiry);
        });
    }
    
    /**
     * Obtiene todas las monedas únicas de todas las listas
     * @private
     * @returns {Array<string>} - Array de IDs de monedas únicos
     */
    getAllUniqueCoins() {
        const uniqueCoins = new Set();
        
        this.watchlists.forEach(watchlist => {
            watchlist.coins.forEach(coin => {
                uniqueCoins.add(coin.id);
            });
        });
        
        return Array.from(uniqueCoins);
    }
    
    /**
     * Crea una nueva lista de seguimiento
     * @param {string} name - Nombre de la lista
     * @param {string} description - Descripción de la lista
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Object>} - Promesa que resuelve al objeto de la lista creada
     */
    async createWatchlist(name, description = '', options = {}) {
        try {
            // Verificar límite de listas
            if (this.watchlists.length >= this.config.maxWatchlists) {
                throw new Error(`Has alcanzado el límite máximo de ${this.config.maxWatchlists} listas de seguimiento`);
            }
            
            // Validar nombre
            if (!name || typeof name !== 'string' || name.trim() === '') {
                throw new Error('El nombre de la lista es obligatorio');
            }
            
            const id = `watchlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Crear nueva lista
            const newWatchlist = {
                id,
                name: name.trim(),
                description: description.trim(),
                created_at: Date.now(),
                updated_at: Date.now(),
                coins: [],
                tags: options.tags || [],
                is_public: options.is_public || false,
                columns: this.getDefaultColumns(),
                sort_by: options.sort_by || 'rank',
                sort_direction: options.sort_direction || 'asc'
            };
            
            // Añadir a la colección
            this.watchlists.push(newWatchlist);
            
            // Si es la primera lista, establecerla como activa
            if (this.watchlists.length === 1) {
                this.activeWatchlist = id;
            }
            
            // Guardar cambios
            await this.saveWatchlists();
            
            console.log(`Lista de seguimiento "${name}" creada con ID: ${id}`);
            
            // Notificar creación
            EventBus.publish('watchlist.created', { watchlist: newWatchlist });
            
            return newWatchlist;
        } catch (error) {
            console.error('Error al crear lista de seguimiento:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene las columnas predeterminadas para una lista
     * @private
     * @returns {Array<Object>} - Array de objetos de columna
     */
    getDefaultColumns() {
        return this.availableColumns
            .filter(column => column.default)
            .map(column => ({ id: column.id, visible: true }));
    }
    
    /**
     * Edita una lista de seguimiento existente
     * @param {string} id - ID de la lista a editar
     * @param {Object} updates - Campos a actualizar
     * @returns {Promise<Object>} - Promesa que resuelve a la lista actualizada
     */
    async editWatchlist(id, updates) {
        try {
            const index = this.watchlists.findIndex(list => list.id === id);
            
            if (index === -1) {
                throw new Error(`Lista de seguimiento con ID ${id} no encontrada`);
            }
            
            // Validar nombre si se está actualizando
            if (updates.name !== undefined && (typeof updates.name !== 'string' || updates.name.trim() === '')) {
                throw new Error('El nombre de la lista no puede estar vacío');
            }
            
            // Obtener la lista actual y actualizarla
            const currentWatchlist = this.watchlists[index];
            
            const updatedWatchlist = {
                ...currentWatchlist,
                ...updates,
                name: updates.name ? updates.name.trim() : currentWatchlist.name,
                description: updates.description ? updates.description.trim() : currentWatchlist.description,
                updated_at: Date.now()
            };
            
            // Reemplazar en el array
            this.watchlists[index] = updatedWatchlist;
            
            // Guardar cambios
            await this.saveWatchlists();
            
            console.log(`Lista de seguimiento "${updatedWatchlist.name}" actualizada`);
            
            // Notificar actualización
            EventBus.publish('watchlist.updated', { 
                watchlist: updatedWatchlist,
                updates
            });
            
            return updatedWatchlist;
        } catch (error) {
            console.error('Error al editar lista de seguimiento:', error);
            throw error;
        }
    }
    
    /**
     * Elimina una lista de seguimiento
     * @param {string} id - ID de la lista a eliminar
     * @returns {Promise<boolean>} - Promesa que resuelve a true si se eliminó correctamente
     */
    async deleteWatchlist(id) {
        try {
            const index = this.watchlists.findIndex(list => list.id === id);
            
            if (index === -1) {
                throw new Error(`Lista de seguimiento con ID ${id} no encontrada`);
            }
            
            // Guardar referencia antes de eliminar
            const deletedWatchlist = this.watchlists[index];
            
            // Eliminar del array
            this.watchlists.splice(index, 1);
            
            // Si era la lista activa, cambiar a la primera disponible
            if (this.activeWatchlist === id) {
                this.activeWatchlist = this.watchlists.length > 0 ? this.watchlists[0].id : null;
            }
            
            // Guardar cambios
            await this.saveWatchlists();
            
            console.log(`Lista de seguimiento "${deletedWatchlist.name}" eliminada`);
            
            // Notificar eliminación
            EventBus.publish('watchlist.deleted', { 
                watchlistId: id,
                watchlistName: deletedWatchlist.name
            });
            
            return true;
        } catch (error) {
            console.error('Error al eliminar lista de seguimiento:', error);
            throw error;
        }
    }
    
    /**
     * Establece una lista como la activa
     * @param {string} id - ID de la lista a activar
     * @returns {Promise<Object>} - Promesa que resuelve a la lista activa
     */
    async setActiveWatchlist(id) {
        try {
            const watchlist = this.watchlists.find(list => list.id === id);
            
            if (!watchlist) {
                throw new Error(`Lista de seguimiento con ID ${id} no encontrada`);
            }
            
            this.activeWatchlist = id;
            
            // Guardar preferencia
            await StorageManager.set('user.watchlists.active', id);
            
            console.log(`Lista de seguimiento "${watchlist.name}" establecida como activa`);
            
            // Notificar cambio
            EventBus.publish('watchlist.activeChanged', { watchlist });
            
            return watchlist;
        } catch (error) {
            console.error('Error al cambiar lista activa:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene todas las listas de seguimiento
     * @returns {Array<Object>} - Array de objetos de lista
     */
    getAllWatchlists() {
        return [...this.watchlists];
    }
    
    /**
     * Obtiene una lista específica por su ID
     * @param {string} id - ID de la lista
     * @returns {Object|null} - Objeto de la lista o null si no se encuentra
     */
    getWatchlistById(id) {
        return this.watchlists.find(list => list.id === id) || null;
    }
    
    /**
     * Obtiene la lista activa actual
     * @returns {Object|null} - Objeto de la lista activa o null
     */
    getActiveWatchlist() {
        if (!this.activeWatchlist) return null;
        return this.getWatchlistById(this.activeWatchlist);
    }
    
    /**
     * Añade una criptomoneda a una lista de seguimiento
     * @param {string} watchlistId - ID de la lista
     * @param {Object} coinData - Datos de la moneda a añadir
     * @returns {Promise<Object>} - Promesa que resuelve a la lista actualizada
     */
    async addCoinToWatchlist(watchlistId, coinData) {
        try {
            const watchlist = this.getWatchlistById(watchlistId);
            
            if (!watchlist) {
                throw new Error(`Lista de seguimiento con ID ${watchlistId} no encontrada`);
            }
            
            // Validar datos mínimos requeridos
            if (!coinData || !coinData.id) {
                throw new Error('Datos de moneda inválidos o incompletos');
            }
            
            // Verificar si la moneda ya existe en la lista
            const coinExists = watchlist.coins.some(coin => coin.id === coinData.id);
            if (coinExists) {
                throw new Error(`La moneda ${coinData.id} ya existe en esta lista`);
            }
            
            // Verificar límite de monedas
            if (watchlist.coins.length >= this.config.maxCoinsPerList) {
                throw new Error(`Has alcanzado el límite máximo de ${this.config.maxCoinsPerList} monedas por lista`);
            }
            
            // Preparar datos de la moneda
            const now = Date.now();
            const coin = {
                id: coinData.id,
                symbol: coinData.symbol || '',
                name: coinData.name || coinData.id,
                image: coinData.image || '',
                price: coinData.price || 0,
                price_change_24h: coinData.price_change_24h || 0,
                price_change_7d: coinData.price_change_7d || 0,
                added_at: now,
                notes: coinData.notes || '',
                tags: coinData.tags || [],
                alert_settings: coinData.alert_settings || null,
                price_bought: coinData.price_bought || null,
                amount: coinData.amount || null
            };
            
            // Actualizar lista
            const updatedWatchlist = {
                ...watchlist,
                coins: [...watchlist.coins, coin],
                updated_at: now
            };
            
            // Reemplazar en el array
            const index = this.watchlists.findIndex(list => list.id === watchlistId);
            this.watchlists[index] = updatedWatchlist;
            
            // Guardar cambios
            await this.saveWatchlists();
            
            console.log(`Moneda ${coin.name} (${coin.symbol}) añadida a lista "${watchlist.name}"`);
            
            // Actualizar precios inmediatamente
            this.updateWatchlistPrices();
            
            // Notificar adición
            EventBus.publish('watchlist.coinAdded', {
                watchlistId,
                watchlistName: watchlist.name,
                coin
            });
            
            return updatedWatchlist;
        } catch (error) {
            console.error('Error al añadir moneda a lista de seguimiento:', error);
            throw error;
        }
    }
    
    /**
     * Elimina una criptomoneda de una lista de seguimiento
     * @param {string} watchlistId - ID de la lista
     * @param {string} coinId - ID de la moneda a eliminar
     * @returns {Promise<Object>} - Promesa que resuelve a la lista actualizada
     */
    async removeCoinFromWatchlist(watchlistId, coinId) {
        try {
            const watchlist = this.getWatchlistById(watchlistId);
            
            if (!watchlist) {
                throw new Error(`Lista de seguimiento con ID ${watchlistId} no encontrada`);
            }
            
            // Verificar si la moneda existe en la lista
            const coinIndex = watchlist.coins.findIndex(coin => coin.id === coinId);
            if (coinIndex === -1) {
                throw new Error(`La moneda ${coinId} no existe en esta lista`);
            }
            
            // Guardar referencia antes de eliminar
            const removedCoin = watchlist.coins[coinIndex];
            
            // Actualizar lista
            const updatedWatchlist = {
                ...watchlist,
                coins: watchlist.coins.filter(coin => coin.id !== coinId),
                updated_at: Date.now()
            };
            
            // Reemplazar en el array
            const index = this.watchlists.findIndex(list => list.id === watchlistId);
            this.watchlists[index] = updatedWatchlist;
            
            // Guardar cambios
            await this.saveWatchlists();
            
            console.log(`Moneda ${removedCoin.name} (${removedCoin.symbol}) eliminada de lista "${watchlist.name}"`);
            
            // Notificar eliminación
            EventBus.publish('watchlist.coinRemoved', {
                watchlistId,
                watchlistName: watchlist.name,
                coinId,
                coinName: removedCoin.name
            });
            
            return updatedWatchlist;
        } catch (error) {
            console.error('Error al eliminar moneda de lista de seguimiento:', error);
            throw error;
        }
    }
    
    /**
     * Actualiza los datos de una moneda en una lista
     * @param {string} watchlistId - ID de la lista
     * @param {string} coinId - ID de la moneda
     * @param {Object} updates - Actualizaciones a aplicar
     * @returns {Promise<Object>} - Promesa que resuelve a la lista actualizada
     */
    async updateCoinInWatchlist(watchlistId, coinId, updates) {
        try {
            const watchlist = this.getWatchlistById(watchlistId);
            
            if (!watchlist) {
                throw new Error(`Lista de seguimiento con ID ${watchlistId} no encontrada`);
            }
            
            // Encontrar la moneda
            const coinIndex = watchlist.coins.findIndex(coin => coin.id === coinId);
            if (coinIndex === -1) {
                throw new Error(`La moneda ${coinId} no existe en esta lista`);
            }
            
            // Actualizar moneda
            const updatedCoins = [...watchlist.coins];
            updatedCoins[coinIndex] = {
                ...updatedCoins[coinIndex],
                ...updates
            };
            
            // Actualizar lista
            const updatedWatchlist = {
                ...watchlist,
                coins: updatedCoins,
                updated_at: Date.now()
            };
            
            // Reemplazar en el array
            const index = this.watchlists.findIndex(list => list.id === watchlistId);
            this.watchlists[index] = updatedWatchlist;
            
            // Guardar cambios
            await this.saveWatchlists();
            
            console.log(`Datos de moneda ${updatedCoins[coinIndex].name} actualizados en lista "${watchlist.name}"`);
            
            // Notificar actualización
            EventBus.publish('watchlist.coinUpdated', {
                watchlistId,
                watchlistName: watchlist.name,
                coinId,
                updates
            });
            
            return updatedWatchlist;
        } catch (error) {
            console.error('Error al actualizar moneda en lista de seguimiento:', error);
            throw error;
        }
    }
    
    /**
     * Configura columnas visibles para una lista
     * @param {string} watchlistId - ID de la lista
     * @param {Array<Object>} columns - Configuración de columnas
     * @returns {Promise<Object>} - Promesa que resuelve a la lista actualizada
     */
    async configureWatchlistColumns(watchlistId, columns) {
        try {
            // Validar columnas
            if (!Array.isArray(columns)) {
                throw new Error('La configuración de columnas debe ser un array');
            }
            
            // Verificar que las columnas existan
            const validColumnIds = this.availableColumns.map(col => col.id);
            const invalidColumns = columns.filter(col => !validColumnIds.includes(col.id));
            
            if (invalidColumns.length > 0) {
                throw new Error(`Columnas inválidas: ${invalidColumns.map(col => col.id).join(', ')}`);
            }
            
            // Actualizar configuración
            return this.editWatchlist(watchlistId, { columns });
            
        } catch (error) {
            console.error('Error al configurar columnas:', error);
            throw error;
        }
    }
    
    /**
     * Ordena las monedas en una lista según un criterio
     * @param {string} watchlistId - ID de la lista
     * @param {string} sortBy - Campo por el que ordenar
     * @param {string} direction - Dirección ('asc' o 'desc')
     * @returns {Promise<Object>} - Promesa que resuelve a la lista actualizada
     */
    async sortWatchlist(watchlistId, sortBy, direction = 'asc') {
        try {
            const watchlist = this.getWatchlistById(watchlistId);
            
            if (!watchlist) {
                throw new Error(`Lista de seguimiento con ID ${watchlistId} no encontrada`);
            }
            
            // Validar dirección
            if (direction !== 'asc' && direction !== 'desc') {
                throw new Error('La dirección debe ser "asc" o "desc"');
            }
            
            // Actualizar lista
            return this.editWatchlist(watchlistId, { 
                sort_by: sortBy,
                sort_direction: direction
            });
            
        } catch (error) {
            console.error('Error al ordenar lista:', error);
            throw error;
        }
    }
    
    /**
     * Reordena manualmente las monedas en una lista
     * @param {string} watchlistId - ID de la lista
     * @param {Array<string>} coinOrder - Array de IDs de monedas en el orden deseado
     * @returns {Promise<Object>} - Promesa que resuelve a la lista actualizada
     */
    async reorderWatchlistCoins(watchlistId, coinOrder) {
        try {
            const watchlist = this.getWatchlistById(watchlistId);
            
            if (!watchlist) {
                throw new Error(`Lista de seguimiento con ID ${watchlistId} no encontrada`);
            }
            
            // Validar que todas las monedas existan
            const currentCoins = watchlist.coins.map(coin => coin.id);
            const missingCoins = coinOrder.filter(id => !currentCoins.includes(id));
            const extraCoins = currentCoins.filter(id => !coinOrder.includes(id));
            
            if (missingCoins.length > 0 || extraCoins.length > 0) {
                throw new Error('El orden proporcionado no coincide con las monedas en la lista');
            }
            
            // Reordenar monedas
            const orderedCoins = coinOrder.map(id => 
                watchlist.coins.find(coin => coin.id === id)
            );
            
            // Actualizar lista
            return this.editWatchlist(watchlistId, { 
                coins: orderedCoins,
                // Resetear ordenación automática
                sort_by: null,
                sort_direction: null
            });
            
        } catch (error) {
            console.error('Error al reordenar monedas:', error);
            throw error;
        }
    }
    
    /**
     * Calcula el rendimiento total de una lista de seguimiento
     * @param {string} watchlistId - ID de la lista
     * @param {string} timeframe - Período de tiempo ('24h', '7d', '30d', 'all')
     * @returns {Object} - Información de rendimiento
     */
    calculateWatchlistPerformance(watchlistId, timeframe = '24h') {
        try {
            const watchlist = this.getWatchlistById(watchlistId);
            
            if (!watchlist) {
                throw new Error(`Lista de seguimiento con ID ${watchlistId} no encontrada`);
            }
            
            // Si no hay monedas, retornar valores predeterminados
            if (watchlist.coins.length === 0) {
                return {
                    totalValue: 0,
                    change: 0,
                    changePercentage: 0,
                    gainers: 0,
                    losers: 0,
                    unchanged: 0
                };
            }
            
            // Determinar qué campo de cambio usar según el timeframe
            let changeField;
            switch (timeframe) {
                case '7d':
                    changeField = 'price_change_7d';
                    break;
                case '30d':
                    changeField = 'price_change_30d';
                    break;
                case 'all':
                    // Para todo el período, comparar con precio de compra si existe
                    changeField = 'price_bought';
                    break;
                default:
                    changeField = 'price_change_24h';
            }
            
            // Calcular estadísticas
            let totalValue = 0;
            let totalChange = 0;
            let totalInitialValue = 0;
            let gainers = 0;
            let losers = 0;
            let unchanged = 0;
            
            watchlist.coins.forEach(coin => {
                const amount = coin.amount || 1; // Si no hay cantidad, asumir 1
                const currentValue = coin.price * amount;
                
                totalValue += currentValue;
                
                // Calcular cambio según el timeframe
                if (timeframe === 'all' && coin.price_bought) {
                    // Si tenemos precio de compra, usar ese para período 'all'
                    const initialValue = coin.price_bought * amount;
                    const coinChange = currentValue - initialValue;
                    
                    totalInitialValue += initialValue;
                    totalChange += coinChange;
                    
                    if (coinChange > 0) gainers++;
                    else if (coinChange < 0) losers++;
                    else unchanged++;
                    
                } else {
                    // Usar cambio porcentual para otros períodos
                    const changePercent = coin[changeField] || 0;
                    const coinChange = (currentValue * changePercent) / 100;
                    
                    totalChange += coinChange;
                    totalInitialValue += currentValue - coinChange;
                    
                    if (changePercent > 0) gainers++;
                    else if (changePercent < 0) losers++;
                    else unchanged++;
                }
            });
            
            // Calcular porcentaje de cambio
            const changePercentage = totalInitialValue > 0 
                ? (totalChange / totalInitialValue) * 100 
                : 0;
            
            return {
                totalValue,
                totalInitialValue,
                change: totalChange,
                changePercentage,
                gainers,
                losers,
                unchanged
            };
            
        } catch (error) {
            console.error('Error al calcular rendimiento:', error);
            return {
                error: error.message,
                totalValue: 0,
                change: 0,
                changePercentage: 0
            };
        }
    }
    
    /**
     * Compara el rendimiento entre múltiples listas
     * @param {Array<string>} watchlistIds - IDs de las listas a comparar
     * @param {string} timeframe - Período de tiempo
     * @returns {Object} - Datos comparativos
     */
    compareWatchlists(watchlistIds, timeframe = '24h') {
        try {
            if (!Array.isArray(watchlistIds) || watchlistIds.length === 0) {
                throw new Error('Se debe proporcionar al menos un ID de lista para comparar');
            }
            
            const results = {};
            
            // Calcular rendimiento para cada lista
            watchlistIds.forEach(id => {
                const watchlist = this.getWatchlistById(id);
                if (watchlist) {
                    results[id] = {
                        name: watchlist.name,
                        coins: watchlist.coins.length,
                        ...this.calculateWatchlistPerformance(id, timeframe)
                    };
                }
            });
            
            return {
                timeframe,
                watchlists: results
            };
            
        } catch (error) {
            console.error('Error al comparar listas:', error);
            return {
                error: error.message,
                timeframe,
                watchlists: {}
            };
        }
    }
    
    /**
     * Exporta una lista en el formato especificado
     * @param {string} watchlistId - ID de la lista
     * @param {string} format - Formato ('json', 'csv', 'pdf')
     * @returns {string|Blob} - Datos exportados en el formato solicitado
     */
    exportWatchlist(watchlistId, format = 'json') {
        try {
            const watchlist = this.getWatchlistById(watchlistId);
            
            if (!watchlist) {
                throw new Error(`Lista de seguimiento con ID ${watchlistId} no encontrada`);
            }
            
            switch (format.toLowerCase()) {
                case 'json': {
                    // Exportar como JSON
                    const data = JSON.stringify(watchlist, null, 2);
                    return new Blob([data], { type: 'application/json' });
                }
                
                case 'csv': {
                    // Exportar como CSV
                    const headers = ['ID', 'Símbolo', 'Nombre', 'Precio', 'Cambio 24h (%)', 'Cambio 7d (%)', 'Fecha añadido', 'Notas'];
                    const rows = watchlist.coins.map(coin => [
                        coin.id,
                        coin.symbol,
                        coin.name,
                        coin.price,
                        coin.price_change_24h,
                        coin.price_change_7d,
                        new Date(coin.added_at).toISOString(),
                        coin.notes
                    ]);
                    
                    // Construir CSV
                    const csvContent = [
                        headers.join(','),
                        ...rows.map(row => row.join(','))
                    ].join('\n');
                    
                    return new Blob([csvContent], { type: 'text/csv' });
                }
                
                case 'pdf':
                    // Exportar como PDF (requeriría una biblioteca externa)
                    throw new Error('Exportación a PDF no implementada');
                
                default:
                    throw new Error(`Formato de exportación no soportado: ${format}`);
            }
            
        } catch (error) {
            console.error('Error al exportar lista:', error);
            throw error;
        }
    }
    
    /**
     * Importa una lista desde datos externos
     * @param {Object|string} data - Datos a importar
     * @param {string} format - Formato de los datos ('json', 'csv')
     * @returns {Promise<Object>} - Promesa que resuelve a la lista importada
     */
    async importWatchlist(data, format = 'json') {
        try {
            let watchlistData;
            
            switch (format.toLowerCase()) {
                case 'json': {
                    // Importar desde JSON
                    if (typeof data === 'string') {
                        watchlistData = JSON.parse(data);
                    } else {
                        watchlistData = data;
                    }
                    break;
                }
                
                case 'csv': {
                    // Importar desde CSV
                    if (typeof data !== 'string') {
                        throw new Error('Los datos CSV deben ser una cadena de texto');
                    }
                    
                    // Parsear CSV
                    const rows = data.split('\n').map(row => row.split(','));
                    const headers = rows[0];
                    
                    // Crear estructura de watchlist
                    const coins = rows.slice(1).map(row => {
                        const coin = {};
                        headers.forEach((header, index) => {
                            coin[this.mapCsvHeaderToProperty(header)] = row[index];
                        });
                        return {
                            id: coin.id,
                            symbol: coin.symbol || '',
                            name: coin.name || coin.id,
                            price: parseFloat(coin.price) || 0,
                            price_change_24h: parseFloat(coin.price_change_24h) || 0,
                            price_change_7d: parseFloat(coin.price_change_7d) || 0,
                            added_at: coin.added_at ? new Date(coin.added_at).getTime() : Date.now(),
                            notes: coin.notes || ''
                        };
                    });
                    
                    watchlistData = {
                        name: 'Lista importada',
                        description: 'Importada desde CSV',
                        coins
                    };
                    break;
                }
                
                default:
                    throw new Error(`Formato de importación no soportado: ${format}`);
            }
            
            // Validar datos mínimos
            if (!watchlistData || !watchlistData.name) {
                throw new Error('Datos de lista inválidos o incompletos');
            }
            
            // Crear nueva lista con los datos importados
            const newWatchlist = await this.createWatchlist(
                watchlistData.name,
                watchlistData.description || 'Lista importada',
                {
                    tags: watchlistData.tags || [],
                    is_public: watchlistData.is_public || false
                }
            );
            
            // Añadir monedas si existen
            if (Array.isArray(watchlistData.coins) && watchlistData.coins.length > 0) {
                const coinPromises = watchlistData.coins.map(coin => 
                    this.addCoinToWatchlist(newWatchlist.id, coin)
                );
                
                await Promise.all(coinPromises);
            }
            
            // Obtener la lista actualizada
            return this.getWatchlistById(newWatchlist.id);
            
        } catch (error) {
            console.error('Error al importar lista:', error);
            throw error;
        }
    }
    
    /**
     * Mapea una cabecera de CSV a una propiedad de moneda
     * @private
     * @param {string} header - Cabecera de CSV
     * @returns {string} - Nombre de propiedad
     */
    mapCsvHeaderToProperty(header) {
        const headerMap = {
            'ID': 'id',
            'Símbolo': 'symbol',
            'Symbol': 'symbol',
            'Nombre': 'name',
            'Name': 'name',
            'Precio': 'price',
            'Price': 'price',
            'Cambio 24h (%)': 'price_change_24h',
            '24h Change (%)': 'price_change_24h',
            'Cambio 7d (%)': 'price_change_7d',
            '7d Change (%)': 'price_change_7d',
            'Fecha añadido': 'added_at',
            'Date Added': 'added_at',
            'Notas': 'notes',
            'Notes': 'notes'
        };
        
        return headerMap[header] || header.toLowerCase().replace(/\s+/g, '_');
    }
    
    /**
     * Genera un enlace compartible para una lista
     * @param {string} watchlistId - ID de la lista
     * @returns {Promise<string>} - Promesa que resuelve a la URL compartible
     */
    async shareWatchlist(watchlistId) {
        try {
            const watchlist = this.getWatchlistById(watchlistId);
            
            if (!watchlist) {
                throw new Error(`Lista de seguimiento con ID ${watchlistId} no encontrada`);
            }
            
            // Verificar si la lista es pública
            if (!watchlist.is_public) {
                // Hacer la lista pública automáticamente
                await this.editWatchlist(watchlistId, { is_public: true });
            }
            
            // En una implementación real, aquí se generaría un enlace corto
            // o un identificador para compartir a través de un servicio.
            // Para esta implementación, simplemente generamos una URL simulada.
            
            const shareUrl = `${window.location.origin}/watchlist/shared/${watchlistId}`;
            
            console.log(`Enlace generado para compartir lista "${watchlist.name}": ${shareUrl}`);
            
            // Notificar compartir
            EventBus.publish('watchlist.shared', {
                watchlistId,
                watchlistName: watchlist.name,
                shareUrl
            });
            
            return shareUrl;
            
        } catch (error) {
            console.error('Error al compartir lista:', error);
            throw error;
        }
    }
    
    /**
     * Configura notificaciones para una moneda en una lista
     * @param {string} watchlistId - ID de la lista
     * @param {string} coinId - ID de la moneda
     * @param {Object} alertSettings - Configuración de alertas
     * @returns {Promise<Object>} - Promesa que resuelve a la moneda actualizada
     */
    async setAlertForCoin(watchlistId, coinId, alertSettings) {
        try {
            const watchlist = this.getWatchlistById(watchlistId);
            
            if (!watchlist) {
                throw new Error(`Lista de seguimiento con ID ${watchlistId} no encontrada`);
            }
            
            const coin = watchlist.coins.find(c => c.id === coinId);
            if (!coin) {
                throw new Error(`Moneda ${coinId} no encontrada en la lista`);
            }
            
            // Actualizar configuración de alertas
            const updatedCoin = await this.updateCoinInWatchlist(watchlistId, coinId, {
                alert_settings: alertSettings
            });
            
            // Crear alerta en el servicio de alertas si está disponible
            if (this.alertsService && alertSettings) {
                try {
                    const alertConfig = {
                        type: alertSettings.type,
                        coinId: coinId,
                        coinName: coin.name,
                        coinSymbol: coin.symbol,
                        threshold: alertSettings.threshold,
                        repeat: alertSettings.repeat || 'once',
                        notificationChannels: alertSettings.notificationChannels || ['app'],
                        message: alertSettings.message || `Alerta de precio para ${coin.symbol}`,
                        source: 'watchlist',
                        sourceId: watchlistId
                    };
                    
                    await this.alertsService.createAlert(alertConfig);
                } catch (alertError) {
                    console.warn('Error al crear alerta externa:', alertError);
                    // Continuar a pesar del error en la creación de la alerta externa
                }
            }
            
            console.log(`Alerta configurada para ${coin.name} en lista "${watchlist.name}"`);
            
            return coin;
            
        } catch (error) {
            console.error('Error al configurar alerta:', error);
            throw error;
        }
    }
    
    /**
     * Sincroniza listas entre dispositivos/sesiones
     * @returns {Promise<boolean>} - Promesa que resuelve a true si se sincronizó correctamente
     */
    async syncWatchlists() {
        // Nota: En una implementación real, esta función se conectaría
        // con un servicio backend para sincronizar datos entre dispositivos.
        // En esta implementación, simulamos la sincronización con localStorage.
        
        try {
            console.log('Sincronizando listas de seguimiento entre dispositivos...');
            
            // Simular proceso de sincronización
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // En una implementación real, aquí iría la lógica para:
            // 1. Obtener listas del servidor
            // 2. Resolver conflictos con las listas locales
            // 3. Actualizar las listas locales y en el servidor
            
            console.log('Sincronización completada');
            
            return true;
        } catch (error) {
            console.error('Error al sincronizar listas:', error);
            return false;
        }
    }
    
    /**
     * Restablece a listas predeterminadas
     * @private
     */
    resetToDefaultWatchlists() {
        console.log('Restableciendo a listas predeterminadas');
        
        // Limpiar listas existentes
        this.watchlists = [];
        this.activeWatchlist = null;
        
        // Crear lista predeterminada
        this.createWatchlist('Mi primera lista', 'Lista principal de seguimiento')
            .then(() => console.log('Lista predeterminada creada'))
            .catch(error => console.error('Error al crear lista predeterminada:', error));
    }
    
    /**
     * Libera recursos y detiene actualizaciones
     */
    dispose() {
        console.log('Liberando recursos del servicio de watchlist');
        
        // Detener actualizaciones en tiempo real
        this.stopRealTimeUpdates();
        
        // Limpiar caché
        this.cachedPrices = {};
        
        // En una implementación real, aquí se cancelarían suscripciones a eventos
    }
}

// Exportar una instancia predeterminada para uso rápido
export const watchlistService = new WatchlistService();

/**
 * Ejemplo de uso:
 * 
 * // Importar el servicio
 * import { watchlistService } from './watchlist-service.js';
 * 
 * // Inicializar
 * watchlistService.init().then(() => {
 *   console.log('Servicio de watchlist listo');
 * });
 * 
 * // Obtener todas las listas
 * const lists = watchlistService.getAllWatchlists();
 * 
 * // Crear una nueva lista
 * watchlistService.createWatchlist('Mi cartera', 'Monedas que poseo')
 *   .then(newList => {
 *     // Añadir monedas
 *     return watchlistService.addCoinToWatchlist(newList.id, {
 *       id: 'bitcoin',
 *       symbol: 'BTC',
 *       name: 'Bitcoin'
 *     });
 *   });
 * 
 * // Calcular rendimiento
 * const performance = watchlistService.calculateWatchlistPerformance(
 *   'id_de_mi_lista', '7d'
 * );
 * console.log(`Rendimiento 7d: ${performance.changePercentage.toFixed(2)}%`);
 */
