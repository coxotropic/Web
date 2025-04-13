<?php
require_once 'user.php';
require_once 'session.php';

// Asegurarse de que la solicitud sea POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse('error', 'Método no permitido');
}

// Obtener y validar datos
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['username']) || !isset($data['email']) || !isset($data['password'])) {
    jsonResponse('error', 'Faltan datos requeridos');
}

$username = trim($data['username']);
$email = trim($data['email']);
$password = $data['password'];

// Validaciones básicas
if (strlen($username) < 4) {
    jsonResponse('error', 'El nombre de usuario debe tener al menos 4 caracteres');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    jsonResponse('error', 'El correo electrónico no es válido');
}

if (strlen($password) < 8) {
    jsonResponse('error', 'La contraseña debe tener al menos 8 caracteres');
}

// Intentar registrar al usuario
$user = new User();
$userId = $user->register($username, $email, $password);

if (!$userId) {
    jsonResponse('error', 'El nombre de usuario o correo electrónico ya está en uso');
}

// Registrar exitosamente
jsonResponse('success', 'Usuario registrado correctamente', [
    'id' => $userId,
    'username' => $username,
    'email' => $email
]);
?>
