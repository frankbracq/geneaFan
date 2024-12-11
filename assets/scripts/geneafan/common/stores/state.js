import _ from 'lodash';
import timelineEventsStore from '../../tabs/timeline/timelineEventsStore.js';
import familyTreeDataStore from '../../tabs/familyTree/familyTreeDataStore.js';
import familyTownsStore from '../../gedcom/familyTownsStore.js';
import statisticsStore from '../../tabs/statistics/statisticsStore.js';

/**
 * Resets all states from different stores
 */
export const clearAllStates = () => {
    familyTreeDataStore.clearGenealogyGraph();
    timelineEventsStore.clearEvents();
    familyTownsStore.setTownsData({});
    statisticsStore.resetStatistics();
};
