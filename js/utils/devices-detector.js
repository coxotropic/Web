/**
 * device-detector.js
 * Módulo para detectar y adaptar la interfaz al dispositivo del usuario en el portal de criptomonedas.
 * 
 * Este módulo proporciona funcionalidades para:
 * - Detectar el tipo de dispositivo (móvil, tablet, desktop)
 * - Detectar orientación de pantalla
 * - Identificar características del navegador
 * - Gestionar puntos de ruptura responsivos
 * - Cargar recursos específicos según dispositivo
 * - Notificar cambios de tamaño o rotación
 * - Detectar características avanzadas (WebGL, PWA, notificaciones)
 */

/**
 * Clase principal para la detección de dispositivos y características del navegador
 */
export class DeviceDetector {
    /**
     * Constructor que inicializa las propiedades del detector
     */
    constructor() {
        // Puntos de ruptura responsivos (en píxeles)
        this.breakpoints = {
            mobile: 480,
            tablet: 768,
            desktop: 1024,
            largeDesktop: 1440
        };

        // Información del dispositivo actual
        this.currentDevice = {
            type: null,       // 'mobile', 'tablet', 'desktop'
            orientation: null, // 'portrait', 'landscape'
            breakpoint: null,  // Punto de ruptura actual
            pixelRatio: window.devicePixelRatio || 1,
            touchEnabled: false,
            pointerEnabled: false
        };

        // Capacidades del navegador
        this.browserCapabilities = {
            webGL: false,
            webP: false,
            notifications: false,
            pwa: false,
            offline: false,
            localStorage: false,
            sessionStorage: false,
            serviceWorker: false
        };

        // Inicializar el detector
        this.init();
    }

    /**
     * Inicializa el detector y configura los event listeners
     */
    init() {
        // Detectar características iniciales
        this.detectDeviceType();
        this.detectOrientation();
        this.detectBrowserCapabilities();
        this.detectTouchCapabilities();

        // Configurar listeners para cambios de pantalla
        this.setupEventListeners();

        // Log de inicialización completada
        console.log('DeviceDetector: Inicializado', {
            device: this.currentDevice,
            capabilities: this.browserCapabilities
        });
    }

    /**
     * Configura listeners para eventos de cambio de pantalla
     */
    setupEventListeners() {
        // Listener para cambios de tamaño de ventana
        window.addEventListener('resize', this.handleResize.bind(this));

        // Listener para cambios de orientación
        window.addEventListener('orientationchange', this.handleOrientationChange.bind(this));

        // Listener para cambios de conexión
        if ('connection' in navigator) {
            navigator.connection.addEventListener('change', this.handleConnectionChange.bind(this));
        }
    }

    /**
     * Maneja el evento de cambio de tamaño de ventana
     * @param {Event} event - Evento de resize
     */
    handleResize(event) {
        // Actualizar información del dispositivo
        this.detectDeviceType();
        this.detectOrientation();

        // Notificar sobre el cambio
        this.notifyViewportChange();
    }

    /**
     * Maneja el evento de cambio de orientación
     * @param {Event} event - Evento de orientationchange
     */
    handleOrientationChange(event) {
        // Actualizar orientación
        this.detectOrientation();

        // Notificar sobre el cambio
        this.notifyOrientationChange();
    }

    /**
     * Maneja el evento de cambio de conexión
     * @param {Event} event - Evento de change en connection
     */
    handleConnectionChange(event) {
        // Actualizar información de conexión
        this.detectNetworkInfo();

        // Notificar sobre el cambio
        this.notifyConnectionChange();
    }

    /**
     * Detecta el tipo de dispositivo basado en el tamaño de pantalla y user agent
     * @returns {string} Tipo de dispositivo ('mobile', 'tablet', 'desktop')
     */
    detectDeviceType() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        const userAgent = navigator.userAgent;
        
        // Variable para almacenar el tipo de dispositivo detectado
        let deviceType;

        // Primero detectamos por user agent para tablets específicas
        const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/.test(userAgent.toLowerCase());
        
        if (isTablet) {
            deviceType = 'tablet';
        } 
        // Detectar móviles por user agent
        else if (/(android|iphone|ipod|mobile|iemobile|opera mini|blackberry)/.test(userAgent.toLowerCase())) {
            deviceType = 'mobile';
        } 
        // Detectar por tamaño de pantalla como respaldo
        else if (width <= this.breakpoints.mobile) {
            deviceType = 'mobile';
        } else if (width <= this.breakpoints.tablet) {
            deviceType = 'tablet';
        } else {
            deviceType = 'desktop';
        }

        // Determinar el breakpoint actual
        let currentBreakpoint;
        if (width <= this.breakpoints.mobile) {
            currentBreakpoint = 'mobile';
        } else if (width <= this.breakpoints.tablet) {
            currentBreakpoint = 'tablet';
        } else if (width <= this.breakpoints.desktop) {
            currentBreakpoint = 'desktop';
        } else {
            currentBreakpoint = 'largeDesktop';
        }

        // Actualizar la información del dispositivo
        this.currentDevice.type = deviceType;
        this.currentDevice.breakpoint = currentBreakpoint;

        return deviceType;
    }

    /**
     * Detecta la orientación de la pantalla
     * @returns {string} Orientación ('portrait', 'landscape')
     */
    detectOrientation() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        // Determinar orientación basada en relación de aspecto
        const orientation = width >= height ? 'landscape' : 'portrait';
        
        // Actualizar la información de orientación
        this.currentDevice.orientation = orientation;
        
        return orientation;
    }

    /**
     * Detecta capacidades táctiles del dispositivo
     */
    detectTouchCapabilities() {
        // Detectar si el dispositivo tiene capacidades táctiles
        this.currentDevice.touchEnabled = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (navigator.msMaxTouchPoints > 0);
        
        // Detectar si soporta Pointer Events
        this.currentDevice.pointerEnabled = 'PointerEvent' in window;
    }

    /**
     * Detecta y actualiza las capacidades del navegador
     */
    detectBrowserCapabilities() {
        // Detectar soporte para WebGL
        this.detectWebGLSupport();
        
        // Detectar soporte para WebP
        this.detectWebPSupport();
        
        // Detectar soporte para notificaciones
        this.detectNotificationSupport();
        
        // Detectar capacidades PWA
        this.detectPWASupport();
        
        // Detectar soporte para almacenamiento
        this.detectStorageSupport();
        
        // Detectar información de red
        this.detectNetworkInfo();
    }

    /**
     * Detecta soporte para WebGL
     * @returns {boolean} True si WebGL es soportado
     */
    detectWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            this.browserCapabilities.webGL = !!(gl && gl instanceof WebGLRenderingContext);
        } catch (e) {
            this.browserCapabilities.webGL = false;
        }
        return this.browserCapabilities.webGL;
    }

    /**
     * Detecta soporte para formato de imagen WebP
     */
    detectWebPSupport() {
        const img = new Image();
        img.onload = () => {
            this.browserCapabilities.webP = img.width === 1;
            this.notifyCapabilityChange('webP', img.width === 1);
        };
        img.onerror = () => {
            this.browserCapabilities.webP = false;
            this.notifyCapabilityChange('webP', false);
        };
        img.src = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=';
    }

    /**
     * Detecta soporte para notificaciones del navegador
     * @returns {boolean} True si las notificaciones son soportadas
     */
    detectNotificationSupport() {
        this.browserCapabilities.notifications = 'Notification' in window;
        return this.browserCapabilities.notifications;
    }

    /**
     * Detecta soporte para características de PWA
     */
    detectPWASupport() {
        // Detectar si serviceWorker está soportado
        this.browserCapabilities.serviceWorker = 'serviceWorker' in navigator;
        
        // Detectar si el sitio se puede instalar como PWA
        this.browserCapabilities.pwa = window.matchMedia('(display-mode: standalone)').matches || 
                                       ('standalone' in navigator && navigator.standalone);
        
        // Detectar soporte para características offline
        this.browserCapabilities.offline = 'caches' in window;
    }

    /**
     * Detecta soporte para almacenamiento local y de sesión
     */
    detectStorageSupport() {
        try {
            localStorage.setItem('test', 'test');
            localStorage.removeItem('test');
            this.browserCapabilities.localStorage = true;
        } catch(e) {
            this.browserCapabilities.localStorage = false;
        }
        
        try {
            sessionStorage.setItem('test', 'test');
            sessionStorage.removeItem('test');
            this.browserCapabilities.sessionStorage = true;
        } catch(e) {
            this.browserCapabilities.sessionStorage = false;
        }
    }

    /**
     * Detecta información de la conexión de red
     */
    detectNetworkInfo() {
        if ('connection' in navigator) {
            const connection = navigator.connection;
            this.networkInfo = {
                online: navigator.onLine,
                type: connection.type,
                effectiveType: connection.effectiveType,
                downlinkMax: connection.downlinkMax,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            };
        } else {
            this.networkInfo = {
                online: navigator.onLine,
                type: 'unknown',
                effectiveType: 'unknown'
            };
        }
    }

    /**
     * Notifica cambios en el viewport
     */
    notifyViewportChange() {
        // Crear un evento personalizado con los datos actualizados
        const event = new CustomEvent('viewportChange', {
            detail: {
                device: this.currentDevice,
                width: window.innerWidth,
                height: window.innerHeight
            }
        });
        
        // Disparar el evento
        document.dispatchEvent(event);
    }

    /**
     * Notifica cambios en la orientación
     */
    notifyOrientationChange() {
        // Crear un evento personalizado con los datos de orientación
        const event = new CustomEvent('orientationChange', {
            detail: {
                orientation: this.currentDevice.orientation
            }
        });
        
        // Disparar el evento
        document.dispatchEvent(event);
    }

    /**
     * Notifica cambios en la conexión
     */
    notifyConnectionChange() {
        // Crear un evento personalizado con los datos de conexión
        const event = new CustomEvent('connectionChange', {
            detail: this.networkInfo
        });
        
        // Disparar el evento
        document.dispatchEvent(event);
    }

    /**
     * Notifica cambios en las capacidades detectadas
     * @param {string} capability - La capacidad que cambió
     * @param {any} value - El nuevo valor de la capacidad
     */
    notifyCapabilityChange(capability, value) {
        // Crear un evento personalizado con los datos de capacidad
        const event = new CustomEvent('capabilityChange', {
            detail: {
                capability: capability,
                value: value
            }
        });
        
        // Disparar el evento
        document.dispatchEvent(event);
    }

    /**
     * Devuelve el tipo de dispositivo actual
     * @returns {string} Tipo de dispositivo ('mobile', 'tablet', 'desktop')
     */
    getDeviceType() {
        return this.currentDevice.type;
    }

    /**
     * Devuelve la orientación actual
     * @returns {string} Orientación ('portrait', 'landscape')
     */
    getOrientation() {
        return this.currentDevice.orientation;
    }

    /**
     * Comprueba si el dispositivo actual es móvil
     * @returns {boolean} True si es móvil
     */
    isMobile() {
        return this.currentDevice.type === 'mobile';
    }

    /**
     * Comprueba si el dispositivo actual es tablet
     * @returns {boolean} True si es tablet
     */
    isTablet() {
        return this.currentDevice.type === 'tablet';
    }

    /**
     * Comprueba si el dispositivo actual es desktop
     * @returns {boolean} True si es desktop
     */
    isDesktop() {
        return this.currentDevice.type === 'desktop';
    }

    /**
     * Comprueba si el dispositivo actual tiene pantalla táctil
     * @returns {boolean} True si tiene pantalla táctil
     */
    isTouchDevice() {
        return this.currentDevice.touchEnabled;
    }

    /**
     * Comprueba si el navegador soporta una característica específica
     * @param {string} capability - Nombre de la capacidad a verificar
     * @returns {boolean} True si la característica es soportada
     */
    supportsCapability(capability) {
        return !!this.browserCapabilities[capability];
    }

    /**
     * Carga recursos específicos para el tipo de dispositivo
     * @param {Object} resources - Objeto con recursos por tipo de dispositivo
     * @returns {Array} Array con los recursos para el dispositivo actual
     */
    loadDeviceSpecificResources(resources) {
        // Verificar que se proporciona un objeto de recursos válido
        if (!resources || typeof resources !== 'object') {
            console.error('DeviceDetector: El parámetro resources debe ser un objeto válido');
            return [];
        }
        
        // Obtener el tipo de dispositivo actual
        const deviceType = this.getDeviceType();
        
        // Recursos específicos para el dispositivo actual
        const deviceResources = resources[deviceType] || [];
        
        // Recursos comunes para todos los dispositivos
        const commonResources = resources.common || [];
        
        // Combinar recursos específicos y comunes
        return [...deviceResources, ...commonResources];
    }

    /**
     * Optimiza elementos de la interfaz según el dispositivo
     * @param {Object} options - Opciones de optimización
     */
    optimizeForDevice(options = {}) {
        const deviceType = this.getDeviceType();
        const isTouch = this.isTouchDevice();
        
        // Aplicar optimizaciones según el tipo de dispositivo
        if (deviceType === 'mobile') {
            // Optimizaciones para móvil
            this.applyMobileOptimizations(options);
        } else if (deviceType === 'tablet') {
            // Optimizaciones para tablet
            this.applyTabletOptimizations(options);
        } else {
            // Optimizaciones para desktop
            this.applyDesktopOptimizations(options);
        }
        
        // Optimizaciones para dispositivos táctiles
        if (isTouch) {
            this.applyTouchOptimizations(options);
        }
        
        // Optimizaciones según la conexión
        this.applyConnectionOptimizations(options);
    }
    
    /**
     * Aplica optimizaciones específicas para dispositivos móviles
     * @param {Object} options - Opciones de optimización
     */
    applyMobileOptimizations(options) {
        // Ejemplo: Simplificar la interfaz, reducir elementos, etc.
        if (options.simplifyUI) {
            document.body.classList.add('mobile-optimized');
        }
        
        // Ejemplo: Ajustar el tamaño de fuente
        if (options.adjustFontSize) {
            document.documentElement.style.fontSize = '14px';
        }
        
        // Ejemplo: Ocultar elementos no esenciales
        if (options.hideNonEssential) {
            const nonEssentialElements = document.querySelectorAll('.non-essential');
            nonEssentialElements.forEach(el => el.classList.add('hidden-mobile'));
        }
    }
    
    /**
     * Aplica optimizaciones específicas para tablets
     * @param {Object} options - Opciones de optimización
     */
    applyTabletOptimizations(options) {
        // Similar a las optimizaciones móviles pero específicas para tablet
        document.body.classList.add('tablet-optimized');
    }
    
    /**
     * Aplica optimizaciones específicas para escritorio
     * @param {Object} options - Opciones de optimización
     */
    applyDesktopOptimizations(options) {
        // Optimizaciones para escritorio
        document.body.classList.add('desktop-optimized');
        
        // Ejemplo: Habilitar funciones avanzadas solo en desktop
        if (options.enableAdvancedFeatures) {
            document.body.classList.add('advanced-features-enabled');
        }
    }
    
    /**
     * Aplica optimizaciones para dispositivos táctiles
     * @param {Object} options - Opciones de optimización
     */
    applyTouchOptimizations(options) {
        // Añadir clase para interfaces táctiles
        document.body.classList.add('touch-optimized');
        
        // Ejemplo: Aumentar tamaño de elementos interactivos
        if (options.largerTouchTargets) {
            document.querySelectorAll('.interactive-element').forEach(el => {
                el.classList.add('touch-target');
            });
        }
    }
    
    /**
     * Aplica optimizaciones según la calidad de la conexión
     * @param {Object} options - Opciones de optimización
     */
    applyConnectionOptimizations(options) {
        if (!this.networkInfo) return;
        
        // Si la conexión es lenta, aplicar optimizaciones
        if (this.networkInfo.effectiveType === 'slow-2g' || 
            this.networkInfo.effectiveType === '2g' || 
            this.networkInfo.rtt > 500) {
            
            document.body.classList.add('low-bandwidth');
            
            // Ejemplo: Cargar imágenes de menor resolución
            if (options.optimizeImages) {
                document.querySelectorAll('img[data-src-low]').forEach(img => {
                    img.src = img.getAttribute('data-src-low');
                });
            }
            
            // Ejemplo: Deshabilitar animaciones
            if (options.disableAnimations) {
                document.body.classList.add('no-animations');
            }
        }
        
        // Si el usuario tiene activado ahorro de datos
        if (this.networkInfo.saveData) {
            document.body.classList.add('save-data');
            
            // Ejemplo: No cargar recursos no esenciales
            if (options.respectSaveData) {
                document.querySelectorAll('[data-save-data-excludable]').forEach(el => {
                    el.classList.add('hidden');
                });
            }
        }
    }
    
    /**
     * Adapta la carga de imágenes según el dispositivo y pantalla
     * @param {HTMLImageElement} img - Elemento de imagen a optimizar
     */
    optimizeImage(img) {
        if (!img || !(img instanceof HTMLImageElement)) return;
        
        // Obtener densidad de píxeles para servir imágenes optimizadas
        const pixelRatio = this.currentDevice.pixelRatio;
        const deviceType = this.currentDevice.type;
        
        // Seleccionar la fuente adecuada según densidad y dispositivo
        let srcKey = 'data-src';
        
        if (pixelRatio > 1) {
            srcKey = 'data-src-2x';
        }
        
        if (deviceType === 'mobile') {
            srcKey = pixelRatio > 1 ? 'data-src-mobile-2x' : 'data-src-mobile';
        } else if (deviceType === 'tablet') {
            srcKey = pixelRatio > 1 ? 'data-src-tablet-2x' : 'data-src-tablet';
        }
        
        // Si existe el atributo para este dispositivo, usarlo
        if (img.hasAttribute(srcKey)) {
            img.src = img.getAttribute(srcKey);
        } 
        // Si no, intentar con el src estándar
        else if (img.hasAttribute('data-src')) {
            img.src = img.getAttribute('data-src');
        }
        
        // Si el navegador soporta WebP y hay una versión WebP disponible
        if (this.browserCapabilities.webP && img.hasAttribute('data-webp')) {
            img.src = img.getAttribute('data-webp');
        }
    }
    
    /**
     * Optimiza varias imágenes en el documento según el dispositivo
     * @param {string} selector - Selector CSS para las imágenes a optimizar
     */
    optimizeImages(selector = 'img[data-src]') {
        const images = document.querySelectorAll(selector);
        images.forEach(img => this.optimizeImage(img));
    }
    
    /**
     * Solicita permiso para enviar notificaciones
     * @returns {Promise<boolean>} Promesa que resuelve a true si el permiso fue concedido
     */
    async requestNotificationPermission() {
        if (!this.browserCapabilities.notifications) {
            console.warn('DeviceDetector: Este navegador no soporta notificaciones');
            return false;
        }
        
        try {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.error('DeviceDetector: Error al solicitar permiso de notificaciones', error);
            return false;
        }
    }
    
    /**
     * Comprueba si el dispositivo está en modo ahorro de energía
     * @returns {Promise<boolean>} Promesa que resuelve a true si está en modo ahorro
     */
    async isPowerSaveMode() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                return battery.charging === false && battery.level < 0.15;
            } catch (error) {
                console.warn('DeviceDetector: Error al detectar modo de ahorro de energía', error);
                return false;
            }
        }
        return false;
    }

    /**
     * Método general para detectar todas las características y devolver un resumen
     * @returns {Object} Objeto con toda la información sobre el dispositivo
     */
    detect() {
        this.detectDeviceType();
        this.detectOrientation();
        this.detectBrowserCapabilities();
        this.detectTouchCapabilities();
        this.detectNetworkInfo();
        
        return {
            device: this.currentDevice,
            browser: this.browserCapabilities,
            network: this.networkInfo,
            display: {
                width: window.innerWidth,
                height: window.innerHeight,
                pixelRatio: this.currentDevice.pixelRatio
            }
        };
    }
}

/**
 * Instancia global de DeviceDetector para uso directo
 */
export const deviceDetector = new DeviceDetector();

/**
 * Función auxiliar para determinar si se debe cargar una versión específica de componente
 * @param {string} componentName - Nombre del componente
 * @returns {string} Ruta del componente adaptada al dispositivo
 */
export function getDeviceSpecificComponent(componentName) {
    const deviceType = deviceDetector.getDeviceType();
    const basePath = 'components/';
    
    // Primero intentamos cargar una versión específica del dispositivo
    let componentPath = `${basePath}${deviceType}/${componentName}.html`;
    
    // Si no existe, caemos en la versión estándar
    if (!componentExists(componentPath)) {
        componentPath = `${basePath}${componentName}.html`;
    }
    
    return componentPath;
}

/**
 * Función auxiliar para verificar si un componente existe
 * @param {string} path - Ruta del componente
 * @returns {boolean} True si el componente existe
 */
function componentExists(path) {
    // Esta es una implementación simplificada
    // En producción, se debería implementar una verificación real
    return true;
}