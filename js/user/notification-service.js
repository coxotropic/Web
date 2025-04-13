/**
 * notification-service.js
 * Servicio de notificaciones para el portal de criptomonedas
 * 
 * Este servicio gestiona todas las notificaciones del usuario, incluyendo
 * alertas de precio, noticias importantes, actualizaciones del sistema e interacciones sociales.
 * 
 * @module NotificationService
 */

import { EventBus } from '../utils/event-bus.js';
import { StorageManager } from '../utils/storage-manager.js';
import { AuthManager } from '../auth/index.js';

/**
 * Tipos de notificaciones soportados
 * @enum {string}
 */
export const NotificationType = {
    PRICE_ALERT: 'price_alert',
    NEWS: 'news',
    SYSTEM: 'system',
    SOCIAL: 'social',
    PORTFOLIO: 'portfolio',
    SECURITY: 'security'
};

/**
 * Prioridades de notificaciones
 * @enum {number}
 */
export const NotificationPriority = {
    LOW: 0,
    MEDIUM: 1,
    HIGH: 2,
    URGENT: 3
};

/**
 * Canales de entrega de notificaciones
 * @enum {string}
 */
export const DeliveryChannel = {
    IN_APP: 'in_app',
    EMAIL: 'email',
    BROWSER: 'browser',
    MOBILE: 'mobile',
    SMS: 'sms'
};

/**
 * Estados de notificación
 * @enum {string}
 */
export const NotificationStatus = {
    UNREAD: 'unread',
    READ: 'read',
    DISMISSED: 'dismissed',
    ARCHIVED: 'archived'
};

/**
 * Clase principal para gestionar notificaciones
 */
export class NotificationService {
    /**
     * Constructor del servicio de notificaciones
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        this.options = {
            maxStoredNotifications: 200,
            defaultExpiration: 30 * 24 * 60 * 60 * 1000, // 30 días en milisegundos
            rateLimitWindowMs: 60 * 1000, // 1 minuto
            maxNotificationsPerWindow: 5,
            groupSimilarTimeWindow: 5 * 60 * 1000, // 5 minutos
            webSocketUrl: 'wss://api.cryptinvest.com/notifications',
            notificationsContainer: '#notifications-container',
            checkPermissionsOnStart: true,
            ...options
        };

        // Dependencias
        this.eventBus = new EventBus();
        this.storageManager = new StorageManager();
        this.auth = new AuthManager();

        // Estado interno
        this.wsConnection = null;
        this.notificationsQueue = [];
        this.lastNotificationTimes = [];
        this.browserPermissionGranted = false;
        this.isInitialized = false;
        this.offlineQueue = [];
        this.currentSubscriptions = new Map();
        
        // Inicializar
        this.init();
    }

    /**
     * Inicializa el servicio de notificaciones
     */
    async init() {
        if (this.isInitialized) return;

        try {
            // Cargar preferencias del usuario
            await this.loadUserPreferences();
            
            // Verificar permisos del navegador si está configurado
            if (this.options.checkPermissionsOnStart) {
                await this.checkBrowserPermissions();
            }
            
            // Inicializar WebSocket si el usuario está autenticado
            if (this.auth.isAuthenticated()) {
                this.initWebSocket();
            }
            
            // Establecer listener para cambios de estado de autenticación
            this.eventBus.subscribe('auth:stateChanged', this.handleAuthStateChanged.bind(this));
            
            // Establecer listener para cambios de conectividad
            window.addEventListener('online', this.handleOnline.bind(this));
            window.addEventListener('offline', this.handleOffline.bind(this));
            
            // Establecer listener para visibilidad de página
            document.addEventListener('visibilitychange', this.handleVisibilityChange.bind(this));
            
            this.isInitialized = true;
            console.log('Servicio de notificaciones inicializado');
        } catch (error) {
            console.error('Error al inicializar el servicio de notificaciones:', error);
        }
    }

    /**
     * Carga las preferencias de notificación del usuario
     */
    async loadUserPreferences() {
        if (!this.auth.isAuthenticated()) {
            // Si no hay usuario autenticado, usar configuración predeterminada
            this.userPreferences = {
                enabledChannels: [DeliveryChannel.IN_APP],
                enabledTypes: Object.values(NotificationType),
                groupSimilar: true,
                showUnreadCount: true,
                emailFrequency: 'immediate' // 'immediate', 'digest', 'off'
            };
            return;
        }

        try {
            // Intentar cargar preferencias desde almacenamiento local primero (para rápido acceso)
            const cachedPrefs = await this.storageManager.get('notification_preferences');
            
            if (cachedPrefs) {
                this.userPreferences = cachedPrefs;
            } else {
                // Si no hay caché, cargar desde el servidor
                const userId = this.auth.getCurrentUser().id;
                const response = await fetch(`/api/users/${userId}/notification-preferences`, {
                    headers: {
                        'Authorization': `Bearer ${this.auth.getToken()}`
                    }
                });
                
                if (response.ok) {
                    this.userPreferences = await response.json();
                    // Guardar en caché para acceso futuro
                    await this.storageManager.set('notification_preferences', this.userPreferences);
                } else {
                    throw new Error('Error al cargar preferencias de notificación');
                }
            }
        } catch (error) {
            console.error('Error al cargar preferencias de usuario:', error);
            // Usar configuración predeterminada en caso de error
            this.userPreferences = {
                enabledChannels: [DeliveryChannel.IN_APP],
                enabledTypes: Object.values(NotificationType),
                groupSimilar: true,
                showUnreadCount: true,
                emailFrequency: 'immediate'
            };
        }
    }

    /**
     * Verifica y solicita permisos de notificación del navegador
     */
    async checkBrowserPermissions() {
        if (!('Notification' in window)) {
            this.browserPermissionGranted = false;
            return false;
        }

        if (Notification.permission === 'granted') {
            this.browserPermissionGranted = true;
            return true;
        } else if (Notification.permission !== 'denied') {
            try {
                const permission = await Notification.requestPermission();
                this.browserPermissionGranted = permission === 'granted';
                return this.browserPermissionGranted;
            } catch (error) {
                console.error('Error al solicitar permisos de notificación:', error);
                this.browserPermissionGranted = false;
                return false;
            }
        }

        this.browserPermissionGranted = false;
        return false;
    }

    /**
     * Inicializa la conexión WebSocket para notificaciones en tiempo real
     */
    initWebSocket() {
        if (!this.auth.isAuthenticated() || this.wsConnection) return;

        try {
            const token = this.auth.getToken();
            const wsUrl = `${this.options.webSocketUrl}?token=${token}`;
            
            this.wsConnection = new WebSocket(wsUrl);
            
            this.wsConnection.onopen = () => {
                console.log('WebSocket conectado para notificaciones en tiempo real');
                
                // Enviar confirmación de conexión
                this.wsConnection.send(JSON.stringify({
                    type: 'connection_established',
                    userId: this.auth.getCurrentUser().id
                }));
                
                // Si hay mensajes en la cola offline, intentar enviarlos
                if (this.offlineQueue.length > 0) {
                    this.processOfflineQueue();
                }
            };
            
            this.wsConnection.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'notification') {
                        this.processRemoteNotification(data.notification);
                    }
                } catch (error) {
                    console.error('Error al procesar mensaje WebSocket:', error);
                }
            };
            
            this.wsConnection.onerror = (error) => {
                console.error('Error en la conexión WebSocket:', error);
            };
            
            this.wsConnection.onclose = (event) => {
                console.log('Conexión WebSocket cerrada. Código:', event.code, 'Razón:', event.reason);
                this.wsConnection = null;
                
                // Intentar reconectar después de un tiempo si no fue un cierre normal
                if (event.code !== 1000) {
                    setTimeout(() => this.initWebSocket(), 5000);
                }
            };
        } catch (error) {
            console.error('Error al inicializar WebSocket:', error);
            this.wsConnection = null;
        }
    }

    /**
     * Cierra la conexión WebSocket
     */
    closeWebSocket() {
        if (this.wsConnection) {
            this.wsConnection.close(1000, 'Desconexión normal');
            this.wsConnection = null;
        }
    }

    /**
     * Maneja cambios en el estado de autenticación
     * @param {Object} event - Evento de cambio de autenticación
     */
    handleAuthStateChanged(event) {
        const { isAuthenticated } = event.detail;
        
        if (isAuthenticated) {
            // Si el usuario se autenticó, inicializar WebSocket y cargar preferencias
            this.loadUserPreferences();
            this.initWebSocket();
        } else {
            // Si el usuario cerró sesión, cerrar WebSocket
            this.closeWebSocket();
        }
    }

    /**
     * Maneja el evento cuando el dispositivo recupera conexión
     */
    handleOnline() {
        console.log('Dispositivo en línea - restaurando servicios de notificación');
        
        // Reiniciar WebSocket si es necesario
        if (!this.wsConnection && this.auth.isAuthenticated()) {
            this.initWebSocket();
        }
        
        // Procesar notificaciones que se acumularon offline
        this.processOfflineQueue();
    }

    /**
     * Maneja el evento cuando el dispositivo pierde conexión
     */
    handleOffline() {
        console.log('Dispositivo sin conexión - adaptando servicios de notificación');
        
        // No cerrar WebSocket intencionalmente para permitir que maneje la reconexión automática
    }

    /**
     * Maneja cambios de visibilidad de la página
     */
    handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // La página es visible, marcar notificaciones como vistas si corresponde
            this.markVisibleNotificationsAsSeen();
            
            // Refrescar notificaciones en caso de que el usuario haya estado fuera mucho tiempo
            if (this.auth.isAuthenticated()) {
                this.loadNotifications();
            }
        }
    }

    /**
     * Marca las notificaciones visibles actualmente como vistas
     */
    markVisibleNotificationsAsSeen() {
        const container = document.querySelector(this.options.notificationsContainer);
        if (!container) return;
        
        // Encontrar notificaciones visibles usando Intersection Observer
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const notificationElement = entry.target;
                    const notificationId = notificationElement.dataset.notificationId;
                    
                    if (notificationId) {
                        this.markAsSeen(notificationId, false); // No realizar actualización visual
                    }
                }
            });
        }, { threshold: 0.5 });
        
        // Observar cada notificación no leída
        const unreadElements = container.querySelectorAll('.notification-item.unread');
        unreadElements.forEach(element => observer.observe(element));
        
        // Desconectar después de procesar
        setTimeout(() => observer.disconnect(), 2000);
    }

    /**
     * Procesa notificaciones almacenadas durante estado offline
     */
    async processOfflineQueue() {
        if (this.offlineQueue.length === 0) return;
        
        console.log(`Procesando ${this.offlineQueue.length} notificaciones pendientes...`);
        
        while (this.offlineQueue.length > 0) {
            const { action, data } = this.offlineQueue.shift();
            
            try {
                switch (action) {
                    case 'create':
                        await this.sendNotificationToServer(data);
                        break;
                    case 'markAsRead':
                        await this.updateNotificationStatus(data.id, NotificationStatus.READ);
                        break;
                    case 'delete':
                        await this.deleteNotificationFromServer(data.id);
                        break;
                }
            } catch (error) {
                console.error(`Error al procesar acción offline ${action}:`, error);
                // Volver a poner en la cola si el error es temporal
                if (error.temporary) {
                    this.offlineQueue.push({ action, data });
                }
            }
        }
        
        console.log('Cola offline procesada');
    }

    /**
     * Procesa una notificación recibida a través de WebSocket
     * @param {Object} notification - Datos de la notificación
     */
    processRemoteNotification(notification) {
        // Verificar si esta notificación está habilitada según preferencias
        if (!this.isNotificationEnabled(notification.type)) {
            return;
        }
        
        // Verificar si debe ser agrupada con otras notificaciones similares
        if (this.userPreferences.groupSimilar) {
            const similar = this.findSimilarNotification(notification);
            if (similar) {
                this.updateGroupedNotification(similar, notification);
                return;
            }
        }
        
        // Guardar en almacenamiento local
        this.saveNotificationToStorage(notification);
        
        // Mostrar según los canales configurados
        this.showNotification(notification);
        
        // Emitir evento para informar a otros componentes
        this.eventBus.publish('notification:received', { notification });
        
        // Actualizar contador de notificaciones no leídas
        this.updateUnreadCount();
    }

    /**
     * Verifica si un tipo de notificación está habilitado según preferencias del usuario
     * @param {string} type - Tipo de notificación
     * @returns {boolean} - Verdadero si el tipo está habilitado
     */
    isNotificationEnabled(type) {
        return this.userPreferences.enabledTypes.includes(type);
    }

    /**
     * Encuentra notificaciones similares para agrupar
     * @param {Object} notification - Notificación a comparar
     * @returns {Object|null} - Notificación similar o null si no hay similares
     */
    findSimilarNotification(notification) {
        // Obtener notificaciones recientes
        const recentNotifications = this.getRecentNotifications();
        
        const now = Date.now();
        const groupTimeWindow = this.options.groupSimilarTimeWindow;
        
        // Buscar notificaciones similares
        return recentNotifications.find(existingNotification => {
            // Verificar tiempo
            const timeDiff = now - existingNotification.timestamp;
            if (timeDiff > groupTimeWindow) return false;
            
            // Verificar tipo
            if (existingNotification.type !== notification.type) return false;
            
            // Reglas específicas según tipo
            switch (notification.type) {
                case NotificationType.PRICE_ALERT:
                    // Agrupar alertas del mismo activo
                    return existingNotification.data.coinId === notification.data.coinId;
                    
                case NotificationType.NEWS:
                    // Agrupar noticias de la misma fuente
                    return existingNotification.data.source === notification.data.source;
                    
                case NotificationType.SOCIAL:
                    // Agrupar interacciones del mismo usuario
                    return existingNotification.data.userId === notification.data.userId;
                    
                default:
                    return false;
            }
        });
    }

    /**
     * Actualiza una notificación agrupada
     * @param {Object} existingNotification - Notificación existente
     * @param {Object} newNotification - Nueva notificación a agrupar
     */
    updateGroupedNotification(existingNotification, newNotification) {
        // Si no existe grupo, inicializarlo
        if (!existingNotification.group) {
            existingNotification.group = {
                count: 1,
                items: [{ ...existingNotification.data }]
            };
        }
        
        // Añadir nueva notificación al grupo
        existingNotification.group.count += 1;
        existingNotification.group.items.push(newNotification.data);
        
        // Actualizar mensaje para reflejar agrupación
        switch (newNotification.type) {
            case NotificationType.PRICE_ALERT:
                existingNotification.title = `${existingNotification.group.count} alertas de precio para ${newNotification.data.coinSymbol}`;
                break;
                
            case NotificationType.NEWS:
                existingNotification.title = `${existingNotification.group.count} noticias de ${newNotification.data.source}`;
                break;
                
            case NotificationType.SOCIAL:
                existingNotification.title = `${existingNotification.group.count} interacciones de ${newNotification.data.userName}`;
                break;
                
            default:
                existingNotification.title = `${existingNotification.group.count} notificaciones agrupadas`;
        }
        
        // Actualizar timestamp
        existingNotification.timestamp = Date.now();
        
        // Guardar notificación actualizada
        this.saveNotificationToStorage(existingNotification);
        
        // Actualizar UI si corresponde
        this.updateNotificationInUI(existingNotification);
    }

    /**
     * Obtiene notificaciones recientes del almacenamiento
     * @returns {Array} - Lista de notificaciones recientes
     */
    getRecentNotifications(limit = 20) {
        try {
            const allNotifications = this.storageManager.get('notifications') || [];
            
            // Ordenar por timestamp descendente y limitar
            return allNotifications
                .sort((a, b) => b.timestamp - a.timestamp)
                .slice(0, limit);
        } catch (error) {
            console.error('Error al obtener notificaciones recientes:', error);
            return [];
        }
    }

    /**
     * Guarda una notificación en el almacenamiento local
     * @param {Object} notification - Notificación a guardar
     */
    saveNotificationToStorage(notification) {
        try {
            let notifications = this.storageManager.get('notifications') || [];
            
            // Si ya existe, actualizar
            const existingIndex = notifications.findIndex(n => n.id === notification.id);
            if (existingIndex >= 0) {
                notifications[existingIndex] = notification;
            } else {
                // Añadir nueva notificación
                notifications.unshift(notification);
            }
            
            // Limitar cantidad de notificaciones almacenadas
            if (notifications.length > this.options.maxStoredNotifications) {
                notifications = notifications.slice(0, this.options.maxStoredNotifications);
            }
            
            // Guardar en almacenamiento
            this.storageManager.set('notifications', notifications);
        } catch (error) {
            console.error('Error al guardar notificación en almacenamiento:', error);
        }
    }

    /**
     * Actualiza una notificación en la interfaz de usuario
     * @param {Object} notification - Notificación actualizada
     */
    updateNotificationInUI(notification) {
        const container = document.querySelector(this.options.notificationsContainer);
        if (!container) return;
        
        const notificationElement = container.querySelector(`[data-notification-id="${notification.id}"]`);
        if (!notificationElement) return;
        
        // Actualizar contenido
        const titleElement = notificationElement.querySelector('.notification-title');
        if (titleElement) titleElement.textContent = notification.title;
        
        const descriptionElement = notificationElement.querySelector('.notification-description');
        if (descriptionElement && notification.description) {
            descriptionElement.textContent = notification.description;
        }
        
        // Si está agrupada, actualizar indicador de grupo
        if (notification.group) {
            const groupIndicator = notificationElement.querySelector('.notification-group-count') || 
                                  document.createElement('span');
            
            groupIndicator.className = 'notification-group-count';
            groupIndicator.textContent = notification.group.count;
            
            if (!notificationElement.querySelector('.notification-group-count')) {
                const iconContainer = notificationElement.querySelector('.notification-icon');
                if (iconContainer) {
                    iconContainer.appendChild(groupIndicator);
                }
            }
        }
        
        // Actualizar tiempo
        const timeElement = notificationElement.querySelector('.notification-time');
        if (timeElement) {
            timeElement.textContent = this.formatTimestamp(notification.timestamp);
            timeElement.setAttribute('title', new Date(notification.timestamp).toLocaleString());
        }
    }

    /**
     * Muestra una notificación según los canales habilitados
     * @param {Object} notification - Notificación a mostrar
     */
    showNotification(notification) {
        // Verificar límite de frecuencia para evitar spam
        if (this.isRateLimited()) {
            console.log('Notificación retrasada por límite de frecuencia');
            this.notificationsQueue.push(notification);
            return;
        }
        
        // Registrar este momento para control de frecuencia
        this.lastNotificationTimes.push(Date.now());
        
        // Mostrar en los canales habilitados
        if (this.userPreferences.enabledChannels.includes(DeliveryChannel.IN_APP)) {
            this.showInAppNotification(notification);
        }
        
        if (this.userPreferences.enabledChannels.includes(DeliveryChannel.BROWSER) && 
            this.browserPermissionGranted) {
            this.showBrowserNotification(notification);
        }
        
        if (this.userPreferences.enabledChannels.includes(DeliveryChannel.EMAIL) && 
            this.userPreferences.emailFrequency === 'immediate') {
            this.sendEmailNotification(notification);
        }
        
        // Enviar a servidor para canales adicionales como SMS o móvil
        this.sendNotificationToServer(notification);
    }

    /**
     * Verifica si las notificaciones están limitadas por frecuencia
     * @returns {boolean} - Verdadero si está limitado
     */
    isRateLimited() {
        const now = Date.now();
        const windowStart = now - this.options.rateLimitWindowMs;
        
        // Remover notificaciones antiguas fuera de la ventana de tiempo
        this.lastNotificationTimes = this.lastNotificationTimes.filter(time => time >= windowStart);
        
        // Verificar si se excede el límite
        return this.lastNotificationTimes.length >= this.options.maxNotificationsPerWindow;
    }

    /**
     * Muestra una notificación dentro de la aplicación
     * @param {Object} notification - Notificación a mostrar
     */
    showInAppNotification(notification) {
        const container = document.querySelector(this.options.notificationsContainer);
        if (!container) {
            console.warn('Contenedor de notificaciones no encontrado:', this.options.notificationsContainer);
            return;
        }
        
        // Crear elemento de notificación
        const notificationElement = document.createElement('div');
        notificationElement.className = `notification-item ${notification.status === NotificationStatus.UNREAD ? 'unread' : ''}`;
        notificationElement.dataset.notificationId = notification.id;
        notificationElement.dataset.notificationType = notification.type;
        
        // Clase específica según tipo
        const typeClass = notification.type.replace('_', '-');
        
        // Construir estructura interna
        notificationElement.innerHTML = `
            <div class="notification-icon ${typeClass}">
                <i class="icon-${this.getIconForType(notification.type)}"></i>
                ${notification.group ? `<span class="notification-group-count">${notification.group.count}</span>` : ''}
            </div>
            <div class="notification-content">
                <div class="notification-header">
                    <div class="notification-title">
                        <span class="notification-text">${notification.title}</span>
                        ${notification.status === NotificationStatus.UNREAD ? '<span class="unread-indicator"></span>' : ''}
                    </div>
                    <div class="notification-time" title="${new Date(notification.timestamp).toLocaleString()}">
                        ${this.formatTimestamp(notification.timestamp)}
                    </div>
                </div>
                ${notification.description ? `
                <div class="notification-body">
                    <p>${notification.description}</p>
                </div>` : ''}
                ${notification.actions && notification.actions.length > 0 ? `
                <div class="notification-actions">
                    ${notification.actions.map(action => `
                        <a href="${action.url}" class="notification-action" data-action="${action.id}">
                            <i class="icon-${action.icon}"></i> ${action.label}
                        </a>
                    `).join('')}
                </div>` : ''}
            </div>
            <div class="notification-options">
                <div class="dropdown">
                    <button class="btn btn-sm btn-icon dropdown-toggle" aria-label="Opciones">
                        <i class="icon-more-vertical"></i>
                    </button>
                    <div class="dropdown-menu dropdown-menu-right">
                        ${notification.status === NotificationStatus.UNREAD ? `
                        <a href="#" class="dropdown-item" data-action="mark-read">
                            <i class="icon-check"></i> Marcar como leída
                        </a>` : `
                        <a href="#" class="dropdown-item" data-action="mark-unread">
                            <i class="icon-circle"></i> Marcar como no leída
                        </a>`}
                        <a href="#" class="dropdown-item" data-action="disable-similar">
                            <i class="icon-bell-off"></i> Desactivar este tipo
                        </a>
                        <div class="dropdown-divider"></div>
                        <a href="#" class="dropdown-item text-danger" data-action="delete">
                            <i class="icon-trash-2"></i> Eliminar
                        </a>
                    </div>
                </div>
            </div>
        `;
        
        // Añadir eventos
        this.attachNotificationEvents(notificationElement, notification);
        
        // Insertar al principio del contenedor
        if (container.firstChild) {
            container.insertBefore(notificationElement, container.firstChild);
        } else {
            container.appendChild(notificationElement);
        }
        
        // Efecto de entrada
        setTimeout(() => {
            notificationElement.classList.add('notification-show');
        }, 10);
        
        // Mostrar toast si la configuración lo permite
        if (notification.showToast !== false) {
            this.showToastNotification(notification);
        }
    }

    /**
     * Muestra una notificación tipo toast temporal
     * @param {Object} notification - Notificación a mostrar
     */
    showToastNotification(notification) {
        // Verificar si ya existe un contenedor para toasts
        let toastContainer = document.querySelector('.toast-container');
        
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }
        
        // Crear elemento toast
        const toast = document.createElement('div');
        toast.className = `toast-notification ${notification.type.replace('_', '-')}`;
        
        toast.innerHTML = `
            <div class="toast-icon">
                <i class="icon-${this.getIconForType(notification.type)}"></i>
            </div>
            <div class="toast-content">
                <div class="toast-title">${notification.title}</div>
                ${notification.description ? `<div class="toast-description">${notification.description}</div>` : ''}
            </div>
            <button class="toast-close" aria-label="Cerrar">
                <i class="icon-x"></i>
            </button>
        `;
        
        // Añadir al contenedor
        toastContainer.appendChild(toast);
        
        // Mostrar con animación
        setTimeout(() => toast.classList.add('toast-show'), 10);
        
        // Configurar auto-cierre
        const closeTimeout = setTimeout(() => {
            closeToast();
        }, 5000); // 5 segundos
        
        // Función para cerrar toast
        function closeToast() {
            clearTimeout(closeTimeout);
            toast.classList.remove('toast-show');
            toast.classList.add('toast-hide');
            
            // Remover después de la animación
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
                
                // Si no quedan toasts, remover el contenedor
                if (toastContainer.children.length === 0) {
                    toastContainer.parentNode.removeChild(toastContainer);
                }
            }, 300); // Duración de la animación
        }
        
        // Evento para cerrar
        toast.querySelector('.toast-close').addEventListener('click', closeToast);
        
        // También cerrar al hacer clic en el toast (opcional)
        toast.addEventListener('click', (e) => {
            // Evitar cerrar si se hizo clic en el botón de cerrar (ya tiene su propio handler)
            if (!e.target.closest('.toast-close')) {
                // Navegar a la vista de notificaciones o realizar acción específica
                this.handleNotificationClick(notification);
                closeToast();
            }
        });
    }

    /**
     * Muestra una notificación nativa del navegador
     * @param {Object} notification - Notificación a mostrar
     */
    showBrowserNotification(notification) {
        if (!this.browserPermissionGranted || !('Notification' in window)) {
            return;
        }
        
        try {
            // Opciones para la notificación del navegador
            const options = {
                body: notification.description || '',
                icon: notification.icon || '/assets/icons/notification-icon.png',
                badge: '/assets/icons/notification-badge.png',
                tag: `crypto-notification-${notification.id}`, // Para agrupar/reemplazar
                data: { notificationId: notification.id }
            };
            
            // Si hay acciones, añadirlas (compatible con algunos navegadores)
            if (notification.actions && Array.isArray(notification.actions)) {
                options.actions = notification.actions.map(action => ({
                    action: action.id,
                    title: action.label,
                    icon: action.icon ? `/assets/icons/${action.icon}.png` : undefined
                })).slice(0, 2); // Máximo 2 acciones soportadas
            }
            
            // Crear y mostrar notificación
            const browserNotification = new Notification(notification.title, options);
            
            // Eventos
            browserNotification.onclick = (event) => {
                event.preventDefault(); // Prevenir comportamiento por defecto
                window.focus(); // Enfocar ventana
                
                // Manejar clic
                this.handleNotificationClick(notification);
                
                // Cerrar notificación
                browserNotification.close();
            };
            
            browserNotification.onclose = () => {
                // Registrar cierre de notificación si es necesario
            };
            
            // Registrar esta notificación del navegador para referencia futura
            this.currentSubscriptions.set(notification.id, browserNotification);
            
            // Auto-cerrar después de un tiempo
            setTimeout(() => {
                if (this.currentSubscriptions.has(notification.id)) {
                    browserNotification.close();
                    this.currentSubscriptions.delete(notification.id);
                }
            }, 30000); // 30 segundos
        } catch (error) {
            console.error('Error al mostrar notificación del navegador:', error);
        }
    }

    /**
     * Envía una notificación por correo electrónico
     * @param {Object} notification - Notificación a enviar
     */
    sendEmailNotification(notification) {
        if (!this.auth.isAuthenticated()) return;
        
        // Si la configuración es para digest, guardar para envío posterior
        if (this.userPreferences.emailFrequency === 'digest') {
            this.queueForDigestEmail(notification);
            return;
        }
        
        // Enviar email inmediatamente
        const userId = this.auth.getCurrentUser().id;
        
        // Verificar si estamos online
        if (!navigator.onLine) {
            // Guardar para enviar cuando estemos online
            this.offlineQueue.push({
                action: 'email',
                data: { notification, userId }
            });
            return;
        }
        
        // Llamada a API para enviar email
        fetch('/api/notifications/email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.auth.getToken()}`
            },
            body: JSON.stringify({
                userId,
                notification
            })
        }).catch(error => {
            console.error('Error al enviar notificación por email:', error);
        });
    }

    /**
     * Añade una notificación a la cola para envío de digest por email
     * @param {Object} notification - Notificación a encolar
     */
    queueForDigestEmail(notification) {
        try {
            // Obtener cola actual
            let digestQueue = this.storageManager.get('email_digest_queue') || [];
            
            // Añadir notificación
            digestQueue.push({
                ...notification,
                queuedAt: Date.now()
            });
            
            // Guardar cola actualizada
            this.storageManager.set('email_digest_queue', digestQueue);
        } catch (error) {
            console.error('Error al encolar notificación para digest:', error);
        }
    }

    /**
     * Envía digest de notificaciones por email
     */
    sendDigestEmail() {
        if (!this.auth.isAuthenticated()) return;
        
        try {
            // Obtener cola de digest
            const digestQueue = this.storageManager.get('email_digest_queue') || [];
            
            // Si no hay notificaciones, salir
            if (digestQueue.length === 0) return;
            
            // Preparar datos para envío
            const userId = this.auth.getCurrentUser().id;
            
            // Verificar si estamos online
            if (!navigator.onLine) {
                // Intentar más tarde
                return;
            }
            
            // Llamada a API para enviar digest
            fetch('/api/notifications/email/digest', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.getToken()}`
                },
                body: JSON.stringify({
                    userId,
                    notifications: digestQueue
                })
            })
            .then(response => {
                if (response.ok) {
                    // Limpiar cola de digest
                    this.storageManager.set('email_digest_queue', []);
                }
            })
            .catch(error => {
                console.error('Error al enviar digest por email:', error);
            });
        } catch (error) {
            console.error('Error al procesar digest de email:', error);
        }
    }

    /**
     * Envía una notificación al servidor para procesamiento adicional
     * @param {Object} notification - Notificación a enviar
     */
    async sendNotificationToServer(notification) {
        if (!this.auth.isAuthenticated()) return;
        
        const userId = this.auth.getCurrentUser().id;
        
        // Verificar si estamos online
        if (!navigator.onLine) {
            // Guardar para enviar cuando estemos online
            this.offlineQueue.push({
                action: 'create',
                data: { ...notification, userId }
            });
            return;
        }
        
        try {
            const response = await fetch('/api/notifications', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.getToken()}`
                },
                body: JSON.stringify({
                    userId,
                    notification
                })
            });
            
            if (!response.ok) {
                throw new Error(`Error al enviar notificación: ${response.status}`);
            }
            
            return await response.json();
        } catch (error) {
            console.error('Error al enviar notificación al servidor:', error);
            
            // Si es un error de red, encolar para reintento
            if (error instanceof TypeError && error.message.includes('network')) {
                this.offlineQueue.push({
                    action: 'create',
                    data: { ...notification, userId }
                });
                
                // Marcar error como temporal para reintento
                error.temporary = true;
            }
            
            throw error;
        }
    }

    /**
     * Adjunta eventos a un elemento de notificación
     * @param {HTMLElement} element - Elemento de notificación
     * @param {Object} notification - Datos de la notificación
     */
    attachNotificationEvents(element, notification) {
        // Evento clic en la notificación
        element.addEventListener('click', (e) => {
            // Ignorar si el clic fue en opciones o acciones
            if (e.target.closest('.notification-options') || e.target.closest('.notification-actions')) {
                return;
            }
            
            this.handleNotificationClick(notification);
        });
        
        // Evento para marcar como leída/no leída
        const markReadBtn = element.querySelector('[data-action="mark-read"]');
        if (markReadBtn) {
            markReadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.markAsRead(notification.id);
            });
        }
        
        const markUnreadBtn = element.querySelector('[data-action="mark-unread"]');
        if (markUnreadBtn) {
            markUnreadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.markAsUnread(notification.id);
            });
        }
        
        // Evento para eliminar
        const deleteBtn = element.querySelector('[data-action="delete"]');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.deleteNotification(notification.id);
            });
        }
        
        // Evento para desactivar notificaciones similares
        const disableBtn = element.querySelector('[data-action="disable-similar"]');
        if (disableBtn) {
            disableBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.disableSimilarNotifications(notification);
            });
        }
        
        // Eventos para acciones personalizadas
        const actionButtons = element.querySelectorAll('.notification-action');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Permitir comportamiento normal para enlaces
                if (!btn.getAttribute('href').startsWith('#')) {
                    return;
                }
                
                e.preventDefault();
                const actionId = btn.dataset.action;
                this.handleActionClick(notification, actionId);
            });
        });
    }

    /**
     * Maneja el clic en una notificación
     * @param {Object} notification - Notificación en la que se hizo clic
     */
    handleNotificationClick(notification) {
        // Marcar como leída
        this.markAsRead(notification.id);
        
        // Navegar según el tipo y datos
        switch (notification.type) {
            case NotificationType.PRICE_ALERT:
                // Navegar a detalle de criptomoneda
                window.location.href = `/crypto/${notification.data.coinId}`;
                break;
                
            case NotificationType.NEWS:
                // Navegar a la noticia
                window.location.href = notification.data.url || `/noticias/${notification.data.newsId}`;
                break;
                
            case NotificationType.SOCIAL:
                // Navegar según el tipo de interacción social
                if (notification.data.commentId) {
                    window.location.href = `/comentarios/${notification.data.commentId}`;
                } else if (notification.data.userId) {
                    window.location.href = `/profile/${notification.data.userId}`;
                }
                break;
                
            case NotificationType.SYSTEM:
                // Navegar según el tipo de notificación del sistema
                if (notification.data && notification.data.url) {
                    window.location.href = notification.data.url;
                }
                break;
                
            default:
                // Si hay URL específica, usarla
                if (notification.data && notification.data.url) {
                    window.location.href = notification.data.url;
                }
        }
        
        // Emitir evento
        this.eventBus.publish('notification:clicked', { notification });
    }

    /**
     * Maneja el clic en una acción específica de notificación
     * @param {Object} notification - Notificación asociada
     * @param {string} actionId - Identificador de la acción
     */
    handleActionClick(notification, actionId) {
        // Buscar la acción correspondiente
        const action = notification.actions.find(a => a.id === actionId);
        
        if (!action) return;
        
        // Ejecutar acción según tipo
        switch (action.id) {
            case 'view':
                // Navegar a vista detallada
                window.location.href = action.url;
                break;
                
            case 'dismiss':
                // Descartar notificación
                this.deleteNotification(notification.id);
                break;
                
            default:
                // Si hay handler personalizado, ejecutarlo
                if (action.handler && typeof window[action.handler] === 'function') {
                    window[action.handler](notification, action);
                } else if (action.url) {
                    window.location.href = action.url;
                }
        }
        
        // Emitir evento
        this.eventBus.publish('notification:action', { 
            notification, 
            actionId, 
            action 
        });
    }

    /**
     * Marca una notificación como leída
     * @param {string} id - ID de la notificación
     * @param {boolean} updateUI - Si debe actualizar la UI
     */
    markAsRead(id, updateUI = true) {
        this.updateNotificationStatus(id, NotificationStatus.READ, updateUI);
    }

    /**
     * Marca una notificación como no leída
     * @param {string} id - ID de la notificación
     */
    markAsUnread(id) {
        this.updateNotificationStatus(id, NotificationStatus.UNREAD);
    }

    /**
     * Marca una notificación como vista (sin cambiar estado)
     * @param {string} id - ID de la notificación
     */
    markAsSeen(id, updateUI = true) {
        try {
            let notifications = this.storageManager.get('notifications') || [];
            
            const index = notifications.findIndex(n => n.id === id);
            if (index >= 0) {
                notifications[index].seen = true;
                this.storageManager.set('notifications', notifications);
            }
            
            // No hace falta actualizar la UI para vistas
        } catch (error) {
            console.error('Error al marcar notificación como vista:', error);
        }
    }

    /**
     * Actualiza el estado de una notificación
     * @param {string} id - ID de la notificación
     * @param {string} status - Nuevo estado
     * @param {boolean} updateUI - Si debe actualizar la UI
     */
    async updateNotificationStatus(id, status, updateUI = true) {
        try {
            // Actualizar localmente
            let notifications = this.storageManager.get('notifications') || [];
            
            const index = notifications.findIndex(n => n.id === id);
            if (index >= 0) {
                notifications[index].status = status;
                this.storageManager.set('notifications', notifications);
                
                // Actualizar UI si es necesario
                if (updateUI) {
                    this.updateNotificationStatusInUI(id, status);
                }
                
                // Actualizar contador
                this.updateUnreadCount();
            }
            
            // Actualizar en servidor si está autenticado
            if (this.auth.isAuthenticated()) {
                // Si offline, guardar para actualizar después
                if (!navigator.onLine) {
                    this.offlineQueue.push({
                        action: 'markAsRead',
                        data: { id, status }
                    });
                    return;
                }
                
                // Enviar al servidor
                await fetch(`/api/notifications/${id}/status`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.auth.getToken()}`
                    },
                    body: JSON.stringify({ status })
                });
            }
        } catch (error) {
            console.error(`Error al actualizar estado de notificación a ${status}:`, error);
        }
    }

    /**
     * Actualiza el estado de una notificación en la UI
     * @param {string} id - ID de la notificación
     * @param {string} status - Nuevo estado
     */
    updateNotificationStatusInUI(id, status) {
        const container = document.querySelector(this.options.notificationsContainer);
        if (!container) return;
        
        const notificationElement = container.querySelector(`[data-notification-id="${id}"]`);
        if (!notificationElement) return;
        
        // Actualizar clases
        if (status === NotificationStatus.READ) {
            notificationElement.classList.remove('unread');
            
            // Actualizar indicador
            const unreadIndicator = notificationElement.querySelector('.unread-indicator');
            if (unreadIndicator) {
                unreadIndicator.remove();
            }
            
            // Actualizar opciones del menú
            const markReadBtn = notificationElement.querySelector('[data-action="mark-read"]');
            const dropdownMenu = markReadBtn?.closest('.dropdown-menu');
            
            if (markReadBtn && dropdownMenu) {
                // Reemplazar por "marcar como no leída"
                const markUnreadBtn = document.createElement('a');
                markUnreadBtn.href = '#';
                markUnreadBtn.className = 'dropdown-item';
                markUnreadBtn.dataset.action = 'mark-unread';
                markUnreadBtn.innerHTML = '<i class="icon-circle"></i> Marcar como no leída';
                
                dropdownMenu.replaceChild(markUnreadBtn, markReadBtn);
                
                // Añadir evento al nuevo botón
                markUnreadBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.markAsUnread(id);
                });
            }
        } else if (status === NotificationStatus.UNREAD) {
            notificationElement.classList.add('unread');
            
            // Añadir indicador si no existe
            const titleElement = notificationElement.querySelector('.notification-title');
            if (titleElement && !titleElement.querySelector('.unread-indicator')) {
                const indicator = document.createElement('span');
                indicator.className = 'unread-indicator';
                titleElement.appendChild(indicator);
            }
            
            // Actualizar opciones del menú
            const markUnreadBtn = notificationElement.querySelector('[data-action="mark-unread"]');
            const dropdownMenu = markUnreadBtn?.closest('.dropdown-menu');
            
            if (markUnreadBtn && dropdownMenu) {
                // Reemplazar por "marcar como leída"
                const markReadBtn = document.createElement('a');
                markReadBtn.href = '#';
                markReadBtn.className = 'dropdown-item';
                markReadBtn.dataset.action = 'mark-read';
                markReadBtn.innerHTML = '<i class="icon-check"></i> Marcar como leída';
                
                dropdownMenu.replaceChild(markReadBtn, markUnreadBtn);
                
                // Añadir evento al nuevo botón
                markReadBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.markAsRead(id);
                });
            }
        }
    }

    /**
     * Elimina una notificación
     * @param {string} id - ID de la notificación
     */
    async deleteNotification(id) {
        try {
            // Eliminar localmente
            let notifications = this.storageManager.get('notifications') || [];
            
            const filteredNotifications = notifications.filter(n => n.id !== id);
            this.storageManager.set('notifications', filteredNotifications);
            
            // Eliminar de la UI
            const container = document.querySelector(this.options.notificationsContainer);
            if (container) {
                const notificationElement = container.querySelector(`[data-notification-id="${id}"]`);
                if (notificationElement) {
                    // Animación de salida
                    notificationElement.classList.add('notification-hide');
                    
                    // Eliminar después de la animación
                    setTimeout(() => {
                        notificationElement.remove();
                        
                        // Mostrar mensaje si no hay notificaciones
                        if (container.children.length === 0) {
                            this.showEmptyState(container);
                        }
                    }, 300);
                }
            }
            
            // Actualizar contador
            this.updateUnreadCount();
            
            // Eliminar del servidor si está autenticado
            if (this.auth.isAuthenticated()) {
                // Si offline, guardar para eliminar después
                if (!navigator.onLine) {
                    this.offlineQueue.push({
                        action: 'delete',
                        data: { id }
                    });
                    return;
                }
                
                await this.deleteNotificationFromServer(id);
            }
        } catch (error) {
            console.error('Error al eliminar notificación:', error);
        }
    }

    /**
     * Elimina una notificación del servidor
     * @param {string} id - ID de la notificación
     */
    async deleteNotificationFromServer(id) {
        try {
            await fetch(`/api/notifications/${id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });
        } catch (error) {
            console.error('Error al eliminar notificación del servidor:', error);
            throw error;
        }
    }

    /**
     * Desactiva notificaciones similares a la proporcionada
     * @param {Object} notification - Notificación de referencia
     */
    async disableSimilarNotifications(notification) {
        try {
            // Identificar qué tipo desactivar
            let typeToDisable = notification.type;
            
            // Para algunos tipos, ser más específico
            if (notification.type === NotificationType.PRICE_ALERT && notification.data.coinId) {
                typeToDisable = `${notification.type}_${notification.data.coinId}`;
            }
            
            // Actualizar preferencias localmente
            const updatedTypes = this.userPreferences.enabledTypes.filter(type => 
                type !== typeToDisable
            );
            
            this.userPreferences.enabledTypes = updatedTypes;
            
            // Guardar en almacenamiento local
            this.storageManager.set('notification_preferences', this.userPreferences);
            
            // Mostrar confirmación
            this.showConfirmationMessage(`Notificaciones de este tipo desactivadas`);
            
            // Actualizar en servidor si está conectado
            if (this.auth.isAuthenticated() && navigator.onLine) {
                const userId = this.auth.getCurrentUser().id;
                
                await fetch(`/api/users/${userId}/notification-preferences`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.auth.getToken()}`
                    },
                    body: JSON.stringify({
                        enabledTypes: updatedTypes
                    })
                });
            }
        } catch (error) {
            console.error('Error al desactivar notificaciones similares:', error);
        }
    }

    /**
     * Muestra un mensaje de confirmación temporal
     * @param {string} message - Mensaje a mostrar
     */
    showConfirmationMessage(message) {
        // Verificar si ya existe un contenedor para mensajes
        let messageContainer = document.querySelector('.confirmation-message-container');
        
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.className = 'confirmation-message-container';
            document.body.appendChild(messageContainer);
        }
        
        // Crear elemento de mensaje
        const messageElement = document.createElement('div');
        messageElement.className = 'confirmation-message';
        messageElement.innerHTML = `
            <div class="confirmation-icon">
                <i class="icon-check-circle"></i>
            </div>
            <div class="confirmation-text">${message}</div>
        `;
        
        // Añadir al contenedor
        messageContainer.appendChild(messageElement);
        
        // Mostrar con animación
        setTimeout(() => messageElement.classList.add('message-show'), 10);
        
        // Auto-ocultar después de un tiempo
        setTimeout(() => {
            messageElement.classList.remove('message-show');
            messageElement.classList.add('message-hide');
            
            // Remover después de la animación
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
                
                // Si no quedan mensajes, remover el contenedor
                if (messageContainer.children.length === 0) {
                    messageContainer.parentNode.removeChild(messageContainer);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Muestra estado vacío cuando no hay notificaciones
     * @param {HTMLElement} container - Contenedor de notificaciones
     */
    showEmptyState(container) {
        const emptyState = document.createElement('div');
        emptyState.className = 'empty-state';
        emptyState.innerHTML = `
            <div class="empty-icon">
                <i class="icon-bell"></i>
            </div>
            <h3 class="empty-title">No tienes notificaciones</h3>
            <p class="empty-description">Las nuevas notificaciones aparecerán aquí</p>
        `;
        
        container.appendChild(emptyState);
    }

    /**
     * Actualiza el contador de notificaciones no leídas
     */
    updateUnreadCount() {
        try {
            // Contar notificaciones no leídas
            const notifications = this.storageManager.get('notifications') || [];
            const unreadCount = notifications.filter(n => n.status === NotificationStatus.UNREAD).length;
            
            // Actualizar todos los contadores en la UI
            const counters = document.querySelectorAll('.notification-badge, .notification-count');
            counters.forEach(counter => {
                counter.textContent = unreadCount;
                counter.classList.toggle('hidden', unreadCount === 0);
            });
            
            // Actualizar título de la página si está configurado
            if (this.options.updatePageTitle && unreadCount > 0) {
                const originalTitle = document.title.replace(/^\(\d+\)\s/, '');
                document.title = `(${unreadCount}) ${originalTitle}`;
            } else if (this.options.updatePageTitle) {
                document.title = document.title.replace(/^\(\d+\)\s/, '');
            }
            
            // Emitir evento
            this.eventBus.publish('notifications:unreadCountUpdated', { count: unreadCount });
        } catch (error) {
            console.error('Error al actualizar contador de notificaciones:', error);
        }
    }

    /**
     * Carga notificaciones desde el servidor o almacenamiento
     * @param {Object} options - Opciones de carga
     * @returns {Promise<Array>} - Lista de notificaciones
     */
    async loadNotifications(options = {}) {
        const defaultOptions = {
            limit: 20,
            offset: 0,
            status: null, // null para todas, o un estado específico
            type: null, // null para todas, o un tipo específico
            forceRefresh: false
        };
        
        const fetchOptions = { ...defaultOptions, ...options };
        
        try {
            // Si no está autenticado, usar solo almacenamiento local
            if (!this.auth.isAuthenticated()) {
                return this.getNotificationsFromStorage(fetchOptions);
            }
            
            // Si offline o no se fuerza actualización, usar almacenamiento
            if (!navigator.onLine || !fetchOptions.forceRefresh) {
                return this.getNotificationsFromStorage(fetchOptions);
            }
            
            // Cargar desde servidor
            const userId = this.auth.getCurrentUser().id;
            const queryParams = new URLSearchParams();
            
            queryParams.append('limit', fetchOptions.limit);
            queryParams.append('offset', fetchOptions.offset);
            
            if (fetchOptions.status) {
                queryParams.append('status', fetchOptions.status);
            }
            
            if (fetchOptions.type) {
                queryParams.append('type', fetchOptions.type);
            }
            
            const response = await fetch(`/api/users/${userId}/notifications?${queryParams.toString()}`, {
                headers: {
                    'Authorization': `Bearer ${this.auth.getToken()}`
                }
            });
            
            if (!response.ok) {
                throw new Error(`Error cargando notificaciones: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Actualizar almacenamiento local
            this.syncNotificationsWithStorage(data.notifications);
            
            return data.notifications;
        } catch (error) {
            console.error('Error al cargar notificaciones:', error);
            
            // Fallback a almacenamiento local
            return this.getNotificationsFromStorage(fetchOptions);
        }
    }

    /**
     * Obtiene notificaciones del almacenamiento local
     * @param {Object} options - Opciones de filtrado
     * @returns {Array} - Lista de notificaciones filtradas
     */
    getNotificationsFromStorage(options) {
        try {
            let notifications = this.storageManager.get('notifications') || [];
            
            // Aplicar filtros
            if (options.status) {
                notifications = notifications.filter(n => n.status === options.status);
            }
            
            if (options.type) {
                notifications = notifications.filter(n => n.type === options.type);
            }
            
            // Ordenar por timestamp descendente
            notifications.sort((a, b) => b.timestamp - a.timestamp);
            
            // Aplicar paginación
            return notifications.slice(options.offset, options.offset + options.limit);
        } catch (error) {
            console.error('Error al obtener notificaciones del almacenamiento:', error);
            return [];
        }
    }

    /**
     * Sincroniza notificaciones del servidor con almacenamiento local
     * @param {Array} serverNotifications - Notificaciones del servidor
     */
    syncNotificationsWithStorage(serverNotifications) {
        try {
            let localNotifications = this.storageManager.get('notifications') || [];
            
            // Crear mapa de notificaciones locales por ID
            const localNotificationsMap = new Map(
                localNotifications.map(notification => [notification.id, notification])
            );
            
            // Actualizar o añadir notificaciones del servidor
            serverNotifications.forEach(serverNotification => {
                const localNotification = localNotificationsMap.get(serverNotification.id);
                
                if (localNotification) {
                    // Si existe localmente, actualizar si la versión del servidor es más reciente
                    if (!localNotification.updatedAt || serverNotification.updatedAt > localNotification.updatedAt) {
                        localNotificationsMap.set(serverNotification.id, {
                            ...localNotification,
                            ...serverNotification
                        });
                    }
                } else {
                    // Si no existe, añadir
                    localNotificationsMap.set(serverNotification.id, serverNotification);
                }
            });
            
            // Convertir mapa de vuelta a array
            const updatedNotifications = Array.from(localNotificationsMap.values());
            
            // Ordenar por timestamp descendente
            updatedNotifications.sort((a, b) => b.timestamp - a.timestamp);
            
            // Limitar cantidad
            const limitedNotifications = updatedNotifications.slice(0, this.options.maxStoredNotifications);
            
            // Guardar en almacenamiento
            this.storageManager.set('notifications', limitedNotifications);
            
            // Actualizar contador
            this.updateUnreadCount();
        } catch (error) {
            console.error('Error al sincronizar notificaciones:', error);
        }
    }

    /**
     * Marca todas las notificaciones como leídas
     */
    async markAllAsRead() {
        try {
            // Actualizar localmente
            let notifications = this.storageManager.get('notifications') || [];
            
            // Encontrar notificaciones no leídas
            const unreadNotifications = notifications.filter(n => n.status === NotificationStatus.UNREAD);
            
            // Si no hay notificaciones no leídas, salir
            if (unreadNotifications.length === 0) return;
            
            // Actualizar estado en todas las notificaciones
            notifications = notifications.map(notification => ({
                ...notification,
                status: NotificationStatus.READ
            }));
            
            // Guardar en almacenamiento
            this.storageManager.set('notifications', notifications);
            
            // Actualizar UI
            const container = document.querySelector(this.options.notificationsContainer);
            if (container) {
                const unreadElements = container.querySelectorAll('.notification-item.unread');
                unreadElements.forEach(element => {
                    this.updateNotificationStatusInUI(element.dataset.notificationId, NotificationStatus.READ);
                });
            }
            
            // Actualizar contador
            this.updateUnreadCount();
            
            // Actualizar en servidor si está autenticado
            if (this.auth.isAuthenticated() && navigator.onLine) {
                const userId = this.auth.getCurrentUser().id;
                
                await fetch(`/api/users/${userId}/notifications/read-all`, {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${this.auth.getToken()}`
                    }
                });
            }
            
            // Mostrar confirmación
            this.showConfirmationMessage('Todas las notificaciones marcadas como leídas');
        } catch (error) {
            console.error('Error al marcar todas las notificaciones como leídas:', error);
        }
    }

    /**
     * Obtiene el icono correspondiente a un tipo de notificación
     * @param {string} type - Tipo de notificación
     * @returns {string} - Nombre del icono
     */
    getIconForType(type) {
        switch (type) {
            case NotificationType.PRICE_ALERT:
                return 'bell';
            case NotificationType.NEWS:
                return 'globe';
            case NotificationType.SYSTEM:
                return 'info';
            case NotificationType.SOCIAL:
                return 'users';
            case NotificationType.PORTFOLIO:
                return 'briefcase';
            case NotificationType.SECURITY:
                return 'shield';
            default:
                return 'bell';
        }
    }

    /**
     * Formatea un timestamp para mostrar tiempo relativo
     * @param {number} timestamp - Timestamp en milisegundos
     * @returns {string} - Texto formateado
     */
    formatTimestamp(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        // Menos de 1 minuto
        if (diff < 60 * 1000) {
            return 'Ahora mismo';
        }
        
        // Menos de 1 hora
        if (diff < 60 * 60 * 1000) {
            const minutes = Math.floor(diff / (60 * 1000));
            return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
        }
        
        // Menos de 1 día
        if (diff < 24 * 60 * 60 * 1000) {
            const hours = Math.floor(diff / (60 * 60 * 1000));
            return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
        }
        
        // Menos de 1 semana
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            const days = Math.floor(diff / (24 * 60 * 60 * 1000));
            return `Hace ${days} ${days === 1 ? 'día' : 'días'}`;
        }
        
        // Fecha completa para tiempos mayores
        const date = new Date(timestamp);
        return date.toLocaleDateString();
    }

    /**
     * Crea y envía una nueva notificación
     * @param {Object} notificationData - Datos de la notificación
     * @returns {Promise<Object>} - Notificación creada
     */
    async createNotification(notificationData) {
        // Valores por defecto
        const defaults = {
            id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            status: NotificationStatus.UNREAD,
            priority: NotificationPriority.MEDIUM,
            showToast: true
        };
        
        // Combinar con datos proporcionados
        const notification = {
            ...defaults,
            ...notificationData
        };
        
        // Verificar campos requeridos
        if (!notification.title) {
            throw new Error('El título de la notificación es obligatorio');
        }
        
        if (!notification.type || !Object.values(NotificationType).includes(notification.type)) {
            throw new Error('Tipo de notificación inválido');
        }
        
        // Procesar y mostrar notificación
        this.processRemoteNotification(notification);
        
        // Si está autenticado, enviar al servidor
        if (this.auth.isAuthenticated()) {
            return this.sendNotificationToServer(notification);
        }
        
        return notification;
    }

    /**
     * Actualiza las preferencias de notificación del usuario
     * @param {Object} preferences - Nuevas preferencias
     */
    async updatePreferences(preferences) {
        try {
            // Actualizar localmente
            this.userPreferences = {
                ...this.userPreferences,
                ...preferences
            };
            
            // Guardar en almacenamiento local
            this.storageManager.set('notification_preferences', this.userPreferences);
            
            // Actualizar en servidor si está autenticado
            if (this.auth.isAuthenticated() && navigator.onLine) {
                const userId = this.auth.getCurrentUser().id;
                
                await fetch(`/api/users/${userId}/notification-preferences`, {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${this.auth.getToken()}`
                    },
                    body: JSON.stringify(this.userPreferences)
                });
            }
            
            // Mostrar confirmación
            this.showConfirmationMessage('Preferencias de notificación actualizadas');
            
            // Emitir evento
            this.eventBus.publish('notifications:preferencesUpdated', { 
                preferences: this.userPreferences 
            });
            
            return this.userPreferences;
        } catch (error) {
            console.error('Error al actualizar preferencias de notificación:', error);
            throw error;
        }
    }

    /**
     * Limpia notificaciones antiguas o elimina todas
     * @param {Object} options - Opciones de limpieza
     */
    clearNotifications(options = {}) {
        const defaultOptions = {
            olderThan: null, // timestamp en ms, null para todas
            status: null, // null para todas, o un estado específico
            type: null // null para todas, o un tipo específico
        };
        
        const clearOptions = { ...defaultOptions, ...options };
        
        try {
            let notifications = this.storageManager.get('notifications') || [];
            let notificationsToKeep = [...notifications];
            
            // Aplicar filtros
            if (clearOptions.olderThan) {
                notificationsToKeep = notificationsToKeep.filter(
                    n => n.timestamp >= clearOptions.olderThan
                );
            }
            
            if (clearOptions.status) {
                notificationsToKeep = notificationsToKeep.filter(
                    n => n.status !== clearOptions.status
                );
            }
            
            if (clearOptions.type) {
                notificationsToKeep = notificationsToKeep.filter(
                    n => n.type !== clearOptions.type
                );
            }
            
            // Si no se aplicó ningún filtro, eliminar todas
            if (
                !clearOptions.olderThan && 
                !clearOptions.status && 
                !clearOptions.type
            ) {
                notificationsToKeep = [];
            }
            
            // Guardar notificaciones restantes
            this.storageManager.set('notifications', notificationsToKeep);
            
            // Actualizar UI
            const container = document.querySelector(this.options.notificationsContainer);
            if (container) {
                // Si se eliminaron todas, mostrar estado vacío
                if (notificationsToKeep.length === 0) {
                    container.innerHTML = '';
                    this.showEmptyState(container);
                } else {
                    // Eliminar solo las notificaciones filtradas
                    const notificationsToKeepIds = new Set(notificationsToKeep.map(n => n.id));
                    
                    const notificationElements = container.querySelectorAll('.notification-item');
                    notificationElements.forEach(element => {
                        const id = element.dataset.notificationId;
                        if (!notificationsToKeepIds.has(id)) {
                            // Añadir animación de salida
                            element.classList.add('notification-hide');
                            
                            // Eliminar después de la animación
                            setTimeout(() => element.remove(), 300);
                        }
                    });
                }
            }
            
            // Actualizar contador
            this.updateUnreadCount();
            
            // Notificar si se eliminaron todas
            if (notificationsToKeep.length === 0) {
                this.showConfirmationMessage('Todas las notificaciones han sido eliminadas');
            } else {
                this.showConfirmationMessage('Notificaciones seleccionadas eliminadas');
            }
            
            // Si está autenticado, sincronizar con servidor
            if (this.auth.isAuthenticated() && navigator.onLine) {
                this.syncClearWithServer(clearOptions);
            }
        } catch (error) {
            console.error('Error al limpiar notificaciones:', error);
        }
    }

    /**
     * Sincroniza eliminación de notificaciones con el servidor
     * @param {Object} clearOptions - Opciones de limpieza
     */
    async syncClearWithServer(clearOptions) {
        try {
            const userId = this.auth.getCurrentUser().id;
            
            await fetch(`/api/users/${userId}/notifications/clear`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.auth.getToken()}`
                },
                body: JSON.stringify(clearOptions)
            });
        } catch (error) {
            console.error('Error al sincronizar limpieza con servidor:', error);
        }
    }

    /**
     * Obtiene todas las notificaciones actuales
     * @returns {Array} - Lista de notificaciones
     */
    getAllNotifications() {
        return this.storageManager.get('notifications') || [];
    }

    /**
     * Obtiene las preferencias actuales de notificación
     * @returns {Object} - Preferencias de notificación
     */
    getPreferences() {
        return { ...this.userPreferences };
    }
}

// Exportar instancia singleton para uso en la aplicación
export const notificationService = new NotificationService();
