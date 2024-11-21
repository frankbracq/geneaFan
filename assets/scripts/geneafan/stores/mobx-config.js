import { configure, comparer, computed, makeAutoObservable, makeObservable, runInAction, autorun, reaction, action, observable } from 'mobx';

configure({
    enforceActions: 'never'
});

export {
    makeAutoObservable,
    makeObservable,
    runInAction,
    autorun,
    reaction,
    action,
    computed,
    comparer,
    observable
};