// Importaciones
const authStrategies = require('./strategies');
const authMiddleware = require('./middleware');
const authControllers = require('./controllers');
const authUtils = require('./utils');
const tokenHelpers = require('./tokens');

// Exportar todo junto
module.exports = {
  ...authStrategies,
  ...authMiddleware,
  ...authControllers,
  ...authUtils,
  ...tokenHelpers
};