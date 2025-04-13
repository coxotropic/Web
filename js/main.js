 * main.js - Punto de entrada principal para el Portal de Inversiones en Criptomonedas
 * 
 * Este archivo contiene la inicialización de la aplicación y la coordinación
 * de todos los módulos y características del portal.
 * 
 * @version 1.0.1
 * @author Coxotropic
 */

// Importación de módulos
import { ComponentLoader } from './utils/component-loader.js';
import { DeviceDetector } from './utils/device-detector.js';
import { ThemeManager } from './utils/theme-manager.js';
import { Router } from './utils/router.js';
import { StateManager } from './utils/state-manager.js';
import { ApiService } from './services/api-service.js';
import { AuthService } from './auth/auth-service.js';
import { NewsService } from './news/news-service.js';
import { SocialService } from './social/social-service.js';
import { FearGreedIndex } from './interactive/fear-greed-index.js';
import { CryptoDataService } from './services/crypto-data-service.js';
import { NotificationService } from './services/notification-service.js';
import { UserPreferences } from './utils/user-preferences.js';

/**
 * Clase principal de la aplicación
 */
class CryptoApp {
    constructor() {
        // Inicialización de servicios y utilidades
        this.deviceDetector = new DeviceDetector();
        this.componentLoader = new ComponentLoader();
        this.themeManager = new ThemeManager();
        this.router = new Router();
        this.stateManager = new StateManager();
        
        // Servicios de API y datos
        this.apiService = new ApiService();
        this.cryptoDataService = new CryptoDataService(this.apiService);
        this.newsService = new NewsService(this.apiService);
        
        // Servicios de usuario y social
        this.authService = new AuthService(this.apiService);
        this.socialService = new SocialService(this.apiService, this.authService);
        this.notificationService = new NotificationService();
        this.userPreferences = new UserPreferences();
        
        // Componentes interactivos
        this.fearGreedIndex = new FearGreedIndex(this.apiService);
        
        // Bandera para saber si la app está inicializada
        this.initialized = false;
    }
    
    /**
     * Inicializa la aplicación
     */
    async init() {
        if (this.initialized) {
            console.warn('La aplicación ya ha sido inicializada');
            return;
        }
        
        try {
            console.log('Inicializando CryptoApp...');
            
            // Detectar dispositivo y cargar CSS adecuado
            this.deviceDetector.detect();
            this.loadResponsiveCSS();
            
            // Inicializar gestor de temas y aplicar tema guardado
            await this.themeManager.init();
            this.applyUserTheme();
            
            // Cargar componentes básicos de la interfaz
            await this.loadCoreComponents();
            
            // Inicializar servicios
            await Promise.all([
                this.apiService.init(),
                this.authService.init(),
                this.newsService.init(),
                this.socialService.init()
            ]);
            
            // Inicializar el índice de miedo y codicia
            await this.fearGreedIndex.init();
            
            // Configurar el enrutador
            this.setupRouter();
            
            // Configurar gestores de eventos
            this.setupEventListeners();
            
            // Cargar la ruta inicial basada en la URL actual
            this.router.navigateToCurrentUrl();
            
            // Programar actualización periódica de noticias (cada 30 minutos)
            this.scheduleNewsUpdates();
            
            // Marcar como inicializada
            this.initialized = true;
            console.log('CryptoApp inicializada correctamente');
            
            // Ocultar indicador de carga después de la inicialización
            this.hideLoadingIndicator();
        } catch (error) {
            console.error('Error al inicializar la aplicación:', error);
            this.showErrorMessage('Hubo un problema al cargar la aplicación. Por favor, recarga la página.');
        }
    }
    
    /**
     * Carga el CSS adaptativo según el dispositivo
     */
    loadResponsiveCSS() {
        const isMobile = this.deviceDetector.isMobile();
        const cssLink = document.getElementById('responsive-css');
        
        if (cssLink) {
            cssLink.href = isMobile ? 'css/mobile.css' : 'css/desktop.css';
            document.body.classList.add(isMobile ? 'mobile-device' : 'desktop-device');
            console.log(`Cargando CSS para: ${isMobile ? 'móvil' : 'escritorio'}`);
        }
    }
    
    /**
     * Aplica el tema guardado del usuario
     */
    applyUserTheme() {
        // Aplicar tema claro/oscuro
        const isDarkTheme = this.userPreferences.get('darkTheme', true);
        this.themeManager.setDarkTheme(isDarkTheme);
        
        // Aplicar modo novato/pro
        const isProMode = this.userPreferences.get('proMode', false);
        this.themeManager.setProMode(isProMode);
        
        console.log(`Tema aplicado: ${isDarkTheme ? 'oscuro' : 'claro'}, Modo: ${isProMode ? 'pro' : 'novato'}`);
    }
    
    /**
     * Carga los componentes básicos de la interfaz
     */
    async loadCoreComponents() {
        try {
            console.log('Cargando componentes básicos...');
            
            // Cargar componentes core en paralelo
            await Promise.all([
                this.componentLoader.load('header-container', 'components/core/header.html'),
                this.componentLoader.load('menu-container', 'components/core/menu.html'),
                this.componentLoader.load('footer-container', 'components/core/footer.html')
            ]);
            
            console.log('Componentes básicos cargados correctamente');
        } catch (error) {
            console.error('Error al cargar componentes básicos:', error);
            throw new Error('No se pudieron cargar los componentes básicos de la interfaz');
        }
    }
    
    /**
     * Configura el enrutador para navegación sin recarga
     */
    setupRouter() {
        // Definir rutas de la aplicación
        this.router.addRoute('/', async () => {
            await this.showHomePage();
        });
        
        this.router.addRoute('/novato', async () => {
            await this.componentLoader.load('content-container', 'components/content/novato.html');
        });
        
        this.router.addRoute('/intermedio', async () => {
            await this.componentLoader.load('content-container', 'components/content/intermedio.html');
        });
        
        this.router.addRoute('/senior', async () => {
            await this.componentLoader.load('content-container', 'components/content/senior.html');
        });
        
        this.router.addRoute('/riesgo/:nivel', async (params) => {
            await this.showRiskPage(params.nivel);
        });
        
        this.router.addRoute('/tiempo/:plazo', async (params) => {
            await this.showTimeframePage(params.plazo);
        });
        
        this.router.addRoute('/noticias', async () => {
            await this.componentLoader.load('news-container', 'components/news/news-feed.html');
            this.newsService.loadLatestNews();
        });
        
        this.router.addRoute('/login', async () => {
            await this.componentLoader.load('auth-container', 'components/auth/login.html');
            document.getElementById('content-container').classList.add('hidden');
            document.getElementById('auth-container').classList.remove('hidden');
        });
        
        this.router.addRoute('/registro', async () => {
            await this.componentLoader.load('auth-container', 'components/auth/register.html');
            document.getElementById('content-container').classList.add('hidden');
            document.getElementById('auth-container').classList.remove('hidden');
        });
        
        this.router.addRoute('/perfil/:username', async (params) => {
            await this.showUserProfile(params.username);
        });
        
        console.log('Enrutador configurado correctamente');
    }
    
    /**
     * Muestra la página de inicio
     */
    async showHomePage() {
        console.log('Cargando página principal...');
        
        // Ocultar contenedor de autenticación
        document.getElementById('auth-container').classList.add('hidden');
        
        // Mostrar contenedor de contenido
        document.getElementById('content-container').classList.remove('hidden');
        
        // Determinar el nivel de experiencia predeterminado (novato o guardado)
        const experienceLevel = this.userPreferences.get('experienceLevel', 'novato');
        
        // Cargar el contenido adecuado según el nivel
        await this.componentLoader.load('content-container', `components/content/${experienceLevel}.html`);
        
        // Cargar componentes adicionales para la página principal
        await Promise.all([
            this.componentLoader.load('timeframe-container', 'components/investment/timeframes.html'),
            this.componentLoader.load('risk-container', 'components/investment/risk-levels.html'),
            this.componentLoader.load('tools-container', 'components/interactive/tools.html')
        ]);
        
        // Inicializar herramientas interactivas
        this.fearGreedIndex.render();
        
        // Cargar sección de noticias destacadas
        await this.componentLoader.load('news-container', 'components/news/news-summary.html');
        this.newsService.loadFeaturedNews();
        
        console.log('Página principal cargada correctamente');
    }
    
    /**
     * Muestra la página de perfil de usuario
     * @param {string} username - Nombre de usuario
     */
    async showUserProfile(username) {
        console.log(`Cargando perfil de usuario: ${username}`);
        
        // Verificar si el usuario está autenticado
        if (!this.authService.isAuthenticated()) {
            // Redirigir al login si no está autenticado
            this.router.navigate('/login');
            this.notificationService.show('Debes iniciar sesión para ver perfiles de usuario', 'warning');
            return;
        }
        
        try {
            // Obtener datos del usuario
            const userData = await this.socialService.getUserProfile(username);
            
            // Almacenar datos del usuario en el estado
            this.stateManager.set('profileData', userData);
            
            // Cargar componente de perfil
            await this.componentLoader.load('content-container', 'components/auth/profile.html');
            
            // Cargar componentes sociales relacionados
            await Promise.all([
                this.componentLoader.load('social-container', 'components/social/feed.html')
            ]);
            
            // Cargar publicaciones del usuario
            this.socialService.loadUserPosts(username);
            
        } catch (error) {
            console.error(`Error al cargar perfil de ${username}:`, error);
            this.notificationService.show('No se pudo cargar el perfil del usuario', 'error');
        }
    }
    
    /**
     * Muestra la página de nivel de riesgo
     * @param {string} nivel - Nivel de riesgo (bajo, medio, alto)
     */
    async showRiskPage(nivel) {
        console.log(`Cargando página de riesgo ${nivel}...`);
        
        // Validar que el nivel sea válido
        const nivelesValidos = ['bajo', 'medio', 'alto'];
        if (!nivelesValidos.includes(nivel)) {
            this.router.navigate('/');
            this.notificationService.show('Nivel de riesgo no válido', 'error');
            return;
        }
        
        // Cargar el componente de niveles de riesgo
        await this.componentLoader.load('content-container', 'components/investment/risk-levels.html');
        
        // Resaltar el nivel seleccionado
        document.querySelectorAll('.risk-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.risk === nivel) {
                tab.classList.add('active');
            }
        });
        
        // Mostrar contenido específico del nivel
        document.querySelectorAll('.risk-content').forEach(content => {
            content.classList.add('hidden');
            if (content.id === `risk-${nivel}-content`) {
                content.classList.remove('hidden');
            }
        });
        
        // Cargar datos de criptomonedas recomendadas para este nivel de riesgo
        this.cryptoDataService.loadRiskBasedRecommendations(nivel);
    }
    
    /**
     * Muestra la página de plazo de tiempo
     * @param {string} plazo - Plazo de tiempo (corto, medio, largo)
     */
    async showTimeframePage(plazo) {
        console.log(`Cargando página de plazo ${plazo}...`);
        
        // Validar que el plazo sea válido
        const plazosValidos = ['corto', 'medio', 'largo'];
        if (!plazosValidos.includes(plazo)) {
            this.router.navigate('/');
            this.notificationService.show('Plazo de tiempo no válido', 'error');
            return;
        }
        
        // Cargar el componente de plazos de tiempo
        await this.componentLoader.load('content-container', 'components/investment/timeframes.html');
        
        // Resaltar el plazo seleccionado
        document.querySelectorAll('.timeframe-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.timeframe === plazo) {
                tab.classList.add('active');
            }
        });
        
        // Mostrar contenido específico del plazo
        document.querySelectorAll('.timeframe-content').forEach(content => {
            content.classList.add('hidden');
            if (content.id === `timeframe-${plazo}-content`) {
                content.classList.remove('hidden');
            }
        });
        
        // Cargar datos de criptomonedas recomendadas para este plazo
        this.cryptoDataService.loadTimeframeBasedRecommendations(plazo);
    }
    
    /**
     * Programa actualizaciones periódicas de noticias
     */
    scheduleNewsUpdates() {
        // Actualizar noticias cada 30 minutos (1800000 ms)
        const UPDATE_INTERVAL = 30 * 60 * 1000;
        
        // Primera actualización inmediata
        this.newsService.fetchAndProcessNews();
        
        // Programar actualizaciones periódicas
        setInterval(() => {
            console.log('Actualizando noticias...');
            this.newsService.fetchAndProcessNews();
        }, UPDATE_INTERVAL);
        
        console.log(`Actualizaciones de noticias programadas cada ${UPDATE_INTERVAL / 60000} minutos`);
    }
    
    /**
     * Configura los escuchadores de eventos
     */
    setupEventListeners() {
        console.log('Configurando escuchadores de eventos...');
        
        // Escuchar cambios en el tamaño de la ventana para adaptar el CSS
        window.addEventListener('resize', () => {
            this.deviceDetector.detect();
            this.loadResponsiveCSS();
        });
        
        // Escuchar clics en los selectores de modo (novato/pro)
        document.getElementById('novato-mode').addEventListener('click', () => {
            this.themeManager.setProMode(false);
            this.userPreferences.set('proMode', false);
        });
        
        document.getElementById('pro-mode').addEventListener('click', () => {
            this.themeManager.setProMode(true);
            this.userPreferences.set('proMode', true);
        });
        
        // Escuchar eventos de autenticación
        document.addEventListener('auth:login', (e) => {
            const userData = e.detail;
            console.log('Usuario autenticado:', userData.username);
            this.notificationService.show(`Bienvenido, ${userData.username}!`, 'success');
            this.router.navigate('/');
        });
        
        document.addEventListener('auth:logout', () => {
            console.log('Usuario cerró sesión');
            this.notificationService.show('Has cerrado sesión correctamente', 'info');
            this.router.navigate('/');
        });
        
        // Escuchar cambios de tema
        document.addEventListener('theme:changed', (e) => {
            const { isDark, isPro } = e.detail;
            console.log(`Tema cambiado: ${isDark ? 'oscuro' : 'claro'}, Modo: ${isPro ? 'pro' : 'novato'}`);
        });
        
        // Escuchar eventos de interacción social
        document.addEventListener('social:comment', (e) => {
            const { postId, comment } = e.detail;
            this.socialService.addComment(postId, comment);
        });
        
        document.addEventListener('social:follow', (e) => {
            const { username } = e.detail;
            this.socialService.followUser(username);
        });
        
        document.addEventListener('social:unfollow', (e) => {
            const { username } = e.detail;
            this.socialService.unfollowUser(username);
        });
        
        // Cerrar modal de sistema
        const closeBtn = document.querySelector('#system-modal .close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.getElementById('system-modal').classList.add('hidden');
            });
        }
        
        console.log('Escuchadores de eventos configurados correctamente');
    }
    
    /**
     * Oculta el indicador de carga
     */
    hideLoadingIndicator() {
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.classList.add('hidden');
        }
    }
    
    /**
     * Muestra un mensaje de error
     * @param {string} message - Mensaje de error
     */
    showErrorMessage(message) {
        const modal = document.getElementById('system-modal');
        const modalMessage = document.getElementById('modal-message');
        
        if (modal && modalMessage) {
            modalMessage.textContent = message;
            modalMessage.classList.add('error');
            modal.classList.remove('hidden');
        }
    }
}

// Crear instancia de la aplicación y exportarla
const app = new CryptoApp();

// Inicializar cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    app.init().catch(error => {
        console.error('Error fatal al inicializar la aplicación:', error);
    });
});

// Exportar para uso en otros módulos
export default app;