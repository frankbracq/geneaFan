// assets/scripts/geneafan/stores/mobx-config.js
import { configure, comparer, computed, makeAutoObservable, runInAction, autorun, reaction, action } from 'mobx';

configure({
    enforceActions: 'never'
});

export {
    makeAutoObservable,
    runInAction,
    autorun,
    reaction,
    action,
    computed,
    comparer
};