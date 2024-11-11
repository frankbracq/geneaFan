import { makeAutoObservable, action } from './mobx-config';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

class ThreeDPreviewStore {
    scene = null;
    camera = null;
    renderer = null;
    controls = null;
    woodMaterial = null;
    fanGroup = null;
    isInitialized = false;
    
    constructor() {
        makeAutoObservable(this, {
            initialize: action,
            destroy: action,
            createScene: action,
            createLighting: action,
            createWoodMaterial: action,
            convertSvgToThreeJs: action,
            toggleView: action,
            parseSVGPath: false,
            approximateArc: false
        });
    }

    initialize = (container) => {
        if (this.isInitialized) return;

        this.createScene(container);
        this.createLighting();
        this.createWoodMaterial();
        this.setupControls();
        
        this.isInitialized = true;
        this.animate();

        window.addEventListener('resize', this.handleResize);
    };

    createScene = (container) => {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf5f5f5);

        // Camera
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.camera.position.set(0, 0, 10);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true,
            alpha: true 
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        container.appendChild(this.renderer.domElement);
    };

    createLighting = () => {
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.scene.add(ambient);

        // Directional lights for better wood visibility
        const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
        mainLight.position.set(5, 5, 5);
        mainLight.castShadow = true;
        this.scene.add(mainLight);

        const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
        fillLight.position.set(-5, 5, -5);
        this.scene.add(fillLight);
    };

    createWoodMaterial = () => {
        // Créer une texture procédurale pour le bois
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 512;
        const context = canvas.getContext('2d');
        
        // Couleur de base chêne clair
        context.fillStyle = '#d4b483';
        context.fillRect(0, 0, 512, 512);
        
        // Ajouter des stries pour simuler le grain du bois
        context.strokeStyle = '#c4a473';
        for (let i = 0; i < 50; i++) {
            context.beginPath();
            const y = Math.random() * 512;
            context.moveTo(0, y);
            
            // Créer une ligne ondulée
            for (let x = 0; x < 512; x += 10) {
                const offset = Math.sin(x * 0.01) * 10;
                context.lineTo(x, y + offset);
            }
            
            context.lineWidth = 1 + Math.random() * 2;
            context.stroke();
        }

        // Créer la texture à partir du canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(2, 2); // Répéter la texture
        
        this.woodMaterial = new THREE.MeshPhysicalMaterial({
            map: texture,
            side: THREE.DoubleSide,
            roughness: 0.8,
            metalness: 0,
            envMapIntensity: 1,
            clearcoat: 0.1,  // Légère couche de vernis
            clearcoatRoughness: 0.4
        });
    };

    setupControls = () => {
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = true;
        this.controls.minDistance = 3;
        this.controls.maxDistance = 20;
        this.controls.maxPolarAngle = Math.PI / 2;
    };

    parseSVGPath = (d) => {
        const commands = [];
        const parts = d.match(/([M|A])([^M|A]+)/g);
        
        parts?.forEach(part => {
            const type = part[0];
            const values = part.slice(1).trim().split(/[\s,]+/).map(parseFloat);
            
            if (type === 'M') {
                commands.push({
                    type: 'M',
                    x: values[0],
                    y: values[1]
                });
            } else if (type === 'A') {
                commands.push({
                    type: 'A',
                    rx: values[0],
                    ry: values[1],
                    xAxisRotation: values[2],
                    largeArcFlag: values[3],
                    sweepFlag: values[4],
                    x: values[5],
                    y: values[6]
                });
            }
        });
        
        return commands;
    };

    approximateArc = (x1, y1, rx, ry, angle, largeArc, sweep, x2, y2) => {
        // Version améliorée pour mieux gérer les arcs
        const steps = 64;
        const points = [];
        
        // Calculer le centre de l'arc
        const midX = (x1 + x2) / 2;
        const midY = (y1 + y2) / 2;
    
        // Calculer l'angle de départ et l'angle total
        const startAngle = Math.atan2(y1 - midY, x1 - midX);
        const endAngle = Math.atan2(y2 - midY, x2 - midX);
        
        // Déterminer le sens de rotation
        let deltaAngle = endAngle - startAngle;
        if (sweep) {
            if (deltaAngle < 0) deltaAngle += Math.PI * 2;
        } else {
            if (deltaAngle > 0) deltaAngle -= Math.PI * 2;
        }
    
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const angle = startAngle + deltaAngle * t;
            
            const x = midX + rx * Math.cos(angle);
            const y = midY + ry * Math.sin(angle);
            points.push({x, y});
        }
        
        return points;
    };

    convertSvgToThreeJs = (svgElement) => {
        if (this.fanGroup) {
            this.scene.remove(this.fanGroup);
        }

        this.fanGroup = new THREE.Group();
        
        const paths = svgElement.querySelectorAll('path.individual-boxes, path.marriage-boxes');
        
        console.log(`Converting ${paths.length} SVG paths to 3D`);

        paths.forEach((path, index) => {
            try {
                const d = path.getAttribute('d');
                console.log(`Processing path ${index}:`, d);

                const shape = new THREE.Shape();
                let firstPoint = true;
                let currentX = 0, currentY = 0;

                // Parser le chemin SVG
                const pathData = this.parseSVGPath(d);
                pathData.forEach(cmd => {
                    switch(cmd.type) {
                        case 'M':
                            if (firstPoint) {
                                shape.moveTo(cmd.x, cmd.y);
                                firstPoint = false;
                            }
                            currentX = cmd.x;
                            currentY = cmd.y;
                            break;
                        case 'A':
                            // Convertir l'arc en courbe
                            const arcPoints = this.approximateArc(
                                currentX, currentY,
                                cmd.rx, cmd.ry,
                                cmd.xAxisRotation,
                                cmd.largeArcFlag,
                                cmd.sweepFlag,
                                cmd.x, cmd.y
                            );
                            arcPoints.forEach(point => {
                                shape.lineTo(point.x, point.y);
                            });
                            currentX = cmd.x;
                            currentY = cmd.y;
                            break;
                    }
                });

                shape.closePath();

                // Créer la géométrie 3D
                const extrudeSettings = {
                    depth: 0.05,  // Réduire la profondeur
                    bevelEnabled: true,
                    bevelThickness: 0.01, // Réduire le biseau
                    bevelSize: 0.01,
                    bevelOffset: 0,
                    bevelSegments: 5  // Augmenter les segments pour plus de douceur
                };

                const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
                const mesh = new THREE.Mesh(geometry, this.woodMaterial);
                
                this.fanGroup.add(mesh);

            } catch (error) {
                console.error('Error converting path:', error, path);
            }
        });

        // Centrer et orienter le groupe
        if (this.fanGroup.children.length > 0) {
            const box = new THREE.Box3().setFromObject(this.fanGroup);
            const center = box.getCenter(new THREE.Vector3());
            this.fanGroup.position.sub(center);
            
            // Rotation pour une meilleure vue initiale
            this.fanGroup.rotation.x = -Math.PI / 4;
        }

        this.scene.add(this.fanGroup);
        
        // Ajuster la caméra
        this.fitCameraToObject(this.fanGroup);
    };

    handleResize = () => {
        if (!this.camera || !this.renderer) return;

        const container = this.renderer.domElement.parentElement;
        const aspect = container.clientWidth / container.clientHeight;
        
        this.camera.aspect = aspect;
        this.camera.updateProjectionMatrix();
        
        this.renderer.setSize(container.clientWidth, container.clientHeight);
    };

    animate = () => {
        if (!this.isInitialized) return;

        requestAnimationFrame(this.animate);

        if (this.controls) {
            this.controls.update();
        }

        this.renderer.render(this.scene, this.camera);
    };

    fitCameraToObject = (object, offset = 2) => {
        const boundingBox = new THREE.Box3().setFromObject(object);
        const center = boundingBox.getCenter(new THREE.Vector3());
        const size = boundingBox.getSize(new THREE.Vector3());
        
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / Math.tan(fov / 2)) * offset;
        
        // Positionner la caméra pour une vue en diagonale
        this.camera.position.set(center.x, cameraZ * 0.7, cameraZ);
        this.camera.lookAt(center);
        
        // Mettre à jour les contrôles
        if (this.controls) {
            this.controls.target.copy(center);
            this.controls.update();
        }
    };

    toggleView = (svgElement) => {
        const container = document.getElementById('fanContainer');
        if (!this.isInitialized) {
            this.initialize(container);
        }

        const svgFan = svgElement || document.getElementById('fan');
        const threeJsCanvas = this.renderer.domElement;

        if (svgFan.style.display !== 'none') {
            svgFan.style.display = 'none';
            threeJsCanvas.style.display = 'block';
            this.convertSvgToThreeJs(svgFan);
        } else {
            svgFan.style.display = 'block';
            threeJsCanvas.style.display = 'none';
        }
    };

    destroy = () => {
        if (!this.isInitialized) return;

        window.removeEventListener('resize', this.handleResize);

        if (this.controls) {
            this.controls.dispose();
        }

        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.domElement.remove();
        }

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.controls = null;
        this.woodMaterial = null;
        this.fanGroup = null;
        this.isInitialized = false;
    };
}

const threeDPreviewStore = new ThreeDPreviewStore();
export default threeDPreviewStore;