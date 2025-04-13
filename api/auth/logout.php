<?php
require_once 'session.php';

// Asegurarse de que la solicitud sea POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse('error', 'Método no permitido');
}

$session = new Session();
$session->end();

jsonResponse('success', 'Sesión cerrada correctamente');
?>
