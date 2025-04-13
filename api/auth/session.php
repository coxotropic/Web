<?php
require_once 'config.php';

class Session {
    public function __construct() {
        if (session_status() === PHP_SESSION_NONE) {
            session_start();
        }
        
        // Regenerar ID de sesión periódicamente para prevenir session fixation
        if (!isset($_SESSION['created'])) {
            $_SESSION['created'] = time();
        } else if (time() - $_SESSION['created'] > 1800) {
            // Regenerar ID de sesión cada 30 minutos
            session_regenerate_id(true);
            $_SESSION['created'] = time();
        }
    }
    
    // Iniciar sesión para un usuario
    public function start($user) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['username'] = $user['username'];
        $_SESSION['email'] = $user['email'];
        $_SESSION['logged_in'] = true;
        $_SESSION['last_activity'] = time();
    }
    
    // Verificar si el usuario está autenticado
    public function isAuthenticated() {
        if (isset($_SESSION['logged_in']) && $_SESSION['logged_in'] === true) {
            // Verificar tiempo de inactividad
            if (time() - $_SESSION['last_activity'] < SESSION_LIFETIME) {
                $_SESSION['last_activity'] = time();
                return true;
            } else {
                // La sesión ha expirado
                $this->end();
            }
        }
        return false;
    }
    
    // Finalizar sesión
    public function end() {
        $_SESSION = [];
        
        // Eliminar la cookie de sesión si existe
        if (ini_get("session.use_cookies")) {
            $params = session_get_cookie_params();
            setcookie(
                session_name(),
                '',
                time() - 42000,
                $params["path"],
                $params["domain"],
                $params["secure"],
                $params["httponly"]
            );
        }
        
        session_destroy();
    }
    
    // Obtener el ID del usuario autenticado
    public function getUserId() {
        return isset($_SESSION['user_id']) ? $_SESSION['user_id'] : null;
    }
    
    // Obtener datos del usuario en sesión
    public function getUserData() {
        if (!$this->isAuthenticated()) {
            return null;
        }
        
        return [
            'id' => $_SESSION['user_id'],
            'username' => $_SESSION['username'],
            'email' => $_SESSION['email']
        ];
    }
}
?>
