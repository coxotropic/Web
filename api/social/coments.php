// api/social/comments.php
<?php
require_once __DIR__ . '/../auth/middleware.php';
require_once __DIR__ . '/../auth/session.php';
require_once 'social-service.php';

// Configurar headers para CORS y tipo de contenido
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$socialService = new SocialService();

// GET: Obtener comentarios de una criptomoneda
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $coinId = isset($_GET['coin_id']) ? $_GET['coin_id'] : '';
    $limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;
    $offset = isset($_GET['offset']) ? (int)$_GET['offset'] : 0;
    
    if (empty($coinId)) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Se requiere ID de criptomoneda']);
        exit;
    }
    
    $comments = $socialService->getCommentsByCoin($coinId, $limit, $offset);
    
    // Obtener likes para cada comentario
    foreach ($comments as &$comment) {
        $comment['likes'] = $socialService->getCommentLikes($comment['id']);
    }
    
    echo json_encode([
        'status' => 'success',
        'data' => $comments
    ]);
    exit;
}

// POST: Añadir un comentario
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Verificar autenticación para añadir comentarios
    auth()->requireAuth();
    
    $session = new Session();
    $userId = $session->getUserId();
    
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['coin_id']) || !isset($data['content']) || empty($data['content'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Faltan datos requeridos']);
        exit;
    }
    
    $coinId = $data['coin_id'];
    $content = trim($data['content']);
    
    $commentId = $socialService->addComment($userId, $coinId, $content);
    
    if (!$commentId) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Error al añadir comentario']);
        exit;
    }
    
    echo json_encode([
        'status' => 'success',
        'message' => 'Comentario añadido correctamente',
        'data' => [
            'id' => $commentId,
            'user_id' => $userId,
            'content' => $content,
            'created_at' => date('Y-m-d H:i:s')
        ]
    ]);
    exit;
}

// Método no permitido
http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Método no permitido']);
?>
