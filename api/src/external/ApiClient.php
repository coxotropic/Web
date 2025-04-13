<?php
/**
 * ApiClient.php
 * Cliente base para integraciones con APIs externas
 */

namespace CryptoInvest\External;

use CryptoInvest\Cache\CacheManager;
use CryptoInvest\Exceptions\ApiException;

abstract class ApiClient {
    /**
     * URL base de la API
     * @var string
     */
    protected $baseUrl;
    
    /**
     * Clave API para autenticación
     * @var string
     */
    protected $apiKey;
    
    /**
     * Secreto API para autenticación (si es necesario)
     * @var string
     */
    protected $apiSecret;
    
    /**
     * Tiempo de espera para solicitudes en segundos
     * @var int
     */
    protected $timeout = 30;
    
    /**
     * Número máximo de reintentos para solicitudes fallidas
     * @var int
     */
    protected $maxRetries = 3;
    
    /**
     * Intervalo entre reintentos en milisegundos
     * @var int
     */
    protected $retryInterval = 1000;
    
    /**
     * Instancia del gestor de caché
     * @var CacheManager
     */
    protected $cache;
    
    /**
     * Nombre del proveedor de API para logs
     * @var string
     */
    protected $providerName;
    
    /**
     * Límites de tasa para peticiones (rate limits)
     * @var array
     */
    protected $rateLimits = [];
    
    /**
     * Timestamp del último request para cada endpoint
     * @var array
     */
    protected $lastRequestTimes = [];
    
    /**
     * Constructor
     * 
     * @param string $baseUrl URL base de la API
     * @param string $apiKey Clave API (opcional)
     * @param string $apiSecret Secreto API (opcional)
     */
    public function __construct($baseUrl, $apiKey = null, $apiSecret = null) {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->apiKey = $apiKey;
        $this->apiSecret = $apiSecret;
        $this->cache = CACHE_ENABLED ? CacheManager::getInstance() : null;
        $this->providerName = $this->getProviderName();
    }
    
    /**
     * Obtiene el nombre del proveedor de API para logs y caché
     * 
     * @return string Nombre del proveedor
     */
    abstract protected function getProviderName();
    
    /**
     * Realiza una solicitud GET a la API
     * 
     * @param string $endpoint Endpoint relativo (sin la URL base)
     * @param array $params Parámetros de consulta (query string)
     * @param array $headers Cabeceras HTTP adicionales
     * @param bool $useCache Si se debe usar caché para esta solicitud
     * @param int $cacheTTL Tiempo de vida de la caché en segundos
     * @return mixed Respuesta de la API procesada
     * @throws ApiException Si ocurre un error en la API
     */
    public function get($endpoint, array $params = [], array $headers = [], $useCache = true, $cacheTTL = null) {
        // Construir clave de caché si está habilitada
        $cacheKey = null;
        if ($useCache && $this->cache) {
            $cacheKey = $this->buildCacheKey('GET', $endpoint, $params);
            $cachedData = $this->cache->get($cacheKey);
            if ($cachedData !== null) {
                $this->logRequest('GET', $endpoint, $params, 'CACHE_HIT');
                return $cachedData;
            }
        }
        
        // Preparar URL completa
        $url = $this->buildUrl($endpoint, $params);
        
        // Respetar límites de tasa (rate limits)
        $this->respectRateLimit($endpoint);
        
        // Inicializar cURL
        $ch = curl_init();
        
        // Configurar opciones de cURL
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
        curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $this->buildHeaders($headers));
        
        // Ejecutar la solicitud con reintentos en caso de fallo
        $response = $this->executeWithRetries($ch, 'GET', $endpoint, $params);
        
        // Procesar la respuesta
        $data = $this->processResponse($response);
        
        // Almacenar en caché si está habilitada
        if ($useCache && $this->cache && $cacheKey) {
            $ttl = $cacheTTL ?: $this->getDefaultCacheTTL($endpoint);
            $this->cache->set($cacheKey, $data, $ttl);
        }
        
        return $data;
    }
    
    /**
     * Realiza una solicitud POST a la API
     * 
     * @param string $endpoint Endpoint relativo (sin la URL base)
     * @param array $data Datos a enviar en el cuerpo de la solicitud
     * @param array $headers Cabeceras HTTP adicionales
     * @return mixed Respuesta de la API procesada
     * @throws ApiException Si ocurre un error en la API
     */
    public function post($endpoint, array $data = [], array $headers = []) {
        // Preparar URL completa
        $url = $this->buildUrl($endpoint);
        
        // Respetar límites de tasa (rate limits)
        $this->respectRateLimit($endpoint);
        
        // Inicializar cURL
        $ch = curl_init();
        
        // Configurar opciones de cURL
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
        curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $this->buildHeaders($headers));
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $this->preparePostData($data));
        
        // Ejecutar la solicitud con reintentos en caso de fallo
        $response = $this->executeWithRetries($ch, 'POST', $endpoint, $data);
        
        // Procesar la respuesta
        return $this->processResponse($response);
    }
    
    /**
     * Realiza una solicitud PUT a la API
     * 
     * @param string $endpoint Endpoint relativo (sin la URL base)
     * @param array $data Datos a enviar en el cuerpo de la solicitud
     * @param array $headers Cabeceras HTTP adicionales
     * @return mixed Respuesta de la API procesada
     * @throws ApiException Si ocurre un error en la API
     */
    public function put($endpoint, array $data = [], array $headers = []) {
        // Preparar URL completa
        $url = $this->buildUrl($endpoint);
        
        // Respetar límites de tasa (rate limits)
        $this->respectRateLimit($endpoint);
        
        // Inicializar cURL
        $ch = curl_init();
        
        // Configurar opciones de cURL
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
        curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $this->buildHeaders($headers));
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $this->preparePostData($data));
        
        // Ejecutar la solicitud con reintentos en caso de fallo
        $response = $this->executeWithRetries($ch, 'PUT', $endpoint, $data);
        
        // Procesar la respuesta
        return $this->processResponse($response);
    }
    
    /**
     * Realiza una solicitud DELETE a la API
     * 
     * @param string $endpoint Endpoint relativo (sin la URL base)
     * @param array $params Parámetros de consulta (query string)
     * @param array $headers Cabeceras HTTP adicionales
     * @return mixed Respuesta de la API procesada
     * @throws ApiException Si ocurre un error en la API
     */
    public function delete($endpoint, array $params = [], array $headers = []) {
        // Preparar URL completa
        $url = $this->buildUrl($endpoint, $params);
        
        // Respetar límites de tasa (rate limits)
        $this->respectRateLimit($endpoint);
        
        // Inicializar cURL
        $ch = curl_init();
        
        // Configurar opciones de cURL
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 3);
        curl_setopt($ch, CURLOPT_HTTP_VERSION, CURL_HTTP_VERSION_1_1);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $this->buildHeaders($headers));
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        
        // Ejecutar la solicitud con reintentos en caso de fallo
        $response = $this->executeWithRetries($ch, 'DELETE', $endpoint, $params);
        
        // Procesar la respuesta
        return $this->processResponse($response);
    }
    
    /**
     * Ejecuta una solicitud cURL con reintentos automáticos en caso de fallo
     * 
     * @param resource $ch Recurso cURL
     * @param string $method Método HTTP
     * @param string $endpoint Endpoint para logs
     * @param array $params Parámetros para logs
     * @return array Respuesta con cuerpo y cabeceras
     * @throws ApiException Si todos los reintentos fallan
     */
    protected function executeWithRetries($ch, $method, $endpoint, $params) {
        $attempts = 0;
        $lastError = null;
        
        do {
            // Si no es el primer intento, esperar antes de reintentar
            if ($attempts > 0) {
                usleep($this->retryInterval * 1000);
            }
            
            // Ejecutar la solicitud
            $responseBody = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $error = curl_error($ch);
            $errorNo = curl_errno($ch);
            
            // Registrar la solicitud en los logs
            $status = $error ? "ERROR: {$error}" : "HTTP {$httpCode}";
            $this->logRequest($method, $endpoint, $params, $status);
            
            // Verificar si la solicitud fue exitosa
            if ($responseBody !== false && $errorNo === 0) {
                // Algunas APIs devuelven códigos de éxito no estándar
                if ($this->isSuccessfulResponse($httpCode, $responseBody)) {
                    break;
                }
                
                // Si es un error temporal que merece reintento
                if ($this->shouldRetry($httpCode, $responseBody)) {
                    $lastError = "HTTP Error {$httpCode}";
                    $attempts++;
                    continue;
                }
                
                // No es un error temporal, no reintentar
                curl_close($ch);
                throw new ApiException(
                    $this->getErrorMessage($responseBody, $httpCode),
                    $httpCode
                );
            }
            
            // Error de conexión, reintentar
            $lastError = $error ?: "Error de conexión desconocido";
            $attempts++;
            
        } while ($attempts < $this->maxRetries);
        
        // Si se agotaron los reintentos
        if ($attempts >= $this->maxRetries) {
            curl_close($ch);
            throw new ApiException(
                "Error después de {$this->maxRetries} intentos: {$lastError}",
                0
            );
        }
        
        // Construir respuesta completa
        $response = [
            'body' => $responseBody,
            'httpCode' => $httpCode,
            'headers' => $this->getResponseHeaders($ch)
        ];
        
        curl_close($ch);
        return $response;
    }
    
    /**
     * Procesa la respuesta de la API
     * 
     * @param array $response Respuesta con cuerpo y cabeceras
     * @return mixed Datos procesados
     * @throws ApiException Si hay un error en la respuesta
     */
    protected function processResponse($response) {
        $body = $response['body'];
        $httpCode = $response['httpCode'];
        
        // Intentar decodificar como JSON
        $data = json_decode($body, true);
        
        // Verificar si la decodificación JSON fue exitosa
        if (json_last_error() !== JSON_ERROR_NONE) {
            // No es JSON o está malformado
            if ($httpCode >= 400) {
                throw new ApiException(
                    "Error HTTP {$httpCode}: " . substr($body, 0, 200),
                    $httpCode
                );
            }
            
            // No es JSON pero es una respuesta exitosa
            return $body;
        }
        
        // Verificar errores específicos de la API
        if ($this->isErrorResponse($data, $httpCode)) {
            throw new ApiException(
                $this->getErrorMessage($data, $httpCode),
                $httpCode
            );
        }
        
        return $data;
    }
    
    /**
     * Construye la URL completa para una solicitud
     * 
     * @param string $endpoint Endpoint relativo
     * @param array $params Parámetros de consulta
     * @return string URL completa
     */
    protected function buildUrl($endpoint, array $params = []) {
        // Asegurar que el endpoint comienza con /
        $endpoint = '/' . ltrim($endpoint, '/');
        
        // Construir URL base
        $url = $this->baseUrl . $endpoint;
        
        // Añadir clave API al query string si existe y es necesario
        if ($this->apiKey && $this->shouldAddApiKey($endpoint)) {
            $params = array_merge($params, $this->getApiKeyParam());
        }
        
        // Añadir parámetros de consulta
        if (!empty($params)) {
            $queryString = http_build_query($params);
            $url .= (strpos($url, '?') === false) ? '?' : '&';
            $url .= $queryString;
        }
        
        return $url;
    }
    
    /**
     * Construye las cabeceras HTTP para una solicitud
     * 
     * @param array $additionalHeaders Cabeceras adicionales
     * @return array Cabeceras completas
     */
    protected function buildHeaders(array $additionalHeaders = []) {
        // Cabeceras base
        $headers = [
            'Accept: application/json',
            'User-Agent: CryptoInvestAPI/1.0',
        ];
        
        // Añadir cabeceras específicas del cliente
        $customHeaders = $this->getCustomHeaders();
        if (!empty($customHeaders)) {
            foreach ($customHeaders as $name => $value) {
                $headers[] = "{$name}: {$value}";
            }
        }
        
        // Añadir cabeceras adicionales
        if (!empty($additionalHeaders)) {
            foreach ($additionalHeaders as $name => $value) {
                $headers[] = "{$name}: {$value}";
            }
        }
        
        return $headers;
    }
    
    /**
     * Prepara los datos para solicitudes POST o PUT
     * 
     * @param array $data Datos a preparar
     * @return string Datos preparados
     */
    protected function preparePostData(array $data) {
        // Por defecto, codificar como JSON
        return json_encode($data);
    }
    
    /**
     * Construye una clave única para caché
     * 
     * @param string $method Método HTTP
     * @param string $endpoint Endpoint
     * @param array $params Parámetros
     * @return string Clave de caché
     */
    protected function buildCacheKey($method, $endpoint, array $params = []) {
        // Ordenar parámetros para consistencia en las claves
        ksort($params);
        
        // Construir clave
        $key = $this->providerName . '_' . $method . '_' . $endpoint;
        
        if (!empty($params)) {
            $key .= '_' . md5(json_encode($params));
        }
        
        return $key;
    }
    
    /**
     * Obtiene las cabeceras de la respuesta HTTP
     * 
     * @param resource $ch Recurso cURL
     * @return array Cabeceras
     */
    protected function getResponseHeaders($ch) {
        $headerSize = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
        $headerStr = substr(curl_exec($ch), 0, $headerSize);
        $headers = [];
        
        foreach (explode("\r\n", $headerStr) as $i => $line) {
            if ($i === 0) {
                // Primera línea, contiene código de estado
                continue;
            }
            
            $parts = explode(':', $line, 2);
            if (count($parts) === 2) {
                $headers[trim($parts[0])] = trim($parts[1]);
            }
        }
        
        return $headers;
    }
    
    /**
     * Registra una solicitud en los logs
     * 
     * @param string $method Método HTTP
     * @param string $endpoint Endpoint
     * @param array $params Parámetros
     * @param string $status Estado de la respuesta
     */
    protected function logRequest($method, $endpoint, array $params, $status) {
        if (LOG_ENABLED && (LOG_LEVEL === 'DEBUG' || $status !== 'CACHE_HIT')) {
            $paramsStr = !empty($params) ? json_encode($params) : '';
            $message = date('[Y-m-d H:i:s]') . " {$this->providerName} API: {$method} {$endpoint} {$paramsStr} - {$status}";
            
            $logFile = LOG_PATH . '/api_' . date('Y-m-d') . '.log';
            error_log($message . PHP_EOL, 3, $logFile);
        }
    }
    
    /**
     * Respeta los límites de tasa (rate limits) haciendo una pausa si es necesario
     * 
     * @param string $endpoint Endpoint para verificar límites específicos
     */
    protected function respectRateLimit($endpoint) {
        // Buscar límite específico para este endpoint
        $limit = null;
        foreach ($this->rateLimits as $pattern => $rateLimit) {
            if (preg_match($pattern, $endpoint)) {
                $limit = $rateLimit;
                break;
            }
        }
        
        // Si no hay límite específico, usar el global
        if (!$limit && isset($this->rateLimits['global'])) {
            $limit = $this->rateLimits['global'];
        }
        
        // Si no hay límites configurados, salir
        if (!$limit) {
            return;
        }
        
        // Verificar tiempo desde la última solicitud
        $key = $limit['key'] ?? 'global';
        $now = microtime(true);
        $lastRequest = $this->lastRequestTimes[$key] ?? 0;
        $timeSince = $now - $lastRequest;
        
        // Calcular tiempo mínimo entre solicitudes en segundos
        $minTime = 1 / $limit['limit'];
        
        // Si no ha pasado suficiente tiempo, esperar
        if ($timeSince < $minTime) {
            $waitTime = ($minTime - $timeSince) * 1000000; // convertir a microsegundos
            usleep($waitTime);
        }
        
        // Actualizar último tiempo de solicitud
        $this->lastRequestTimes[$key] = microtime(true);
    }
    
    /**
     * Devuelve el tiempo de vida en caché predeterminado para un endpoint
     * 
     * @param string $endpoint Endpoint
     * @return int Tiempo de vida en segundos
     */
    protected function getDefaultCacheTTL($endpoint) {
        // Implementación básica que puede ser sobrescrita por clases hijas
        return CACHE_DEFAULT_EXPIRY;
    }
    
    /**
     * Verifica si una respuesta es exitosa basada en el código HTTP y el cuerpo
     * 
     * @param int $httpCode Código de estado HTTP
     * @param string $responseBody Cuerpo de la respuesta
     * @return bool Si la respuesta es exitosa
     */
    protected function isSuccessfulResponse($httpCode, $responseBody) {
        // Por defecto, 2xx es exitoso
        return $httpCode >= 200 && $httpCode < 300;
    }
    
    /**
     * Verifica si una respuesta contiene un error según la API específica
     * 
     * @param mixed $data Datos procesados
     * @param int $httpCode Código de estado HTTP
     * @return bool Si la respuesta contiene un error
     */
    protected function isErrorResponse($data, $httpCode) {
        // Por defecto, 4xx y 5xx son errores
        return $httpCode >= 400;
    }
    
    /**
     * Extrae mensaje de error de una respuesta
     * 
     * @param mixed $data Datos procesados o cuerpo de respuesta
     * @param int $httpCode Código de estado HTTP
     * @return string Mensaje de error
     */
    protected function getErrorMessage($data, $httpCode) {
        // Implementación básica que puede ser sobrescrita por clases hijas
        if (is_array($data) && isset($data['error'])) {
            return is_array($data['error']) 
                ? ($data['error']['message'] ?? json_encode($data['error']))
                : $data['error'];
        }
        
        if (is_array($data) && isset($data['message'])) {
            return $data['message'];
        }
        
        return "Error HTTP {$httpCode}";
    }
    
    /**
     * Determina si se debe reintentar una solicitud basada en el código HTTP y la respuesta
     * 
     * @param int $httpCode Código de estado HTTP
     * @param string $responseBody Cuerpo de la respuesta
     * @return bool Si se debe reintentar
     */
    protected function shouldRetry($httpCode, $responseBody) {
        // Reintentar para errores temporales o de servidor
        return (
            $httpCode === 429 || // Too Many Requests
            $httpCode === 503 || // Service Unavailable
            $httpCode === 504 || // Gateway Timeout
            ($httpCode >= 500 && $httpCode < 600) // Server errors
        );
    }
    
    /**
     * Determina si se debe añadir la clave API a los parámetros para un endpoint
     * 
     * @param string $endpoint Endpoint
     * @return bool Si se debe añadir la clave API
     */
    protected function shouldAddApiKey($endpoint) {
        // Por defecto, añadir a todos los endpoints
        return true;
    }
    
    /**
     * Devuelve los parámetros para incluir la clave API
     * 
     * @return array Parámetros con la clave API
     */
    protected function getApiKeyParam() {
        // Implementación básica que puede ser sobrescrita por clases hijas
        return ['api_key' => $this->apiKey];
    }
    
    /**
     * Devuelve cabeceras personalizadas para el cliente específico
     * 
     * @return array Cabeceras personalizadas
     */
    protected function getCustomHeaders() {
        // Implementación básica que puede ser sobrescrita por clases hijas
        return [];
    }
}
