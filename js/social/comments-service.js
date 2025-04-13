/**
 * comments-service.js
 * Servicio para la gestión de comentarios en el portal de criptomonedas
 * 
 * Este servicio permite la gestión de comentarios en diferentes secciones de la aplicación,
 * incluyendo creación, edición, eliminación, votación, y filtrado de comentarios.
 * 
 * @author Coxotropic
 * @version 1.0.0
 */

// Importamos las dependencias necesarias
import { AuthManager } from '../auth/auth.js';
import { NotificationService } from '../user/notification-service.js';
import { StorageManager } from '../utils/storage-manager.js';
import { EventBus } from '../utils/event-bus.js';

/**
 * Clase principal para la gestión de comentarios
 */
export class CommentsService {
    /**
     * Constructor de la clase
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        // Configuración por defecto
        this.options = {
            apiEndpoint: '/api/comments',
            commentsPerPage: 10,
            maxCommentLength: 1000,
            maxReplyDepth: 3,
            enableVoting: true,
            enableReplies: true,
            enableMentions: true,
            enableFormatting: true,
            spamDetection: true,
            inappropriateContentFilter: true,
            notifyOnReplies: true,
            notifyOnMentions: true,
            ...options
        };

        // Servicios necesarios
        this.authManager = new AuthManager();
        this.notificationService = new NotificationService();
        
        // Caché de comentarios por sección
        this.commentsCache = {};
        
        // Estado del servicio
        this.isInitialized = false;
        
        // Lista de palabras inapropiadas para filtrado
        this.inappropriateWords = ['spam', 'scam', 'estafa', /* más palabras */];
        
        // Patrones para detección de spam
        this.spamPatterns = [
            /\b(ganar dinero|earn money).{0,30}(link|enlace|http)/i,
            /\b(investment).{0,20}(opportunity|garantizado|guaranteed)/i,
            /* más patrones */
        ];
        
        // Inicializar listeners de eventos
        this._setupEventListeners();
    }
    
    /**
     * Inicializa el servicio de comentarios
     * @returns {Promise} Promesa que se resuelve cuando el servicio está inicializado
     */
    async init() {
        if (this.isInitialized) {
            return Promise.resolve();
        }
        
        try {
            // Verificar si el usuario está autenticado
            const isAuthenticated = this.authManager.isAuthenticated();
            
            // Cargar configuración guardada si existe
            const savedConfig = StorageManager.get('comments.config');
            if (savedConfig) {
                this.options = { ...this.options, ...savedConfig };
            }
            
            // Registrar evento de inicialización
            EventBus.publish('comments.initialized', { 
                isAuthenticated,
                config: this.options 
            });
            
            this.isInitialized = true;
            return Promise.resolve();
            
        } catch (error) {
            console.error('Error initializing CommentsService:', error);
            return Promise.reject(error);
        }
    }
    
    /**
     * Configura los listeners de eventos
     * @private
     */
    _setupEventListeners() {
        // Escuchar eventos de autenticación
        EventBus.subscribe('auth.login', (userData) => {
            this._refreshUserComments(userData.userId);
        });
        
        EventBus.subscribe('auth.logout', () => {
            // Limpiar caché al cerrar sesión
            this.commentsCache = {};
        });
    }
    
    /**
     * Carga los comentarios de una sección específica
     * @param {string} sectionId - Identificador de la sección (ej: 'news-123', 'crypto-bitcoin')
     * @param {Object} options - Opciones de carga (página, orden, filtros)
     * @returns {Promise} Promesa que resuelve con los comentarios cargados
     */
    async loadComments(sectionId, options = {}) {
        try {
            const requestOptions = {
                page: options.page || 1,
                limit: options.limit || this.options.commentsPerPage,
                sort: options.sort || 'newest',
                filter: options.filter || '',
                authorId: options.authorId || ''
            };
            
            // Verificar si tenemos comentarios en caché
            const cacheKey = this._generateCacheKey(sectionId, requestOptions);
            if (this.commentsCache[cacheKey]) {
                return this.commentsCache[cacheKey];
            }
            
            // Si no hay caché, cargar desde API
            const endpoint = `${this.options.apiEndpoint}/${sectionId}`;
            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authManager.getAuthToken()
                },
                params: requestOptions
            });
            
            if (!response.ok) {
                throw new Error(`Error cargando comentarios: ${response.status}`);
            }
            
            const commentsData = await response.json();
            
            // Procesar y organizar comentarios (estructura de árbol para respuestas)
            const processedComments = this._processComments(commentsData.comments);
            
            // Guardar en caché
            this.commentsCache[cacheKey] = {
                comments: processedComments,
                pagination: commentsData.pagination,
                metadata: commentsData.metadata
            };
            
            // Notificar que los comentarios han sido cargados
            EventBus.publish('comments.loaded', {
                sectionId,
                comments: processedComments,
                pagination: commentsData.pagination
            });
            
            return this.commentsCache[cacheKey];
            
        } catch (error) {
            console.error('Error cargando comentarios:', error);
            
            // Notificar error
            EventBus.publish('comments.error', {
                type: 'load',
                sectionId,
                error: error.message
            });
            
            throw error;
        }
    }
    
    /**
     * Crea un nuevo comentario
     * @param {string} sectionId - Identificador de la sección
     * @param {Object} commentData - Datos del comentario a crear
     * @returns {Promise
} Promesa que resuelve con el comentario creado
     */
    async createComment(sectionId, commentData) {
        // Verificar si el usuario está autenticado
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Debes iniciar sesión para comentar');
        }
        
        // Validar contenido del comentario
        if (!commentData.content || commentData.content.trim() === '') {
            throw new Error('El comentario no puede estar vacío');
        }
        
        if (commentData.content.length > this.options.maxCommentLength) {
            throw new Error(`El comentario no puede exceder ${this.options.maxCommentLength} caracteres`);
        }
        
        // Verificar contenido inapropiado
        if (this.options.inappropriateContentFilter && 
            this._containsInappropriateContent(commentData.content)) {
            throw new Error('El comentario contiene contenido inapropiado');
        }
        
        // Verificar spam
        if (this.options.spamDetection && this._isLikelySpam(commentData.content)) {
            throw new Error('El comentario ha sido detectado como posible spam');
        }
        
        try {
            const currentUser = this.authManager.getCurrentUser();
            
            // Preparar datos para enviar
            const newComment = {
                content: commentData.content,
                authorId: currentUser.id,
                authorName: currentUser.displayName,
                authorAvatar: currentUser.avatar,
                parentId: commentData.parentId || null,
                createdAt: new Date().toISOString(),
                updatedAt: null,
                upvotes: 0,
                downvotes: 0,
                ...commentData
            };
            
            // Procesar menciones si están habilitadas
            let mentions = [];
            if (this.options.enableMentions) {
                mentions = this._extractMentions(commentData.content);
                newComment.mentions = mentions;
            }
            
            // Enviar a la API
            const response = await fetch(`${this.options.apiEndpoint}/${sectionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authManager.getAuthToken()
                },
                body: JSON.stringify(newComment)
            });
            
            if (!response.ok) {
                throw new Error(`Error creando comentario: ${response.status}`);
            }
            
            const createdComment = await response.json();
            
            // Invalidar caché para esta sección
            this._invalidateCache(sectionId);
            
            // Enviar notificaciones por menciones
            if (mentions.length > 0 && this.options.notifyOnMentions) {
                this._sendMentionNotifications(mentions, createdComment, sectionId);
            }
            
            // Enviar notificación si es una respuesta
            if (newComment.parentId && this.options.notifyOnReplies) {
                this._sendReplyNotification(newComment.parentId, createdComment, sectionId);
            }
            
            // Notificar que el comentario ha sido creado
            EventBus.publish('comments.created', {
                sectionId,
                comment: createdComment
            });
            
            return createdComment;
            
        } catch (error) {
            console.error('Error creando comentario:', error);
            
            EventBus.publish('comments.error', {
                type: 'create',
                sectionId,
                error: error.message
            });
            
            throw error;
        }
    }
    
    /**
     * Edita un comentario existente
     * @param {string} sectionId - Identificador de la sección
     * @param {string} commentId - Identificador del comentario
     * @param {Object} commentData - Nuevos datos del comentario
     * @returns {Promise
} Promesa que resuelve con el comentario actualizado
     */
    async editComment(sectionId, commentId, commentData) {
        // Verificar autenticación y validar contenido (similar a createComment)
        // ...
        
        try {
            // Primero obtener el comentario actual para verificar permisos
            const currentComment = await this._getCommentById(sectionId, commentId);
            const currentUser = this.authManager.getCurrentUser();
            
            // Verificar permisos (solo el autor o moderador puede editar)
            if (currentComment.authorId !== currentUser.id && 
                !this.authManager.hasPermission('comments.edit.any')) {
                throw new Error('No tienes permiso para editar este comentario');
            }
            
            // Preparar datos de actualización
            const updatedComment = {
                content: commentData.content,
                updatedAt: new Date().toISOString()
            };
            
            // Procesar menciones nuevas
            if (this.options.enableMentions) {
                updatedComment.mentions = this._extractMentions(commentData.content);
            }
            
            // Enviar a la API
            const response = await fetch(`${this.options.apiEndpoint}/${sectionId}/${commentId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authManager.getAuthToken()
                },
                body: JSON.stringify(updatedComment)
            });
            
            if (!response.ok) {
                throw new Error(`Error actualizando comentario: ${response.status}`);
            }
            
            const editedComment = await response.json();
            
            // Invalidar caché
            this._invalidateCache(sectionId);
            
            // Notificar actualización
            EventBus.publish('comments.updated', {
                sectionId,
                commentId,
                comment: editedComment
            });
            
            return editedComment;
            
        } catch (error) {
            console.error('Error editando comentario:', error);
            EventBus.publish('comments.error', {
                type: 'edit',
                sectionId,
                commentId,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Elimina un comentario
     * @param {string} sectionId - Identificador de la sección
     * @param {string} commentId - Identificador del comentario
     * @returns {Promise} Promesa que resuelve con true si se eliminó correctamente
     */
    async deleteComment(sectionId, commentId) {
        // Verificar autenticación y permisos
        // ...
        
        try {
            const response = await fetch(`${this.options.apiEndpoint}/${sectionId}/${commentId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': this.authManager.getAuthToken()
                }
            });
            
            if (!response.ok) {
                throw new Error(`Error eliminando comentario: ${response.status}`);
            }
            
            // Invalidar caché
            this._invalidateCache(sectionId);
            
            // Notificar eliminación
            EventBus.publish('comments.deleted', {
                sectionId,
                commentId
            });
            
            return true;
            
        } catch (error) {
            console.error('Error eliminando comentario:', error);
            EventBus.publish('comments.error', {
                type: 'delete',
                sectionId,
                commentId,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Vota positiva o negativamente un comentario
     * @param {string} sectionId - Identificador de la sección
     * @param {string} commentId - Identificador del comentario
     * @param {string} voteType - Tipo de voto ('upvote' o 'downvote')
     * @returns {Promise
} Promesa que resuelve con el comentario actualizado
     */
    async voteComment(sectionId, commentId, voteType) {
        if (!this.options.enableVoting) {
            throw new Error('La votación está deshabilitada');
        }
        
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Debes iniciar sesión para votar');
        }
        
        if (voteType !== 'upvote' && voteType !== 'downvote') {
            throw new Error('Tipo de voto inválido');
        }
        
        try {
            const response = await fetch(`${this.options.apiEndpoint}/${sectionId}/${commentId}/vote`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authManager.getAuthToken()
                },
                body: JSON.stringify({ voteType })
            });
            
            if (!response.ok) {
                throw new Error(`Error al votar comentario: ${response.status}`);
            }
            
            const updatedComment = await response.json();
            
            // Invalidar caché
            this._invalidateCache(sectionId);
            
            // Notificar voto
            EventBus.publish('comments.voted', {
                sectionId,
                commentId,
                voteType,
                comment: updatedComment
            });
            
            return updatedComment;
            
        } catch (error) {
            console.error('Error al votar comentario:', error);
            EventBus.publish('comments.error', {
                type: 'vote',
                sectionId,
                commentId,
                voteType,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Reporta un comentario por contenido inapropiado
     * @param {string} sectionId - Identificador de la sección
     * @param {string} commentId - Identificador del comentario
     * @param {string} reason - Razón del reporte
     * @returns {Promise} Promesa que resuelve con true si se reportó correctamente
     */
    async reportComment(sectionId, commentId, reason) {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Debes iniciar sesión para reportar un comentario');
        }
        
        try {
            const response = await fetch(`${this.options.apiEndpoint}/${sectionId}/${commentId}/report`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.authManager.getAuthToken()
                },
                body: JSON.stringify({ reason })
            });
            
            if (!response.ok) {
                throw new Error(`Error al reportar comentario: ${response.status}`);
            }
            
            // Notificar reporte
            EventBus.publish('comments.reported', {
                sectionId,
                commentId,
                reason
            });
            
            return true;
            
        } catch (error) {
            console.error('Error al reportar comentario:', error);
            EventBus.publish('comments.error', {
                type: 'report',
                sectionId,
                commentId,
                reason,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Obtiene estadísticas de comentarios para el usuario actual
     * @returns {Promise
} Promesa que resuelve con las estadísticas
     */
    async getUserStats() {
        if (!this.authManager.isAuthenticated()) {
            throw new Error('Debes iniciar sesión para ver estadísticas');
        }
        
        try {
            const response = await fetch(`${this.options.apiEndpoint}/stats/user`, {
                method: 'GET',
                headers: {
                    'Authorization': this.authManager.getAuthToken()
                }
            });
            
            if (!response.ok) {
                throw new Error(`Error obteniendo estadísticas: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Error obteniendo estadísticas de usuario:', error);
            throw error;
        }
    }
    
    /**
     * Métodos privados para funcionalidad interna
     */
    
    /**
     * Extrae menciones de usuarios del contenido
     * @param {string} content - Contenido del comentario
     * @returns {Array} Array de nombres de usuario mencionados
     * @private
     */
    _extractMentions(content) {
        const mentionRegex = /@([a-zA-Z0-9_]{3,30})/g;
        const mentions = [];
        let match;
        
        while ((match = mentionRegex.exec(content)) !== null) {
            if (!mentions.includes(match[1])) {
                mentions.push(match[1]);
            }
        }
        
        return mentions;
    }
    
    /**
     * Verifica si el contenido contiene palabras inapropiadas
     * @param {string} content - Contenido a verificar
     * @returns {boolean} true si contiene contenido inapropiado
     * @private
     */
    _containsInappropriateContent(content) {
        const normalizedContent = content.toLowerCase();
        
        return this.inappropriateWords.some(word => 
            normalizedContent.includes(word.toLowerCase())
        );
    }
    
    /**
     * Verifica si el contenido parece ser spam
     * @param {string} content - Contenido a verificar
     * @returns {boolean} true si es probable que sea spam
     * @private
     */
    _isLikelySpam(content) {
        // Verificar patrones típicos de spam
        return this.spamPatterns.some(pattern => pattern.test(content));
    }
    
    /**
     * Genera una clave de caché para una combinación de sección y opciones
     * @param {string} sectionId - Identificador de la sección
     * @param {Object} options - Opciones de la solicitud
     * @returns {string} Clave de caché
     * @private
     */
    _generateCacheKey(sectionId, options) {
        return `${sectionId}-${JSON.stringify(options)}`;
    }
    
    /**
     * Invalida la caché para una sección específica
     * @param {string} sectionId - Identificador de la sección
     * @private
     */
    _invalidateCache(sectionId) {
        for (const key in this.commentsCache) {
            if (key.startsWith(`${sectionId}-`)) {
                delete this.commentsCache[key];
            }
        }
    }
    
    /**
     * Procesa la lista plana de comentarios en una estructura de árbol
     * @param {Array} comments - Lista plana de comentarios
     * @returns {Array} Estructura de árbol de comentarios
     * @private
     */
    _processComments(comments) {
        const commentMap = {};
        const rootComments = [];
        
        // Primera pasada: crear mapa de comentarios por ID
        comments.forEach(comment => {
            commentMap[comment.id] = {
                ...comment,
                replies: []
            };
        });
        
        // Segunda pasada: construir jerarquía
        comments.forEach(comment => {
            if (comment.parentId) {
                // Es una respuesta, añadir al comentario padre
                if (commentMap[comment.parentId]) {
                    commentMap[comment.parentId].replies.push(commentMap[comment.id]);
                } else {
                    // El padre no existe, añadir a raíz
                    rootComments.push(commentMap[comment.id]);
                }
            } else {
                // Es un comentario raíz
                rootComments.push(commentMap[comment.id]);
            }
        });
        
        return rootComments;
    }
    
    /**
     * Envía notificaciones a usuarios mencionados
     * @param {Array} mentions - Lista de usuarios mencionados
     * @param {Object} comment - Comentario con las menciones
     * @param {string} sectionId - Identificador de la sección
     * @private
     */
    _sendMentionNotifications(mentions, comment, sectionId) {
        mentions.forEach(username => {
            this.notificationService.notify({
                type: 'mention',
                title: 'Te han mencionado en un comentario',
                message: `${comment.authorName} te ha mencionado en un comentario`,
                data: {
                    sectionId,
                    commentId: comment.id,
                    authorId: comment.authorId,
                    authorName: comment.authorName
                },
                targetUser: username,
                priority: 'medium'
            });
        });
    }
    
    /**
     * Envía notificación al autor de un comentario cuando alguien responde
     * @param {string} parentId - ID del comentario padre
     * @param {Object} reply - Comentario de respuesta
     * @param {string} sectionId - Identificador de la sección
     * @private
     */
    _sendReplyNotification(parentId, reply, sectionId) {
        // Primero obtener el comentario padre para conocer su autor
        this._getCommentById(sectionId, parentId)
            .then(parentComment => {
                if (parentComment.authorId === reply.authorId) {
                    return; // No notificar si el autor responde a su propio comentario
                }
                
                this.notificationService.notify({
                    type: 'reply',
                    title: 'Nueva respuesta a tu comentario',
                    message: `${reply.authorName} ha respondido a tu comentario`,
                    data: {
                        sectionId,
                        commentId: parentId,
                        replyId: reply.id,
                        authorId: reply.authorId,
                        authorName: reply.authorName
                    },
                    targetUserId: parentComment.authorId,
                    priority: 'medium'
                });
            })
            .catch(error => {
                console.error('Error enviando notificación de respuesta:', error);
            });
    }
    
    /**
     * Obtiene un comentario específico por su ID
     * @param {string} sectionId - Identificador de la sección
     * @param {string} commentId - Identificador del comentario
     * @returns {Promise
} Promesa que resuelve con el comentario
     * @private
     */
    async _getCommentById(sectionId, commentId) {
        try {
            const response = await fetch(`${this.options.apiEndpoint}/${sectionId}/${commentId}`, {
                method: 'GET',
                headers: {
                    'Authorization': this.authManager.getAuthToken()
                }
            });
            
            if (!response.ok) {
                throw new Error(`Error obteniendo comentario: ${response.status}`);
            }
            
            return await response.json();
            
        } catch (error) {
            console.error('Error obteniendo comentario por ID:', error);
            throw error;
        }
    }
    
    /**
     * Actualiza la caché de comentarios del usuario actual
     * @param {string} userId - ID del usuario
     * @private
     */
    _refreshUserComments(userId) {
        // Implementación para actualizar comentarios del usuario
        // ...
    }
}

// Exportar una instancia por defecto para uso sencillo
export const commentsService = new CommentsService();