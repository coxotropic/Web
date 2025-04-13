/**
 * learn-service.js
 * Servicio para gestionar el contenido educativo en el portal de criptomonedas
 */

import { StorageManager } from '../utils/storage-manager.js';
import { EventBus } from '../utils/event-bus.js';
import { AuthManager } from '../auth/auth.js';

export class LearnService {
    constructor(options = {}) {
        this.options = {
            apiEndpoint: '/api/learn',
            cacheTime: 24 * 60 * 60 * 1000, // 24 horas en milisegundos
            autoSync: true,
            ...options
        };

        // Estado interno
        this.state = {
            initialized: false,
            contentLoaded: false,
            userProgress: null,
            recommendations: null,
            learningPaths: null,
            categories: null,
            contentCache: new Map(),
            favoriteContent: new Set(),
            notes: new Map()
        };

        // Referencias a otros servicios
        this.authManager = options.authManager || AuthManager;
        
        // Inicializar si auto-inicialización está habilitada
        if (this.options.autoInit) {
            this.init();
        }
    }

    /**
     * Inicializa el servicio de aprendizaje
     * @returns {Promise<void>}
     */
    async init() {
        if (this.state.initialized) return;
        
        console.log('Inicializando LearnService...');
        
        try {
            // Cargar datos desde el caché local si existen
            this._loadFromCache();
            
            // Iniciar carga de datos básicos
            await Promise.all([
                this._fetchCategories(),
                this._fetchLearningPaths()
            ]);
            
            // Cargar progreso del usuario si está autenticado
            if (this.authManager.isAuthenticated()) {
                await this._loadUserProgress();
                await this._generateRecommendations();
            }
            
            // Configurar escuchadores de eventos
            this._setupEventListeners();
            
            this.state.initialized = true;
            EventBus.publish('learn.initialized', { success: true });
            console.log('LearnService inicializado con éxito');
        } catch (error) {
            console.error('Error al inicializar LearnService:', error);
            EventBus.publish('learn.initialized', { success: false, error });
        }
    }
    
    /**
     * Obtiene todos los contenidos educativos
     * @param {Object} filters - Filtros para los contenidos
     * @returns {Promise<Array>} Lista de contenidos filtrados
     */
    async getAllContent(filters = {}) {
        if (!this.state.initialized) {
            await this.init();
        }
        
        try {
            // Construir parámetros de filtrado
            const queryParams = new URLSearchParams();
            
            // Añadir filtros a los parámetros
            if (filters.level) queryParams.append('level', filters.level);
            if (filters.category) queryParams.append('category', filters.category);
            if (filters.format) queryParams.append('format', filters.format);
            if (filters.search) queryParams.append('search', filters.search);
            if (filters.page) queryParams.append('page', filters.page);
            if (filters.limit) queryParams.append('limit', filters.limit);
            
            const queryString = queryParams.toString();
            const cacheKey = `content-${queryString}`;
            
            // Intentar obtener desde caché
            const cachedContent = this._getCachedItem(cacheKey);
            if (cachedContent) {
                return cachedContent;
            }
            
            // Obtener de la API si no está en caché
            const url = `${this.options.apiEndpoint}/content${queryString ? `?${queryString}` : ''}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Guardar en caché
            this._setCachedItem(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error('Error al obtener contenidos educativos:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene un contenido educativo específico por ID
     * @param {string} contentId - ID del contenido
     * @returns {Promise<Object>} Detalle del contenido
     */
    async getContentById(contentId) {
        if (!contentId) {
            throw new Error('Se requiere un ID de contenido');
        }
        
        try {
            const cacheKey = `content-detail-${contentId}`;
            
            // Verificar caché
            const cachedItem = this._getCachedItem(cacheKey);
            if (cachedItem) {
                return cachedItem;
            }
            
            // Obtener de la API
            const url = `${this.options.apiEndpoint}/content/${contentId}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Guardar en caché
            this._setCachedItem(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error(`Error al obtener contenido con ID ${contentId}:`, error);
            throw error;
        }
    }
    
    /**
     * Obtiene todas las categorías de contenido educativo
     * @returns {Promise<Array>} Lista de categorías
     */
    async getCategories() {
        if (!this.state.categories) {
            await this._fetchCategories();
        }
        return this.state.categories;
    }
    
    /**
     * Obtiene todas las rutas de aprendizaje disponibles
     * @returns {Promise<Array>} Lista de rutas de aprendizaje
     */
    async getLearningPaths() {
        if (!this.state.learningPaths) {
            await this._fetchLearningPaths();
        }
        return this.state.learningPaths;
    }
    
    /**
     * Obtiene una ruta de aprendizaje específica con su contenido
     * @param {string} pathId - ID de la ruta de aprendizaje
     * @returns {Promise<Object>} Detalle de la ruta con contenidos
     */
    async getLearningPathById(pathId) {
        try {
            const cacheKey = `learning-path-${pathId}`;
            
            // Verificar caché
            const cachedPath = this._getCachedItem(cacheKey);
            if (cachedPath) {
                return cachedPath;
            }
            
            // Obtener de la API
            const url = `${this.options.apiEndpoint}/paths/${pathId}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Guardar en caché
            this._setCachedItem(cacheKey, data);
            
            return data;
        } catch (error) {
            console.error(`Error al obtener ruta de aprendizaje ${pathId}:`, error);
            throw error;
        }
    }
    
    /**
     * Marca un contenido como completado o en progreso
     * @param {string} contentId - ID del contenido
     * @param {number} progress - Porcentaje de progreso (0-100)
     * @param {number} timeSpent - Tiempo en segundos dedicado al contenido
     * @returns {Promise<Object>} Resultado de la operación
     */
    async updateProgress(contentId, progress = 100, timeSpent = 0) {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Usuario no autenticado. Inicie sesión para guardar progreso.');
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            const timestamp = new Date().toISOString();
            
            const progressData = {
                userId,
                contentId,
                progress,
                timeSpent,
                timestamp,
                completed: progress >= 100
            };
            
            // Enviar a la API
            const url = `${this.options.apiEndpoint}/progress`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                },
                body: JSON.stringify(progressData)
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Actualizar el progreso local
            if (!this.state.userProgress) {
                this.state.userProgress = {};
            }
            
            this.state.userProgress[contentId] = progressData;
            
            // Guardar en almacenamiento local
            StorageManager.set('learning.progress', this.state.userProgress);
            
            // Emitir evento de progreso actualizado
            EventBus.publish('learn.progressUpdated', { contentId, progress });
            
            // Actualizar recomendaciones si se completó el contenido
            if (progress >= 100) {
                this._generateRecommendations();
            }
            
            return result;
        } catch (error) {
            console.error('Error al actualizar progreso:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene recomendaciones personalizadas para el usuario
     * @returns {Promise<Array>} Lista de contenidos recomendados
     */
    async getRecommendations() {
        if (!this.authManager.isAuthenticated()) {
            // Retornar recomendaciones genéricas para usuarios no autenticados
            return this._getGenericRecommendations();
        }
        
        if (!this.state.recommendations) {
            await this._generateRecommendations();
        }
        
        return this.state.recommendations;
    }
    
    /**
     * Añade un contenido a favoritos
     * @param {string} contentId - ID del contenido
     * @returns {Promise<Object>} Resultado de la operación
     */
    async addToFavorites(contentId) {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Usuario no autenticado. Inicie sesión para guardar favoritos.');
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            
            // Enviar a la API
            const url = `${this.options.apiEndpoint}/favorites/add`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                },
                body: JSON.stringify({ userId, contentId })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Actualizar localmente
            this.state.favoriteContent.add(contentId);
            StorageManager.set('learning.favorites', Array.from(this.state.favoriteContent));
            
            // Notificar cambio
            EventBus.publish('learn.favoritesUpdated', { 
                contentId, 
                action: 'added',
                favorites: Array.from(this.state.favoriteContent)
            });
            
            return result;
        } catch (error) {
            console.error('Error al añadir a favoritos:', error);
            throw error;
        }
    }
    
    /**
     * Elimina un contenido de favoritos
     * @param {string} contentId - ID del contenido
     * @returns {Promise<Object>} Resultado de la operación
     */
    async removeFromFavorites(contentId) {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Usuario no autenticado.');
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            
            // Enviar a la API
            const url = `${this.options.apiEndpoint}/favorites/remove`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                },
                body: JSON.stringify({ userId, contentId })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Actualizar localmente
            this.state.favoriteContent.delete(contentId);
            StorageManager.set('learning.favorites', Array.from(this.state.favoriteContent));
            
            // Notificar cambio
            EventBus.publish('learn.favoritesUpdated', { 
                contentId, 
                action: 'removed',
                favorites: Array.from(this.state.favoriteContent)
            });
            
            return result;
        } catch (error) {
            console.error('Error al eliminar de favoritos:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene todos los contenidos favoritos del usuario
     * @returns {Promise<Array>} Lista de contenidos favoritos
     */
    async getFavorites() {
        if (!this.authManager.isAuthenticated()) {
            return [];
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            
            // Obtener de la API
            const url = `${this.options.apiEndpoint}/favorites?userId=${userId}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Actualizar estado local
            this.state.favoriteContent = new Set(data.map(item => item.contentId));
            StorageManager.set('learning.favorites', Array.from(this.state.favoriteContent));
            
            return data;
        } catch (error) {
            console.error('Error al obtener favoritos:', error);
            
            // Retornar desde caché local en caso de error
            const cachedFavorites = Array.from(this.state.favoriteContent);
            return cachedFavorites.map(id => ({ contentId: id }));
        }
    }
    
    /**
     * Verifica si un contenido está en favoritos
     * @param {string} contentId - ID del contenido
     * @returns {boolean} true si está en favoritos
     */
    isFavorite(contentId) {
        return this.state.favoriteContent.has(contentId);
    }
    
    /**
     * Guarda una nota para un contenido específico
     * @param {string} contentId - ID del contenido
     * @param {string} note - Texto de la nota
     * @returns {Promise<Object>} Resultado de la operación
     */
    async saveNote(contentId, note) {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Usuario no autenticado. Inicie sesión para guardar notas.');
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            const timestamp = new Date().toISOString();
            
            const noteData = {
                userId,
                contentId,
                note,
                timestamp
            };
            
            // Enviar a la API
            const url = `${this.options.apiEndpoint}/notes`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                },
                body: JSON.stringify(noteData)
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Actualizar localmente
            this.state.notes.set(contentId, noteData);
            
            // Guardar en almacenamiento local
            const allNotes = {};
            this.state.notes.forEach((value, key) => {
                allNotes[key] = value;
            });
            StorageManager.set('learning.notes', allNotes);
            
            // Notificar cambio
            EventBus.publish('learn.noteUpdated', { contentId, note });
            
            return result;
        } catch (error) {
            console.error('Error al guardar nota:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene notas para un contenido específico
     * @param {string} contentId - ID del contenido
     * @returns {Promise<Object>} Nota del contenido
     */
    async getNotes(contentId) {
        if (!this.authManager.isAuthenticated()) {
            return null;
        }
        
        // Verificar en caché local primero
        if (this.state.notes.has(contentId)) {
            return this.state.notes.get(contentId);
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            
            // Obtener de la API
            const url = `${this.options.apiEndpoint}/notes?userId=${userId}&contentId=${contentId}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.length > 0) {
                // Actualizar caché local
                this.state.notes.set(contentId, data[0]);
                return data[0];
            }
            
            return null;
        } catch (error) {
            console.error('Error al obtener notas:', error);
            return null;
        }
    }
    
    /**
     * Valora un contenido educativo
     * @param {string} contentId - ID del contenido
     * @param {number} rating - Valoración (1-5)
     * @param {string} comment - Comentario opcional
     * @returns {Promise<Object>} Resultado de la operación
     */
    async rateContent(contentId, rating, comment = '') {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Usuario no autenticado. Inicie sesión para valorar contenido.');
        }
        
        if (rating < 1 || rating > 5) {
            throw new Error('La valoración debe estar entre 1 y 5');
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            
            const ratingData = {
                userId,
                contentId,
                rating,
                comment,
                timestamp: new Date().toISOString()
            };
            
            // Enviar a la API
            const url = `${this.options.apiEndpoint}/ratings`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                },
                body: JSON.stringify(ratingData)
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Notificar cambio
            EventBus.publish('learn.contentRated', { contentId, rating, comment });
            
            // Invalidar caché del contenido
            this._removeCachedItem(`content-detail-${contentId}`);
            
            return result;
        } catch (error) {
            console.error('Error al valorar contenido:', error);
            throw error;
        }
    }
    
    /**
     * Obtiene estadísticas de aprendizaje del usuario
     * @returns {Promise<Object>} Estadísticas de aprendizaje
     */
    async getUserStatistics() {
        if (!this.authManager.isAuthenticated()) {
            return {
                completedContent: 0,
                inProgressContent: 0,
                totalTimeSpent: 0,
                favoriteTopics: [],
                achievements: []
            };
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            
            // Obtener de la API
            const url = `${this.options.apiEndpoint}/statistics?userId=${userId}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error al obtener estadísticas de usuario:', error);
            
            // Generar estadísticas básicas desde el caché local
            return this._generateLocalStatistics();
        }
    }
    
    /**
     * Exporta las notas y progreso del usuario
     * @param {string} format - Formato de exportación ('pdf', 'json')
     * @returns {Promise<Object>} Datos de exportación o URL del archivo
     */
    async exportLearningData(format = 'json') {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Usuario no autenticado. Inicie sesión para exportar datos.');
        }
        
        try {
            // Recopilar datos a exportar
            const userProgress = this.state.userProgress || {};
            
            // Convertir el mapa de notas a objeto
            const notes = {};
            this.state.notes.forEach((value, key) => {
                notes[key] = value;
            });
            
            const exportData = {
                user: {
                    id: this.authManager.getCurrentUser().id,
                    name: this.authManager.getCurrentUser().name,
                    exportDate: new Date().toISOString()
                },
                progress: userProgress,
                notes: notes,
                favorites: Array.from(this.state.favoriteContent)
            };
            
            if (format === 'json') {
                // Devolver directamente los datos JSON
                return exportData;
            } else if (format === 'pdf') {
                // Solicitar PDF a la API
                const url = `${this.options.apiEndpoint}/export/pdf`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.authManager.getToken()}`
                    },
                    body: JSON.stringify(exportData)
                });
                
                if (!response.ok) {
                    throw new Error(`API error: ${response.status}`);
                }
                
                const result = await response.json();
                return result; // Contiene URL del PDF generado
            } else {
                throw new Error(`Formato de exportación no soportado: ${format}`);
            }
        } catch (error) {
            console.error('Error al exportar datos de aprendizaje:', error);
            throw error;
        }
    }
    
    /**
     * Verifica y otorga logros basados en el progreso del usuario
     * @returns {Promise<Array>} Nuevos logros obtenidos
     */
    async checkAchievements() {
        if (!this.authManager.isAuthenticated()) {
            return [];
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            
            // Obtener estadísticas actuales
            const stats = await this.getUserStatistics();
            
            // Solicitar verificación de logros
            const url = `${this.options.apiEndpoint}/achievements/check`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                },
                body: JSON.stringify({ userId, stats })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Si hay nuevos logros, notificar
            if (result.newAchievements && result.newAchievements.length > 0) {
                EventBus.publish('learn.achievementsUnlocked', { 
                    achievements: result.newAchievements 
                });
            }
            
            return result.newAchievements || [];
        } catch (error) {
            console.error('Error al verificar logros:', error);
            return [];
        }
    }
    
    /**
     * Busca contenido educativo por término
     * @param {string} searchTerm - Término de búsqueda
     * @param {Object} filters - Filtros adicionales
     * @returns {Promise<Array>} Resultados de búsqueda
     */
    async searchContent(searchTerm, filters = {}) {
        try {
            const queryParams = new URLSearchParams();
            queryParams.append('q', searchTerm);
            
            // Añadir filtros adicionales
            if (filters.level) queryParams.append('level', filters.level);
            if (filters.category) queryParams.append('category', filters.category);
            if (filters.format) queryParams.append('format', filters.format);
            if (filters.page) queryParams.append('page', filters.page);
            if (filters.limit) queryParams.append('limit', filters.limit);
            
            const url = `${this.options.apiEndpoint}/search?${queryParams.toString()}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error en búsqueda de contenido:', error);
            throw error;
        }
    }
    
    /**
     * Sincroniza el progreso de aprendizaje entre dispositivos
     * @returns {Promise<Object>} Resultado de la sincronización
     */
    async syncProgress() {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Usuario no autenticado. Inicie sesión para sincronizar progreso.');
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            
            // Obtener progreso actual del servidor
            const url = `${this.options.apiEndpoint}/progress/sync`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                },
                body: JSON.stringify({
                    userId,
                    localProgress: this.state.userProgress,
                    lastSyncTimestamp: StorageManager.get('learning.lastSync')
                })
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Actualizar progreso local con el resultado de la sincronización
            this.state.userProgress = result.mergedProgress;
            
            // Actualizar timestamp de última sincronización
            const now = new Date().toISOString();
            StorageManager.set('learning.lastSync', now);
            StorageManager.set('learning.progress', this.state.userProgress);
            
            // Notificar sincronización
            EventBus.publish('learn.progressSynced', {
                timestamp: now,
                changedItems: result.changedItems
            });
            
            return result;
        } catch (error) {
            console.error('Error al sincronizar progreso:', error);
            throw error;
        }
    }
    
    /* Métodos privados */
    
    /**
     * Configura los escuchadores de eventos
     * @private
     */
    _setupEventListeners() {
        // Escuchar cambios de autenticación
        EventBus.subscribe('auth.loggedIn', this._handleUserLogin.bind(this));
        EventBus.subscribe('auth.loggedOut', this._handleUserLogout.bind(this));
        
        // Sincronización periódica si está habilitada
        if (this.options.autoSync && this.authManager.isAuthenticated()) {
            // Sincronizar cada hora
            this._startAutoSync();
        }
    }
    
    /**
     * Inicia la sincronización automática de progreso
     * @private
     */
    _startAutoSync() {
        const SYNC_INTERVAL = 60 * 60 * 1000; // 1 hora
        
        // Limpiar intervalo existente si hay uno
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
        }
        
        // Establecer nuevo intervalo
        this._syncInterval = setInterval(() => {
            if (this.authManager.isAuthenticated()) {
                this.syncProgress()
                    .catch(error => console.error('Error en sincronización automática:', error));
            } else {
                // Detener sincronización si el usuario no está autenticado
                this._stopAutoSync();
            }
        }, SYNC_INTERVAL);
        
        // También sincronizar cuando la página vuelva a estar activa
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && this.authManager.isAuthenticated()) {
                this.syncProgress()
                    .catch(error => console.error('Error en sincronización por visibilidad:', error));
            }
        });
    }
    
    /**
     * Detiene la sincronización automática
     * @private
     */
    _stopAutoSync() {
        if (this._syncInterval) {
            clearInterval(this._syncInterval);
            this._syncInterval = null;
        }
    }
    
    /**
     * Maneja el evento de inicio de sesión
     * @param {Object} data - Datos del evento
     * @private
     */
    async _handleUserLogin(data) {
        console.log('Usuario ha iniciado sesión, cargando datos educativos', data);
        
        try {
            await this._loadUserProgress();
            await this._generateRecommendations();
            await this.getFavorites();
            
            // Iniciar sincronización
            if (this.options.autoSync) {
                this._startAutoSync();
            }
            
            EventBus.publish('learn.userDataLoaded', { success: true });
        } catch (error) {
            console.error('Error al cargar datos del usuario después de login:', error);
            EventBus.publish('learn.userDataLoaded', { success: false, error });
        }
    }
    
    /**
     * Maneja el evento de cierre de sesión
     * @private
     */
    _handleUserLogout() {
        console.log('Usuario ha cerrado sesión, limpiando datos educativos personalizados');
        
        // Detener sincronización
        this._stopAutoSync();
        
        // Limpiar datos personalizados pero mantener caché general
        this.state.userProgress = null;
        this.state.recommendations = null;
        this.state.favoriteContent = new Set();
        this.state.notes = new Map();
        
        EventBus.publish('learn.userDataCleared');
    }
    
    /**
     * Carga datos desde el almacenamiento local
     * @private
     */
    _loadFromCache() {
        try {
            // Intentar cargar categorías, rutas y otros datos generales
            const cachedCategories = StorageManager.get('learning.categories');
            if (cachedCategories) {
                this.state.categories = cachedCategories;
            }
            
            const cachedPaths = StorageManager.get('learning.paths');
            if (cachedPaths) {
                this.state.learningPaths = cachedPaths;
            }
            
            // Cargar datos del usuario si está autenticado
            if (this.authManager.isAuthenticated()) {
                const cachedProgress = StorageManager.get('learning.progress');
                if (cachedProgress) {
                    this.state.userProgress = cachedProgress;
                }
                
                const cachedFavorites = StorageManager.get('learning.favorites');
                if (cachedFavorites) {
                    this.state.favoriteContent = new Set(cachedFavorites);
                }
                
                const cachedNotes = StorageManager.get('learning.notes');
                if (cachedNotes) {
                    this.state.notes = new Map(Object.entries(cachedNotes));
                }
            }
        } catch (error) {
            console.error('Error al cargar datos del caché:', error);
        }
    }
    
    /**
     * Obtiene categorías de contenido educativo
     * @private
     */
    async _fetchCategories() {
        try {
            const url = `${this.options.apiEndpoint}/categories`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            this.state.categories = data;
            
            // Guardar en caché local
            StorageManager.set('learning.categories', data);
            
            return data;
        } catch (error) {
            console.error('Error al obtener categorías:', error);
            
            // Si hay categorías en caché, usarlas como fallback
            if (this.state.categories) {
                return this.state.categories;
            }
            
            throw error;
        }
    }
    
    /**
     * Obtiene rutas de aprendizaje
     * @private
     */
    async _fetchLearningPaths() {
        try {
            const url = `${this.options.apiEndpoint}/paths`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            this.state.learningPaths = data;
            
            // Guardar en caché local
            StorageManager.set('learning.paths', data);
            
            return data;
        } catch (error) {
            console.error('Error al obtener rutas de aprendizaje:', error);
            
            // Si hay rutas en caché, usarlas como fallback
            if (this.state.learningPaths) {
                return this.state.learningPaths;
            }
            
            throw error;
        }
    }
    
    /**
     * Carga el progreso del usuario desde el servidor
     * @private
     */
    async _loadUserProgress() {
        if (!this.authManager.isAuthenticated()) {
            return null;
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            
            const url = `${this.options.apiEndpoint}/progress?userId=${userId}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const progressData = await response.json();
            
            // Convertir array a objeto para fácil acceso por contentId
            const progressMap = {};
            progressData.forEach(item => {
                progressMap[item.contentId] = item;
            });
            
            this.state.userProgress = progressMap;
            
            // Guardar en almacenamiento local
            StorageManager.set('learning.progress', progressMap);
            
            return progressMap;
        } catch (error) {
            console.error('Error al cargar progreso del usuario:', error);
            
            // Retornar el progreso almacenado localmente como fallback
            return this.state.userProgress;
        }
    }
    
    /**
     * Genera recomendaciones personalizadas para el usuario
     * @private
     */
    async _generateRecommendations() {
        if (!this.authManager.isAuthenticated()) {
            return this._getGenericRecommendations();
        }
        
        try {
            const userId = this.authManager.getCurrentUser().id;
            
            const url = `${this.options.apiEndpoint}/recommendations?userId=${userId}`;
            const response = await fetch(url, {
                headers: {
                    'Authorization': `Bearer ${this.authManager.getToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            const data = await response.json();
            this.state.recommendations = data;
            
            return data;
        } catch (error) {
            console.error('Error al generar recomendaciones:', error);
            
            // Generar recomendaciones básicas basadas en datos locales
            return this._generateLocalRecommendations();
        }
    }
    
    /**
     * Genera recomendaciones genéricas para usuarios no autenticados
     * @returns {Array} Recomendaciones básicas
     * @private
     */
    async _getGenericRecommendations() {
        try {
            const url = `${this.options.apiEndpoint}/recommendations/generic`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error al obtener recomendaciones genéricas:', error);
            
            // Retornar lista vacía en caso de error
            return [];
        }
    }
    
    /**
     * Genera recomendaciones locales basadas en datos guardados
     * @returns {Array} Recomendaciones generadas localmente
     * @private
     */
    _generateLocalRecommendations() {
        // Esta es una implementación básica para cuando la API no está disponible
        const recommendations = [];
        
        // Implementación simplificada usando datos en caché
        // En una implementación real, se usarían algoritmos más sofisticados
        
        return recommendations;
    }
    
    /**
     * Genera estadísticas basadas en datos locales
     * @returns {Object} Estadísticas básicas
     * @private
     */
    _generateLocalStatistics() {
        const stats = {
            completedContent: 0,
            inProgressContent: 0,
            totalTimeSpent: 0,
            favoriteTopics: [],
            achievements: []
        };
        
        // Calcular estadísticas básicas desde el progreso local
        if (this.state.userProgress) {
            Object.values(this.state.userProgress).forEach(item => {
                if (item.completed) {
                    stats.completedContent++;
                } else {
                    stats.inProgressContent++;
                }
                
                if (item.timeSpent) {
                    stats.totalTimeSpent += item.timeSpent;
                }
            });
        }
        
        return stats;
    }
    
    /**
     * Obtiene un elemento de la caché
     * @param {string} key - Clave del elemento
     * @returns {any} Elemento o null si no existe o ha expirado
     * @private
     */
    _getCachedItem(key) {
        if (this.state.contentCache.has(key)) {
            const cachedItem = this.state.contentCache.get(key);
            
            // Verificar si ha expirado
            if (cachedItem.timestamp + this.options.cacheTime > Date.now()) {
                return cachedItem.data;
            } else {
                // Eliminar si ha expirado
                this.state.contentCache.delete(key);
            }
        }
        
        return null;
    }
    
    /**
     * Guarda un elemento en la caché
     * @param {string} key - Clave del elemento
     * @param {any} data - Datos a guardar
     * @private
     */
    _setCachedItem(key, data) {
        this.state.contentCache.set(key, {
            data,
            timestamp: Date.now()
        });
        
        // Limpiar caché si supera un tamaño determinado
        if (this.state.contentCache.size > 100) {
            this._cleanCache();
        }
    }
    
    /**
     * Elimina un elemento de la caché
     * @param {string} key - Clave del elemento
     * @private
     */
    _removeCachedItem(key) {
        this.state.contentCache.delete(key);
    }
    
    /**
     * Limpia elementos antiguos de la caché
     * @private
     */
    _cleanCache() {
        const now = Date.now();
        
        // Eliminar entradas antiguas
        for (const [key, value] of this.state.contentCache.entries()) {
            if (value.timestamp + this.options.cacheTime < now) {
                this.state.contentCache.delete(key);
            }
        }
    }
}

// Exportar una instancia predeterminada para uso rápido
export const learnService = new LearnService();
