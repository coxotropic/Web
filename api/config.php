<?php
/**
 * config.php - Configuración principal de la API del portal de criptomonedas
 * 
 * Este archivo contiene todas las configuraciones básicas necesarias para
 * el funcionamiento de la API, incluyendo conexión a base de datos, rutas,
 * CORS, sesiones, claves de API externas, y más.
 * 
 * @author  Coxotropic CryptInvest Team
 * @version 1.0.0
 */

// Evitar acceso directo al archivo
if (!defined('API_ACCESS')) {
    header('HTTP/1.0 403 Forbidden');
    exit('Acceso directo a este archivo no permitido');
}

// Definir entorno (development, staging, production)
define('ENVIRONMENT', getenv('ENVIRONMENT') ?: 'development');

// Configuración específica según entorno
switch (ENVIRONMENT) {
    case 'development':
        error_reporting(E_ALL);
        ini_set('display_errors', 1);
        // Configuración de base de datos - Desarrollo
        define('DB_HOST', 'localhost');
        define('DB_NAME', 'cryptinvest_dev');
        define('DB_USER', 'dev_user');
        define('DB_PASS', 'dev_password');
        define('API_URL', 'http://localhost/api');
        define('FRONTEND_URL', 'http://localhost:8080');
        define('CACHE_ENABLED', false);
        define('LOG_LEVEL', 'debug'); // debug, info, warning, error
        break;
        
    case 'staging':
        error_reporting(E_ALL & ~E_NOTICE & ~E_DEPRECATED);
        ini_set('display_errors', 0);
        // Configuración de base de datos - Staging
        define('DB_HOST', 'staging-db-server');
        define('DB_NAME', 'cryptinvest_staging');
        define('DB_USER', 'staging_user');
        define('DB_PASS', 'staging_password');
        define('API_URL', 'https://staging-api.cryptinvest.com');
        define('FRONTEND_URL', 'https://staging.cryptinvest.com');
        define('CACHE_ENABLED', true);
        define('LOG_LEVEL', 'info');
        break;
        
    case 'production':
    default:
        error_reporting(0);
        ini_set('display_errors', 0);
        // Configuración de base de datos - Producción
        define('DB_HOST', getenv('DB_HOST') ?: 'production-db-server');
        define('DB_NAME', getenv('DB_NAME') ?: 'cryptinvest_prod');
        define('DB_USER', getenv('DB_USER') ?: 'prod_user');
        define('DB_PASS', getenv('DB_PASS') ?: 'prod_secure_password');
        define('API_URL', getenv('API_URL') ?: 'https://api.cryptinvest.com');
        define('FRONTEND_URL', getenv('FRONTEND_URL') ?: 'https://cryptinvest.com');
        define('CACHE_ENABLED', true);
        define('LOG_LEVEL', 'error');
        break;
}

// Opciones PDO para la conexión a la base de datos
define('PDO_OPTIONS', [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
    PDO::MYSQL_ATTR_INIT_COMMAND => "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci"
]);

// Configuración de la aplicación
define('APP_NAME', 'CryptInvest API');
define('APP_VERSION', '1.0.0');
define('API_PREFIX', '/v1');
define('SECRET_KEY', getenv('SECRET_KEY') ?: 'your_development_secret_key_change_in_production');

// Configuración de rutas
define('BASE_PATH', dirname(__DIR__));
define('API_PATH', BASE_PATH . '/api');
define('LOGS_PATH', BASE_PATH . '/logs');
define('CACHE_PATH', BASE_PATH . '/cache');
define('UPLOADS_PATH', BASE_PATH . '/uploads');

// Configuración de zona horaria
date_default_timezone_set('UTC');

// Configuración de CORS
$allowedOrigins = [FRONTEND_URL];
if (ENVIRONMENT !== 'production') {
    // En entornos no productivos, permitir orígenes adicionales para desarrollo
    $allowedOrigins[] = 'http://localhost:3000';
    $allowedOrigins[] = 'http://localhost:8080';
    $allowedOrigins[] = 'http://127.0.0.1:3000';
    $allowedOrigins[] = 'http://127.0.0.1:8080';
}
define('ALLOWED_ORIGINS', $allowedOrigins);
define('ALLOWED_METHODS', 'GET, POST, PUT, DELETE, OPTIONS');
define('ALLOWED_HEADERS', 'Origin, Content-Type, Accept, Authorization, X-Request-With, X-API-Key');
define('MAX_AGE', '3600'); // Pre-flight cache time in seconds

// Configuración de sesiones
define('SESSION_NAME', 'cryptinvest_session');
define('SESSION_LIFETIME', 86400); // 24 horas en segundos
define('SESSION_PATH', '/');
define('SESSION_DOMAIN', '');
define('SESSION_SECURE', ENVIRONMENT === 'production'); // Solo HTTPS en producción
define('SESSION_HTTPONLY', true);
define('SESSION_SAMESITE', 'Lax'); // None, Lax, Strict

// Claves API para servicios externos
define('COINGECKO_API_KEY', getenv('COINGECKO_API_KEY') ?: 'your_development_coingecko_api_key');
define('COINMARKETCAP_API_KEY', getenv('COINMARKETCAP_API_KEY') ?: 'your_development_coinmarketcap_api_key');
define('BINANCE_API_KEY', getenv('BINANCE_API_KEY') ?: 'your_development_binance_api_key');
define('BINANCE_API_SECRET', getenv('BINANCE_API_SECRET') ?: 'your_development_binance_api_secret');
define('CRYPTOCOMPARE_API_KEY', getenv('CRYPTOCOMPARE_API_KEY') ?: 'your_development_cryptocompare_api_key');
define('MESSARI_API_KEY', getenv('MESSARI_API_KEY') ?: 'your_development_messari_api_key');

// Configuración de caché
define('CACHE_DEFAULT_TTL', 300); // 5 minutos en segundos
define('CACHE_DRIVER', 'file'); // file, redis, memcached
define('REDIS_HOST', getenv('REDIS_HOST') ?: 'localhost');
define('REDIS_PORT', getenv('REDIS_PORT') ?: 6379);
define('REDIS_PASSWORD', getenv('REDIS_PASSWORD') ?: null);
define('MEMCACHED_HOST', getenv('MEMCACHED_HOST') ?: 'localhost');
define('MEMCACHED_PORT', getenv('MEMCACHED_PORT') ?: 11211);

// Límites de peticiones (Rate Limiting)
define('RATE_LIMIT_ENABLED', true);
define('RATE_LIMIT_REQUESTS', 60); // Número de peticiones permitidas
define('RATE_LIMIT_WINDOW', 60); // Ventana de tiempo en segundos (1 minuto)
define('RATE_LIMIT_BY', 'ip'); // ip, api_key, user_id

// Límites de tamaño de archivos para carga
define('MAX_UPLOAD_SIZE', 5 * 1024 * 1024); // 5 MB
define('ALLOWED_UPLOAD_EXTENSIONS', ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'csv', 'xlsx']);

// Configuración de seguridad
define('JWT_EXPIRATION', 3600); // 1 hora en segundos
define('JWT_REFRESH_EXPIRATION', 604800); // 1 semana en segundos
define('PASSWORD_MIN_LENGTH', 8);
define('FAILED_LOGIN_ATTEMPTS', 5);
define('FAILED_LOGIN_TIMEOUT', 300); // 5 minutos en segundos
define('API_KEY_LENGTH', 32);

// Configuración de logging
define('LOG_TO_FILE', true);
define('LOG_TO_DATABASE', ENVIRONMENT === 'production');
define('LOG_TO_SYSLOG', ENVIRONMENT === 'production');
define('LOG_FORMAT', '[%datetime%] %level_name%: %message% %context% %extra%\n');
define('LOG_MAX_FILES', 30); // Mantener 30 días de logs rotados
define('LOG_SLACK_WEBHOOK', getenv('LOG_SLACK_WEBHOOK') ?: '');
define('LOG_EMAIL_ERRORS', ENVIRONMENT === 'production');
define('LOG_EMAIL_TO', getenv('LOG_EMAIL_TO') ?: 'admin@cryptinvest.com');
define('LOG_EMAIL_FROM', getenv('LOG_EMAIL_FROM') ?: 'no-reply@cryptinvest.com');

// Configuración de correo electrónico
define('MAIL_DRIVER', getenv('MAIL_DRIVER') ?: 'smtp'); // smtp, sendmail, mail
define('MAIL_HOST', getenv('MAIL_HOST') ?: 'smtp.example.com');
define('MAIL_PORT', getenv('MAIL_PORT') ?: 587);
define('MAIL_USERNAME', getenv('MAIL_USERNAME') ?: 'username');
define('MAIL_PASSWORD', getenv('MAIL_PASSWORD') ?: 'password');
define('MAIL_ENCRYPTION', getenv('MAIL_ENCRYPTION') ?: 'tls'); // tls, ssl
define('MAIL_FROM_ADDRESS', getenv('MAIL_FROM_ADDRESS') ?: 'no-reply@cryptinvest.com');
define('MAIL_FROM_NAME', getenv('MAIL_FROM_NAME') ?: 'CryptInvest');

// Configuración de tokens y autenticación
define('AUTH_HEADER', 'Authorization');
define('AUTH_SCHEME', 'Bearer');
define('TOKEN_BLACKLIST_ENABLED', true);

// Configuración de mantenimiento
define('MAINTENANCE_MODE', false);
define('MAINTENANCE_UNTIL', '2023-12-31 23:59:59');
define('MAINTENANCE_ALLOWED_IPS', ['127.0.0.1']);

/**
 * Aplicación de configuraciones iniciales
 */

// Iniciar sesión con configuración segura
ini_set('session.cookie_httponly', SESSION_HTTPONLY);
ini_set('session.cookie_secure', SESSION_SECURE);
ini_set('session.cookie_samesite', SESSION_SAMESITE);
ini_set('session.use_strict_mode', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.use_trans_sid', 0);
ini_set('session.cookie_lifetime', SESSION_LIFETIME);
ini_set('session.gc_maxlifetime', SESSION_LIFETIME);
ini_set('session.cookie_path', SESSION_PATH);
if (SESSION_DOMAIN) {
    ini_set('session.cookie_domain', SESSION_DOMAIN);
}
session_name(SESSION_NAME);

// Crear directorios necesarios si no existen
$requiredDirs = [LOGS_PATH, CACHE_PATH, UPLOADS_PATH];
foreach ($requiredDirs as $dir) {
    if (!file_exists($dir)) {
        mkdir($dir, 0755, true);
    }
}

/**
 * Función para obtener la URL base actual
 * 
 * @return string La URL base de la API
 */
function getBaseUrl() {
    $protocol = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? 'localhost';
    $script = dirname($_SERVER['SCRIPT_NAME']);
    return $protocol . '://' . $host . $script;
}

/**
 * Función para cargar variables de entorno desde .env
 * Solo se ejecuta en desarrollo para mantener la seguridad
 */
function loadEnv() {
    if (ENVIRONMENT === 'development' && file_exists(BASE_PATH . '/.env')) {
        $lines = file(BASE_PATH . '/.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        foreach ($lines as $line) {
            if (strpos(trim($line), '#') === 0) {
                continue;
            }
            
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value);
            
            if (!array_key_exists($name, $_SERVER) && !array_key_exists($name, $_ENV)) {
                putenv(sprintf('%s=%s', $name, $value));
                $_ENV[$name] = $value;
                $_SERVER[$name] = $value;
            }
        }
    }
}

// Cargar variables de entorno en desarrollo
if (ENVIRONMENT === 'development') {
    loadEnv();
}

/**
 * Función para aplicar configuración CORS
 * Esta función debe llamarse al principio de cada script que maneje peticiones API
 */
function applyCors() {
    // Obtener el origen de la petición
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    
    // Verificar si el origen está permitido
    if (in_array($origin, ALLOWED_ORIGINS, true)) {
        header("Access-Control-Allow-Origin: $origin");
    } elseif (ENVIRONMENT !== 'production') {
        // En desarrollo, podemos ser más permisivos
        header("Access-Control-Allow-Origin: $origin");
    }
    
    // Resto de headers CORS
    header("Access-Control-Allow-Methods: " . ALLOWED_METHODS);
    header("Access-Control-Allow-Headers: " . ALLOWED_HEADERS);
    header("Access-Control-Max-Age: " . MAX_AGE);
    header("Access-Control-Allow-Credentials: true");
    
    // Manejar pre-flight requests
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        // Detener la ejecución para requests pre-flight
        exit(0);
    }
}

/**
 * Función para verificar si el sistema está en modo mantenimiento
 * 
 * @return bool True si el acceso debe ser bloqueado por mantenimiento
 */
function isInMaintenance() {
    if (!MAINTENANCE_MODE) {
        return false;
    }
    
    // Permitir IPs específicas durante el mantenimiento
    $clientIp = $_SERVER['REMOTE_ADDR'] ?? '';
    if (in_array($clientIp, MAINTENANCE_ALLOWED_IPS, true)) {
        return false;
    }
    
    return true;
}

/**
 * Función para crear una conexión a la base de datos
 * 
 * @return PDO Una instancia de PDO para conexión a la base de datos
 */
function getDatabaseConnection() {
    static $pdo = null;
    
    if ($pdo === null) {
        try {
            $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4';
            $pdo = new PDO($dsn, DB_USER, DB_PASS, PDO_OPTIONS);
        } catch (PDOException $e) {
            // Log error y devolver respuesta de error
            logError('Error de conexión a la base de datos: ' . $e->getMessage());
            
            header('Content-Type: application/json');
            http_response_code(500);
            echo json_encode([
                'status' => 'error',
                'message' => 'Error interno del servidor',
                'error_code' => 'db_connection_error'
            ]);
            exit;
        }
    }
    
    return $pdo;
}

/**
 * Función simple para registrar errores
 * 
 * @param string $message El mensaje de error a registrar
 * @param string $level El nivel de error (debug, info, warning, error)
 * @param array $context Datos adicionales relacionados con el error
 */
function logError($message, $level = 'error', $context = []) {
    // Verificar si el nivel de error debe ser registrado
    $logLevels = [
        'debug' => 0,
        'info' => 1,
        'warning' => 2,
        'error' => 3
    ];
    
    // Si el nivel actual es menor que el configurado, no registrar
    if ($logLevels[$level] < $logLevels[LOG_LEVEL]) {
        return;
    }
    
    // Formato básico de mensaje
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] [$level]: $message";
    
    // Añadir contexto si existe
    if (!empty($context)) {
        $logMessage .= " Context: " . json_encode($context);
    }
    
    // Añadir datos de la petición
    $requestInfo = [
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'method' => $_SERVER['REQUEST_METHOD'] ?? 'unknown',
        'uri' => $_SERVER['REQUEST_URI'] ?? 'unknown',
        'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'unknown'
    ];
    $logMessage .= " Request: " . json_encode($requestInfo);
    
    // Registrar en archivo
    if (LOG_TO_FILE) {
        $logFile = LOGS_PATH . '/' . date('Y-m-d') . '.log';
        error_log($logMessage . PHP_EOL, 3, $logFile);
    }
    
    // Registrar en base de datos (implementación básica)
    if (LOG_TO_DATABASE && $level !== 'debug') {
        try {
            $db = getDatabaseConnection();
            $query = "INSERT INTO system_logs (level, message, context, created_at) VALUES (?, ?, ?, NOW())";
            $stmt = $db->prepare($query);
            $stmt->execute([$level, $message, json_encode(array_merge($context, $requestInfo))]);
        } catch (Exception $e) {
            // Si falla el registro en BD, asegurar registro en archivo
            error_log("Error al registrar en BD: " . $e->getMessage() . PHP_EOL, 3, LOGS_PATH . '/db_errors.log');
        }
    }
    
    // Registrar en syslog para entornos de producción
    if (LOG_TO_SYSLOG && $level === 'error') {
        $priority = LOG_ERR;
        if ($level === 'warning') $priority = LOG_WARNING;
        if ($level === 'info') $priority = LOG_INFO;
        if ($level === 'debug') $priority = LOG_DEBUG;
        
        syslog($priority, $logMessage);
    }
    
    // Enviar correo para errores críticos en producción
    if (LOG_EMAIL_ERRORS && $level === 'error' && ENVIRONMENT === 'production') {
        // Implementación básica - en producción usar una librería de correo
        $subject = "[" . APP_NAME . "] Error crítico detectado";
        $headers = "From: " . LOG_EMAIL_FROM . "\r\n";
        $headers .= "Content-Type: text/plain; charset=UTF-8\r\n";
        @mail(LOG_EMAIL_TO, $subject, $logMessage, $headers);
    }
}

// Verificar modo mantenimiento
if (isInMaintenance()) {
    header('Content-Type: application/json');
    http_response_code(503);
    echo json_encode([
        'status' => 'error',
        'message' => 'Sistema en mantenimiento. Por favor, inténtelo más tarde.',
        'maintenance_until' => MAINTENANCE_UNTIL
    ]);
    exit;
}
?>
