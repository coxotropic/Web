/**
 * event-bus.js
 * Sistema de eventos para la comunicación entre componentes del portal de criptomonedas.
 * Implementa un patrón pub/sub (publicación/suscripción) para permitir que los componentes
 * se comuniquen entre sí sin acoplamiento directo.
 * 
 * @module EventBus
 * @author CryptoInvest Team
 */

/**
 * Clase EventBus - Sistema central de gestión de eventos
 */
class EventBus {
    /**
     * Crea una nueva instancia del bus de eventos
     * @param {Object} options - Opciones de configuración
     * @param {boolean} [options.debug=false] - Activar modo de depuración
     * @param {boolean} [options.asyncByDefault=false] - Usar eventos asíncronos por defecto
     */
    constructor(options = {}) {
        this.options = {
            debug: false,
            asyncByDefault: false,
            ...options
        };
        
        // Mapa para almacenar las suscripciones organizadas por evento
        this.subscriptions = new Map();
        
        // Contador para IDs únicos de suscripción
        this.subscriptionIdCounter = 0;
        
        // Registro de eventos para depuración
        this.eventLog = [];
        this.maxLogSize = 100;
        
        // Estado actual del bus
        this.isPaused = false;
        
        // Cola de eventos cuando el bus está en pausa
        this.eventQueue = [];
        
        // Enlazar métodos al contexto actual para permitir desestructuración
        this.subscribe = this.subscribe.bind(this);
        this.publish = this.publish.bind(this);
        this.unsubscribe = this.unsubscribe.bind(this);
        this.pause = this.pause.bind(this);
        this.resume = this.resume.bind(this);
        this.clear = this.clear.bind(this);
    }
    
    /**
     * Analiza un nombre de evento para extraer namespace y evento base
     * @private
     * @param {string} eventName - Nombre del evento (posiblemente con namespace)
     * @returns {Object} Objeto con namespace y eventBase
     */
    _parseEventName(eventName) {
        const parts = eventName.split('.');
        const eventBase = parts[0];
        const namespace = parts.length > 1 ? parts.slice(1).join('.') : null;
        
        return { eventBase, namespace };
    }
    
    /**
     * Verifica si una suscripción coincide con un evento (considerando namespaces)
     * @private
     * @param {Object} subscription - Objeto de suscripción
     * @param {string} eventName - Nombre del evento a comprobar
     * @returns {boolean} True si coincide, false en caso contrario
     */
    _doesSubscriptionMatch(subscription, eventName) {
        const { eventBase, namespace } = this._parseEventName(eventName);
        const { eventBase: subEventBase, namespace: subNamespace } = this._parseEventName(subscription.event);
        
        // El evento base debe coincidir siempre
        if (subEventBase !== eventBase && subEventBase !== '*') {
            return false;
        }
        
        // Si la suscripción tiene un namespace, el evento debe tener el mismo namespace
        if (subNamespace && namespace) {
            return subNamespace === namespace;
        }
        
        // Si la suscripción no tiene namespace, aceptamos eventos con o sin namespace
        return true;
    }
    
    /**
     * Registra un evento en el log para depuración
     * @private
     * @param {string} type - Tipo de entrada de log ('subscribe', 'publish', 'unsubscribe')
     * @param {string} event - Nombre del evento
     * @param {*} data - Datos asociados al evento
     */
    _logEvent(type, event, data = null) {
        if (!this.options.debug) return;
        
        const logEntry = {
            type,
            event,
            data,
            timestamp: new Date()
        };
        
        console.log(`EventBus [${type}] ${event}`, data);
        
        this.eventLog.unshift(logEntry);
        
        // Mantener el log en un tamaño manejable
        if (this.eventLog.length > this.maxLogSize) {
            this.eventLog.pop();
        }
    }
    
    /**
     * Suscribe una función callback a un evento
     * @param {string} event - Nombre del evento (puede incluir namespace con formato 'evento.namespace')
     * @param {Function} callback - Función a ejecutar cuando se publique el evento
     * @param {Object} [options={}] - Opciones adicionales para la suscripción
     * @param {number} [options.priority=0] - Prioridad de la suscripción (mayor número = mayor prioridad)
     * @param {boolean} [options.once=false] - Si es true, la suscripción se eliminará después de la primera ejecución
     * @param {boolean} [options.async=null] - Si es true, el callback se ejecutará de forma asíncrona
     * @returns {string} ID único de la suscripción (necesario para cancelar la suscripción)
     */
    subscribe(event, callback, options = {}) {
        if (typeof event !== 'string' || !event) {
            throw new Error('EventBus: El evento debe ser una cadena no vacía');
        }
        
        if (typeof callback !== 'function') {
            throw new Error('EventBus: El callback debe ser una función');
        }
        
        const subscriptionOptions = {
            priority: 0,
            once: false,
            async: this.options.asyncByDefault,
            ...options
        };
        
        const { eventBase, namespace } = this._parseEventName(event);
        
        // Crear un ID único para esta suscripción
        const id = `sub_${++this.subscriptionIdCounter}`;
        
        const subscription = {
            id,
            event,
            eventBase,
            namespace,
            callback,
            ...subscriptionOptions
        };
        
        // Inicializar el array de suscripciones para este evento si no existe
        if (!this.subscriptions.has(eventBase)) {
            this.subscriptions.set(eventBase, []);
        }
        
        const subs = this.subscriptions.get(eventBase);
        
        // Insertar la suscripción manteniendo el orden de prioridad (mayor primero)
        let insertIndex = subs.findIndex(sub => sub.priority < subscription.priority);
        if (insertIndex === -1) {
            insertIndex = subs.length;
        }
        
        subs.splice(insertIndex, 0, subscription);
        
        this._logEvent('subscribe', event, { id, priority: subscriptionOptions.priority });
        
        return id;
    }
    
    /**
     * Publica un evento, ejecutando todas las funciones suscritas
     * @param {string} event - Nombre del evento a publicar
     * @param {*} [data=null] - Datos a pasar a los callbacks suscritos
     * @param {Object} [options={}] - Opciones adicionales para la publicación
     * @param {boolean} [options.async=null] - Si es true, fuerza ejecución asíncrona; si es false, fuerza síncrona
     * @param {boolean} [options.cancelable=true] - Si el evento puede ser cancelado por los suscriptores
     * @returns {Promise<boolean>} Promesa que se resuelve a true si el evento fue procesado, false si fue cancelado
     */
    async publish(event, data = null, options = {}) {
        if (typeof event !== 'string' || !event) {
            throw new Error('EventBus: El evento debe ser una cadena no vacía');
        }
        
        const publishOptions = {
            async: this.options.asyncByDefault,
            cancelable: true,
            ...options
        };
        
        this._logEvent('publish', event, data);
        
        // Si el bus está en pausa, encolar el evento para procesarlo después
        if (this.isPaused) {
            this.eventQueue.push({ event, data, options: publishOptions });
            return true;
        }
        
        const { eventBase } = this._parseEventName(event);
        
        // Crear el objeto de evento que se pasará a los callbacks
        const eventObject = {
            type: event,
            data,
            timestamp: new Date(),
            defaultPrevented: false,
            preventDefault: function() {
                if (publishOptions.cancelable) {
                    this.defaultPrevented = true;
                }
            }
        };
        
        // Recolectar todas las suscripciones que coinciden con este evento
        const matchedSubscriptions = [];
        
        // Comprobar suscripciones específicas para este evento
        if (this.subscriptions.has(eventBase)) {
            this.subscriptions.get(eventBase).forEach(subscription => {
                if (this._doesSubscriptionMatch(subscription, event)) {
                    matchedSubscriptions.push(subscription);
                }
            });
        }
        
        // Comprobar suscripciones globales (evento = '*')
        if (this.subscriptions.has('*')) {
            this.subscriptions.get('*').forEach(subscription => {
                matchedSubscriptions.push(subscription);
            });
        }
        
        // Procesamos suscripciones "once" que habrá que eliminar después
        const onceSubs = new Set();
        
        // Ejecutar los callbacks (de forma síncrona o asíncrona según las opciones)
        for (const subscription of matchedSubscriptions) {
            try {
                const isAsync = subscription.async !== null ? subscription.async : publishOptions.async;
                
                if (isAsync) {
                    // Ejecución asíncrona
                    setTimeout(() => {
                        subscription.callback(eventObject);
                        
                        // Marcar para eliminación si es una suscripción "once"
                        if (subscription.once) {
                            onceSubs.add(subscription.id);
                        }
                    }, 0);
                } else {
                    // Ejecución síncrona
                    subscription.callback(eventObject);
                    
                    // Marcar para eliminación si es una suscripción "once"
                    if (subscription.once) {
                        onceSubs.add(subscription.id);
                    }
                    
                    // Si el evento es cancelable y ha sido cancelado, detener la propagación
                    if (publishOptions.cancelable && eventObject.defaultPrevented) {
                        break;
                    }
                }
            } catch (error) {
                console.error(`Error al ejecutar callback para evento "${event}":`, error);
            }
        }
        
        // Eliminar suscripciones "once"
        if (onceSubs.size > 0) {
            onceSubs.forEach(id => this.unsubscribe(id));
        }
        
        return !eventObject.defaultPrevented;
    }
    
    /**
     * Cancela una suscripción existente
     * @param {string} subscriptionId - ID de la suscripción a cancelar
     * @returns {boolean} true si se canceló correctamente, false si no se encontró la suscripción
     */
    unsubscribe(subscriptionId) {
        let found = false;
        let eventName = '';
        
        // Buscar y eliminar la suscripción en todos los eventos
        for (const [eventBase, subs] of this.subscriptions.entries()) {
            const index = subs.findIndex(sub => sub.id === subscriptionId);
            
            if (index !== -1) {
                eventName = subs[index].event;
                subs.splice(index, 1);
                found = true;
                
                // Si no quedan suscripciones para este evento, eliminar la entrada
                if (subs.length === 0) {
                    this.subscriptions.delete(eventBase);
                }
                
                break;
            }
        }
        
        if (found) {
            this._logEvent('unsubscribe', eventName, { id: subscriptionId });
        }
        
        return found;
    }
    
    /**
     * Cancela todas las suscripciones que coinciden con un patrón de evento
     * @param {string} eventPattern - Patrón de evento (puede incluir namespace)
     * @returns {number} Número de suscripciones canceladas
     */
    unsubscribeAll(eventPattern) {
        let count = 0;
        const { eventBase, namespace } = this._parseEventName(eventPattern);
        
        // Si hay un eventBase específico y existe en las suscripciones
        if (eventBase !== '*' && this.subscriptions.has(eventBase)) {
            const subs = this.subscriptions.get(eventBase);
            
            // Si hay un namespace, filtramos por él
            if (namespace) {
                const initialLength = subs.length;
                const remainingSubs = subs.filter(sub => sub.namespace !== namespace);
                count = initialLength - remainingSubs.length;
                
                if (remainingSubs.length > 0) {
                    this.subscriptions.set(eventBase, remainingSubs);
                } else {
                    this.subscriptions.delete(eventBase);
                }
            } else {
                // Sin namespace, eliminar todas las suscripciones de este evento
                count = subs.length;
                this.subscriptions.delete(eventBase);
            }
        } 
        // Si eventBase es '*', eliminar todas las suscripciones o filtrar por namespace
        else if (eventBase === '*') {
            if (namespace) {
                // Eliminar todas las suscripciones con el namespace dado
                for (const [eventBase, subs] of this.subscriptions.entries()) {
                    const initialLength = subs.length;
                    const remainingSubs = subs.filter(sub => sub.namespace !== namespace);
                    count += initialLength - remainingSubs.length;
                    
                    if (remainingSubs.length > 0) {
                        this.subscriptions.set(eventBase, remainingSubs);
                    } else {
                        this.subscriptions.delete(eventBase);
                    }
                }
            } else {
                // Eliminar todas las suscripciones
                for (const [, subs] of this.subscriptions.entries()) {
                    count += subs.length;
                }
                this.subscriptions.clear();
            }
        }
        
        this._logEvent('unsubscribeAll', eventPattern, { count });
        
        return count;
    }
    
    /**
     * Pausa el bus de eventos, encolando los eventos publicados hasta llamar a resume()
     */
    pause() {
        this.isPaused = true;
        this._logEvent('pause', 'EventBus paused');
    }
    
    /**
     * Reanuda el bus de eventos, procesando los eventos encolados durante la pausa
     * @param {boolean} [processQueue=true] - Si es true, procesa la cola de eventos; si es false, descarta la cola
     */
    resume(processQueue = true) {
        this.isPaused = false;
        this._logEvent('resume', 'EventBus resumed', { queueSize: this.eventQueue.length, processQueue });
        
        if (processQueue && this.eventQueue.length > 0) {
            // Crear una copia de la cola y limpiarla para evitar recursión infinita
            const queueCopy = [...this.eventQueue];
            this.eventQueue = [];
            
            // Procesar los eventos encolados
            queueCopy.forEach(async ({ event, data, options }) => {
                await this.publish(event, data, options);
            });
        } else {
            // Limpiar la cola sin procesar los eventos
            this.eventQueue = [];
        }
    }
    
    /**
     * Elimina todas las suscripciones y limpia el registro de eventos
     */
    clear() {
        this.subscriptions.clear();
        this.eventLog = [];
        this.subscriptionIdCounter = 0;
        this.eventQueue = [];
        this._logEvent('clear', 'EventBus cleared');
    }
    
    /**
     * Obtiene el registro de eventos (solo en modo debug)
     * @returns {Array} Registro de eventos o array vacío si no está en modo debug
     */
    getEventLog() {
        return this.options.debug ? [...this.eventLog] : [];
    }
    
    /**
     * Activa o desactiva el modo debug
     * @param {boolean} enabled - Si es true, activa el modo debug; si es false, lo desactiva
     */
    setDebug(enabled) {
        this.options.debug = !!enabled;
    }
    
    /**
     * Obtiene estadísticas sobre el estado actual del bus de eventos
     * @returns {Object} Objeto con estadísticas
     */
    getStats() {
        const totalSubscriptions = Array.from(this.subscriptions.values())
            .reduce((total, subs) => total + subs.length, 0);
            
        const eventCount = this.subscriptions.size;
        
        return {
            totalSubscriptions,
            eventCount,
            isPaused: this.isPaused,
            queuedEvents: this.eventQueue.length,
            loggedEvents: this.eventLog.length
        };
    }
}

/**
 * EventBusError - Clase de error específica para el bus de eventos
 * @extends Error
 */
class EventBusError extends Error {
    /**
     * Crea una nueva instancia de EventBusError
     * @param {string} message - Mensaje de error
     * @param {Object} [data={}] - Datos adicionales sobre el error
     */
    constructor(message, data = {}) {
        super(message);
        this.name = 'EventBusError';
        this.data = data;
    }
}

// Crear instancia global para toda la aplicación
const eventBus = new EventBus({ debug: false });

// Exportar la clase, la instancia global y la clase de error
export { EventBus, eventBus as default, EventBusError };
