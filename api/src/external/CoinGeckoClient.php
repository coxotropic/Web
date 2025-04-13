<?php
/**
 * CoinGeckoClient.php
 * Cliente para la API de CoinGecko
 */

namespace CryptoInvest\External;

use CryptoInvest\Exceptions\ApiException;

class CoinGeckoClient extends ApiClient {
    /**
     * Nombre de la API para logs y caché
     * @var string
     */
    const PROVIDER_NAME = 'coingecko';
    
    /**
     * Versión de la API
     * @var string
     */
    const API_VERSION = 'v3';
    
    /**
     * Constructor
     * 
     * @param string $apiKey Clave API de CoinGecko (opcional para API gratuita)
     */
    public function __construct($apiKey = null) {
        $apiConfig = getApiConfig('coingecko');
        $baseUrl = $apiConfig['url'] ?? 'https://api.coingecko.com/api/' . self::API_VERSION;
        parent::__construct($baseUrl, $apiKey);
        
        // Configurar límites de tasa para la API de CoinGecko
        // API gratuita: 10-50 llamadas por minuto según endpoint
        // API Pro: ~500 llamadas por minuto
        $this->rateLimits = [
            // Límite global conservador para API gratuita
            'global' => [
                'limit' => 10/60, // 10 llamadas por minuto
                'key' => 'global'
            ],
            // Límites específicos
            '/ping/' => [
                'limit' => 60/60, // 60 llamadas por minuto
                'key' => 'ping'
            ],
            '/simple/price/' => [
                'limit' => 30/60, // 30 llamadas por minuto
                'key' => 'price'
            ]
        ];
        
        // Tiempos de caché optimizados para CoinGecko
        $this->cacheTTLs = [
            'ping' => 300, // 5 minutos
            'simple/price' => 60, // 1 minuto
            'coins/markets' => 120, // 2 minutos
            'coins/list' => 3600, // 1 hora
            'coins/' => 300, // 5 minutos para detalles de monedas
            'exchanges' => 1800, // 30 minutos
            'global' => 300, // 5 minutos
            'search' => 600, // 10 minutos
            'trending' => 300 // 5 minutos
        ];
    }
    
    /**
     * @inheritdoc
     */
    protected function getProviderName() {
        return self::PROVIDER_NAME;
    }
    
    /**
     * Verifica si la API está disponible
     * 
     * @return bool Estado de la API
     */
    public function ping() {
        try {
            $response = $this->get('ping');
            return isset($response['gecko_says']) && $response['gecko_says'] === '(V3) To the Moon!';
        } catch (ApiException $e) {
            return false;
        }
    }
    
    /**
     * Obtiene precios actuales para una o más criptomonedas
     * 
     * @param array $ids IDs de las criptomonedas (ej: 'bitcoin', 'ethereum')
     * @param array $vsCurrencies Monedas para convertir (ej: 'usd', 'eur')
     * @param array $options Opciones adicionales
     * @return array Precios de las criptomonedas
     */
    public function getSimplePrice(array $ids, array $vsCurrencies, array $options = []) {
        $params = [
            'ids' => implode(',', $ids),
            'vs_currencies' => implode(',', $vsCurrencies)
        ];
        
        // Opciones adicionales
        if (isset($options['include_market_cap']) && $options['include_market_cap']) {
            $params['include_market_cap'] = 'true';
        }
        
        if (isset($options['include_24hr_vol']) && $options['include_24hr_vol']) {
            $params['include_24hr_vol'] = 'true';
        }
        
        if (isset($options['include_24hr_change']) && $options['include_24hr_change']) {
            $params