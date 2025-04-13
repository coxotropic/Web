// js/social/comments-api.js
/**
 * API para interactuar con comentarios
 */
class CommentsAPI {
    /**
     * Obtener comentarios de una criptomoneda
     * @param {string} coinId - ID de la criptomoneda
     * @param {number} limit - Límite de comentarios a obtener
     * @param {number} offset - Desplazamiento para paginación
     * @returns {Promise} - Promesa con los comentarios
     */
    static async getComments(coinId, limit = 20, offset = 0) {
        try {
            const response = await fetch(`/api/social/comments.php?coin_id=${coinId}&limit=${limit}&offset=${offset}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al obtener comentarios');
            }
        } catch (error) {
            console.error('Error en CommentsAPI.getComments:', error);
            throw error;
        }
    }
    
    /**
     * Añadir un comentario
     * @param {string} coinId - ID de la criptomoneda
     * @param {string} content - Contenido del comentario
     * @returns {Promise} - Promesa con el resultado
     */
    static async addComment(coinId, content) {
        try {
            const response = await fetch('/api/social/comments.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ coin_id: coinId, content })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al añadir comentario');
            }
        } catch (error) {
            console.error('Error en CommentsAPI.addComment:', error);
            throw error;
        }
    }
    
    /**
     * Dar like a un comentario
     * @param {number} commentId - ID del comentario
     * @returns {Promise} - Promesa con el resultado
     */
    static async likeComment(commentId) {
        try {
            const response = await fetch('/api/social/likes.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ comment_id: commentId })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al dar like');
            }
        } catch (error) {
            console.error('Error en CommentsAPI.likeComment:', error);
            throw error;
        }
    }
}

export default CommentsAPI;
