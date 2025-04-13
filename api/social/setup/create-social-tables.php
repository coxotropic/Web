// api/social/setup/create-social-tables.php
<?php
require_once __DIR__ . '/../../auth/config.php';

try {
    // Conectar a la base de datos
    $pdo = new PDO(
        "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME,
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    
    // Crear tabla de comentarios
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS comments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            coin_id VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX (coin_id),
            INDEX (created_at)
        ) ENGINE=InnoDB
    ");
    
    echo "Tabla de comentarios creada correctamente.\n";
    
    // Crear tabla de likes de comentarios
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS comment_likes (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            comment_id INT NOT NULL,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
            UNIQUE KEY (user_id, comment_id)
        ) ENGINE=InnoDB
    ");
    
    echo "Tabla de likes de comentarios creada correctamente.\n";
    
    // Crear tabla de seguidores
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_followers (
            id INT AUTO_INCREMENT PRIMARY KEY,
            follower_id INT NOT NULL,
            followed_id INT NOT NULL,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE KEY (follower_id, followed_id)
        ) ENGINE=InnoDB
    ");
    
    echo "Tabla de seguidores creada correctamente.\n";
    
    // Crear tabla de análisis/posts de usuarios
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS user_analysis (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_id INT NOT NULL,
            coin_id VARCHAR(50) NOT NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX (coin_id),
            INDEX (created_at)
        ) ENGINE=InnoDB
    ");
    
    echo "Tabla de análisis de usuarios creada correctamente.\n";
    
    // Crear tabla para historial de vistas (para recomendaciones)
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS view_history (
            user_id INT NOT NULL,
            coin_id VARCHAR(50) NOT NULL,
            viewed_at DATETIME NOT NULL,
            PRIMARY KEY (user_id, coin_id),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            INDEX (viewed_at)
        ) ENGINE=InnoDB
    ");
    
    echo "Tabla de historial de vistas creada correctamente.\n";
    
    echo "Configuración de tablas sociales completada con éxito.\n";
    
} catch (PDOException $e) {
    die("Error al configurar tablas sociales: " . $e->getMessage() . "\n");
}
?>
