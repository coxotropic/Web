/**
 * social-features.js
 * Servicio para gestionar las características sociales del portal de criptomonedas
 */

import { EventBus } from '../utils/event-bus.js';
import { StorageManager } from '../utils/storage-manager.js';
import { NotificationService } from '../user/notification-service.js';

/**
 * Clase principal para gestionar todas las funcionalidades sociales de la plataforma
 */
export class SocialFeatures {
    constructor(options = {}) {
        // Opciones por defecto
        this.options = {
            apiEndpoint: '/api/social',
            refreshInterval: 60000, // 1 minuto
            feedItemsPerPage: 20,
            searchResultsPerPage: 15,
            maxMentionsPerPost: 10,
            reputationLevels: {
                novice: 0,
                beginner: 50,
                intermediate: 200,
                advanced: 500,
                expert: 1000,
                master: 2500,
                guru: 5000
            },
            ...options
        };

        // Estado interno
        this.state = {
            initialized: false,
            currentUser: null,
            userFollowing: [],
            userFollowers: [],
            activeFeed: 'global',
            feedCache: {},
            reputationScore: 0,
            userLevel: 'novice',
            notificationPreferences: {
                newFollower: true,
                mentionedByUser: true,
                commentReply: true,
                contentLiked: true,
                contentShared: true,
                analysisEngagement: true
            },
            privacySettings: {
                profileVisibility: 'public',      // public, followers, private
                activityVisibility: 'followers',  // public, followers, private
                portfolioVisibility: 'private',   // public, followers, private
                allowMentions: 'all',             // all, followers, none
                searchable: true
            }
        };

        // Referencias a servicios
        this.notificationService = new NotificationService();
        this.feedUpdateInterval = null;
    }

    /**
     * Inicializa el servicio de características sociales
     * @returns {Promise<boolean>} Éxito de la inicialización
     */
    async init() {
        if (this.state.initialized) {
            return true;
        }

        try {
            console.log('Inicializando SocialFeatures...');

            // Cargar datos del usuario autenticado
            const currentUser = await this._getCurrentUser();
            
            if (!currentUser) {
                console.log('No hay usuario autenticado, inicialización limitada de SocialFeatures');
                this.state.initialized = true;
                return false;
            }

            this.state.currentUser = currentUser;

            // Cargar datos sociales del usuario
            await Promise.all([
                this._loadUserFollowing(),
                this._loadUserFollowers(),
                this._loadReputationScore(),
                this._loadUserPreferences()
            ]);

            // Calcular nivel de usuario basado en reputación
            this._calculateUserLevel();

            // Configurar intervalo de actualización del feed
            this._setupFeedUpdates();

            // Suscribirse a eventos relevantes
            this._setupEventListeners();

            this.state.initialized = true;
            console.log('SocialFeatures inicializado correctamente');
            
            // Notificar que el sistema social está listo
            EventBus.publish('social.ready', {
                userId: this.state.currentUser.id,
                level: this.state.userLevel,
                followersCount: this.state.userFollowers.length,
                followingCount: this.state.userFollowing.length
            });

            return true;
        } catch (error) {
            console.error('Error al inicializar SocialFeatures:', error);
            return false;
        }
    }

    /**
     * Seguir a un usuario
     * @param {string} userId - ID del usuario a seguir
     * @returns {Promise<boolean>} Éxito de la operación
     */
    async followUser(userId) {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            if (this.state.userFollowing.includes(userId)) {
                console.log(`Ya estás siguiendo al usuario ${userId}`);
                return true;
            }

            const response = await fetch(`${this.options.apiEndpoint}/follow`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    targetUserId: userId,
                    action: 'follow'
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al seguir al usuario: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                // Actualizar estado local
                this.state.userFollowing.push(userId);
                
                // Actualizar caché
                StorageManager.set(`user.${this.state.currentUser.id}.following`, this.state.userFollowing);
                
                // Notificar evento
                EventBus.publish('social.follow', {
                    follower: this.state.currentUser.id,
                    following: userId,
                    timestamp: new Date().toISOString()
                });

                console.log(`Ahora sigues al usuario ${userId}`);
                return true;
            } else {
                throw new Error(result.message || 'Error desconocido al seguir al usuario');
            }
        } catch (error) {
            console.error('Error en followUser:', error);
            return false;
        }
    }

    /**
     * Dejar de seguir a un usuario
     * @param {string} userId - ID del usuario a dejar de seguir
     * @returns {Promise<boolean>} Éxito de la operación
     */
    async unfollowUser(userId) {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            if (!this.state.userFollowing.includes(userId)) {
                console.log(`No estás siguiendo al usuario ${userId}`);
                return true;
            }

            const response = await fetch(`${this.options.apiEndpoint}/follow`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    targetUserId: userId,
                    action: 'unfollow'
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al dejar de seguir al usuario: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                // Actualizar estado local
                this.state.userFollowing = this.state.userFollowing.filter(id => id !== userId);
                
                // Actualizar caché
                StorageManager.set(`user.${this.state.currentUser.id}.following`, this.state.userFollowing);
                
                // Notificar evento
                EventBus.publish('social.unfollow', {
                    unfollower: this.state.currentUser.id,
                    unfollowed: userId,
                    timestamp: new Date().toISOString()
                });

                console.log(`Ya no sigues al usuario ${userId}`);
                return true;
            } else {
                throw new Error(result.message || 'Error desconocido al dejar de seguir al usuario');
            }
        } catch (error) {
            console.error('Error en unfollowUser:', error);
            return false;
        }
    }

    /**
     * Cargar feed de actividad social
     * @param {string} feedType - Tipo de feed ('global', 'following', 'popular')
     * @param {number} page - Número de página
     * @param {Object} filters - Filtros adicionales
     * @returns {Promise<Array>} Array de elementos del feed
     */
    async getFeed(feedType = 'global', page = 1, filters = {}) {
        try {
            if (!this.state.initialized) {
                throw new Error('SocialFeatures no está inicializado');
            }

            const cacheKey = `feed_${feedType}_${page}_${JSON.stringify(filters)}`;
            
            // Intentar obtener desde caché si es reciente (menos de 5 minutos)
            const cachedFeed = this.state.feedCache[cacheKey];
            const now = Date.now();
            if (cachedFeed && (now - cachedFeed.timestamp < 300000)) {
                console.log(`Usando feed en caché para ${feedType}, página ${page}`);
                return cachedFeed.data;
            }

            // Construir parámetros de consulta
            const queryParams = new URLSearchParams({
                type: feedType,
                page: page,
                limit: this.options.feedItemsPerPage,
                ...filters
            });

            // Realizar petición al servidor
            const response = await fetch(`${this.options.apiEndpoint}/feed?${queryParams}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al obtener feed: ${response.statusText}`);
            }

            const feedData = await response.json();

            // Guardar en caché
            this.state.feedCache[cacheKey] = {
                data: feedData.items,
                timestamp: now,
                totalPages: feedData.totalPages,
                totalItems: feedData.totalItems
            };

            // Actualizar estado
            this.state.activeFeed = feedType;

            return feedData.items;
        } catch (error) {
            console.error('Error en getFeed:', error);
            return [];
        }
    }

    /**
     * Crear o actualizar una publicación
     * @param {Object} postData - Datos de la publicación
     * @returns {Promise<Object|null>} Detalles de la publicación creada o actualizada
     */
    async savePost(postData) {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            // Validar datos de entrada
            if (!postData.content || postData.content.trim() === '') {
                throw new Error('El contenido de la publicación no puede estar vacío');
            }

            // Procesar menciones si existen
            const mentions = this._extractMentions(postData.content);
            if (mentions.length > this.options.maxMentionsPerPost) {
                throw new Error(`Demasiadas menciones. Máximo permitido: ${this.options.maxMentionsPerPost}`);
            }

            // Preparar datos para enviar
            const payload = {
                ...postData,
                mentions: mentions,
                timestamp: new Date().toISOString(),
                userId: this.state.currentUser.id
            };

            // Determinar si es creación o actualización
            const method = postData.id ? 'PUT' : 'POST';
            const endpoint = postData.id 
                ? `${this.options.apiEndpoint}/posts/${postData.id}` 
                : `${this.options.apiEndpoint}/posts`;

            const response = await fetch(endpoint, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al guardar publicación: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                // Actualizar caché de feed si es necesario
                this._invalidateFeedCache();
                
                // Enviar notificaciones de menciones
                if (mentions.length > 0) {
                    this._sendMentionNotifications(mentions, result.post);
                }
                
                // Notificar evento
                const eventType = postData.id ? 'social.post.update' : 'social.post.create';
                EventBus.publish(eventType, {
                    postId: result.post.id,
                    userId: this.state.currentUser.id,
                    timestamp: result.post.timestamp
                });

                return result.post;
            } else {
                throw new Error(result.message || 'Error desconocido al guardar publicación');
            }
        } catch (error) {
            console.error('Error en savePost:', error);
            return null;
        }
    }

    /**
     * Eliminar una publicación
     * @param {string} postId - ID de la publicación a eliminar
     * @returns {Promise<boolean>} Éxito de la operación
     */
    async deletePost(postId) {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            const response = await fetch(`${this.options.apiEndpoint}/posts/${postId}`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al eliminar publicación: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                // Actualizar caché de feed
                this._invalidateFeedCache();
                
                // Notificar evento
                EventBus.publish('social.post.delete', {
                    postId: postId,
                    userId: this.state.currentUser.id,
                    timestamp: new Date().toISOString()
                });

                return true;
            } else {
                throw new Error(result.message || 'Error desconocido al eliminar publicación');
            }
        } catch (error) {
            console.error('Error en deletePost:', error);
            return false;
        }
    }

    /**
     * Reaccionar a una publicación (like, dislike, etc.)
     * @param {string} postId - ID de la publicación
     * @param {string} reactionType - Tipo de reacción ('like', 'dislike', etc.)
     * @returns {Promise<boolean>} Éxito de la operación
     */
    async reactToPost(postId, reactionType = 'like') {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            const response = await fetch(`${this.options.apiEndpoint}/reactions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    postId: postId,
                    type: reactionType,
                    timestamp: new Date().toISOString()
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al reaccionar a la publicación: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                // Notificar evento
                EventBus.publish('social.reaction', {
                    postId: postId,
                    userId: this.state.currentUser.id,
                    type: reactionType,
                    timestamp: new Date().toISOString()
                });

                return true;
            } else {
                throw new Error(result.message || 'Error desconocido al reaccionar a la publicación');
            }
        } catch (error) {
            console.error('Error en reactToPost:', error);
            return false;
        }
    }

    /**
     * Reportar contenido inapropiado
     * @param {Object} reportData - Datos del reporte
     * @returns {Promise<boolean>} Éxito de la operación
     */
    async reportContent(reportData) {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            // Validar datos del reporte
            if (!reportData.contentId || !reportData.reason) {
                throw new Error('Faltan datos obligatorios para el reporte');
            }

            const payload = {
                ...reportData,
                reporterId: this.state.currentUser.id,
                timestamp: new Date().toISOString()
            };

            const response = await fetch(`${this.options.apiEndpoint}/reports`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al reportar contenido: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                console.log('Contenido reportado correctamente');
                return true;
            } else {
                throw new Error(result.message || 'Error desconocido al reportar contenido');
            }
        } catch (error) {
            console.error('Error en reportContent:', error);
            return false;
        }
    }

    /**
     * Compartir una predicción o análisis
     * @param {Object} analysisData - Datos del análisis
     * @returns {Promise<Object|null>} Detalles del análisis compartido
     */
    async shareAnalysis(analysisData) {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            // Validar datos del análisis
            if (!analysisData.content || !analysisData.coin) {
                throw new Error('Faltan datos obligatorios para el análisis');
            }

            const payload = {
                ...analysisData,
                userId: this.state.currentUser.id,
                timestamp: new Date().toISOString(),
                type: 'analysis'
            };

            const response = await fetch(`${this.options.apiEndpoint}/content`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al compartir análisis: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                // Actualizar caché de feed
                this._invalidateFeedCache();
                
                // Notificar evento
                EventBus.publish('social.analysis.share', {
                    analysisId: result.analysis.id,
                    userId: this.state.currentUser.id,
                    coin: analysisData.coin,
                    timestamp: result.analysis.timestamp
                });

                return result.analysis;
            } else {
                throw new Error(result.message || 'Error desconocido al compartir análisis');
            }
        } catch (error) {
            console.error('Error en shareAnalysis:', error);
            return null;
        }
    }

    /**
     * Buscar usuarios o contenido
     * @param {string} query - Texto de búsqueda
     * @param {string} type - Tipo de búsqueda ('users', 'posts', 'analyses', 'all')
     * @param {number} page - Número de página
     * @returns {Promise<Object>} Resultados de la búsqueda
     */
    async search(query, type = 'all', page = 1) {
        try {
            if (!this.state.initialized) {
                throw new Error('SocialFeatures no está inicializado');
            }

            // Validar parámetros
            if (!query || query.trim() === '') {
                throw new Error('El texto de búsqueda no puede estar vacío');
            }

            // Construir parámetros de consulta
            const queryParams = new URLSearchParams({
                q: query,
                type: type,
                page: page,
                limit: this.options.searchResultsPerPage
            });

            const response = await fetch(`${this.options.apiEndpoint}/search?${queryParams}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error en la búsqueda: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error en search:', error);
            return {
                items: [],
                totalItems: 0,
                totalPages: 0
            };
        }
    }

    /**
     * Obtener estadísticas de interacción social de un usuario
     * @param {string} userId - ID del usuario (opcional, por defecto el usuario actual)
     * @returns {Promise<Object>} Estadísticas sociales
     */
    async getUserStats(userId = null) {
        try {
            if (!this.state.initialized) {
                throw new Error('SocialFeatures no está inicializado');
            }

            // Si no se proporciona ID, usar el del usuario actual
            const targetUserId = userId || (this.state.currentUser ? this.state.currentUser.id : null);
            
            if (!targetUserId) {
                throw new Error('No se proporcionó ID de usuario y no hay usuario autenticado');
            }

            const response = await fetch(`${this.options.apiEndpoint}/users/${targetUserId}/stats`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al obtener estadísticas: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error en getUserStats:', error);
            return {
                postsCount: 0,
                followersCount: 0,
                followingCount: 0,
                likesReceived: 0,
                commentsReceived: 0,
                reputationScore: 0,
                level: 'novice'
            };
        }
    }

    /**
     * Actualizar configuración de privacidad
     * @param {Object} settings - Nuevas configuraciones de privacidad
     * @returns {Promise<boolean>} Éxito de la operación
     */
    async updatePrivacySettings(settings) {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            // Validar configuraciones
            const validSettings = {
                ...this.state.privacySettings
            };

            // Actualizar solo configuraciones válidas
            if (settings.profileVisibility && ['public', 'followers', 'private'].includes(settings.profileVisibility)) {
                validSettings.profileVisibility = settings.profileVisibility;
            }
            
            if (settings.activityVisibility && ['public', 'followers', 'private'].includes(settings.activityVisibility)) {
                validSettings.activityVisibility = settings.activityVisibility;
            }
            
            if (settings.portfolioVisibility && ['public', 'followers', 'private'].includes(settings.portfolioVisibility)) {
                validSettings.portfolioVisibility = settings.portfolioVisibility;
            }
            
            if (settings.allowMentions && ['all', 'followers', 'none'].includes(settings.allowMentions)) {
                validSettings.allowMentions = settings.allowMentions;
            }
            
            if (typeof settings.searchable === 'boolean') {
                validSettings.searchable = settings.searchable;
            }

            // Enviar al servidor
            const response = await fetch(`${this.options.apiEndpoint}/users/${this.state.currentUser.id}/privacy`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(validSettings),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al actualizar configuración de privacidad: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                // Actualizar estado local
                this.state.privacySettings = validSettings;
                
                // Guardar en almacenamiento
                StorageManager.set(`user.${this.state.currentUser.id}.privacy`, validSettings);
                
                console.log('Configuración de privacidad actualizada correctamente');
                return true;
            } else {
                throw new Error(result.message || 'Error desconocido al actualizar configuración de privacidad');
            }
        } catch (error) {
            console.error('Error en updatePrivacySettings:', error);
            return false;
        }
    }

    /**
     * Actualizar preferencias de notificaciones
     * @param {Object} preferences - Nuevas preferencias de notificaciones
     * @returns {Promise<boolean>} Éxito de la operación
     */
    async updateNotificationPreferences(preferences) {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            // Validar preferencias
            const validPreferences = {
                ...this.state.notificationPreferences
            };

            // Actualizar solo preferencias válidas
            for (const [key, value] of Object.entries(preferences)) {
                if (key in validPreferences && typeof value === 'boolean') {
                    validPreferences[key] = value;
                }
            }

            // Enviar al servidor
            const response = await fetch(`${this.options.apiEndpoint}/users/${this.state.currentUser.id}/notifications/preferences`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(validPreferences),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al actualizar preferencias de notificaciones: ${response.statusText}`);
            }

            const result = await response.json();

            if (result.success) {
                // Actualizar estado local
                this.state.notificationPreferences = validPreferences;
                
                // Guardar en almacenamiento
                StorageManager.set(`user.${this.state.currentUser.id}.notifications.preferences`, validPreferences);
                
                console.log('Preferencias de notificaciones actualizadas correctamente');
                return true;
            } else {
                throw new Error(result.message || 'Error desconocido al actualizar preferencias de notificaciones');
            }
        } catch (error) {
            console.error('Error en updateNotificationPreferences:', error);
            return false;
        }
    }

    /**
     * Verificar si el usuario actual sigue a otro usuario
     * @param {string} userId - ID del usuario a verificar
     * @returns {boolean} true si lo sigue, false en caso contrario
     */
    isFollowing(userId) {
        if (!this.state.initialized || !this.state.currentUser) {
            return false;
        }
        
        return this.state.userFollowing.includes(userId);
    }

    /**
     * Obtener lista de usuarios que el usuario actual está siguiendo
     * @param {number} page - Número de página
     * @param {number} limit - Cantidad por página
     * @returns {Promise<Array>} Lista de usuarios seguidos
     */
    async getFollowingList(page = 1, limit = 20) {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            const queryParams = new URLSearchParams({
                page: page,
                limit: limit
            });

            const response = await fetch(`${this.options.apiEndpoint}/users/${this.state.currentUser.id}/following?${queryParams}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al obtener lista de seguidos: ${response.statusText}`);
            }

            const result = await response.json();
            return result.users || [];
        } catch (error) {
            console.error('Error en getFollowingList:', error);
            return [];
        }
    }

    /**
     * Obtener lista de seguidores del usuario actual
     * @param {number} page - Número de página
     * @param {number} limit - Cantidad por página
     * @returns {Promise<Array>} Lista de seguidores
     */
    async getFollowersList(page = 1, limit = 20) {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            const queryParams = new URLSearchParams({
                page: page,
                limit: limit
            });

            const response = await fetch(`${this.options.apiEndpoint}/users/${this.state.currentUser.id}/followers?${queryParams}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al obtener lista de seguidores: ${response.statusText}`);
            }

            const result = await response.json();
            return result.users || [];
        } catch (error) {
            console.error('Error en getFollowersList:', error);
            return [];
        }
    }

    /**
     * Obtener recomendaciones de usuarios para seguir
     * @param {number} limit - Cantidad de recomendaciones
     * @returns {Promise<Array>} Lista de usuarios recomendados
     */
    async getUserRecommendations(limit = 10) {
        try {
            if (!this.state.initialized || !this.state.currentUser) {
                throw new Error('SocialFeatures no está inicializado o no hay usuario autenticado');
            }

            const queryParams = new URLSearchParams({
                limit: limit
            });

            const response = await fetch(`${this.options.apiEndpoint}/recommendations/users?${queryParams}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al obtener recomendaciones: ${response.statusText}`);
            }

            const result = await response.json();
            return result.recommendations || [];
        } catch (error) {
            console.error('Error en getUserRecommendations:', error);
            return [];
        }
    }

    /**
     * Obtener perfil público de un usuario
     * @param {string} userId - ID del usuario
     * @returns {Promise<Object|null>} Perfil del usuario
     */
    async getUserProfile(userId) {
        try {
            if (!this.state.initialized) {
                throw new Error('SocialFeatures no está inicializado');
            }

            const response = await fetch(`${this.options.apiEndpoint}/users/${userId}/profile`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al obtener perfil: ${response.statusText}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error en getUserProfile:', error);
            return null;
        }
    }

    /**
     * Obtener el feed de actividad de un usuario específico
     * @param {string} userId - ID del usuario
     * @param {number} page - Número de página
     * @returns {Promise<Array>} Elementos del feed
     */
    async getUserActivityFeed(userId, page = 1) {
        try {
            if (!this.state.initialized) {
                throw new Error('SocialFeatures no está inicializado');
            }

            const queryParams = new URLSearchParams({
                page: page,
                limit: this.options.feedItemsPerPage
            });

            const response = await fetch(`${this.options.apiEndpoint}/users/${userId}/activity?${queryParams}`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al obtener feed de actividad: ${response.statusText}`);
            }

            const result = await response.json();
            return result.items || [];
        } catch (error) {
            console.error('Error en getUserActivityFeed:', error);
            return [];
        }
    }

    // Métodos privados

    /**
     * Obtiene información del usuario actual
     * @private
     * @returns {Promise<Object|null>} Datos del usuario actual
     */
    async _getCurrentUser() {
        try {
            // Intentar obtener desde caché en primer lugar
            const cachedUser = StorageManager.get('currentUser');
            if (cachedUser) {
                return cachedUser;
            }

            // Si no hay en caché, consultar al servidor
            const response = await fetch(`${this.options.apiEndpoint}/users/me`, {
                credentials: 'include'
            });

            if (response.status === 401) {
                console.log('Usuario no autenticado');
                return null;
            }

            if (!response.ok) {
                throw new Error(`Error al obtener usuario actual: ${response.statusText}`);
            }

            const userData = await response.json();
            
            // Guardar en caché
            StorageManager.set('currentUser', userData, { expires: 3600000 }); // 1 hora
            
            return userData;
        } catch (error) {
            console.error('Error al obtener usuario actual:', error);
            return null;
        }
    }

    /**
     * Carga la lista de usuarios que el usuario actual está siguiendo
     * @private
     */
    async _loadUserFollowing() {
        try {
            // Intentar obtener desde caché
            const cacheKey = `user.${this.state.currentUser.id}.following`;
            const cachedFollowing = StorageManager.get(cacheKey);
            
            if (cachedFollowing) {
                this.state.userFollowing = cachedFollowing;
                return;
            }

            // Si no hay caché, obtener del servidor
            const response = await fetch(`${this.options.apiEndpoint}/users/${this.state.currentUser.id}/following?limit=1000`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al cargar usuarios seguidos: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Extraer solo los IDs
            this.state.userFollowing = result.users.map(user => user.id);
            
            // Guardar en caché
            StorageManager.set(cacheKey, this.state.userFollowing);
        } catch (error) {
            console.error('Error en _loadUserFollowing:', error);
            this.state.userFollowing = [];
        }
    }

    /**
     * Carga la lista de seguidores del usuario actual
     * @private
     */
    async _loadUserFollowers() {
        try {
            // Intentar obtener desde caché
            const cacheKey = `user.${this.state.currentUser.id}.followers`;
            const cachedFollowers = StorageManager.get(cacheKey);
            
            if (cachedFollowers) {
                this.state.userFollowers = cachedFollowers;
                return;
            }

            // Si no hay caché, obtener del servidor
            const response = await fetch(`${this.options.apiEndpoint}/users/${this.state.currentUser.id}/followers?limit=1000`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al cargar seguidores: ${response.statusText}`);
            }

            const result = await response.json();
            
            // Extraer solo los IDs
            this.state.userFollowers = result.users.map(user => user.id);
            
            // Guardar en caché
            StorageManager.set(cacheKey, this.state.userFollowers);
        } catch (error) {
            console.error('Error en _loadUserFollowers:', error);
            this.state.userFollowers = [];
        }
    }

    /**
     * Carga la puntuación de reputación del usuario
     * @private
     */
    async _loadReputationScore() {
        try {
            // Intentar obtener desde caché
            const cacheKey = `user.${this.state.currentUser.id}.reputation`;
            const cachedReputation = StorageManager.get(cacheKey);
            
            if (cachedReputation) {
                this.state.reputationScore = cachedReputation;
                return;
            }

            // Si no hay caché, obtener del servidor
            const response = await fetch(`${this.options.apiEndpoint}/users/${this.state.currentUser.id}/reputation`, {
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Error al cargar reputación: ${response.statusText}`);
            }

            const result = await response.json();
            
            this.state.reputationScore = result.score || 0;
            
            // Guardar en caché
            StorageManager.set(cacheKey, this.state.reputationScore);
        } catch (error) {
            console.error('Error en _loadReputationScore:', error);
            this.state.reputationScore = 0;
        }
    }

    /**
     * Carga las preferencias del usuario
     * @private
     */
    async _loadUserPreferences() {
        try {
            // Cargar configuración de privacidad
            const privacyCacheKey = `user.${this.state.currentUser.id}.privacy`;
            const cachedPrivacy = StorageManager.get(privacyCacheKey);
            
            if (cachedPrivacy) {
                this.state.privacySettings = cachedPrivacy;
            } else {
                const privacyResponse = await fetch(`${this.options.apiEndpoint}/users/${this.state.currentUser.id}/privacy`, {
                    credentials: 'include'
                });

                if (privacyResponse.ok) {
                    const privacyResult = await privacyResponse.json();
                    this.state.privacySettings = privacyResult.settings;
                    StorageManager.set(privacyCacheKey, this.state.privacySettings);
                }
            }

            // Cargar preferencias de notificaciones
            const notifCacheKey = `user.${this.state.currentUser.id}.notifications.preferences`;
            const cachedNotifPrefs = StorageManager.get(notifCacheKey);
            
            if (cachedNotifPrefs) {
                this.state.notificationPreferences = cachedNotifPrefs;
            } else {
                const notifResponse = await fetch(`${this.options.apiEndpoint}/users/${this.state.currentUser.id}/notifications/preferences`, {
                    credentials: 'include'
                });

                if (notifResponse.ok) {
                    const notifResult = await notifResponse.json();
                    this.state.notificationPreferences = notifResult.preferences;
                    StorageManager.set(notifCacheKey, this.state.notificationPreferences);
                }
            }
        } catch (error) {
            console.error('Error en _loadUserPreferences:', error);
            // Mantener valores por defecto
        }
    }

    /**
     * Calcula el nivel del usuario basado en su puntuación de reputación
     * @private
     */
    _calculateUserLevel() {
        const score = this.state.reputationScore;
        const levels = this.options.reputationLevels;
        
        let level = 'novice';
        
        // Determinar nivel basado en puntuación
        for (const [levelName, threshold] of Object.entries(levels)) {
            if (score >= threshold) {
                level = levelName;
            } else {
                break;
            }
        }
        
        this.state.userLevel = level;
    }

    /**
     * Configura la actualización periódica del feed
     * @private
     */
    _setupFeedUpdates() {
        // Limpiar intervalo existente si lo hay
        if (this.feedUpdateInterval) {
            clearInterval(this.feedUpdateInterval);
        }
        
        // Establecer nuevo intervalo
        this.feedUpdateInterval = setInterval(() => {
            // Si hay un feed activo, actualizarlo
            if (this.state.activeFeed) {
                this._refreshActiveFeed();
            }
        }, this.options.refreshInterval);
    }

    /**
     * Refresca el feed activo actual
     * @private
     */
    async _refreshActiveFeed() {
        if (!this.state.activeFeed) return;
        
        try {
            // Invalidar caché solo para la primera página del feed activo
            const cacheKeys = Object.keys(this.state.feedCache).filter(key => 
                key.startsWith(`feed_${this.state.activeFeed}_1_`)
            );
            
            for (const key of cacheKeys) {
                delete this.state.feedCache[key];
            }
            
            // Notificar que el feed debe actualizarse
            EventBus.publish('social.feed.refresh', {
                feedType: this.state.activeFeed
            });
        } catch (error) {
            console.error('Error en _refreshActiveFeed:', error);
        }
    }

    /**
     * Invalida toda la caché de feeds
     * @private
     */
    _invalidateFeedCache() {
        this.state.feedCache = {};
    }

    /**
     * Extrae menciones de un texto
     * @private
     * @param {string} text - Texto donde buscar menciones
     * @returns {Array<string>} Array de IDs de usuarios mencionados
     */
    _extractMentions(text) {
        const mentionRegex = /@(\w+)/g;
        const mentions = [];
        let match;
        
        while ((match = mentionRegex.exec(text)) !== null) {
            mentions.push(match[1]);
        }
        
        return mentions;
    }

    /**
     * Envía notificaciones a usuarios mencionados
     * @private
     * @param {Array<string>} mentions - Usernames mencionados
     * @param {Object} post - Datos del post
     */
    async _sendMentionNotifications(mentions, post) {
        try {
            if (!mentions.length) return;
            
            // Obtener IDs de usuarios desde usernames
            const response = await fetch(`${this.options.apiEndpoint}/users/by-username`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    usernames: mentions
                }),
                credentials: 'include'
            });
            
            if (!response.ok) return;
            
            const result = await response.json();
            const usersMap = result.users || {};
            
            // Enviar notificaciones a cada usuario
            for (const [username, userId] of Object.entries(usersMap)) {
                // Verificar configuración de privacidad del usuario
                const userPrivacy = await this._getUserMentionPrivacy(userId);
                
                let canNotify = false;
                
                switch (userPrivacy) {
                    case 'all':
                        canNotify = true;
                        break;
                    case 'followers':
                        canNotify = await this._checkIfUserFollows(userId, this.state.currentUser.id);
                        break;
                    case 'none':
                        canNotify = false;
                        break;
                    default:
                        canNotify = true;
                }
                
                if (canNotify) {
                    this.notificationService.notify({
                        userId: userId,
                        type: 'mention',
                        title: 'Te han mencionado',
                        message: `${this.state.currentUser.username} te ha mencionado en una publicación`,
                        data: {
                            postId: post.id,
                            mentionedBy: this.state.currentUser.id
                        },
                        link: `/post/${post.id}`
                    });
                }
            }
        } catch (error) {
            console.error('Error en _sendMentionNotifications:', error);
        }
    }

    /**
     * Obtiene la configuración de privacidad de menciones de un usuario
     * @private
     * @param {string} userId - ID del usuario
     * @returns {Promise<string>} Configuración de menciones ('all', 'followers', 'none')
     */
    async _getUserMentionPrivacy(userId) {
        try {
            const response = await fetch(`${this.options.apiEndpoint}/users/${userId}/privacy/mentions`, {
                credentials: 'include'
            });
            
            if (!response.ok) return 'all'; // Valor por defecto
            
            const result = await response.json();
            return result.setting || 'all';
        } catch (error) {
            console.error('Error en _getUserMentionPrivacy:', error);
            return 'all'; // Valor por defecto en caso de error
        }
    }

    /**
     * Verifica si un usuario sigue a otro
     * @private
     * @param {string} followerId - ID del seguidor
     * @param {string} followedId - ID del seguido
     * @returns {Promise<boolean>} true si lo sigue, false en caso contrario
     */
    async _checkIfUserFollows(followerId, followedId) {
        try {
            const response = await fetch(`${this.options.apiEndpoint}/users/${followerId}/following/${followedId}`, {
                credentials: 'include'
            });
            
            if (!response.ok) return false;
            
            const result = await response.json();
            return result.following === true;
        } catch (error) {
            console.error('Error en _checkIfUserFollows:', error);
            return false;
        }
    }

    /**
     * Configura los escuchadores de eventos
     * @private
     */
    _setupEventListeners() {
        // Escuchar cambios de autenticación
        EventBus.subscribe('auth.login', this._handleUserLogin.bind(this));
        EventBus.subscribe('auth.logout', this._handleUserLogout.bind(this));
        
        // Escuchar cambios en datos de usuario
        EventBus.subscribe('user.update', this._handleUserUpdate.bind(this));
        
        // Escuchar eventos de reputación
        EventBus.subscribe('social.reputation.update', this._handleReputationUpdate.bind(this));
    }

    /**
     * Maneja el evento de inicio de sesión
     * @private
     * @param {Object} data - Datos del evento
     */
    async _handleUserLogin(data) {
        console.log('Usuario ha iniciado sesión, reinicializando SocialFeatures');
        
        // Limpiar estado actual
        this.state.initialized = false;
        this.state.currentUser = null;
        
        // Reinicializar
        await this.init();
    }

    /**
     * Maneja el evento de cierre de sesión
     * @private
     * @param {Object} data - Datos del evento
     */
    _handleUserLogout(data) {
        console.log('Usuario ha cerrado sesión, limpiando SocialFeatures');
        
        // Detener actualizaciones
        if (this.feedUpdateInterval) {
            clearInterval(this.feedUpdateInterval);
            this.feedUpdateInterval = null;
        }
        
        // Limpiar estado
        this.state.initialized = false;
        this.state.currentUser = null;
        this.state.userFollowing = [];
        this.state.userFollowers = [];
        this.state.activeFeed = 'global';
        this.state.feedCache = {};
        this.state.reputationScore = 0;
        this.state.userLevel = 'novice';
    }

    /**
     * Maneja el evento de actualización de datos de usuario
     * @private
     * @param {Object} data - Datos del evento
     */
    async _handleUserUpdate(data) {
        if (!this.state.initialized || !this.state.currentUser) return;
        
        if (data.userId === this.state.currentUser.id) {
            console.log('Datos de usuario actualizados, actualizando SocialFeatures');
            
            // Actualizar caché de usuario
            StorageManager.remove('currentUser');
            
            // Recargar datos del usuario
            const userData = await this._getCurrentUser();
            if (userData) {
                this.state.currentUser = userData;
            }
        }
    }

    /**
     * Maneja el evento de actualización de reputación
     * @private
     * @param {Object} data - Datos del evento
     */
    async _handleReputationUpdate(data) {
        if (!this.state.initialized || !this.state.currentUser) return;
        
        if (data.userId === this.state.currentUser.id) {
            console.log('Reputación actualizada, recalculando nivel');
            
            // Actualizar puntuación
            this.state.reputationScore = data.newScore;
            
            // Recalcular nivel
            const previousLevel = this.state.userLevel;
            this._calculateUserLevel();
            
            // Si cambió el nivel, notificar
            if (previousLevel !== this.state.userLevel) {
                console.log(`Usuario ha subido de nivel: ${previousLevel} -> ${this.state.userLevel}`);
                
                EventBus.publish('social.level.up', {
                    userId: this.state.currentUser.id,
                    previousLevel: previousLevel,
                    newLevel: this.state.userLevel,
                    timestamp: new Date().toISOString()
                });
                
                // Notificar al usuario
                this.notificationService.notify({
                    userId: this.state.currentUser.id,
                    type: 'level_up',
                    title: '¡Has subido de nivel!',
                    message: `Felicidades, has alcanzado el nivel ${this.state.userLevel}`,
                    data: {
                        previousLevel: previousLevel,
                        newLevel: this.state.userLevel
                    },
                    link: '/perfil'
                });
            }
            
            // Actualizar caché
            StorageManager.set(`user.${this.state.currentUser.id}.reputation`, this.state.reputationScore);
        }
    }
}

// Exportar una instancia predeterminada para uso rápido
export const socialFeatures = new SocialFeatures();
