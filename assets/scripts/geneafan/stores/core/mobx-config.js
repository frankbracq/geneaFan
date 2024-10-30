import { configure, makeAutoObservable, runInAction, autorun, reaction } from 'mobx';

configure({
    enforceActions: 'never'
});

export {
    makeAutoObservable,
    runInAction,
    autorun,
    reaction
};