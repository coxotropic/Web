/**
 * heatmap-controller.js
 * Controller for the cryptocurrency market heatmap visualization
 * Uses D3.js for rendering a treemap visualization of the market
 */

import { MarketDataService } from '../market/market-data-service.js';
import { EventBus } from '../utils/event-bus.js';
import { StorageManager } from '../utils/storage-manager.js';

export class HeatmapController {
    /**
     * Create a new heatmap controller
     * @param {Object} options - Configuration options
     * @param {string} options.containerId - ID of the container element
     * @param {string} options.timeframe - Initial timeframe (1h, 24h, 7d, 30d)
     * @param {string} options.category - Initial category filter (all, defi, layer1, etc.)
     * @param {string} options.colorScheme - Color scheme for the heatmap
     * @param {boolean} options.showLabels - Whether to show labels on the heatmap
     * @param {number} options.maxItems - Maximum number of items to display
     */
    constructor(options = {}) {
        // Default options
        this.options = {
            containerId: 'heatmap-container',
            timeframe: '24h',
            category: 'all',
            colorScheme: 'default',
            showLabels: true,
            maxItems: 100,
            ...options
        };

        // State variables
        this.state = {
            data: null,
            filteredData: null,
            isLoading: false,
            error: null,
            timeframe: this.options.timeframe,
            category: this.options.category,
            colorScheme: this.options.colorScheme,
            showLabels: this.options.showLabels,
            zoomLevel: 1,
            focusedSector: null
        };

        // Reference to services
        this.marketDataService = new MarketDataService();

        // D3.js visualization elements
        this.svg = null;
        this.treemap = null;
        this.colorScale = null;
        this.tooltip = null;
        
        // Bind methods
        this.init = this.init.bind(this);
        this.loadData = this.loadData.bind(this);
        this.renderHeatmap = this.renderHeatmap.bind(this);
        this.updateHeatmap = this.updateHeatmap.bind(this);
        this.filterByCategory = this.filterByCategory.bind(this);
        this.changeTimeframe = this.changeTimeframe.bind(this);
        this.onItemClick = this.onItemClick.bind(this);
        this.onItemHover = this.onItemHover.bind(this);
        this.exportAsImage = this.exportAsImage.bind(this);
        this.handleResize = this.handleResize.bind(this);
        this.setupEventListeners = this.setupEventListeners.bind(this);
        this.destroy = this.destroy.bind(this);
    }

    /**
     * Initialize the heatmap controller
     * @returns {Promise<void>}
     */
    async init() {
        try {
            // Get container element
            this.container = document.getElementById(this.options.containerId);
            if (!this.container) {
                throw new Error(`Container element with ID "${this.options.containerId}" not found`);
            }

            // Set loading state
            this.setState({ isLoading: true });
            this.renderLoadingState();

            // Initialize D3.js elements
            this.initializeD3Components();

            // Load user preferences if available
            this.loadUserPreferences();

            // Load initial data
            await this.loadData();

            // Setup event listeners
            this.setupEventListeners();

            // Render the initial heatmap
            this.renderHeatmap();

            // Set loading state to false
            this.setState({ isLoading: false });
            
            console.log('Heatmap controller initialized successfully');
        } catch (error) {
            console.error('Failed to initialize heatmap controller:', error);
            this.setState({ 
                isLoading: false, 
                error: error.message || 'Failed to initialize heatmap' 
            });
            this.renderErrorState();
        }
    }

    /**
     * Initialize D3.js components
     * @private
     */
    initializeD3Components() {
        // Calculate container dimensions
        const containerRect = this.container.getBoundingClientRect();
        const width = containerRect.width;
        const height = Math.max(500, containerRect.height); // Minimum height of 500px
        
        // Create SVG element
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .attr('class', 'heatmap-svg')
            .append('g');
            
        // Create tooltip
        this.tooltip = d3.select(this.container)
            .append('div')
            .attr('class', 'heatmap-tooltip')
            .style('position', 'absolute')
            .style('visibility', 'hidden')
            .style('background-color', 'rgba(0, 0, 0, 0.8)')
            .style('color', 'white')
            .style('padding', '8px')
            .style('border-radius', '4px')
            .style('pointer-events', 'none')
            .style('z-index', '1000');
            
        // Initialize treemap layout
        this.treemap = d3.treemap()
            .size([width, height])
            .paddingOuter(4)
            .paddingInner(1)
            .round(true);
            
        // Initialize color scales
        this.initializeColorScales();
    }
    
    /**
     * Initialize color scales for different schemes
     * @private
     */
    initializeColorScales() {
        // Create color scales for different schemes
        this.colorScales = {
            default: d3.scaleLinear()
                .domain([-10, 0, 10])
                .range(['#e15759', '#f28e2b', '#4e79a7'])
                .interpolate(d3.interpolateRgb),
                
            redGreen: d3.scaleLinear()
                .domain([-10, 0, 10])
                .range(['#e15759', '#f5f5f5', '#4e79a7'])
                .interpolate(d3.interpolateRgb),
                
            monochrome: d3.scaleLinear()
                .domain([-10, 0, 10])
                .range(['#d9d9d9', '#f5f5f5', '#4e79a7'])
                .interpolate(d3.interpolateRgb),
                
            rainbow: d3.scaleSequential()
                .domain([-10, 10])
                .interpolator(d3.interpolateRainbow)
        };
        
        // Set active color scale
        this.colorScale = this.colorScales[this.state.colorScheme];
    }
    
    /**
     * Load market data using the market data service
     * @returns {Promise<void>}
     * @private
     */
    async loadData() {
        try {
            this.setState({ isLoading: true });
            
            // Get data from market data service
            const marketData = await this.marketDataService.getMarketOverview({
                limit: this.options.maxItems,
                timeframe: this.state.timeframe
            });
            
            // Prepare data for treemap visualization
            const hierarchyData = this.prepareHierarchyData(marketData);
            
            // Update state
            this.setState({ 
                data: hierarchyData,
                filteredData: this.filterData(hierarchyData, this.state.category),
                isLoading: false,
                error: null
            });
            
            // Notify that data is loaded
            EventBus.publish('heatmap.dataLoaded', { 
                timeframe: this.state.timeframe,
                category: this.state.category,
                itemCount: marketData.length
            });
            
            return hierarchyData;
        } catch (error) {
            console.error('Failed to load market data:', error);
            this.setState({ 
                isLoading: false, 
                error: error.message || 'Failed to load market data' 
            });
            this.renderErrorState();
            throw error;
        }
    }
    
    /**
     * Prepare data for hierarchical treemap visualization
     * @param {Array} marketData - Raw market data from API
     * @returns {Object} Hierarchy data ready for D3.js treemap
     * @private
     */
    prepareHierarchyData(marketData) {
        // Group cryptocurrencies by their sector/category
        const sectorGroups = {};
        
        marketData.forEach(item => {
            const sector = item.sector || 'Other';
            
            if (!sectorGroups[sector]) {
                sectorGroups[sector] = {
                    name: sector,
                    children: []
                };
            }
            
            // Calculate change percentage based on timeframe
            const changeKey = `percent_change_${this.state.timeframe}`;
            const percentChange = item[changeKey] || 0;
            
            sectorGroups[sector].children.push({
                name: item.name,
                symbol: item.symbol,
                value: Math.max(1000, item.market_cap || 0), // Minimum size for visibility
                percentChange: percentChange,
                price: item.price,
                volume24h: item.volume_24h,
                marketCap: item.market_cap,
                sector: sector,
                id: item.id
            });
        });
        
        // Convert to array structure needed by D3.js
        const hierarchyData = {
            name: 'Crypto Market',
            children: Object.values(sectorGroups)
        };
        
        return hierarchyData;
    }
    
    /**
     * Filter data by category/sector
     * @param {Object} data - Hierarchy data
     * @param {string} category - Category to filter by
     * @returns {Object} Filtered hierarchy data
     * @private
     */
    filterData(data, category) {
        if (!data || category === 'all') {
            return data;
        }
        
        // Deep clone the data to avoid modifying the original
        const clonedData = JSON.parse(JSON.stringify(data));
        
        // Filter children by category
        if (category === 'gainers') {
            // Filter only cryptocurrencies with positive change
            clonedData.children.forEach(sector => {
                sector.children = sector.children.filter(item => item.percentChange > 0);
            });
        } else if (category === 'losers') {
            // Filter only cryptocurrencies with negative change
            clonedData.children.forEach(sector => {
                sector.children = sector.children.filter(item => item.percentChange < 0);
            });
        } else {
            // Filter by sector
            clonedData.children = clonedData.children
                .filter(sector => sector.name.toLowerCase() === category.toLowerCase());
        }
        
        // Remove empty sectors
        clonedData.children = clonedData.children.filter(sector => sector.children.length > 0);
        
        return clonedData;
    }
    
    /**
     * Render the heatmap visualization
     * @private
     */
    renderHeatmap() {
        if (!this.state.filteredData || this.state.isLoading) {
            return;
        }
        
        try {
            // Clear previous content
            this.svg.selectAll('*').remove();
            
            // Recalculate dimensions in case of resize
            const containerRect = this.container.getBoundingClientRect();
            const width = containerRect.width;
            const height = Math.max(500, containerRect.height);
            
            // Update SVG and treemap dimensions
            d3.select(this.container).select('svg')
                .attr('width', width)
                .attr('height', height);
                
            this.treemap.size([width, height]);
            
            // Create hierarchy from data
            const root = d3.hierarchy(this.state.filteredData)
                .sum(d => d.value)
                .sort((a, b) => b.value - a.value);
                
            // Apply the treemap layout
            this.treemap(root);
            
            // Create colored rectangles for each crypto
            const nodes = this.svg.selectAll('g')
                .data(root.leaves())
                .enter()
                .append('g')
                .attr('transform', d => `translate(${d.x0},${d.y0})`)
                .attr('class', 'heatmap-node')
                .on('mouseover', this.onItemHover)
                .on('mouseout', () => {
                    this.tooltip.style('visibility', 'hidden');
                })
                .on('click', this.onItemClick);
                
            // Add rectangles
            nodes.append('rect')
                .attr('width', d => Math.max(0, d.x1 - d.x0))
                .attr('height', d => Math.max(0, d.y1 - d.y0))
                .attr('fill', d => this.getColor(d.data.percentChange))
                .attr('stroke', '#fff')
                .attr('stroke-width', 1);
                
            // Add text labels if enabled
            if (this.state.showLabels) {
                nodes.append('text')
                    .attr('x', 4)
                    .attr('y', 14)
                    .attr('class', 'heatmap-label-symbol')
                    .text(d => d.data.symbol)
                    .attr('font-size', '12px')
                    .attr('font-weight', 'bold')
                    .attr('fill', d => this.getLabelColor(d.data.percentChange));
                    
                nodes.append('text')
                    .attr('x', 4)
                    .attr('y', 28)
                    .attr('class', 'heatmap-label-percent')
                    .text(d => `${d.data.percentChange > 0 ? '+' : ''}${d.data.percentChange.toFixed(1)}%`)
                    .attr('font-size', '10px')
                    .attr('fill', d => this.getLabelColor(d.data.percentChange));
            }
            
            // Notify that rendering is complete
            EventBus.publish('heatmap.rendered', {
                itemCount: root.leaves().length,
                timeframe: this.state.timeframe,
                category: this.state.category
            });
        } catch (error) {
            console.error('Failed to render heatmap:', error);
            this.renderErrorState();
        }
    }
    
    /**
     * Get color for a percentage change value
     * @param {number} percentChange - Percentage change value
     * @returns {string} Color code
     * @private
     */
    getColor(percentChange) {
        return this.colorScale(percentChange);
    }
    
    /**
     * Get contrasting text color for readability
     * @param {number} percentChange - Percentage change value
     * @returns {string} Text color (black or white)
     * @private
     */
    getLabelColor(percentChange) {
        // For dark backgrounds use white text, for light backgrounds use black text
        if (percentChange < -5) return '#ffffff';
        if (percentChange > 5) return '#ffffff';
        return '#000000';
    }
    
    /**
     * Handler for item hover events
     * @param {Event} event - Mouse event
     * @param {Object} d - D3.js data object
     * @private
     */
    onItemHover(event, d) {
        const data = d.data;
        
        // Format price and market cap for display
        const formattedPrice = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: data.price < 1 ? 6 : 2,
            maximumFractionDigits: data.price < 1 ? 6 : 2
        }).format(data.price);
        
        const formattedMarketCap = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            notation: 'compact',
            compactDisplay: 'short'
        }).format(data.marketCap);
        
        const formattedVolume = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            notation: 'compact',
            compactDisplay: 'short'
        }).format(data.volume24h);
        
        // Build tooltip content
        const tooltipContent = `
            <div class="tooltip-title">${data.name} (${data.symbol})</div>
            <div class="tooltip-price">Price: ${formattedPrice}</div>
            <div class="tooltip-change ${data.percentChange >= 0 ? 'positive' : 'negative'}">
                ${data.percentChange >= 0 ? '▲' : '▼'} ${data.percentChange.toFixed(2)}% (${this.state.timeframe})
            </div>
            <div class="tooltip-market-cap">Market Cap: ${formattedMarketCap}</div>
            <div class="tooltip-volume">Volume 24h: ${formattedVolume}</div>
            <div class="tooltip-sector">Sector: ${data.sector}</div>
        `;
        
        // Position and show tooltip
        this.tooltip
            .html(tooltipContent)
            .style('visibility', 'visible')
            .style('left', `${event.pageX + 10}px`)
            .style('top', `${event.pageY + 10}px`);
    }
    
    /**
     * Handler for item click events
     * @param {Event} event - Mouse event
     * @param {Object} d - D3.js data object
     * @private
     */
    onItemClick(event, d) {
        const data = d.data;
        
        // Publish event that coin was clicked
        EventBus.publish('heatmap.itemClicked', {
            id: data.id,
            symbol: data.symbol,
            name: data.name,
            sector: data.sector
        });
        
        // If we want to navigate to coin detail page
        // window.location.href = `/crypto/${data.id}`;
    }
    
    /**
     * Update state and trigger re-render if needed
     * @param {Object} newState - New state to merge with current state
     * @private
     */
    setState(newState) {
        const prevState = { ...this.state };
        this.state = { ...this.state, ...newState };
        
        // Save user preferences if relevant settings changed
        if (prevState.timeframe !== this.state.timeframe ||
            prevState.category !== this.state.category ||
            prevState.colorScheme !== this.state.colorScheme ||
            prevState.showLabels !== this.state.showLabels) {
            this.saveUserPreferences();
        }
    }
    
    /**
     * Change the timeframe and reload data
     * @param {string} timeframe - New timeframe (1h, 24h, 7d, 30d)
     * @returns {Promise<void>}
     */
    async changeTimeframe(timeframe) {
        if (this.state.timeframe === timeframe) return;
        
        this.setState({ timeframe });
        await this.loadData();
        this.renderHeatmap();
    }
    
    /**
     * Filter the heatmap by category
     * @param {string} category - Category to filter by (all, defi, layer1, etc.)
     */
    filterByCategory(category) {
        if (this.state.category === category) return;
        
        const filteredData = this.filterData(this.state.data, category);
        this.setState({ 
            category, 
            filteredData
        });
        
        this.renderHeatmap();
    }
    
    /**
     * Update the heatmap (used for periodic updates)
     * @returns {Promise<void>}
     */
    async updateHeatmap() {
        await this.loadData();
        this.renderHeatmap();
    }
    
    /**
     * Change color scheme
     * @param {string} colorScheme - New color scheme
     */
    changeColorScheme(colorScheme) {
        if (this.state.colorScheme === colorScheme) return;
        
        this.setState({ colorScheme });
        this.colorScale = this.colorScales[colorScheme];
        this.renderHeatmap();
    }
    
    /**
     * Toggle label visibility
     * @param {boolean} showLabels - Whether to show labels
     */
    toggleLabels(showLabels) {
        if (this.state.showLabels === showLabels) return;
        
        this.setState({ showLabels });
        this.renderHeatmap();
    }
    
    /**
     * Focus on a specific sector
     * @param {string} sector - Sector to focus on
     */
    focusOnSector(sector) {
        this.setState({ focusedSector: sector });
        this.filterByCategory(sector);
    }
    
    /**
     * Reset zoom and focus
     */
    resetView() {
        this.setState({ 
            zoomLevel: 1,
            focusedSector: null,
            category: 'all'
        });
        
        const filteredData = this.filterData(this.state.data, 'all');
        this.setState({ filteredData });
        this.renderHeatmap();
    }
    
    /**
     * Export heatmap as image
     * @returns {Promise<string>} Data URL of the image
     */
    async exportAsImage() {
        try {
            // Create a temporary SVG element with proper dimensions
            const svgElement = this.container.querySelector('svg');
            const svgData = new XMLSerializer().serializeToString(svgElement);
            
            // Create a canvas element
            const canvas = document.createElement('canvas');
            const containerRect = this.container.getBoundingClientRect();
            canvas.width = containerRect.width * 2; // Higher resolution
            canvas.height = containerRect.height * 2;
            
            // Create image from SVG
            const image = new Image();
            image.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
            
            return new Promise((resolve, reject) => {
                image.onload = () => {
                    const context = canvas.getContext('2d');
                    context.fillStyle = '#ffffff';
                    context.fillRect(0, 0, canvas.width, canvas.height);
                    context.drawImage(image, 0, 0, canvas.width, canvas.height);
                    
                    // Add title and timestamp
                    context.font = '24px Arial';
                    context.fillStyle = '#000000';
                    context.fillText(`Crypto Market Heatmap - ${this.state.timeframe.toUpperCase()}`, 20, 30);
                    
                    context.font = '16px Arial';
                    const timestamp = new Date().toLocaleString();
                    context.fillText(`Generated: ${timestamp}`, 20, 60);
                    
                    // Get data URL
                    const dataUrl = canvas.toDataURL('image/png');
                    resolve(dataUrl);
                };
                
                image.onerror = () => {
                    reject(new Error('Failed to generate image'));
                };
            });
        } catch (error) {
            console.error('Failed to export heatmap as image:', error);
            throw error;
        }
    }
    
    /**
     * Render loading state
     * @private
     */
    renderLoadingState() {
        this.container.innerHTML = `
            <div class="heatmap-loading">
                <div class="spinner"></div>
                <div class="loading-text">Loading market data...</div>
            </div>
        `;
    }
    
    /**
     * Render error state
     * @private
     */
    renderErrorState() {
        this.container.innerHTML = `
            <div class="heatmap-error">
                <div class="error-icon">⚠️</div>
                <div class="error-text">
                    Failed to load market data. ${this.state.error}
                </div>
                <button class="btn btn-retry">Retry</button>
            </div>
        `;
        
        // Add retry button event listener
        const retryButton = this.container.querySelector('.btn-retry');
        if (retryButton) {
            retryButton.addEventListener('click', async () => {
                this.renderLoadingState();
                await this.loadData();
                this.renderHeatmap();
            });
        }
    }
    
    /**
     * Handle window resize events
     * @private
     */
    handleResize() {
        // Debounce resize events to avoid too many renders
        clearTimeout(this.resizeTimeout);
        this.resizeTimeout = setTimeout(() => {
            this.renderHeatmap();
        }, 250);
    }
    
    /**
     * Save user preferences to storage
     * @private
     */
    saveUserPreferences() {
        const preferences = {
            timeframe: this.state.timeframe,
            category: this.state.category,
            colorScheme: this.state.colorScheme,
            showLabels: this.state.showLabels
        };
        
        StorageManager.set('heatmap.preferences', preferences);
    }
    
    /**
     * Load user preferences from storage
     * @private
     */
    loadUserPreferences() {
        const preferences = StorageManager.get('heatmap.preferences');
        if (preferences) {
            this.setState({
                timeframe: preferences.timeframe || this.state.timeframe,
                category: preferences.category || this.state.category,
                colorScheme: preferences.colorScheme || this.state.colorScheme,
                showLabels: preferences.showLabels !== undefined ? preferences.showLabels : this.state.showLabels
            });
            
            // Update color scale if needed
            if (preferences.colorScheme) {
                this.colorScale = this.colorScales[preferences.colorScheme];
            }
        }
    }
    
    /**
     * Setup event listeners
     * @private
     */
    setupEventListeners() {
        // Window resize event
        window.addEventListener('resize', this.handleResize);
        
        // Listen for market data updates
        EventBus.subscribe('market.dataUpdated', () => {
            this.updateHeatmap();
        });
        
        // Cleanup existing listeners when reinitializing
        const timeframeButtons = document.querySelectorAll('[data-timeframe]');
        timeframeButtons.forEach(button => {
            button.removeEventListener('click', this._timeframeHandler);
        });
        
        const categoryButtons = document.querySelectorAll('[data-category]');
        categoryButtons.forEach(button => {
            button.removeEventListener('click', this._categoryHandler);
        });
        
        // Add event listeners for timeframe buttons
        timeframeButtons.forEach(button => {
            this._timeframeHandler = () => {
                const timeframe = button.dataset.timeframe;
                this.changeTimeframe(timeframe);
                
                // Update active state
                timeframeButtons.forEach(b => b.classList.remove('active'));
                button.classList.add('active');
            };
            
            button.addEventListener('click', this._timeframeHandler);
        });
        
        // Add event listeners for category filter buttons
        categoryButtons.forEach(button => {
            this._categoryHandler = () => {
                const category = button.dataset.category;
                this.filterByCategory(category);
                
                // Update active state
                categoryButtons.forEach(b => b.classList.remove('active'));
                button.classList.add('active');
            };
            
            button.addEventListener('click', this._categoryHandler);
        });
        
        // Export button
        const exportButton = document.getElementById('export-heatmap-button');
        if (exportButton) {
            exportButton.addEventListener('click', async () => {
                try {
                    const imageUrl = await this.exportAsImage();
                    
                    // Create a download link
                    const downloadLink = document.createElement('a');
                    downloadLink.href = imageUrl;
                    downloadLink.download = `crypto-heatmap-${this.state.timeframe}-${new Date().toISOString().slice(0, 10)}.png`;
                    document.body.appendChild(downloadLink);
                    downloadLink.click();
                    document.body.removeChild(downloadLink);
                } catch (error) {
                    console.error('Failed to export heatmap:', error);
                    alert('Failed to export heatmap. Please try again.');
                }
            });
        }
        
        // Color scheme selector
        const colorSchemeSelect = document.getElementById('color-scheme-select');
        if (colorSchemeSelect) {
            colorSchemeSelect.addEventListener('change', () => {
                this.changeColorScheme(colorSchemeSelect.value);
            });
        }
        
        // Label toggle
        const labelToggle = document.getElementById('show-labels-toggle');
        if (labelToggle) {
            labelToggle.addEventListener('change', () => {
                this.toggleLabels(labelToggle.checked);
            });
        }
    }
    
    /**
     * Clean up resources when the controller is no longer needed
     */
    destroy() {
        // Remove event listeners
        window.removeEventListener('resize', this.handleResize);
        
        // Unsubscribe from event bus
        // (assumes EventBus has a method to get all subscriptions)
        if (EventBus.getSubscriptions) {
            const subscriptions = EventBus.getSubscriptions();
            
            Object.keys(subscriptions).forEach(event => {
                if (event.startsWith('market.') || event.startsWith('heatmap.')) {
                    EventBus.unsubscribe(event);
                }
            });
        }
        
        // Clear container
        this.container.innerHTML = '';
        
        console.log('Heatmap controller destroyed successfully');
    }
}

// Export a factory function for easier instantiation
export const createHeatmapController = (options) => {
    return new HeatmapController(options);
};
