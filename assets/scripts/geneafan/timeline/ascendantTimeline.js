import { getAscendantEvents } from "../stores/state.js";
import { groupEvents } from "../utils/utils.js";

// Function to generate HTML format required by horizontalTimeline from grouped events
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

    // Loop through each period and generate the event content
    for (const period in groupedEvents) {
        eventsContentHTML += `<li class="box" data-horizontal-timeline='{"date": "${period}"}'>`;

        // Generate content for each type of event
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

// Function to calculate the ancestor's branch (paternal/maternal) and generation based on Sosa number
function getAncestorBranchAndGeneration(sosaNumber) {
    const binaryRep = sosaNumber.toString(2);
    const generation = binaryRep.length - 1;
    const firstBit = binaryRep[1]; // The first bit after the initial

    return {
        branch: firstBit === '0' ? 'paternal' : 'maternal',
        generation: generation
    };
}

// Function to format event details for display in the timeline
function formatEvent(event, eventType) {
    if (event.sosa) {
        const ancestorInfo = getAncestorBranchAndGeneration(event.sosa);
        const color = ancestorInfo.branch === 'paternal' ? 'darkblue' : 'deeppink';
        return `${event.name} (${event.date}) at ${event.town} <span style="color: ${color}">(+ ${ancestorInfo.generation} generations up)</span>`;
    } else {
        return eventType === 'birth'
            ? `${event.name} (${event.date}) at ${event.town}`
            : eventType === 'death'
            ? `${event.name} (${event.date}) at the age of ${event.age} at ${event.town}`
            : `${event.name} (${event.date}) with ${event.spouse} at ${event.town}`;
    }
}

// Function to initialize the ascendant timeline with events and settings
export async function initializeAscendantTimeline() {

    // Dynamically load jQuery module
    const jQueryModule = await import('jquery');
    const $ = jQueryModule.default; // Explicitly assign jQuery as "$"
    window.$ = $;  // Ensure jQuery is globally accessible
    window.jQuery = $; // Ensure jQuery is globally accessible

    // Dynamically load horizontalTimeline after jQuery is available
    await import('./horizontalTimeline.js');

    // Retrieve events for ascendants
    const collectedEvents = getAscendantEvents();

    // Group the events into five-year periods (quinquennat)
    const groupedEvents = groupEvents(collectedEvents, 5);

    // Generate the timeline HTML content
    const timelineHTML = generateTimelineEvents(groupedEvents);

    // Insert the generated timeline HTML into the DOM
    const ascendantsTimelineDiv = document.getElementById("ascendantTimeline");
    ascendantsTimelineDiv.innerHTML = timelineHTML;

    $('#ascendantTimeline').horizontalTimeline({
        
        dateIntervals: {
        "desktop": 175,
        "tablet": 150,
        "mobile": 120,
        "minimal": true
        },
        
        iconClass: {
        "base": "fas fa-2x", // Space separated class names
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
        /* End new object options */
        contentContainerSelector: false // false, ".container" [any selector string]
        });

}