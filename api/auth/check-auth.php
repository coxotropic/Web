<?php
require_once 'session.php';
require_once 'user.php';

$session = new Session();

if ($session->isAuthenticated()) {
    $userId = $session->getUserId();
    $user = new User();
    $userData = $user->getUserById($userId);
    
    jsonResponse('success', 'Usuario autenticado', $userData);
} else {
    jsonResponse('error', 'No autenticado', null, 401);
}
?>
