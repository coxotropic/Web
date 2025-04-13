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

// Obtener parámetros
$coinId = isset($_GET['id']) ? $_GET['id'] : '';
$days = isset($_GET['days']) ? (int)$_GET['days'] : 30;

// Validar parámetros
if (empty($coinId)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Se requiere ID de criptomoneda']);
    exit;
}

if ($days < 1 || $days > 365) {
    $days = 30;
}

// Obtener datos históricos
$marketAPI = new MarketAPI();
$historicalData = $marketAPI->getHistoricalData($coinId, $days);

if ($historicalData === null) {
    http_response_code(404);
    echo json_encode(['status' => 'error', 'message' => 'Datos no encontrados o error al obtener datos históricos']);
    exit;
}

// Devolver respuesta
echo json_encode([
    'status' => 'success',
    'data' => $historicalData,
    'meta' => [
        'coin_id' => $coinId,
        'days' => $days
    ]
]);
?>
