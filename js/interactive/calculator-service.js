/**
 * calculator-service.js
 * Servicio para todas las calculadoras financieras del portal de criptomonedas
 * @module CalculatorService
 */

import { MarketDataService } from '../market/market-data-service.js';
import { StorageManager } from '../utils/storage-manager.js';
import { EventBus } from '../utils/event-bus.js';

/**
 * Clase principal que gestiona todas las calculadoras financieras
 */
export class CalculatorService {
    /**
     * Constructor del servicio de calculadoras
     * @param {Object} options - Opciones de configuración
     */
    constructor(options = {}) {
        this.options = {
            // Configuración por defecto
            storageNamespace: 'calculator',
            maxSavedCalculations: 20,
            defaultFiatCurrency: 'USD',
            taxRates: {
                shortTerm: 0.35, // 35% para ganancias a corto plazo (ejemplo)
                longTerm: 0.15   // 15% para ganancias a largo plazo (ejemplo)
            },
            longTermThresholdDays: 365, // Umbral para considerar ganancia a largo plazo
            monteCarloPrecision: 1000,  // Número de simulaciones para Monte Carlo
            ...options
        };
        
        // Referencias a servicios
        this.marketDataService = new MarketDataService();
        
        // Caché interna para tasas de cambio
        this.exchangeRatesCache = {
            timestamp: 0,
            rates: {},
            ttl: 5 * 60 * 1000 // 5 minutos
        };
        
        // Inicializar
        this._loadRecentCalculations();
        
        // Registrar en eventos relevantes
        EventBus.subscribe('market.priceUpdate', this._updateExchangeRates.bind(this));
    }
    
    /**
     * Convierte una cantidad entre diferentes monedas (cripto o fiat)
     * @param {number} amount - Cantidad a convertir
     * @param {string} fromCurrency - Moneda de origen (ej: 'BTC', 'USD')
     * @param {string} toCurrency - Moneda de destino (ej: 'ETH', 'EUR')
     * @returns {Promise<{value: number, rate: number}>} Resultado de la conversión
     */
    async convertCurrency(amount, fromCurrency, toCurrency) {
        try {
            this._validateInput({ amount, fromCurrency, toCurrency });
            
            // Si las monedas son iguales, devolver la misma cantidad
            if (fromCurrency === toCurrency) {
                return { value: amount, rate: 1 };
            }
            
            // Obtener tasa de cambio
            const rate = await this._getExchangeRate(fromCurrency, toCurrency);
            
            // Calcular valor convertido
            const value = amount * rate;
            
            // Guardar cálculo reciente
            this._saveRecentCalculation('conversion', {
                amount,
                fromCurrency,
                toCurrency,
                result: value,
                rate,
                timestamp: Date.now()
            });
            
            return { value, rate };
        } catch (error) {
            console.error('Error en convertCurrency:', error);
            throw new Error(`Error al convertir moneda: ${error.message}`);
        }
    }
    
    /**
     * Calcula ganancias o pérdidas de una operación
     * @param {Object} params - Parámetros de la operación
     * @param {number} params.buyPrice - Precio de compra
     * @param {number} params.sellPrice - Precio de venta
     * @param {number} params.amount - Cantidad de criptomoneda
     * @param {number} params.buyFees - Comisiones de compra
     * @param {number} params.sellFees - Comisiones de venta
     * @returns {Object} Resultado del cálculo (ganancia/pérdida absoluta y porcentual)
     */
    calculateProfitLoss({ buyPrice, sellPrice, amount, buyFees = 0, sellFees = 0 }) {
        try {
            this._validateInput({ buyPrice, sellPrice, amount });
            
            // Calcular coste total de compra
            const totalBuyCost = (buyPrice * amount) + buyFees;
            
            // Calcular valor total de venta
            const totalSellValue = (sellPrice * amount) - sellFees;
            
            // Calcular ganancia/pérdida absoluta
            const absoluteProfitLoss = totalSellValue - totalBuyCost;
            
            // Calcular ganancia/pérdida porcentual
            const percentProfitLoss = (absoluteProfitLoss / totalBuyCost) * 100;
            
            // Calcular ROI
            const roi = absoluteProfitLoss / totalBuyCost;
            
            // Guardar cálculo reciente
            this._saveRecentCalculation('profitLoss', {
                buyPrice,
                sellPrice,
                amount,
                buyFees,
                sellFees,
                absoluteProfitLoss,
                percentProfitLoss,
                roi,
                timestamp: Date.now()
            });
            
            return {
                investment: totalBuyCost,
                returnValue: totalSellValue,
                absoluteProfitLoss,
                percentProfitLoss,
                roi
            };
        } catch (error) {
            console.error('Error en calculateProfitLoss:', error);
            throw new Error(`Error al calcular ganancia/pérdida: ${error.message}`);
        }
    }
    
    /**
     * Calcula resultados de una estrategia DCA (Dollar-Cost Averaging)
     * @param {Object} params - Parámetros para la estrategia DCA
     * @param {string} params.coin - Símbolo de la criptomoneda (ej: 'BTC')
     * @param {number} params.investmentAmount - Cantidad a invertir en cada período
     * @param {string} params.frequency - Frecuencia de inversión ('daily', 'weekly', 'monthly')
     * @param {number} params.periods - Número de períodos
     * @param {Array<Object>} params.priceData - Datos históricos de precios (opcional)
     * @returns {Promise<Object>} Resultados de la estrategia DCA
     */
    async calculateDCA({ coin, investmentAmount, frequency, periods, priceData = null }) {
        try {
            this._validateInput({ coin, investmentAmount, frequency, periods });
            
            // Convertir frecuencia a días
            const daysMap = {
                'daily': 1,
                'weekly': 7,
                'monthly': 30
            };
            const intervalDays = daysMap[frequency] || 30;
            const totalDays = periods * intervalDays;
            
            // Obtener datos históricos si no se proporcionaron
            if (!priceData) {
                priceData = await this.marketDataService.getHistoricalData(coin, totalDays);
            }
            
            // Inicializar variables para el cálculo
            let totalInvested = 0;
            let totalCoins = 0;
            let dcaEntries = [];
            
            // Calcular para cada período
            for (let i = 0; i < periods; i++) {
                const dayIndex = Math.min(i * intervalDays, priceData.length - 1);
                const pricePoint = priceData[dayIndex];
                const price = pricePoint.price;
                const date = new Date(pricePoint.timestamp);
                
                // Calcular cantidad de monedas adquiridas en este período
                const coinsAcquired = investmentAmount / price;
                
                // Actualizar totales
                totalInvested += investmentAmount;
                totalCoins += coinsAcquired;
                
                // Registrar esta entrada
                dcaEntries.push({
                    date,
                    price,
                    investmentAmount,
                    coinsAcquired,
                    runningTotalCoins: totalCoins,
                    runningTotalInvested: totalInvested
                });
            }
            
            // Calcular precio promedio de compra
            const averageBuyPrice = totalInvested / totalCoins;
            
            // Calcular valor actual (usando el último precio disponible)
            const currentPrice = priceData[0].price;
            const currentValue = totalCoins * currentPrice;
            
            // Calcular ganancia/pérdida
            const absoluteProfitLoss = currentValue - totalInvested;
            const percentProfitLoss = (absoluteProfitLoss / totalInvested) * 100;
            
            // Guardar cálculo reciente
            this._saveRecentCalculation('dca', {
                coin,
                investmentAmount,
                frequency,
                periods,
                totalInvested,
                totalCoins,
                averageBuyPrice,
                currentValue,
                absoluteProfitLoss,
                percentProfitLoss,
                timestamp: Date.now()
            });
            
            return {
                totalInvested,
                totalCoins,
                averageBuyPrice,
                currentPrice,
                currentValue,
                absoluteProfitLoss,
                percentProfitLoss,
                entries: dcaEntries
            };
        } catch (error) {
            console.error('Error en calculateDCA:', error);
            throw new Error(`Error al calcular estrategia DCA: ${error.message}`);
        }
    }
    
    /**
     * Proyecta el valor futuro de una inversión usando simulación Monte Carlo
     * @param {Object} params - Parámetros para la proyección
     * @param {string} params.coin - Símbolo de la criptomoneda
     * @param {number} params.initialInvestment - Inversión inicial
     * @param {number} params.monthlyContribution - Contribución mensual (opcional)
     * @param {number} params.years - Años de proyección
     * @param {number} params.confidentLevel - Nivel de confianza (0-1, por defecto 0.95)
     * @returns {Promise<Object>} Resultados de la proyección
     */
    async projectInvestment({ coin, initialInvestment, monthlyContribution = 0, years, confidenceLevel = 0.95 }) {
        try {
            this._validateInput({ coin, initialInvestment, years });
            
            // Obtener datos históricos de volatilidad
            const historicalData = await this.marketDataService.getHistoricalData(coin, 365 * 2); // 2 años
            
            // Calcular retornos diarios
            const dailyReturns = [];
            for (let i = 1; i < historicalData.length; i++) {
                const returnRate = historicalData[i-1].price / historicalData[i].price - 1;
                dailyReturns.push(returnRate);
            }
            
            // Calcular media y desviación estándar de retornos
            const mean = dailyReturns.reduce((sum, val) => sum + val, 0) / dailyReturns.length;
            const variance = dailyReturns.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyReturns.length;
            const stdDev = Math.sqrt(variance);
            
            // Calcular retorno anual esperado y volatilidad
            const annualReturnMean = mean * 365;
            const annualReturnStdDev = stdDev * Math.sqrt(365);
            
            // Realizar simulación Monte Carlo
            const numberOfSimulations = this.options.monteCarloPrecision;
            const totalDays = years * 365;
            const monthDays = 30;
            const simulations = [];
            
            for (let sim = 0; sim < numberOfSimulations; sim++) {
                let currentValue = initialInvestment;
                let monthlyTracker = 0;
                const simulationPath = [{ day: 0, value: currentValue }];
                
                for (let day = 1; day <= totalDays; day++) {
                    // Añadir contribución mensual si corresponde
                    if (monthlyContribution > 0) {
                        monthlyTracker++;
                        if (monthlyTracker >= monthDays) {
                            currentValue += monthlyContribution;
                            monthlyTracker = 0;
                        }
                    }
                    
                    // Simular movimiento diario usando distribución normal
                    // Fórmula: S_t = S_{t-1} * exp((μ - σ²/2) * Δt + σ * √Δt * Z)
                    // donde Z es una variable aleatoria normal estándar
                    const z = this._generateRandomNormal();
                    const dailyReturn = Math.exp((mean - variance/2) + stdDev * z);
                    currentValue *= dailyReturn;
                    
                    // Guardar puntos de control (para gráficos)
                    if (day % 30 === 0 || day === totalDays) {
                        simulationPath.push({ day, value: currentValue });
                    }
                }
                
                simulations.push({
                    finalValue: currentValue,
                    path: simulationPath
                });
            }
            
            // Ordenar simulaciones por valor final
            simulations.sort((a, b) => a.finalValue - b.finalValue);
            
            // Calcular percentiles para intervalos de confianza
            const medianIndex = Math.floor(numberOfSimulations / 2);
            const lowerBoundIndex = Math.floor(numberOfSimulations * (1 - confidenceLevel) / 2);
            const upperBoundIndex = Math.floor(numberOfSimulations * (1 + confidenceLevel) / 2);
            
            const medianSimulation = simulations[medianIndex];
            const worstCaseSimulation = simulations[lowerBoundIndex];
            const bestCaseSimulation = simulations[upperBoundIndex];
            
            // Calcular totales
            const totalInvested = initialInvestment + (monthlyContribution * 12 * years);
            
            // Guardar cálculo reciente
            this._saveRecentCalculation('projection', {
                coin,
                initialInvestment,
                monthlyContribution,
                years,
                totalInvested,
                medianProjectedValue: medianSimulation.finalValue,
                worstCaseValue: worstCaseSimulation.finalValue,
                bestCaseValue: bestCaseSimulation.finalValue,
                timestamp: Date.now()
            });
            
            return {
                initialInvestment,
                monthlyContribution,
                years,
                totalInvested,
                annualReturnMean: annualReturnMean * 100,
                annualVolatility: annualReturnStdDev * 100,
                medianProjectedValue: medianSimulation.finalValue,
                medianROI: (medianSimulation.finalValue - totalInvested) / totalInvested,
                confidenceInterval: {
                    level: confidenceLevel * 100,
                    lowerBound: worstCaseSimulation.finalValue,
                    upperBound: bestCaseSimulation.finalValue
                },
                simulationPaths: {
                    median: medianSimulation.path,
                    worstCase: worstCaseSimulation.path,
                    bestCase: bestCaseSimulation.path
                }
            };
        } catch (error) {
            console.error('Error en projectInvestment:', error);
            throw new Error(`Error al proyectar inversión: ${error.message}`);
        }
    }
    
    /**
     * Calcula impuestos para operaciones con criptomonedas
     * @param {Object} params - Parámetros para el cálculo
     * @param {Array<Object>} params.transactions - Lista de transacciones
     * @param {string} params.taxMethod - Método de cálculo ('FIFO', 'LIFO', 'WAC')
     * @param {string} params.taxYear - Año fiscal
     * @param {string} params.country - País para reglas fiscales (opcional)
     * @returns {Object} Resultados del cálculo de impuestos
     */
    calculateTaxes({ transactions, taxMethod = 'FIFO', taxYear, country = null }) {
        try {
            this._validateInput({ transactions, taxMethod, taxYear });
            
            // Ordenar transacciones por fecha
            const sortedTransactions = [...transactions].sort((a, b) => a.date - b.date);
            
            // Filtrar transacciones del año fiscal seleccionado
            const yearStart = new Date(`${taxYear}-01-01T00:00:00Z`);
            const yearEnd = new Date(`${taxYear}-12-31T23:59:59Z`);
            
            const yearTransactions = sortedTransactions.filter(tx => {
                const txDate = new Date(tx.date);
                return txDate >= yearStart && txDate <= yearEnd;
            });
            
            // Agrupar transacciones por criptomoneda
            const coinTransactions = {};
            yearTransactions.forEach(tx => {
                if (!coinTransactions[tx.coin]) {
                    coinTransactions[tx.coin] = [];
                }
                coinTransactions[tx.coin].push(tx);
            });
            
            // Inicializar resultados
            const taxResult = {
                shortTermGains: 0,
                longTermGains: 0,
                totalCapitalGains: 0,
                shortTermTax: 0,
                longTermTax: 0,
                totalTaxDue: 0,
                coinBreakdown: {},
                taxEvents: []
            };
            
            // Calcular para cada moneda
            for (const coin in coinTransactions) {
                const txs = coinTransactions[coin];
                const coinResult = this._calculateCoinTaxes(txs, taxMethod, yearStart);
                
                // Acumular resultados
                taxResult.shortTermGains += coinResult.shortTermGains;
                taxResult.longTermGains += coinResult.longTermGains;
                taxResult.totalCapitalGains += coinResult.totalCapitalGains;
                taxResult.taxEvents = [...taxResult.taxEvents, ...coinResult.taxEvents];
                taxResult.coinBreakdown[coin] = coinResult;
            }
            
            // Calcular impuestos aplicando tasas
            taxResult.shortTermTax = taxResult.shortTermGains * this.options.taxRates.shortTerm;
            taxResult.longTermTax = taxResult.longTermGains * this.options.taxRates.longTerm;
            taxResult.totalTaxDue = taxResult.shortTermTax + taxResult.longTermTax;
            
            // Guardar cálculo reciente
            this._saveRecentCalculation('taxes', {
                taxYear,
                taxMethod,
                country,
                shortTermGains: taxResult.shortTermGains,
                longTermGains: taxResult.longTermGains,
                totalTaxDue: taxResult.totalTaxDue,
                timestamp: Date.now()
            });
            
            return taxResult;
        } catch (error) {
            console.error('Error en calculateTaxes:', error);
            throw new Error(`Error al calcular impuestos: ${error.message}`);
        }
    }
    
    /**
     * Calcula rendimientos de staking o yield farming
     * @param {Object} params - Parámetros para el cálculo
     * @param {number} params.principal - Cantidad inicial de criptomoneda
     * @param {number} params.apy - APY (Annual Percentage Yield) en porcentaje
     * @param {number} params.days - Días de staking
     * @param {string} params.compoundingFrequency - Frecuencia de reinversión ('daily', 'weekly', 'monthly', 'none')
     * @param {number} params.additionalDeposits - Depósitos adicionales periódicos (opcional)
     * @param {string} params.depositFrequency - Frecuencia de depósitos adicionales (opcional)
     * @returns {Object} Resultados del cálculo de rendimiento
     */
    calculateStakingYield({ principal, apy, days, compoundingFrequency = 'daily', additionalDeposits = 0, depositFrequency = 'monthly' }) {
        try {
            this._validateInput({ principal, apy, days });
            
            // Convertir APY a tasa decimal
            const apyDecimal = apy / 100;
            
            // Determinar el número de períodos de composición
            const compoundingMap = {
                'hourly': 24 * 365,
                'daily': 365,
                'weekly': 52,
                'monthly': 12,
                'none': 1
            };
            
            const depositMap = {
                'daily': 365,
                'weekly': 52,
                'monthly': 12
            };
            
            const compoundingPeriodsPerYear = compoundingMap[compoundingFrequency] || 1;
            const depositPeriodsPerYear = depositMap[depositFrequency] || 12;
            
            // Calcular tasa por período
            const ratePerPeriod = apyDecimal / compoundingPeriodsPerYear;
            
            // Calcular número de períodos durante los días especificados
            const totalPeriods = (days / 365) * compoundingPeriodsPerYear;
            const totalDepositPeriods = Math.floor((days / 365) * depositPeriodsPerYear);
            
            let finalAmount;
            let totalDeposited = principal;
            let interestEarned;
            const timeline = [{ day: 0, amount: principal }];
            
            if (compoundingFrequency === 'none') {
                // Sin composición (interés simple)
                const dailyRate = apyDecimal / 365;
                finalAmount = principal + (principal * dailyRate * days);
                
                // Si hay depósitos adicionales
                if (additionalDeposits > 0) {
                    const daysPerDepositPeriod = 365 / depositPeriodsPerYear;
                    
                    for (let i = 0; i < totalDepositPeriods; i++) {
                        const depositDay = Math.ceil((i + 1) * daysPerDepositPeriod);
                        if (depositDay < days) {
                            const daysRemaining = days - depositDay;
                            const depositInterest = additionalDeposits * dailyRate * daysRemaining;
                            finalAmount += additionalDeposits + depositInterest;
                            totalDeposited += additionalDeposits;
                            
                            // Agregar punto a la línea de tiempo
                            timeline.push({
                                day: depositDay,
                                amount: finalAmount,
                                deposit: additionalDeposits
                            });
                        }
                    }
                }
            } else {
                // Con composición
                finalAmount = principal * Math.pow(1 + ratePerPeriod, totalPeriods);
                
                // Si hay depósitos adicionales
                if (additionalDeposits > 0) {
                    // Simulación día a día para mayor precisión con depósitos
                    let currentAmount = principal;
                    const dailyRate = apyDecimal / 365;
                    let nextDepositDay = Math.ceil(365 / depositPeriodsPerYear);
                    
                    for (let day = 1; day <= days; day++) {
                        // Aplicar interés diario
                        currentAmount *= (1 + dailyRate);
                        
                        // Verificar si es día de depósito
                        if (day === nextDepositDay && day < days) {
                            currentAmount += additionalDeposits;
                            totalDeposited += additionalDeposits;
                            nextDepositDay += Math.ceil(365 / depositPeriodsPerYear);
                            
                            // Agregar punto a la línea de tiempo
                            timeline.push({
                                day,
                                amount: currentAmount,
                                deposit: additionalDeposits
                            });
                        }
                        
                        // Agregar puntos periódicos a la línea de tiempo
                        if (day % 30 === 0 || day === days) {
                            timeline.push({
                                day,
                                amount: currentAmount
                            });
                        }
                    }
                    
                    finalAmount = currentAmount;
                } else {
                    // Agregar puntos a la línea de tiempo para gráfico
                    const periodsPerMonth = compoundingPeriodsPerYear / 12;
                    for (let i = 1; i <= Math.ceil(totalPeriods); i++) {
                        if (i % periodsPerMonth === 0 || i === Math.ceil(totalPeriods)) {
                            const day = Math.min(Math.ceil((i / compoundingPeriodsPerYear) * 365), days);
                            const amount = principal * Math.pow(1 + ratePerPeriod, i);
                            timeline.push({ day, amount });
                        }
                    }
                }
            }
            
            // Calcular interés ganado
            interestEarned = finalAmount - totalDeposited;
            
            // Calcular rendimiento efectivo
            const effectiveYield = (Math.pow(finalAmount / totalDeposited, 365 / days) - 1) * 100;
            
            // Calcular APY equivalente
            let equivalentAPY;
            if (compoundingFrequency === 'none') {
                equivalentAPY = apy; // APY es igual al interés simple anual
            } else {
                equivalentAPY = (Math.pow(1 + apyDecimal / compoundingPeriodsPerYear, compoundingPeriodsPerYear) - 1) * 100;
            }
            
            // Guardar cálculo reciente
            this._saveRecentCalculation('stakingYield', {
                principal,
                apy,
                days,
                compoundingFrequency,
                additionalDeposits,
                depositFrequency,
                finalAmount,
                interestEarned,
                effectiveYield,
                timestamp: Date.now()
            });
            
            return {
                principal,
                apy,
                days,
                compoundingFrequency,
                additionalDeposits,
                depositFrequency,
                totalDeposited,
                finalAmount,
                interestEarned,
                effectiveYield,
                equivalentAPY,
                timeline
            };
        } catch (error) {
            console.error('Error en calculateStakingYield:', error);
            throw new Error(`Error al calcular rendimiento de staking: ${error.message}`);
        }
    }
    
    /**
     * Calcula el ROI (Return on Investment) de una inversión
     * @param {Object} params - Parámetros para el cálculo
     * @param {number} params.initialInvestment - Inversión inicial
     * @param {number} params.finalValue - Valor final de la inversión
     * @param {number} params.timeInDays - Tiempo de la inversión en días (opcional)
     * @param {number} params.additionalInvestments - Inversiones adicionales (opcional)
     * @returns {Object} Resultados del cálculo de ROI
     */
    calculateROI({ initialInvestment, finalValue, timeInDays = null, additionalInvestments = 0 }) {
        try {
            this._validateInput({ initialInvestment, finalValue });
            
            // Calcular inversión total
            const totalInvestment = initialInvestment + additionalInvestments;
            
            // Calcular ganancia neta
            const netProfit = finalValue - totalInvestment;
            
            // Calcular ROI simple
            const roi = netProfit / totalInvestment;
            const roiPercentage = roi * 100;
            
            // Calcular ROI anualizado si se proporciona el tiempo
            let annualizedROI = null;
            if (timeInDays && timeInDays > 0) {
                // Fórmula: (1 + ROI)^(365 / días) - 1
                annualizedROI = (Math.pow(1 + roi, 365 / timeInDays) - 1) * 100;
            }
            
            // Guardar cálculo reciente
            this._saveRecentCalculation('roi', {
                initialInvestment,
                additionalInvestments,
                totalInvestment,
                finalValue,
                netProfit,
                roi,
                roiPercentage,
                timeInDays,
                annualizedROI,
                timestamp: Date.now()
            });
            
            return {
                initialInvestment,
                additionalInvestments,
                totalInvestment,
                finalValue,
                netProfit,
                roi,
                roiPercentage,
                timeInDays,
                annualizedROI
            };
        } catch (error) {
            console.error('Error en calculateROI:', error);
            throw new Error(`Error al calcular ROI: ${error.message}`);
        }
    }
    
    /**
     * Obtiene la tasa de cambio entre dos monedas
     * @param {string} fromCurrency - Moneda de origen
     * @param {string} toCurrency - Moneda de destino
     * @returns {Promise<number>} Tasa de cambio
     * @private
     */
    async _getExchangeRate(fromCurrency, toCurrency) {
        // Verificar si necesitamos actualizar la caché
        const now = Date.now();
        if (now - this.exchangeRatesCache.timestamp > this.exchangeRatesCache.ttl) {
            await this._updateExchangeRates();
        }
        
        const rates = this.exchangeRatesCache.rates;
        
        // Caso base: convertir a USD
        let rateFromToUSD = 1;
        if (fromCurrency !== 'USD') {
            if (!rates[fromCurrency]) {
                throw new Error(`Tasa de cambio no disponible para ${fromCurrency}`);
            }
            rateFromToUSD = rates[fromCurrency].USD;
        }
        
        // Caso base: convertir desde USD
        let rateUSDToTo = 1;
        if (toCurrency !== 'USD') {
            if (!rates[toCurrency]) {
                throw new Error(`Tasa de cambio no disponible para ${toCurrency}`);
            }
            rateUSDToTo = 1 / rates[toCurrency].USD;
        }
        
        // Calcular tasa compuesta
        return rateFromToUSD * rateUSDToTo;
    }
    
    /**
     * Actualiza las tasas de cambio en caché
     * @private
     */
    async _updateExchangeRates() {
        try {
            // Obtener tasas de cambio actualizadas
            const exchangeRates = await this.marketDataService.getExchangeRates();
            
            // Actualizar caché
            this.exchangeRatesCache = {
                timestamp: Date.now(),
                rates: exchangeRates,
                ttl: 5 * 60 * 1000 // 5 minutos
            };
        } catch (error) {
            console.error('Error al actualizar tasas de cambio:', error);
            // Si falla la actualización pero hay datos en caché, extender TTL
            if (this.exchangeRatesCache.rates && Object.keys(this.exchangeRatesCache.rates).length > 0) {
                this.exchangeRatesCache.ttl += 5 * 60 * 1000; // Extender 5 minutos más
            }
        }
    }
    
    /**
     * Calcula impuestos para una moneda específica
     * @param {Array<Object>} transactions - Transacciones de la moneda
     * @param {string} taxMethod - Método de cálculo fiscal
     * @param {Date} yearStart - Fecha de inicio del año fiscal
     * @returns {Object} Resultados fiscales para la moneda
     * @private
     */
    _calculateCoinTaxes(transactions, taxMethod, yearStart) {
        // Separar compras y ventas
        const buys = transactions.filter(tx => tx.type === 'buy' || tx.type === 'receive');
        const sells = transactions.filter(tx => tx.type === 'sell' || tx.type === 'send');
        
        // Inicializar resultados
        const result = {
            shortTermGains: 0,
            longTermGains: 0,
            totalCapitalGains: 0,
            taxEvents: []
        };
        
        // Para cada venta, calcular la ganancia/pérdida según el método fiscal
        sells.forEach(sell => {
            let remainingAmount = sell.amount;
            let costBasis = 0;
            const taxEvent = {
                date: sell.date,
                coin: sell.coin,
                amount: sell.amount,
                proceeds: sell.amount * sell.price,
                costBasis: 0,
                gainLoss: 0,
                term: '',
                matchedBuys: []
            };
            
            // Ordenar compras según el método fiscal
            let processingBuys = [...buys];
            if (taxMethod === 'FIFO') {
                // Primero en entrar, primero en salir (más antiguas primero)
                processingBuys.sort((a, b) => a.date - b.date);
            } else if (taxMethod === 'LIFO') {
                // Último en entrar, primero en salir (más recientes primero)
                processingBuys.sort((a, b) => b.date - a.date);
            } else if (taxMethod === 'WAC') {
                // Coste promedio ponderado
                let totalCost = 0;
                let totalAmount = 0;
                
                processingBuys.forEach(buy => {
                    totalCost += buy.amount * buy.price;
                    totalAmount += buy.amount;
                });
                
                const averageCost = totalAmount > 0 ? totalCost / totalAmount : 0;
                costBasis = remainingAmount * averageCost;
                remainingAmount = 0;
                
                // Registrar ganancia/pérdida
                const proceedsAmount = sell.amount * sell.price;
                const gainLoss = proceedsAmount - costBasis;
                
                // Determinar si es corto o largo plazo
                // Simplificación: para WAC usamos la fecha media ponderada de compras
                let weightedDateSum = 0;
                processingBuys.forEach(buy => {
                    weightedDateSum += buy.date.getTime() * (buy.amount / totalAmount);
                });
                
                const weightedBuyDate = new Date(weightedDateSum);
                const daysHeld = (sell.date - weightedBuyDate) / (1000 * 60 * 60 * 24);
                const isLongTerm = daysHeld >= this.options.longTermThresholdDays;
                
                // Actualizar resultados
                if (isLongTerm) {
                    result.longTermGains += gainLoss;
                    taxEvent.term = 'Largo plazo';
                } else {
                    result.shortTermGains += gainLoss;
                    taxEvent.term = 'Corto plazo';
                }
                
                taxEvent.costBasis = costBasis;
                taxEvent.gainLoss = gainLoss;
                taxEvent.daysHeld = daysHeld;
                
                // Añadir todas las compras como una única entrada promedio
                taxEvent.matchedBuys.push({
                    date: weightedBuyDate,
                    amount: sell.amount,
                    price: averageCost,
                    cost: costBasis
                });
                
                result.taxEvents.push(taxEvent);
                return; // Salir de esta venta
            }
            
            // Para FIFO y LIFO
            while (remainingAmount > 0 && processingBuys.length > 0) {
                const buy = processingBuys[0];
                
                // Verificar si ya está agotada esta compra
                if (buy.used && buy.used >= buy.amount) {
                    processingBuys.shift();
                    continue;
                }
                
                // Inicializar campo 'used' si no existe
                if (!buy.used) buy.used = 0;
                
                // Calcular cantidad a usar de esta compra
                const availableToBuy = buy.amount - buy.used;
                const amountUsed = Math.min(remainingAmount, availableToBuy);
                
                // Actualizar cantidad usada
                buy.used += amountUsed;
                remainingAmount -= amountUsed;
                
                // Calcular coste base para esta parte
                const partialCostBasis = amountUsed * buy.price;
                costBasis += partialCostBasis;
                
                // Registrar esta coincidencia
                taxEvent.matchedBuys.push({
                    date: buy.date,
                    amount: amountUsed,
                    price: buy.price,
                    cost: partialCostBasis
                });
                
                // Si hemos agotado esta compra, quitarla de la lista
                if (buy.used >= buy.amount) {
                    processingBuys.shift();
                }
            }
            
            // Calcular ganancia/pérdida
            const proceeds = sell.amount * sell.price;
            const gainLoss = proceeds - costBasis;
            
            // Determinar si hay ganancias a corto o largo plazo
            taxEvent.costBasis = costBasis;
            taxEvent.gainLoss = gainLoss;
            taxEvent.proceeds = proceeds;
            
            // Calcular términos mezclados si es necesario
            if (taxEvent.matchedBuys.length > 0) {
                let shortTermAmount = 0;
                let longTermAmount = 0;
                
                taxEvent.matchedBuys.forEach(match => {
                    const daysHeld = (sell.date - match.date) / (1000 * 60 * 60 * 24);
                    const isLongTerm = daysHeld >= this.options.longTermThresholdDays;
                    
                    if (isLongTerm) {
                        longTermAmount += match.amount;
                    } else {
                        shortTermAmount += match.amount;
                    }
                });
                
                // Asignar ganancias/pérdidas proporcionalmente
                const totalAmount = shortTermAmount + longTermAmount;
                const shortTermShare = shortTermAmount / totalAmount;
                const longTermShare = longTermAmount / totalAmount;
                
                const shortTermGainLoss = gainLoss * shortTermShare;
                const longTermGainLoss = gainLoss * longTermShare;
                
                result.shortTermGains += shortTermGainLoss;
                result.longTermGains += longTermGainLoss;
                
                if (shortTermAmount > 0 && longTermAmount > 0) {
                    taxEvent.term = 'Mixto';
                    taxEvent.shortTermShare = shortTermShare;
                    taxEvent.longTermShare = longTermShare;
                } else if (longTermAmount > 0) {
                    taxEvent.term = 'Largo plazo';
                } else {
                    taxEvent.term = 'Corto plazo';
                }
            } else {
                // Si no hay coincidencias (esto no debería ocurrir normalmente)
                result.shortTermGains += gainLoss;
                taxEvent.term = 'Desconocido';
            }
            
            result.taxEvents.push(taxEvent);
        });
        
        // Calcular ganancia/pérdida total
        result.totalCapitalGains = result.shortTermGains + result.longTermGains;
        
        return result;
    }
    
    /**
     * Valida los parámetros de entrada
     * @param {Object} params - Parámetros a validar
     * @throws {Error} Si algún parámetro no es válido
     * @private
     */
    _validateInput(params) {
        for (const [key, value] of Object.entries(params)) {
            // Validar números
            if (['amount', 'buyPrice', 'sellPrice', 'investmentAmount', 'initialInvestment', 
                 'monthlyContribution', 'years', 'principal', 'apy', 'days', 'finalValue'].includes(key)) {
                if (typeof value !== 'number' || isNaN(value)) {
                    throw new Error(`El parámetro ${key} debe ser un número válido`);
                }
                
                if (['amount', 'buyPrice', 'sellPrice', 'investmentAmount', 'initialInvestment', 
                     'monthlyContribution', 'principal', 'apy', 'finalValue'].includes(key) && value < 0) {
                    throw new Error(`El parámetro ${key} no puede ser negativo`);
                }
            }
            
            // Validar strings
            if (['coin', 'fromCurrency', 'toCurrency', 'frequency', 
                 'taxMethod', 'taxYear', 'compoundingFrequency'].includes(key)) {
                if (typeof value !== 'string' || value.trim() === '') {
                    throw new Error(`El parámetro ${key} debe ser una cadena válida`);
                }
            }
            
            // Validar arrays
            if (['transactions', 'priceData'].includes(key) && value !== null) {
                if (!Array.isArray(value)) {
                    throw new Error(`El parámetro ${key} debe ser un array`);
                }
            }
            
            // Validaciones específicas
            if (key === 'periods' && (typeof value !== 'number' || value <= 0 || !Number.isInteger(value))) {
                throw new Error('El número de períodos debe ser un entero positivo');
            }
            
            if (key === 'frequency' && !['daily', 'weekly', 'monthly'].includes(value)) {
                throw new Error('La frecuencia debe ser "daily", "weekly" o "monthly"');
            }
            
            if (key === 'taxMethod' && !['FIFO', 'LIFO', 'WAC'].includes(value)) {
                throw new Error('El método fiscal debe ser "FIFO", "LIFO" o "WAC"');
            }
            
            if (key === 'compoundingFrequency' && 
                !['hourly', 'daily', 'weekly', 'monthly', 'none'].includes(value)) {
                throw new Error('La frecuencia de composición debe ser "hourly", "daily", "weekly", "monthly" o "none"');
            }
        }
    }
    
    /**
     * Genera un número aleatorio con distribución normal estándar (media 0, desviación 1)
     * Usando el método de Box-Muller
     * @returns {number} Número aleatorio con distribución normal
     * @private
     */
    _generateRandomNormal() {
        let u = 0, v = 0;
        while (u === 0) u = Math.random();
        while (v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
    
    /**
     * Formatea un valor monetario
     * @param {number} value - Valor a formatear
     * @param {string} currency - Moneda (por defecto USD)
     * @returns {string} Valor formateado
     */
    formatCurrency(value, currency = 'USD') {
        try {
            return new Intl.NumberFormat('es-ES', {
                style: 'currency',
                currency: currency,
                minimumFractionDigits: 2,
                maximumFractionDigits: 6
            }).format(value);
        } catch (error) {
            // Fallback simple si hay error con Intl
            return `${currency} ${value.toFixed(2)}`;
        }
    }
    
    /**
     * Formatea un porcentaje
     * @param {number} value - Valor a formatear
     * @returns {string} Porcentaje formateado
     */
    formatPercentage(value) {
        try {
            return new Intl.NumberFormat('es-ES', {
                style: 'percent',
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }).format(value / 100);
        } catch (error) {
            // Fallback simple
            return `${value.toFixed(2)}%`;
        }
    }
    
    /**
     * Exporta los resultados de un cálculo en formato CSV
     * @param {Object} data - Datos a exportar
     * @param {string} calculationType - Tipo de cálculo
     * @returns {string} Contenido CSV
     */
    exportToCSV(data, calculationType) {
        try {
            let csvContent = '';
            
            switch (calculationType) {
                case 'profitLoss':
                    csvContent = 'Concepto,Valor\n';
                    csvContent += `Inversión,${data.investment}\n`;
                    csvContent += `Valor final,${data.returnValue}\n`;
                    csvContent += `Ganancia/Pérdida absoluta,${data.absoluteProfitLoss}\n`;
                    csvContent += `Ganancia/Pérdida porcentual,${data.percentProfitLoss}%\n`;
                    csvContent += `ROI,${data.roi}\n`;
                    break;
                
                case 'dca':
                    // Cabecera
                    csvContent = 'Fecha,Precio,Inversión,Monedas adquiridas,Total monedas,Total invertido\n';
                    
                    // Datos
                    data.entries.forEach(entry => {
                        const row = [
                            entry.date.toISOString().split('T')[0],
                            entry.price,
                            data.investmentAmount,
                            entry.coinsAcquired,
                            entry.runningTotalCoins,
                            entry.runningTotalInvested
                        ];
                        csvContent += row.join(',') + '\n';
                    });
                    break;
                
                case 'taxes':
                    // Cabecera para eventos fiscales
                    csvContent = 'Fecha,Moneda,Cantidad,Ingresos,Coste Base,Ganancia/Pérdida,Término\n';
                    
                    // Datos de eventos fiscales
                    data.taxEvents.forEach(event => {
                        const row = [
                            new Date(event.date).toISOString().split('T')[0],
                            event.coin,
                            event.amount,
                            event.proceeds,
                            event.costBasis,
                            event.gainLoss,
                            event.term
                        ];
                        csvContent += row.join(',') + '\n';
                    });
                    
                    // Resumen
                    csvContent += '\nResumen de impuestos\n';
                    csvContent += `Ganancias a corto plazo,${data.shortTermGains}\n`;
                    csvContent += `Ganancias a largo plazo,${data.longTermGains}\n`;
                    csvContent += `Ganancias totales,${data.totalCapitalGains}\n`;
                    csvContent += `Impuestos a corto plazo,${data.shortTermTax}\n`;
                    csvContent += `Impuestos a largo plazo,${data.longTermTax}\n`;
                    csvContent += `Impuestos totales,${data.totalTaxDue}\n`;
                    break;
                
                case 'stakingYield':
                    // Cabecera
                    csvContent = 'Día,Monto,Depósito\n';
                    
                    // Datos de la línea de tiempo
                    data.timeline.forEach(point => {
                        const row = [
                            point.day,
                            point.amount,
                            point.deposit || 0
                        ];
                        csvContent += row.join(',') + '\n';
                    });
                    
                    // Resumen
                    csvContent += '\nResumen de staking\n';
                    csvContent += `Principal,${data.principal}\n`;
                    csvContent += `APY,${data.apy}%\n`;
                    csvContent += `Días,${data.days}\n`;
                    csvContent += `Total depositado,${data.totalDeposited}\n`;
                    csvContent += `Monto final,${data.finalAmount}\n`;
                    csvContent += `Interés ganado,${data.interestEarned}\n`;
                    csvContent += `Rendimiento efectivo,${data.effectiveYield}%\n`;
                    break;
                
                default:
                    // Formato genérico para otros tipos
                    csvContent = 'Propiedad,Valor\n';
                    for (const [key, value] of Object.entries(data)) {
                        if (typeof value !== 'object') {
                            csvContent += `${key},${value}\n`;
                        }
                    }
            }
            
            return csvContent;
        } catch (error) {
            console.error('Error al exportar a CSV:', error);
            throw new Error(`Error al exportar datos: ${error.message}`);
        }
    }
    
    /**
     * Guarda un cálculo reciente
     * @param {string} type - Tipo de cálculo
     * @param {Object} data - Datos del cálculo
     * @private
     */
    _saveRecentCalculation(type, data) {
        try {
            // Obtener cálculos guardados
            const recentCalculations = StorageManager.get(
                `${this.options.storageNamespace}.recentCalculations`,
                []
            );
            
            // Añadir nuevo cálculo
            recentCalculations.unshift({
                id: this._generateId(),
                type,
                data,
                timestamp: Date.now()
            });
            
            // Limitar a número máximo
            if (recentCalculations.length > this.options.maxSavedCalculations) {
                recentCalculations.pop();
            }
            
            // Guardar
            StorageManager.set(
                `${this.options.storageNamespace}.recentCalculations`,
                recentCalculations
            );
            
            // Notificar cambio
            EventBus.publish('calculator.newCalculation', { type, data });
        } catch (error) {
            console.error('Error al guardar cálculo reciente:', error);
            // Error no crítico, continuamos
        }
    }
    
    /**
     * Carga cálculos recientes
     * @private
     */
    _loadRecentCalculations() {
        this.recentCalculations = StorageManager.get(
            `${this.options.storageNamespace}.recentCalculations`,
            []
        );
    }
    
    /**
     * Obtiene cálculos recientes
     * @param {string} type - Tipo de cálculo (opcional)
     * @returns {Array<Object>} Cálculos recientes
     */
    getRecentCalculations(type = null) {
        // Recargar por si han cambiado
        this._loadRecentCalculations();
        
        // Filtrar por tipo si se especifica
        if (type) {
            return this.recentCalculations.filter(calc => calc.type === type);
        }
        
        return this.recentCalculations;
    }
    
    /**
     * Elimina un cálculo reciente
     * @param {string} id - ID del cálculo a eliminar
     * @returns {boolean} True si se eliminó correctamente
     */
    deleteRecentCalculation(id) {
        try {
            // Obtener cálculos guardados
            const recentCalculations = StorageManager.get(
                `${this.options.storageNamespace}.recentCalculations`,
                []
            );
            
            // Filtrar para eliminar el cálculo especificado
            const filtered = recentCalculations.filter(calc => calc.id !== id);
            
            // Si no cambió la longitud, el ID no existía
            if (filtered.length === recentCalculations.length) {
                return false;
            }
            
            // Guardar lista actualizada
            StorageManager.set(
                `${this.options.storageNamespace}.recentCalculations`,
                filtered
            );
            
            // Actualizar caché local
            this.recentCalculations = filtered;
            
            // Notificar cambio
            EventBus.publish('calculator.calculationDeleted', { id });
            
            return true;
        } catch (error) {
            console.error('Error al eliminar cálculo reciente:', error);
            return false;
        }
    }
    
    /**
     * Genera un ID único
     * @returns {string} ID generado
     * @private
     */
    _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    }
}

// Exportar una instancia predeterminada para uso rápido
export const calculatorService = new CalculatorService();
