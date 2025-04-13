<?php
require_once __DIR__ . '/../auth/db.php';

class SocialService {
    private $db;
    
    public function __construct() {
        $this->db = new Database();
    }
    
    // Añadir un comentario
    public function addComment($userId, $coinId, $content) {
        return $this->db->insert(
            "INSERT INTO comments (user_id, coin_id, content, created_at) VALUES (?, ?, ?, NOW())",
            [$userId, $coinId, $content]
        );
    }
    
    // Obtener comentarios de una criptomoneda
    public function getCommentsByCoin($coinId, $limit = 20, $offset = 0) {
        return $this->db->select(
            "SELECT c.id, c.content, c.created_at, u.username, u.id as user_id 
             FROM comments c
             JOIN users u ON c.user_id = u.id
             WHERE c.coin_id = ?
             ORDER BY c.created_at DESC
             LIMIT ? OFFSET ?",
            [$coinId, $limit, $offset]
        );
    }
    
    // Dar like a un comentario
    public function likeComment($userId, $commentId) {
        // Verificar si ya dio like
        $existing = $this->db->selectOne(
            "SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?",
            [$userId, $commentId]
        );
        
        if ($existing) {
            // Ya dio like, entonces lo quitamos (toggle)
            $this->db->execute(
                "DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?",
                [$userId, $commentId]
            );
            return false; // Indica que se quitó el like
        } else {
            // Añadir nuevo like
            $this->db->insert(
                "INSERT INTO comment_likes (user_id, comment_id, created_at) VALUES (?, ?, NOW())",
                [$userId, $commentId]
            );
            return true; // Indica que se añadió el like
        }
    }
    
    // Obtener conteo de likes para un comentario
    public function getCommentLikes($commentId) {
        $result = $this->db->selectOne(
            "SELECT COUNT(*) as likes FROM comment_likes WHERE comment_id = ?",
            [$commentId]
        );
        
        return $result ? $result['likes'] : 0;
    }
    
    // Seguir a un usuario
    public function followUser($followerId, $followedId) {
        // No permitir seguirse a sí mismo
        if ($followerId == $followedId) {
            return false;
        }
        
        // Verificar si ya lo sigue
        $existing = $this->db->selectOne(
            "SELECT id FROM user_followers WHERE follower_id = ? AND followed_id = ?",
            [$followerId, $followedId]
        );
        
        if ($existing) {
            // Ya lo sigue, entonces lo dejamos de seguir
            $this->db->execute(
                "DELETE FROM user_followers WHERE follower_id = ? AND followed_id = ?",
                [$followerId, $followedId]
            );
            return false; // Indica que dejó de seguir
        } else {
            // Seguir nuevo usuario
            $this->db->insert(
                "INSERT INTO user_followers (follower_id, followed_id, created_at) VALUES (?, ?, NOW())",
                [$followerId, $followedId]
            );
            return true; // Indica que comenzó a seguir
        }
    }
    
    // Obtener seguidores de un usuario
    public function getUserFollowers($userId, $limit = 20, $offset = 0) {
        return $this->db->select(
            "SELECT u.id, u.username, u.profile_image
             FROM user_followers f
             JOIN users u ON f.follower_id = u.id
             WHERE f.followed_id = ?
             ORDER BY f.created_at DESC
             LIMIT ? OFFSET ?",
            [$userId, $limit, $offset]
        );
    }
    
    // Obtener usuarios seguidos por un usuario
    public function getUserFollowing($userId, $limit = 20, $offset = 0) {
        return $this->db->select(
            "SELECT u.id, u.username, u.profile_image
             FROM user_followers f
             JOIN users u ON f.followed_id = u.id
             WHERE f.follower_id = ?
             ORDER BY f.created_at DESC
             LIMIT ? OFFSET ?",
            [$userId, $limit, $offset]
        );
    }
    
    // Compartir análisis/post sobre una criptomoneda
    public function shareAnalysis($userId, $coinId, $title, $content) {
        return $this->db->insert(
            "INSERT INTO user_analysis (user_id, coin_id, title, content, created_at) 
             VALUES (?, ?, ?, ?, NOW())",
            [$userId, $coinId, $title, $content]
        );
    }
    
    // Obtener análisis compartidos por usuarios
    public function getAnalysisByCoin($coinId, $limit = 10, $offset = 0) {
        return $this->db->select(
            "SELECT a.id, a.title, a.content, a.created_at, u.username, u.id as user_id 
             FROM user_analysis a
             JOIN users u ON a.user_id = u.id
             WHERE a.coin_id = ?
             ORDER BY a.created_at DESC
             LIMIT ? OFFSET ?",
            [$coinId, $limit, $offset]
        );
    }
}
?>
