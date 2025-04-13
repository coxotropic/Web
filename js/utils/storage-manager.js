/**
 * storage-manager.js
 * Módulo para la gestión unificada de almacenamiento de datos
 * en el portal de criptomonedas.
 * 
 * Proporciona una interfaz unificada para trabajar con diferentes
 * mecanismos de almacenamiento (localStorage, sessionStorage, IndexedDB)
 * con funcionalidades avanzadas como caché, compresión, encriptación y más.
 */

/**
 * Clase para la compresión básica de datos
 * Utiliza algoritmos simples para reducir el tamaño de los strings
 */
class DataCompressor {
    /**
     * Comprime un string
     * @param {string} data - Datos a comprimir
     * @returns {string} - Datos comprimidos
     */
    static compress(data) {
        try {
            if (typeof data !== 'string') {
                return data;
            }
            
            // Usar LZString si está disponible (debe incluirse como dependencia)
            if (window.LZString) {
                return window.LZString.compress(data);
            }
            
            // Implementación básica de compresión usando btoa (Base64)
            // No es una verdadera compresión, pero sirve como fallback
            return btoa(encodeURIComponent(data));
        } catch (error) {
            console.warn('Error al comprimir datos:', error);
            return data;
        }
    }
    
    /**
     * Descomprime un string
     * @param {string} data - Datos comprimidos
     * @returns {string} - Datos descomprimidos
     */
    static decompress(data) {
        try {
            if (typeof data !== 'string') {
                return data;
            }
            
            // Usar LZString si está disponible
            if (window.LZString) {
                return window.LZString.decompress(data);
            }
            
            // Implementación básica de descompresión usando atob (Base64)
            return decodeURIComponent(atob(data));
        } catch (error) {
            console.warn('Error al descomprimir datos:', error);
            return data;
        }
    }
}

/**
 * Clase para encriptación básica de datos sensibles
 */
class DataEncryptor {
    /**
     * Encripta un string utilizando una clave
     * @param {string} data - Datos a encriptar
     * @param {string} secretKey - Clave de encriptación
     * @returns {string} - Datos encriptados
     */
    static encrypt(data, secretKey) {
        try {
            if (typeof data !== 'string') {
                return data;
            }
            
            // Creamos un hash simple de la clave
            const keyHash = this._simpleHash(secretKey);
            
            // Encriptación simple por desplazamiento de caracteres (XOR con hash)
            let result = '';
            for (let i = 0; i < data.length; i++) {
                const charCode = data.charCodeAt(i);
                const keyChar = keyHash.charCodeAt(i % keyHash.length);
                result += String.fromCharCode(charCode ^ keyChar);
            }
            
            // Convertimos a base64 para almacenamiento seguro
            return btoa(result);
        } catch (error) {
            console.warn('Error al encriptar datos:', error);
            return data;
        }
    }
    
    /**
     * Desencripta un string utilizando una clave
     * @param {string} data - Datos encriptados
     * @param {string} secretKey - Clave de encriptación
     * @returns {string} - Datos desencriptados
     */
    static decrypt(data, secretKey) {
        try {
            if (typeof data !== 'string') {
                return data;
            }
            
            // Hash de la clave
            const keyHash = this._simpleHash(secretKey);
            
            // Revertimos el proceso de base64
            const encryptedData = atob(data);
            
            // Desencriptación (XOR inverso)
            let result = '';
            for (let i = 0; i < encryptedData.length; i++) {
                const charCode = encryptedData.charCodeAt(i);
                const keyChar = keyHash.charCodeAt(i % keyHash.length);
                result += String.fromCharCode(charCode ^ keyChar);
            }
            
            return result;
        } catch (error) {
            console.warn('Error al desencriptar datos:', error);
            return data;
        }
    }
    
    /**
     * Genera un hash simple de una string
     * @param {string} input - String para generar hash
     * @returns {string} - Hash generado
     * @private
     */
    static _simpleHash(input) {
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            const char = input.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convertir a entero de 32 bits
        }
        
        // Convertimos el número a string para usar en la encriptación
        return hash.toString(16);
    }
}

/**
 * Clase para la gestión de almacenamiento IndexedDB
 */
class IndexedDBStorage {
    /**
     * Constructor
     * @param {string} dbName - Nombre de la base de datos
     * @param {number} version - Versión de la base de datos
     * @param {string} storeName - Nombre del almacén de objetos
     */
    constructor(dbName = 'cryptoPortalDB', version = 1, storeName = 'cryptoData') {
        this.dbName = dbName;
        this.version = version;
        this.storeName = storeName;
        this.db = null;
        this.isConnected = false;
        
        // Inicializar conexión
        this._initDB();
    }
    
    /**
     * Inicializa la conexión a IndexedDB
     * @returns {Promise<IDBDatabase>} - Promesa con la conexión a la base de datos
     * @private
     */
    async _initDB() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                resolve(this.db);
                return;
            }
            
            const request = indexedDB.open(this.dbName, this.version);
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Crear el almacén de objetos si no existe
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const objectStore = db.createObjectStore(this.storeName, { keyPath: 'key' });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    objectStore.createIndex('expiry', 'expiry', { unique: false });
                }
            };
            
            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.isConnected = true;
                resolve(this.db);
            };
            
            request.onerror = (event) => {
                console.error('Error al abrir IndexedDB:', event.target.error);
                this.isConnected = false;
                reject(event.target.error);
            };
        });
    }
    
    /**
     * Obtiene una transacción para el almacén de objetos
     * @param {string} mode - Modo de transacción ('readonly' o 'readwrite')
     * @returns {Promise<IDBObjectStore>} - Promesa con el almacén de objetos
     * @private
     */
    async _getStore(mode = 'readonly') {
        const db = await this._initDB();
        const transaction = db.transaction([this.storeName], mode);
        return transaction.objectStore(this.storeName);
    }
    
    /**
     * Guarda un elemento en la base de datos
     * @param {string} key - Clave del elemento
     * @param {*} value - Valor a almacenar
     * @param {number} [expiry=null] - Tiempo de expiración (timestamp)
     * @returns {Promise<boolean>} - Promesa que indica si se guardó correctamente
     */
    async setItem(key, value, expiry = null) {
        try {
            const store = await this._getStore('readwrite');
            
            return new Promise((resolve, reject) => {
                const item = {
                    key: key,
                    value: value,
                    timestamp: Date.now(),
                    expiry: expiry
                };
                
                const request = store.put(item);
                
                request.onsuccess = () => resolve(true);
                request.onerror = (event) => {
                    console.error('Error al guardar en IndexedDB:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('Error en setItem IndexedDB:', error);
            return false;
        }
    }
    
    /**
     * Recupera un elemento de la base de datos
     * @param {string} key - Clave del elemento a recuperar
     * @returns {Promise<*>} - Promesa con el valor recuperado o null si no existe
     */
    async getItem(key) {
        try {
            const store = await this._getStore('readonly');
            
            return new Promise((resolve, reject) => {
                const request = store.get(key);
                
                request.onsuccess = (event) => {
                    const item = event.target.result;
                    
                    if (!item) {
                        resolve(null);
                        return;
                    }
                    
                    // Verificar si el elemento ha expirado
                    if (item.expiry && item.expiry < Date.now()) {
                        // Eliminar elemento expirado
                        this.removeItem(key).then(() => {
                            resolve(null);
                        });
                        return;
                    }
                    
                    resolve(item.value);
                };
                
                request.onerror = (event) => {
                    console.error('Error al recuperar de IndexedDB:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('Error en getItem IndexedDB:', error);
            return null;
        }
    }
    
    /**
     * Elimina un elemento de la base de datos
     * @param {string} key - Clave del elemento a eliminar
     * @returns {Promise<boolean>} - Promesa que indica si se eliminó correctamente
     */
    async removeItem(key) {
        try {
            const store = await this._getStore('readwrite');
            
            return new Promise((resolve, reject) => {
                const request = store.delete(key);
                
                request.onsuccess = () => resolve(true);
                request.onerror = (event) => {
                    console.error('Error al eliminar de IndexedDB:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('Error en removeItem IndexedDB:', error);
            return false;
        }
    }
    
    /**
     * Limpia elementos expirados de la base de datos
     * @returns {Promise<number>} - Promesa con la cantidad de elementos eliminados
     */
    async clearExpired() {
        try {
            const store = await this._getStore('readwrite');
            
            return new Promise((resolve, reject) => {
                const now = Date.now();
                let deletedCount = 0;
                
                const index = store.index('expiry');
                const keyRange = IDBKeyRange.upperBound(now);
                
                const cursorRequest = index.openCursor(keyRange);
                
                cursorRequest.onsuccess = (event) => {
                    const cursor = event.target.result;
                    
                    if (cursor) {
                        // Solo eliminar entradas que tengan un tiempo de expiración
                        // (expiry no null y mayor que 0)
                        if (cursor.value.expiry !== null && cursor.value.expiry > 0) {
                            const deleteRequest = cursor.delete();
                            deleteRequest.onsuccess = () => deletedCount++;
                        }
                        cursor.continue();
                    } else {
                        resolve(deletedCount);
                    }
                };
                
                cursorRequest.onerror = (event) => {
                    console.error('Error al limpiar expirados:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('Error en clearExpired IndexedDB:', error);
            return 0;
        }
    }
    
    /**
     * Limpia todos los elementos del almacén
     * @returns {Promise<boolean>} - Promesa que indica si se limpiaron correctamente
     */
    async clear() {
        try {
            const store = await this._getStore('readwrite');
            
            return new Promise((resolve, reject) => {
                const request = store.clear();
                
                request.onsuccess = () => resolve(true);
                request.onerror = (event) => {
                    console.error('Error al limpiar IndexedDB:', event.target.error);
                    reject(event.target.error);
                };
            });
        } catch (error) {
            console.error('Error en clear IndexedDB:', error);
            return false;
        }
    }
}

/**
 * Clase principal para la gestión de almacenamiento
 * Proporciona una interfaz unificada para acceder a diferentes mecanismos 
 * de almacenamiento con caché, compresión y encriptación.
 */
export class StorageManager {
    /**
     * Constructor
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        this.options = {
            namespace: 'crypto',       // Prefijo para evitar colisiones
            encryption: {
                enabled: false,        // Si está habilitada la encriptación
                secretKey: 'DEFAULT_KEY' // Clave por defecto (debe cambiarse)
            },
            compression: {
                enabled: true,         // Si está habilitada la compresión
                threshold: 1024        // Umbral de tamaño para activar compresión (bytes)
            },
            cache: {
                enabled: true,         // Si está habilitada la caché en memoria
                maxSize: 100,          // Máximo número de elementos en caché
                ttl: 300000            // Tiempo de vida en ms (5 minutos por defecto)
            },
            sync: {
                enabled: false,        // Si está habilitada la sincronización con servidor
                endpoint: '/api/storage', // Endpoint para sincronización
                interval: 300000       // Intervalo de sincronización (5 minutos)
            },
            defaultExpiry: null,       // Tiempo de expiración por defecto (null = no expira)
            autoCleanup: {
                enabled: true,         // Limpieza automática de elementos expirados
                interval: 900000       // Intervalo de limpieza (15 minutos)
            },
            ...options
        };
        
        // Inicializar caché en memoria
        this.memoryCache = new Map();
        
        // Inicializar contadores
        this.stats = {
            reads: 0,
            writes: 0,
            hits: 0,
            misses: 0
        };
        
        // Crear e inicializar IndexedDB
        this.idb = new IndexedDBStorage(
            `${this.options.namespace}DB`, 
            1, 
            `${this.options.namespace}Store`
        );
        
        // Verificar disponibilidad de mecanismos de almacenamiento
        this.storageAvailability = this._checkStorageAvailability();
        
        // Iniciar limpieza automática si está habilitada
        if (this.options.autoCleanup.enabled) {
            this._startAutoCleanup();
        }
        
        // Iniciar sincronización si está habilitada
        if (this.options.sync.enabled) {
            this._startAutoSync();
        }
    }
    
    /**
     * Verifica la disponibilidad de los diferentes mecanismos de almacenamiento
     * @returns {Object} - Estado de disponibilidad de cada mecanismo
     * @private
     */
    _checkStorageAvailability() {
        const availability = {
            localStorage: false,
            sessionStorage: false,
            indexedDB: false,
            memory: true // La memoria siempre está disponible
        };
        
        // Verificar localStorage
        try {
            const testKey = `${this.options.namespace}_test`;
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            availability.localStorage = true;
        } catch (e) {
            console.warn('localStorage no está disponible:', e);
        }
        
        // Verificar sessionStorage
        try {
            const testKey = `${this.options.namespace}_test`;
            sessionStorage.setItem(testKey, 'test');
            sessionStorage.removeItem(testKey);
            availability.sessionStorage = true;
        } catch (e) {
            console.warn('sessionStorage no está disponible:', e);
        }
        
        // Verificar IndexedDB
        try {
            availability.indexedDB = !!window.indexedDB;
        } catch (e) {
            console.warn('IndexedDB no está disponible:', e);
        }
        
        return availability;
    }
    
    /**
     * Genera una clave namespaced para evitar colisiones
     * @param {string} key - Clave original
     * @returns {string} - Clave con namespace aplicado
     * @private
     */
    _getNamespacedKey(key) {
        return `${this.options.namespace}_${key}`;
    }
    
    /**
     * Serializa un valor para almacenamiento
     * @param {*} value - Valor a serializar
     * @returns {string} - Valor serializado
     * @private
     */
    _serialize(value) {
        try {
            // Convertir a JSON string
            let serialized = JSON.stringify(value);
            
            // Encriptar si está habilitado
            if (this.options.encryption.enabled) {
                serialized = DataEncryptor.encrypt(
                    serialized, 
                    this.options.encryption.secretKey
                );
            }
            
            // Comprimir si está habilitado y el tamaño supera el umbral
            if (this.options.compression.enabled && 
                serialized.length > this.options.compression.threshold) {
                serialized = DataCompressor.compress(serialized);
            }
            
            return serialized;
        } catch (error) {
            console.error('Error al serializar valor:', error);
            return JSON.stringify({ error: 'Error de serialización', value: String(value) });
        }
    }
    
    /**
     * Deserializa un valor almacenado
     * @param {string} serialized - Valor serializado
     * @returns {*} - Valor deserializado
     * @private
     */
    _deserialize(serialized) {
        try {
            if (!serialized) return null;
            
            let value = serialized;
            
            // Intentar descomprimir
            if (this.options.compression.enabled) {
                try {
                    value = DataCompressor.decompress(value);
                } catch (e) {
                    // Si falla la descompresión, asumimos que no estaba comprimido
                }
            }
            
            // Desencriptar si está habilitado
            if (this.options.encryption.enabled) {
                try {
                    value = DataEncryptor.decrypt(
                        value, 
                        this.options.encryption.secretKey
                    );
                } catch (e) {
                    // Si falla la desencriptación, asumimos que no estaba encriptado
                }
            }
            
            // Parsear JSON
            return JSON.parse(value);
        } catch (error) {
            console.error('Error al deserializar valor:', error);
            return null;
        }
    }
    
    /**
     * Agrega un elemento a la caché en memoria
     * @param {string} key - Clave del elemento
     * @param {*} value - Valor a almacenar
     * @param {number} [expiry=null] - Tiempo de expiración (timestamp)
     * @private
     */
    _addToCache(key, value, expiry = null) {
        if (!this.options.cache.enabled) return;
        
        // Si la caché está llena, eliminar el elemento más antiguo
        if (this.memoryCache.size >= this.options.cache.maxSize) {
            const oldestKey = this.memoryCache.keys().next().value;
            this.memoryCache.delete(oldestKey);
        }
        
        const cacheItem = {
            value,
            timestamp: Date.now(),
            expiry: expiry
        };
        
        this.memoryCache.set(key, cacheItem);
    }
    
    /**
     * Obtiene un elemento de la caché en memoria
     * @param {string} key - Clave del elemento
     * @returns {*} - Valor recuperado o null si no existe o ha expirado
     * @private
     */
    _getFromCache(key) {
        if (!this.options.cache.enabled) return null;
        
        const cacheItem = this.memoryCache.get(key);
        
        if (!cacheItem) return null;
        
        // Verificar si el elemento ha expirado
        if (cacheItem.expiry && cacheItem.expiry < Date.now()) {
            this.memoryCache.delete(key);
            return null;
        }
        
        // Verificar si ha superado el TTL de la caché
        const age = Date.now() - cacheItem.timestamp;
        if (age > this.options.cache.ttl) {
            this.memoryCache.delete(key);
            return null;
        }
        
        this.stats.hits++;
        return cacheItem.value;
    }
    
    /**
     * Inicia la limpieza automática de elementos expirados
     * @private
     */
    _startAutoCleanup() {
        const cleanupInterval = setInterval(() => {
            this.clearExpired()
                .then(count => {
                    if (count > 0) {
                        console.log(`Limpieza automática: ${count} elementos eliminados`);
                    }
                })
                .catch(error => {
                    console.error('Error en limpieza automática:', error);
                });
        }, this.options.autoCleanup.interval);
        
        // Guardar referencia al intervalo para poder detenerlo
        this._cleanupInterval = cleanupInterval;
    }
    
    /**
     * Inicia la sincronización automática con el servidor
     * @private
     */
    _startAutoSync() {
        const syncInterval = setInterval(() => {
            this.syncWithServer()
                .then(result => {
                    if (result.updated > 0) {
                        console.log(`Sincronización: ${result.updated} elementos actualizados`);
                    }
                })
                .catch(error => {
                    console.error('Error en sincronización automática:', error);
                });
        }, this.options.sync.interval);
        
        // Guardar referencia al intervalo para poder detenerlo
        this._syncInterval = syncInterval;
    }
    
    /**
     * Guarda un elemento en el almacenamiento
     * @param {string} key - Clave del elemento
     * @param {*} value - Valor a almacenar
     * @param {Object} [options={}] - Opciones adicionales
     * @param {number} [options.expiry=null] - Tiempo de expiración en ms desde ahora (0 = no expira)
     * @param {string} [options.storage=null] - Almacenamiento específico ('local', 'session', 'indexed', 'memory')
     * @param {boolean} [options.encrypt=null] - Si se debe encriptar (sobreescribe config global)
     * @returns {Promise<boolean>} - Promesa que indica si se guardó correctamente
     */
    async setItem(key, value, options = {}) {
        try {
            const nsKey = this._getNamespacedKey(key);
            
            // Procesar opciones
            const expiry = options.expiry !== undefined 
                ? (options.expiry > 0 ? Date.now() + options.expiry : null) 
                : (this.options.defaultExpiry 
                    ? Date.now() + this.options.defaultExpiry 
                    : null);
            
            // Guardar en caché de memoria
            this._addToCache(nsKey, value, expiry);
            
            // Serializar valor
            const serialized = this._serialize(value);
            
            // Incrementar contador de escrituras
            this.stats.writes++;
            
            // Definir el almacenamiento a usar
            const storage = options.storage || null;
            
            // Si se especifica un almacenamiento concreto
            if (storage) {
                switch (storage) {
                    case 'local':
                        if (this.storageAvailability.localStorage) {
                            localStorage.setItem(nsKey, serialized);
                            if (expiry) {
                                localStorage.setItem(`${nsKey}_expiry`, expiry.toString());
                            }
                            return true;
                        }
                        break;
                    case 'session':
                        if (this.storageAvailability.sessionStorage) {
                            sessionStorage.setItem(nsKey, serialized);
                            if (expiry) {
                                sessionStorage.setItem(`${nsKey}_expiry`, expiry.toString());
                            }
                            return true;
                        }
                        break;
                    case 'indexed':
                        if (this.storageAvailability.indexedDB) {
                            return await this.idb.setItem(nsKey, value, expiry);
                        }
                        break;
                    case 'memory':
                        // Ya está en caché, no necesitamos hacer nada más
                        return true;
                }
            }
            
            // Si no se especifica almacenamiento o no está disponible el especificado,
            // intentar guardar en el mejor disponible (cascada)
            
            // Intentar IndexedDB primero
            if (this.storageAvailability.indexedDB) {
                return await this.idb.setItem(nsKey, value, expiry);
            }
            
            // Luego localStorage
            if (this.storageAvailability.localStorage) {
                localStorage.setItem(nsKey, serialized);
                if (expiry) {
                    localStorage.setItem(`${nsKey}_expiry`, expiry.toString());
                }
                return true;
            }
            
            // Luego sessionStorage
            if (this.storageAvailability.sessionStorage) {
                sessionStorage.setItem(nsKey, serialized);
                if (expiry) {
                    sessionStorage.setItem(`${nsKey}_expiry`, expiry.toString());
                }
                return true;
            }
            
            // Si ningún almacenamiento persistente está disponible, sólo queda la caché en memoria
            return true;
        } catch (error) {
            console.error('Error en setItem:', error);
            return false;
        }
    }
    
    /**
     * Recupera un elemento del almacenamiento
     * @param {string} key - Clave del elemento
     * @param {Object} [options={}] - Opciones adicionales
     * @param {*} [options.defaultValue=null] - Valor por defecto si no se encuentra
     * @param {string} [options.storage=null] - Almacenamiento específico ('local', 'session', 'indexed', 'memory')
     * @returns {Promise<*>} - Promesa con el valor recuperado o defaultValue
     */
    async getItem(key, options = {}) {
        try {
            const nsKey = this._getNamespacedKey(key);
            const defaultValue = options.defaultValue !== undefined ? options.defaultValue : null;
            
            // Incrementar contador de lecturas
            this.stats.reads++;
            
            // Intentar recuperar de la caché en memoria primero
            const cachedValue = this._getFromCache(nsKey);
            if (cachedValue !== null) {
                return cachedValue;
            }
            
            // Si no está en caché, incrementar contador de misses
            this.stats.misses++;
            
            // Definir el almacenamiento a usar
            const storage = options.storage || null;
            let value = null;
            
            // Si se especifica un almacenamiento concreto
            if (storage) {
                switch (storage) {
                    case 'local':
                        if (this.storageAvailability.localStorage) {
                            // Verificar expiración
                            const expiry = localStorage.getItem(`${nsKey}_expiry`);
                            if (expiry && parseInt(expiry, 10) < Date.now()) {
                                localStorage.removeItem(nsKey);
                                localStorage.removeItem(`${nsKey}_expiry`);
                                return defaultValue;
                            }
                            
                            const serialized = localStorage.getItem(nsKey);
                            value = serialized ? this._deserialize(serialized) : null;
                        }
                        break;
                    case 'session':
                        if (this.storageAvailability.sessionStorage) {
                            // Verificar expiración
                            const expiry = sessionStorage.getItem(`${nsKey}_expiry`);
                            if (expiry && parseInt(expiry, 10) < Date.now()) {
                                sessionStorage.removeItem(nsKey);
                                sessionStorage.removeItem(`${nsKey}_expiry`);
                                return defaultValue;
                            }
                            
                            const serialized = sessionStorage.getItem(nsKey);
                            value = serialized ? this._deserialize(serialized) : null;
                        }
                        break;
                    case 'indexed':
                        if (this.storageAvailability.indexedDB) {
                            value = await this.idb.getItem(nsKey);
                        }
                        break;
                    case 'memory':
                        // Ya verificamos la caché de memoria, debe ser null
                        value = null;
                        break;
                }
                
                // Si se encontró el valor, agregarlo a la caché
                if (value !== null) {
                    this._addToCache(nsKey, value);
                    return value;
                }
                
                return defaultValue;
            }
            
            // Si no se especifica almacenamiento o no está disponible el especificado,
            // intentar recuperar del mejor disponible (cascada)
            
            // Intentar IndexedDB primero
            if (this.storageAvailability.indexedDB) {
                value = await this.idb.getItem(nsKey);
                if (value !== null) {
                    this._addToCache(nsKey, value);
                    return value;
                }
            }
            
            // Luego localStorage
            if (this.storageAvailability.localStorage) {
                // Verificar expiración
                const expiry = localStorage.getItem(`${nsKey}_expiry`);
                if (expiry && parseInt(expiry, 10) < Date.now()) {
                    localStorage.removeItem(nsKey);
                    localStorage.removeItem(`${nsKey}_expiry`);
                } else {
                    const serialized = localStorage.getItem(nsKey);
                    if (serialized) {
                        value = this._deserialize(serialized);
                        if (value !== null) {
                            this._addToCache(nsKey, value);
                            return value;
                        }
                    }
                }
            }
            
            // Luego sessionStorage
            if (this.storageAvailability.sessionStorage) {
                // Verificar expiración
                const expiry = sessionStorage.getItem(`${nsKey}_expiry`);
                if (expiry && parseInt(expiry, 10) < Date.now()) {
                    sessionStorage.removeItem(nsKey);
                    sessionStorage.removeItem(`${nsKey}_expiry`);
                } else {
                    const serialized = sessionStorage.getItem(nsKey);
                    if (serialized) {
                        value = this._deserialize(serialized);
                        if (value !== null) {
                            this._addToCache(nsKey, value);
                            return value;
                        }
                    }
                }
            }
            
            // Si no se encontró en ningún lado, devolver el valor por defecto
            return defaultValue;
        } catch (error) {
            console.error('Error en getItem:', error);
            return options.defaultValue !== undefined ? options.defaultValue : null;
        }
    }
    
    /**
     * Elimina un elemento del almacenamiento
     * @param {string} key - Clave del elemento
     * @param {Object} [options={}] - Opciones adicionales
     * @param {string} [options.storage=null] - Almacenamiento específico ('local', 'session', 'indexed', 'memory')
     * @returns {Promise<boolean>} - Promesa que indica si se eliminó correctamente
     */
    async removeItem(key, options = {}) {
        try {
            const nsKey = this._getNamespacedKey(key);
            
            // Eliminar de la caché en memoria
            this.memoryCache.delete(nsKey);
            
            // Definir el almacenamiento a usar
            const storage = options.storage || null;
            
            // Si se especifica un almacenamiento concreto
            if (storage) {
                switch (storage) {
                    case 'local':
                        if (this.storageAvailability.localStorage) {
                            localStorage.removeItem(nsKey);
                            localStorage.removeItem(`${nsKey}_expiry`);
                            return true;
                        }
                        break;
                    case 'session':
                        if (this.storageAvailability.sessionStorage) {
                            sessionStorage.removeItem(nsKey);
                            sessionStorage.removeItem(`${nsKey}_expiry`);
                            return true;
                        }
                        break;
                    case 'indexed':
                        if (this.storageAvailability.indexedDB) {
                            return await this.idb.removeItem(nsKey);
                        }
                        break;
                    case 'memory':
                        // Ya eliminado de la caché
                        return true;
                }
                
                return false;
            }
            
            // Si no se especifica almacenamiento, eliminar de todos
            let success = false;
            
            // Eliminar de IndexedDB
            if (this.storageAvailability.indexedDB) {
                const idbResult = await this.idb.removeItem(nsKey);
                success = success || idbResult;
            }
            
            // Eliminar de localStorage
            if (this.storageAvailability.localStorage) {
                localStorage.removeItem(nsKey);
                localStorage.removeItem(`${nsKey}_expiry`);
                success = true;
            }
            
            // Eliminar de sessionStorage
            if (this.storageAvailability.sessionStorage) {
                sessionStorage.removeItem(nsKey);
                sessionStorage.removeItem(`${nsKey}_expiry`);
                success = true;
            }
            
            return success;
        } catch (error) {
            console.error('Error en removeItem:', error);
            return false;
        }
    }
    
    /**
     * Limpia todos los elementos asociados a este namespace
     * @param {Object} [options={}] - Opciones adicionales
     * @param {string} [options.storage=null] - Almacenamiento específico ('local', 'session', 'indexed', 'memory')
     * @returns {Promise<boolean>} - Promesa que indica si se limpiaron correctamente
     */
    async clear(options = {}) {
        try {
            // Definir el almacenamiento a usar
            const storage = options.storage || null;
            
            // Limpiar caché en memoria (solo las claves de este namespace)
            if (!storage || storage === 'memory') {
                for (const key of this.memoryCache.keys()) {
                    if (key.startsWith(this.options.namespace)) {
                        this.memoryCache.delete(key);
                    }
                }
            }
            
            if (storage === 'memory') {
                return true;
            }
            
            // Si se especifica un almacenamiento concreto
            if (storage) {
                switch (storage) {
                    case 'local':
                        if (this.storageAvailability.localStorage) {
                            this._clearNamespacedFromStorage(localStorage);
                            return true;
                        }
                        break;
                    case 'session':
                        if (this.storageAvailability.sessionStorage) {
                            this._clearNamespacedFromStorage(sessionStorage);
                            return true;
                        }
                        break;
                    case 'indexed':
                        if (this.storageAvailability.indexedDB) {
                            return await this.idb.clear();
                        }
                        break;
                }
                
                return false;
            }
            
            // Si no se especifica almacenamiento, limpiar todos
            let success = false;
            
            // Limpiar IndexedDB
            if (this.storageAvailability.indexedDB) {
                const idbResult = await this.idb.clear();
                success = success || idbResult;
            }
            
            // Limpiar localStorage
            if (this.storageAvailability.localStorage) {
                this._clearNamespacedFromStorage(localStorage);
                success = true;
            }
            
            // Limpiar sessionStorage
            if (this.storageAvailability.sessionStorage) {
                this._clearNamespacedFromStorage(sessionStorage);
                success = true;
            }
            
            return success;
        } catch (error) {
            console.error('Error en clear:', error);
            return false;
        }
    }
    
    /**
     * Limpia elementos con el namespace actual de un almacenamiento específico
     * @param {Storage} storage - Objeto de almacenamiento (localStorage/sessionStorage)
     * @private
     */
    _clearNamespacedFromStorage(storage) {
        const keysToRemove = [];
        
        // Primero identificar todas las claves a eliminar
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (key.startsWith(this.options.namespace)) {
                keysToRemove.push(key);
            }
        }
        
        // Luego eliminarlas
        keysToRemove.forEach(key => {
            storage.removeItem(key);
        });
    }
    
    /**
     * Limpia elementos expirados de todos los almacenamientos
     * @returns {Promise<Object>} - Promesa con el número de elementos eliminados por almacenamiento
     */
    async clearExpired() {
        try {
            const result = {
                memory: 0,
                localStorage: 0,
                sessionStorage: 0,
                indexedDB: 0,
                total: 0
            };
            
            // Limpiar caché en memoria
            const now = Date.now();
            for (const [key, item] of this.memoryCache.entries()) {
                if (item.expiry && item.expiry < now) {
                    this.memoryCache.delete(key);
                    result.memory++;
                    result.total++;
                }
            }
            
            // Limpiar localStorage
            if (this.storageAvailability.localStorage) {
                const keysToRemove = [];
                
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key.endsWith('_expiry') && key.startsWith(this.options.namespace)) {
                        const expiry = parseInt(localStorage.getItem(key), 10);
                        if (expiry && expiry < now) {
                            const baseKey = key.substring(0, key.length - 7); // Quitar '_expiry'
                            keysToRemove.push(baseKey);
                            keysToRemove.push(key);
                        }
                    }
                }
                
                keysToRemove.forEach(key => {
                    localStorage.removeItem(key);
                });
                
                result.localStorage = keysToRemove.length / 2; // Dividir por 2 porque contamos pares clave+expiry
                result.total += result.localStorage;
            }
            
            // Limpiar sessionStorage
            if (this.storageAvailability.sessionStorage) {
                const keysToRemove = [];
                
                for (let i = 0; i < sessionStorage.length; i++) {
                    const key = sessionStorage.key(i);
                    if (key.endsWith('_expiry') && key.startsWith(this.options.namespace)) {
                        const expiry = parseInt(sessionStorage.getItem(key), 10);
                        if (expiry && expiry < now) {
                            const baseKey = key.substring(0, key.length - 7); // Quitar '_expiry'
                            keysToRemove.push(baseKey);
                            keysToRemove.push(key);
                        }
                    }
                }
                
                keysToRemove.forEach(key => {
                    sessionStorage.removeItem(key);
                });
                
                result.sessionStorage = keysToRemove.length / 2;
                result.total += result.sessionStorage;
            }
            
            // Limpiar IndexedDB
            if (this.storageAvailability.indexedDB) {
                const deleted = await this.idb.clearExpired();
                result.indexedDB = deleted;
                result.total += deleted;
            }
            
            return result;
        } catch (error) {
            console.error('Error en clearExpired:', error);
            return { memory: 0, localStorage: 0, sessionStorage: 0, indexedDB: 0, total: 0 };
        }
    }
    
    /**
     * Obtiene las estadísticas de uso del StorageManager
     * @returns {Object} - Estadísticas de uso
     */
    getStats() {
        return {
            ...this.stats,
            cacheSize: this.memoryCache.size,
            hitRate: this.stats.reads > 0 
                ? (this.stats.hits / this.stats.reads * 100).toFixed(2) + '%' 
                : '0%',
            availability: this.storageAvailability
        };
    }
    
    /**
     * Sincroniza datos con el servidor (si está configurado)
     * @returns {Promise<Object>} - Resultado de la sincronización
     */
    async syncWithServer() {
        if (!this.options.sync.enabled) {
            return { success: false, message: 'Sincronización no habilitada' };
        }
        
        try {
            // Obtener timestamp de última sincronización
            const lastSyncKey = this._getNamespacedKey('_lastSync');
            let lastSync = await this.getItem(lastSyncKey, { defaultValue: 0 });
            
            // Preparar datos para enviar al servidor
            const payloadData = {
                lastSync: lastSync,
                namespace: this.options.namespace,
                clientId: this._getClientId()
            };
            
            // Realizar petición al servidor
            const response = await fetch(this.options.sync.endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payloadData),
                credentials: 'include' // Incluir cookies para autenticación
            });
            
            if (!response.ok) {
                throw new Error(`Error en la sincronización: ${response.status} ${response.statusText}`);
            }
            
            const result = await response.json();
            
            // Procesar datos recibidos
            if (result.data && Array.isArray(result.data)) {
                let updatedCount = 0;
                
                for (const item of result.data) {
                    if (item.key && item.value !== undefined) {
                        // Guardar cada item recibido
                        await this.setItem(item.key, item.value, {
                            expiry: item.expiry,
                            skipSync: true // Evitar bucle infinito
                        });
                        updatedCount++;
                    }
                }
                
                // Actualizar timestamp de última sincronización
                await this.setItem(lastSyncKey, Date.now(), {
                    skipSync: true
                });
                
                return {
                    success: true,
                    updated: updatedCount,
                    timestamp: Date.now()
                };
            }
            
            return {
                success: true,
                updated: 0,
                message: 'No hay datos nuevos',
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error en sincronización con servidor:', error);
            return {
                success: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * Obtiene o genera un ID de cliente único para sincronización
     * @returns {string} - ID único del cliente
     * @private
     */
    _getClientId() {
        const clientIdKey = this._getNamespacedKey('_clientId');
        
        // Intentar recuperar ID existente de localStorage
        if (this.storageAvailability.localStorage) {
            const savedId = localStorage.getItem(clientIdKey);
            if (savedId) return savedId;
        }
        
        // Generar nuevo ID si no existe
        const newId = 'client_' + Math.random().toString(36).substring(2, 15) + 
                     Math.random().toString(36).substring(2, 15);
        
        // Guardar para uso futuro
        if (this.storageAvailability.localStorage) {
            localStorage.setItem(clientIdKey, newId);
        }
        
        return newId;
    }
    
    /**
     * Verifica si hay suficiente espacio disponible para almacenar datos
     * @param {number} requiredBytes - Bytes necesarios
     * @param {string} storageType - Tipo de almacenamiento ('local', 'session', 'indexed')
     * @returns {Promise<boolean>} - Promesa que indica si hay espacio suficiente
     */
    async hasEnoughSpace(requiredBytes, storageType = 'local') {
        try {
            switch (storageType) {
                case 'local':
                case 'session': {
                    // Para localStorage y sessionStorage, calculamos el espacio utilizado y disponible
                    const storage = storageType === 'local' ? localStorage : sessionStorage;
                    let totalSize = 0;
                    
                    for (let i = 0; i < storage.length; i++) {
                        const key = storage.key(i);
                        const value = storage.getItem(key);
                        totalSize += (key.length + value.length) * 2; // Aproximación: 2 bytes por caracter
                    }
                    
                    // La mayoría de navegadores tienen un límite de 5-10MB
                    // Asumimos 5MB como caso conservador
                    const assumedLimit = 5 * 1024 * 1024; // 5MB en bytes
                    const remaining = assumedLimit - totalSize;
                    
                    return remaining >= requiredBytes;
                }
                case 'indexed': {
                    // Para IndexedDB, es más difícil calcular el espacio
                    // La mayoría de navegadores asignan dinámicamente espacio según necesidad
                    // Podemos usar navigator.storage si está disponible
                    if (navigator.storage && navigator.storage.estimate) {
                        const estimate = await navigator.storage.estimate();
                        const remaining = estimate.quota - estimate.usage;
                        return remaining >= requiredBytes;
                    }
                    
                    // Si no podemos estimar, asumimos que hay espacio
                    // (IndexedDB suele tener límites mucho más altos que localStorage)
                    return true;
                }
                default:
                    return true;
            }
        } catch (error) {
            console.error('Error al verificar espacio disponible:', error);
            // En caso de error, asumimos que hay espacio
            return true;
        }
    }
    
    /**
     * Finaliza el StorageManager, limpiando intervalos y recursos
     */
    dispose() {
        // Detener intervalos de limpieza y sincronización
        if (this._cleanupInterval) {
            clearInterval(this._cleanupInterval);
        }
        
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
        }
        
        // Limpiar caché de memoria
        this.memoryCache.clear();
        
        console.log('StorageManager: recursos liberados');
    }
}

// Exportar una instancia por defecto para facilitar el uso
export const storageManager = new StorageManager();
