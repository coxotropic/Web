<?php
require_once __DIR__ . '/../auth/middleware.php';
require_once __DIR__ . '/../auth/session.php';
require_once 'user-service.php';

// Verificar autenticación
auth()->requireAuth();

// Configurar headers para CORS y tipo de contenido
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, PUT, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

// Manejar preflight request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$session = new Session();
$userId = $session->getUserId();
$userService = new UserService();

// GET: Obtener preferencias
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $preferences = $userService->getUserPreferences($userId);
    
    echo json_encode([
        'status' => 'success',
        'data' => $preferences
    ]);
    exit;
}

// PUT: Actualizar preferencias
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    $updated = false;
    
    // Actualizar tema si está presente
    if (isset($data['theme'])) {
        $theme = $data['theme'];
        if ($theme === 'light' || $theme === 'dark') {
            $updated = $userService->saveThemePreference($userId, $theme);
        }
    }
    
    // Actualizar notificaciones si está presente
    if (isset($data['notification_enabled'])) {
        $notificationEnabled = (bool)$data['notification_enabled'];
        $updated = $userService->saveNotificationPreference($userId, $notificationEnabled);
    }
    
    if (!$updated) {
        http_response_code(400);
        echo json_encode(['status' => 'error', 'message' => 'No se actualizaron preferencias']);
        exit;
    }
    
    // Obtener preferencias actualizadas
    $preferences = $userService->getUserPreferences($userId);
    
    echo json_encode([
        'status' => 'success',
        'message' => 'Preferencias actualizadas correctamente',
        'data' => $preferences
    ]);
    exit;
}

// Método no permitido
http_response_code(405);
echo json_encode(['status' => 'error', 'message' => 'Método no permitido']);
?>
