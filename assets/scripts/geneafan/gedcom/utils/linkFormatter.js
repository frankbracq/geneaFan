/**
 * Creates an HTML link for a person with a data attribute for the person ID
 * @param {string} id - The person's ID
 * @param {string} name - The person's display name
 * @returns {string} HTML string containing the link
 */
export function formatPersonLink(id, name) {
    return `<a href="#"><span class="person-link" data-person-id="${id}">${name}</span></a>`;
}

/**
 * Creates an HTML link for a city/town with a data attribute for the town key
 * @param {string} key - The town's key
 * @param {string} name - The town's display name
 * @returns {string} HTML string containing the link
 */
export function formatCityLink(key, name) {
    return `<a href="#"><span class="city-link" data-town-key="${key}">${name}</span></a>`;
}