<?php
require_once __DIR__ . '/../auth/db.php';
require_once __DIR__ . '/../auth/user.php';

class UserService {
    private $db;
    private $user;
    
    public function __construct() {
        $this->db = new Database();
        $this->user = new User();
    }
    
    // Guardar monedas favoritas del usuario
    public function saveFavoriteCoins($userId, $coins) {
        // Verificar si el usuario ya tiene preferencias
        $existing = $this->db->selectOne(
            "SELECT user_id FROM user_preferences WHERE user_id = ?",
            [$userId]
        );
        
        $coinsJson = json_encode($coins);
        
        if ($existing) {
            // Actualizar preferencias existentes
            return $this->db->execute(
                "UPDATE user_preferences SET favorite_coins = ?, updated_at = NOW() WHERE user_id = ?",
                [$coinsJson, $userId]
            );
        } else {
            // Crear nuevas preferencias
            return $this->db->insert(
                "INSERT INTO user_preferences (user_id, favorite_coins, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
                [$userId, $coinsJson]
            );
        }
    }
    
    // Obtener monedas favoritas del usuario
    public function getFavoriteCoins($userId) {
        $preferences = $this->db->selectOne(
            "SELECT favorite_coins FROM user_preferences WHERE user_id = ?",
            [$userId]
        );
        
        if (!$preferences || empty($preferences['favorite_coins'])) {
            return [];
        }
        
        return json_decode($preferences['favorite_coins'], true);
    }
    
    // Guardar tema preferido del usuario
    public function saveThemePreference($userId, $theme) {
        // Verificar si el usuario ya tiene preferencias
        $existing = $this->db->selectOne(
            "SELECT user_id FROM user_preferences WHERE user_id = ?",
            [$userId]
        );
        
        if ($existing) {
            // Actualizar preferencias existentes
            return $this->db->execute(
                "UPDATE user_preferences SET theme = ?, updated_at = NOW() WHERE user_id = ?",
                [$theme, $userId]
            );
        } else {
            // Crear nuevas preferencias
            return $this->db->insert(
                "INSERT INTO user_preferences (user_id, theme, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
                [$userId, $theme]
            );
        }
    }
    
    // Obtener preferencias del usuario
    public function getUserPreferences($userId) {
        $preferences = $this->db->selectOne(
            "SELECT theme, notification_enabled, favorite_coins FROM user_preferences WHERE user_id = ?",
            [$userId]
        );
        
        if (!$preferences) {
            // Preferencias por defecto
            return [
                'theme' => 'light',
                'notification_enabled' => true,
                'favorite_coins' => []
            ];
        }
        
        // Decodificar monedas favoritas si existen
        if (!empty($preferences['favorite_coins'])) {
            $preferences['favorite_coins'] = json_decode($preferences['favorite_coins'], true);
        } else {
            $preferences['favorite_coins'] = [];
        }
        
        return $preferences;
    }
    
    // Guardar preferencias de notificación
    public function saveNotificationPreference($userId, $enabled) {
        // Verificar si el usuario ya tiene preferencias
        $existing = $this->db->selectOne(
            "SELECT user_id FROM user_preferences WHERE user_id = ?",
            [$userId]
        );
        
        $enabled = $enabled ? 1 : 0;
        
        if ($existing) {
            // Actualizar preferencias existentes
            return $this->db->execute(
                "UPDATE user_preferences SET notification_enabled = ?, updated_at = NOW() WHERE user_id = ?",
                [$enabled, $userId]
            );
        } else {
            // Crear nuevas preferencias
            return $this->db->insert(
                "INSERT INTO user_preferences (user_id, notification_enabled, created_at, updated_at) VALUES (?, ?, NOW(), NOW())",
                [$userId, $enabled]
            );
        }
    }
    
    // Guardar historial de vistas de criptomonedas
    public function saveViewHistory($userId, $coinId) {
        // Guardar en historial de vistas
        return $this->db->execute(
            "INSERT INTO view_history (user_id, coin_id, viewed_at) VALUES (?, ?, NOW())
             ON DUPLICATE KEY UPDATE viewed_at = NOW()",
            [$userId, $coinId]
        );
    }
    
    // Obtener historial reciente de vistas
    public function getRecentViewHistory($userId, $limit = 10) {
        return $this->db->select(
            "SELECT coin_id, viewed_at FROM view_history 
             WHERE user_id = ? 
             ORDER BY viewed_at DESC 
             LIMIT ?",
            [$userId, $limit]
        );
    }
}
?>
