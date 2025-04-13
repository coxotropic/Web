<?php
require_once __DIR__ . '/../auth/middleware.php';
require_once 'market-api.php';

// No se requiere autenticación para acceder a datos públicos de mercado
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

// Obtener parámetros de la solicitud
$limit = isset($_GET['limit']) ? (int)$_GET['limit'] : 100;
$page = isset($_GET['page']) ? (int)$_GET['page'] : 1;

// Validar parámetros
if ($limit < 1 || $limit > 250) {
    $limit = 100;
}
if ($page < 1) {
    $page = 1;
}

// Obtener lista de criptomonedas
$marketAPI = new MarketAPI();
$cryptoList = $marketAPI->getCryptoList($limit, $page);

if ($cryptoList === null) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Error al obtener datos de mercado']);
    exit;
}

// Devolver respuesta
echo json_encode([
    'status' => 'success',
    'data' => $cryptoList,
    'meta' => [
        'limit' => $limit,
        'page' => $page,
        'count' => count($cryptoList)
    ]
]);
?>
