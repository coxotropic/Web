/**
 * Servicio para obtener noticias de criptomonedas
 */
class NewsService {
    /**
     * Obtener noticias generales
     * @param {number} limit - Límite de resultados
     * @returns {Promise} - Promesa con los datos
     */
    static async getNews(limit = 20) {
        try {
            const response = await fetch(`/api/news/get-news.php?limit=${limit}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al obtener noticias');
            }
        } catch (error) {
            console.error('Error en NewsService.getNews:', error);
            throw error;
        }
    }
    
    /**
     * Obtener noticias específicas de una criptomoneda
     * @param {string} coinId - ID de la criptomoneda
     * @param {number} limit - Límite de resultados
     * @returns {Promise} - Promesa con los datos
     */
    static async getNewsByCoin(coinId, limit = 10) {
        try {
            const response = await fetch(`/api/news/news-by-coin.php?id=${coinId}&limit=${limit}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al obtener noticias para esta criptomoneda');
            }
        } catch (error) {
            console.error('Error en NewsService.getNewsByCoin:', error);
            throw error;
        }
    }
}

export default NewsService;
