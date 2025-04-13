// js/social/social-api.js
/**
 * API para interactuar con funciones sociales
 */
class SocialAPI {
    /**
     * Seguir o dejar de seguir a un usuario
     * @param {number} userId - ID del usuario a seguir/dejar de seguir
     * @returns {Promise} - Promesa con el resultado
     */
    static async toggleFollow(userId) {
        try {
            const response = await fetch('/api/social/follow.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ user_id: userId })
            });
            
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al seguir/dejar de seguir usuario');
            }
        } catch (error) {
            console.error('Error en SocialAPI.toggleFollow:', error);
            throw error;
        }
    }
    
    /**
     * Obtener seguidores de un usuario
     * @param {number} userId - ID del usuario
     * @param {number} limit - Límite de seguidores a obtener
     * @param {number} offset - Desplazamiento para paginación
     * @returns {Promise} - Promesa con los seguidores
     */
    static async getFollowers(userId, limit = 20, offset = 0) {
        try {
            const response = await fetch(`/api/social/followers.php?user_id=${userId}&limit=${limit}&offset=${offset}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al obtener seguidores');
            }
        } catch (error) {
            console.error('Error en SocialAPI.getFollowers:', error);
            throw error;
        }
    }
    
    /**
     * Obtener usuarios seguidos por un usuario
     * @param {number} userId - ID del usuario
     * @param {number} limit - Límite de seguidos a obtener
     * @param {number} offset - Desplazamiento para paginación
     * @returns {Promise} - Promesa con los usuarios seguidos
     */
    static async getFollowing(userId, limit = 20, offset = 0) {
        try {
            const response = await fetch(`/api/social/following.php?user_id=${userId}&limit=${limit}&offset=${offset}`);
            const data = await response.json();
            
            if (data.status === 'success') {
                return data.data;
            } else {
                throw new Error(data.message || 'Error al obtener usuarios seguidos');
            }
        } catch (error) {
            console.error('Error en SocialAPI.getFollowing:', error);
            throw error;
        }
    }
}

export default SocialAPI;
