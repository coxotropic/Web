// api/social/likes.php
<?php
require_once __DIR__ . '/../auth/middleware.php';
require_once __DIR__ . '/../auth/session.php';
require_once 'social-service.php';

// Verificar autenticación
auth()->requireAuth();

// Configurar headers para CORS y tipo de contenido
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

// Solo aceptar POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Método no permitido']);
    exit;
}

$session = new Session();
$userId = $session->getUserId();
$socialService = new SocialService();

// Obtener datos
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['comment_id'])) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Se requiere ID de comentario']);
    exit;
}

$commentId = $data['comment_id'];

// Dar o quitar like (toggle)
$added = $socialService->likeComment($userId, $commentId);
$likes = $socialService->getCommentLikes($commentId);

echo json_encode([
    'status' => 'success',
    'message' => $added ? 'Like añadido' : 'Like eliminado',
    'data' => [
        'comment_id' => $commentId,
        'likes' => $likes,
        'liked' => $added
    ]
]);
?>
