import timelineStore from '../stores/timelineStore';
import { autorun, reaction } from '../stores/mobx-config';

// Configuration de base de la timeline
const TIMELINE_CONFIG = {
    dateIntervals: {
        desktop: 175,
        tablet: 150,
        mobile: 120,
        minimal: true
    },
    iconClass: {
        base: "fas fa-2x",
        scrollLeft: "fa-chevron-circle-left",
        scrollRight: "fa-chevron-circle-right",
        prev: "fa-arrow-circle-left",
        next: "fa-arrow-circle-right",
        pause: "fa-pause-circle",
        play: "fa-play-circle"
    },
    exit: {
        left: "exit-left",
        right: "exit-right"
    },
    contentContainerSelector: false
};

let disposers = [];

/**
 * Initialise la timeline des ascendants
 */
export async function initializeAscendantTimeline() {
    try {
        // Nettoyage des anciennes réactions
        cleanupReactions();

        // Initialisation de la timeline
        await timelineStore.initializeTimeline();

        // Réaction aux changements d'événements
        disposers.push(
            reaction(
                // Track changes to parsedEvents and hasEvents
                () => ({
                    events: timelineStore.parsedEvents,
                    hasEvents: timelineStore.hasEvents
                }),
                ({ events, hasEvents }, previousValue) => {
                    const container = document.getElementById("ascendantTimeline");
                    if (!container) return;

                    // Si on passe d'événements à pas d'événements ou vice-versa
                    // ou si c'est la première fois
                    if (!previousValue || hasEvents !== previousValue.hasEvents) {
                        handleTimelineReset(container);
                    }
                    // Si on a juste un changement dans les événements
                    else if (events.length !== previousValue.events.length) {
                        handleEventsUpdate(container);
                    }
                },
                {
                    name: 'Timeline Events Reaction',
                    fireImmediately: true
                }
            )
        );

        // Réaction aux changements de taille de période
        disposers.push(
            reaction(
                () => timelineStore.periodSize,
                (newSize) => {
                    const container = document.getElementById("ascendantTimeline");
                    if (container && timelineStore.isInitialized) {
                        handlePeriodSizeChange(container, newSize);
                    }
                },
                {
                    name: 'Timeline Period Size Reaction'
                }
            )
        );

    } catch (error) {
        console.error('Failed to initialize timeline:', error);
        cleanupReactions();
        throw error;
    }
}

/**
 * Gère la réinitialisation complète de la timeline
 */
function handleTimelineReset(container) {
    if (timelineStore.timelineInstance?.destroy) {
        timelineStore.timelineInstance.destroy();
    }
    container.innerHTML = timelineStore.timelineEventsHTML;
    initializeHorizontalTimeline(container);
}

/**
 * Gère la mise à jour des événements
 */
function handleEventsUpdate(container) {
    const shouldReinitialize = container.querySelectorAll('.events-content li').length !== 
        timelineStore.parsedEvents.length;

    if (shouldReinitialize) {
        handleTimelineReset(container);
    } else {
        container.querySelector('.events-content').innerHTML = 
            timelineStore.timelineEventsHTML;
    }
}

/**
 * Gère le changement de taille de période
 */
function handlePeriodSizeChange(container, newSize) {
    handleTimelineReset(container);
}

/**
 * Initialise la timeline horizontale avec jQuery
 */
function initializeHorizontalTimeline(container) {
    const $ = window.jQuery;
    if (!$ || !container) return;

    const config = {
        ...TIMELINE_CONFIG,
        onEventChanged: (event, prevEvent) => {
            // Event handler pour les changements d'événements
            console.log('Event changed:', { current: event, previous: prevEvent });
        },
        onInit: () => {
            // Event handler pour l'initialisation
            console.log('Timeline initialized');
        }
    };

    timelineStore.timelineInstance = $(container).horizontalTimeline(config);
}

/**
 * Nettoie toutes les réactions
 */
function cleanupReactions() {
    disposers.forEach(dispose => dispose());
    disposers = [];
}

/**
 * Détruit la timeline
 */
export function destroyAscendantTimeline() {
    cleanupReactions();
    timelineStore.destroyTimeline();
}

/**
 * Met à jour la taille de la période
 */
export function updateTimelinePeriodSize(newSize) {
    if (typeof newSize !== 'number' || newSize <= 0) {
        console.warn('Invalid period size:', newSize);
        return;
    }
    timelineStore.setPeriodSize(newSize);
}