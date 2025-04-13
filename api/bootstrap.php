<?php
/**
 * bootstrap.php
 * 
 * Punto de entrada e inicialización para la API del portal de criptomonedas
 * Este archivo configura todo el entorno necesario para procesar las solicitudes de API
 * 
 * @package CryptoPortal
 * @subpackage API
 */

// Prevenir acceso directo al archivo
if (!defined('API_ENTRY_POINT')) {
    header('HTTP/1.0 403 Forbidden');
    exit('Acceso prohibido');
}

// Configuración de visualización de errores (solo en desarrollo)
ini_set('display_errors', 0);
error_reporting(E_ALL);

// Definir constantes básicas
define('API_ROOT', dirname(__FILE__));
define('API_VERSION', '1.0.0');
define('IS_DEVELOPMENT', getenv('CRYPTO_PORTAL_ENV') === 'development');

// Zona horaria por defecto
date_default_timezone_set('UTC');

// Carga del autoloader de Composer
require_once API_ROOT . '/vendor/autoload.php';

// Cargar archivo de configuración
require_once API_ROOT . '/config.php';

// Configurar manejo de errores personalizado
function apiErrorHandler($errno, $errstr, $errfile, $errline) {
    $logMessage = date('Y-m-d H:i:s') . " - Error [$errno] $errstr - $errfile:$errline\n";
    error_log($logMessage, 3, Config::ERROR_LOG_PATH);
    
    if (IS_DEVELOPMENT) {
        echo json_encode([
            'status' => 'error',
            'message' => $errstr,
            'file' => $errfile,
            'line' => $errline
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'message' => 'Ha ocurrido un error en el servidor'
        ]);
    }
    exit;
}
set_error_handler('apiErrorHandler');

// Manejador de excepciones no capturadas
function apiExceptionHandler($exception) {
    $logMessage = date('Y-m-d H:i:s') . " - Excepción no capturada: " . $exception->getMessage() . 
                  " en " . $exception->getFile() . ":" . $exception->getLine() . "\n" .
                  $exception->getTraceAsString() . "\n";
    error_log($logMessage, 3, Config::ERROR_LOG_PATH);
    
    if (IS_DEVELOPMENT) {
        echo json_encode([
            'status' => 'error',
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'trace' => $exception->getTraceAsString()
        ]);
    } else {
        echo json_encode([
            'status' => 'error',
            'message' => 'Ha ocurrido un error en el servidor'
        ]);
    }
    exit;
}
set_exception_handler('apiExceptionHandler');

// Función de apagado para ejecutar al finalizar la solicitud
function apiShutdownFunction() {
    $error = error_get_last();
    if ($error !== null && ($error['type'] & (E_ERROR | E_PARSE | E_CORE_ERROR | E_COMPILE_ERROR | E_USER_ERROR))) {
        $logMessage = date('Y-m-d H:i:s') . " - Error fatal: " . $error['message'] . 
                      " en " . $error['file'] . ":" . $error['line'] . "\n";
        error_log($logMessage, 3, Config::ERROR_LOG_PATH);
        
        header('Content-Type: application/json');
        if (IS_DEVELOPMENT) {
            echo json_encode([
                'status' => 'error',
                'message' => $error['message'],
                'file' => $error['file'],
                'line' => $error['line']
            ]);
        } else {
            echo json_encode([
                'status' => 'error',
                'message' => 'Ha ocurrido un error fatal en el servidor'
            ]);
        }
    }
}
register_shutdown_function('apiShutdownFunction');

// Configuración de cabeceras HTTP para CORS
header('Access-Control-Allow-Origin: ' . Config::ALLOWED_ORIGINS);
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Access-Control-Max-Age: 86400'); // 24 horas

// Para solicitudes OPTIONS (preflight)
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    header('HTTP/1.1 200 OK');
    exit;
}

// Configurar tipo de contenido por defecto como JSON
header('Content-Type: application/json; charset=UTF-8');

// Iniciar sesión segura
ini_set('session.cookie_httponly', 1);
ini_set('session.cookie_secure', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_samesite', 'Strict');
session_name('crypto_portal_session');
session_start();

// Conexión a la base de datos utilizando PDO
try {
    $dsn = 'mysql:host=' . Config::DB_HOST . ';dbname=' . Config::DB_NAME . ';charset=utf8mb4';
    $options = [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ];
    $pdo = new PDO($dsn, Config::DB_USER, Config::DB_PASS, $options);
    
    // Disponible globalmente a través de Registry (patrón de registro)
    Registry::set('db', $pdo);
} catch (PDOException $e) {
    // Registrar error de conexión pero no mostrar detalles sensibles
    error_log(date('Y-m-d H:i:s') . " - Error de conexión a BD: " . $e->getMessage() . "\n", 3, Config::ERROR_LOG_PATH);
    echo json_encode([
        'status' => 'error',
        'message' => 'Error de conexión a la base de datos'
    ]);
    exit;
}

// Inicializar servicio de autenticación
$authService = new AuthService($pdo);
Registry::set('auth', $authService);

// Inicializar servicio de logs
$logger = new Logger($pdo);
Registry::set('logger', $logger);

// Inicializar servicios de mercado
$marketService = new MarketService();
Registry::set('market', $marketService);

// Inicializar servicio de noticias
$newsService = new NewsService();
Registry::set('news', $newsService);

// Inicializar servicio de usuario
$userService = new UserService($pdo, $authService);
Registry::set('user', $userService);

// Inicializar gestor de Rate Limiting
$rateLimiter = new RateLimiter($pdo);
Registry::set('rateLimiter', $rateLimiter);

// Validar API Key si está configurada
if (Config::REQUIRE_API_KEY) {
    $apiKey = null;
    
    // Intentar obtener API key del header
    if (isset($_SERVER['HTTP_X_API_KEY'])) {
        $apiKey = $_SERVER['HTTP_X_API_KEY'];
    }
    // O del parámetro GET como fallback
    elseif (isset($_GET['api_key'])) {
        $apiKey = $_GET['api_key'];
    }
    
    // Validar la API key
    if ($apiKey === null || !$authService->validateApiKey($apiKey)) {
        header('HTTP/1.1 401 Unauthorized');
        echo json_encode([
            'status' => 'error',
            'message' => 'API key inválida o no proporcionada'
        ]);
        exit;
    }
}

// Verificar límite de peticiones (rate limiting)
$clientIp = $_SERVER['REMOTE_ADDR'];
if (!$rateLimiter->checkLimit($clientIp)) {
    header('HTTP/1.1 429 Too Many Requests');
    echo json_encode([
        'status' => 'error',
        'message' => 'Demasiadas peticiones. Por favor, inténtelo de nuevo más tarde.'
    ]);
    exit;
}

// Registrar petición en logs
$logger->logApiRequest($_SERVER['REQUEST_URI'], $_SERVER['REQUEST_METHOD'], $clientIp);

// Parseamos el cuerpo de la petición JSON si corresponde
$requestBody = null;
if ($_SERVER['REQUEST_METHOD'] !== 'GET' && $_SERVER['REQUEST_METHOD'] !== 'OPTIONS') {
    $requestBody = file_get_contents('php://input');
    if (!empty($requestBody)) {
        $requestBody = json_decode($requestBody, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            echo json_encode([
                'status' => 'error',
                'message' => 'Error al parsear JSON: ' . json_last_error_msg()
            ]);
            exit;
        }
    }
}

// Guardar el body de la petición para uso posterior
Registry::set('requestBody', $requestBody);

// Preparar el enrutamiento de la solicitud
// En este punto todo está listo para que el router procese la solicitud
// El router se incluirá en el archivo index.php después de bootstrap.php

// Final del archivo bootstrap.php
?>
