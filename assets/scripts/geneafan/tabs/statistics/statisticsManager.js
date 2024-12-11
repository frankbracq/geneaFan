import * as d3 from 'd3';
import statisticsStore from './statisticsStore.js';

class StatisticsManager {
    constructor() {
        this.charts = {};
        this.margins = { top: 20, right: 20, bottom: 30, left: 40 };
    }

    initialize() {
        this.updateBasicStats();
        this.createGenderChart();
        this.createAgeChart();
        this.createBirthChart();
        
        // Responsive handling
        window.addEventListener('resize', () => {
            this.resize();
        });
    }

    updateBasicStats() {
        const stats = statisticsStore.getStatistics();
        const avgLifespan = statisticsStore.getAverageLifespan();
        const avgChildren = statisticsStore.getAverageChildrenPerCouple();

        d3.select('#total-individuals').text(stats.totalIndividuals);
        d3.select('#total-marriages').text(stats.marriages);
        d3.select('#avg-children').text(avgChildren);
        d3.select('#avg-lifespan').text(`${avgLifespan} ans`);
    }

    createGenderChart() {
        const container = d3.select('#gender-chart');
        const containerWidth = container.node().getBoundingClientRect().width;
        const width = containerWidth - this.margins.left - this.margins.right;
        const height = width * 0.6;
        const radius = Math.min(width, height) / 2;

        const svg = container.append('svg')
            .attr('width', width + this.margins.left + this.margins.right)
            .attr('height', height + this.margins.top + this.margins.bottom)
            .append('g')
            .attr('transform', `translate(${width/2},${height/2})`);

        const color = d3.scaleOrdinal()
            .domain(['Hommes', 'Femmes'])
            .range(['#36A2EB', '#FF6384']);

        const pie = d3.pie()
            .value(d => d.value);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius * 0.8);

        const genderDist = statisticsStore.getGenderDistribution();
        const data = [
            { name: 'Hommes', value: parseFloat(genderDist.male) },
            { name: 'Femmes', value: parseFloat(genderDist.female) }
        ];

        const arcs = svg.selectAll('arc')
            .data(pie(data))
            .enter()
            .append('g');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.name))
            .transition()
            .duration(1000)
            .attrTween('d', function(d) {
                const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
                return function(t) { return arc(i(t)); };
            });

        // Add percentages
        arcs.append('text')
            .attr('transform', d => `translate(${arc.centroid(d)})`)
            .attr('dy', '.35em')
            .style('text-anchor', 'middle')
            .style('fill', 'white')
            .text(d => `${d.data.value.toFixed(1)}%`);

        // Add legend
        const legend = svg.append('g')
            .attr('font-family', 'sans-serif')
            .attr('font-size', 10)
            .attr('text-anchor', 'start')
            .selectAll('g')
            .data(data)
            .enter().append('g')
            .attr('transform', (d, i) => `translate(${radius + 10},${i * 20 - radius + 20})`);

        legend.append('rect')
            .attr('width', 15)
            .attr('height', 15)
            .attr('fill', d => color(d.name));

        legend.append('text')
            .attr('x', 20)
            .attr('y', 9.5)
            .attr('dy', '0.32em')
            .text(d => d.name);

        this.charts.gender = { svg, width, height };
    }

    createAgeChart() {
        const container = d3.select('#age-chart');
        const containerWidth = container.node().getBoundingClientRect().width;
        const width = containerWidth - this.margins.left - this.margins.right;
        const height = width * 0.5;

        const svg = container.append('svg')
            .attr('width', width + this.margins.left + this.margins.right)
            .attr('height', height + this.margins.top + this.margins.bottom)
            .append('g')
            .attr('transform', `translate(${this.margins.left},${this.margins.top})`);

        const ageDist = statisticsStore.getAgeDistribution();
        const data = [
            { range: '0-20', value: ageDist.under20 },
            { range: '20-40', value: ageDist['20to40'] },
            { range: '40-60', value: ageDist['40to60'] },
            { range: '60-80', value: ageDist['60to80'] },
            { range: '80+', value: ageDist.over80 }
        ];

        const x = d3.scaleBand()
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .range([height, 0]);

        x.domain(data.map(d => d.range));
        y.domain([0, d3.max(data, d => d.value)]);

        // Add X axis
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        // Add Y axis
        svg.append('g')
            .call(d3.axisLeft(y));

        // Add bars
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

        this.charts.age = { svg, width, height, x, y };
    }

    createBirthChart() {
        const container = d3.select('#birth-chart');
        const containerWidth = container.node().getBoundingClientRect().width;
        const width = containerWidth - this.margins.left - this.margins.right;
        const height = width * 0.5;

        const svg = container.append('svg')
            .attr('width', width + this.margins.left + this.margins.right)
            .attr('height', height + this.margins.top + this.margins.bottom)
            .append('g')
            .attr('transform', `translate(${this.margins.left},${this.margins.top})`);

        const birthDist = statisticsStore.getBirthDistributionByPeriod(25);
        const data = Object.entries(birthDist).map(([period, count]) => ({
            period,
            count
        }));

        const x = d3.scaleTime()
            .range([0, width]);

        const y = d3.scaleLinear()
            .range([height, 0]);

        x.domain(d3.extent(data, d => new Date(d.period.split('-')[0])));
        y.domain([0, d3.max(data, d => d.count)]);

        // Add X axis
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x)
                .tickFormat(d3.timeFormat('%Y')));

        // Add Y axis
        svg.append('g')
            .call(d3.axisLeft(y));

        // Add the line
        const line = d3.line()
            .x(d => x(new Date(d.period.split('-')[0])))
            .y(d => y(d.count));

        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', '#36A2EB')
            .attr('stroke-width', 2)
            .attr('d', line)
            .attr('stroke-dasharray', function() {
                const length = this.getTotalLength();
                return `${length} ${length}`;
            })
            .attr('stroke-dashoffset', function() {
                return this.getTotalLength();
            })
            .transition()
            .duration(2000)
            .attr('stroke-dashoffset', 0);

        this.charts.birth = { svg, width, height, x, y };
    }

    resize() {
        // Implement resize logic for each chart
        Object.keys(this.charts).forEach(chartKey => {
            const chart = this.charts[chartKey];
            const container = d3.select(`#${chartKey}-chart`);
            const containerWidth = container.node().getBoundingClientRect().width;
            const width = containerWidth - this.margins.left - this.margins.right;
            const height = width * (chartKey === 'gender' ? 0.6 : 0.5);

            // Update SVG dimensions
            container.select('svg')
                .attr('width', width + this.margins.left + this.margins.right)
                .attr('height', height + this.margins.top + this.margins.bottom);

            // Specific updates for each chart type would go here
            // ...
        });
    }

    destroy() {
        // Remove all charts
        Object.keys(this.charts).forEach(chartKey => {
            d3.select(`#${chartKey}-chart`).selectAll('*').remove();
        });
        this.charts = {};
        
        // Remove resize listener
        window.removeEventListener('resize', this.resize);
    }
}

export const statisticsManager = new StatisticsManager();