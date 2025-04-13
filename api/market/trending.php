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

// Obtener tendencias
$marketAPI = new MarketAPI();
$trendingData = $marketAPI->getTrending();

if ($trendingData === null) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Error al obtener datos de tendencias']);
    exit;
}

// Devolver respuesta
echo json_encode([
    'status' => 'success',
    'data' => $trendingData
]);
?>
