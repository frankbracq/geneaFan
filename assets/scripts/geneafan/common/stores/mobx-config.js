import { configure, comparer, computed, makeAutoObservable, makeObservable, runInAction, autorun, reaction, action, observable, toJS } from 'mobx';

configure({
    enforceActions: 'never'
});

export {
    makeAutoObservable,
    makeObservable,
    runInAction,
    autorun,
    reaction,
    toJS,
    action,
    computed,
    comparer,
    observable
};