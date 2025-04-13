<?php
require_once 'db.php';

class User {
    private $db;
    
    public function __construct() {
        $this->db = new Database();
    }
    
    // Registrar un nuevo usuario
    public function register($username, $email, $password) {
        // Verificar si el usuario ya existe
        $existingUser = $this->db->selectOne(
            "SELECT id FROM users WHERE username = ? OR email = ?", 
            [$username, $email]
        );
        
        if ($existingUser) {
            return false;
        }
        
        // Encriptar contraseña
        $hashedPassword = password_hash($password, PASSWORD_BCRYPT, ['cost' => HASH_COST]);
        
        // Crear usuario
        $userId = $this->db->insert(
            "INSERT INTO users (username, email, password, created_at) VALUES (?, ?, ?, NOW())",
            [$username, $email, $hashedPassword]
        );
        
        return $userId;
    }
    
    // Verificar credenciales de login
    public function login($email, $password) {
        $user = $this->db->selectOne(
            "SELECT id, username, email, password FROM users WHERE email = ?",
            [$email]
        );
        
        if (!$user || !password_verify($password, $user['password'])) {
            return false;
        }
        
        // Actualizar último inicio de sesión
        $this->db->execute(
            "UPDATE users SET last_login = NOW() WHERE id = ?",
            [$user['id']]
        );
        
        // No devolver la contraseña
        unset($user['password']);
        return $user;
    }
    
    // Obtener información del usuario por ID
    public function getUserById($id) {
        $user = $this->db->selectOne(
            "SELECT id, username, email, created_at, last_login FROM users WHERE id = ?",
            [$id]
        );
        
        return $user;
    }
    
    // Actualizar perfil de usuario
    public function updateProfile($userId, $data) {
        $allowedFields = ['username', 'email', 'bio', 'profile_image'];
        $updates = [];
        $params = [];
        
        foreach ($data as $key => $value) {
            if (in_array($key, $allowedFields)) {
                $updates[] = "$key = ?";
                $params[] = $value;
            }
        }
        
        if (empty($updates)) {
            return false;
        }
        
        $params[] = $userId;
        $query = "UPDATE users SET " . implode(", ", $updates) . " WHERE id = ?";
        
        return $this->db->execute($query, $params);
    }
    
    // Cambiar contraseña
    public function changePassword($userId, $currentPassword, $newPassword) {
        $user = $this->db->selectOne(
            "SELECT password FROM users WHERE id = ?",
            [$userId]
        );
        
        if (!$user || !password_verify($currentPassword, $user['password'])) {
            return false;
        }
        
        $hashedPassword = password_hash($newPassword, PASSWORD_BCRYPT, ['cost' => HASH_COST]);
        
        return $this->db->execute(
            "UPDATE users SET password = ? WHERE id = ?",
            [$hashedPassword, $userId]
        );
    }
}
?>
