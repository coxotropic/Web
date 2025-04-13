<?php
// Configuración de la base de datos
define('DB_HOST', 'localhost');
define('DB_USER', 'PON_AQUI_USUARIO');  // Cambia esto por tu usuario de base de datos
define('DB_PASS', 'PON_AQUI_PASS');  // Cambia esto por tu contraseña
define('DB_NAME', 'crypto_app');

// Configuración de sesiones
ini_set('session.cookie_httponly', 1);
ini_set('session.use_only_cookies', 1);
ini_set('session.cookie_secure', 0);  // Cambia a 1 si usas HTTPS
session_cache_limiter('private_no_expire');

// Configuración de seguridad
define('HASH_COST', 10);  // Factor de costo para password_hash

// Tiempo de vida de las sesiones (2 horas en segundos)
define('SESSION_LIFETIME', 7200);
ini_set('session.gc_maxlifetime', SESSION_LIFETIME);

// URL base de la API
define('API_BASE_URL', '/api');

// Función para generar respuestas JSON
function jsonResponse($status, $message, $data = null) {
    header('Content-Type: application/json');
    echo json_encode([
        'status' => $status,
        'message' => $message,
        'data' => $data
    ]);
    exit;
}
?>
