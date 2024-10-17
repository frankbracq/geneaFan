import { getAscendantEvents } from "./stores/state.js";
import { groupEvents } from "./utils.js";
import '../vendor/horizontalTimeline.js';
import 'bootstrap-icons/font/bootstrap-icons.css';

// Fonction pour convertir les événements en format HTML nécessaire pour horizontalTimeline
function generateTimelineEvents(groupedEvents) {
    let eventsContentHTML = '<div class="events-content"><ol>';

    const eventTypes = [
        { 
            type: 'birth', 
            title: 'Naissances', 
            format: event => formatEvent(event, 'birth') 
        },
        { 
            type: 'death', 
            title: 'Décès', 
            format: event => formatEvent(event, 'death') 
        },
        { 
            type: 'marriage', 
            title: 'Mariages', 
            format: event => formatEvent(event, 'marriage') 
        }
    ];

    for (const period in groupedEvents) {
        eventsContentHTML += `<li class="box" data-horizontal-timeline='{"date": "${period}"}'>`;

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

function getAncestorBranchAndGeneration(sosaNumber) {
    const binaryRep = sosaNumber.toString(2);
    const generation = binaryRep.length - 1;
    const firstBit = binaryRep[1]; // Le premier bit après l'initial

    return {
        branch: firstBit === '0' ? 'paternel' : 'maternel',
        generation: generation
    };
}

function formatEvent(event, eventType) {
    if (event.sosa) {
        const ancestorInfo = getAncestorBranchAndGeneration(event.sosa);
        const color = ancestorInfo.branch === 'paternel' ? 'darkblue' : 'deeppink';
        return `${event.name} (${event.date}) à ${event.town} <span style="color: ${color}">(+ ${ancestorInfo.generation} générations ascendantes)</span>`;
    } else {
        return eventType === 'birth'
            ? `${event.name} (${event.date}) à ${event.town}`
            : eventType === 'death'
            ? `${event.name} (${event.date}) à l'âge de ${event.age} ans à ${event.town}`
            : `${event.name} (${event.date}) avec ${event.spouse} à ${event.town}`;
    }
}

export function initializeAscendantTimeline() {

    // Retrieve the events
    const collectedEvents = getAscendantEvents();

    // Group the events
    const groupedEvents = groupEvents(collectedEvents, 5); // Group events by quinquennat

    // Generate the timeline HTML
    const timelineHTML = generateTimelineEvents(groupedEvents);

    // Insert the timeline HTML into the div
    const ascendantsTimelineDiv = document.getElementById("ascendantTimeline");
    ascendantsTimelineDiv.innerHTML = timelineHTML;

    var horizontalTimelineSettings = {
        iconClass: {
            "base": "bi bi-3x",
            "scrollLeft": "bi-chevron-double-left",
            "scrollRight": "bi-chevron-double-right",
            "prev": "bi-chevron-left",
            "next": "bi-chevron-right",
            "pause": "bi-pause-circle",
            "play": "bi-play-circle"
        },
        dateIntervals: {
            desktop: 150,
            tablet: 150,
            mobile: 100,
            minimal: true
        },
        dateDisplay: "year",
        useFontAwesomeIcons: false 
    };
    // Initialize the timeline
    $('#ascendantTimeline').horizontalTimeline(horizontalTimelineSettings);
}
