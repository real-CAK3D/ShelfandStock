// What's in season (so usually cheaper and tastier), by month. Local picks follow New England harvests;
// citrus follows the US winter crop from Florida and California. Months are 1–12.

const LOCAL = {
  apples: [8, 9, 10, 11], strawberries: [6, 7], blueberries: [7, 8], corn: [7, 8, 9], tomatoes: [7, 8, 9],
  zucchini: [7, 8, 9], cucumbers: [7, 8, 9], 'bell-peppers': [8, 9], potatoes: [8, 9, 10, 11, 12, 1, 2],
  'sweet-potatoes': [9, 10, 11], onions: [8, 9, 10, 11, 12, 1], carrots: [7, 8, 9, 10, 11], lettuce: [5, 6, 7, 8, 9, 10],
  spinach: [5, 6, 9, 10], broccoli: [6, 7, 8, 9, 10], cauliflower: [8, 9, 10], pumpkin: [9, 10, 11], cranberries: [9, 10, 11, 12],
  watermelon: [7, 8, 9], grapes: [9, 10], 'green-onions': [5, 6, 7, 8, 9], basil: [7, 8, 9], celery: [8, 9, 10], garlic: [7, 8, 9, 10],
  'jalapenos': [8, 9], mushrooms: [9, 10, 11],
};
const CITRUS = { oranges: [12, 1, 2, 3, 4], lemons: [12, 1, 2, 3, 4], limes: [12, 1, 2, 3], avocados: [4, 5, 6, 7, 8], pineapple: [3, 4, 5, 6] };

export function inSeason(date = new Date()) {
  const m = date.getMonth() + 1;
  return [...Object.entries(LOCAL), ...Object.entries(CITRUS)].filter(([, ms]) => ms.includes(m)).map(([id]) => id);
}
