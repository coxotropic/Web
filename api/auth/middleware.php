<?php
require_once 'session.php';

class AuthMiddleware {
    private $session;
    
    public function __construct() {
        $this->session = new Session();
    }
    
    // Verificar si el usuario está autenticado
    public function requireAuth() {
        if (!$this->session->isAuthenticated()) {
            header('HTTP/1.1 401 Unauthorized');
            jsonResponse('error', 'No autorizado', null, 401);
            exit;
        }
    }
    
    // Verificar si es una solicitud AJAX
    public function requireAjax() {
        $isAjax = isset($_SERVER['HTTP_X_REQUESTED_WITH']) && 
                  strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
        
        if (!$isAjax) {
            header('HTTP/1.1 403 Forbidden');
            jsonResponse('error', 'Se requiere una solicitud AJAX', null, 403);
            exit;
        }
    }
    
    // Verificar método de solicitud
    public function requireMethod($method) {
        if ($_SERVER['REQUEST_METHOD'] !== $method) {
            header('HTTP/1.1 405 Method Not Allowed');
            header('Allow: ' . $method);
            jsonResponse('error', 'Método no permitido', null, 405);
            exit;
        }
    }
    
    // Verificar CSRF token (implementación básica)
    public function verifyCsrfToken() {
        // Esta es una implementación simplificada, deberías mejorarla en producción
        if (!isset($_SERVER['HTTP_X_CSRF_TOKEN']) || 
            !isset($_SESSION['csrf_token']) || 
            $_SERVER['HTTP_X_CSRF_TOKEN'] !== $_SESSION['csrf_token']) {
            
            header('HTTP/1.1 403 Forbidden');
            jsonResponse('error', 'Token CSRF inválido', null, 403);
            exit;
        }
    }
    
    // Generar un nuevo token CSRF
    public function generateCsrfToken() {
        if (!isset($_SESSION['csrf_token'])) {
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
        }
        return $_SESSION['csrf_token'];
    }
}

// Función de ayuda para usar el middleware fácilmente
function auth() {
    static $middleware = null;
    if ($middleware === null) {
        $middleware = new AuthMiddleware();
    }
    return $middleware;
}
?>
