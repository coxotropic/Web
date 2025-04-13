/**
 * coin-service.js
 * Servicio para gestionar información detallada de criptomonedas
 * 
 * Este servicio proporciona métodos para obtener y procesar información
 * detallada sobre criptomonedas específicas, incluyendo precios actuales,
 * datos históricos, información fundamental y métricas on-chain.
 */

import { MarketDataService } from '../market/market-data-service.js';
import { EventBus } from '../utils/event-bus.js';
import { StorageManager } from '../utils/storage-manager.js';

/**
 * @class CoinService
 * @description Servicio principal para gestionar información detallada de criptomonedas
 */
export class CoinService {
    /**
     * @constructor
     * @param {Object} options - Opciones de configuración
     * @param {number} options.cacheDuration - Duración de la caché en milisegundos (por defecto: 5 minutos)
     * @param {string[]} options.preferredSources - Fuentes de datos preferidas en orden de prioridad
     * @param {boolean} options.enableRealTimeUpdates - Habilitar actualizaciones en tiempo real
     * @param {number} options.updateInterval - Intervalo para actualizaciones periódicas en ms
     */
    constructor(options = {}) {
        // Opciones por defecto
        this.options = {
            cacheDuration: 5 * 60 * 1000, // 5 minutos
            preferredSources: ['coingecko', 'coinmarketcap', 'binance'],
            enableRealTimeUpdates: true,
            updateInterval: 60 * 1000, // 1 minuto
            ...options
        };
        
        // Servicio de datos de mercado (dependencia)
        this.marketDataService = new MarketDataService();
        
        // Caché para almacenar datos y reducir peticiones
        this.cache = {
            coinDetails: {}, // Datos básicos por moneda
            priceHistory: {}, // Historial de precios por moneda y timeframe
            fundamentals: {}, // Datos fundamentales por moneda
            technical: {}, // Indicadores técnicos por moneda
            onChain: {}, // Métricas on-chain por moneda
            social: {}, // Datos sociales por moneda
            exchanges: {}, // Exchanges por moneda
            events: {}, // Eventos importantes por moneda
            correlations: {} // Correlaciones por moneda
        };
        
        // Suscripciones a actualizaciones en tiempo real
        this.subscriptions = {
            priceUpdates: {},
            newEvents: {}
        };
        
        // Conexiones WebSocket activas
        this.activeWebSockets = {};
        
        // Intervalos de actualización periódica
        this.updateIntervals = {};
        
        // Estado de inicialización
        this.initialized = false;
        
        // Inicializar si se solicita
        if (options.autoInit) {
            this.init();
        }
    }
    
    /**
     * Inicializa el servicio y establece los listeners de eventos
     * @returns {Promise<void>}
     */
    async init() {
        if (this.initialized) return;
        
        try {
            console.log('Inicializando CoinService...');
            
            // Subscribirse a eventos relevantes del sistema
            EventBus.subscribe('market.dataUpdated', this._handleMarketDataUpdate.bind(this));
            
            // Recuperar datos en caché si existen
            this._restoreCacheFromStorage();
            
            this.initialized = true;
            console.log('CoinService inicializado correctamente');
            
            // Emitir evento de inicialización
            EventBus.publish('coin.serviceInitialized', { success: true });
        } catch (error) {
            console.error('Error al inicializar CoinService:', error);
            // Emitir evento de error de inicialización
            EventBus.publish('coin.serviceInitializationFailed', { error });
            throw error;
        }
    }
    
    /**
     * Obtiene información detallada de una criptomoneda específica
     * @param {string} coinId - Identificador de la criptomoneda (ej: 'bitcoin', 'ethereum')
     * @param {Object} options - Opciones adicionales
     * @param {boolean} options.forceRefresh - Forzar actualización ignorando caché
     * @param {string[]} options.include - Campos específicos a incluir ('price', 'marketCap', etc.)
     * @returns {Promise<Object>} Datos detallados de la criptomoneda
     */
    async getCoinDetails(coinId, options = {}) {
        try {
            const defaultOptions = {
                forceRefresh: false,
                include: ['all']
            };
            
            const mergedOptions = { ...defaultOptions, ...options };
            
            // Comprobar caché si no se fuerza actualización
            if (!mergedOptions.forceRefresh && this.cache.coinDetails[coinId]) {
                const cachedData = this.cache.coinDetails[coinId];
                // Verificar si los datos en caché aún son válidos
                if (Date.now() - cachedData.timestamp < this.options.cacheDuration) {
                    console.log(`Usando datos en caché para ${coinId}`);
                    return cachedData.data;
                }
            }
            
            console.log(`Obteniendo datos actualizados para ${coinId}`);
            
            // Obtener datos de múltiples fuentes y normalizar
            const coinData = await this._fetchAndNormalizeCoinData(coinId, mergedOptions.include);
            
            // Guardar en caché
            this.cache.coinDetails[coinId] = {
                data: coinData,
                timestamp: Date.now()
            };
            
            // Almacenar en storage persistente para uso futuro
            this._updateCacheStorage();
            
            return coinData;
        } catch (error) {
            console.error(`Error al obtener detalles para ${coinId}:`, error);
            // Intentar recuperar últimos datos en caché si están disponibles
            if (this.cache.coinDetails[coinId]) {
                console.warn(`Retornando últimos datos en caché para ${coinId} debido a error`);
                return this.cache.coinDetails[coinId].data;
            }
            throw error;
        }
    }
    
    /**
     * Obtiene el historial de precios de una criptomoneda
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {string} timeframe - Marco temporal ('1d', '7d', '30d', '90d', '1y', 'all')
     * @param {string} interval - Intervalo de los datos ('1m', '5m', '15m', '1h', '4h', '1d')
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Array>} Array con datos históricos de precios
     */
    async getPriceHistory(coinId, timeframe = '30d', interval = '1d', options = {}) {
        try {
            const cacheKey = `${coinId}_${timeframe}_${interval}`;
            
            // Comprobar caché si no se fuerza actualización
            if (!options.forceRefresh && this.cache.priceHistory[cacheKey]) {
                const cachedData = this.cache.priceHistory[cacheKey];
                // Verificar si los datos en caché aún son válidos (más estricto para datos históricos)
                if (Date.now() - cachedData.timestamp < this.options.cacheDuration * 2) {
                    return cachedData.data;
                }
            }
            
            // Convertir timeframe a parámetros específicos
            const { from, to } = this._timeframeToDateRange(timeframe);
            
            // Obtener datos históricos
            const priceHistory = await this._fetchHistoricalData(coinId, from, to, interval);
            
            // Guardar en caché
            this.cache.priceHistory[cacheKey] = {
                data: priceHistory,
                timestamp: Date.now()
            };
            
            return priceHistory;
        } catch (error) {
            console.error(`Error al obtener historial de precios para ${coinId}:`, error);
            // Intentar recuperar últimos datos en caché si están disponibles
            const cacheKey = `${coinId}_${timeframe}_${interval}`;
            if (this.cache.priceHistory[cacheKey]) {
                return this.cache.priceHistory[cacheKey].data;
            }
            throw error;
        }
    }
    
    /**
     * Suscribirse a actualizaciones en tiempo real del precio de una criptomoneda
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {Function} callback - Función a llamar cuando hay una actualización
     * @returns {Function} Función para cancelar la suscripción
     */
    subscribeToPriceUpdates(coinId, callback) {
        try {
            // Crear array de callbacks si no existe
            if (!this.subscriptions.priceUpdates[coinId]) {
                this.subscriptions.priceUpdates[coinId] = [];
                
                // Iniciar actualizaciones en tiempo real si están habilitadas
                if (this.options.enableRealTimeUpdates) {
                    this._setupRealTimeUpdates(coinId);
                }
            }
            
            // Añadir callback a la lista de suscripciones
            this.subscriptions.priceUpdates[coinId].push(callback);
            
            // Retornar función para cancelar la suscripción
            return () => {
                this._unsubscribeFromPriceUpdates(coinId, callback);
            };
        } catch (error) {
            console.error(`Error al suscribirse a actualizaciones para ${coinId}:`, error);
            throw error;
        }
    }
    
    /**
     * Obtiene información fundamental de una criptomoneda
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Object>} Datos fundamentales
     */
    async getFundamentalData(coinId, options = {}) {
        try {
            // Comprobar caché si no se fuerza actualización
            if (!options.forceRefresh && this.cache.fundamentals[coinId]) {
                const cachedData = this.cache.fundamentals[coinId];
                // Los datos fundamentales cambian con menos frecuencia
                if (Date.now() - cachedData.timestamp < this.options.cacheDuration * 5) {
                    return cachedData.data;
                }
            }
            
            // Obtener datos fundamentales
            const fundamentalData = await this._fetchFundamentalData(coinId);
            
            // Guardar en caché
            this.cache.fundamentals[coinId] = {
                data: fundamentalData,
                timestamp: Date.now()
            };
            
            return fundamentalData;
        } catch (error) {
            console.error(`Error al obtener datos fundamentales para ${coinId}:`, error);
            if (this.cache.fundamentals[coinId]) {
                return this.cache.fundamentals[coinId].data;
            }
            throw error;
        }
    }
    
    /**
     * Obtiene métricas on-chain de una criptomoneda
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {string[]} metrics - Array de métricas a obtener
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Object>} Métricas on-chain
     */
    async getOnChainMetrics(coinId, metrics = ['all'], options = {}) {
        try {
            const cacheKey = `${coinId}_${metrics.join('_')}`;
            
            // Comprobar caché si no se fuerza actualización
            if (!options.forceRefresh && this.cache.onChain[cacheKey]) {
                const cachedData = this.cache.onChain[cacheKey];
                if (Date.now() - cachedData.timestamp < this.options.cacheDuration * 3) {
                    return cachedData.data;
                }
            }
            
            // Obtener métricas on-chain
            const onChainData = await this._fetchOnChainMetrics(coinId, metrics);
            
            // Guardar en caché
            this.cache.onChain[cacheKey] = {
                data: onChainData,
                timestamp: Date.now()
            };
            
            return onChainData;
        } catch (error) {
            console.error(`Error al obtener métricas on-chain para ${coinId}:`, error);
            const cacheKey = `${coinId}_${metrics.join('_')}`;
            if (this.cache.onChain[cacheKey]) {
                return this.cache.onChain[cacheKey].data;
            }
            throw error;
        }
    }
    
    /**
     * Obtiene datos sociales y de desarrollo de una criptomoneda
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Object>} Datos sociales y de desarrollo
     */
    async getSocialData(coinId, options = {}) {
        try {
            // Comprobar caché si no se fuerza actualización
            if (!options.forceRefresh && this.cache.social[coinId]) {
                const cachedData = this.cache.social[coinId];
                if (Date.now() - cachedData.timestamp < this.options.cacheDuration * 2) {
                    return cachedData.data;
                }
            }
            
            // Obtener datos sociales
            const socialData = await this._fetchSocialData(coinId);
            
            // Guardar en caché
            this.cache.social[coinId] = {
                data: socialData,
                timestamp: Date.now()
            };
            
            return socialData;
        } catch (error) {
            console.error(`Error al obtener datos sociales para ${coinId}:`, error);
            if (this.cache.social[coinId]) {
                return this.cache.social[coinId].data;
            }
            throw error;
        }
    }
    
    /**
     * Calcula indicadores técnicos para una criptomoneda
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {string[]} indicators - Indicadores a calcular
     * @param {string} timeframe - Marco temporal para los cálculos
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Object>} Indicadores técnicos
     */
    async getTechnicalIndicators(coinId, indicators = ['rsi', 'macd', 'ema'], timeframe = '1d', options = {}) {
        try {
            const cacheKey = `${coinId}_${indicators.join('_')}_${timeframe}`;
            
            // Comprobar caché si no se fuerza actualización
            if (!options.forceRefresh && this.cache.technical[cacheKey]) {
                const cachedData = this.cache.technical[cacheKey];
                if (Date.now() - cachedData.timestamp < this.options.cacheDuration) {
                    return cachedData.data;
                }
            }
            
            // Obtener datos históricos para calcular indicadores
            const priceHistory = await this.getPriceHistory(coinId, '90d', timeframe);
            
            // Calcular indicadores técnicos
            const technicalData = this._calculateTechnicalIndicators(priceHistory, indicators);
            
            // Guardar en caché
            this.cache.technical[cacheKey] = {
                data: technicalData,
                timestamp: Date.now()
            };
            
            return technicalData;
        } catch (error) {
            console.error(`Error al calcular indicadores técnicos para ${coinId}:`, error);
            const cacheKey = `${coinId}_${indicators.join('_')}_${timeframe}`;
            if (this.cache.technical[cacheKey]) {
                return this.cache.technical[cacheKey].data;
            }
            throw error;
        }
    }
    
    /**
     * Obtiene información sobre exchanges donde se negocia una criptomoneda
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Array>} Array de exchanges con información detallada
     */
    async getExchangeInfo(coinId, options = {}) {
        try {
            // Comprobar caché si no se fuerza actualización
            if (!options.forceRefresh && this.cache.exchanges[coinId]) {
                const cachedData = this.cache.exchanges[coinId];
                // Datos de exchanges no cambian con mucha frecuencia
                if (Date.now() - cachedData.timestamp < this.options.cacheDuration * 5) {
                    return cachedData.data;
                }
            }
            
            // Obtener datos de exchanges
            const exchangeData = await this._fetchExchangeData(coinId);
            
            // Guardar en caché
            this.cache.exchanges[coinId] = {
                data: exchangeData,
                timestamp: Date.now()
            };
            
            return exchangeData;
        } catch (error) {
            console.error(`Error al obtener información de exchanges para ${coinId}:`, error);
            if (this.cache.exchanges[coinId]) {
                return this.cache.exchanges[coinId].data;
            }
            throw error;
        }
    }
    
    /**
     * Obtiene eventos importantes relacionados con una criptomoneda
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Array>} Array de eventos
     */
    async getEvents(coinId, options = {}) {
        try {
            // Comprobar caché si no se fuerza actualización
            if (!options.forceRefresh && this.cache.events[coinId]) {
                const cachedData = this.cache.events[coinId];
                if (Date.now() - cachedData.timestamp < this.options.cacheDuration * 3) {
                    return cachedData.data;
                }
            }
            
            // Obtener eventos
            const eventsData = await this._fetchEventsData(coinId);
            
            // Guardar en caché
            this.cache.events[coinId] = {
                data: eventsData,
                timestamp: Date.now()
            };
            
            return eventsData;
        } catch (error) {
            console.error(`Error al obtener eventos para ${coinId}:`, error);
            if (this.cache.events[coinId]) {
                return this.cache.events[coinId].data;
            }
            throw error;
        }
    }
    
    /**
     * Calcula correlaciones entre una criptomoneda y otros activos
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {string[]} comparedAssets - Assets con los que comparar (otras criptos, acciones, etc)
     * @param {string} timeframe - Marco temporal para el cálculo
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Object>} Matriz de correlaciones
     */
    async getCorrelations(coinId, comparedAssets = ['bitcoin', 'ethereum', 'sp500', 'gold'], timeframe = '90d', options = {}) {
        try {
            const cacheKey = `${coinId}_${comparedAssets.join('_')}_${timeframe}`;
            
            // Comprobar caché si no se fuerza actualización
            if (!options.forceRefresh && this.cache.correlations[cacheKey]) {
                const cachedData = this.cache.correlations[cacheKey];
                if (Date.now() - cachedData.timestamp < this.options.cacheDuration * 3) {
                    return cachedData.data;
                }
            }
            
            // Obtener datos históricos de todos los activos
            const baseAssetHistory = await this.getPriceHistory(coinId, timeframe, '1d');
            const comparedAssetsHistory = {};
            
            for (const asset of comparedAssets) {
                if (asset !== coinId) {
                    comparedAssetsHistory[asset] = await this.getPriceHistory(asset, timeframe, '1d');
                }
            }
            
            // Calcular correlaciones
            const correlations = this._calculateCorrelations(baseAssetHistory, comparedAssetsHistory);
            
            // Guardar en caché
            this.cache.correlations[cacheKey] = {
                data: correlations,
                timestamp: Date.now()
            };
            
            return correlations;
        } catch (error) {
            console.error(`Error al calcular correlaciones para ${coinId}:`, error);
            const cacheKey = `${coinId}_${comparedAssets.join('_')}_${timeframe}`;
            if (this.cache.correlations[cacheKey]) {
                return this.cache.correlations[cacheKey].data;
            }
            throw error;
        }
    }
    
    /**
     * Busca soportes y resistencias para una criptomoneda
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {Object} options - Opciones adicionales
     * @returns {Promise<Object>} Niveles de soporte y resistencia
     */
    async getSupportResistanceLevels(coinId, options = {}) {
        try {
            // Obtener historial de precios para análisis
            const priceHistory = await this.getPriceHistory(coinId, '180d', '1d');
            
            // Calcular niveles de soporte y resistencia
            const levels = this._calculateSupportResistance(priceHistory);
            
            return levels;
        } catch (error) {
            console.error(`Error al calcular niveles de soporte/resistencia para ${coinId}:`, error);
            throw error;
        }
    }
    
    /**
     * Limpia recursos y finaliza conexiones
     */
    dispose() {
        // Cerrar conexiones WebSocket
        Object.values(this.activeWebSockets).forEach(ws => {
            if (ws && ws.readyState !== WebSocket.CLOSED) {
                ws.close();
            }
        });
        
        // Cancelar intervalos de actualización
        Object.values(this.updateIntervals).forEach(interval => {
            clearInterval(interval);
        });
        
        // Vaciar colecciones
        this.activeWebSockets = {};
        this.updateIntervals = {};
        this.subscriptions.priceUpdates = {};
        this.subscriptions.newEvents = {};
        
        // Actualizar cache storage antes de finalizar
        this._updateCacheStorage();
        
        console.log('CoinService finalizado correctamente');
    }
    
    //=============================================================================
    // Métodos privados
    //=============================================================================
    
    /**
     * Obtiene y normaliza datos de varias fuentes
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {string[]} fields - Campos específicos a incluir
     * @returns {Promise<Object>} Datos normalizados
     */
    async _fetchAndNormalizeCoinData(coinId, fields) {
        // Intentar obtener datos de cada fuente en orden de preferencia
        for (const source of this.options.preferredSources) {
            try {
                let data;
                
                switch (source) {
                    case 'coingecko':
                        data = await this._fetchFromCoinGecko(coinId, fields);
                        break;
                    case 'coinmarketcap':
                        data = await this._fetchFromCoinMarketCap(coinId, fields);
                        break;
                    case 'binance':
                        data = await this._fetchFromBinance(coinId, fields);
                        break;
                }
                
                if (data) {
                    // Si se obtuvieron datos, normalizarlos y retornar
                    return this._normalizeData(data, source);
                }
            } catch (error) {
                console.warn(`Error al obtener datos de ${source} para ${coinId}:`, error);
                // Continuar con la siguiente fuente
                continue;
            }
        }
        
        // Si todas las fuentes fallaron, intentar con el servicio de mercado
        try {
            const marketData = await this.marketDataService.getCoinData(coinId);
            return this._normalizeData(marketData, 'market-service');
        } catch (error) {
            console.error(`Todas las fuentes fallaron para ${coinId}:`, error);
            throw new Error(`No se pudieron obtener datos para ${coinId} de ninguna fuente`);
        }
    }
    
    /**
     * Obtiene datos desde la API de CoinGecko
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {string[]} fields - Campos a incluir
     * @returns {Promise<Object>} Datos crudos de CoinGecko
     */
    async _fetchFromCoinGecko(coinId, fields) {
        try {
            const includeAll = fields.includes('all');
            
            // Mapa de correspondencia entre campos internos y parámetros de CoinGecko
            const fieldsMap = {
                price: 'market_data',
                marketCap: 'market_data',
                volume: 'market_data',
                supply: 'market_data',
                description: 'description',
                links: 'links',
                images: 'image',
                platforms: 'platforms',
                categories: 'categories',
                community: 'community_data',
                developer: 'developer_data'
            };
            
            // Construir parámetros según campos solicitados
            let params = [];
            
            if (includeAll) {
                params.push('localization=false');
                params.push('tickers=true');
                params.push('market_data=true');
                params.push('community_data=true');
                params.push('developer_data=true');
            } else {
                const geckoParams = new Set();
                
                fields.forEach(field => {
                    if (fieldsMap[field]) {
                        geckoParams.add(fieldsMap[field].split('_')[0] + '_data=true');
                    }
                });
                
                params = [...geckoParams];
                params.push('localization=false');
            }
            
            // Construir URL con parámetros
            const url = `https://api.coingecko.com/api/v3/coins/${coinId}?${params.join('&')}`;
            
            // Realizar petición
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Error en respuesta de CoinGecko: ${response.status}`);
            }
            
            const data = await response.json();
            return data;
        } catch (error) {
            console.error(`Error al obtener datos de CoinGecko para ${coinId}:`, error);
            throw error;
        }
    }
    
    /**
     * Obtiene datos desde la API de CoinMarketCap
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {string[]} fields - Campos a incluir
     * @returns {Promise<Object>} Datos crudos de CoinMarketCap
     */
    async _fetchFromCoinMarketCap(coinId, fields) {
        // Implementación simulada para CoinMarketCap (requiere API key en producción)
        try {
            // Normalmente aquí habría una petición real a la API de CoinMarketCap
            // Simulamos una respuesta para demostrar la normalización
            return {
                id: coinId,
                name: coinId.charAt(0).toUpperCase() + coinId.slice(1),
                symbol: coinId.substring(0, 3).toUpperCase(),
                quote: {
                    USD: {
                        price: 45000,
                        market_cap: 850000000000,
                        volume_24h: 28000000000,
                        percent_change_24h: 2.5
                    }
                }
            };
        } catch (error) {
            console.error(`Error al obtener datos de CoinMarketCap para ${coinId}:`, error);
            throw error;
        }
    }
    
    /**
     * Obtiene datos desde la API de Binance
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {string[]} fields - Campos a incluir
     * @returns {Promise<Object>} Datos crudos de Binance
     */
    async _fetchFromBinance(coinId, fields) {
        try {
            // Convertir coinId a símbolo de Binance (ej: 'bitcoin' a 'BTCUSDT')
            const symbol = this._coinIdToSymbol(coinId) + 'USDT';
            
            // Obtener datos del par
            const url = `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Error en respuesta de Binance: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Obtener información adicional si se necesita (solo precio está disponible directamente)
            if (fields.includes('all') || fields.some(f => f !== 'price')) {
                const symbolInfoUrl = `https://api.binance.com/api/v3/exchangeInfo?symbol=${symbol}`;
                const symbolResponse = await fetch(symbolInfoUrl);
                
                if (symbolResponse.ok) {
                    const symbolData = await symbolResponse.json();
                    data.symbolInfo = symbolData.symbols?.[0] || {};
                }
            }
            
            return data;
        } catch (error) {
            console.error(`Error al obtener datos de Binance para ${coinId}:`, error);
            throw error;
        }
    }
    
    /**
     * Normaliza datos de diferentes fuentes a un formato unificado
     * @private
     * @param {Object} data - Datos a normalizar
     * @param {string} source - Fuente de los datos
     * @returns {Object} Datos normalizados
     */
    _normalizeData(data, source) {
        try {
            // Preparar objeto normalizado
            const normalized = {
                id: '',
                name: '',
                symbol: '',
                price: 0,
                priceChange: {
                    '24h': 0,
                    '7d': 0,
                    '30d': 0,
                    '1y': 0
                },
                marketCap: 0,
                volume: 0,
                supply: {
                    circulating: 0,
                    total: 0,
                    max: 0
                },
                ath: {
                    price: 0,
                    date: null,
                    change: 0
                },
                atl: {
                    price: 0,
                    date: null,
                    change: 0
                },
                rank: 0,
                description: '',
                links: {
                    website: [],
                    explorer: [],
                    forum: [],
                    chat: [],
                    github: [],
                    twitter: [],
                    reddit: [],
                    technicalDoc: []
                },
                images: {
                    thumb: '',
                    small: '',
                    large: ''
                },
                platforms: {},
                source: source,
                lastUpdated: new Date()
            };
            
            // Normalizar según la fuente
            switch (source) {
                case 'coingecko':
                    if (data) {
                        normalized.id = data.id || '';
                        normalized.name = data.name || '';
                        normalized.symbol = (data.symbol || '').toUpperCase();
                        
                        if (data.market_data) {
                            const md = data.market_data;
                            normalized.price = md.current_price?.usd || 0;
                            
                            normalized.priceChange['24h'] = md.price_change_percentage_24h || 0;
                            normalized.priceChange['7d'] = md.price_change_percentage_7d || 0;
                            normalized.priceChange['30d'] = md.price_change_percentage_30d || 0;
                            normalized.priceChange['1y'] = md.price_change_percentage_1y || 0;
                            
                            normalized.marketCap = md.market_cap?.usd || 0;
                            normalized.volume = md.total_volume?.usd || 0;
                            
                            normalized.supply.circulating = md.circulating_supply || 0;
                            normalized.supply.total = md.total_supply || 0;
                            normalized.supply.max = md.max_supply || 0;
                            
                            if (md.ath?.usd) {
                                normalized.ath.price = md.ath.usd;
                                normalized.ath.date = md.ath_date?.usd ? new Date(md.ath_date.usd) : null;
                                normalized.ath.change = md.ath_change_percentage?.usd || 0;
                            }
                            
                            if (md.atl?.usd) {
                                normalized.atl.price = md.atl.usd;
                                normalized.atl.date = md.atl_date?.usd ? new Date(md.atl_date.usd) : null;
                                normalized.atl.change = md.atl_change_percentage?.usd || 0;
                            }
                        }
                        
                        normalized.rank = data.market_cap_rank || 0;
                        normalized.description = data.description?.en || '';
                        
                        if (data.links) {
                            normalized.links.website = data.links.homepage?.filter(Boolean) || [];
                            normalized.links.explorer = data.links.blockchain_site?.filter(Boolean) || [];
                            normalized.links.forum = data.links.official_forum_url?.filter(Boolean) || [];
                            normalized.links.chat = data.links.chat_url?.filter(Boolean) || [];
                            normalized.links.github = data.links.repos_url?.github || [];
                            normalized.links.twitter = data.links.twitter_screen_name ? [`https://twitter.com/${data.links.twitter_screen_name}`] : [];
                            normalized.links.reddit = data.links.subreddit_url ? [data.links.subreddit_url] : [];
                            normalized.links.technicalDoc = data.links.whitepaper ? [data.links.whitepaper] : [];
                        }
                        
                        if (data.image) {
                            normalized.images.thumb = data.image.thumb || '';
                            normalized.images.small = data.image.small || '';
                            normalized.images.large = data.image.large || '';
                        }
                        
                        normalized.platforms = data.platforms || {};
                        
                        if (data.last_updated) {
                            normalized.lastUpdated = new Date(data.last_updated);
                        }
                    }
                    break;
                    
                case 'coinmarketcap':
                    if (data) {
                        normalized.id = data.id || '';
                        normalized.name = data.name || '';
                        normalized.symbol = data.symbol || '';
                        
                        if (data.quote?.USD) {
                            const quote = data.quote.USD;
                            normalized.price = quote.price || 0;
                            normalized.priceChange['24h'] = quote.percent_change_24h || 0;
                            normalized.marketCap = quote.market_cap || 0;
                            normalized.volume = quote.volume_24h || 0;
                        }
                        
                        normalized.supply.circulating = data.circulating_supply || 0;
                        normalized.supply.total = data.total_supply || 0;
                        normalized.supply.max = data.max_supply || 0;
                        
                        normalized.rank = data.cmc_rank || 0;
                        
                        if (data.last_updated) {
                            normalized.lastUpdated = new Date(data.last_updated);
                        }
                    }
                    break;
                    
                case 'binance':
                    if (data) {
                        // Extraer el símbolo de la moneda (quitar 'USDT')
                        const rawSymbol = data.symbol?.replace('USDT', '') || '';
                        
                        normalized.id = rawSymbol.toLowerCase() || '';
                        normalized.name = rawSymbol || '';
                        normalized.symbol = rawSymbol || '';
                        
                        normalized.price = parseFloat(data.lastPrice) || 0;
                        normalized.priceChange['24h'] = parseFloat(data.priceChangePercent) || 0;
                        normalized.volume = parseFloat(data.volume) || 0;
                        
                        if (data.symbolInfo) {
                            // Extraer información adicional si está disponible
                            normalized.name = data.symbolInfo.baseAsset || rawSymbol;
                        }
                        
                        normalized.lastUpdated = new Date(data.closeTime || Date.now());
                    }
                    break;
                    
                case 'market-service':
                    // Normalizar desde el servicio de mercado (podría ser similar a CoinGecko)
                    // Aquí la normalización dependería de la estructura del servicio de mercado
                    if (data) {
                        normalized.id = data.id || '';
                        normalized.name = data.name || '';
                        normalized.symbol = data.symbol || '';
                        normalized.price = data.price || 0;
                        normalized.priceChange['24h'] = data.priceChange24h || 0;
                        normalized.marketCap = data.marketCap || 0;
                        normalized.volume = data.volume || 0;
                        
                        // Otros campos según disponibilidad en el servicio de mercado
                    }
                    break;
            }
            
            return normalized;
        } catch (error) {
            console.error(`Error al normalizar datos desde ${source}:`, error);
            // Retornar objeto vacío con estructura correcta en caso de error
            return {
                id: '',
                name: '',
                symbol: '',
                price: 0,
                priceChange: { '24h': 0, '7d': 0, '30d': 0, '1y': 0 },
                marketCap: 0,
                volume: 0,
                supply: { circulating: 0, total: 0, max: 0 },
                ath: { price: 0, date: null, change: 0 },
                atl: { price: 0, date: null, change: 0 },
                rank: 0,
                description: '',
                links: {},
                images: {},
                platforms: {},
                source: 'error',
                error: error.message,
                lastUpdated: new Date()
            };
        }
    }
    
    /**
     * Obtiene datos históricos para una criptomoneda
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {number|string} from - Fecha de inicio (timestamp o string)
     * @param {number|string} to - Fecha de fin (timestamp o string)
     * @param {string} interval - Intervalo de tiempo entre puntos
     * @returns {Promise<Array>} Datos históricos
     */
    async _fetchHistoricalData(coinId, from, to, interval) {
        try {
            // Convertir fechas a timestamps si son strings
            const fromTs = typeof from === 'string' ? new Date(from).getTime() : from;
            const toTs = typeof to === 'string' ? new Date(to).getTime() : to;
            
            // Mapear intervalo al formato de la API
            const intervalMap = {
                '1m': 'minute',
                '5m': 'minute',
                '15m': 'minute',
                '30m': 'minute',
                '1h': 'hour',
                '4h': 'hour',
                '1d': 'day',
                '1w': 'week'
            };
            
            // Determinar intervalo y multiplicador
            let apiInterval = intervalMap[interval] || 'day';
            let multiplier = 1;
            
            if (interval.startsWith('5')) multiplier = 5;
            if (interval.startsWith('15')) multiplier = 15;
            if (interval.startsWith('30')) multiplier = 30;
            if (interval.startsWith('4')) multiplier = 4;
            
            // Construir URL para CoinGecko
            let url = `https://api.coingecko.com/api/v3/coins/${coinId}/market_chart/range?vs_currency=usd&from=${Math.floor(fromTs / 1000)}&to=${Math.floor(toTs / 1000)}`;
            
            // Para intervalos menores a 1 día, podría ser necesario otro endpoint o parámetros
            
            // Realizar petición
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Error en respuesta de API: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Normalizar datos al formato:
            // [{ time, open, high, low, close, volume }, ...]
            return this._normalizeHistoricalData(data, interval);
        } catch (error) {
            console.error(`Error al obtener datos históricos para ${coinId}:`, error);
            throw error;
        }
    }
    
    /**
     * Normaliza datos históricos a un formato estándar
     * @private
     * @param {Object} data - Datos históricos crudos
     * @param {string} interval - Intervalo de los datos
     * @returns {Array} Datos históricos normalizados
     */
    _normalizeHistoricalData(data, interval) {
        try {
            if (!data.prices || !Array.isArray(data.prices)) {
                return [];
            }
            
            const prices = data.prices;
            const volumes = data.total_volumes || [];
            
            // Organizar datos por intervalos de tiempo
            const intervalMap = {
                '1m': 60 * 1000,
                '5m': 5 * 60 * 1000,
                '15m': 15 * 60 * 1000,
                '30m': 30 * 60 * 1000,
                '1h': 60 * 60 * 1000,
                '4h': 4 * 60 * 60 * 1000,
                '1d': 24 * 60 * 60 * 1000,
                '1w': 7 * 24 * 60 * 60 * 1000
            };
            
            const intervalMs = intervalMap[interval] || 24 * 60 * 60 * 1000; // Defecto: 1 día
            
            // Crear buckets para los intervalos
            const buckets = {};
            
            // Procesar precios
            prices.forEach(([timestamp, price]) => {
                const bucketKey = Math.floor(timestamp / intervalMs) * intervalMs;
                if (!buckets[bucketKey]) {
                    buckets[bucketKey] = {
                        time: bucketKey,
                        open: price,
                        high: price,
                        low: price,
                        close: price,
                        volume: 0
                    };
                } else {
                    buckets[bucketKey].high = Math.max(buckets[bucketKey].high, price);
                    buckets[bucketKey].low = Math.min(buckets[bucketKey].low, price);
                    buckets[bucketKey].close = price;
                }
            });
            
            // Procesar volúmenes
            volumes.forEach(([timestamp, volume]) => {
                const bucketKey = Math.floor(timestamp / intervalMs) * intervalMs;
                if (buckets[bucketKey]) {
                    buckets[bucketKey].volume = volume;
                }
            });
            
            // Convertir a array y ordenar por tiempo
            return Object.values(buckets).sort((a, b) => a.time - b.time);
        } catch (error) {
            console.error('Error al normalizar datos históricos:', error);
            return [];
        }
    }
    
    /**
     * Convierte un timeframe a un rango de fechas
     * @private
     * @param {string} timeframe - Timeframe ('1d', '7d', '30d', '90d', '1y', 'all')
     * @returns {Object} Objeto con fechas 'from' y 'to' en timestamps
     */
    _timeframeToDateRange(timeframe) {
        const now = Date.now();
        let from = now;
        
        switch (timeframe) {
            case '1d':
                from = now - 24 * 60 * 60 * 1000;
                break;
            case '7d':
                from = now - 7 * 24 * 60 * 60 * 1000;
                break;
            case '30d':
                from = now - 30 * 24 * 60 * 60 * 1000;
                break;
            case '90d':
                from = now - 90 * 24 * 60 * 60 * 1000;
                break;
            case '1y':
                from = now - 365 * 24 * 60 * 60 * 1000;
                break;
            case 'all':
                from = 0; // Desde el principio del tiempo (limitado por la API)
                break;
            default:
                from = now - 30 * 24 * 60 * 60 * 1000; // Por defecto 30 días
        }
        
        return { from, to: now };
    }
    
    /**
     * Configura actualizaciones en tiempo real para una criptomoneda
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     */
    _setupRealTimeUpdates(coinId) {
        // Evitar configurar múltiples veces
        if (this.updateIntervals[coinId]) {
            return;
        }
        
        console.log(`Configurando actualizaciones en tiempo real para ${coinId}`);
        
        // Método 1: WebSocket si está disponible para la fuente (ej: Binance)
        const symbol = this._coinIdToSymbol(coinId);
        if (symbol && this.options.preferredSources.includes('binance')) {
            try {
                this._setupBinanceWebSocket(coinId, symbol);
            } catch (error) {
                console.warn(`No se pudo establecer WebSocket para ${coinId}:`, error);
                // Fallback a polling
                this._setupPollingUpdates(coinId);
            }
        } else {
            // Método 2: Polling periódico (fallback o para fuentes sin WebSocket)
            this._setupPollingUpdates(coinId);
        }
    }
    
    /**
     * Configura WebSocket para actualizaciones de Binance
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {string} symbol - Símbolo para Binance
     */
    _setupBinanceWebSocket(coinId, symbol) {
        try {
            const wsSymbol = symbol.toLowerCase() + 'usdt@ticker';
            const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${wsSymbol}`);
            
            ws.onopen = () => {
                console.log(`WebSocket conectado para ${coinId}`);
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    
                    // Normalizar datos del ticker
                    const update = {
                        id: coinId,
                        symbol: symbol,
                        price: parseFloat(data.c) || 0,
                        priceChange: {
                            '24h': parseFloat(data.P) || 0
                        },
                        volume: parseFloat(data.v) || 0,
                        lastUpdated: new Date()
                    };
                    
                    // Notificar a subscriptores
                    this._notifyPriceUpdate(coinId, update);
                } catch (error) {
                    console.error(`Error al procesar mensaje WebSocket para ${coinId}:`, error);
                }
            };
            
            ws.onerror = (error) => {
                console.error(`Error en WebSocket para ${coinId}:`, error);
                // Fallback a polling si WebSocket falla
                this._setupPollingUpdates(coinId);
            };
            
            ws.onclose = () => {
                console.log(`WebSocket cerrado para ${coinId}`);
                delete this.activeWebSockets[coinId];
                // Reintentar conexión o fallback a polling
                setTimeout(() => {
                    if (this.subscriptions.priceUpdates[coinId]?.length > 0) {
                        this._setupRealTimeUpdates(coinId);
                    }
                }, 5000);
            };
            
            // Guardar referencia al WebSocket
            this.activeWebSockets[coinId] = ws;
        } catch (error) {
            console.error(`Error al configurar WebSocket para ${coinId}:`, error);
            throw error;
        }
    }
    
    /**
     * Configura actualizaciones periódicas por polling
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     */
    _setupPollingUpdates(coinId) {
        // Evitar configurar múltiples veces
        if (this.updateIntervals[coinId]) {
            return;
        }
        
        console.log(`Configurando actualizaciones por polling para ${coinId}`);
        
        // Crear intervalo para actualizaciones periódicas
        const interval = setInterval(async () => {
            try {
                // Solo actualizar si hay subscriptores
                if (!this.subscriptions.priceUpdates[coinId] || this.subscriptions.priceUpdates[coinId].length === 0) {
                    clearInterval(interval);
                    delete this.updateIntervals[coinId];
                    return;
                }
                
                // Obtener datos actualizados
                const data = await this.getCoinDetails(coinId, { forceRefresh: true });
                
                // Notificar a subscriptores
                this._notifyPriceUpdate(coinId, data);
            } catch (error) {
                console.error(`Error en actualización por polling para ${coinId}:`, error);
            }
        }, this.options.updateInterval);
        
        // Guardar referencia al intervalo
        this.updateIntervals[coinId] = interval;
    }
    
    /**
     * Notifica a los subscriptores sobre una actualización de precio
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {Object} data - Datos actualizados
     */
    _notifyPriceUpdate(coinId, data) {
        const callbacks = this.subscriptions.priceUpdates[coinId] || [];
        
        if (callbacks.length > 0) {
            // Ejecutar todos los callbacks registrados
            callbacks.forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error en callback de actualización para ${coinId}:`, error);
                }
            });
            
            // Emitir evento global
            EventBus.publish('coin.priceUpdated', { coinId, data });
        }
    }
    
    /**
     * Cancela la suscripción a actualizaciones de precio
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {Function} callback - Callback a eliminar
     */
    _unsubscribeFromPriceUpdates(coinId, callback) {
        if (!this.subscriptions.priceUpdates[coinId]) {
            return;
        }
        
        // Filtrar el callback específico
        this.subscriptions.priceUpdates[coinId] = this.subscriptions.priceUpdates[coinId].filter(cb => cb !== callback);
        
        // Si no quedan callbacks, limpiar recursos
        if (this.subscriptions.priceUpdates[coinId].length === 0) {
            delete this.subscriptions.priceUpdates[coinId];
            
            // Cerrar WebSocket si existe
            if (this.activeWebSockets[coinId]) {
                this.activeWebSockets[coinId].close();
                delete this.activeWebSockets[coinId];
            }
            
            // Cancelar intervalo si existe
            if (this.updateIntervals[coinId]) {
                clearInterval(this.updateIntervals[coinId]);
                delete this.updateIntervals[coinId];
            }
            
            console.log(`Recursos liberados para ${coinId}`);
        }
    }
    
    /**
     * Obtiene datos fundamentales de una criptomoneda
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @returns {Promise<Object>} Datos fundamentales
     */
    async _fetchFundamentalData(coinId) {
        try {
            // En producción, esto podría obtener datos de diferentes APIs o combinar fuentes
            // Por simplicidad, utilizamos los mismos datos básicos con algunos campos adicionales
            const data = await this.getCoinDetails(coinId);
            
            // Añadir o calcular métricas fundamentales adicionales
            return {
                ...data,
                metrics: {
                    marketCapToVolume: data.marketCap / (data.volume || 1),
                    circulatingSupplyPercent: data.supply.total ? (data.supply.circulating / data.supply.total) * 100 : null,
                    marketDominance: 0, // Requiere datos del mercado global
                    volatility30d: 0, // Requiere cálculo adicional
                    roi: {
                        '30d': data.priceChange['30d'] || 0,
                        '90d': 0, // Calculado separadamente
                        '1y': data.priceChange['1y'] || 0
                    }
                }
            };
        } catch (error) {
            console.error(`Error al obtener datos fundamentales para ${coinId}:`, error);
            throw error;
        }
    }
    
    /**
     * Obtiene métricas on-chain de una criptomoneda
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @param {string[]} metrics - Array de métricas a obtener
     * @returns {Promise<Object>} Métricas on-chain
     */
    async _fetchOnChainMetrics(coinId, metrics) {
        // En producción, esto consultaría APIs especializadas como Glassnode, IntoTheBlock, etc.
        // Por simplicidad, devolvemos datos simulados
        try {
            // Ejemplo de métricas on-chain simuladas
            return {
                activeAddresses: 980500,
                transactionCount: 285000,
                averageTransactionValue: 32400,
                feeRate: 28.5,
                hashRate: coinId === 'bitcoin' ? 240000000 : null,
                difficulty: coinId === 'bitcoin' ? 35000000000000 : null,
                supplyDistribution: {
                    topAddresses: [
                        { range: '0-100', count: 100, percentage: 20 },
                        { range: '100-1000', count: 1500, percentage: 30 },
                        { range: '1000+', count: 5000, percentage: 50 }
                    ]
                },
                miningProfitability: coinId === 'bitcoin' ? 0.15 : null,
                staking: {
                    totalStaked: coinId === 'ethereum' ? 32600000 : null,
                    stakingYield: coinId === 'ethereum' ? 4.2 : null
                },
                timestamp: Date.now()
            };
        } catch (error) {
            console.error(`Error al obtener métricas on-chain para ${coinId}:`, error);
            throw error;
        }
    }
    
    /**
     * Obtiene datos sociales y de desarrollo de una criptomoneda
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @returns {Promise<Object>} Datos sociales y de desarrollo
     */
    async _fetchSocialData(coinId) {
        try {
            // En producción, esto consultaría APIs sociales y de desarrollo
            // Por simplicidad, devolvemos datos simulados o recuperamos parte de CoinGecko
            let socialData = {
                twitter: {
                    followers: 0,
                    tweetVolume24h: 0,
                    engagement: 0
                },
                reddit: {
                    subscribers: 0,
                    activeAccounts: 0,
                    postsPerDay: 0
                },
                github: {
                    stars: 0,
                    forks: 0,
                    commits: 0,
                    contributors: 0,
                    lastUpdate: null
                },
                sentiment: {
                    overall: 0, // -100 a 100
                    twitter: 0,
                    reddit: 0,
                    news: 0
                },
                lastUpdated: new Date()
            };
            
            // Intentar obtener datos reales de CoinGecko si es posible
            try {
                const url = `https://api.coingecko.com/api/v3/coins/${coinId}?localization=false&community_data=true&developer_data=true`;
                const response = await fetch(url);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.community_data) {
                        const community = data.community_data;
                        socialData.twitter.followers = community.twitter_followers || 0;
                        socialData.reddit.subscribers = community.reddit_subscribers || 0;
                        socialData.reddit.activeAccounts = community.reddit_accounts_active_48h || 0;
                    }
                    
                    if (data.developer_data) {
                        const developer = data.developer_data;
                        socialData.github.stars = developer.stars || 0;
                        socialData.github.forks = developer.forks || 0;
                        socialData.github.commits = developer.commit_count_4_weeks || 0;
                        socialData.github.contributors = developer.pull_request_contributors || 0;
                        socialData.github.lastUpdate = developer.last_push_date ? new Date(developer.last_push_date) : null;
                    }
                }
            } catch (error) {
                console.warn(`No se pudieron obtener datos sociales reales para ${coinId}:`, error);
                // Continuar con datos simulados
            }
            
            // Simular datos que no se pudieron obtener
            socialData.twitter.tweetVolume24h = Math.floor(Math.random() * 5000);
            socialData.twitter.engagement = Math.floor(Math.random() * 100) / 10;
            socialData.reddit.postsPerDay = Math.floor(Math.random() * 100);
            
            // Simular sentimiento
            socialData.sentiment.twitter = Math.floor(Math.random() * 200) - 100;
            socialData.sentiment.reddit = Math.floor(Math.random() * 200) - 100;
            socialData.sentiment.news = Math.floor(Math.random() * 200) - 100;
            socialData.sentiment.overall = (socialData.sentiment.twitter + socialData.sentiment.reddit + socialData.sentiment.news) / 3;
            
            return socialData;
        } catch (error) {
            console.error(`Error al obtener datos sociales para ${coinId}:`, error);
            throw error;
        }
    }
    
    /**
     * Obtiene información sobre exchanges donde se negocia una criptomoneda
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @returns {Promise<Array>} Array de exchanges con información detallada
     */
    async _fetchExchangeData(coinId) {
        try {
            // En producción, esto consultaría APIs como CoinGecko o CoinMarketCap
            // Intentar obtener de CoinGecko
            const url = `https://api.coingecko.com/api/v3/coins/${coinId}/tickers?include_exchange_logo=true`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`Error en respuesta de API: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Normalizar datos de exchanges
            return data.tickers.map(ticker => ({
                exchange: {
                    id: ticker.market.identifier,
                    name: ticker.market.name,
                    logo: ticker.market.logo,
                    url: `https://www.${ticker.market.identifier}.com` // Aproximación
                },
                pair: ticker.target,
                price: ticker.last,
                volume: ticker.volume,
                spread: ticker.bid_ask_spread_percentage,
                lastUpdated: new Date(ticker.last_traded_at || ticker.timestamp)
            }));
        } catch (error) {
            console.error(`Error al obtener datos de exchanges para ${coinId}:`, error);
            
            // Devolver datos simulados si falla
            return [
                {
                    exchange: { id: 'binance', name: 'Binance', logo: 'https://assets.coingecko.com/markets/images/52/small/binance.jpg' },
                    pair: 'USDT',
                    price: 45230.65,
                    volume: 1265432,
                    spread: 0.12,
                    lastUpdated: new Date()
                },
                {
                    exchange: { id: 'coinbase', name: 'Coinbase', logo: 'https://assets.coingecko.com/markets/images/23/small/Coinbase_Coin_Primary.png' },
                    pair: 'USD',
                    price: 45225.30,
                    volume: 987654,
                    spread: 0.15,
                    lastUpdated: new Date()
                }
            ];
        }
    }
    
    /**
     * Obtiene eventos importantes relacionados con una criptomoneda
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @returns {Promise<Array>} Array de eventos
     */
    async _fetchEventsData(coinId) {
        try {
            // En producción, esto consultaría APIs de eventos o calendarios crypto
            // Por simplicidad, devolvemos datos simulados
            const now = Date.now();
            const day = 24 * 60 * 60 * 1000;
            
            return [
                {
                    id: '1',
                    title: 'Actualización de Red',
                    description: `Importante actualización de la red ${coinId} para mejorar la escalabilidad y reducir tarifas.`,
                    date: new Date(now + 15 * day),
                    type: 'update',
                    source: 'Official Blog',
                    url: `https://${coinId}.org/blog/update`,
                    impact: 'high'
                },
                {
                    id: '2',
                    title: 'Listado en Exchange',
                    description: `${coinId.charAt(0).toUpperCase() + coinId.slice(1)} será listado en un importante exchange.`,
                    date: new Date(now + 5 * day),
                    type: 'exchange',
                    source: 'Exchange Announcement',
                    url: `https://exchange.com/${coinId}`,
                    impact: 'medium'
                },
                {
                    id: '3',
                    title: 'Conferencia Anual',
                    description: `Conferencia anual de desarrolladores de ${coinId}.`,
                    date: new Date(now + 45 * day),
                    type: 'conference',
                    source: 'Official Twitter',
                    url: `https://twitter.com/${coinId}`,
                    impact: 'medium'
                }
            ];
        } catch (error) {
            console.error(`Error al obtener eventos para ${coinId}:`, error);
            throw error;
        }
    }
    
    /**
     * Calcula indicadores técnicos a partir de datos históricos
     * @private
     * @param {Array} priceHistory - Datos históricos de precios
     * @param {string[]} indicators - Indicadores a calcular
     * @returns {Object} Indicadores técnicos calculados
     */
    _calculateTechnicalIndicators(priceHistory, indicators) {
        try {
            // Preparar arrays para cálculos
            const closes = priceHistory.map(candle => candle.close);
            const highs = priceHistory.map(candle => candle.high);
            const lows = priceHistory.map(candle => candle.low);
            const volumes = priceHistory.map(candle => candle.volume);
            const dates = priceHistory.map(candle => candle.time);
            
            // Objeto para almacenar resultados
            const results = {
                dates: dates
            };
            
            // Calcular indicadores solicitados
            indicators.forEach(indicator => {
                switch (indicator.toLowerCase()) {
                    case 'sma':
                    case 'ema':
                        results[indicator] = this._calculateMovingAverages(closes, indicator);
                        break;
                    case 'rsi':
                        results.rsi = this._calculateRSI(closes);
                        break;
                    case 'macd':
                        results.macd = this._calculateMACD(closes);
                        break;
                    case 'bollinger':
                        results.bollinger = this._calculateBollingerBands(closes);
                        break;
                    case 'volume':
                        results.volume = volumes;
                        break;
                }
            });
            
            return results;
        } catch (error) {
            console.error('Error al calcular indicadores técnicos:', error);
            throw error;
        }
    }
    
    /**
     * Calcula medias móviles (SMA/EMA)
     * @private
     * @param {number[]} data - Array de precios de cierre
     * @param {string} type - Tipo de media móvil ('sma' o 'ema')
     * @param {number[]} periods - Períodos para calcular (por defecto [7, 25, 99])
     * @returns {Object} Medias móviles calculadas
     */
    _calculateMovingAverages(data, type = 'sma', periods = [7, 25, 99]) {
        const results = {};
        
        periods.forEach(period => {
            const key = `${type.toLowerCase()}${period}`;
            results[key] = [];
            
            // Rellenar con nulls hasta tener suficientes datos
            for (let i = 0; i < Math.min(period - 1, data.length); i++) {
                results[key].push(null);
            }
            
            if (type.toLowerCase() === 'sma') {
                // Calcular SMA (Simple Moving Average)
                for (let i = period - 1; i < data.length; i++) {
                    let sum = 0;
                    for (let j = 0; j < period; j++) {
                        sum += data[i - j];
                    }
                    results[key].push(sum / period);
                }
            } else if (type.toLowerCase() === 'ema') {
                // Calcular EMA (Exponential Moving Average)
                const multiplier = 2 / (period + 1);
                
                // Primer valor es SMA
                let ema = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
                results[key][period - 1] = ema;
                
                // Calcular valores EMA siguientes
                for (let i = period; i < data.length; i++) {
                    ema = (data[i] - ema) * multiplier + ema;
                    results[key].push(ema);
                }
            }
        });
        
        return results;
    }
    
    /**
     * Calcula el RSI (Relative Strength Index)
     * @private
     * @param {number[]} data - Array de precios de cierre
     * @param {number} period - Período para el cálculo (por defecto 14)
     * @returns {number[]} Valores RSI calculados
     */
    _calculateRSI(data, period = 14) {
        const rsi = [];
        
        // Rellenar con nulls hasta tener suficientes datos
        for (let i = 0; i < period; i++) {
            rsi.push(null);
        }
        
        // Calcular cambios
        const changes = [];
        for (let i = 1; i < data.length; i++) {
            changes.push(data[i] - data[i - 1]);
        }
        
        // Calcular ganancias y pérdidas
        for (let i = period; i <= changes.length; i++) {
            const gains = changes.slice(i - period, i).filter(change => change > 0);
            const losses = changes.slice(i - period, i).filter(change => change < 0).map(Math.abs);
            
            const avgGain = gains.reduce((sum, val) => sum + val, 0) / period;
            const avgLoss = losses.reduce((sum, val) => sum + val, 0) / period;
            
            if (avgLoss === 0) {
                rsi.push(100);
            } else {
                const rs = avgGain / avgLoss;
                rsi.push(100 - (100 / (1 + rs)));
            }
        }
        
        return rsi;
    }
    
    /**
     * Calcula el MACD (Moving Average Convergence Divergence)
     * @private
     * @param {number[]} data - Array de precios de cierre
     * @param {number} fastPeriod - Período rápido (por defecto 12)
     * @param {number} slowPeriod - Período lento (por defecto 26)
     * @param {number} signalPeriod - Período de señal (por defecto 9)
     * @returns {Object} Valores MACD, Señal e Histograma
     */
    _calculateMACD(data, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
        const results = {
            macd: [],
            signal: [],
            histogram: []
        };
        
        // Calcular EMAs
        const emaFast = this._calculateMovingAverages(data, 'ema', [fastPeriod]).ema12;
        const emaSlow = this._calculateMovingAverages(data, 'ema', [slowPeriod]).ema26;
        
        // Calcular MACD
        for (let i = 0; i < data.length; i++) {
            if (emaFast[i] === null || emaSlow[i] === null) {
                results.macd.push(null);
            } else {
                results.macd.push(emaFast[i] - emaSlow[i]);
            }
        }
        
        // Calcular Señal (EMA del MACD)
        const validMacdStart = results.macd.findIndex(val => val !== null);
        const validMacd = results.macd.slice(validMacdStart);
        const macdEma = this._calculateMovingAverages(validMacd, 'ema', [signalPeriod]).ema9;
        
        // Rellenar con nulls hasta tener datos válidos
        for (let i = 0; i < validMacdStart + signalPeriod - 1; i++) {
            results.signal.push(null);
            results.histogram.push(null);
        }
        
        // Completar señal e histograma
        for (let i = 0; i < macdEma.length; i++) {
            if (macdEma[i] !== null) {
                results.signal.push(macdEma[i]);
                results.histogram.push(results.macd[validMacdStart + i] - macdEma[i]);
            }
        }
        
        return results;
    }
    
    /**
     * Calcula las Bandas de Bollinger
     * @private
     * @param {number[]} data - Array de precios de cierre
     * @param {number} period - Período para el cálculo (por defecto 20)
     * @param {number} multiplier - Multiplicador para desviación estándar (por defecto 2)
     * @returns {Object} Banda superior, media y banda inferior
     */
    _calculateBollingerBands(data, period = 20, multiplier = 2) {
        const results = {
            upper: [],
            middle: [],
            lower: []
        };
        
        // Calcular SMA (banda media)
        const sma = this._calculateMovingAverages(data, 'sma', [period]).sma20;
        results.middle = sma;
        
        // Rellenar con nulls hasta tener suficientes datos
        for (let i = 0; i < period - 1; i++) {
            results.upper.push(null);
            results.lower.push(null);
        }
        
        // Calcular bandas superior e inferior
        for (let i = period - 1; i < data.length; i++) {
            // Calcular desviación estándar
            let sum = 0;
            for (let j = 0; j < period; j++) {
                sum += Math.pow(data[i - j] - sma[i], 2);
            }
            const stdDev = Math.sqrt(sum / period);
            
            // Calcular bandas
            results.upper.push(sma[i] + (multiplier * stdDev));
            results.lower.push(sma[i] - (multiplier * stdDev));
        }
        
        return results;
    }
    
    /**
     * Calcula correlaciones entre activos
     * @private
     * @param {Array} baseAssetHistory - Datos históricos del activo base
     * @param {Object} comparedAssetsHistory - Datos históricos de activos a comparar
     * @returns {Object} Matriz de correlaciones
     */
    _calculateCorrelations(baseAssetHistory, comparedAssetsHistory) {
        try {
            // Extraer precios de cierre del activo base
            const baseClosePrices = baseAssetHistory.map(candle => candle.close);
            
            // Resultados de correlación para cada activo comparado
            const correlations = {};
            
            for (const [assetId, assetHistory] of Object.entries(comparedAssetsHistory)) {
                // Extraer precios de cierre del activo comparado
                const comparedClosePrices = assetHistory.map(candle => candle.close);
                
                // Asegurar que ambos arrays tienen la misma longitud
                const minLength = Math.min(baseClosePrices.length, comparedClosePrices.length);
                const basePrices = baseClosePrices.slice(0, minLength);
                const comparedPrices = comparedClosePrices.slice(0, minLength);
                
                // Calcular correlación (coeficiente de Pearson)
                const correlation = this._calculatePearsonCorrelation(basePrices, comparedPrices);
                
                correlations[assetId] = {
                    coefficient: correlation,
                    strength: this._interpretCorrelation(correlation),
                    sampleSize: minLength
                };
            }
            
            return correlations;
        } catch (error) {
            console.error('Error al calcular correlaciones:', error);
            return {};
        }
    }
    
    /**
     * Calcula el coeficiente de correlación de Pearson entre dos series
     * @private
     * @param {number[]} x - Primera serie de datos
     * @param {number[]} y - Segunda serie de datos
     * @returns {number} Coeficiente de correlación (-1 a 1)
     */
    _calculatePearsonCorrelation(x, y) {
        const n = x.length;
        
        // Calcular sumas
        let sumX = 0;
        let sumY = 0;
        let sumXY = 0;
        let sumX2 = 0;
        let sumY2 = 0;
        
        for (let i = 0; i < n; i++) {
            sumX += x[i];
            sumY += y[i];
            sumXY += x[i] * y[i];
            sumX2 += x[i] * x[i];
            sumY2 += y[i] * y[i];
        }
        
        // Calcular coeficiente
        const numerator = n * sumXY - sumX * sumY;
        const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        
        if (denominator === 0) return 0;
        
        return numerator / denominator;
    }
    
    /**
     * Interpreta el valor de correlación en términos cualitativos
     * @private
     * @param {number} correlation - Coeficiente de correlación (-1 a 1)
     * @returns {string} Interpretación cualitativa
     */
    _interpretCorrelation(correlation) {
        const absCorr = Math.abs(correlation);
        
        if (absCorr >= 0.7) {
            return correlation > 0 ? 'strong-positive' : 'strong-negative';
        } else if (absCorr >= 0.5) {
            return correlation > 0 ? 'moderate-positive' : 'moderate-negative';
        } else if (absCorr >= 0.3) {
            return correlation > 0 ? 'weak-positive' : 'weak-negative';
        } else {
            return 'none';
        }
    }
    
    /**
     * Calcula niveles de soporte y resistencia
     * @private
     * @param {Array} priceHistory - Datos históricos de precios
     * @returns {Object} Niveles de soporte y resistencia
     */
    _calculateSupportResistance(priceHistory) {
        try {
            const closes = priceHistory.map(candle => candle.close);
            const highs = priceHistory.map(candle => candle.high);
            const lows = priceHistory.map(candle => candle.low);
            
            // Obtener máximo y mínimo global para el período
            const max = Math.max(...highs);
            const min = Math.min(...lows);
            
            // Método simple: encontrar picos y valles locales
            const supports = [];
            const resistances = [];
            
            // Tamaño de la ventana para considerar picos y valles (ajustar según necesidad)
            const windowSize = Math.max(5, Math.floor(priceHistory.length / 20));
            
            for (let i = windowSize; i < priceHistory.length - windowSize; i++) {
                // Comprobar si es un valle (soporte potencial)
                let isValley = true;
                for (let j = i - windowSize; j < i; j++) {
                    if (lows[i] > lows[j]) {
                        isValley = false;
                        break;
                    }
                }
                for (let j = i + 1; j <= i + windowSize; j++) {
                    if (lows[i] > lows[j]) {
                        isValley = false;
                        break;
                    }
                }
                
                if (isValley) {
                    supports.push({
                        price: lows[i],
                        time: priceHistory[i].time,
                        strength: this._calculateLevelStrength(priceHistory, lows[i], 'support')
                    });
                }
                
                // Comprobar si es un pico (resistencia potencial)
                let isPeak = true;
                for (let j = i - windowSize; j < i; j++) {
                    if (highs[i] < highs[j]) {
                        isPeak = false;
                        break;
                    }
                }
                for (let j = i + 1; j <= i + windowSize; j++) {
                    if (highs[i] < highs[j]) {
                        isPeak = false;
                        break;
                    }
                }
                
                if (isPeak) {
                    resistances.push({
                        price: highs[i],
                        time: priceHistory[i].time,
                        strength: this._calculateLevelStrength(priceHistory, highs[i], 'resistance')
                    });
                }
            }
            
            // Agrupar niveles cercanos (tolerancia del 0.5%)
            const groupedSupports = this._groupLevels(supports, 0.005);
            const groupedResistances = this._groupLevels(resistances, 0.005);
            
            // Ordenar por fuerza
            groupedSupports.sort((a, b) => b.strength - a.strength);
            groupedResistances.sort((a, b) => b.strength - a.strength);
            
            // Tomar los N niveles más fuertes
            const topN = 5;
            
            return {
                supports: groupedSupports.slice(0, topN),
                resistances: groupedResistances.slice(0, topN),
                current: closes[closes.length - 1],
                lastUpdated: new Date()
            };
        } catch (error) {
            console.error('Error al calcular niveles de soporte/resistencia:', error);
            throw error;
        }
    }
    
    /**
     * Calcula la fuerza de un nivel de soporte/resistencia
     * @private
     * @param {Array} priceHistory - Datos históricos de precios
     * @param {number} level - Nivel de precio
     * @param {string} type - Tipo de nivel ('support' o 'resistance')
     * @returns {number} Fuerza del nivel (0-10)
     */
    _calculateLevelStrength(priceHistory, level, type) {
        // Tolerancia para considerar que un precio toca un nivel (0.5%)
        const tolerance = level * 0.005;
        
        // Contar cuántas veces el precio ha respetado este nivel
        let touchCount = 0;
        let bounceCount = 0;
        
        for (let i = 0; i < priceHistory.length - 1; i++) {
            const candle = priceHistory[i];
            const nextCandle = priceHistory[i + 1];
            
            if (type === 'support') {
                // Verificar si el precio se acercó al soporte
                if (Math.abs(candle.low - level) <= tolerance) {
                    touchCount++;
                    
                    // Verificar si rebotó al alza después de tocar
                    if (nextCandle.close > candle.close) {
                        bounceCount++;
                    }
                }
            } else {
                // Verificar si el precio se acercó a la resistencia
                if (Math.abs(candle.high - level) <= tolerance) {
                    touchCount++;
                    
                    // Verificar si rebotó a la baja después de tocar
                    if (nextCandle.close < candle.close) {
                        bounceCount++;
                    }
                }
            }
        }
        
        // Calcular fuerza (0-10)
        // Consideramos tanto la cantidad de toques como la proporción de rebotes
        const touchScore = Math.min(touchCount, 10) / 2; // Máximo 5 puntos por cantidad de toques
        const bounceScore = touchCount > 0 ? (bounceCount / touchCount) * 5 : 0; // Máximo 5 puntos por eficacia
        
        return touchScore + bounceScore;
    }
    
    /**
     * Agrupa niveles de precio cercanos
     * @private
     * @param {Array} levels - Array de niveles
     * @param {number} tolerance - Tolerancia relativa para agrupar
     * @returns {Array} Niveles agrupados
     */
    _groupLevels(levels, tolerance) {
        if (levels.length === 0) return [];
        
        // Ordenar por precio
        levels.sort((a, b) => a.price - b.price);
        
        const grouped = [];
        let currentGroup = [levels[0]];
        
        for (let i = 1; i < levels.length; i++) {
            const lastPrice = currentGroup[currentGroup.length - 1].price;
            const currentPrice = levels[i].price;
            
            // Si está dentro de la tolerancia, añadir al grupo actual
            if ((currentPrice - lastPrice) / lastPrice <= tolerance) {
                currentGroup.push(levels[i]);
            } else {
                // Crear un nivel representativo del grupo
                grouped.push(this._createGroupLevel(currentGroup));
                currentGroup = [levels[i]];
            }
        }
        
        // Añadir el último grupo
        if (currentGroup.length > 0) {
            grouped.push(this._createGroupLevel(currentGroup));
        }
        
        return grouped;
    }
    
    /**
     * Crea un nivel representativo de un grupo
     * @private
     * @param {Array} group - Grupo de niveles similares
     * @returns {Object} Nivel representativo
     */
    _createGroupLevel(group) {
        // Calcular precio promedio ponderado por fuerza
        let sumWeightedPrice = 0;
        let sumStrength = 0;
        
        group.forEach(level => {
            sumWeightedPrice += level.price * level.strength;
            sumStrength += level.strength;
        });
        
        const avgPrice = sumStrength > 0 ? sumWeightedPrice / sumStrength : group[0].price;
        
        // Sumar fuerzas y promediar tiempo
        const totalStrength = Math.min(group.reduce((sum, level) => sum + level.strength, 0), 10);
        const avgTime = new Date(group.reduce((sum, level) => sum + level.time, 0) / group.length);
        
        return {
            price: avgPrice,
            time: avgTime,
            strength: totalStrength,
            touchCount: group.length
        };
    }
    
    /**
     * Convierte ID de moneda a símbolo para APIs como Binance
     * @private
     * @param {string} coinId - Identificador de la criptomoneda
     * @returns {string} Símbolo de la moneda
     */
    _coinIdToSymbol(coinId) {
        // Mapa de conversión para monedas comunes
        const symbolMap = {
            'bitcoin': 'BTC',
            'ethereum': 'ETH',
            'binancecoin': 'BNB',
            'ripple': 'XRP',
            'cardano': 'ADA',
            'solana': 'SOL',
            'polkadot': 'DOT',
            'dogecoin': 'DOGE',
            'uniswap': 'UNI',
            'litecoin': 'LTC'
        };
        
        return symbolMap[coinId] || coinId.substring(0, 3).toUpperCase();
    }
    
    /**
     * Gestiona actualizaciones de datos del mercado
     * @private
     * @param {Object} data - Datos actualizados del mercado
     */
    _handleMarketDataUpdate(data) {
        // Actualizar caché si hay datos relevantes
        if (data.updates && Array.isArray(data.updates)) {
            data.updates.forEach(update => {
                if (update.id && this.cache.coinDetails[update.id]) {
                    // Actualizar solo ciertos campos
                    const cached = this.cache.coinDetails[update.id].data;
                    
                    if (update.price) cached.price = update.price;
                    if (update.marketCap) cached.marketCap = update.marketCap;
                    if (update.volume) cached.volume = update.volume;
                    if (update.priceChange) {
                        Object.assign(cached.priceChange, update.priceChange);
                    }
                    
                    // Actualizar timestamp
                    this.cache.coinDetails[update.id].data.lastUpdated = new Date();
                    
                    // Notificar a subscriptores
                    this._notifyPriceUpdate(update.id, cached);
                }
            });
        }
    }
    
    /**
     * Restaura datos en caché desde almacenamiento persistente
     * @private
     */
    _restoreCacheFromStorage() {
        try {
            // Intentar recuperar caché guardada
            const cachedData = StorageManager.get('coin-service.cache');
            
            if (cachedData) {
                // Restaurar solo si los datos no son muy antiguos (1 hora)
                if (Date.now() - cachedData.timestamp < 60 * 60 * 1000) {
                    this.cache = cachedData.data;
                    console.log('Caché restaurada desde almacenamiento');
                }
            }
        } catch (error) {
            console.warn('Error al restaurar caché desde almacenamiento:', error);
            // Continuar con caché vacía
        }
    }
    
    /**
     * Actualiza la caché en almacenamiento persistente
     * @private
     */
    _updateCacheStorage() {
        try {
            // Guardar caché actual en almacenamiento
            StorageManager.set('coin-service.cache', {
                data: this.cache,
                timestamp: Date.now()
            });
        } catch (error) {
            console.warn('Error al guardar caché en almacenamiento:', error);
        }
    }
}

// Exportar una instancia por defecto para uso directo
export const coinService = new CoinService({ autoInit: true });
