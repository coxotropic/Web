<?php
require_once 'user.php';
require_once 'session.php';

// Asegurarse de que la solicitud sea POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse('error', 'Método no permitido');
}

$session = new Session();

// Verificar autenticación
if (!$session->isAuthenticated()) {
    jsonResponse('error', 'No autorizado', null, 401);
}

// Obtener y validar datos
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['current_password']) || !isset($data['new_password'])) {
    jsonResponse('error', 'Faltan datos requeridos');
}

$currentPassword = $data['current_password'];
$newPassword = $data['new_password'];

// Validación de contraseña
if (strlen($newPassword) < 8) {
    jsonResponse('error', 'La nueva contraseña debe tener al menos 8 caracteres');
}

// Intentar cambiar la contraseña
$userId = $session->getUserId();
$user = new User();
$success = $user->changePassword($userId, $currentPassword, $newPassword);

if (!$success) {
    jsonResponse('error', 'La contraseña actual es incorrecta');
}

jsonResponse('success', 'Contraseña actualizada correctamente');
?>
