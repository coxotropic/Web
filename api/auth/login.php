<?php
require_once 'user.php';
require_once 'session.php';

// Asegurarse de que la solicitud sea POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse('error', 'Método no permitido');
}

// Obtener y validar datos
$data = json_decode(file_get_contents('php://input'), true);

if (!isset($data['email']) || !isset($data['password'])) {
    jsonResponse('error', 'Faltan datos requeridos');
}

$email = trim($data['email']);
$password = $data['password'];

// Intentar iniciar sesión
$user = new User();
$userData = $user->login($email, $password);

if (!$userData) {
    jsonResponse('error', 'Credenciales incorrectas');
}

// Iniciar sesión
$session = new Session();
$session->start($userData);

jsonResponse('success', 'Inicio de sesión exitoso', $userData);
?>
