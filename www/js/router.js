// Late-bound cross-module actions so views/sheets can call each other without import cycles.
export const actions = {
  go: (_view, _params) => { },
  openRecipe: _id => { },
  openItem: _id => { },
  openZone: (_zoneId, _opts) => { },
  addItem: _opts => { },
  openEvent: (_id, _opts) => { },
  revealItem: _id => { },
};
export const register = obj => Object.assign(actions, obj);
