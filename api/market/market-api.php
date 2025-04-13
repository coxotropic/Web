<?php
require_once __DIR__ . '/../auth/config.php';
require_once 'config.php';

class MarketAPI {
    // Obtener lista de criptomonedas
    public function getCryptoList($limit = 50, $page = 1) {
        $cacheFile = "crypto_list_{$limit}_{$page}.json";
        
        return getCachedData($cacheFile, MARKET_CACHE_DURATION, function() use ($limit, $page) {
            $url = COINGECKO_API_URL . "/coins/markets?vs_currency=usd&order=market_cap_desc&per_page={$limit}&page={$page}&sparkline=false";
            return $this->makeRequest($url);
        });
    }
    
    // Obtener detalle de una criptomoneda específica
    public function getCryptoDetail($coinId) {
        $cacheFile = "crypto_detail_{$coinId}.json";
        
        return getCachedData($cacheFile, MARKET_CACHE_DURATION, function() use ($coinId) {
            $url = COINGECKO_API_URL . "/coins/{$coinId}?localization=false&tickers=true&market_data=true&community_data=true&developer_data=true&sparkline=false";
            return $this->makeRequest($url);
        });
    }
    
    // Obtener datos históricos de precios
    public function getHistoricalData($coinId, $days = 30) {
        $cacheFile = "historical_{$coinId}_{$days}.json";
        
        return getCachedData($cacheFile, MARKET_CACHE_DURATION, function() use ($coinId, $days) {
            $url = COINGECKO_API_URL . "/coins/{$coinId}/market_chart?vs_currency=usd&days={$days}";
            return $this->makeRequest($url);
        });
    }
    
    // Obtener tendencias de mercado
    public function getTrending() {
        $cacheFile = "trending.json";
        
        return getCachedData($cacheFile, MARKET_CACHE_DURATION, function() {
            $url = COINGECKO_API_URL . "/search/trending";
            return $this->makeRequest($url);
        });
    }
    
    // Buscar criptomonedas
    public function searchCrypto($query) {
        $cacheFile = "search_" . md5($query) . ".json";
        
        return getCachedData($cacheFile, MARKET_CACHE_DURATION, function() use ($query) {
            $url = COINGECKO_API_URL . "/search?query=" . urlencode($query);
            return $this->makeRequest($url);
        });
    }
    
    // Realizar una solicitud HTTP a la API
    private function makeRequest($url) {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Accept: application/json',
            'User-Agent: CryptoPortal/1.0'
        ]);
        
        $response = curl_exec($ch);
        $error = curl_error($ch);
        $statusCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($error) {
            error_log("Error API: " . $error);
            return null;
        }
        
        if ($statusCode >= 400) {
            error_log("Error HTTP: " . $statusCode . " - " . $response);
            return null;
        }
        
        return json_decode($response, true);
    }
}
?>
