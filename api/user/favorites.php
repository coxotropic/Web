<?php
require_once __DIR__ . '/../auth/middleware.php';
require_once __DIR__ . '/../auth/session.php';
require_once 'user-service.php';

// Verificar autenticación para todas las operaciones con favoritos
auth()->requireAuth();

// Configurar headers para CORS y tipo de contenido
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$session = new Session();
$userId = $session->getUserId();
$userService = new UserService();

// GET: Obtener favoritos
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $favorites = $userService->getFavoriteCoins($userId);
    
    echo json_encode([
        'status' => 'success',
        'data' => $favorites
    ]);
    exit;
}

// POST: Guardar favoritos
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (!isset($data['coins']) || !is_array($data['coins'])) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'Se requiere lista de monedas']);
        exit;
    }
    
    $success = $userService->saveFavoriteCoins($userId, $data['coins']);
    
    if (!$success) {
        http_response_code(500);
        echo json_encode(['status' => 'error', 'message' => 'Error al guardar monedas favoritas']);
        exit;
    }
    
    echo json_encode([
        'status' => 'success',
        'message' => 'Monedas favoritas guardadas correctamente',
        'data' => $data['coins']
    ]);
    exit;
}

// Método no permitido
http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Método no permitido']);
?>
