export class SVGPanZoomManager {
    constructor(svgElement, options = {}) {
        this.svg = svgElement;
        this.container = svgElement.parentElement;
        this.options = {
            minZoom: options.minZoom || 0.1,
            maxZoom: options.maxZoom || 10,
            zoomScaleSensitivity: options.zoomScaleSensitivity || 0.2,
            fitPadding: options.fitPadding || 20,
            ...options
        };

        this.state = {
            zoom: 1,
            panning: false,
            pointX: 0,
            pointY: 0,
            startX: 0,
            startY: 0,
            viewBox: null,
            containerWidth: 0,
            containerHeight: 0
        };

        this.svg.style.width = 'auto';
        this.svg.style.height = 'auto';
        this.svg.style.maxWidth = '100%';
        this.svg.style.maxHeight = '100%';
        this.svg.style.display = 'block';

        this._initialDisplay = true;

        requestAnimationFrame(() => {
            this.initialize();
            this.handleResize(); // Appelé une fois après l'initialisation
        
            // Attachez le ResizeObserver après une courte attente
            setTimeout(() => {
                const resizeObserver = new ResizeObserver(() => {
                    if (resizeTimeout) clearTimeout(resizeTimeout);
                    resizeTimeout = setTimeout(() => this.handleResize(), 100);
                });
                resizeObserver.observe(this.container);
            }, 200);
            
            this._initialDisplay = false;
        });

        let resizeTimeout;
        const resizeObserver = new ResizeObserver(() => {
            if (resizeTimeout) clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.handleResize(), 100);
        });
        resizeObserver.observe(this.container);
    }

    initialize() {
        if (!this.svg.isConnected) return;
    
        const bbox = this.svg.getBBox();
        const viewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
        this.svg.setAttribute('viewBox', viewBox);
    
        this.state.viewBox = {
            x: bbox.x,
            y: bbox.y,
            width: bbox.width,
            height: bbox.height
        };
    
        // Ne pas définir de transform initial
        this.setupEventListeners();
    }

    setupEventListeners() {
        this.svg.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = -Math.sign(e.deltaY);
            const scale = 1 + delta * this.options.zoomScaleSensitivity;
            const point = this.getRelativeMousePosition(e);
            this.zoomAtPoint(scale, point);
        }, { passive: false });

        this.svg.addEventListener('mousedown', (e) => {
            if (e.button === 0) {
                this.state.panning = true;
                this.state.startX = e.clientX - this.state.pointX;
                this.state.startY = e.clientY - this.state.pointY;
                this.svg.style.cursor = 'grabbing';
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (this.state.panning) {
                e.preventDefault();
                const newX = e.clientX - this.state.startX;
                const newY = e.clientY - this.state.startY;

                this.state.pointX = newX;
                this.state.pointY = newY;
                this.updateTransform();
            }
        });

        window.addEventListener('mouseup', () => {
            if (this.state.panning) {
                this.state.panning = false;
                this.svg.style.cursor = 'grab';
            }
        });

        this.svg.addEventListener('dblclick', (e) => {
            e.preventDefault();
            this.centerAndFit();
        });

        this.setupTouchEvents();
    }

    setupTouchEvents() {
        let lastTouchDistance = 0;
        let initialZoom = 1;

        this.svg.addEventListener('touchstart', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                lastTouchDistance = this.getTouchDistance(e.touches);
                initialZoom = this.state.zoom;
            } else if (e.touches.length === 1) {
                this.state.panning = true;
                this.state.startX = e.touches[0].clientX - this.state.pointX;
                this.state.startY = e.touches[0].clientY - this.state.pointY;
            }
        }, { passive: false });

        this.svg.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault();
                const distance = this.getTouchDistance(e.touches);
                const scale = (distance / lastTouchDistance);
                const center = this.getTouchCenter(e.touches);

                this.zoomAtPoint(scale, center, initialZoom);
            } else if (e.touches.length === 1 && this.state.panning) {
                const newX = e.touches[0].clientX - this.state.startX;
                const newY = e.touches[0].clientY - this.state.pointY;

                this.state.pointX = newX;
                this.state.pointY = newY;
                this.updateTransform();
            }
        }, { passive: false });

        this.svg.addEventListener('touchend', () => {
            this.state.panning = false;
        });
    }

    handleResize() {
        if (this._isResizing) return; // Ajout d'un verrou pour éviter les appels simultanés
        this._isResizing = true;
    
        const rect = this.container.getBoundingClientRect();
        this.state.containerWidth = rect.width;
        this.state.containerHeight = rect.height;
    
        // console.log("=== handleResize ===");
        // console.log("Container dimensions:", rect.width, "x", rect.height);
        // console.trace("Trace of handleResize"); // Affiche la pile d'appels
    
        this.centerAndFit();
    
        // Retirez le verrou après une courte attente
        setTimeout(() => {
            this._isResizing = false;
        }, 100);
    }

    getRelativeMousePosition(event) {
        const rect = this.svg.getBoundingClientRect();
        return {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
    }

    zoomAtPoint(scale, point, baseZoom = this.state.zoom) {
        const oldZoom = baseZoom;
        const newZoom = Math.min(Math.max(baseZoom * scale, this.options.minZoom), this.options.maxZoom);
        const scaleFactor = newZoom / oldZoom;

        this.state.pointX = point.x - (point.x - this.state.pointX) * scaleFactor;
        this.state.pointY = point.y - (point.y - this.state.pointY) * scaleFactor;
        this.state.zoom = newZoom;

        this.updateTransform();
    }

    updateTransform() {
        // N'utiliser cette méthode que pour les interactions utilisateur
        if (!this.state.panning && this.state.zoom === this.lastCenteredZoom) {
            return;
        }
        
        const transform = `translate(${this.state.pointX}px, ${this.state.pointY}px) scale(${this.state.zoom})`;
        this.svg.style.transform = transform;
        this.svg.style.transformOrigin = '0 0';
    
        // console.log("=== updateTransform ===");
        // console.log("Applied transform:", transform);
    }

    centerAndFit() {
        const containerRect = this.container.getBoundingClientRect();
        const viewBox = this.state.viewBox;

        // Calcul de l'échelle pour ajuster aux dimensions du conteneur
        const scaleX = containerRect.width / viewBox.width;
        const scaleY = containerRect.height / viewBox.height;
        const scale = Math.min(scaleX, scaleY) * 0.95; // Réduit de 5%

        // Largeur et hauteur du SVG après application de l'échelle
        const scaledWidth = viewBox.width * scale;
        const scaledHeight = viewBox.height * scale;

        // Calcul du centrage
        const offsetX = (containerRect.width - scaledWidth) / 2;
        const offsetY = (containerRect.height - scaledHeight) / 2;

        // Mise à jour de l'état
        this.state.zoom = scale;
        this.state.pointX = offsetX;
        this.state.pointY = offsetY;

        // console.log("=== centerAndFit ===");
        // console.log("Container dimensions:", containerRect.width, "x", containerRect.height);
        // console.log("SVG viewBox:", viewBox.width, "x", viewBox.height);
        // console.log("Scaled dimensions:", scaledWidth, "x", scaledHeight);
        // console.log("Computed scale:", scale);
        // console.log("Offsets - X:", offsetX, "Y:", offsetY);
    }

    destroy() {
        this.svg.style.cursor = '';
        this.svg.style.transform = '';
        this.svg.style.transformOrigin = '';
    }
}