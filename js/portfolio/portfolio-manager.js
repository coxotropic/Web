/**
 * portfolio-manager.js
 * Módulo para gestionar el portfolio de inversiones en criptomonedas
 */

// Importar servicios necesarios
import { MarketDataService } from '../market/market-data-service.js';
import { NotificationService } from '../utils/notification-service.js';
import { StorageService } from '../utils/storage-service.js';

/**
 * Clase principal para gestionar portfolios de criptomonedas
 */
export class PortfolioManager {
    /**
     * Constructor
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        // Opciones con valores predeterminados
        this.options = {
            storageKey: 'crypto_portfolios',
            defaultPortfolioName: 'Mi Portfolio Principal',
            autosave: true,
            updateInterval: 60000, // 1 minuto en ms
            significantChangeThreshold: 5, // 5% para notificaciones
            ...options
        };
        
        // Servicios
        this.marketDataService = new MarketDataService();
        this.notificationService = new NotificationService();
        this.storageService = new StorageService();
        
        // Estado interno
        this.portfolios = [];
        this.activePortfolioId = null;
        this.updateTimer = null;
        this.lastUpdateTime = null;
        
        // Estado de inicialización
        this.initialized = false;
    }
    
    /**
     * Inicializa el gestor de portfolios
     * @returns {Promise<boolean>} Éxito de la inicialización
     */
    async initialize() {
        try {
            if (this.initialized) {
                return true;
            }
            
            // Cargar portfolios desde almacenamiento
            await this.loadPortfolios();
            
            // Si no hay portfolios, crear uno predeterminado
            if (this.portfolios.length === 0) {
                const defaultPortfolio = this._createDefaultPortfolio();
                this.portfolios.push(defaultPortfolio);
                this.activePortfolioId = defaultPortfolio.id;
                
                if (this.options.autosave) {
                    await this.savePortfolios();
                }
            } else {
                // Establecer el primer portfolio como activo si no hay uno activo
                if (!this.activePortfolioId && this.portfolios.length > 0) {
                    this.activePortfolioId = this.portfolios[0].id;
                }
            }
            
            // Iniciar actualizaciones automáticas
            this._startAutoUpdates();
            
            this.initialized = true;
            
            // Emitir evento de inicialización completada
            this._emitEvent('portfolioManagerInitialized');
            
            return true;
        } catch (error) {
            console.error('Error al inicializar PortfolioManager:', error);
            throw new Error(`Error de inicialización: ${error.message}`);
        }
    }
    
    /**
     * Carga los portfolios desde el almacenamiento
     * @returns {Promise<boolean>} Éxito de la carga
     */
    async loadPortfolios() {
        try {
            const storedData = await this.storageService.getItem(this.options.storageKey);
            
            if (storedData) {
                const parsedData = JSON.parse(storedData);
                
                // Verificar formato de datos
                if (Array.isArray(parsedData.portfolios)) {
                    this.portfolios = parsedData.portfolios;
                    this.activePortfolioId = parsedData.activePortfolioId || null;
                    
                    // Emitir evento de portfolios cargados
                    this._emitEvent('portfoliosLoaded', {
                        portfolios: this.portfolios,
                        activePortfolioId: this.activePortfolioId
                    });
                    
                    return true;
                }
            }
            
            // Si no hay datos o formato incorrecto, inicializar con arrays vacíos
            this.portfolios = [];
            this.activePortfolioId = null;
            return false;
        } catch (error) {
            console.error('Error al cargar portfolios:', error);
            // En caso de error, inicializar con arrays vacíos
            this.portfolios = [];
            this.activePortfolioId = null;
            return false;
        }
    }
    
    /**
     * Guarda los portfolios en el almacenamiento
     * @returns {Promise<boolean>} Éxito del guardado
     */
    async savePortfolios() {
        try {
            const dataToStore = {
                portfolios: this.portfolios,
                activePortfolioId: this.activePortfolioId,
                lastUpdate: new Date().toISOString()
            };
            
            await this.storageService.setItem(
                this.options.storageKey,
                JSON.stringify(dataToStore)
            );
            
            // Emitir evento de portfolios guardados
            this._emitEvent('portfoliosSaved');
            
            return true;
        } catch (error) {
            console.error('Error al guardar portfolios:', error);
            throw new Error(`Error al guardar: ${error.message}`);
        }
    }
    
    /**
     * Crea un nuevo portfolio
     * @param {string} name - Nombre del portfolio
     * @param {string} description - Descripción del portfolio
     * @param {string} currency - Moneda base (USD, EUR, etc.)
     * @returns {Object} El portfolio creado
     */
    createPortfolio(name, description = '', currency = 'USD') {
        // Validar parámetros
        if (!name) {
            throw new Error('El nombre del portfolio es obligatorio');
        }
        
        // Comprobar si ya existe un portfolio con ese nombre
        const existingPortfolio = this.portfolios.find(p => p.name === name);
        if (existingPortfolio) {
            throw new Error(`Ya existe un portfolio con el nombre "${name}"`);
        }
        
        // Crear nuevo portfolio
        const newPortfolio = {
            id: this._generateId(),
            name,
            description,
            currency,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            assets: [],
            transactions: [],
            historicalValue: [],
            tags: [],
            isArchived: false
        };
        
        // Añadir a la lista
        this.portfolios.push(newPortfolio);
        
        // Si es el primer portfolio, establecerlo como activo
        if (this.portfolios.length === 1) {
            this.activePortfolioId = newPortfolio.id;
        }
        
        // Guardar si autosave está activado
        if (this.options.autosave) {
            this.savePortfolios().catch(err => 
                console.error('Error al guardar después de crear portfolio:', err)
            );
        }
        
        // Emitir evento de portfolio creado
        this._emitEvent('portfolioCreated', { portfolio: newPortfolio });
        
        return newPortfolio;
    }
    
    /**
     * Obtiene un portfolio por su ID
     * @param {string} portfolioId - ID del portfolio
     * @returns {Object|null} El portfolio o null si no existe
     */
    getPortfolio(portfolioId) {
        return this.portfolios.find(p => p.id === portfolioId) || null;
    }
    
    /**
     * Obtiene el portfolio activo actual
     * @returns {Object|null} El portfolio activo o null si no hay ninguno
     */
    getActivePortfolio() {
        if (!this.activePortfolioId) {
            return null;
        }
        return this.getPortfolio(this.activePortfolioId);
    }
    
    /**
     * Establece un portfolio como activo
     * @param {string} portfolioId - ID del portfolio a activar
     * @returns {boolean} Éxito de la operación
     */
    setActivePortfolio(portfolioId) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        this.activePortfolioId = portfolioId;
        
        // Guardar si autosave está activado
        if (this.options.autosave) {
            this.savePortfolios().catch(err => 
                console.error('Error al guardar después de cambiar portfolio activo:', err)
            );
        }
        
        // Emitir evento de cambio de portfolio activo
        this._emitEvent('activePortfolioChanged', { portfolioId });
        
        return true;
    }
    
    /**
     * Actualiza la información de un portfolio
     * @param {string} portfolioId - ID del portfolio
     * @param {Object} updates - Campos a actualizar
     * @returns {Object} El portfolio actualizado
     */
    updatePortfolio(portfolioId, updates) {
        const portfolioIndex = this.portfolios.findIndex(p => p.id === portfolioId);
        
        if (portfolioIndex === -1) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        // Campos que no se pueden actualizar directamente
        const protectedFields = ['id', 'createdAt', 'assets', 'transactions', 'historicalValue'];
        
        // Filtrar campos protegidos
        const filteredUpdates = { ...updates };
        protectedFields.forEach(field => {
            if (field in filteredUpdates) {
                delete filteredUpdates[field];
            }
        });
        
        // Actualizar el portfolio
        const updatedPortfolio = {
            ...this.portfolios[portfolioIndex],
            ...filteredUpdates,
            updatedAt: new Date().toISOString()
        };
        
        this.portfolios[portfolioIndex] = updatedPortfolio;
        
        // Guardar si autosave está activado
        if (this.options.autosave) {
            this.savePortfolios().catch(err => 
                console.error('Error al guardar después de actualizar portfolio:', err)
            );
        }
        
        // Emitir evento de portfolio actualizado
        this._emitEvent('portfolioUpdated', { portfolio: updatedPortfolio });
        
        return updatedPortfolio;
    }
    
    /**
     * Elimina un portfolio
     * @param {string} portfolioId - ID del portfolio a eliminar
     * @returns {boolean} Éxito de la operación
     */
    deletePortfolio(portfolioId) {
        const portfolioIndex = this.portfolios.findIndex(p => p.id === portfolioId);
        
        if (portfolioIndex === -1) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        // Guardar referencia al portfolio antes de eliminarlo
        const deletedPortfolio = this.portfolios[portfolioIndex];
        
        // Eliminar el portfolio
        this.portfolios.splice(portfolioIndex, 1);
        
        // Si era el portfolio activo, establecer otro como activo
        if (this.activePortfolioId === portfolioId) {
            this.activePortfolioId = this.portfolios.length > 0 ? this.portfolios[0].id : null;
        }
        
        // Guardar si autosave está activado
        if (this.options.autosave) {
            this.savePortfolios().catch(err => 
                console.error('Error al guardar después de eliminar portfolio:', err)
            );
        }
        
        // Emitir evento de portfolio eliminado
        this._emitEvent('portfolioDeleted', { 
            portfolioId, 
            portfolioName: deletedPortfolio.name 
        });
        
        return true;
    }
    
    /**
     * Archiva un portfolio (en lugar de eliminarlo)
     * @param {string} portfolioId - ID del portfolio a archivar
     * @returns {Object} El portfolio archivado
     */
    archivePortfolio(portfolioId) {
        const portfolioIndex = this.portfolios.findIndex(p => p.id === portfolioId);
        
        if (portfolioIndex === -1) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        // Archivar el portfolio
        const updatedPortfolio = {
            ...this.portfolios[portfolioIndex],
            isArchived: true,
            updatedAt: new Date().toISOString()
        };
        
        this.portfolios[portfolioIndex] = updatedPortfolio;
        
        // Si era el portfolio activo, establecer otro como activo
        if (this.activePortfolioId === portfolioId) {
            const availablePortfolios = this.portfolios.filter(p => !p.isArchived);
            this.activePortfolioId = availablePortfolios.length > 0 ? availablePortfolios[0].id : null;
        }
        
        // Guardar si autosave está activado
        if (this.options.autosave) {
            this.savePortfolios().catch(err => 
                console.error('Error al guardar después de archivar portfolio:', err)
            );
        }
        
        // Emitir evento de portfolio archivado
        this._emitEvent('portfolioArchived', { portfolio: updatedPortfolio });
        
        return updatedPortfolio;
    }
    
    /**
     * Añade un activo a un portfolio
     * @param {string} portfolioId - ID del portfolio
     * @param {Object} asset - Información del activo a añadir
     * @returns {Object} El activo añadido
     */
    addAsset(portfolioId, asset) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        // Validar campos requeridos
        if (!asset.symbol) {
            throw new Error('El símbolo del activo es obligatorio');
        }
        
        // Comprobar si ya existe el activo en el portfolio
        const existingAsset = portfolio.assets.find(a => a.symbol === asset.symbol);
        if (existingAsset) {
            throw new Error(`El activo "${asset.symbol}" ya existe en el portfolio`);
        }
        
        // Crear el activo
        const newAsset = {
            id: this._generateId(),
            symbol: asset.symbol,
            name: asset.name || asset.symbol,
            quantity: asset.quantity || 0,
            purchasePrice: asset.purchasePrice || 0,
            currentPrice: asset.currentPrice || 0,
            category: asset.category || 'other',
            notes: asset.notes || '',
            color: asset.color || this._getRandomColor(),
            addedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            alerts: asset.alerts || []
        };
        
        // Calcular valores derivados
        this._recalculateAssetValues(newAsset);
        
        // Añadir al portfolio
        portfolio.assets.push(newAsset);
        portfolio.updatedAt = new Date().toISOString();
        
        // Registrar transacción si hay cantidad
        if (newAsset.quantity > 0) {
            this.addTransaction(portfolioId, {
                type: 'buy',
                assetId: newAsset.id,
                symbol: newAsset.symbol,
                quantity: newAsset.quantity,
                price: newAsset.purchasePrice,
                fee: asset.fee || 0,
                notes: `Compra inicial de ${newAsset.symbol}`,
                date: newAsset.addedAt
            });
        }
        
        // Guardar si autosave está activado
        if (this.options.autosave) {
            this.savePortfolios().catch(err => 
                console.error('Error al guardar después de añadir activo:', err)
            );
        }
        
        // Emitir evento de activo añadido
        this._emitEvent('assetAdded', { 
            portfolioId, 
            asset: newAsset 
        });
        
        return newAsset;
    }
    
    /**
     * Actualiza un activo en un portfolio
     * @param {string} portfolioId - ID del portfolio
     * @param {string} assetId - ID del activo
     * @param {Object} updates - Campos a actualizar
     * @returns {Object} El activo actualizado
     */
    updateAsset(portfolioId, assetId, updates) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        const assetIndex = portfolio.assets.findIndex(a => a.id === assetId);
        
        if (assetIndex === -1) {
            throw new Error(`No existe un activo con ID "${assetId}" en el portfolio`);
        }
        
        // Campos que no se pueden actualizar directamente
        const protectedFields = ['id', 'addedAt'];
        
        // Filtrar campos protegidos
        const filteredUpdates = { ...updates };
        protectedFields.forEach(field => {
            if (field in filteredUpdates) {
                delete filteredUpdates[field];
            }
        });
        
        // Actualizar el activo
        const updatedAsset = {
            ...portfolio.assets[assetIndex],
            ...filteredUpdates,
            updatedAt: new Date().toISOString()
        };
        
        // Recalcular valores derivados
        this._recalculateAssetValues(updatedAsset);
        
        // Actualizar en el portfolio
        portfolio.assets[assetIndex] = updatedAsset;
        portfolio.updatedAt = new Date().toISOString();
        
        // Guardar si autosave está activado
        if (this.options.autosave) {
            this.savePortfolios().catch(err => 
                console.error('Error al guardar después de actualizar activo:', err)
            );
        }
        
        // Emitir evento de activo actualizado
        this._emitEvent('assetUpdated', { 
            portfolioId, 
            asset: updatedAsset 
        });
        
        return updatedAsset;
    }
    
    /**
     * Elimina un activo de un portfolio
     * @param {string} portfolioId - ID del portfolio
     * @param {string} assetId - ID del activo
     * @returns {boolean} Éxito de la operación
     */
    removeAsset(portfolioId, assetId) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        const assetIndex = portfolio.assets.findIndex(a => a.id === assetId);
        
        if (assetIndex === -1) {
            throw new Error(`No existe un activo con ID "${assetId}" en el portfolio`);
        }
        
        // Guardar referencia al activo antes de eliminarlo
        const deletedAsset = portfolio.assets[assetIndex];
        
        // Eliminar el activo
        portfolio.assets.splice(assetIndex, 1);
        portfolio.updatedAt = new Date().toISOString();
        
        // Filtrar transacciones relacionadas con el activo
        portfolio.transactions = portfolio.transactions.filter(
            tx => tx.assetId !== assetId
        );
        
        // Guardar si autosave está activado
        if (this.options.autosave) {
            this.savePortfolios().catch(err => 
                console.error('Error al guardar después de eliminar activo:', err)
            );
        }
        
        // Emitir evento de activo eliminado
        this._emitEvent('assetRemoved', { 
            portfolioId, 
            assetId,
            assetSymbol: deletedAsset.symbol
        });
        
        return true;
    }
    
    /**
     * Añade una transacción a un portfolio
     * @param {string} portfolioId - ID del portfolio
     * @param {Object} transaction - Información de la transacción
     * @returns {Object} La transacción añadida
     */
    addTransaction(portfolioId, transaction) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        // Validar campos requeridos
        if (!transaction.type) {
            throw new Error('El tipo de transacción es obligatorio');
        }
        
        if (!transaction.symbol) {
            throw new Error('El símbolo del activo es obligatorio');
        }
        
        if (typeof transaction.quantity !== 'number' || transaction.quantity <= 0) {
            throw new Error('La cantidad debe ser un número positivo');
        }
        
        if (typeof transaction.price !== 'number' || transaction.price < 0) {
            throw new Error('El precio debe ser un número no negativo');
        }
        
        // Verificar que el tipo de transacción es válido
        const validTypes = ['buy', 'sell', 'transfer_in', 'transfer_out', 'staking_reward', 'mining', 'airdrop'];
        if (!validTypes.includes(transaction.type)) {
            throw new Error(`Tipo de transacción no válido: ${transaction.type}`);
        }
        
        // Buscar el activo asociado por símbolo
        let asset = portfolio.assets.find(a => a.symbol === transaction.symbol);
        let assetId = transaction.assetId;
        
        // Si no existe el activo y es una compra, crearlo automáticamente
        if (!asset && ['buy', 'transfer_in', 'staking_reward', 'mining', 'airdrop'].includes(transaction.type)) {
            const newAsset = this.addAsset(portfolioId, {
                symbol: transaction.symbol,
                name: transaction.assetName || transaction.symbol,
                quantity: 0,  // Se actualizará después
                purchasePrice: transaction.price,
                category: transaction.category || 'other'
            });
            
            asset = newAsset;
            assetId = newAsset.id;
        } else if (!asset) {
            throw new Error(`No existe ningún activo con símbolo "${transaction.symbol}" en el portfolio`);
        } else {
            assetId = asset.id;
        }
        
        // Crear la transacción
        const newTransaction = {
            id: this._generateId(),
            type: transaction.type,
            assetId: assetId,
            symbol: transaction.symbol,
            quantity: transaction.quantity,
            price: transaction.price,
            fee: transaction.fee || 0,
            total: this._calculateTransactionTotal(transaction),
            date: transaction.date || new Date().toISOString(),
            notes: transaction.notes || '',
            createdAt: new Date().toISOString()
        };
        
        // Añadir la transacción al portfolio
        portfolio.transactions.push(newTransaction);
        portfolio.updatedAt = new Date().toISOString();
        
        // Actualizar el activo según el tipo de transacción
        if (asset) {
            let updatedQuantity = asset.quantity;
            let updatedCost = asset.quantity * asset.purchasePrice;
            
            // Actualizar cantidad y costo promedio según el tipo de transacción
            if (['buy', 'transfer_in', 'staking_reward', 'mining', 'airdrop'].includes(transaction.type)) {
                // Aumentar cantidad
                updatedQuantity += transaction.quantity;
                
                // Actualizar costo promedio (solo para compras)
                if (transaction.type === 'buy') {
                    updatedCost += transaction.quantity * transaction.price;
                }
            } else if (transaction.type === 'sell' || transaction.type === 'transfer_out') {
                // Disminuir cantidad
                updatedQuantity -= transaction.quantity;
                
                // No se debe permitir cantidad negativa
                if (updatedQuantity < 0) {
                    throw new Error(`La venta de ${transaction.quantity} ${transaction.symbol} excede la cantidad disponible (${asset.quantity})`);
                }
                
                // Ajustar costo al vender (método FIFO)
                const soldPercentage = transaction.quantity / asset.quantity;
                updatedCost -= asset.purchasePrice * transaction.quantity;
            }
            
            // Actualizar activo
            const updatedAsset = {
                ...asset,
                quantity: updatedQuantity,
                purchasePrice: updatedQuantity > 0 ? updatedCost / updatedQuantity : 0,
                updatedAt: new Date().toISOString()
            };
            
            // Recalcular valores derivados
            this._recalculateAssetValues(updatedAsset);
            
            // Actualizar en el portfolio
            const assetIndex = portfolio.assets.findIndex(a => a.id === assetId);
            portfolio.assets[assetIndex] = updatedAsset;
        }
        
        // Guardar si autosave está activado
        if (this.options.autosave) {
            this.savePortfolios().catch(err => 
                console.error('Error al guardar después de añadir transacción:', err)
            );
        }
        
        // Emitir evento de transacción añadida
        this._emitEvent('transactionAdded', { 
            portfolioId, 
            transaction: newTransaction 
        });
        
        return newTransaction;
    }
    
    /**
     * Elimina una transacción de un portfolio
     * @param {string} portfolioId - ID del portfolio
     * @param {string} transactionId - ID de la transacción
     * @returns {boolean} Éxito de la operación
     */
    removeTransaction(portfolioId, transactionId) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        const transactionIndex = portfolio.transactions.findIndex(t => t.id === transactionId);
        
        if (transactionIndex === -1) {
            throw new Error(`No existe una transacción con ID "${transactionId}" en el portfolio`);
        }
        
        // Guardar referencia a la transacción antes de eliminarla
        const deletedTransaction = portfolio.transactions[transactionIndex];
        
        // Este es un proceso complejo que requiere recalcular todo el portfolio
        // Eliminar la transacción
        portfolio.transactions.splice(transactionIndex, 1);
        
        // Recalcular todo el portfolio desde cero
        this._recalculateEntirePortfolio(portfolio);
        
        // Actualizar timestamp
        portfolio.updatedAt = new Date().toISOString();
        
        // Guardar si autosave está activado
        if (this.options.autosave) {
            this.savePortfolios().catch(err => 
                console.error('Error al guardar después de eliminar transacción:', err)
            );
        }
        
        // Emitir evento de transacción eliminada
        this._emitEvent('transactionRemoved', { 
            portfolioId, 
            transactionId, 
            transactionSymbol: deletedTransaction.symbol
        });
        
        return true;
    }
    
    /**
     * Calcula el valor total de un portfolio
     * @param {string} portfolioId - ID del portfolio
     * @returns {number} Valor total del portfolio
     */
    calculatePortfolioValue(portfolioId) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        // Sumar el valor de todos los activos
        const totalValue = portfolio.assets.reduce((sum, asset) => {
            const assetValue = asset.quantity * asset.currentPrice;
            return sum + assetValue;
        }, 0);
        
        return totalValue;
    }
    
    /**
     * Calcula el rendimiento total de un portfolio
     * @param {string} portfolioId - ID del portfolio
     * @returns {Object} Objeto con rendimiento absoluto y porcentual
     */
    calculatePortfolioPerformance(portfolioId) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        // Calcular costo total y valor actual
        let totalCost = 0;
        let totalValue = 0;
        
        portfolio.assets.forEach(asset => {
            totalCost += asset.quantity * asset.purchasePrice;
            totalValue += asset.quantity * asset.currentPrice;
        });
        
        const absoluteProfit = totalValue - totalCost;
        const percentageProfit = totalCost > 0 ? (absoluteProfit / totalCost) * 100 : 0;
        
        return {
            totalCost,
            totalValue,
            absoluteProfit,
            percentageProfit
        };
    }
    
    /**
     * Calcula métricas detalladas para un portfolio
     * @param {string} portfolioId - ID del portfolio
     * @returns {Object} Objeto con diferentes métricas
     */
    calculatePortfolioMetrics(portfolioId) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        // Performance general
        const performance = this.calculatePortfolioPerformance(portfolioId);
        
        // Calcular beneficio/pérdida realizada
        let realizedProfit = 0;
        
        // Sumar ganancias de ventas
        portfolio.transactions
            .filter(tx => tx.type === 'sell')
            .forEach(tx => {
                // Buscar transacciones de compra previas para este activo (FIFO)
                const buyTransactions = portfolio.transactions
                    .filter(t => t.type === 'buy' && t.symbol === tx.symbol && new Date(t.date) < new Date(tx.date))
                    .sort((a, b) => new Date(a.date) - new Date(b.date));
                
                // Calcular ganancia con método FIFO
                let remainingQuantity = tx.quantity;
                let costBasis = 0;
                
                for (const buyTx of buyTransactions) {
                    const usedQuantity = Math.min(buyTx.quantity, remainingQuantity);
                    costBasis += usedQuantity * buyTx.price;
                    remainingQuantity -= usedQuantity;
                    
                    if (remainingQuantity <= 0) break;
                }
                
                const saleProceeds = tx.quantity * tx.price;
                realizedProfit += saleProceeds - costBasis;
            });
        
        // Beneficio no realizado (papel) = beneficio total - beneficio realizado
        const unrealizedProfit = performance.absoluteProfit - realizedProfit;
        
        // Distribución por categorías
        const categoryDistribution = {};
        let totalValue = performance.totalValue;
        
        portfolio.assets.forEach(asset => {
            const assetValue = asset.quantity * asset.currentPrice;
            const category = asset.category || 'other';
            
            if (!categoryDistribution[category]) {
                categoryDistribution[category] = 0;
            }
            
            categoryDistribution[category] += assetValue;
        });
        
        // Convertir a porcentajes
        const categoryPercentages = {};
        for (const [category, value] of Object.entries(categoryDistribution)) {
            categoryPercentages[category] = totalValue > 0 ? (value / totalValue) * 100 : 0;
        }
        
        // Calcular diversificación (índice Herfindahl-Hirschman)
        let hhi = 0;
        if (totalValue > 0) {
            portfolio.assets.forEach(asset => {
                const assetValue = asset.quantity * asset.currentPrice;
                const percentage = assetValue / totalValue;
                hhi += percentage * percentage;
            });
        }
        
        const diversificationScore = 1 - hhi; // 0 = sin diversificación, cerca de 1 = muy diversificado
        
        // Calcular volatilidad si hay datos históricos
        let volatility = null;
        if (portfolio.historicalValue && portfolio.historicalValue.length > 1) {
            const dailyReturns = [];
            for (let i = 1; i < portfolio.historicalValue.length; i++) {
                const prevValue = portfolio.historicalValue[i - 1].value;
                const currentValue = portfolio.historicalValue[i].value;
                const dailyReturn = (currentValue - prevValue) / prevValue;
                dailyReturns.push(dailyReturn);
            }
            
            // Calcular desviación estándar de los retornos diarios
            const mean = dailyReturns.reduce((sum, value) => sum + value, 0) / dailyReturns.length;
            const variance = dailyReturns.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / dailyReturns.length;
            volatility = Math.sqrt(variance);
        }
        
        return {
            totalCost: performance.totalCost,
            totalValue: performance.totalValue,
            absoluteProfit: performance.absoluteProfit,
            percentageProfit: performance.percentageProfit,
            realizedProfit,
            unrealizedProfit,
            categoryDistribution: categoryPercentages,
            diversificationScore,
            volatility,
            assetCount: portfolio.assets.length,
            transactions: {
                total: portfolio.transactions.length,
                buys: portfolio.transactions.filter(tx => tx.type === 'buy').length,
                sells: portfolio.transactions.filter(tx => tx.type === 'sell').length
            }
        };
    }
    
    /**
     * Agrega un registro histórico del valor del portfolio
     * @param {string} portfolioId - ID del portfolio
     * @returns {Object} El registro histórico añadido
     */
    async addHistoricalValueRecord(portfolioId) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        // Actualizar precios antes de calcular el valor histórico
        await this.updatePrices(portfolioId);
        
        // Calcular valor actual del portfolio
        const totalValue = this.calculatePortfolioValue(portfolioId);
        
        // Crear registro histórico
        const historyRecord = {
            date: new Date().toISOString(),
            value: totalValue,
            assets: portfolio.assets.map(asset => ({
                symbol: asset.symbol,
                quantity: asset.quantity,
                price: asset.currentPrice,
                value: asset.quantity * asset.currentPrice
            }))
        };
        
        // Añadir al array de historico (limitado a 365 entradas)
        if (!portfolio.historicalValue) {
            portfolio.historicalValue = [];
        }
        
        portfolio.historicalValue.push(historyRecord);
        
        // Limitar a último año (365 entradas)
        if (portfolio.historicalValue.length > 365) {
            portfolio.historicalValue = portfolio.historicalValue.slice(-365);
        }
        
        // Actualizar timestamp
        portfolio.updatedAt = new Date().toISOString();
        
        // Guardar si autosave está activado
        if (this.options.autosave) {
            this.savePortfolios().catch(err => 
                console.error('Error al guardar después de añadir registro histórico:', err)
            );
        }
        
        // Emitir evento de registro histórico añadido
        this._emitEvent('historicalValueAdded', { 
            portfolioId, 
            record: historyRecord 
        });
        
        return historyRecord;
    }
    
    /**
     * Actualiza precios actuales de todos los activos de un portfolio
     * @param {string} portfolioId - ID del portfolio
     * @returns {Promise<boolean>} Éxito de la operación
     */
    async updatePrices(portfolioId) {
        try {
            const portfolio = this.getPortfolio(portfolioId);
            
            if (!portfolio) {
                throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
            }
            
            // Si no hay activos, no hacer nada
            if (portfolio.assets.length === 0) {
                return true;
            }
            
            // Obtener simbolos de los activos
            const symbols = portfolio.assets.map(asset => asset.symbol);
            
            // Obtener precios actualizados
            const prices = await this.marketDataService.getPrices(symbols);
            
            // Actualizar cada activo
            let significantChanges = [];
            
            portfolio.assets.forEach(asset => {
                if (prices[asset.symbol]) {
                    const oldPrice = asset.currentPrice;
                    const newPrice = prices[asset.symbol];
                    
                    // Calcular porcentaje de cambio
                    const priceChangePercent = oldPrice > 0 
                        ? ((newPrice - oldPrice) / oldPrice) * 100 
                        : 0;
                    
                    // Registrar cambios significativos
                    if (Math.abs(priceChangePercent) >= this.options.significantChangeThreshold) {
                        significantChanges.push({
                            symbol: asset.symbol,
                            oldPrice,
                            newPrice,
                            changePercent: priceChangePercent
                        });
                    }
                    
                    // Actualizar precio
                    asset.currentPrice = newPrice;
                    asset.updatedAt = new Date().toISOString();
                    
                    // Recalcular valores derivados
                    this._recalculateAssetValues(asset);
                }
            });
            
            // Actualizar timestamp
            portfolio.updatedAt = new Date().toISOString();
            this.lastUpdateTime = new Date().toISOString();
            
            // Notificar cambios significativos
            if (significantChanges.length > 0) {
                this._notifySignificantChanges(portfolioId, significantChanges);
            }
            
            // Guardar si autosave está activado
            if (this.options.autosave) {
                this.savePortfolios().catch(err => 
                    console.error('Error al guardar después de actualizar precios:', err)
                );
            }
            
            // Emitir evento de precios actualizados
            this._emitEvent('pricesUpdated', { 
                portfolioId, 
                timestamp: this.lastUpdateTime
            });
            
            return true;
        } catch (error) {
            console.error('Error al actualizar precios:', error);
            return false;
        }
    }
    
    /**
     * Exporta un portfolio a formato JSON
     * @param {string} portfolioId - ID del portfolio
     * @returns {string} Portfolio en formato JSON
     */
    exportPortfolioToJSON(portfolioId) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        // Incluir metadatos de exportación
        const exportData = {
            exportedAt: new Date().toISOString(),
            portfolio: { ...portfolio },
            metadata: {
                version: '1.0',
                appName: 'CryptoInvest Portfolio Manager'
            }
        };
        
        return JSON.stringify(exportData, null, 2);
    }
    
    /**
     * Exporta un portfolio a formato CSV
     * @param {string} portfolioId - ID del portfolio
     * @param {string} type - Tipo de datos a exportar ('assets' o 'transactions')
     * @returns {string} Datos en formato CSV
     */
    exportPortfolioToCSV(portfolioId, type = 'assets') {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) {
            throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
        }
        
        if (type === 'assets') {
            // Exportar activos
            const headers = [
                'Symbol', 'Name', 'Quantity', 'Purchase Price', 'Current Price',
                'Total Cost', 'Current Value', 'Profit/Loss', 'Change %', 'Category'
            ];
            
            const rows = portfolio.assets.map(asset => [
                asset.symbol,
                asset.name,
                asset.quantity,
                asset.purchasePrice,
                asset.currentPrice,
                asset.quantity * asset.purchasePrice,
                asset.quantity * asset.currentPrice,
                (asset.quantity * asset.currentPrice) - (asset.quantity * asset.purchasePrice),
                asset.profitLossPercentage,
                asset.category
            ]);
            
            return this._arrayToCSV([headers, ...rows]);
        } else if (type === 'transactions') {
            // Exportar transacciones
            const headers = [
                'Date', 'Type', 'Symbol', 'Quantity', 'Price', 'Fee',
                'Total', 'Notes'
            ];
            
            const rows = portfolio.transactions.map(tx => [
                tx.date,
                tx.type,
                tx.symbol,
                tx.quantity,
                tx.price,
                tx.fee,
                tx.total,
                tx.notes
            ]);
            
            return this._arrayToCSV([headers, ...rows]);
        } else {
            throw new Error(`Tipo de exportación no válido: ${type}`);
        }
    }
    
    /**
     * Importa un portfolio desde formato JSON
     * @param {string} jsonData - Datos en formato JSON
     * @returns {Object} El portfolio importado
     */
    importPortfolioFromJSON(jsonData) {
        try {
            const data = JSON.parse(jsonData);
            
            // Validar formato básico
            if (!data.portfolio || !data.portfolio.name) {
                throw new Error('Formato de datos no válido');
            }
            
            // Generar nuevo ID para evitar conflictos
            const importedPortfolio = {
                ...data.portfolio,
                id: this._generateId(),
                importedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            
            // Comprobar si ya existe un portfolio con ese nombre
            const existingPortfolio = this.portfolios.find(p => p.name === importedPortfolio.name);
            if (existingPortfolio) {
                importedPortfolio.name = `${importedPortfolio.name} (Importado)`;
            }
            
            // Añadir a la lista
            this.portfolios.push(importedPortfolio);
            
            // Guardar si autosave está activado
            if (this.options.autosave) {
                this.savePortfolios().catch(err => 
                    console.error('Error al guardar después de importar portfolio:', err)
                );
            }
            
            // Emitir evento de portfolio importado
            this._emitEvent('portfolioImported', { portfolio: importedPortfolio });
            
            return importedPortfolio;
        } catch (error) {
            console.error('Error al importar portfolio desde JSON:', error);
            throw new Error(`Error de importación: ${error.message}`);
        }
    }
    
    /**
     * Importa transacciones desde formato CSV
     * @param {string} portfolioId - ID del portfolio
     * @param {string} csvData - Datos en formato CSV
     * @returns {Array} Transacciones importadas
     */
    importTransactionsFromCSV(portfolioId, csvData) {
        try {
            const portfolio = this.getPortfolio(portfolioId);
            
            if (!portfolio) {
                throw new Error(`No existe un portfolio con ID "${portfolioId}"`);
            }
            
            // Parsear CSV
            const rows = this._parseCSV(csvData);
            
            // Validar cabeceras
            const requiredHeaders = ['Type', 'Symbol', 'Quantity', 'Price', 'Date'];
            const headers = rows[0].map(h => h.trim());
            
            // Verificar que todos los encabezados requeridos estén presentes
            if (!requiredHeaders.every(h => headers.includes(h))) {
                throw new Error(`Formato CSV no válido. Debe contener los encabezados: ${requiredHeaders.join(', ')}`);
            }
            
            // Mapear índices de columnas
            const colIndexes = {};
            headers.forEach((header, index) => {
                colIndexes[header.trim()] = index;
            });
            
            // Procesar cada fila
            const importedTransactions = [];
            for (let i = 1; i < rows.length; i++) {
                const row = rows[i];
                
                // Omitir filas vacías
                if (row.length <= 1) continue;
                
                // Crear objeto de transacción
                const transaction = {
                    type: row[colIndexes['Type']].trim().toLowerCase(),
                    symbol: row[colIndexes['Symbol']].trim(),
                    quantity: parseFloat(row[colIndexes['Quantity']]),
                    price: parseFloat(row[colIndexes['Price']]),
                    date: row[colIndexes['Date']].trim(),
                    notes: colIndexes['Notes'] !== undefined ? row[colIndexes['Notes']] : `Importado desde CSV`,
                    fee: colIndexes['Fee'] !== undefined ? parseFloat(row[colIndexes['Fee']]) : 0
                };
                
                // Validar datos básicos
                if (isNaN(transaction.quantity) || transaction.quantity <= 0) {
                    console.warn(`Fila ${i}: Cantidad no válida, omitiendo`);
                    continue;
                }
                
                if (isNaN(transaction.price) || transaction.price < 0) {
                    console.warn(`Fila ${i}: Precio no válido, omitiendo`);
                    continue;
                }
                
                // Añadir transacción
                try {
                    const newTransaction = this.addTransaction(portfolioId, transaction);
                    importedTransactions.push(newTransaction);
                } catch (e) {
                    console.warn(`Error al importar transacción en fila ${i}: ${e.message}`);
                }
            }
            
            // Emitir evento de transacciones importadas
            this._emitEvent('transactionsImported', { 
                portfolioId, 
                count: importedTransactions.length 
            });
            
            return importedTransactions;
        } catch (error) {
            console.error('Error al importar transacciones desde CSV:', error);
            throw new Error(`Error de importación: ${error.message}`);
        }
    }
    
    /**
     * Inicia actualizaciones automáticas de precios
     * @private
     */
    _startAutoUpdates() {
        // Detener temporizador existente si lo hay
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
        }
        
        // Configurar nuevo temporizador
        this.updateTimer = setInterval(async () => {
            if (this.portfolios.length > 0) {
                // Actualizar precios del portfolio activo si hay uno
                const activePortfolio = this.getActivePortfolio();
                if (activePortfolio) {
                    await this.updatePrices(activePortfolio.id);
                    
                    // Añadir registro histórico una vez al día
                    const now = new Date();
                    const lastRecord = activePortfolio.historicalValue && 
                                      activePortfolio.historicalValue.length > 0 ? 
                                      activePortfolio.historicalValue[activePortfolio.historicalValue.length - 1] : null;
                    
                    if (!lastRecord || new Date(lastRecord.date).getDate() !== now.getDate()) {
                        await this.addHistoricalValueRecord(activePortfolio.id);
                    }
                }
            }
        }, this.options.updateInterval);
    }
    
    /**
     * Detiene las actualizaciones automáticas de precios
     */
    stopAutoUpdates() {
        if (this.updateTimer) {
            clearInterval(this.updateTimer);
            this.updateTimer = null;
        }
    }
    
    /**
     * Crea un portfolio predeterminado
     * @private
     * @returns {Object} El portfolio creado
     */
    _createDefaultPortfolio() {
        return {
            id: this._generateId(),
            name: this.options.defaultPortfolioName,
            description: 'Portfolio creado automáticamente',
            currency: 'USD',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            assets: [],
            transactions: [],
            historicalValue: [],
            tags: [],
            isArchived: false
        };
    }
    
    /**
     * Recalcula valores derivados de un activo
     * @private
     * @param {Object} asset - Activo a recalcular
     */
    _recalculateAssetValues(asset) {
        // Valor actual
        const currentValue = asset.quantity * asset.currentPrice;
        
        // Costo total
        const cost = asset.quantity * asset.purchasePrice;
        
        // Beneficio/pérdida absoluta
        const profitLossValue = currentValue - cost;
        
        // Beneficio/pérdida porcentual
        const profitLossPercentage = cost > 0 ? (profitLossValue / cost) * 100 : 0;
        
        // Actualizar valores
        asset.currentValue = currentValue;
        asset.cost = cost;
        asset.profitLossValue = profitLossValue;
        asset.profitLossPercentage = profitLossPercentage;
    }
    
    /**
     * Recalcula todo el portfolio desde cero
     * @private
     * @param {Object} portfolio - Portfolio a recalcular
     */
    _recalculateEntirePortfolio(portfolio) {
        // Resetear todos los activos
        portfolio.assets.forEach(asset => {
            asset.quantity = 0;
            asset.purchasePrice = 0;
        });
        
        // Reordenar transacciones por fecha
        const sortedTransactions = [...portfolio.transactions]
            .sort((a, b) => new Date(a.date) - new Date(b.date));
        
        // Reconstruir los activos a partir de las transacciones
        for (const transaction of sortedTransactions) {
            // Buscar el activo
            let asset = portfolio.assets.find(a => a.symbol === transaction.symbol);
            
            // Si no existe y es una entrada, crearlo
            if (!asset && ['buy', 'transfer_in', 'staking_reward', 'mining', 'airdrop'].includes(transaction.type)) {
                asset = {
                    id: transaction.assetId || this._generateId(),
                    symbol: transaction.symbol,
                    name: transaction.symbol,
                    quantity: 0,
                    purchasePrice: 0,
                    currentPrice: 0,
                    category: 'other',
                    addedAt: transaction.date,
                    updatedAt: new Date().toISOString()
                };
                
                portfolio.assets.push(asset);
            } else if (!asset) {
                // Si es una salida y no existe el activo, ignorar
                continue;
            }
            
            // Actualizar el activo según el tipo de transacción
            let updatedQuantity = asset.quantity;
            let updatedCost = asset.quantity * asset.purchasePrice;
            
            // Procesar según el tipo de transacción
            if (['buy', 'transfer_in', 'staking_reward', 'mining', 'airdrop'].includes(transaction.type)) {
                // Aumentar cantidad
                updatedQuantity += transaction.quantity;
                
                // Actualizar costo promedio (solo para compras)
                if (transaction.type === 'buy') {
                    updatedCost += transaction.quantity * transaction.price;
                }
            } else if (transaction.type === 'sell' || transaction.type === 'transfer_out') {
                // Disminuir cantidad (ignorar si no hay suficiente)
                if (updatedQuantity >= transaction.quantity) {
                    // Método FIFO para calcular costo
                    const soldPercentage = transaction.quantity / updatedQuantity;
                    updatedCost *= (1 - soldPercentage);
                    updatedQuantity -= transaction.quantity;
                }
            }
            
            // Actualizar activo
            asset.quantity = updatedQuantity;
            asset.purchasePrice = updatedQuantity > 0 ? updatedCost / updatedQuantity : 0;
            asset.updatedAt = new Date().toISOString();
            
            // Recalcular valores derivados
            this._recalculateAssetValues(asset);
        }
        
        // Eliminar activos con cantidad cero
        portfolio.assets = portfolio.assets.filter(asset => asset.quantity > 0);
    }
    
    /**
     * Calcula el valor total de una transacción
     * @private
     * @param {Object} transaction - Transacción
     * @returns {number} Valor total
     */
    _calculateTransactionTotal(transaction) {
        let total = 0;
        
        if (['buy', 'transfer_in', 'staking_reward', 'mining', 'airdrop'].includes(transaction.type)) {
            // Entradas: cantidad * precio + comisión
            total = (transaction.quantity * transaction.price) + (transaction.fee || 0);
        } else if (transaction.type === 'sell' || transaction.type === 'transfer_out') {
            // Salidas: cantidad * precio - comisión
            total = (transaction.quantity * transaction.price) - (transaction.fee || 0);
        }
        
        return total;
    }
    
    /**
     * Notifica cambios significativos en precios
     * @private
     * @param {string} portfolioId - ID del portfolio
     * @param {Array} changes - Array de cambios significativos
     */
    _notifySignificantChanges(portfolioId, changes) {
        const portfolio = this.getPortfolio(portfolioId);
        
        if (!portfolio) return;
        
        // Iterar sobre cada cambio significativo
        changes.forEach(change => {
            const { symbol, oldPrice, newPrice, changePercent } = change;
            
            // Crear mensaje según dirección del cambio
            const direction = changePercent > 0 ? 'subido' : 'bajado';
            const message = `${symbol} ha ${direction} un ${Math.abs(changePercent).toFixed(2)}% (${oldPrice.toFixed(2)} → ${newPrice.toFixed(2)})`;
            
            // Enviar notificación
            this.notificationService.sendNotification({
                title: `Alerta de precio: ${symbol}`,
                message,
                type: 'price',
                priority: Math.abs(changePercent) > 10 ? 'high' : 'normal',
                data: {
                    portfolioId,
                    symbol,
                    oldPrice,
                    newPrice,
                    changePercent
                }
            });
            
            // Emitir evento de cambio significativo
            this._emitEvent('significantPriceChange', {
                portfolioId,
                symbol,
                oldPrice,
                newPrice,
                changePercent
            });
        });
    }
    
    /**
     * Genera un ID único
     * @private
     * @returns {string} ID único
     */
    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
    
    /**
     * Genera un color aleatorio para categorías
     * @private
     * @returns {string} Color en formato hexadecimal
     */
    _getRandomColor() {
        const colors = [
            '#4A90E2', // Azul
            '#50E3C2', // Turquesa
            '#F5A623', // Naranja
            '#D0021B', // Rojo
            '#9013FE', // Púrpura
            '#7ED321', // Verde
            '#BD10E0', // Magenta
            '#8B572A', // Marrón
            '#4A4A4A', // Gris oscuro
            '#417505'  // Verde oscuro
        ];
        
        return colors[Math.floor(Math.random() * colors.length)];
    }
    
    /**
     * Convierte un array bidimensional a formato CSV
     * @private
     * @param {Array} array - Array bidimensional
     * @returns {string} Cadena en formato CSV
     */
    _arrayToCSV(array) {
        return array.map(row => 
            row.map(value => {
                // Convertir a string y escapar comillas
                const str = String(value);
                const needsQuotes = str.includes(',') || str.includes('"') || str.includes('\n');
                
                if (needsQuotes) {
                    return `"${str.replace(/"/g, '""')}"`;
                }
                
                return str;
            }).join(',')
        ).join('\n');
    }
    
    /**
     * Parsea una cadena CSV a un array bidimensional
     * @private
     * @param {string} csv - Cadena en formato CSV
     * @returns {Array} Array bidimensional
     */
    _parseCSV(csv) {
        const lines = csv.split(/\r?\n/);
        const result = [];
        
        for (const line of lines) {
            // Omitir líneas vacías
            if (!line.trim()) continue;
            
            const row = [];
            let cell = '';
            let inQuotes = false;
            
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                
                if (char === '"') {
                    // Comprobar si es una comilla escapada
                    if (inQuotes && i+1 < line.length && line[i+1] === '"') {
                        cell += '"';
                        i++; // Saltar la siguiente comilla
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    // Fin de celda
                    row.push(cell);
                    cell = '';
                } else {
                    cell += char;
                }
            }
            
            // Añadir la última celda
            row.push(cell);
            result.push(row);
        }
        
        return result;
    }
    
    /**
     * Emite un evento personalizado
     * @private
     * @param {string} eventName - Nombre del evento
     * @param {Object} detail - Datos del evento
     */
    _emitEvent(eventName, detail = {}) {
        const event = new CustomEvent(eventName, {
            detail: { ...detail, timestamp: new Date().toISOString() }
        });
        document.dispatchEvent(event);
    }
}

// Exportar también una instancia predeterminada para uso rápido
export const portfolioManager = new PortfolioManager();
