<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Índice de Miedo y Codicia - CryptInvest</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.css">
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #333;
            background-color: #f5f7fa;
        }
        .fear-greed-gauge {
            position: relative;
            width: 300px;
            height: 150px;
            margin: 0 auto;
            overflow: hidden;
        }
        .gauge-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, 
                #e74c3c 0%, 
                #e67e22 25%,
                #f1c40f 50%,
                #2ecc71 75%,
                #27ae60 100%
            );
            border-radius: 150px 150px 0 0;
        }
        .gauge-center {
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 20px;
            background-color: #fff;
            border-radius: 50%;
            box-shadow: 0 0 5px rgba(0,0,0,0.3);
            z-index: 10;
        }
        .gauge-needle {
            position: absolute;
            bottom: 0;
            left: 50%;
            transform-origin: bottom center;
            width: 4px;
            height: 140px;
            background-color: #34495e;
            z-index: 5;
            transition: transform 1s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .gauge-labels {
            display: flex;
            justify-content: space-between;
            margin-top: 10px;
            padding: 0 10px;
        }
        .gauge-value {
            position: absolute;
            bottom: -60px;
            left: 50%;
            transform: translateX(-50%);
            font-size: 28px;
            font-weight: bold;
        }
        .recommendation-card {
            transition: all 0.3s ease;
        }
        .recommendation-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        .historical-chart {
            height: 250px;
            width: 100%;
        }
        .correlation-chart {
            height: 250px;
            width: 100%;
        }
        .loading-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: rgba(255,255,255,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 100;
        }
        .spinner {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            animation: spin 1s linear infinite;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    </style>
</head>
<body class="min-h-screen pb-20">
    <header class="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg mb-8">
        <h1 class="text-3xl font-bold text-center">Índice de Miedo y Codicia</h1>
        <p class="text-center text-white text-opacity-80 mt-2">Una herramienta para medir el sentimiento del mercado de criptomonedas</p>
    </header>

    <main class="container mx-auto px-4">
        <!-- Seccion principal del índice -->
        <section class="bg-white rounded-lg shadow-md p-6 mb-8 relative">
            <div id="loading-overlay" class="loading-overlay rounded-lg">
                <div class="spinner"></div>
            </div>
            
            <h2 class="text-2xl font-bold mb-4 text-center">Índice Actual</h2>
            
            <div class="flex flex-wrap">
                <div class="w-full md:w-1/2 mb-8">
                    <div class="fear-greed-container text-center">
                        <div class="fear-greed-gauge">
                            <div class="gauge-background"></div>
                            <div class="gauge-needle" id="gauge-needle"></div>
                            <div class="gauge-center"></div>
                            <div class="gauge-value" id="gauge-value">--</div>
                        </div>
                        <div class="gauge-labels text-sm mt-16">
                            <span class="text-red-600 font-medium">Miedo Extremo</span>
                            <span class="text-yellow-500 font-medium">Neutral</span>
                            <span class="text-green-600 font-medium">Codicia Extrema</span>
                        </div>
                        <div class="mt-4">
                            <span class="font-semibold text-lg" id="index-label">Cargando...</span>
                        </div>
                        <div class="mt-2 text-sm text-gray-600" id="update-time">
                            Última actualización: --
                        </div>
                    </div>
                </div>
                
                <div class="w-full md:w-1/2">
                    <div class="interpretation-container bg-gray-50 rounded-lg p-4">
                        <h3 class="text-xl font-semibold mb-2">¿Qué significa esto?</h3>
                        <p class="mb-4" id="interpretation-text">
                            El índice de miedo y codicia mide el sentimiento del mercado. Los valores extremos suelen indicar posibles puntos de inflexión en el mercado.
                        </p>
                        
                        <div class="recommendation bg-blue-50 border-l-4 border-blue-500 p-4 rounded" id="recommendation-container">
                            <h4 class="font-bold text-blue-700">Recomendación</h4>
                            <p class="text-blue-600" id="recommendation-text">
                                Cargando recomendación...
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- Sección histórica -->
        <section class="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 class="text-2xl font-bold mb-4">Histórico del Índice</h2>
            
            <div class="flex flex-wrap items-center mb-4">
                <div class="mr-4 mb-2">
                    <label class="block text-gray-700 text-sm font-bold mb-2">Período:</label>
                    <div class="flex">
                        <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded-l time-btn active" data-period="1w">1S</button>
                        <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 border-l border-blue-700 time-btn" data-period="1m">1M</button>
                        <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 border-l border-blue-700 time-btn" data-period="3m">3M</button>
                        <button class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 border-l border-blue-700 rounded-r time-btn" data-period="1y">1A</button>
                    </div>
                </div>
                
                <div>
                    <button id="refresh-btn" class="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-1 px-3 rounded inline-flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Actualizar
                    </button>
                </div>
            </div>
            
            <div class="historical-chart-container relative">
                <canvas id="historical-chart" class="historical-chart"></canvas>
            </div>
        </section>
        
        <!-- Sección de correlación -->
        <section class="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 class="text-2xl font-bold mb-4">Correlación con el Mercado</h2>
            
            <div class="flex flex-wrap mb-4">
                <div class="w-full lg:w-2/3">
                    <div class="correlation-chart-container relative">
                        <canvas id="correlation-chart" class="correlation-chart"></canvas>
                    </div>
                </div>
                
                <div class="w-full lg:w-1/3 px-4">
                    <div class="bg-gray-50 p-4 rounded-lg h-full">
                        <h3 class="text-lg font-semibold mb-2">Análisis de Correlación</h3>
                        <p class="text-gray-700 mb-4">
                            Históricamente, el índice de miedo y codicia ha mostrado ser un indicador contrario efectivo. Los períodos de "miedo extremo" suelen representar oportunidades de compra, mientras que los períodos de "codicia extrema" pueden indicar que el mercado está sobrecomprado.
                        </p>
                        <ul class="list-disc pl-5 text-sm">
                            <li class="mb-2">Cuando el índice está por debajo de 20 (Miedo Extremo), los precios suelen recuperarse en los siguientes meses.</li>
                            <li class="mb-2">Cuando el índice está por encima de 80 (Codicia Extrema), puede ser señal de una próxima corrección.</li>
                            <li>El mejor enfoque es usar este índice como parte de una estrategia de inversión más amplia, no como una señal independiente.</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
        
        <!-- Sección de estrategias -->
        <section class="bg-white rounded-lg shadow-md p-6">
            <h2 class="text-2xl font-bold mb-4">Estrategias Basadas en el Índice</h2>
            
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div class="recommendation-card bg-red-50 border border-red-200 rounded-lg p-4">
                    <div class="text-center mb-3">
                        <div class="inline-block bg-red-100 rounded-full p-3">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-bold text-red-800 mt-2">Miedo Extremo (0-25)</h3>
                    </div>
                    <p class="text-gray-700 mb-3">
                        Cuando el mercado está en miedo extremo, generalmente existe un pesimismo excesivo. Históricamente, estos han sido buenos momentos para acumular.
                    </p>
                    <div class="text-sm">
                        <p class="font-bold text-gray-700 mb-1">Estrategia recomendada:</p>
                        <ul class="list-disc pl-5 text-gray-600">
                            <li>Considerar aumentar posiciones gradualmente (DCA)</li>
                            <li>Enfocarse en proyectos consolidados</li>
                            <li>Establecer objetivos de precio claros</li>
                        </ul>
                    </div>
                </div>
                
                <div class="recommendation-card bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <div class="text-center mb-3">
                        <div class="inline-block bg-yellow-100 rounded-full p-3">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-bold text-yellow-800 mt-2">Neutral (26-74)</h3>
                    </div>
                    <p class="text-gray-700 mb-3">
                        En condiciones de mercado neutras, es mejor seguir una estrategia moderada y equilibrada. Ni demasiado agresivo ni demasiado conservador.
                    </p>
                    <div class="text-sm">
                        <p class="font-bold text-gray-700 mb-1">Estrategia recomendada:</p>
                        <ul class="list-disc pl-5 text-gray-600">
                            <li>Mantener asignación equilibrada</li>
                            <li>Diversificar entre diferentes activos</li>
                            <li>Utilizar análisis técnico para decisiones a corto plazo</li>
                        </ul>
                    </div>
                </div>
                
                <div class="recommendation-card bg-green-50 border border-green-200 rounded-lg p-4">
                    <div class="text-center mb-3">
                        <div class="inline-block bg-green-100 rounded-full p-3">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <h3 class="text-lg font-bold text-green-800 mt-2">Codicia Extrema (75-100)</h3>
                    </div>
                    <p class="text-gray-700 mb-3">
                        Durante períodos de codicia extrema, el mercado puede estar sobrecomprado. Esto puede ser una señal de precaución para los inversores.
                    </p>
                    <div class="text-sm">
                        <p class="font-bold text-gray-700 mb-1">Estrategia recomendada:</p>
                        <ul class="list-disc pl-5 text-gray-600">
                            <li>Considerar tomar algunas ganancias</li>
                            <li>Ser más selectivo con nuevas compras</li>
                            <li>Preparar estrategia para posible corrección</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <script src="https://cdn.jsdelivr.net/npm/chart.js@3.7.0/dist/chart.min.js"></script>
    <script type="module">
        /**
         * fear-greed-index.js
         * Módulo para gestionar el índice de miedo y codicia en el portal de criptomonedas.
         * Este módulo obtiene, interpreta y visualiza el índice, proporcionando recomendaciones
         * basadas en el valor actual y correlaciones con el mercado.
         */

        // API endpoints y claves
        const API_CONFIG = {
            // Endpoint principal para el índice de miedo y codicia
            // En producción, esto debería apuntar a tu propio backend que haga
            // las llamadas a las APIs externas
            fearGreedEndpoint: 'https://api.alternative.me/fng/',
            
            // Endpoint para datos históricos
            fearGreedHistoricalEndpoint: 'https://api.alternative.me/fng/?limit=',
            
            // Endpoint para datos de precios (en producción, usar una API real)
            priceEndpoint: 'https://api.coingecko.com/api/v3/coins/bitcoin/market_chart',
            
            // Tiempo de caché en segundos
            cacheTime: 3600
        };

        // Rangos e interpretaciones del índice
        const INDEX_RANGES = [
            { max: 24, level: 'Miedo Extremo', color: '#e74c3c', description: 'El mercado muestra un pesimismo excesivo, lo que históricamente ha representado oportunidades de compra.' },
            { max: 49, level: 'Miedo', color: '#e67e22', description: 'Los inversores están preocupados, predomina la cautela en el mercado.' },
            { max: 74, level: 'Neutral', color: '#f1c40f', description: 'El mercado no muestra una tendencia clara en el sentimiento, equilibrio entre optimismo y precaución.' },
            { max: 89, level: 'Codicia', color: '#2ecc71', description: 'El optimismo es notable en el mercado, lo que podría indicar que los precios están en niveles elevados.' },
            { max: 100, level: 'Codicia Extrema', color: '#27ae60', description: 'El mercado muestra euforia, lo que históricamente ha precedido a correcciones de precio.' }
        ];

        // Recomendaciones según el nivel del índice
        const RECOMMENDATIONS = {
            'Miedo Extremo': 'Considera implementar una estrategia de acumulación gradual (DCA) en proyectos consolidados. Históricamente, estos niveles han representado buenas oportunidades de entrada a largo plazo.',
            'Miedo': 'Evalúa oportunidades de inversión selectivas. Mantén una actitud cautelosa pero atenta a posibles reversiones del sentimiento.',
            'Neutral': 'Mantén una estrategia equilibrada. Es un buen momento para revisar tu portafolio y asegurarte de que está alineado con tus objetivos.',
            'Codicia': 'Considera asegurar algunas ganancias y revisa tus stop-loss. El mercado podría estar acercándose a niveles de sobrecompra.',
            'Codicia Extrema': 'Extrema precaución con nuevas inversiones. Considera tomar beneficios parciales y preparar una estrategia para posibles correcciones de mercado.'
        };

        /**
         * Clase principal para el Índice de Miedo y Codicia
         */
        export class FearGreedIndex {
            constructor(options = {}) {
                // Fusionar opciones con valores predeterminados
                this.options = {
                    // Selector del elemento donde se mostrará el medidor
                    gaugeElementId: 'gauge-needle',
                    // Selector del elemento donde se mostrará el valor numérico
                    valueElementId: 'gauge-value',
                    // Selector del elemento donde se mostrará la etiqueta
                    labelElementId: 'index-label',
                    // Selector del elemento donde se mostrará la recomendación
                    recommendationElementId: 'recommendation-text',
                    // Selector del elemento donde se mostrará la hora de actualización
                    updateTimeElementId: 'update-time',
                    // Selector del elemento para mostrar la interpretación
                    interpretationElementId: 'interpretation-text',
                    // Selector del gráfico histórico
                    historicalChartId: 'historical-chart',
                    // Selector del gráfico de correlación
                    correlationChartId: 'correlation-chart',
                    // Selector del overlay de carga
                    loadingOverlayId: 'loading-overlay',
                    // Nombre de la clave de caché
                    cacheKey: 'fear_greed_index_data',
                    // Tiempo de caché en segundos
                    cacheTime: API_CONFIG.cacheTime,
                    ...options
                };
                
                // Inicializar caché
                this.cache = {};
                
                // Referencias a elementos del DOM
                this.gaugeElement = document.getElementById(this.options.gaugeElementId);
                this.valueElement = document.getElementById(this.options.valueElementId);
                this.labelElement = document.getElementById(this.options.labelElementId);
                this.recommendationElement = document.getElementById(this.options.recommendationElementId);
                this.updateTimeElement = document.getElementById(this.options.updateTimeElementId);
                this.interpretationElement = document.getElementById(this.options.interpretationElementId);
                this.loadingOverlay = document.getElementById(this.options.loadingOverlayId);
                
                // Inicializar las instancias de los gráficos como nulas
                this.historicalChart = null;
                this.correlationChart = null;
                
                // Estado actual
                this.currentValue = null;
                this.historicalData = null;
                
                // Inicialización de escuchadores de eventos
                this._setupEventListeners();
            }
            
            /**
             * Inicializa el módulo
             */
            async init() {
                console.log('Inicializando Fear & Greed Index');
                try {
                    // Intentar cargar datos de la caché
                    const cachedData = this._loadFromCache();
                    
                    if (cachedData && !this._isCacheExpired(cachedData.timestamp)) {
                        console.log('Usando datos en caché del índice de miedo y codicia');
                        this.currentValue = cachedData.value;
                        this._updateUI(this.currentValue);
                    } else {
                        // Si no hay caché o está expirada, obtener datos frescos
                        await this.refresh();
                    }
                    
                    // Cargar datos históricos y crear gráficos
                    await this.loadHistoricalData('1w');
                    this._createHistoricalChart();
                    this._createCorrelationChart();
                    
                } catch (error) {
                    console.error('Error al inicializar el índice de miedo y codicia:', error);
                    this._handleError(error);
                }
            }
            
            /**
             * Actualiza los datos del índice
             */
            async refresh() {
                console.log('Actualizando datos del índice de miedo y codicia');
                this._showLoading();
                
                try {
                    const data = await this._fetchCurrentIndex();
                    
                    if (data && data.data && data.data.length > 0) {
                        const indexData = data.data[0];
                        this.currentValue = parseInt(indexData.value);
                        
                        // Guardar en caché
                        this._saveToCache(this.currentValue);
                        
                        // Actualizar la UI
                        this._updateUI(this.currentValue);
                    } else {
                        throw new Error('Formato de datos no válido');
                    }
                } catch (error) {
                    console.error('Error al actualizar el índice:', error);
                    this._handleError(error);
                } finally {
                    this._hideLoading();
                }
            }
            
            /**
             * Carga datos históricos del índice
             * @param {string} period - Período de tiempo ('1w', '1m', '3m', '1y')
             */
            async loadHistoricalData(period) {
                console.log(`Cargando datos históricos para el período: ${period}`);
                this._showLoading();
                
                try {
                    // Determinar el número de días a solicitar
                    let limit;
                    switch (period) {
                        case '1w': limit = 7; break;
                        case '1m': limit = 30; break;
                        case '3m': limit = 90; break;
                        case '1y': limit = 365; break;
                        default: limit = 30;
                    }
                    
                    // Buscar en caché primero
                    const cacheKey = `historical_${period}`;
                    const cachedData = this._loadFromCache(cacheKey);
                    
                    if (cachedData && !this._isCacheExpired(cachedData.timestamp)) {
                        console.log(`Usando datos históricos en caché para ${period}`);
                        this.historicalData = cachedData.data;
                    } else {
                        // Obtener datos frescos
                        const data = await this._fetchHistoricalIndex(limit);
                        
                        if (data && data.data) {
                            // Los datos vienen en orden inverso, los revertimos
                            this.historicalData = data.data.reverse();
                            
                            // Guardar en caché
                            this._saveToCache(this.historicalData, cacheKey);
                        } else {
                            throw new Error('Formato de datos históricos no válido');
                        }
                    }
                    
                    // Actualizar el gráfico histórico si ya existe
                    if (this.historicalChart) {
                        this._updateHistoricalChart();
                    }
                    
                    // Actualizar el gráfico de correlación si ya existe
                    if (this.correlationChart) {
                        await this._updateCorrelationChart(period);
                    }
                } catch (error) {
                    console.error('Error al cargar datos históricos:', error);
                    this._handleError(error);
                } finally {
                    this._hideLoading();
                }
            }
            
            /**
             * Obtiene recomendaciones basadas en el valor actual del índice
             * @returns {string} Recomendación basada en el índice actual
             */
            getRecommendation() {
                const level = this._getIndexLevel(this.currentValue);
                return RECOMMENDATIONS[level] || 'No hay recomendaciones disponibles en este momento.';
            }
            
            /**
             * Configura los escuchadores de eventos
             * @private
             */
            _setupEventListeners() {
                // Botón de actualizar
                const refreshBtn = document.getElementById('refresh-btn');
                if (refreshBtn) {
                    refreshBtn.addEventListener('click', () => this.refresh());
                }
                
                // Botones de período de tiempo
                const timeButtons = document.querySelectorAll('.time-btn');
                timeButtons.forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        // Remover clase active de todos los botones
                        timeButtons.forEach(b => b.classList.remove('active'));
                        
                        // Añadir clase active al botón clickeado
                        e.target.classList.add('active');
                        
                        // Cargar datos históricos para el período seleccionado
                        const period = e.target.getAttribute('data-period');
                        this.loadHistoricalData(period);
                    });
                });
                
                // Event listener para notificaciones de cambio significativo
                window.addEventListener('fng-significant-change', (e) => {
                    const { oldValue, newValue, threshold } = e.detail;
                    const oldLevel = this._getIndexLevel(oldValue);
                    const newLevel = this._getIndexLevel(newValue);
                    
                    // Notificar solo si cambia de nivel o supera el umbral
                    if (oldLevel !== newLevel || Math.abs(newValue - oldValue) >= threshold) {
                        this._showNotification(oldValue, newValue, oldLevel, newLevel);
                    }
                });
            }
            
            /**
             * Actualiza la interfaz de usuario con el valor actual
             * @param {number} value - Valor actual del índice
             * @private
             */
            _updateUI(value) {
                if (!value && value !== 0) return;
                
                // Obtener el nivel y color para el valor actual
                const level = this._getIndexLevel(value);
                const color = this._getLevelColor(value);
                const description = this._getLevelDescription(value);
                
                // Actualizar el medidor
                if (this.gaugeElement) {
                    // Calcular el ángulo de rotación (0-180 grados)
                    const angle = (value / 100) * 180;
                    this.gaugeElement.style.transform = `rotate(${angle}deg)`;
                }
                
                // Actualizar el valor numérico
                if (this.valueElement) {
                    this.valueElement.textContent = value;
                    this.valueElement.style.color = color;
                }
                
                // Actualizar la etiqueta de nivel
                if (this.labelElement) {
                    this.labelElement.textContent = level;
                    this.labelElement.style.color = color;
                }
                
                // Actualizar la interpretación
                if (this.interpretationElement) {
                    this.interpretationElement.textContent = description;
                }
                
                // Actualizar la recomendación
                if (this.recommendationElement) {
                    this.recommendationElement.textContent = this.getRecommendation();
                }
                
                // Actualizar hora de actualización
                if (this.updateTimeElement) {
                    const now = new Date();
                    this.updateTimeElement.textContent = `Última actualización: ${now.toLocaleString()}`;
                }
                
                // Comprobar si hay un cambio significativo respecto al valor anterior
                const previousValue = parseInt(localStorage.getItem('previous_fear_greed_value'));
                
                if (previousValue && Math.abs(value - previousValue) >= 10) {
                    // Disparar evento personalizado para notificar cambio significativo
                    const event = new CustomEvent('fng-significant-change', {
                        detail: {
                            oldValue: previousValue,
                            newValue: value,
                            threshold: 10
                        }
                    });
                    window.dispatchEvent(event);
                }
                
                // Almacenar el valor actual como anterior para futuras comparaciones
                localStorage.setItem('previous_fear_greed_value', value.toString());
            }
            
            /**
             * Obtiene el nivel del índice para un valor dado
             * @param {number} value - Valor del índice
             * @returns {string} Nivel del índice (Miedo Extremo, Miedo, etc.)
             * @private
             */
            _getIndexLevel(value) {
                for (const range of INDEX_RANGES) {
                    if (value <= range.max) {
                        return range.level;
                    }
                }
                return 'Desconocido';
            }
            
            /**
             * Obtiene el color asociado a un valor del índice
             * @param {number} value - Valor del índice
             * @returns {string} Código de color en hexadecimal
             * @private
             */
            _getLevelColor(value) {
                for (const range of INDEX_RANGES) {
                    if (value <= range.max) {
                        return range.color;
                    }
                }
                return '#999999'; // Color por defecto
            }
            
            /**
             * Obtiene la descripción de un nivel del índice
             * @param {number} value - Valor del índice
             * @returns {string} Descripción del nivel
             * @private
             */
            _getLevelDescription(value) {
                for (const range of INDEX_RANGES) {
                    if (value <= range.max) {
                        return range.description;
                    }
                }
                return 'No hay descripción disponible.';
            }
            
            /**
             * Crea el gráfico histórico
             * @private
             */
            _createHistoricalChart() {
                if (!this.historicalData) return;
                
                const ctx = document.getElementById(this.options.historicalChartId);
                if (!ctx) return;
                
                // Preparar datos para el gráfico
                const labels = this.historicalData.map(item => new Date(item.timestamp * 1000).toLocaleDateString());
                const values = this.historicalData.map(item => item.value);
                const colors = this.historicalData.map(item => this._getLevelColor(item.value));
                
                // Crear gráfico
                this.historicalChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Índice de Miedo y Codicia',
                            data: values,
                            backgroundColor: 'rgba(75, 192, 192, 0.2)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 2,
                            pointBackgroundColor: colors,
                            pointBorderColor: '#fff',
                            pointBorderWidth: 1,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            tension: 0.3
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        const value = context.raw;
                                        const level = this._getIndexLevel(value);
                                        return `Valor: ${value} - ${level}`;
                                    }
                                }
                            },
                            legend: {
                                display: false
                            }
                        },
                        scales: {
                            y: {
                                min: 0,
                                max: 100,
                                grid: {
                                    color: 'rgba(0, 0, 0, 0.1)'
                                }
                            },
                            x: {
                                grid: {
                                    display: false
                                }
                            }
                        }
                    }
                });
            }
            
            /**
             * Actualiza el gráfico histórico con nuevos datos
             * @private
             */
            _updateHistoricalChart() {
                if (!this.historicalChart || !this.historicalData) return;
                
                const labels = this.historicalData.map(item => new Date(item.timestamp * 1000).toLocaleDateString());
                const values = this.historicalData.map(item => item.value);
                const colors = this.historicalData.map(item => this._getLevelColor(item.value));
                
                // Actualizar datos
                this.historicalChart.data.labels = labels;
                this.historicalChart.data.datasets[0].data = values;
                this.historicalChart.data.datasets[0].pointBackgroundColor = colors;
                
                // Actualizar gráfico
                this.historicalChart.update();
            }
            
            /**
             * Crea el gráfico de correlación con el precio de Bitcoin
             * @private
             */
            async _createCorrelationChart() {
                const ctx = document.getElementById(this.options.correlationChartId);
                if (!ctx) return;
                
                // Obtener datos de precio de Bitcoin para el mismo período
                const period = '1m'; // Período inicial
                const priceData = await this._fetchPriceData(period);
                
                if (!priceData || !this.historicalData) return;
                
                // Preparar datos para el gráfico
                const dates = this.historicalData.map(item => new Date(item.timestamp * 1000).toLocaleDateString());
                const fearGreedValues = this.historicalData.map(item => item.value);
                
                // Encontrar precios correspondientes a las fechas del índice
                const prices = this._alignPriceDataWithFearGreedData(priceData, this.historicalData);
                
                // Normalizar precios para mostrarlos en la misma escala que el índice
                const normalizedPrices = this._normalizePrices(prices);
                
                // Crear gráfico
                this.correlationChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: dates,
                        datasets: [
                            {
                                label: 'Índice de Miedo y Codicia',
                                data: fearGreedValues,
                                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                                borderColor: 'rgba(75, 192, 192, 1)',
                                borderWidth: 2,
                                yAxisID: 'y',
                            },
                            {
                                label: 'Precio de Bitcoin (normalizado)',
                                data: normalizedPrices,
                                backgroundColor: 'rgba(255, 159, 64, 0.2)',
                                borderColor: 'rgba(255, 159, 64, 1)',
                                borderWidth: 2,
                                borderDash: [5, 5],
                                yAxisID: 'y1',
                            }
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: {
                            mode: 'index',
                            intersect: false,
                        },
                        plugins: {
                            tooltip: {
                                callbacks: {
                                    label: (context) => {
                                        if (context.datasetIndex === 0) {
                                            const value = context.raw;
                                            const level = this._getIndexLevel(value);
                                            return `Índice: ${value} - ${level}`;
                                        } else {
                                            // Recuperar el precio original
                                            const index = context.dataIndex;
                                            return `Bitcoin: $${prices[index].toLocaleString()}`;
                                        }
                                    }
                                }
                            }
                        },
                        scales: {
                            y: {
                                type: 'linear',
                                display: true,
                                position: 'left',
                                min: 0,
                                max: 100,
                                title: {
                                    display: true,
                                    text: 'Índice de Miedo y Codicia'
                                }
                            },
                            y1: {
                                type: 'linear',
                                display: true,
                                position: 'right',
                                min: 0,
                                max: 100,
                                grid: {
                                    drawOnChartArea: false,
                                },
                                title: {
                                    display: true,
                                    text: 'Precio Normalizado'
                                }
                            }
                        }
                    }
                });
            }
            
            /**
             * Actualiza el gráfico de correlación con nuevos datos
             * @param {string} period - Período de tiempo
             * @private
             */
            async _updateCorrelationChart(period) {
                if (!this.correlationChart || !this.historicalData) return;
                
                // Obtener datos de precio de Bitcoin para el período seleccionado
                const priceData = await this._fetchPriceData(period);
                
                if (!priceData) return;
                
                // Preparar datos para el gráfico
                const dates = this.historicalData.map(item => new Date(item.timestamp * 1000).toLocaleDateString());
                const fearGreedValues = this.historicalData.map(item => item.value);
                
                // Encontrar precios correspondientes a las fechas del índice
                const prices = this._alignPriceDataWithFearGreedData(priceData, this.historicalData);
                
                // Normalizar precios para mostrarlos en la misma escala que el índice
                const normalizedPrices = this._normalizePrices(prices);
                
                // Actualizar datos
                this.correlationChart.data.labels = dates;
                this.correlationChart.data.datasets[0].data = fearGreedValues;
                this.correlationChart.data.datasets[1].data = normalizedPrices;
                
                // Actualizar gráfico
                this.correlationChart.update();
            }
            
            /**
             * Alinea los datos de precio con los datos del índice de miedo y codicia
             * @param {Object} priceData - Datos de precio de la API
             * @param {Array} fearGreedData - Datos del índice de miedo y codicia
             * @returns {Array} Precios alineados con los datos del índice
             * @private
             */
            _alignPriceDataWithFearGreedData(priceData, fearGreedData) {
                const prices = [];
                const pricesMap = new Map();
                
                // Crear un mapa de precios por fecha
                priceData.prices.forEach(([timestamp, price]) => {
                    const date = new Date(timestamp).toLocaleDateString();
                    pricesMap.set(date, price);
                });
                
                // Buscar precios correspondientes a las fechas del índice
                fearGreedData.forEach(item => {
                    const date = new Date(item.timestamp * 1000).toLocaleDateString();
                    const price = pricesMap.get(date) || null;
                    prices.push(price);
                });
                
                return prices;
            }
            
            /**
             * Normaliza los precios para mostrarlos en la misma escala que el índice
             * @param {Array} prices - Precios a normalizar
             * @returns {Array} Precios normalizados (0-100)
             * @private
             */
            _normalizePrices(prices) {
                // Filtrar valores null
                const validPrices = prices.filter(price => price !== null);
                
                if (validPrices.length === 0) return prices.map(() => null);
                
                const minPrice = Math.min(...validPrices);
                const maxPrice = Math.max(...validPrices);
                const range = maxPrice - minPrice;
                
                // Evitar división por cero
                if (range === 0) return prices.map(price => price !== null ? 50 : null);
                
                // Normalizar a escala 0-100
                return prices.map(price => {
                    if (price === null) return null;
                    return ((price - minPrice) / range) * 100;
                });
            }
            
            /**
             * Obtiene el índice actual de miedo y codicia
             * @returns {Promise<Object>} Datos del índice
             * @private
             */
            async _fetchCurrentIndex() {
                try {
                    const response = await fetch(API_CONFIG.fearGreedEndpoint);
                    if (!response.ok) {
                        throw new Error(`Error HTTP: ${response.status}`);
                    }
                    return await response.json();
                } catch (error) {
                    console.error('Error al obtener el índice de miedo y codicia:', error);
                    throw error;
                }
            }
            
            /**
             * Obtiene datos históricos del índice de miedo y codicia
             * @param {number} limit - Número de días a obtener
             * @returns {Promise<Object>} Datos históricos
             * @private
             */
            async _fetchHistoricalIndex(limit) {
                try {
                    const url = `${API_CONFIG.fearGreedHistoricalEndpoint}${limit}`;
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`Error HTTP: ${response.status}`);
                    }
                    return await response.json();
                } catch (error) {
                    console.error('Error al obtener datos históricos:', error);
                    throw error;
                }
            }
            
            /**
             * Obtiene datos de precio de Bitcoin
             * @param {string} period - Período de tiempo ('1w', '1m', '3m', '1y')
             * @returns {Promise<Object>} Datos de precio
             * @private
             */
            async _fetchPriceData(period) {
                try {
                    // Convertir período a días
                    let days;
                    switch (period) {
                        case '1w': days = 7; break;
                        case '1m': days = 30; break;
                        case '3m': days = 90; break;
                        case '1y': days = 365; break;
                        default: days = 30;
                    }
                    
                    // Buscar en caché primero
                    const cacheKey = `price_${period}`;
                    const cachedData = this._loadFromCache(cacheKey);
                    
                    if (cachedData && !this._isCacheExpired(cachedData.timestamp)) {
                        console.log(`Usando datos de precio en caché para ${period}`);
                        return cachedData.data;
                    }
                    
                    // Si no hay caché o está expirada, obtener datos frescos
                    const url = `${API_CONFIG.priceEndpoint}?vs_currency=usd&days=${days}`;
                    const response = await fetch(url);
                    
                    if (!response.ok) {
                        throw new Error(`Error HTTP: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    
                    // Guardar en caché
                    this._saveToCache(data, cacheKey);
                    
                    return data;
                } catch (error) {
                    console.error('Error al obtener datos de precio:', error);
                    // Devolver null en lugar de lanzar error para que la aplicación siga funcionando
                    return null;
                }
            }
            
            /**
             * Guarda datos en la caché
             * @param {*} data - Datos a guardar
             * @param {string} key - Clave de caché (opcional)
             * @private
             */
            _saveToCache(data, key = this.options.cacheKey) {
                try {
                    const cacheData = {
                        data: data,
                        timestamp: Date.now(),
                        expiry: Date.now() + (this.options.cacheTime * 1000)
                    };
                    
                    // Guardar en memoria
                    this.cache[key] = cacheData;
                    
                    // Guardar en localStorage si está disponible
                    if (window.localStorage) {
                        localStorage.setItem(key, JSON.stringify(cacheData));
                    }
                } catch (error) {
                    console.warn('Error al guardar en caché:', error);
                    // No hacer nada, simplemente continuar sin caché
                }
            }
            
            /**
             * Carga datos de la caché
             * @param {string} key - Clave de caché (opcional)
             * @returns {Object|null} Datos en caché o null si no hay
             * @private
             */
            _loadFromCache(key = this.options.cacheKey) {
                try {
                    // Intentar cargar de memoria primero
                    if (this.cache[key]) {
                        return this.cache[key];
                    }
                    
                    // Si no está en memoria, intentar cargar de localStorage
                    if (window.localStorage) {
                        const cached = localStorage.getItem(key);
                        if (cached) {
                            const parsedCache = JSON.parse(cached);
                            // Actualizar caché en memoria
                            this.cache[key] = parsedCache;
                            return parsedCache;
                        }
                    }
                    
                    return null;
                } catch (error) {
                    console.warn('Error al cargar desde caché:', error);
                    return null;
                }
            }
            
            /**
             * Comprueba si la caché ha expirado
             * @param {number} timestamp - Timestamp de la caché
             * @returns {boolean} true si la caché ha expirado
             * @private
             */
            _isCacheExpired(timestamp) {
                const now = Date.now();
                const maxAge = this.options.cacheTime * 1000; // Convertir a milisegundos
                
                return (now - timestamp) > maxAge;
            }
            
            /**
             * Maneja errores de la aplicación
             * @param {Error} error - Error a manejar
             * @private
             */
            _handleError(error) {
                console.error('Error en el módulo de miedo y codicia:', error);
                
                // Mostrar mensaje de error al usuario
                const errorMessage = 'No se pudieron cargar los datos del índice de miedo y codicia. Por favor, inténtalo de nuevo más tarde.';
                
                // Actualizar UI con mensaje de error
                if (this.valueElement) {
                    this.valueElement.textContent = '--';
                }
                
                if (this.labelElement) {
                    this.labelElement.textContent = 'Error de carga';
                    this.labelElement.style.color = '#e74c3c';
                }
                
                if (this.interpretationElement) {
                    this.interpretationElement.textContent = errorMessage;
                }
                
                if (this.recommendationElement) {
                    this.recommendationElement.textContent = 'No hay recomendaciones disponibles en este momento.';
                }
                
                // Ocultar el indicador de carga
                this._hideLoading();
                
                // Si es un error de red, intentar cargar desde caché
                if (error.name === 'TypeError' && error.message.includes('fetch')) {
                    const cachedData = this._loadFromCache();
                    if (cachedData) {
                        console.log('Usando datos en caché debido a error de red');
                        this.currentValue = cachedData.data;
                        this._updateUI(this.currentValue);
                    }
                }
                
                // Mostrar notificación al usuario
                if ('Notification' in window && Notification.permission === 'granted') {
                    new Notification('Error en el Índice de Miedo y Codicia', {
                        body: errorMessage,
                        icon: '/assets/icons/error-icon.png'
                    });
                }
            }
            
            /**
             * Muestra una notificación de cambio significativo
             * @param {number} oldValue - Valor anterior
             * @param {number} newValue - Valor nuevo
             * @param {string} oldLevel - Nivel anterior
             * @param {string} newLevel - Nivel nuevo
             * @private
             */
            _showNotification(oldValue, newValue, oldLevel, newLevel) {
                console.log(`Cambio significativo en el índice: ${oldValue} (${oldLevel}) -> ${newValue} (${newLevel})`);
                
                // Verificar si las notificaciones están soportadas y permitidas
                if ('Notification' in window && Notification.permission === 'granted') {
                    let message;
                    
                    if (oldLevel !== newLevel) {
                        message = `El sentimiento del mercado ha cambiado de "${oldLevel}" a "${newLevel}". Valor actual: ${newValue}`;
                    } else {
                        const direction = newValue > oldValue ? 'aumentado' : 'disminuido';
                        message = `El índice ha ${direction} significativamente de ${oldValue} a ${newValue} (${newLevel})`;
                    }
                    
                    new Notification('Cambio en el Índice de Miedo y Codicia', {
                        body: message,
                        icon: '/assets/icons/notification-icon.png'
                    });
                }
                // Si las notificaciones no están permitidas, podríamos mostrar un toast o alerta en la UI
            }
            
            /**
             * Muestra el indicador de carga
             * @private
             */
            _showLoading() {
                if (this.loadingOverlay) {
                    this.loadingOverlay.style.display = 'flex';
                }
            }
            
            /**
             * Oculta el indicador de carga
             * @private
             */
            _hideLoading() {
                if (this.loadingOverlay) {
                    this.loadingOverlay.style.display = 'none';
                }
            }
        }

        // Exportar también una instancia predeterminada para uso rápido
        export const fearGreedIndex = new FearGreedIndex();

        // Inicializar el módulo cuando se carga la página
        document.addEventListener('DOMContentLoaded', () => {
            // Solicitar permiso para notificaciones si no se ha solicitado aún
            if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
                Notification.requestPermission();
            }
            
            // Inicializar el índice
            fearGreedIndex.init();
        });
    </script>
</body>
</html>
