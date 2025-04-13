<?php
require_once __DIR__ . '/../auth/config.php';
require_once __DIR__ . '/../market/config.php';
require_once 'config.php';

class NewsParser {
    // Obtener noticias desde CryptoCompare
    public function getCryptoNews($limit = 20) {
        $cacheFile = "crypto_news_{$limit}.json";
        
        return getCachedData($cacheFile, NEWS_CACHE_DURATION, function() use ($limit) {
            $url = CRYPTO_COMPARE_API_URL . "?lang=ES,EN&sortOrder=popular&limit={$limit}";
            if (defined('CRYPTO_COMPARE_API_KEY') && !empty(CRYPTO_COMPARE_API_KEY)) {
                $url .= "&api_key=" . CRYPTO_COMPARE_API_KEY;
            }
            return $this->makeRequest($url);
        });
    }
    
    // Obtener noticias para una criptomoneda específica
    public function getNewsByCoin($coinId, $limit = 10) {
        $cacheFile = "news_by_coin_{$coinId}_{$limit}.json";
        
        return getCachedData($cacheFile, NEWS_CACHE_DURATION, function() use ($coinId, $limit) {
            // Convertir coinId a términos de búsqueda (bitcoin, ethereum, etc.)
            $searchTerm = strtolower($coinId);
            
            // Buscar en News API
            $url = NEWS_API_URL . "/everything?q={$searchTerm}&language=en&sortBy=publishedAt&pageSize={$limit}&apiKey=" . NEWS_API_KEY;
            $response = $this->makeRequest($url);
            
            if (!$response || !isset($response['articles'])) {
                return null;
            }
            
            return $response['articles'];
        });
    }
    
    // Extraer texto relevante de artículos de noticias
    public function parseArticleContent($url) {
        // Esta función necesitaría una biblioteca para extraer contenido
        // Como por ejemplo HTML DOM Parser o similar
        // Por simplicidad, aquí solo retornamos un mensaje
        return "Contenido extraído de: " . $url;
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
            error_log("Error API Noticias: " . $error);
            return null;
        }
        
        if ($statusCode >= 400) {
            error_log("Error HTTP Noticias: " . $statusCode . " - " . $response);
            return null;
        }
        
        return json_decode($response, true);
    }
}
?>
