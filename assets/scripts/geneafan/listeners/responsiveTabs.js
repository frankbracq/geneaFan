// Function to calculate the total width of all given items (tabs)
const calculateItemWidth = (items) => 
    items.reduce((acc, item) => acc + item.getBoundingClientRect().width, 0); 
    // Uses reduce to sum up the width of each item

// Main function to adjust the tab layout based on screen size
export function setupResponsiveTabs() {
    const tabContainer = document.getElementById('tab-container'); // The main container for the tabs
    const moreDrawer = document.getElementById('more-drawer'); // The hidden "More" drawer for overflow tabs
    const moreTabBtn = document.getElementById('more-tab-btn'); // The button to toggle the "More" drawer
    const innerContainer = tabContainer.children[0]; // Inner container that holds visible tabs
    const innerTabsItems = [...tabContainer.querySelectorAll('li')]; // Array of all currently visible tab items
    const drawerTabsItems = [...moreDrawer.querySelectorAll('li')]; // Array of all items in the "More" drawer
    const totalWidth = calculateItemWidth(innerTabsItems); // Total width of visible tab items
    const containerWidth = tabContainer.getBoundingClientRect().width; // Width of the tab container

    // Check if the total width of tabs exceeds the container's width
    if (totalWidth > containerWidth) {
        // Move tabs from the visible area to the "More" drawer until they fit
        while (calculateItemWidth(innerTabsItems) > tabContainer.getBoundingClientRect().width) {
            const lastItem = innerTabsItems.pop(); // Remove the last visible tab
            moreDrawer.prepend(lastItem); // Add it to the beginning of the "More" drawer
        }

        moreTabBtn.style.visibility = 'visible'; // Show the "More" button
        return; // Exit the function as the overflow handling is complete
    }

    const distance = tabContainer.offsetWidth - innerContainer.offsetWidth; // Remaining space in the container

    // If there are items in the "More" drawer
    if (drawerTabsItems.length) {
        let firstElementWidth = drawerTabsItems[0].getBoundingClientRect().width; // Width of the first hidden tab
        let isNextStep = distance > firstElementWidth; // Check if there's enough space to move it back
        if (!isNextStep) return; // Exit if there's not enough space

        // Move items from the "More" drawer back to the visible area until space runs out
        while (isNextStep) {
            const firstItem = drawerTabsItems.shift(); // Remove the first hidden tab
            innerContainer.appendChild(firstItem); // Add it to the visible area
            innerTabsItems.push(firstItem); // Track it in the visible tabs array
            firstElementWidth = firstItem.getBoundingClientRect().width; // Update the width of the new first hidden tab
            isNextStep = (tabContainer.offsetWidth - innerContainer.offsetWidth > firstElementWidth) && drawerTabsItems.length; 
            // Repeat if there's still space and items left in the drawer
        }

        // If the "More" drawer is empty, hide the "More" button and drawer
        if (!drawerTabsItems.length) {
            moreTabBtn.style.visibility = 'hidden';
            moreDrawer.style.visibility = 'hidden';
        }
    }
}

// Function to detect and handle clicks outside specific elements (used to hide the "More" drawer when clicking outside)
function clickOutsideListener(elements, callback) {
    function handleClickOutside(event) {
        event.stopPropagation(); // Stop the event from propagating further
        if (!elements.some(element => element.contains(event.target))) callback(); // If click is outside, trigger callback
    }

    document.addEventListener('click', handleClickOutside); // Listen for clicks on the document

    return () => {
        document.removeEventListener('click', handleClickOutside); // Remove listener when no longer needed
    };
}

// Function to handle tab resize and toggle the "More" drawer visibility
export function setupTabResizeListener() {
    const moreTabBtn = document.getElementById('more-tab-btn'); // Button to toggle the "More" drawer
    const moreDrawer = document.getElementById('more-drawer'); // The hidden "More" drawer

    // Set up click listener to hide the "More" drawer when clicking outside of it
    clickOutsideListener([moreDrawer, moreTabBtn], () => {
        moreDrawer.style.visibility = 'hidden'; // Hide the drawer
    });

    // Toggle the visibility of the "More" drawer on button click
    moreTabBtn.addEventListener('click', () => {
        const visibility = window.getComputedStyle(moreDrawer).visibility; // Check current visibility
        moreDrawer.style.visibility = visibility === 'hidden' ? 'visible' : 'hidden'; // Toggle visibility
    });

    // Listen for window resize events and re-adjust the tab layout
    window.addEventListener('resize', setupResponsiveTabs);
}