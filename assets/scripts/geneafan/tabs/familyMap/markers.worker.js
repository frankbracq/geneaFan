console.log("markers worker loaded and running.");
self.addEventListener('message', function(e) {
    const towns = e.data.towns;
    console.log("Received message from main thread: ", e.data);
    const markers = {};

    try {
        Object.entries(towns).forEach(([townKey, town]) => {
            if (town.latitude && town.longitude) {
                const latitude = parseFloat(town.latitude);
                const longitude = parseFloat(town.longitude);
                
                if (!isNaN(latitude) && !isNaN(longitude)) {
                    markers[townKey] = {
                        position: { lat: latitude, lng: longitude },
                        title: town.display || town.town || 'Unknown'
                    };
                } else {
                    throw new Error(`Invalid latitude or longitude for town ${townKey}`);
                }
            } else {
                throw new Error(`Missing latitude or longitude for town ${townKey}`);
            }
        });
    } catch (error) {
        console.error('Error processing towns:', error.message);
        self.postMessage({ error: error.message });
        return;
    }

    console.log('Worker sending markers:', markers); 
    self.postMessage({ markersData: markers });
});
