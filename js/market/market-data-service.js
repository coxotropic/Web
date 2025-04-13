/**
 * Servicio para obtener datos del mercado de criptomonedas
 */
class MarketDataService {
    /**
     * Obtener lista de criptomonedas
     * @param {number} limit - Límite de resultados
     * @param {number} page - Página actual
     * @returns {Promise} - Promesa con los datos
     */
    static async getCryptoList(limit = 100, page = 1) {
        try {
            const response = await fetch(`/api/market/crypto-list.php?limit=${limit}&page=${page}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al obtener lista de criptomonedas');
            }
        } catch (error) {
            console.error('Error en MarketDataService.getCryptoList:', error);
            throw error;
        }
    }
    
    /**
     * Obtener detalle de una criptomoneda
     * @param {string} coinId - ID de la criptomoneda
     * @returns {Promise} - Promesa con los datos
     */
    static async getCryptoDetail(coinId) {
        try {
            const response = await fetch(`/api/market/crypto-detail.php?id=${coinId}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al obtener detalle de criptomoneda');
            }
        } catch (error) {
            console.error('Error en MarketDataService.getCryptoDetail:', error);
            throw error;
        }
    }
    
    /**
     * Obtener datos históricos de precios
     * @param {string} coinId - ID de la criptomoneda
     * @param {number} days - Días de historia
     * @returns {Promise} - Promesa con los datos
     */
    static async getHistoricalData(coinId, days = 30) {
        try {
            const response = await fetch(`/api/market/historical-data.php?id=${coinId}&days=${days}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al obtener datos históricos');
            }
        } catch (error) {
            console.error('Error en MarketDataService.getHistoricalData:', error);
            throw error;
        }
    }
    
    /**
     * Obtener criptomonedas en tendencia
     * @returns {Promise} - Promesa con los datos
     */
    static async getTrending() {
        try {
            const response = await fetch('/api/market/trending.php');
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al obtener tendencias');
            }
        } catch (error) {
            console.error('Error en MarketDataService.getTrending:', error);
            throw error;
        }
    }
}

export default MarketDataService;