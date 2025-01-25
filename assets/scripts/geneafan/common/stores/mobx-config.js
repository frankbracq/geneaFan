import { configure, comparer, computed, makeAutoObservable, makeObservable, runInAction, autorun, reaction, action, observable, toJS, isObservable } from 'mobx';

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
    isObservable,
    action,
    computed,
    comparer,
    observable,
};