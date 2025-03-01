import * as d3 from 'd3';
import { Tooltip } from 'bootstrap';

class StatisticsManager {
    constructor() {
        this.charts = {};
        this.margins = { top: 20, right: 20, bottom: 30, left: 40 };
        this.initialized = false;
        this.minHeight = 1;
        this.minChartWidth = 300;
        this.minChartHeight = 200;
        this.statisticsStore = null;

        // Bind methods
        this.initialize = this.initialize.bind(this);
        this.updateCharts = this.updateCharts.bind(this);
        this.resize = this.resize.bind(this);
    }

    async initialize() {
        console.group('📈 Initialisation du StatisticsManager');
        
        if (document.readyState === 'loading') {
            console.log('Document en cours de chargement, attente du DOMContentLoaded');
            document.addEventListener('DOMContentLoaded', this.initialize);
            console.groupEnd();
            return;
        }

        try {
            // Import dynamique du store
            console.log('Import du statisticsStore...');
            const { default: statisticsStore } = await import('./statisticsStore.js');
            this.statisticsStore = statisticsStore;

            // Initialisation du store
            console.log('Initialisation du statisticsStore...');
            await this.statisticsStore.initialize();

            // S'abonner aux mises à jour
            console.log('Configuration des abonnements aux mises à jour...');
            this.statisticsStore.subscribeToUpdates(this.updateCharts);

            const containers = ['#age-chart', '#lifespan-chart'];
            console.log('Vérification des conteneurs:', containers);

            // Vérifier que les conteneurs et les données sont disponibles
            const stats = this.statisticsStore.getStatistics('family');
            if (!containers.every(id => document.querySelector(id)) || !stats?.demography) {
                console.log('Conteneurs ou données non disponibles, nouvelle tentative dans 500ms');
                setTimeout(this.initialize, 500);
                console.groupEnd();
                return;
            }

            console.log('Initialisation des graphiques...');
            this.cleanupContainers();
            this.updateBasicStats();
            await this.createDemographyCharts();
            this.initializeNavigation();

            if (!this.initialized) {
                window.addEventListener('resize', this.resize);
                this.initialized = true;
                console.log('✅ Initialisation terminée avec succès');
            }

        } catch (error) {
            console.error('❌ Erreur lors de l\'initialisation:', error);
            throw error;
        }

        console.groupEnd();
    }


    dispose() {
        if (this.initialized) {
            this.cleanupContainers();
            window.removeEventListener('resize', this.resize);
            if (this.statisticsStore) {
                this.statisticsStore.dispose();
                this.statisticsStore = null;
            }
            this.initialized = false;
        }
    }
    
    initializeNavigation() {
        const navLinks = document.querySelectorAll('.statistics-container .nav.nav-pills .nav-link');

        if (!navLinks.length) {
            console.warn('Navigation links not found');
            return;
        }

        navLinks.forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();

                const targetId = this.getAttribute('href');
                const targetSection = document.querySelector(targetId);
                const container = document.querySelector('.tab-pane.statistics-container');
                const stickyOverview = document.querySelector('.sticky-overview');

                if (targetSection && container && stickyOverview) {
                    const headerHeight = stickyOverview.offsetHeight + 20;
                    const containerRect = container.getBoundingClientRect();
                    const sectionRect = targetSection.getBoundingClientRect();
                    const scrollTop = container.scrollTop + (sectionRect.top - containerRect.top) - headerHeight;

                    container.scrollTo({
                        top: scrollTop,
                        behavior: 'smooth'
                    });

                    navLinks.forEach(l => l.classList.remove('active'));
                    this.classList.add('active');
                }
            });
        });
    }

    updateBasicStats(stats = null) {
        if (!this.statisticsStore) {
            console.warn('Statistics store not initialized');
            return;
        }
        
        stats = stats || this.statisticsStore.getStatistics('family');
        if (!stats?.demography) return;

        const format = (value, decimals = 1) => {
            if (value === undefined || isNaN(value)) return '0.0';
            return parseFloat(value).toFixed(decimals);
        };

        const avgLifeExpectancy = stats.demography.lifeExpectancy.average ||
            this.calculateAverageLifeExpectancy(stats.demography.lifeExpectancy.byDecade);

        d3.select('#total-individuals').text(stats.demography.total || 0);
        d3.select('#total-marriages').text(stats.family?.marriages?.total || 0);
        d3.select('#avg-children').text(format(stats.family?.children?.average, 1));
        d3.select('#avg-lifespan').text(`${format(avgLifeExpectancy, 1)} ans`);
    }


    updateCharts(newStats) {
        if (!this.initialized || newStats?.scope !== 'family') return;

        try {
            this.cleanupContainers();
            this.updateBasicStats(newStats);
            this.createDemographyCharts();
        } catch (error) {
            console.error('Error updating charts:', error);
        }
    }

    createDemographyCharts() {
        if (!this.statisticsStore) {
            console.warn('Statistics store not initialized');
            return;
        }

        const stats = this.statisticsStore.getStatistics('family');
        if (!stats?.demography) {
            console.warn('No family demography statistics available');
            return;
        }

        if (stats.demography.ageDistribution) {
            this.createAgeDistributionChart();
        }
        if (stats.demography.lifeExpectancy) {
            this.createLifeExpectancyChart();
        }
        if (stats.geography) {
            this.createBirthDeathPlacesChart();
        }
    }

    createGenderDistributionChart() {
        if (!this.statisticsStore) {
            console.warn('Statistics store not initialized');
            return;
        }
    
        const stats = this.statisticsStore.getStatistics('family')?.demography?.gender;
        if (!stats) return;
    
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
        if (!this.statisticsStore) {
            console.warn('Statistics store not initialized');
            return;
        }

        const stats = this.statisticsStore.getStatistics('family');
        if (!stats?.demography?.mortality?.byCentury) {
            console.warn('No mortality statistics available');
            return;
        }

        const container = d3.select('#age-chart');
        if (!container.node()) {
            console.warn('Age chart container not found');
            return;
        }
    
        // Nettoyer le conteneur
        container.selectAll('*').remove();
    
        const margins = {
            top: 20,
            right: 160,
            bottom: 80,
            left: 50
        };
    
        const containerWidth = container.node().getBoundingClientRect().width;
        const width = Math.max(this.minChartWidth, containerWidth - margins.left - margins.right);
        const height = Math.max(this.getContainerHeight(width), 400);
    
        const svg = container.append('svg')
            .attr('width', width + margins.left + margins.right)
            .attr('height', height + margins.top + margins.bottom)
            .append('g')
            .attr('transform', `translate(${margins.left},${margins.top})`);
    
        const ageRanges = ["0-1", "1-5", "6-10", "11-20", "21-30", "31-40",
            "41-50", "51-60", "61-70", "71-80", "81-90", "91+"];
    
        const centuries = ['s18', 's19', 's20', 's21'];
        const centuryLabels = {
            's18': '18ème siècle et avant',
            's19': '19ème siècle',
            's20': '20ème siècle',
            's21': '21ème siècle'
        };
    
        const colors = {
            's18': '#082f49',
            's19': '#0891b2',
            's20': '#22d3ee',
            's21': '#67e8f9'
        };
    
        // Préparation des données avec pourcentages
        const data = ageRanges.map(range => {
            const rangeData = { range };
            centuries.forEach(century => {
                const centuryData = stats.demography.mortality.byCentury[century];
                const count = centuryData?.ageRanges[range] || 0;
                const total = centuryData?.total || 0;
                rangeData[century] = total > 0 ? (count / total) * 100 : 0;
                rangeData[`${century}_count`] = count;
            });
            return rangeData;
        });
    
        const x = d3.scaleBand()
            .domain(ageRanges)
            .range([0, width])
            .padding(0.1);
    
        const y = d3.scaleLinear()
            .domain([0, 100])
            .nice()
            .range([height, 0]);
    
        const stack = d3.stack()
            .keys(centuries)
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetNone);
    
        const stackedData = stack(data);
    
        // Grille horizontale
        svg.append('g')
            .attr('class', 'grid')
            .selectAll('line')
            .data(y.ticks())
            .enter()
            .append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', d => y(d))
            .attr('y2', d => y(d))
            .attr('stroke', '#e5e7eb')
            .attr('stroke-width', 1);
    
        // Barres empilées
        svg.selectAll('g.century')
            .data(stackedData)
            .enter()
            .append('g')
            .attr('class', 'century')
            .attr('fill', d => colors[d.key])
            .selectAll('rect')
            .data(d => d)
            .enter()
            .append('rect')
            .attr('x', d => x(d.data.range))
            .attr('y', d => y(d[1]))
            .attr('height', d => y(d[0]) - y(d[1]))
            .attr('width', x.bandwidth())
            .attr('data-bs-toggle', 'tooltip')
            .attr('data-bs-placement', 'top')
            .attr('data-bs-html', 'true')
            .attr('data-bs-title', function(d) {
                const century = d3.select(this.parentNode).datum().key;
                const percentage = (d[1] - d[0]).toFixed(1);
                const count = d.data[`${century}_count`];
                return `
                    <div style="text-align: left;">
                        <strong>${centuryLabels[century]}</strong><br>
                        Âge: ${d.data.range}<br>
                        Nombre: ${count}<br>
                        Pourcentage: ${percentage}%
                    </div>
                `;
            })
            .on('mouseenter', function() {
                d3.select(this).attr('fill-opacity', 0.8);
            })
            .on('mouseleave', function() {
                d3.select(this).attr('fill-opacity', 1);
            });
    
        // Calculer les totaux par tranche d'âge
        const totals = data.reduce((acc, d) => {
            const totalForRange = centuries.reduce((sum, century) => {
                return sum + d[`${century}_count`];
            }, 0);
            acc[d.range] = totalForRange;
            return acc;
        }, {});
    
        const grandTotal = Object.values(totals).reduce((sum, val) => sum + val, 0);
    
        // Ajouter les labels au-dessus des barres empilées
        svg.selectAll('.bar-total-label')
            .data(data)
            .enter()
            .append('text')
            .attr('class', 'bar-total-label')
            .attr('x', d => x(d.range) + x.bandwidth() / 2)
            .attr('y', d => {
                const total = centuries.reduce((sum, century) => sum + d[century], 0);
                return y(total) - 5;
            })
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .text(d => {
                const total = totals[d.range];
                const percentage = ((total / grandTotal) * 100).toFixed(1);
                return `${total} (${percentage}%)`;
            });
    
        // Axes
        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .attr('transform', 'rotate(-45)')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em');
    
        svg.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(y).tickFormat(d => d + '%'));
    
        // Labels des axes
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', height + margins.bottom - 10)
            .attr('text-anchor', 'middle')
            .text('Âge au décès (années)');
    
        svg.append('text')
            .attr('transform', 'rotate(-90)')
            .attr('y', -margins.left + 15)
            .attr('x', -height / 2)
            .attr('text-anchor', 'middle')
            .text('Pourcentage de personnes par siècle');
    
        // Légende
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width + 20}, 0)`);
    
        centuries.forEach((century, i) => {
            const legendGroup = legend.append('g')
                .attr('transform', `translate(0, ${i * 25})`);
    
            legendGroup.append('rect')
                .attr('width', 18)
                .attr('height', 18)
                .attr('fill', colors[century]);
    
            legendGroup.append('text')
                .attr('x', 24)
                .attr('y', 14)
                .style('font-size', '12px')
                .text(centuryLabels[century]);
        });
    
        // Initialiser les tooltips
        const tooltipTriggerList = svg.selectAll('[data-bs-toggle="tooltip"]').nodes();
        tooltipTriggerList.forEach(el => {
            new Tooltip(el, {
                container: 'body',
                html: true
            });
        });
    
        return { svg, width, height };
    }

    createLifeExpectancyChart() {
        if (!this.statisticsStore) {
            console.warn('Statistics store not initialized');
            return;
        }

        const stats = this.statisticsStore.getStatistics('family');
        if (!stats?.demography?.lifeExpectancy?.byDecade) {
            console.warn('No life expectancy statistics available');
            return;
        }

        const container = d3.select('#lifespan-chart');
        const width = this.getContainerWidth(container);
        const height = this.getContainerHeight(width);

        const svg = this.createSvg(container, width, height);

        // Convert data to array format
        const data = Object.entries(stats.demography.lifeExpectancy.byDecade)
            .map(([decade, value]) => ({
                decade: parseInt(decade),
                value: value
            }))
            .sort((a, b) => a.decade - b.decade);

        // Only create chart if we have valid data
        if (data.length > 0) {
            this.createLineChart(svg, data, width, height, {
                lineColor: '#0ea5e9',
                xLabel: 'Décennie',
                yLabel: 'Espérance de vie moyenne (années)'
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
                .attr('transform', `translate(${width / 2},${height + 25})`)
                .style('text-anchor', 'middle')
                .text(options.xLabel);
        }

        if (options.yLabel) {
            svg.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', -40)
                .attr('x', -height / 2)
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
                .attr('transform', `translate(${width / 2},${height + 25})`)
                .style('text-anchor', 'middle')
                .text(options.xLabel);
        }

        if (options.yLabel) {
            svg.append('text')
                .attr('transform', 'rotate(-90)')
                .attr('y', -40)
                .attr('x', -height / 2)
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
            .text(d => `${((d.data.value / total) * 100).toFixed(1)}%`);

        this.addLegend(svg, data, color, radius);
    }

    createBirthDeathPlacesChart() {
        if (!this.statisticsStore) {
            console.warn('Statistics store not initialized');
            return;
        }
    
        const stats = this.statisticsStore.getStatistics()?.geography;
        if (!stats?.birthPlaces) {
            console.warn('No geographic statistics available');
            return;
        }
    
        const container = d3.select('#birth-death-places-chart');
        container.selectAll('*').remove();
        // Préparer les données : filtrer les lieux avec plus d'une naissance
        const data = Object.entries(stats.birthPlaces)
            .map(([place, stats]) => ({
                place,
                stayedCount: stats.stayedCount || 0,
                localMoveCount: stats.localMoveCount || 0,
                movedCount: stats.movedCount || 0,
                unknownCount: stats.unknownCount || 0,
                total: stats.total || 0,
                percentages: stats.percentages || {}
            }))
            .filter(d => d.total > 1) // Filtrer les lieux avec plus d'une naissance
            .sort((a, b) => b.total - a.total)
            .slice(0, 15); // Limiter aux 15 premières villes

        // Dimensions ajustées pour plus de places
        const margins = {
            top: 30,
            right: 240,
            bottom: 40,
            left: 240
        };

        // Augmentation de la hauteur pour accommoder plus de villes
        const width = Math.max(800, container.node().getBoundingClientRect().width * (8 / 12) - margins.left - margins.right);
        const height = Math.max(500, data.length * 35); // Hauteur ajustée: 35px par ville

        // Create SVG
        const svg = container.append('svg')
            .attr('width', width + margins.left + margins.right)
            .attr('height', height + margins.top + margins.bottom)
            .append('g')
            .attr('transform', `translate(${margins.left},${margins.top})`);

        // Scales
        const y = d3.scaleBand()
            .domain(data.map(d => d.place))
            .range([0, height])
            .padding(0.2);

        const x = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.total)])
            .range([0, width]);

        // Axes
        svg.append('g')
            .attr('class', 'x-axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(10).tickFormat(d3.format('d')))
            .selectAll('text')
            .style('font-size', '12px');

        svg.append('g')
            .attr('class', 'y-axis')
            .call(d3.axisLeft(y))
            .selectAll('text')
            .style('font-size', '12px')
            .style('text-anchor', 'end')
            .attr('dx', '-0.5em')
            .attr('dy', '0.3em');

        // Barres empilées
        const barGroups = svg.append('g')
            .selectAll('g')
            .data(data)
            .enter()
            .append('g')
            .attr('transform', d => `translate(0,${y(d.place)})`);

        // Configuration des couleurs
        const colors = {
            stayed: '#4ade80',      // vert
            localMove: '#facc15',   // jaune
            moved: '#f87171',       // rouge
            unknown: '#94a3b8'      // gris
        };

        // Fonction pour calculer la position x de chaque segment
        function getXPosition(d, segment) {
            switch (segment) {
                case 'stayed': return 0;
                case 'localMove': return x(d.stayedCount);
                case 'moved': return x(d.stayedCount + d.localMoveCount);
                case 'unknown': return x(d.stayedCount + d.localMoveCount + d.movedCount);
                default: return 0;
            }
        }

        // Fonction pour calculer la largeur de chaque segment
        function getWidth(d, segment) {
            switch (segment) {
                case 'stayed': return x(d.stayedCount);
                case 'localMove': return x(d.localMoveCount);
                case 'moved': return x(d.movedCount);
                case 'unknown': return x(d.unknownCount);
                default: return 0;
            }
        }

        // Créer les segments de barres
        const segments = ['stayed', 'localMove', 'moved', 'unknown'];
        segments.forEach(segment => {
            // Barres
            barGroups.append('rect')
                .attr('class', `bar-${segment}`)
                .attr('x', d => getXPosition(d, segment))
                .attr('y', 0)
                .attr('height', y.bandwidth())
                .attr('width', d => getWidth(d, segment))
                .attr('fill', colors[segment])
                .attr('rx', 2)
                .attr('ry', 2);

            // Texte dans les barres
            barGroups.append('text')
                .attr('x', d => getXPosition(d, segment) + getWidth(d, segment) / 2)
                .attr('y', y.bandwidth() / 2)
                .attr('dy', '0.35em')
                .attr('text-anchor', 'middle')
                .style('fill', 'white')
                .style('font-size', '11px')  // Taille légèrement réduite pour mieux s'adapter
                .text(d => {
                    const value = {
                        'stayed': d.stayedCount,
                        'localMove': d.localMoveCount,
                        'moved': d.movedCount,
                        'unknown': d.unknownCount
                    }[segment];
                    return value > 0 ? value : '';
                });
        });

        // Total values
        barGroups.append('text')
            .attr('x', d => x(d.total) + 5)
            .attr('y', y.bandwidth() / 2)
            .attr('dy', '0.35em')
            .style('font-size', '12px')
            .text(d => d.total);

        // Légende
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width + 20}, 0)`);

        legend.append('text')
            .attr('x', 0)
            .attr('y', -10)
            .style('font-size', '14px')
            .style('font-weight', 'bold')
            .text('Légende');

        // Items de légende
        const legendItems = [
            { key: 'stayed', text: 'Nés et décédés ici (<10km)' },
            { key: 'localMove', text: 'Migration locale (10-20km)' },
            { key: 'moved', text: 'Migration (>20km)' },
            { key: 'unknown', text: 'Lieu de décès inconnu' }
        ];

        legendItems.forEach((item, i) => {
            legend.append('rect')
                .attr('y', i * 25)
                .attr('width', 15)
                .attr('height', 15)
                .attr('fill', colors[item.key]);

            legend.append('text')
                .attr('x', 25)
                .attr('y', i * 25 + 12)
                .style('font-size', '12px')
                .text(item.text);
        });

        // Titre mis à jour pour refléter le nouveau critère
        svg.append('text')
            .attr('x', width / 2)
            .attr('y', -10)
            .attr('text-anchor', 'middle')
            .style('font-size', '16px')
            .style('font-weight', 'bold')
            .text('Lieux de naissance (>1 naissance) et migrations');
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
        const containers = {
            age: '#age-chart',
            lifespan: '#lifespan-chart'
        };

        Object.values(containers).forEach(id => {
            const container = d3.select(id);
            if (container.node()) {
                container.selectAll('*').remove();
                container
                    .style('min-height', `${this.minChartHeight}px`)
                    .style('min-width', `${this.minChartWidth}px`);
            }
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
            svg.attr('transform', `translate(${width / 2},${height / 2})`);
        } else {
            svg.attr('transform', `translate(${this.margins.left},${this.margins.top})`);
        }

        return svg;
    }


    resize() {
        if (!this.initialized || !this.statisticsStore) {
            console.warn('Manager not initialized or store not available');
            return;
        }
    
        try {
            this.cleanupContainers();
    
            // Appeler directement les méthodes de création de graphiques
            this.createAgeDistributionChart();
            this.createLifeExpectancyChart();
            this.createBirthDeathPlacesChart();
        } catch (error) {
            console.error('Error during resize:', error);
        }
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