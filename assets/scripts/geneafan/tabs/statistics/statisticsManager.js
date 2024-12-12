import * as d3 from 'd3';
import statisticsStore from './statisticsStore.js';

class StatisticsManager {
    constructor() {
        this.charts = {};
        this.margins = { top: 20, right: 20, bottom: 30, left: 40 };
        this.initialized = false;
    }

    initialize() {
        // Attendre que les conteneurs soient disponibles
        requestAnimationFrame(() => {
            // Vérifier que les conteneurs existent
            const containers = [
                '#gender-chart',
                '#age-chart',
                '#lifespan-chart'
            ];

            // Vérifier que tous les conteneurs sont présents
            if (containers.every(id => document.querySelector(id))) {
                this.updateBasicStats();
                this.createDemographyCharts();
                this.createGeographyCharts();
                this.createFamilyCharts();
                this.createNameCharts();
                this.createOccupationCharts();
                
                // Responsive handling
                window.addEventListener('resize', () => this.resize());
                
                this.initialized = true;
            } else {
                console.warn('Some chart containers are not yet available');
            }
        });
    }

    getContainerWidth(container) {
        const node = container.node();
        if (!node) {
            console.warn(`Container not found: ${container}`);
            return 0;
        }
        return node.getBoundingClientRect().width - this.margins.left - this.margins.right;
    }

    updateBasicStats() {
        const stats = statisticsStore.getStatistics();
        
        // Démographie
        d3.select('#total-individuals').text(stats.demography.total);
        d3.select('#avg-lifespan').text(`${stats.demography.lifeExpectancy.average.toFixed(1)} ans`);
        
        // Famille
        d3.select('#total-marriages').text(stats.family.marriages.total);
        d3.select('#avg-children').text(stats.family.children.average.toFixed(1));
    }

    createDemographyCharts() {
        this.createGenderDistributionChart();
        this.createAgeDistributionChart();
        this.createLifeExpectancyChart();
    }

    createGenderDistributionChart() {
        const stats = statisticsStore.getStatistics().demography.gender;
        const container = d3.select('#gender-chart');
        const width = this.getContainerWidth(container);
        const height = width * 0.6;
        const radius = Math.min(width, height) / 2;

        const svg = this.createSvg(container, width, height, true); // true pour centrer

        const data = [
            { name: 'Hommes', value: stats.male },
            { name: 'Femmes', value: stats.female }
        ];

        // Créer le graphique en secteurs
        this.createPieChart(svg, data, radius);

        this.charts.gender = { svg, width, height };
    }

    createAgeDistributionChart() {
        const stats = statisticsStore.getStatistics().demography.ageDistribution;
        const container = d3.select('#age-chart');
        const width = this.getContainerWidth(container);
        const height = width * 0.5;

        const svg = this.createSvg(container, width, height);

        const data = Object.entries(stats).map(([range, value]) => ({
            range,
            value
        }));

        // Créer l'histogramme
        this.createBarChart(svg, data, width, height);

        this.charts.age = { svg, width, height };
    }

    createLifeExpectancyChart() {
        const stats = statisticsStore.getStatistics().demography.lifeExpectancy.byDecade;
        const container = d3.select('#lifespan-chart');
        const width = this.getContainerWidth(container);
        const height = width * 0.5;

        const svg = this.createSvg(container, width, height);

        const data = Object.entries(stats).map(([decade, value]) => ({
            decade: parseInt(decade),
            value
        })).sort((a, b) => a.decade - b.decade);

        // Créer le graphique linéaire
        this.createLineChart(svg, data, width, height, {
            xLabel: 'Décennie',
            yLabel: 'Espérance de vie (années)',
            lineColor: '#36A2EB'
        });

        this.charts.lifespan = { svg, width, height };
    }

    // Méthodes utilitaires pour la création de graphiques
    getContainerWidth(container) {
        return container.node().getBoundingClientRect().width 
               - this.margins.left - this.margins.right;
    }

    createSvg(container, width, height, center = false) {
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

    createPieChart(svg, data, radius) {
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

        // Animer les secteurs
        arcs.append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.name))
            .transition()
            .duration(1000)
            .attrTween('d', function(d) {
                const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
                return function(t) { return arc(i(t)); };
            });

        // Ajouter les pourcentages
        arcs.append('text')
            .attr('transform', d => `translate(${arc.centroid(d)})`)
            .attr('dy', '.35em')
            .style('text-anchor', 'middle')
            .style('fill', 'white')
            .text(d => `${(d.data.value/d3.sum(data, d => d.value)*100).toFixed(1)}%`);

        this.addLegend(svg, data, color, radius);
    }

    createBarChart(svg, data, width, height) {
        const x = d3.scaleBand()
            .range([0, width])
            .padding(0.1)
            .domain(data.map(d => d.range));

        const y = d3.scaleLinear()
            .range([height, 0])
            .domain([0, d3.max(data, d => d.value)]);

        // Axes
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        svg.append('g')
            .call(d3.axisLeft(y));

        // Barres
        svg.selectAll('.bar')
            .data(data)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.range))
            .attr('width', x.bandwidth())
            .attr('y', height)
            .attr('height', 0)
            .attr('fill', '#36A2EB')
            .transition()
            .duration(1000)
            .attr('y', d => y(d.value))
            .attr('height', d => height - y(d.value));
    }

    createLineChart(svg, data, width, height, options) {
        const x = d3.scaleLinear()
            .range([0, width])
            .domain(d3.extent(data, d => d.decade));

        const y = d3.scaleLinear()
            .range([height, 0])
            .domain([0, d3.max(data, d => d.value)]);

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
            .attr('d', line)
            .attr('stroke-dasharray', function() {
                return `${this.getTotalLength()} ${this.getTotalLength()}`;
            })
            .attr('stroke-dashoffset', function() {
                return this.getTotalLength();
            })
            .transition()
            .duration(2000)
            .attr('stroke-dashoffset', 0);

        // Labels des axes si fournis
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

    addLegend(svg, data, color, radius) {
        const legend = svg.append('g')
            .attr('font-family', 'sans-serif')
            .attr('font-size', 10)
            .attr('text-anchor', 'start')
            .selectAll('g')
            .data(data)
            .enter().append('g')
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

    resize() {
        Object.entries(this.charts).forEach(([key, chart]) => {
            const container = d3.select(`#${key}-chart`);
            const width = this.getContainerWidth(container);
            const height = width * (key === 'gender' ? 0.6 : 0.5);

            container.select('svg')
                .attr('width', width + this.margins.left + this.margins.right)
                .attr('height', height + this.margins.top + this.margins.bottom);

            // Recréer le graphique avec les nouvelles dimensions
            container.selectAll('*').remove();
            this[`create${key.charAt(0).toUpperCase() + key.slice(1)}Chart`]();
        });
    }

    destroy() {
        if (this.initialized) {
            Object.keys(this.charts).forEach(key => {
                d3.select(`#${key}-chart`).selectAll('*').remove();
            });
            this.charts = {};
            window.removeEventListener('resize', this.resize);
            this.initialized = false;
        }
    }
}

export const statisticsManager = new StatisticsManager();