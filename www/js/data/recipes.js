// Built-in recipe book. Ingredients: [qty, unit, name, note?, optional?]
// Names resolve against the food catalog (matchFood) so they can be checked against stock.

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Side', 'Dessert', 'Snack', 'Drink'];

const R = [
  {
    title: 'Classic Roast Turkey', emoji: '🦃', type: 'Dinner', cuisine: 'American', time: 240, servings: 12,
    tags: ['thanksgiving', 'christmas', 'holiday', 'gathering'],
    ing: [[14, 'lb', 'Whole Turkey'], [1, 'cup', 'Butter', 'softened'], [1, 'ea', 'Onions', 'quartered'], [1, 'ea', 'Lemons', 'halved'], [4, 'clove', 'Garlic'], [2, 'tbsp', 'Thyme'], [1, 'tbsp', 'Sage'], [1, 'tbsp', 'Salt'], [2, 'tsp', 'Black Pepper'], [2, 'cup', 'Chicken Broth']],
    steps: ['Thaw the turkey in the fridge — allow about 1 day per 4–5 lb.', 'Heat oven to 325°F. Pat the turkey dry and set it breast-up on a rack in a roasting pan.', 'Mix the butter with thyme, sage, salt and pepper. Rub it under and over the skin.', 'Stuff the cavity loosely with onion, lemon and garlic. Pour broth into the pan.', 'Roast about 13–15 minutes per pound, basting every 45 minutes, until a thermometer in the thickest part of the thigh reads 165°F.', 'Rest 30 minutes under foil before carving. Save the drippings for gravy.'],
  },
  {
    title: 'Herb Bread Stuffing', emoji: '🍞', type: 'Side', cuisine: 'American', time: 60, servings: 10,
    tags: ['thanksgiving', 'holiday'],
    ing: [[1, 'loaf', 'Bread', 'cubed and dried'], [0.5, 'cup', 'Butter'], [1, 'ea', 'Onions', 'diced'], [3, 'ea', 'Celery', 'stalks, diced'], [2, 'tsp', 'Sage'], [1, 'tsp', 'Thyme'], [2, 'cup', 'Chicken Broth'], [2, 'ea', 'Eggs'], [1, 'tsp', 'Salt']],
    steps: ['Heat oven to 350°F and butter a 9×13 dish.', 'Melt butter in a skillet and cook onion and celery until soft, about 8 minutes. Stir in herbs.', 'Toss the bread cubes with the vegetables in a large bowl.', 'Whisk broth with eggs and salt, pour over, and fold until evenly moist.', 'Bake covered 25 minutes, then uncovered 20 minutes until golden on top.'],
  },
  {
    title: 'Creamy Mashed Potatoes', emoji: '🥔', type: 'Side', cuisine: 'American', time: 35, servings: 8,
    tags: ['thanksgiving', 'christmas', 'holiday', 'comfort'],
    ing: [[4, 'lb', 'Potatoes'], [0.5, 'cup', 'Butter'], [1, 'cup', 'Milk', 'warm'], [0.5, 'cup', 'Sour Cream', '', true], [2, 'tsp', 'Salt'], [1, 'tsp', 'Black Pepper']],
    steps: ['Peel and cube the potatoes. Cover with cold salted water and bring to a boil.', 'Simmer 15–18 minutes until a fork slides in easily. Drain well.', 'Mash with butter, then stir in warm milk and sour cream.', 'Season with salt and pepper to taste.'],
  },
  {
    title: 'Green Bean Casserole', emoji: '🫛', type: 'Side', cuisine: 'American', time: 45, servings: 6,
    tags: ['thanksgiving', 'holiday'],
    ing: [[2, 'can', 'Green Beans (canned)'], [1, 'can', 'Cream of Mushroom Soup'], [0.5, 'cup', 'Milk'], [1, 'tsp', 'Soy Sauce'], [0.25, 'tsp', 'Black Pepper'], [1, 'cup', 'Fried Onions', 'crispy']],
    steps: ['Heat oven to 350°F.', 'Stir soup, milk, soy sauce and pepper together in a casserole dish.', 'Fold in drained green beans and half the crispy onions.', 'Bake 25 minutes, top with the remaining onions, and bake 5 more.'],
  },
  {
    title: 'Pumpkin Pie', emoji: '🥧', type: 'Dessert', cuisine: 'American', time: 75, servings: 8,
    tags: ['thanksgiving', 'holiday', 'baking'],
    ing: [[1, 'ea', 'Pie Crust'], [1, 'can', 'Pumpkin Purée'], [1, 'can', 'Evaporated Milk'], [2, 'ea', 'Eggs'], [0.75, 'cup', 'Granulated Sugar'], [2, 'tsp', 'Pumpkin Pie Spice'], [0.5, 'tsp', 'Salt'], [1, 'tub', 'Cool Whip', 'to serve', true]],
    steps: ['Heat oven to 425°F and fit the crust into a pie dish.', 'Whisk pumpkin, evaporated milk, eggs, sugar, spice and salt until smooth.', 'Pour into the crust. Bake 15 minutes, then lower to 350°F and bake 40–50 minutes more until a knife near the center comes out clean.', 'Cool at least 2 hours. Serve with whipped topping.'],
  },
  {
    title: 'Fresh Cranberry Sauce', emoji: '🍒', type: 'Side', cuisine: 'American', time: 15, servings: 8,
    tags: ['thanksgiving', 'christmas', 'holiday'],
    ing: [[12, 'oz', 'Cranberries'], [1, 'cup', 'Granulated Sugar'], [1, 'cup', 'Orange Juice'], [1, 'tsp', 'Oranges', 'zest', true]],
    steps: ['Bring sugar and orange juice to a boil, stirring to dissolve.', 'Add cranberries and simmer 10 minutes until most berries pop.', 'Stir in zest. It thickens as it cools — chill before serving.'],
  },
  {
    title: 'Brown Sugar Glazed Ham', emoji: '🍖', type: 'Dinner', cuisine: 'American', time: 150, servings: 12,
    tags: ['christmas', 'easter', 'holiday', 'gathering'],
    ing: [[8, 'lb', 'Ham'], [1, 'cup', 'Brown Sugar'], [0.25, 'cup', 'Honey'], [2, 'tbsp', 'Mustard'], [0.5, 'tsp', 'Cinnamon'], [0.5, 'cup', 'Pineapple', 'juice', true]],
    steps: ['Heat oven to 325°F. Set the ham cut-side down in a roasting pan and cover with foil.', 'Bake about 12 minutes per pound.', 'Simmer brown sugar, honey, mustard, cinnamon and juice 3 minutes to make a glaze.', 'Uncover, brush with glaze, and bake 20 more minutes, glazing twice more.'],
  },
  {
    title: 'Chocolate Chip Cookies', emoji: '🍪', type: 'Dessert', cuisine: 'American', time: 30, servings: 36,
    tags: ['baking', 'kids', 'christmas', 'party'],
    ing: [[2.25, 'cup', 'All-Purpose Flour'], [1, 'tsp', 'Baking Soda'], [1, 'tsp', 'Salt'], [1, 'cup', 'Butter', 'softened'], [0.75, 'cup', 'Granulated Sugar'], [0.75, 'cup', 'Brown Sugar'], [2, 'ea', 'Eggs'], [2, 'tsp', 'Vanilla Extract'], [2, 'cup', 'Chocolate Chips']],
    steps: ['Heat oven to 375°F.', 'Whisk flour, baking soda and salt.', 'Beat butter with both sugars until fluffy. Beat in eggs and vanilla.', 'Mix in the flour, then fold in the chips.', 'Drop rounded tablespoons onto a sheet and bake 9–11 minutes until edges are golden.'],
  },
  {
    title: 'Holiday Sugar Cookies', emoji: '⭐', type: 'Dessert', cuisine: 'American', time: 90, servings: 30,
    tags: ['christmas', 'holiday', 'baking', 'kids'],
    ing: [[3, 'cup', 'All-Purpose Flour'], [1, 'tsp', 'Baking Powder'], [1, 'cup', 'Butter'], [1, 'cup', 'Granulated Sugar'], [1, 'ea', 'Eggs'], [1, 'tsp', 'Vanilla Extract'], [2, 'cup', 'Powdered Sugar', 'icing'], [3, 'tbsp', 'Milk', 'icing']],
    steps: ['Cream butter and sugar, then beat in egg and vanilla.', 'Mix in flour and baking powder. Chill the dough 1 hour.', 'Roll to 1/4 inch and cut shapes with cookie cutters.', 'Bake at 350°F for 8–10 minutes. Cool completely.', 'Whisk powdered sugar and milk into icing and decorate.'],
  },
  {
    title: 'Spaghetti Bolognese', emoji: '🍝', type: 'Dinner', cuisine: 'Italian', time: 50, servings: 6,
    tags: ['weeknight', 'kids', 'comfort'],
    ing: [[1, 'lb', 'Spaghetti'], [1, 'lb', 'Ground Beef'], [1, 'ea', 'Onions'], [3, 'clove', 'Garlic'], [1, 'ea', 'Carrots', 'finely diced', true], [1, 'jar', 'Marinara Sauce'], [2, 'tbsp', 'Tomato Paste'], [1, 'tsp', 'Italian Seasoning'], [1, 'tbsp', 'Olive Oil'], [0.5, 'cup', 'Parmesan', 'to serve', true]],
    steps: ['Heat oil and cook onion, carrot and garlic 5 minutes.', 'Add beef and brown, breaking it up. Drain excess fat.', 'Stir in tomato paste, marinara and seasoning. Simmer 25 minutes.', 'Meanwhile cook spaghetti in salted water until al dente.', 'Toss pasta with sauce and top with parmesan.'],
  },
  {
    title: 'Chicken Stir-Fry', emoji: '🥢', type: 'Dinner', cuisine: 'Asian', time: 25, servings: 4,
    tags: ['weeknight', 'quick', 'healthy'],
    ing: [[1.5, 'lb', 'Chicken Breast'], [2, 'ea', 'Bell Peppers'], [1, 'head', 'Broccoli'], [3, 'clove', 'Garlic'], [1, 'tbsp', 'Ginger', 'grated'], [0.25, 'cup', 'Soy Sauce'], [1, 'tbsp', 'Honey'], [1, 'tbsp', 'Cornstarch'], [2, 'tbsp', 'Vegetable Oil'], [2, 'cup', 'White Rice', 'cooked, to serve']],
    steps: ['Slice chicken thin and toss with 1 tbsp cornstarch.', 'Whisk soy sauce, honey and 1/4 cup water.', 'Sear chicken in hot oil until cooked; set aside.', 'Stir-fry broccoli and peppers 4 minutes, add garlic and ginger for 30 seconds.', 'Return chicken, pour in sauce, and toss until glossy. Serve over rice.'],
  },
  {
    title: 'Beef Tacos', emoji: '🌮', type: 'Dinner', cuisine: 'Mexican', time: 20, servings: 4,
    tags: ['weeknight', 'quick', 'kids', 'party'],
    ing: [[1, 'lb', 'Ground Beef'], [1, 'packet', 'Taco Seasoning'], [8, 'ea', 'Tortillas'], [1, 'cup', 'Cheddar Cheese', 'shredded'], [1, 'head', 'Lettuce', 'shredded'], [2, 'ea', 'Tomatoes', 'diced'], [0.5, 'cup', 'Sour Cream', '', true], [1, 'jar', 'Salsa', '', true]],
    steps: ['Brown the beef and drain.', 'Add taco seasoning and 2/3 cup water; simmer 5 minutes.', 'Warm tortillas in a dry skillet.', 'Fill with beef and top with cheese, lettuce, tomato, sour cream and salsa.'],
  },
  {
    title: 'Black Bean Chili', emoji: '🌶️', type: 'Dinner', cuisine: 'American', time: 45, servings: 6,
    tags: ['vegetarian', 'comfort', 'gathering', 'game day'],
    ing: [[2, 'can', 'Black Beans'], [1, 'can', 'Kidney Beans'], [1, 'can', 'Diced Tomatoes'], [1, 'ea', 'Onions'], [1, 'ea', 'Bell Peppers'], [3, 'clove', 'Garlic'], [2, 'tbsp', 'Chili Powder'], [1, 'tsp', 'Cumin'], [2, 'cup', 'Chicken Broth'], [1, 'tbsp', 'Olive Oil'], [1, 'cup', 'Cheddar Cheese', 'to serve', true]],
    steps: ['Cook onion and pepper in oil 6 minutes; add garlic and spices for 1 minute.', 'Add rinsed beans, tomatoes and broth.', 'Simmer 30 minutes, mashing a few beans to thicken.', 'Serve topped with cheese.'],
  },
  {
    title: 'Fluffy Pancakes', emoji: '🥞', type: 'Breakfast', cuisine: 'American', time: 20, servings: 4,
    tags: ['breakfast', 'kids', 'weekend'],
    ing: [[1.5, 'cup', 'All-Purpose Flour'], [1, 'tbsp', 'Granulated Sugar'], [2, 'tsp', 'Baking Powder'], [0.5, 'tsp', 'Salt'], [1.25, 'cup', 'Milk'], [1, 'ea', 'Eggs'], [3, 'tbsp', 'Butter', 'melted'], [0.5, 'cup', 'Maple Syrup', 'to serve'], [1, 'cup', 'Blueberries', '', true]],
    steps: ['Whisk dry ingredients in one bowl and milk, egg and butter in another.', 'Stir wet into dry until just combined — lumps are fine.', 'Cook 1/4-cup portions on a buttered griddle over medium heat until bubbles form, then flip.', 'Serve warm with syrup and berries.'],
  },
  {
    title: 'Veggie Scrambled Eggs', emoji: '🍳', type: 'Breakfast', cuisine: 'American', time: 10, servings: 2,
    tags: ['breakfast', 'quick', 'vegetarian'],
    ing: [[4, 'ea', 'Eggs'], [2, 'tbsp', 'Milk'], [1, 'tbsp', 'Butter'], [0.5, 'ea', 'Bell Peppers', 'diced'], [1, 'cup', 'Spinach'], [0.25, 'cup', 'Cheddar Cheese'], [1, 'pinch', 'Salt']],
    steps: ['Whisk eggs, milk and salt.', 'Soften pepper in butter, add spinach until wilted.', 'Pour in eggs and stir gently over low heat until softly set.', 'Fold in cheese and serve.'],
  },
  {
    title: 'Overnight Oats', emoji: '🥣', type: 'Breakfast', cuisine: 'American', time: 5, servings: 1,
    tags: ['breakfast', 'quick', 'healthy', 'make-ahead'],
    ing: [[0.5, 'cup', 'Rolled Oats'], [0.5, 'cup', 'Milk'], [0.25, 'cup', 'Greek Yogurt'], [1, 'tbsp', 'Honey'], [0.5, 'cup', 'Blueberries', '', true]],
    steps: ['Stir oats, milk, yogurt and honey in a jar.', 'Refrigerate overnight.', 'Top with berries in the morning.'],
  },
  {
    title: 'Grilled Cheese & Tomato Soup', emoji: '🥪', type: 'Lunch', cuisine: 'American', time: 25, servings: 4,
    tags: ['lunch', 'kids', 'comfort', 'quick'],
    ing: [[8, 'ea', 'Bread', 'slices'], [8, 'oz', 'Cheddar Cheese'], [3, 'tbsp', 'Butter'], [1, 'can', 'Diced Tomatoes'], [1, 'can', 'Tomato Sauce'], [1, 'cup', 'Chicken Broth'], [0.5, 'cup', 'Heavy Cream'], [1, 'ea', 'Onions']],
    steps: ['Soften onion in 1 tbsp butter, add tomatoes, sauce and broth; simmer 15 minutes.', 'Blend smooth and stir in cream.', 'Butter bread, fill with cheese, and griddle until golden and melty.', 'Serve sandwiches with the soup for dipping.'],
  },
  {
    title: 'Chicken Caesar Wraps', emoji: '🌯', type: 'Lunch', cuisine: 'American', time: 15, servings: 4,
    tags: ['lunch', 'quick'],
    ing: [[1, 'lb', 'Chicken Breast', 'cooked'], [4, 'ea', 'Tortillas'], [1, 'head', 'Lettuce'], [0.5, 'cup', 'Parmesan'], [0.5, 'cup', 'Mayonnaise'], [1, 'ea', 'Lemons'], [1, 'clove', 'Garlic']],
    steps: ['Whisk mayo, lemon juice, grated garlic and half the parmesan into a quick dressing.', 'Toss chopped lettuce and sliced chicken with the dressing.', 'Pile onto tortillas, sprinkle remaining cheese, and roll up.'],
  },
  {
    title: 'Baked Mac & Cheese', emoji: '🧀', type: 'Side', cuisine: 'American', time: 50, servings: 8,
    tags: ['comfort', 'kids', 'holiday', 'gathering'],
    ing: [[1, 'lb', 'Elbow Macaroni'], [4, 'tbsp', 'Butter'], [0.25, 'cup', 'All-Purpose Flour'], [3, 'cup', 'Milk'], [16, 'oz', 'Cheddar Cheese'], [1, 'tsp', 'Mustard'], [1, 'tsp', 'Salt'], [0.5, 'cup', 'Breadcrumbs']],
    steps: ['Cook macaroni 2 minutes short of package time; drain.', 'Melt butter, whisk in flour 1 minute, then slowly whisk in milk and simmer until thick.', 'Off heat stir in 3/4 of the cheese, mustard and salt.', 'Fold in pasta, pour into a dish, top with remaining cheese and crumbs.', 'Bake at 375°F 25 minutes until bubbling.'],
  },
  {
    title: 'Sheet-Pan Lemon Salmon', emoji: '🐟', type: 'Dinner', cuisine: 'Mediterranean', time: 25, servings: 4,
    tags: ['healthy', 'weeknight', 'quick'],
    ing: [[1.5, 'lb', 'Salmon'], [1, 'lb', 'Broccoli'], [1, 'ea', 'Lemons'], [2, 'tbsp', 'Olive Oil'], [2, 'clove', 'Garlic'], [1, 'tsp', 'Salt'], [0.5, 'tsp', 'Black Pepper']],
    steps: ['Heat oven to 425°F.', 'Toss broccoli with half the oil, salt and pepper; roast 8 minutes.', 'Add salmon, brush with remaining oil, garlic and lemon zest, and lay lemon slices on top.', 'Roast 10–12 minutes until the salmon flakes.'],
  },
  {
    title: 'Slow-Cooker Pulled Pork', emoji: '🐖', type: 'Dinner', cuisine: 'American', time: 480, servings: 10,
    tags: ['gathering', 'game day', 'make-ahead', 'party'],
    ing: [[4, 'lb', 'Pork Shoulder'], [1, 'cup', 'BBQ Sauce'], [0.5, 'cup', 'Apple Juice'], [2, 'tbsp', 'Brown Sugar'], [1, 'tbsp', 'Paprika'], [1, 'tsp', 'Garlic Powder'], [1, 'ea', 'Onions'], [10, 'ea', 'Hamburger Buns']],
    steps: ['Rub pork with sugar, paprika and garlic powder.', 'Set on sliced onion in the slow cooker and pour juice around it.', 'Cook on low 8 hours until it shreds easily.', 'Shred, mix with BBQ sauce, and serve on buns.'],
  },
  {
    title: 'Game-Day Seven Layer Dip', emoji: '🏈', type: 'Snack', cuisine: 'Mexican', time: 15, servings: 12,
    tags: ['party', 'game day', 'gathering'],
    ing: [[1, 'can', 'Black Beans', 'refried or mashed'], [1, 'cup', 'Sour Cream'], [1, 'packet', 'Taco Seasoning'], [2, 'ea', 'Avocados'], [1, 'jar', 'Salsa'], [1, 'cup', 'Cheddar Cheese'], [2, 'ea', 'Tomatoes'], [3, 'ea', 'Green Onions'], [1, 'bag', 'Tortilla Chips']],
    steps: ['Spread mashed beans in a dish.', 'Layer sour cream mixed with taco seasoning, then mashed avocado, salsa, cheese, diced tomato and green onion.', 'Chill and serve with chips.'],
  },
  {
    title: 'Caprese Salad', emoji: '🍅', type: 'Side', cuisine: 'Italian', time: 10, servings: 4,
    tags: ['vegetarian', 'quick', 'summer'],
    ing: [[3, 'ea', 'Tomatoes'], [8, 'oz', 'Mozzarella'], [1, 'bunch', 'Basil'], [2, 'tbsp', 'Olive Oil'], [1, 'tbsp', 'Balsamic Vinegar'], [1, 'pinch', 'Salt']],
    steps: ['Slice tomatoes and mozzarella.', 'Alternate on a platter with basil leaves.', 'Drizzle with oil and balsamic; season with salt.'],
  },
  {
    title: 'Chicken Noodle Soup', emoji: '🍜', type: 'Dinner', cuisine: 'American', time: 45, servings: 6,
    tags: ['comfort', 'healthy', 'make-ahead'],
    ing: [[1, 'lb', 'Chicken Thighs'], [8, 'cup', 'Chicken Broth'], [2, 'ea', 'Carrots'], [2, 'ea', 'Celery'], [1, 'ea', 'Onions'], [2, 'clove', 'Garlic'], [8, 'oz', 'Egg Noodles'], [1, 'tsp', 'Thyme'], [1, 'ea', 'Bay Leaves'], [2, 'tbsp', 'Parsley', '', true]],
    steps: ['Simmer chicken in broth with bay leaf and thyme 20 minutes. Remove and shred.', 'Add chopped carrot, celery, onion and garlic; simmer 10 minutes.', 'Add noodles and cook until tender.', 'Return chicken, season, and finish with parsley.'],
  },
  {
    title: 'Homemade Pizza', emoji: '🍕', type: 'Dinner', cuisine: 'Italian', time: 90, servings: 4,
    tags: ['kids', 'weekend', 'party'],
    ing: [[3, 'cup', 'All-Purpose Flour'], [1, 'packet', 'Yeast'], [1, 'tsp', 'Salt'], [1, 'tsp', 'Granulated Sugar'], [2, 'tbsp', 'Olive Oil'], [1, 'cup', 'Marinara Sauce'], [8, 'oz', 'Mozzarella'], [3, 'oz', 'Pepperoni', '', true]],
    steps: ['Dissolve yeast and sugar in 1 cup warm water for 5 minutes.', 'Mix in flour, salt and oil; knead 5 minutes. Let rise 1 hour.', 'Heat oven to 475°F. Stretch dough onto an oiled pan.', 'Top with sauce, cheese and pepperoni. Bake 12–15 minutes.'],
  },
  {
    title: 'Banana Bread', emoji: '🍌', type: 'Dessert', cuisine: 'American', time: 70, servings: 10,
    tags: ['baking', 'use it up', 'breakfast'],
    ing: [[3, 'ea', 'Bananas', 'very ripe'], [0.33, 'cup', 'Butter', 'melted'], [0.75, 'cup', 'Brown Sugar'], [1, 'ea', 'Eggs'], [1, 'tsp', 'Vanilla Extract'], [1, 'tsp', 'Baking Soda'], [1.5, 'cup', 'All-Purpose Flour'], [0.5, 'tsp', 'Cinnamon'], [0.5, 'cup', 'Pecans', '', true]],
    steps: ['Heat oven to 350°F and grease a loaf pan.', 'Mash bananas and stir in butter, sugar, egg and vanilla.', 'Stir in baking soda, cinnamon and flour until just combined; fold in nuts.', 'Bake 55–65 minutes until a toothpick comes out clean.'],
  },
  {
    title: 'Garden Salad', emoji: '🥗', type: 'Side', cuisine: 'American', time: 10, servings: 4,
    tags: ['healthy', 'quick', 'vegetarian'],
    ing: [[1, 'head', 'Lettuce'], [1, 'ea', 'Cucumbers'], [2, 'ea', 'Tomatoes'], [1, 'ea', 'Carrots'], [0.5, 'ea', 'Onions', 'red, thinly sliced'], [0.5, 'cup', 'Ranch Dressing']],
    steps: ['Chop lettuce and slice the vegetables.', 'Toss together and dress just before serving.'],
  },
  {
    title: 'Fried Rice', emoji: '🍚', type: 'Dinner', cuisine: 'Asian', time: 20, servings: 4,
    tags: ['use it up', 'quick', 'weeknight'],
    ing: [[3, 'cup', 'White Rice', 'cooked, day-old'], [2, 'ea', 'Eggs'], [1, 'cup', 'Frozen Peas'], [1, 'ea', 'Carrots'], [3, 'ea', 'Green Onions'], [3, 'tbsp', 'Soy Sauce'], [2, 'tbsp', 'Vegetable Oil'], [2, 'clove', 'Garlic'], [1, 'cup', 'Leftovers', 'chopped meat', true]],
    steps: ['Scramble eggs in a hot oiled pan; set aside.', 'Stir-fry carrot, garlic and peas 3 minutes.', 'Add rice and press it against the pan to crisp.', 'Add soy sauce, eggs, leftovers and green onions; toss.'],
  },
  {
    title: 'Lasagna', emoji: '🫕', type: 'Dinner', cuisine: 'Italian', time: 100, servings: 10,
    tags: ['gathering', 'make-ahead', 'comfort', 'holiday'],
    ing: [[12, 'ea', 'Lasagna Noodles'], [1, 'lb', 'Sausage'], [2, 'jar', 'Marinara Sauce'], [15, 'oz', 'Cottage Cheese', 'or ricotta'], [16, 'oz', 'Mozzarella'], [0.5, 'cup', 'Parmesan'], [1, 'ea', 'Eggs'], [1, 'tsp', 'Italian Seasoning']],
    steps: ['Brown sausage and stir in marinara.', 'Mix cottage cheese, egg, half the parmesan and seasoning.', 'Layer sauce, noodles, cheese mixture and mozzarella three times, ending with sauce and cheese.', 'Cover and bake at 375°F 45 minutes, uncover 15 more. Rest 15 minutes.'],
  },
  {
    title: 'Deviled Eggs', emoji: '🥚', type: 'Snack', cuisine: 'American', time: 25, servings: 12,
    tags: ['easter', 'party', 'gathering', 'holiday'],
    ing: [[12, 'ea', 'Eggs'], [0.5, 'cup', 'Mayonnaise'], [2, 'tsp', 'Mustard'], [1, 'tsp', 'White Vinegar'], [0.25, 'tsp', 'Salt'], [1, 'tsp', 'Paprika']],
    steps: ['Hard-boil the eggs 11 minutes, then ice-bath and peel.', 'Halve and pop out the yolks.', 'Mash yolks with mayo, mustard, vinegar and salt.', 'Pipe back into whites and dust with paprika.'],
  },
  {
    title: 'Hot Cocoa Bar', emoji: '☕', type: 'Drink', cuisine: 'American', time: 10, servings: 6,
    tags: ['christmas', 'winter', 'party', 'kids'],
    ing: [[6, 'cup', 'Milk'], [0.5, 'cup', 'Cocoa Powder'], [0.5, 'cup', 'Granulated Sugar'], [0.5, 'cup', 'Chocolate Chips'], [1, 'tsp', 'Vanilla Extract'], [2, 'cup', 'Marshmallows', 'topping'], [1, 'tub', 'Cool Whip', 'topping', true]],
    steps: ['Whisk cocoa and sugar into the milk and heat until steaming.', 'Stir in chips until melted, then vanilla.', 'Set out marshmallows and toppings and let everyone build their own.'],
  },
  {
    title: 'Holiday Punch', emoji: '🥤', type: 'Drink', cuisine: 'American', time: 5, servings: 16,
    tags: ['party', 'holiday', 'gathering', 'christmas'],
    ing: [[2, 'L', 'Soda', 'ginger ale or lemon-lime'], [1, 'carton', 'Orange Juice'], [1, 'bottle', 'Apple Juice'], [1, 'bag', 'Cranberries', 'garnish', true], [1, 'bag', 'Ice']],
    steps: ['Chill everything well.', 'Combine juices in a punch bowl and add soda right before serving.', 'Float cranberries and orange slices; add ice.'],
  },
  {
    title: 'Apple Crisp', emoji: '🍎', type: 'Dessert', cuisine: 'American', time: 55, servings: 8,
    tags: ['fall', 'baking', 'thanksgiving'],
    ing: [[6, 'ea', 'Apples'], [1, 'tbsp', 'Lemons', 'juice'], [1, 'cup', 'Rolled Oats'], [0.75, 'cup', 'Brown Sugar'], [0.5, 'cup', 'All-Purpose Flour'], [0.5, 'cup', 'Butter', 'cold'], [1, 'tsp', 'Cinnamon'], [1, 'pint', 'Ice Cream', 'to serve', true]],
    steps: ['Heat oven to 350°F. Toss sliced apples with lemon juice and half the cinnamon in a baking dish.', 'Rub oats, sugar, flour, remaining cinnamon and butter into crumbles.', 'Scatter over apples and bake 40 minutes until bubbling.', 'Serve warm with ice cream.'],
  },
  {
    title: 'Chicken Quesadillas', emoji: '🫓', type: 'Lunch', cuisine: 'Mexican', time: 15, servings: 4,
    tags: ['quick', 'kids', 'use it up'],
    ing: [[4, 'ea', 'Tortillas'], [2, 'cup', 'Chicken Breast', 'cooked, shredded'], [2, 'cup', 'Cheddar Cheese'], [1, 'ea', 'Bell Peppers', '', true], [1, 'tsp', 'Chili Powder'], [0.5, 'cup', 'Salsa', 'to serve']],
    steps: ['Toss chicken with chili powder.', 'Fill half of each tortilla with cheese, chicken and peppers; fold.', 'Cook in a dry skillet 2–3 minutes per side until crisp and melted.', 'Cut into wedges and serve with salsa.'],
  },
  {
    title: 'Roasted Vegetables', emoji: '🥕', type: 'Side', cuisine: 'American', time: 40, servings: 6,
    tags: ['healthy', 'vegetarian', 'use it up', 'holiday'],
    ing: [[1, 'lb', 'Carrots'], [1, 'lb', 'Sweet Potatoes'], [1, 'head', 'Broccoli'], [1, 'ea', 'Onions'], [3, 'tbsp', 'Olive Oil'], [1, 'tsp', 'Salt'], [1, 'tsp', 'Rosemary']],
    steps: ['Heat oven to 425°F.', 'Cut vegetables into even chunks and toss with oil, salt and rosemary.', 'Spread on two sheet pans and roast 30–35 minutes, turning once.'],
  },
  {
    title: 'Tuna Salad Sandwiches', emoji: '🥪', type: 'Lunch', cuisine: 'American', time: 10, servings: 4,
    tags: ['quick', 'lunch', 'pantry'],
    ing: [[2, 'can', 'Tuna'], [0.33, 'cup', 'Mayonnaise'], [1, 'ea', 'Celery'], [1, 'tbsp', 'Pickles', 'chopped', true], [1, 'tsp', 'Lemons', 'juice'], [8, 'ea', 'Bread', 'slices'], [4, 'ea', 'Lettuce', 'leaves', true]],
    steps: ['Drain tuna and mix with mayo, celery, pickles and lemon.', 'Season and spread onto bread with lettuce.'],
  },
  {
    title: 'Cornbread', emoji: '🌽', type: 'Side', cuisine: 'Southern', time: 35, servings: 9,
    tags: ['baking', 'thanksgiving', 'comfort'],
    ing: [[1, 'cup', 'Cornmeal'], [1, 'cup', 'All-Purpose Flour'], [0.25, 'cup', 'Granulated Sugar'], [1, 'tbsp', 'Baking Powder'], [0.5, 'tsp', 'Salt'], [1, 'cup', 'Buttermilk'], [2, 'ea', 'Eggs'], [0.33, 'cup', 'Butter', 'melted']],
    steps: ['Heat oven to 400°F and butter an 8-inch pan.', 'Whisk dry ingredients; whisk wet ingredients separately.', 'Combine just until moistened and pour into the pan.', 'Bake 20–25 minutes until golden.'],
  },
  {
    title: 'Steak & Potatoes', emoji: '🥩', type: 'Dinner', cuisine: 'American', time: 45, servings: 2,
    tags: ['date night', 'weekend'],
    ing: [[1, 'lb', 'Steak'], [1, 'lb', 'Potatoes'], [2, 'tbsp', 'Butter'], [2, 'clove', 'Garlic'], [1, 'tsp', 'Rosemary'], [2, 'tbsp', 'Olive Oil'], [1, 'tsp', 'Salt'], [1, 'tsp', 'Black Pepper']],
    steps: ['Roast halved potatoes with oil and salt at 425°F for 30 minutes.', 'Season steak generously and sear in a very hot pan 3–4 minutes per side.', 'Add butter, garlic and rosemary; baste for 1 minute.', 'Rest 5 minutes, slice, and serve with the potatoes.'],
  },
];

const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const BUILTIN_RECIPES = R.map(r => ({
  id: 'b-' + slug(r.title),
  source: 'builtin',
  ...r,
  ingredients: r.ing.map(([qty, unit, name, note = '', optional = false]) => ({ qty, unit, name, note, optional })),
  ing: undefined,
}));
