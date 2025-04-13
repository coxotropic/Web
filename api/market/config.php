<?php
// Configuración de la API de mercado
define('COINMARKETCAP_API_KEY', 'PON_AQUI_TU_API'); // Reemplazar con tu API key
define('COINDESK_API_KEY', 'PON_AQUI_TU_API');
define('COINGECKO_API_URL', 'https://api.coingecko.com/api/v3');
define('MARKET_CACHE_DURATION', 300); // 5 minutos de caché para datos de mercado

// Directorio para almacenar cache
define('CACHE_DIR', __DIR__ . '/../../assets/data/cache');

// Creación del directorio de caché si no existe
if (!file_exists(CACHE_DIR)) {
    mkdir(CACHE_DIR, 0755, true);
}

// Función para obtener datos en caché o desde API
function getCachedData($cacheFile, $ttl, $fetchFunction) {
    $cacheFilePath = CACHE_DIR . '/' . $cacheFile;
    
    // Si el archivo de caché existe y no está expirado
    if (file_exists($cacheFilePath) && (time() - filemtime($cacheFilePath)) < $ttl) {
        return json_decode(file_get_contents($cacheFilePath), true);
    }
    
    // Obtener datos frescos
    $data = $fetchFunction();
    
    // Guardar en caché
    if ($data) {
        file_put_contents($cacheFilePath, json_encode($data));
    }
    
    return $data;
}
?>
