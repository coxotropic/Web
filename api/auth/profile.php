<?php
require_once 'user.php';
require_once 'session.php';

$session = new Session();

// Verificar autenticación
if (!$session->isAuthenticated()) {
    jsonResponse('error', 'No autorizado', null, 401);
}

$userId = $session->getUserId();
$user = new User();

// GET: Obtener perfil
if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $userData = $user->getUserById($userId);
    
    if (!$userData) {
        jsonResponse('error', 'Usuario no encontrado');
    }
    
    jsonResponse('success', 'Perfil recuperado correctamente', $userData);
}

// PUT: Actualizar perfil
if ($_SERVER['REQUEST_METHOD'] === 'PUT') {
    $data = json_decode(file_get_contents('php://input'), true);
    
    if (empty($data)) {
        jsonResponse('error', 'No hay datos para actualizar');
    }
    
    $success = $user->updateProfile($userId, $data);
    
    if (!$success) {
        jsonResponse('error', 'No se pudo actualizar el perfil');
    }
    
    $userData = $user->getUserById($userId);
    jsonResponse('success', 'Perfil actualizado correctamente', $userData);
}

// Método no permitido
jsonResponse('error', 'Método no permitido');
?>
