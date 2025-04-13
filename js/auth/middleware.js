// Funciones middleware para proteger rutas o verificar autenticación

const isAuthenticated = (req, res, next) => {
  // Código para verificar si el usuario está autenticado
};

const hasRole = (role) => (req, res, next) => {
  // Código para verificar si el usuario tiene cierto rol
};

module.exports = {
  isAuthenticated,
  hasRole,
  // Otros middleware
};
