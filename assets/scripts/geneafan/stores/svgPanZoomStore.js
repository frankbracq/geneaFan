import { makeAutoObservable, action } from './mobx-config';
import svgPanZoom from 'svg-pan-zoom';

class SvgPanZoomStore {
    instance = null;
    isFullscreen = false;
    isGrabbing = false;
    originalViewBox = null;
    resizeObserver = null;
    resizeTimeout = null;
    lastWidth = 0;
    lastHeight = 0;
    
    constructor() {
        makeAutoObservable(this, {
            instance: false,
            isFullscreen: true,
            isGrabbing: true,
            originalViewBox: false,
            resizeObserver: false,
            resizeTimeout: false,
            lastWidth: false,
            lastHeight: false,
            
            // Actions
            initialize: action,
            destroy: action,
            reset: action,
            resize: action,
            setFullscreen: action,
            setGrabbing: action,
            updateViewport: action,
            adjustSvgSize: action,
            
            // Non-observables
            handleWindowResize: false,
            debouncedWindowResize: false,
            setupEvents: false,
            handleWheel: false,
            handleDoubleClick: false,
            handleTouchStart: false,
            handleTouchMove: false,
            handleTouchEnd: false,
            cleanupSafely: false,
            safeDestroyInstance: false
        });

        window.addEventListener('resize', this.debouncedWindowResize, { passive: true });
    }

    debouncedWindowResize = () => {
        if (this.resizeTimeout) {
            cancelAnimationFrame(this.resizeTimeout);
        }
        // Double RAF pour assurer la synchronisation avec le prochain frame
        this.resizeTimeout = requestAnimationFrame(() => {
            requestAnimationFrame(this.handleWindowResize);
        });
    };


    initialize = (selector = '#fan', options = {}) => {
        try {
            if (this.instance) {
                this.cleanupSafely();
            }

            const svgElement = document.querySelector(selector);
            const container = document.getElementById('fanContainer');

            if (!svgElement || !container) {
                console.error('SVG element or container not found');
                return null;
            }

            // Réinitialiser l'état du SVG
            svgElement.style.transform = 'none';
            svgElement.removeAttribute('transform');

            this.lastWidth = container.clientWidth;
            this.lastHeight = container.clientHeight;
            this.originalViewBox = svgElement.getAttribute('viewBox');

            svgElement.style.cssText = `
                width: 100%;
                height: 100%;
                max-width: 100%;
                max-height: 100%;
                transform-origin: center;
                pointer-events: all;
                touch-action: pan-x pan-y pinch-zoom;
            `;

            container.style.cssText = `
                display: flex;
                justify-content: center;
                align-items: center;
                overflow: hidden;
                background-color: var(--bg-color-dark);
            `;

            this.adjustSvgSize();

            const defaultOptions = {
                zoomEnabled: true,
                controlIconsEnabled: true,
                fit: true,
                center: true,
                preventMouseEventsDefault: true,
                minZoom: 0.2,
                maxZoom: 6,
                zoomScaleSensitivity: 0.35,
                dblClickZoomEnabled: true,
                mouseWheelZoomEnabled: true,
                panEnabled: true,
                refreshRate: 60,
                beforeZoom: () => true,
                onZoom: () => {},
                beforePan: () => !this.isGrabbing,
                onPan: () => {}
            };

            this.instance = svgPanZoom(selector, {
                ...defaultOptions,
                ...options
            });

            this.setupEvents(selector);
            this.setupResizeHandling();

            requestAnimationFrame(() => {
                if (this.instance) {
                    this.instance.fit();
                    this.instance.center();
                }
            });

            return this.instance;
        } catch (error) {
            console.error('Error initializing SVG Pan Zoom:', error);
            this.cleanupSafely();
            return null;
        }
    };

    handleWindowResize = () => {
        try {
            const container = document.getElementById('fanContainer');
            if (!container) return;

            const currentWidth = container.clientWidth;
            const currentHeight = container.clientHeight;
            const threshold = 2;

            if (Math.abs(currentWidth - this.lastWidth) < threshold && 
                Math.abs(currentHeight - this.lastHeight) < threshold) {
                return;
            }

            this.lastWidth = currentWidth;
            this.lastHeight = currentHeight;

            this.adjustSvgSize();
            
            if (this.instance) {
                this.instance.resize();
                this.instance.fit();
                this.instance.center();
            }
        } catch (error) {
            console.error('Error handling window resize:', error);
        }
    };

    adjustSvgSize = () => {
        try {
            const container = document.getElementById('fanContainer');
            const svgElement = document.getElementById('fan');
            const header = document.getElementById('tab-header');

            if (!container || !svgElement || !header) return;

            const headerHeight = header.offsetHeight;
            const windowHeight = window.innerHeight;
            const availableHeight = windowHeight - headerHeight - 20;

            container.style.height = `${availableHeight}px`;

            if (this.originalViewBox) {
                const [, , vbWidth, vbHeight] = this.originalViewBox.split(' ').map(Number);
                const aspectRatio = vbWidth / vbHeight;
                
                const containerWidth = container.clientWidth;
                const containerHeight = availableHeight;
                
                let width, height;
                
                if (containerWidth / containerHeight > aspectRatio) {
                    height = containerHeight;
                    width = containerHeight * aspectRatio;
                } else {
                    width = containerWidth;
                    height = containerWidth / aspectRatio;
                }

                svgElement.style.width = `${width}px`;
                svgElement.style.height = `${height}px`;
                
                const translateX = (containerWidth - width) / 2;
                const translateY = (containerHeight - height) / 2;
                svgElement.style.transform = `translate(${translateX}px, ${translateY}px)`;
            }
        } catch (error) {
            console.error('Error adjusting SVG size:', error);
        }
    };

    setupEvents = (selector) => {
        const element = document.querySelector(selector);
        if (element) {
            element.addEventListener('wheel', this.handleWheel, { passive: false });
            element.addEventListener('dblclick', this.handleDoubleClick, { passive: false });
            element.addEventListener('touchstart', this.handleTouchStart, { passive: true });
            element.addEventListener('touchmove', this.handleTouchMove, { passive: false });
            element.addEventListener('touchend', this.handleTouchEnd, { passive: true });
        }
    };

    handleWheel = (event) => {
        if (event.ctrlKey || event.metaKey) {
            event.preventDefault();
            const delta = -event.deltaY || event.detail || 0;
            if (this.instance) {
                const factor = delta > 0 ? 1.1 : 0.9;
                this.instance.zoom(factor);
            }
        }
    };

    handleDoubleClick = (event) => {
        event.stopImmediatePropagation();
        if (this.instance && !this.isFullscreen) {
            const zoomFactor = event.ctrlKey || event.metaKey ? 0.8 : 1.2;
            this.instance.zoom(zoomFactor);
        }
    };

    handleTouchStart = (event) => {
        if (event.touches.length === 2) {
            this.setGrabbing(true);
        }
    };

    handleTouchMove = (event) => {
        if (event.touches.length === 2) {
            event.preventDefault();
        }
    };

    handleTouchEnd = () => {
        this.setGrabbing(false);
    };

    setupResizeHandling = () => {
        const container = document.getElementById('fanContainer');
        if (container && !this.resizeObserver) {
            this.resizeObserver = new ResizeObserver((entries) => {
                if (this.resizeTimeout) {
                    clearTimeout(this.resizeTimeout);
                }
                
                this.resizeTimeout = setTimeout(() => {
                    requestAnimationFrame(this.handleWindowResize);
                }, 60);
            });
            
            this.resizeObserver.observe(container);
        }
    };

    cleanupResizeHandling = () => {
        if (this.resizeObserver) {
            try {
                this.resizeObserver.disconnect();
            } catch (e) {
                console.warn('Error disconnecting ResizeObserver:', e);
            }
            this.resizeObserver = null;
        }
        
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
            this.resizeTimeout = null;
        }
    };

    reset = () => {
        if (this.instance) {
            this.instance.reset();
        }
    };

    resize = () => {
        if (this.instance) {
            this.instance.resize();
            this.instance.fit();
            this.instance.center();
        }
    };

    updateViewport = () => {
        if (this.instance) {
            this.instance.updateBBox();
            this.instance.fit();
            this.instance.center();
        }
    };

    cleanupSafely = () => {
        try {
            if (this.instance) {
                this.instance.destroy();
                this.instance = null;
            }

            const svgElement = document.querySelector('#fan');
            if (svgElement) {
                svgElement.removeEventListener('wheel', this.handleWheel);
                svgElement.removeEventListener('dblclick', this.handleDoubleClick);
                svgElement.removeEventListener('touchstart', this.handleTouchStart);
                svgElement.removeEventListener('touchmove', this.handleTouchMove);
                svgElement.removeEventListener('touchend', this.handleTouchEnd);

                const controls = svgElement.querySelector('.svg-pan-zoom-control-elements');
                if (controls && controls.parentNode) {
                    controls.parentNode.removeChild(controls);
                }
            }

            this.cleanupResizeHandling();
            
            this.isFullscreen = false;
            this.isGrabbing = false;
            this.originalViewBox = null;
        } catch (error) {
            console.error('Error during cleanup:', error);
        }
    };

    destroy = () => {
        this.cleanupSafely();
        window.removeEventListener('resize', this.debouncedWindowResize);
    };

    // Autres méthodes utilitaires en arrow functions
    setFullscreen = (isFullscreen) => {
        this.isFullscreen = isFullscreen;
        if (this.instance) {
            if (isFullscreen) {
                this.instance.disableDblClickZoom();
            } else {
                this.instance.enableDblClickZoom();
                this.reset();
            }
        }
    };

    setGrabbing = (isGrabbing) => {
        this.isGrabbing = isGrabbing;
        const fanElement = document.getElementById('fan');
        if (fanElement) {
            fanElement.style.cursor = isGrabbing ? 'grabbing' : (this.isFullscreen ? 'grab' : 'default');
        }
    };

    get isInitialized() {
        return this.instance !== null;
    }
}

const svgPanZoomStore = new SvgPanZoomStore();
export default svgPanZoomStore;