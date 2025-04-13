<?php
require_once '../config.php';

try {
    // Conectar a MySQL sin seleccionar una base de datos
    $pdo = new PDO(
        "mysql:host=" . DB_HOST,
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    
    // Crear la base de datos si no existe
    $pdo->exec("CREATE DATABASE IF NOT EXISTS " . DB_NAME . " CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    
    echo "Base de datos creada correctamente.\n";
    
    // Seleccionar la base de datos
    $pdo->exec("USE " . DB_NAME);
    
    // Crear tabla de usuarios
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(50) NOT NULL UNIQUE,
            email VARCHAR(100) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL,
            bio TEXT,
            profile_image VARCHAR(255),
            created_at DATETIME NOT NULL,
            last_login DATETIME,
            INDEX (username),
            INDEX (email)
        ) ENGINE=InnoDB
    ");
    
    echo "Tabla de usuarios creada correctamente.\n";
    
    // Crear tabla de preferencias de usuario
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_preferences (
            user_id INT PRIMARY KEY,
            theme VARCHAR(20) DEFAULT 'light',
            notification_enabled BOOLEAN DEFAULT TRUE,
            favorite_coins TEXT,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
    ");
    
    echo "Tabla de preferencias de usuario creada correctamente.\n";
    
    // Crear tabla de sesiones (opcional, si prefieres guardar sesiones en la base de datos)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS sessions (
            id VARCHAR(128) PRIMARY KEY,
            user_id INT,
            ip_address VARCHAR(45),
            user_agent TEXT,
            payload TEXT,
            last_activity INT,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX (last_activity)
        ) ENGINE=InnoDB
    ");
    
    echo "Tabla de sesiones creada correctamente.\n";
    
    echo "Configuración de la base de datos completada con éxito.\n";
    
} catch (PDOException $e) {
    die("Error al configurar la base de datos: " . $e->getMessage() . "\n");
}
?>
