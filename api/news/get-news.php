<?php
require_once __DIR__ . '/../auth/middleware.php';
require_once 'news-parser.php';

// No se requiere autenticación para acceder a noticias públicas
// auth()->requireAuth(); // Descomentar si quieres que requiera autenticación

// Configurar headers para CORS y tipo de contenido
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// Verificar que sea una solicitud GET
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Método no permitido']);
    exit;
}

// Obtener parámetros
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 20;

// Validar parámetros
if ($limit < 1 || $limit > 50) {
    $limit = 20;
}

// Obtener noticias
$newsParser = new NewsParser();
$news = $newsParser->getCryptoNews($limit);

if ($news === null) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Error al obtener noticias']);
    exit;
}

// Devolver respuesta
echo json_encode([
    'status' => 'success',
    'data' => $news,
    'meta' => [
        'limit' => $limit,
        'count' => count($news['Data'])
    ]
]);
?>
