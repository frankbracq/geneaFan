import * as d3 from 'd3';
import statisticsStore from './statisticsStore.js';

class StatisticsManager {
    constructor() {
        this.charts = {};
        this.margins = { top: 20, right: 20, bottom: 30, left: 40 };
        this.initialized = false;
        this.minHeight = 1;
        this.minChartWidth = 300;
        this.minChartHeight = 200;

        // Bind methods
        this.initialize = this.initialize.bind(this);
        this.updateCharts = this.updateCharts.bind(this);
        this.resize = this.resize.bind(this);

        // Subscribe to statistics updates
        statisticsStore.subscribeToUpdates(this.updateCharts);
    }

    initialize() {
        // Attendre que la page soit complètement chargée
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', this.initialize);
            return;
        }

        const containers = [
            '#gender-chart',
            '#age-chart',
            '#lifespan-chart'
        ];

        // Vérifier que tous les conteneurs sont présents
        if (!containers.every(id => document.querySelector(id))) {
            console.warn('Some chart containers are not yet available');
            // Réessayer plus tard
            setTimeout(this.initialize, 100);
            return;
        }

        try {
            // Nettoyer les conteneurs existants
            containers.forEach(id => {
                const container = d3.select(id);
                container.selectAll('*').remove();
                container
                    .style('min-height', `${this.minChartHeight}px`)
                    .style('min-width', `${this.minChartWidth}px`);
            });

            // Mettre à jour les statistiques de base
            this.updateBasicStats();

            // S'assurer que les données sont disponibles
            const stats = statisticsStore.getStatistics();
            if (!stats || !stats.demography) {
                console.warn('Statistics not yet available');
                setTimeout(this.initialize, 100);
                return;
            }

            // Créer les graphiques
            this.createDemographyCharts();

            // Gestionnaire de redimensionnement
            if (!this.initialized) {
                window.addEventListener('resize', this.resize);
            }

            this.initialized = true;
            console.log('Statistics manager initialized successfully');
        } catch (error) {
            console.error('Error initializing statistics manager:', error);
        }
    }

    updateBasicStats(stats = null) {
        stats = stats || statisticsStore.getStatistics();
        if (!stats?.demography) return;

        const format = (value, decimals = 1) => {
            if (value === undefined || isNaN(value)) return '0.0';
            return parseFloat(value).toFixed(decimals);
        };

        // Calcul correct de la moyenne d'espérance de vie
        const avgLifeExpectancy = stats.demography.lifeExpectancy.average || 
            this.calculateAverageLifeExpectancy(stats.demography.lifeExpectancy.byDecade);

        d3.select('#total-individuals').text(stats.demography.total || 0);
        d3.select('#total-marriages').text(stats.family?.marriages?.total || 0);
        d3.select('#avg-children').text(format(stats.family?.children?.average, 1));
        d3.select('#avg-lifespan').text(`${format(avgLifeExpectancy, 1)} ans`);
    }

    updateCharts(newStats) {
        console.log('Updating charts with new statistics');
        
        if (!newStats || !this.initialized) return;

        try {
            // Nettoyer les conteneurs existants
            this.cleanupContainers();
            
            // Mettre à jour les statistiques de base
            this.updateBasicStats(newStats);

            // Recréer les graphiques avec les nouvelles données
            this.createDemographyCharts();
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }

    createDemographyCharts() {
        this.createGenderDistributionChart();
        this.createAgeDistributionChart();
        this.createLifeExpectancyChart();
    }

    createGenderDistributionChart() {
        const stats = statisticsStore.getStatistics()?.demography?.gender;
        if (!stats) {
            console.warn('No gender statistics available');
            return;
        }

        const container = d3.select('#gender-chart');
        const width = this.getContainerWidth(container);
        const height = this.getContainerHeight(width, true);
        const radius = Math.min(width, height) / 2;

        const svg = this.createSvg(container, width, height, true);

        const data = [
            { name: 'Hommes', value: stats.male || 0 },
            { name: 'Femmes', value: stats.female || 0 }
        ].filter(d => d.value > 0);

        if (data.length > 0) {
            this.createPieChart(svg, data, radius);
            this.charts.gender = { svg, width, height };
        }
    }


    createAgeDistributionChart() {
        const stats = statisticsStore.getStatistics()?.demography?.ageDistribution;
        if (!stats) {
            console.warn('No age distribution statistics available');
            return;
        }

        const container = d3.select('#age-chart');
        const width = this.getContainerWidth(container);
        const height = this.getContainerHeight(width);

        const svg = this.createSvg(container, width, height);

        const data = Object.entries(stats)
            .map(([range, value]) => ({ range, value }))
            .filter(d => d.value > 0);

        if (data.length > 0) {
            this.createBarChart(svg, data, width, height, {
                xLabel: 'Âge',
                yLabel: 'Nombre d\'individus'
            });
            this.charts.age = { svg, width, height };
        }
    }

    createLifeExpectancyChart() {
        const stats = statisticsStore.getStatistics()?.demography?.lifeExpectancy?.byDecade;
        if (!stats) {
            console.warn('No life expectancy statistics available');
            return;
        }

        const container = d3.select('#lifespan-chart');
        const width = this.getContainerWidth(container);
        const height = this.getContainerHeight(width);

        const svg = this.createSvg(container, width, height);

        const data = Object.entries(stats)
            .map(([decade, value]) => ({
                decade: parseInt(decade),
                value: value || 0
            }))
            .filter(d => !isNaN(d.decade) && d.value > 0)
            .sort((a, b) => a.decade - b.decade);

        if (data.length > 0) {
            this.createLineChart(svg, data, width, height, {
                xLabel: 'Décennie',
                yLabel: 'Espérance de vie (années)',
                lineColor: '#36A2EB'
            });

            this.charts.lifespan = { svg, width, height };
        }
    }

    calculateAverageLifeExpectancy(byDecade) {
        if (!byDecade) return 0;
        const values = Object.values(byDecade);
        if (values.length === 0) return 0;
        
        const validValues = values.filter(v => !isNaN(v));
        if (validValues.length === 0) return 0;
        
        return validValues.reduce((sum, val) => sum + val, 0) / validValues.length;
    }

    createLineChart(svg, data, width, height, options) {
        if (!data || data.length === 0) return;

        const x = d3.scaleLinear()
            .range([0, width])
            .domain(d3.extent(data, d => d.decade));

        const y = d3.scaleLinear()
            .range([height, 0])
            .domain([0, d3.max(data, d => d.value) * 1.1]);

        // Axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x).tickFormat(d => d));

        svg.append('g')
            .call(d3.axisLeft(y));

        // Ligne
        const line = d3.line()
            .x(d => x(d.decade))
            .y(d => y(d.value));

        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', options.lineColor)
            .attr('stroke-width', 2)
            .attr('d', line);

        if (options.xLabel) {
            svg.append('text')
                .attr('transform', `translate(${width/2},${height + 25})`)
                .style('text-anchor', 'middle')
                .text(options.xLabel);
        }

        if (options.yLabel) {
            svg.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', -40)
                .attr('x', -height/2)
                .style('text-anchor', 'middle')
                .text(options.yLabel);
        }
    }

    createBarChart(svg, data, width, height, options = {}) {
        if (!data || data.length === 0) return;

        const x = d3.scaleBand()
            .range([0, width])
            .padding(0.1)
            .domain(data.map(d => d.range));

        const y = d3.scaleLinear()
            .range([height, 0])
            .domain([0, d3.max(data, d => d.value) * 1.1]);

        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        svg.append('g')
            .call(d3.axisLeft(y));

        svg.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.range))
            .attr('width', x.bandwidth())
            .attr('y', d => y(d.value))
            .attr('height', d => Math.max(this.minHeight, height - y(d.value)))
            .attr('fill', '#36A2EB');

        if (options.xLabel) {
            svg.append('text')
                .attr('transform', `translate(${width/2},${height + 25})`)
                .style('text-anchor', 'middle')
                .text(options.xLabel);
        }

        if (options.yLabel) {
            svg.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', -40)
                .attr('x', -height/2)
                .style('text-anchor', 'middle')
                .text(options.yLabel);
        }
    }

    createPieChart(svg, data, radius) {
        if (!data || data.length === 0) {
            console.warn('No valid data for pie chart');
            return;
        }

        const color = d3.scaleOrdinal()
            .domain(data.map(d => d.name))
            .range(['#36A2EB', '#FF6384']);

        const pie = d3.pie()
            .value(d => d.value);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius * 0.8);

        const arcs = svg.selectAll('arc')
            .data(pie(data))
            .enter()
            .append('g');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.name));

        const total = d3.sum(data, d => d.value);
        arcs.append('text')
            .attr('transform', d => `translate(${arc.centroid(d)})`)
            .attr('dy', '.35em')
            .style('text-anchor', 'middle')
            .style('fill', 'white')
            .text(d => `${((d.data.value/total)*100).toFixed(1)}%`);

        this.addLegend(svg, data, color, radius);
    }

    addLegend(svg, data, color, radius) {
        const legend = svg.append('g')
            .attr('font-family', 'sans-serif')
            .attr('font-size', 10)
            .attr('text-anchor', 'start')
            .selectAll('g')
            .data(data)
            .enter()
            .append('g')
            .attr('transform', (d, i) => 
                `translate(${radius + 10},${i * 20 - radius + 20})`);

        legend.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', d => color(d.name));

        legend.append('text')
            .attr('x', 20)
            .attr('y', 9.5)
            .attr('dy', '0.32em')
            .text(d => d.name);
    }

    getContainerWidth(container) {
            const node = container.node();
            if (!node) {
                console.warn('Container not found:', container);
                return this.minChartWidth;
            }
            const width = node.getBoundingClientRect().width;
            // Utiliser la largeur du conteneur ou la largeur minimale
            return Math.max(this.minChartWidth, width - this.margins.left - this.margins.right);
        }

        getContainerHeight(width, isGenderChart = false) {
            // Calculer la hauteur en fonction de la largeur, avec une hauteur minimale
            const calculatedHeight = width * (isGenderChart ? 0.6 : 0.5);
            return Math.max(this.minChartHeight, calculatedHeight);
        }    

    cleanupContainers() {
        ['gender-chart', 'age-chart', 'lifespan-chart'].forEach(id => {
            const container = d3.select(`#${id}`);
            container.selectAll('*').remove();
            container
                .style('min-height', `${this.minChartHeight}px`)
                .style('min-width', `${this.minChartWidth}px`);
        });
    }
    
    createSvg(container, width, height, center = false) {
        // Nettoyer le conteneur d'abord
        container.selectAll('svg').remove();
        
        // S'assurer que le conteneur a une taille minimale
        container
            .style('min-height', `${this.minChartHeight}px`)
            .style('min-width', `${this.minChartWidth}px`);

        const svg = container.append('svg')
            .attr('width', width + this.margins.left + this.margins.right)
            .attr('height', height + this.margins.top + this.margins.bottom)
            .append('g');

        if (center) {
            svg.attr('transform', `translate(${width/2},${height/2})`);
        } else {
            svg.attr('transform', `translate(${this.margins.left},${this.margins.top})`);
        }

        return svg;
    }


    resize() {
        if (!this.initialized) return;
        
        this.cleanupContainers(); // Nettoyer avant le redimensionnement
        
        Object.entries(this.charts).forEach(([key, chart]) => {
            const container = d3.select(`#${key}-chart`);
            const width = this.getContainerWidth(container);
            const height = width * (key === 'gender' ? 0.6 : 0.5);

            this[`create${key.charAt(0).toUpperCase() + key.slice(1)}Chart`]();
        });
    }

    destroy() {
        if (this.initialized) {
            Object.keys(this.charts).forEach(key => {
                d3.select(`#${key}-chart`).selectAll('*').remove();
            });
            this.charts = {};
            window.removeEventListener('resize', () => this.resize());
            this.initialized = false;
        }
    }
}

export const statisticsManager = new StatisticsManager();