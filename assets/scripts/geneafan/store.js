import { makeAutoObservable } from "mobx";

class ConfigStore {
  config = {
      root: null,
      rootPersonName: "",
      maxGenerations: 8,
      angle: Math.PI,
      dates: {
          showYearsOnly: true,
          showInvalidDates: false,
      },
      places: {
          showPlaces: true,
          showReducedPlaces: true,
      },
      showMarriages: true,
      showMissing: true,
      givenThenFamilyName: true,
      showFirstNameOnly: false,
      substituteEvents: false,
      invertTextArc: false,
      isTimeVisualisationEnabled: false,
      title: "",
      titleSize: 1.0,
      titleMargin: 0.25,
      weights: {
          generations: [1.0, 1.0, 1.7, 1.4],
          strokes: 0.02,
      },
      contemporary: {
          showEvents: true,
          showNames: true,
          trulyAll: false,
          generations: 1,
      },
      fanDimensions: undefined,
      frameDimensions: undefined,
      computeChildrenCount: false,
      filename: "",
      coloringOption: "childrencount",
  };

  constructor() {
      makeAutoObservable(this);
  }

  setConfig(newConfig) {
    // console.log("Updating config with new values:", newConfig);
    this.config = { ...this.config, ...newConfig };
    // console.log("Updated config:", this.config);
}

get getConfig() {
    // console.log("Accessing config:", this.config);
    return this.config;
}
}

const configStore = new ConfigStore();
export default configStore;