<?php
require_once '../auth/middleware.php';
require_once '../auth/user.php';

// Verificar autenticación
auth()->requireAuth();
auth()->requireMethod('POST');

// Procesar los datos del perfil
$userId = (new Session())->getUserId();
$user = new User();

// Obtener y filtrar datos
$data = json_decode(file_get_contents('php://input'), true);

// Actualizar el perfil
$success = $user->updateProfile($userId, $data);

if (!$success) {
    jsonResponse('error', 'No se pudo actualizar el perfil');
}

// Obtener datos actualizados
$userData = $user->getUserById($userId);
jsonResponse('success', 'Perfil actualizado correctamente', $userData);
?>
