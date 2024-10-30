// stores/index.js
export {
    makeAutoObservable,
    runInAction,
    autorun,
    reaction
} from './core/mobx-config';

import rootStore, {
    viewStore,
    dataStore,
    fanConfigStore,
    authStore,
    configurationStore,
    shareFormStore
} from './core/RootStore';

export {
    rootStore as default,
    viewStore,
    dataStore,
    fanConfigStore,
    authStore,
    configurationStore,
    shareFormStore
};