import { makeAutoObservable, action, computed, reaction, runInAction } from '../../common/stores/mobx-config.js';
import timelineEventsStore from './timelineEventsStore.js';
import $ from 'jquery';
import rootPersonStore from '../../common/stores/rootPersonStore.js';
import overlayManager from '../../utils/OverlayManager.js';

/**
 * Store responsible for managing the timeline visualization.
 * Automatically synchronizes with root person changes and manages the horizontal timeline display.
 */

class TimelineStore {
    // State management
    status = 'idle'; // 'idle' | 'loading' | 'success' | 'error'
    errorMessage = null;
    horizontalTimelineInstance = null;

    constructor() {
        makeAutoObservable(this, {
            initializeTimeline: action,
            setStatus: action,
            clearTimeline: action,
            updateTimelineForRoot: action,

            // Computed
            currentTimelineHTML: computed,
            isLoading: computed,
            hasError: computed,

            // Non-observables
            horizontalTimelineInstance: false,
        });

        // Réagir aux changements de root
        this.rootReactionDisposer = reaction(
            () => rootPersonStore.root,
            async (newRoot) => {
                console.log("🔄 Reaction root déclenchée", newRoot);
                if (newRoot) {
                    await this.updateTimelineForRoot();
                } else {
                    this.clearTimeline();
                }
            },
            {
                name: 'TimelineStore-RootChangeReaction'
            }
        );
    }

    // Computed properties
    get isLoading() {
        return this.status === 'loading';
    }

    get hasError() {
        return this.status === 'error';
    }

    get currentTimelineHTML() {
        return this.generateTimelineEvents();
    }

    // Actions
    setStatus(newStatus, error = null) {
        console.log(`🔄 Changement de status: ${this.status} -> ${newStatus}`);
        this.status = newStatus;
        this.errorMessage = error;
    }

    generateTimelineEvents() {
        if (!timelineEventsStore.hasEvents) return '';

        let eventsContentHTML = '<div class="events-content" id="timeline-events-content"><ol>';

        const eventTypes = [
            {
                type: 'birth',
                title: 'Naissances',
                format: event => timelineEventsStore.formatEvent(event, 'birth')
            },
            {
                type: 'death',
                title: 'Décès',
                format: event => timelineEventsStore.formatEvent(event, 'death')
            },
            {
                type: 'marriage',
                title: 'Mariages',
                format: event => timelineEventsStore.formatEvent(event, 'marriage')
            }
        ];

        const groupedEvents = timelineEventsStore.getGroupedEvents();
        for (const period in groupedEvents) {
            eventsContentHTML += `<li class="box" id="timeline-event-${period.replace(/\//g, '-')}" data-horizontal-timeline='{"date": "${period}"}'>`;

            eventTypes.forEach(({ type, title, format }) => {
                const events = groupedEvents[period][type] || [];
                if (events.length > 0) {
                    eventsContentHTML += `<h4>${title}</h4><ul class="text-start">`;
                    events.forEach(event => {
                        eventsContentHTML += `<li>${format(event)}</li>`;
                    });
                    eventsContentHTML += '</ul>';
                }
            });

            eventsContentHTML += '</li>';
        }

        eventsContentHTML += '</ol></div>';
        return eventsContentHTML;
    }

    /**
     * Mise à jour de la timeline pour la nouvelle personne racine
     * Avec transition fluide pour éviter les flashs d'affichage
     */
    async updateTimelineForRoot() {
        console.log("🔄 Début updateTimelineForRoot");
        try {
            runInAction(() => {
                this.setStatus('loading');
            });

            console.log("📊 Nombre d'événements:", timelineEventsStore.events.length);
            console.log("📊 hasEvents:", timelineEventsStore.hasEvents);

            // Si pas d'événements, rien à faire
            if (!timelineEventsStore.hasEvents) {
                this.setStatus('success');
                return;
            }

            // Récupérer l'élément parent qui contient la timeline
            const timelineTab = document.getElementById("tab4");
            if (!timelineTab) {
                throw new Error('Timeline tab not found');
            }

            // Utiliser l'OverlayManager pour afficher un overlay de chargement
            overlayManager.show("tab4", {
                message: "Mise à jour de la chronologie...",
                customClass: "timeline-overlay"
            });

            // Créer un conteneur temporaire invisible pour préparer la nouvelle timeline
            const tempContainer = document.createElement('div');
            tempContainer.id = "temp-timeline-container";
            tempContainer.style.position = "absolute";
            tempContainer.style.visibility = "hidden";
            tempContainer.style.pointerEvents = "none";
            document.body.appendChild(tempContainer);

            // Générer le HTML pour le temporaire
            const html = this.currentTimelineHTML;
            console.log("📝 HTML généré, longueur:", html.length);
            tempContainer.innerHTML = html;

            // Nettoyage radical de l'ancien conteneur
            let timelineContainer = document.getElementById("ascendantTimeline");
            if (timelineContainer) {
                // Détruire l'instance jQuery
                this.cleanupTimelineInstance();
            }

            // Attendre que le DOM soit mis à jour et tous les assets chargés
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Maintenant préparer la nouvelle timeline
            if (timelineContainer) {
                // Supprimer l'ancien conteneur
                timelineContainer.remove();
            }
            
            // Créer un nouveau conteneur avec le même ID
            timelineContainer = document.createElement('div');
            timelineContainer.id = "ascendantTimeline";
            timelineContainer.className = "horizontal-timeline";
            timelineContainer.style.opacity = "0";
            timelineContainer.style.transition = "opacity 0.3s ease-in";
            
            // S'assurer que le conteneur sera visible
            timelineContainer.style.display = "block";
            timelineContainer.style.visibility = "visible";
            timelineContainer.style.height = "auto";
            
            // Ajouter le conteneur au DOM
            timelineTab.appendChild(timelineContainer);
            
            // Attendre que le DOM soit mis à jour
            await new Promise(resolve => requestAnimationFrame(resolve));
            
            // Copier le contenu du conteneur temporaire vers le nouveau conteneur
            timelineContainer.innerHTML = tempContainer.innerHTML;
            
            // Supprimer le conteneur temporaire
            tempContainer.remove();
            
            // Forcer un reflow
            void timelineContainer.offsetHeight;
            
            // Initialiser la timeline
            await this.initializeHorizontalTimeline();
            
            // Afficher progressivement la timeline une fois initialisée
            timelineContainer.style.opacity = "1";
            
            // Masquer l'overlay de chargement avec l'OverlayManager
            overlayManager.hide("tab4");
            
            // Mettre à jour le statut
            this.setStatus('success');
            
        } catch (error) {
            console.error("❌ Erreur dans updateTimelineForRoot:", error);
            runInAction(() => {
                this.setStatus('error', error.message);
            });
            
            // Nettoyer en cas d'erreur
            const tempContainer = document.getElementById("temp-timeline-container");
            if (tempContainer) tempContainer.remove();
            
            // Masquer l'overlay en cas d'erreur également
            overlayManager.hide("tab4");
        }
    }

    /**
     * Initialisation de la timeline horizontale 
     */
    async initializeHorizontalTimeline() {
        try {
            if (!window.jQuery) {
                window.$ = $;
                window.jQuery = $;
            }

            // Importer le script de la timeline
            await import('./horizontalTimeline.js');
            
            // Attendre que le DOM soit stabilisé
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Vérifier que l'élément existe et est visible
            const timelineElement = document.getElementById("ascendantTimeline");
            if (!timelineElement) {
                throw new Error("Timeline element not found");
            }
            
            // Vérifier que l'élément a des dimensions
            const rect = timelineElement.getBoundingClientRect();
            console.log("📏 Dimensions de la timeline:", rect.width, "x", rect.height);
            
            // Si les dimensions sont nulles, forcer des dimensions minimales
            if (rect.width === 0 || rect.height === 0) {
                console.warn("⚠️ Timeline sans dimensions, application de dimensions minimales");
                timelineElement.style.width = "100%";
                timelineElement.style.minHeight = "200px";
                // Forcer un reflow
                void timelineElement.offsetHeight;
            }
            
            // Initialiser avec les options
            const $timelineElement = $(timelineElement);
            this.horizontalTimelineInstance = $timelineElement.horizontalTimeline({
                dateIntervals: {
                    "desktop": 175,
                    "tablet": 150,
                    "mobile": 120,
                    "minimal": true
                },
                iconClass: {
                    "base": "fas fa-2x",
                    "scrollLeft": "fa-chevron-circle-left",
                    "scrollRight": "fa-chevron-circle-right",
                    "prev": "fa-arrow-circle-left",
                    "next": "fa-arrow-circle-right",
                    "pause": "fa-pause-circle",
                    "play": "fa-play-circle"
                },
                "exit": {
                    "left": "exit-left",
                    "right": "exit-right"
                },
                contentContainerSelector: false
            });
            
            // Attendre un court instant pour s'assurer que la timeline est complètement initialisée
            await new Promise(resolve => setTimeout(resolve, 50));
            
            // Forcer un rafraîchissement après initialisation
            if (this.horizontalTimelineInstance && 
                typeof this.horizontalTimelineInstance.refresh === 'function') {
                this.horizontalTimelineInstance.refresh();
            }
            
            console.log("✅ Timeline horizontale initialisée");
            
        } catch (error) {
            console.error('Failed to initialize horizontal timeline:', error);
            throw error;
        }
    }

    /**
     * Nettoyage de l'instance jQuery et des événements
     */
    cleanupTimelineInstance() {
        try {
            // Nettoyage de l'instance jQuery
            if (this.horizontalTimelineInstance) {
                if (typeof this.horizontalTimelineInstance.destroy === 'function') {
                    this.horizontalTimelineInstance.destroy();
                }
                this.horizontalTimelineInstance = null;
            }

            // Nettoyage des événements globaux qui pourraient être liés à la timeline
            const timelineId = "ascendantTimeline";
            $(window).off(`.${timelineId}`);
            $(document).off(`.${timelineId}`);

            // Supprimer les gestionnaires d'événements sur tous les éléments de la timeline
            $(`#${timelineId}, #${timelineId} *`).off();

        } catch (e) {
            console.warn("⚠️ Erreur pendant le nettoyage de la timeline:", e);
        }
    }

    /**
     * Cette méthode n'est plus utilisée directement, mais conservée pour compatibilité
     */
    clearTimeline() {
        this.cleanupTimelineInstance();

        runInAction(() => {
            this.setStatus('idle');
        });

        const timelineElement = document.getElementById("ascendantTimeline");
        if (timelineElement) {
            timelineElement.innerHTML = '';
        }

        console.log("🧹 Timeline complètement nettoyée");
    }

    dispose() {
        if (this.rootReactionDisposer) {
            this.rootReactionDisposer();
        }
        this.clearTimeline();
    }
}

const timelineStore = new TimelineStore();
export default timelineStore;