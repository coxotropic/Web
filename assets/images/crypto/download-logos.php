<?php
// Guardar como download-logos.php
require_once 'api/market/config.php';
require_once 'api/market/market-api.php';

$marketAPI = new MarketAPI();
$cryptoList = $marketAPI->getCryptoList(100, 1);

$logosDir = __DIR__ . '/assets/images/crypto/';
if (!file_exists($logosDir)) {
    mkdir($logosDir, 0755, true);
}

foreach ($cryptoList as $crypto) {
    if (isset($crypto['image']) && !empty($crypto['image'])) {
        $imageUrl = $crypto['image'];
        $fileName = $crypto['id'] . '.png';
        $filePath = $logosDir . $fileName;
        
        // Descargar imagen
        file_put_contents($filePath, file_get_contents($imageUrl));
        echo "Descargado logo de {$crypto['name']} ({$crypto['id']})\n";
    }
}

echo "Logos descargados correctamente.\n";
?>
