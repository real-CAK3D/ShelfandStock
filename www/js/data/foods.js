// Food catalog. Shelf lives are approximate storage times adapted from the USDA FoodKeeper
// guidance (days; 0 = not recommended / not applicable for that storage).
// Row: [name, emoji, category, home zone, fridge days, freezer days, pantry days, default unit, aliases]

export const CATEGORIES = [
  { id: 'produce', name: 'Produce', emoji: '🥬', color: '#6f9a4a' },
  { id: 'dairy', name: 'Dairy & Eggs', emoji: '🥛', color: '#d9c58f' },
  { id: 'meat', name: 'Meat & Seafood', emoji: '🥩', color: '#b4523f' },
  { id: 'bakery', name: 'Bakery', emoji: '🥖', color: '#c7924d' },
  { id: 'grains', name: 'Grains & Pasta', emoji: '🍝', color: '#d6a95c' },
  { id: 'canned', name: 'Canned & Jarred', emoji: '🥫', color: '#a0523b' },
  { id: 'baking', name: 'Baking', emoji: '🧁', color: '#e2b8a0' },
  { id: 'spices', name: 'Spices & Herbs', emoji: '🌿', color: '#8a7a3a' },
  { id: 'condiments', name: 'Condiments & Sauces', emoji: '🍯', color: '#c98a2e' },
  { id: 'snacks', name: 'Snacks', emoji: '🍿', color: '#e0a64a' },
  { id: 'beverages', name: 'Beverages', emoji: '🧃', color: '#5b8fa8' },
  { id: 'frozen', name: 'Frozen', emoji: '🧊', color: '#7fb0c9' },
  { id: 'deli', name: 'Deli & Prepared', emoji: '🥪', color: '#b07a52' },
  { id: 'leftovers', name: 'Leftovers', emoji: '🍱', color: '#9c6b8e' },
  { id: 'kitchenware', name: 'Kitchenware & Holiday', emoji: '🦃', color: '#7a5a3a' },
  { id: 'household', name: 'Household', emoji: '🧻', color: '#8b8b8b' },
];

const F = 'fridge', Z = 'freezer', P = 'pantry', C = 'cabinet';

const ROWS = [
  // Produce
  ['Apples', '🍎', 'produce', F, 42, 240, 21, 'ea', 'apple,gala,fuji,honeycrisp,granny smith'],
  ['Bananas', '🍌', 'produce', P, 5, 90, 5, 'ea', 'banana'],
  ['Oranges', '🍊', 'produce', F, 28, 0, 10, 'ea', 'orange,navel'],
  ['Lemons', '🍋', 'produce', F, 28, 120, 7, 'ea', 'lemon'],
  ['Limes', '🍋‍🟩', 'produce', F, 28, 120, 7, 'ea', 'lime'],
  ['Strawberries', '🍓', 'produce', F, 5, 240, 1, 'lb', 'strawberry'],
  ['Blueberries', '🫐', 'produce', F, 10, 240, 1, 'pint', 'blueberry'],
  ['Grapes', '🍇', 'produce', F, 10, 90, 2, 'lb', 'grape'],
  ['Avocados', '🥑', 'produce', P, 5, 120, 4, 'ea', 'avocado'],
  ['Tomatoes', '🍅', 'produce', P, 7, 60, 5, 'ea', 'tomato,roma,cherry tomatoes'],
  ['Potatoes', '🥔', 'produce', P, 0, 300, 30, 'lb', 'potato,russet,yukon'],
  ['Sweet Potatoes', '🍠', 'produce', P, 0, 300, 21, 'lb', 'sweet potato,yam'],
  ['Onions', '🧅', 'produce', P, 60, 240, 30, 'ea', 'onion,yellow onion,red onion,white onion'],
  ['Garlic', '🧄', 'produce', P, 14, 300, 90, 'head', 'garlic cloves,clove garlic'],
  ['Carrots', '🥕', 'produce', F, 21, 300, 0, 'lb', 'carrot,baby carrots'],
  ['Celery', '🥬', 'produce', F, 14, 300, 0, 'bunch', 'celery stalks'],
  ['Lettuce', '🥬', 'produce', F, 7, 0, 0, 'head', 'romaine,iceberg,salad greens,mixed greens'],
  ['Spinach', '🥬', 'produce', F, 5, 300, 0, 'bag', 'baby spinach'],
  ['Broccoli', '🥦', 'produce', F, 5, 300, 0, 'head', 'broccoli florets'],
  ['Cauliflower', '🥦', 'produce', F, 7, 300, 0, 'head', ''],
  ['Bell Peppers', '🫑', 'produce', F, 10, 240, 0, 'ea', 'bell pepper,red pepper,green pepper'],
  ['Jalapeños', '🌶️', 'produce', F, 10, 240, 0, 'ea', 'jalapeno,chili pepper'],
  ['Cucumbers', '🥒', 'produce', F, 7, 0, 0, 'ea', 'cucumber'],
  ['Zucchini', '🥒', 'produce', F, 7, 240, 0, 'ea', 'squash,yellow squash'],
  ['Mushrooms', '🍄', 'produce', F, 7, 240, 0, 'oz', 'mushroom,cremini,button mushrooms'],
  ['Corn', '🌽', 'produce', F, 3, 240, 0, 'ear', 'corn on the cob,sweet corn'],
  ['Green Onions', '🧅', 'produce', F, 7, 0, 0, 'bunch', 'scallions,green onion'],
  ['Cilantro', '🌿', 'produce', F, 7, 0, 0, 'bunch', 'coriander leaves'],
  ['Parsley', '🌿', 'produce', F, 10, 0, 0, 'bunch', 'fresh parsley'],
  ['Basil', '🌿', 'produce', P, 5, 0, 5, 'bunch', 'fresh basil'],
  ['Ginger', '🫚', 'produce', F, 21, 180, 7, 'oz', 'ginger root,fresh ginger'],
  ['Cranberries', '🍒', 'produce', F, 28, 365, 0, 'bag', 'fresh cranberries'],
  ['Pumpkin', '🎃', 'produce', P, 0, 0, 60, 'ea', 'pie pumpkin'],
  ['Watermelon', '🍉', 'produce', P, 5, 0, 10, 'ea', ''],
  ['Pineapple', '🍍', 'produce', P, 5, 180, 2, 'ea', ''],
  // Dairy & eggs
  ['Milk', '🥛', 'dairy', F, 7, 90, 0, 'gal', 'whole milk,2% milk,skim milk'],
  ['Eggs', '🥚', 'dairy', F, 35, 0, 0, 'dozen', 'egg,large eggs'],
  ['Butter', '🧈', 'dairy', F, 60, 270, 0, 'lb', 'unsalted butter,salted butter'],
  ['Cheddar Cheese', '🧀', 'dairy', F, 42, 180, 0, 'oz', 'cheddar,shredded cheddar,cheese'],
  ['Mozzarella', '🧀', 'dairy', F, 21, 180, 0, 'oz', 'mozzarella cheese,shredded mozzarella'],
  ['Parmesan', '🧀', 'dairy', F, 120, 240, 0, 'oz', 'parmigiano,parmesan cheese,grated parmesan'],
  ['Cream Cheese', '🧀', 'dairy', F, 14, 60, 0, 'oz', 'philadelphia'],
  ['Sour Cream', '🥣', 'dairy', F, 14, 0, 0, 'oz', ''],
  ['Greek Yogurt', '🥣', 'dairy', F, 14, 60, 0, 'oz', 'yogurt,plain yogurt'],
  ['Heavy Cream', '🥛', 'dairy', F, 21, 90, 0, 'pint', 'whipping cream,heavy whipping cream'],
  ['Half and Half', '🥛', 'dairy', F, 10, 90, 0, 'pint', 'creamer'],
  ['Buttermilk', '🥛', 'dairy', F, 14, 90, 0, 'qt', ''],
  ['Cottage Cheese', '🥣', 'dairy', F, 7, 0, 0, 'oz', ''],
  ['Feta', '🧀', 'dairy', F, 30, 90, 0, 'oz', 'feta cheese'],
  // Meat & seafood
  ['Chicken Breast', '🍗', 'meat', F, 2, 270, 0, 'lb', 'chicken breasts,boneless chicken,chicken'],
  ['Chicken Thighs', '🍗', 'meat', F, 2, 270, 0, 'lb', 'chicken thigh'],
  ['Whole Turkey', '🦃', 'meat', Z, 2, 365, 0, 'lb', 'turkey'],
  ['Ground Beef', '🥩', 'meat', F, 2, 120, 0, 'lb', 'hamburger,minced beef,beef mince'],
  ['Steak', '🥩', 'meat', F, 4, 270, 0, 'lb', 'ribeye,sirloin,new york strip'],
  ['Pork Chops', '🥩', 'meat', F, 4, 180, 0, 'lb', 'pork chop'],
  ['Pork Shoulder', '🥩', 'meat', F, 4, 180, 0, 'lb', 'pork butt'],
  ['Ham', '🍖', 'meat', F, 7, 60, 0, 'lb', 'spiral ham,holiday ham'],
  ['Bacon', '🥓', 'meat', F, 7, 30, 0, 'lb', ''],
  ['Sausage', '🌭', 'meat', F, 2, 60, 0, 'lb', 'italian sausage,breakfast sausage'],
  ['Hot Dogs', '🌭', 'meat', F, 14, 60, 0, 'pack', 'franks'],
  ['Salmon', '🐟', 'meat', F, 2, 90, 0, 'lb', 'salmon fillet'],
  ['Shrimp', '🦐', 'meat', Z, 2, 180, 0, 'lb', 'prawns'],
  ['Ground Turkey', '🥩', 'meat', F, 2, 120, 0, 'lb', ''],
  // Deli
  ['Sliced Turkey', '🥪', 'deli', F, 5, 60, 0, 'lb', 'deli turkey,lunch meat'],
  ['Sliced Ham', '🥪', 'deli', F, 5, 60, 0, 'lb', 'deli ham'],
  ['Pepperoni', '🍕', 'deli', F, 21, 60, 0, 'oz', ''],
  ['Hummus', '🥣', 'deli', F, 7, 120, 0, 'oz', ''],
  ['Salsa', '🍅', 'deli', F, 14, 60, 0, 'jar', 'pico de gallo'],
  ['Tortillas', '🫓', 'bakery', P, 21, 180, 7, 'pack', 'flour tortillas,corn tortillas,tortilla'],
  // Bakery
  ['Bread', '🍞', 'bakery', P, 10, 90, 5, 'loaf', 'sandwich bread,white bread,wheat bread,sliced bread'],
  ['Bagels', '🥯', 'bakery', P, 7, 90, 5, 'pack', 'bagel'],
  ['Hamburger Buns', '🍔', 'bakery', P, 7, 90, 5, 'pack', 'buns,hot dog buns'],
  ['Dinner Rolls', '🥐', 'bakery', P, 7, 90, 4, 'pack', 'rolls'],
  ['Pie Crust', '🥧', 'bakery', F, 14, 60, 0, 'ea', 'pastry crust,refrigerated pie crust'],
  // Grains & pasta
  ['Spaghetti', '🍝', 'grains', C, 0, 0, 730, 'lb', 'pasta,linguine,noodles'],
  ['Penne', '🍝', 'grains', C, 0, 0, 730, 'lb', 'rigatoni,ziti,short pasta'],
  ['Elbow Macaroni', '🍝', 'grains', C, 0, 0, 730, 'lb', 'macaroni'],
  ['Lasagna Noodles', '🍝', 'grains', C, 0, 0, 730, 'box', 'lasagna sheets'],
  ['Egg Noodles', '🍜', 'grains', C, 0, 0, 730, 'bag', ''],
  ['White Rice', '🍚', 'grains', C, 0, 0, 1460, 'lb', 'rice,long grain rice,jasmine rice,basmati'],
  ['Brown Rice', '🍚', 'grains', C, 0, 0, 180, 'lb', ''],
  ['Rolled Oats', '🥣', 'grains', C, 0, 0, 365, 'canister', 'oats,oatmeal,old fashioned oats'],
  ['Quinoa', '🌾', 'grains', C, 0, 0, 730, 'lb', ''],
  ['Breadcrumbs', '🍞', 'grains', C, 0, 0, 180, 'canister', 'panko,bread crumbs'],
  ['Cereal', '🥣', 'grains', C, 0, 0, 180, 'box', 'cheerios,corn flakes'],
  ['Ramen', '🍜', 'grains', C, 0, 0, 365, 'pack', 'instant noodles'],
  ['Stuffing Mix', '🍞', 'grains', C, 0, 0, 180, 'box', 'stuffing,stove top'],
  ['Crackers', '🧇', 'snacks', C, 0, 0, 180, 'box', 'saltines,ritz'],
  // Canned & jarred
  ['Diced Tomatoes', '🥫', 'canned', C, 7, 60, 545, 'can', 'canned tomatoes,crushed tomatoes'],
  ['Tomato Sauce', '🥫', 'canned', C, 7, 60, 545, 'can', ''],
  ['Tomato Paste', '🥫', 'canned', C, 7, 90, 545, 'can', ''],
  ['Marinara Sauce', '🫙', 'canned', C, 10, 90, 365, 'jar', 'pasta sauce,spaghetti sauce'],
  ['Black Beans', '🥫', 'canned', C, 4, 60, 730, 'can', 'beans'],
  ['Kidney Beans', '🥫', 'canned', C, 4, 60, 730, 'can', 'red beans'],
  ['Chickpeas', '🥫', 'canned', C, 4, 60, 730, 'can', 'garbanzo beans'],
  ['Chicken Broth', '🥫', 'canned', C, 5, 90, 365, 'carton', 'chicken stock,broth,stock'],
  ['Beef Broth', '🥫', 'canned', C, 5, 90, 365, 'carton', 'beef stock'],
  ['Cream of Mushroom Soup', '🥫', 'canned', C, 4, 60, 545, 'can', 'condensed soup'],
  ['Tuna', '🐟', 'canned', C, 4, 60, 1095, 'can', 'canned tuna'],
  ['Corn (canned)', '🥫', 'canned', C, 4, 60, 730, 'can', 'canned corn,whole kernel corn'],
  ['Green Beans (canned)', '🥫', 'canned', C, 4, 60, 730, 'can', 'green beans'],
  ['Pumpkin Purée', '🥫', 'canned', C, 7, 90, 545, 'can', 'canned pumpkin,pumpkin puree'],
  ['Cranberry Sauce', '🥫', 'canned', C, 10, 60, 545, 'can', ''],
  ['Crispy Fried Onions', '🧅', 'canned', C, 0, 0, 180, 'can', 'fried onions,french fried onions'],
  ['Coconut Milk', '🥥', 'canned', C, 7, 60, 545, 'can', ''],
  ['Peanut Butter', '🥜', 'canned', C, 180, 0, 180, 'jar', ''],
  ['Jam', '🍓', 'canned', C, 180, 0, 365, 'jar', 'jelly,preserves'],
  ['Pickles', '🥒', 'canned', F, 90, 0, 365, 'jar', 'dill pickles'],
  ['Evaporated Milk', '🥫', 'canned', C, 5, 0, 365, 'can', ''],
  ['Sweetened Condensed Milk', '🥫', 'canned', C, 7, 0, 365, 'can', 'condensed milk'],
  // Baking
  ['All-Purpose Flour', '🌾', 'baking', C, 0, 730, 365, 'lb', 'flour,ap flour'],
  ['Granulated Sugar', '🍬', 'baking', C, 0, 0, 730, 'lb', 'sugar,white sugar'],
  ['Brown Sugar', '🍬', 'baking', C, 0, 0, 730, 'lb', 'light brown sugar,dark brown sugar'],
  ['Powdered Sugar', '🍬', 'baking', C, 0, 0, 730, 'lb', 'confectioners sugar,icing sugar'],
  ['Baking Soda', '🧂', 'baking', C, 0, 0, 545, 'box', 'bicarbonate of soda'],
  ['Baking Powder', '🧂', 'baking', C, 0, 0, 270, 'can', ''],
  ['Vanilla Extract', '🫙', 'baking', C, 0, 0, 1460, 'bottle', 'vanilla'],
  ['Chocolate Chips', '🍫', 'baking', C, 0, 365, 365, 'bag', 'semi-sweet chocolate chips'],
  ['Cocoa Powder', '🍫', 'baking', C, 0, 0, 730, 'can', 'cocoa,unsweetened cocoa'],
  ['Yeast', '🧫', 'baking', F, 120, 180, 120, 'packet', 'active dry yeast,instant yeast'],
  ['Cornstarch', '🧂', 'baking', C, 0, 0, 1095, 'box', 'corn starch'],
  ['Honey', '🍯', 'baking', C, 0, 0, 3650, 'bottle', ''],
  ['Maple Syrup', '🍁', 'baking', F, 365, 0, 365, 'bottle', 'syrup,pancake syrup'],
  ['Pecans', '🌰', 'baking', C, 180, 730, 120, 'bag', 'walnuts,nuts'],
  ['Marshmallows', '☁️', 'baking', C, 0, 0, 180, 'bag', 'mini marshmallows'],
  ['Pancake Mix', '🥞', 'baking', C, 0, 0, 365, 'box', 'bisquick'],
  ['Cornmeal', '🌽', 'baking', C, 0, 730, 365, 'lb', 'corn meal'],
  // Spices
  ['Salt', '🧂', 'spices', C, 0, 0, 3650, 'canister', 'kosher salt,sea salt,table salt'],
  ['Black Pepper', '🧂', 'spices', C, 0, 0, 1095, 'jar', 'pepper,ground pepper,peppercorns'],
  ['Garlic Powder', '🧂', 'spices', C, 0, 0, 1095, 'jar', ''],
  ['Onion Powder', '🧂', 'spices', C, 0, 0, 1095, 'jar', ''],
  ['Paprika', '🌶️', 'spices', C, 0, 0, 1095, 'jar', 'smoked paprika'],
  ['Chili Powder', '🌶️', 'spices', C, 0, 0, 1095, 'jar', ''],
  ['Cumin', '🧂', 'spices', C, 0, 0, 1095, 'jar', 'ground cumin'],
  ['Oregano', '🌿', 'spices', C, 0, 0, 1095, 'jar', 'dried oregano'],
  ['Italian Seasoning', '🌿', 'spices', C, 0, 0, 1095, 'jar', ''],
  ['Cinnamon', '🧂', 'spices', C, 0, 0, 1095, 'jar', 'ground cinnamon'],
  ['Nutmeg', '🧂', 'spices', C, 0, 0, 1095, 'jar', ''],
  ['Pumpkin Pie Spice', '🧂', 'spices', C, 0, 0, 1095, 'jar', ''],
  ['Thyme', '🌿', 'spices', C, 0, 0, 1095, 'jar', 'dried thyme'],
  ['Rosemary', '🌿', 'spices', C, 0, 0, 1095, 'jar', ''],
  ['Sage', '🌿', 'spices', C, 0, 0, 1095, 'jar', 'rubbed sage,poultry seasoning'],
  ['Bay Leaves', '🍃', 'spices', C, 0, 0, 1095, 'jar', 'bay leaf'],
  ['Red Pepper Flakes', '🌶️', 'spices', C, 0, 0, 1095, 'jar', 'crushed red pepper'],
  ['Cayenne', '🌶️', 'spices', C, 0, 0, 1095, 'jar', 'cayenne pepper'],
  ['Basil (dried)', '🌿', 'spices', C, 0, 0, 1095, 'jar', 'dried basil'],
  ['Taco Seasoning', '🌮', 'spices', C, 0, 0, 730, 'packet', ''],
  // Condiments & oils
  ['Olive Oil', '🫒', 'condiments', C, 0, 0, 540, 'bottle', 'extra virgin olive oil,evoo'],
  ['Vegetable Oil', '🫗', 'condiments', C, 0, 0, 365, 'bottle', 'canola oil,cooking oil'],
  ['Cooking Spray', '🫗', 'condiments', C, 0, 0, 730, 'can', 'pam'],
  ['Ketchup', '🍅', 'condiments', F, 180, 0, 30, 'bottle', ''],
  ['Mustard', '🌭', 'condiments', F, 365, 0, 30, 'bottle', 'dijon,yellow mustard'],
  ['Mayonnaise', '🥚', 'condiments', F, 60, 0, 0, 'jar', 'mayo'],
  ['Soy Sauce', '🫙', 'condiments', C, 730, 0, 730, 'bottle', 'tamari'],
  ['Hot Sauce', '🌶️', 'condiments', C, 1095, 0, 180, 'bottle', 'sriracha,tabasco'],
  ['BBQ Sauce', '🍖', 'condiments', F, 120, 0, 30, 'bottle', 'barbecue sauce'],
  ['Ranch Dressing', '🥗', 'condiments', F, 60, 0, 0, 'bottle', 'ranch,salad dressing'],
  ['Worcestershire Sauce', '🫙', 'condiments', C, 0, 0, 730, 'bottle', ''],
  ['White Vinegar', '🫙', 'condiments', C, 0, 0, 3650, 'bottle', 'vinegar,apple cider vinegar'],
  ['Balsamic Vinegar', '🫙', 'condiments', C, 0, 0, 1095, 'bottle', ''],
  ['Salsa Verde', '🫙', 'condiments', F, 14, 0, 365, 'jar', ''],
  ['Gravy Mix', '🥣', 'condiments', C, 0, 0, 730, 'packet', 'gravy,turkey gravy'],
  // Snacks
  ['Tortilla Chips', '🌽', 'snacks', C, 0, 0, 60, 'bag', 'chips'],
  ['Potato Chips', '🥔', 'snacks', C, 0, 0, 60, 'bag', ''],
  ['Pretzels', '🥨', 'snacks', C, 0, 0, 180, 'bag', ''],
  ['Popcorn', '🍿', 'snacks', C, 0, 0, 240, 'box', 'microwave popcorn'],
  ['Granola Bars', '🍫', 'snacks', C, 0, 0, 180, 'box', ''],
  ['Cookies', '🍪', 'snacks', C, 0, 240, 60, 'pack', 'oreos'],
  ['Almonds', '🌰', 'snacks', C, 365, 730, 180, 'bag', 'mixed nuts,cashews,peanuts'],
  // Beverages
  ['Orange Juice', '🧃', 'beverages', F, 10, 90, 0, 'carton', 'oj,juice'],
  ['Apple Juice', '🧃', 'beverages', P, 10, 0, 365, 'bottle', 'apple cider'],
  ['Coffee', '☕', 'beverages', C, 0, 365, 120, 'bag', 'ground coffee,coffee beans,k-cups'],
  ['Tea', '🍵', 'beverages', C, 0, 0, 730, 'box', 'tea bags,green tea'],
  ['Soda', '🥤', 'beverages', P, 0, 0, 270, 'pack', 'coke,pepsi,sprite,pop'],
  ['Sparkling Water', '🫧', 'beverages', P, 0, 0, 365, 'pack', 'seltzer,la croix'],
  ['Bottled Water', '💧', 'beverages', P, 0, 0, 730, 'pack', 'water'],
  ['Wine', '🍷', 'beverages', P, 5, 0, 1095, 'bottle', 'red wine,white wine,cooking wine'],
  ['Beer', '🍺', 'beverages', F, 180, 0, 180, 'pack', ''],
  ['Eggnog', '🥛', 'beverages', F, 5, 180, 0, 'qt', ''],
  // Frozen
  ['Frozen Peas', '🟢', 'frozen', Z, 0, 240, 0, 'bag', 'peas'],
  ['Frozen Mixed Vegetables', '🥦', 'frozen', Z, 0, 240, 0, 'bag', 'mixed vegetables,frozen veggies'],
  ['Frozen Berries', '🫐', 'frozen', Z, 0, 240, 0, 'bag', 'frozen fruit'],
  ['Frozen Pizza', '🍕', 'frozen', Z, 0, 120, 0, 'ea', 'pizza'],
  ['Ice Cream', '🍨', 'frozen', Z, 0, 60, 0, 'pint', 'gelato'],
  ['Frozen Waffles', '🧇', 'frozen', Z, 0, 120, 0, 'box', 'waffles,eggo'],
  ['Mozzarella Sticks', '🧀', 'frozen', Z, 0, 180, 0, 'box', 'breaded mozzarella sticks,cheese sticks'],
  ['Chicken Nuggets', '🍗', 'frozen', Z, 0, 120, 0, 'bag', 'chicken tenders'],
  ['French Fries', '🍟', 'frozen', Z, 0, 240, 0, 'bag', 'fries,tater tots'],
  ['Ice', '🧊', 'frozen', Z, 0, 120, 0, 'bag', 'ice cubes'],
  ['Frozen Pie Shells', '🥧', 'frozen', Z, 0, 180, 0, 'pack', ''],
  ['Cool Whip', '☁️', 'frozen', Z, 14, 180, 0, 'tub', 'whipped topping,whipped cream'],
  // Leftovers
  ['Leftovers', '🍱', 'leftovers', F, 4, 90, 0, 'container', 'leftover'],
  // Kitchenware & holiday
  ['Roasting Pan', '🍳', 'kitchenware', 'holiday', 0, 0, 0, 'ea', 'roaster'],
  ['Turkey Baster', '💉', 'kitchenware', 'holiday', 0, 0, 0, 'ea', 'baster'],
  ['Meat Thermometer', '🌡️', 'kitchenware', C, 0, 0, 0, 'ea', 'thermometer'],
  ['Cookie Cutters', '⭐', 'kitchenware', 'holiday', 0, 0, 0, 'set', ''],
  ['Pie Dish', '🥧', 'kitchenware', C, 0, 0, 0, 'ea', 'pie plate'],
  ['Gravy Boat', '🫖', 'kitchenware', 'holiday', 0, 0, 0, 'ea', ''],
  ['Serving Platter', '🍽️', 'kitchenware', 'holiday', 0, 0, 0, 'ea', 'platter'],
  ['Punch Bowl', '🥣', 'kitchenware', 'holiday', 0, 0, 0, 'ea', ''],
  ['Holiday Napkins', '🎄', 'kitchenware', 'holiday', 0, 0, 0, 'pack', 'napkins,festive napkins'],
  ['Cake Stand', '🎂', 'kitchenware', 'holiday', 0, 0, 0, 'ea', ''],
  ['Slow Cooker', '🍲', 'kitchenware', C, 0, 0, 0, 'ea', 'crock pot,crockpot'],
  ['Stand Mixer', '🌀', 'kitchenware', C, 0, 0, 0, 'ea', 'mixer,kitchenaid'],
  ['Disposable Foil Pans', '🥘', 'kitchenware', 'holiday', 0, 0, 0, 'pack', 'foil pans'],
  ['Birthday Candles', '🕯️', 'kitchenware', 'holiday', 0, 0, 0, 'pack', 'candles'],
  // Household
  ['Aluminum Foil', '🧻', 'household', C, 0, 0, 0, 'roll', 'foil,tin foil'],
  ['Plastic Wrap', '🧻', 'household', C, 0, 0, 0, 'roll', 'cling wrap,saran wrap'],
  ['Parchment Paper', '📜', 'household', C, 0, 0, 0, 'roll', ''],
  ['Zip Bags', '🛍️', 'household', C, 0, 0, 0, 'box', 'ziploc,storage bags,freezer bags'],
  ['Paper Towels', '🧻', 'household', C, 0, 0, 0, 'pack', ''],
  ['Dish Soap', '🧼', 'household', C, 0, 0, 0, 'bottle', 'dawn'],
  ['Trash Bags', '🗑️', 'household', C, 0, 0, 0, 'box', 'garbage bags'],
];

const slug = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export const FOODS = ROWS.map(([name, emoji, cat, zone, fridge, freezer, pantry, unit, aliases]) => ({
  id: slug(name), name, emoji, cat, zone,
  life: { fridge, freezer, pantry },
  unit,
  aliases: aliases ? aliases.split(',').map(a => a.trim().toLowerCase()) : [],
}));

export const FOOD_BY_ID = Object.fromEntries(FOODS.map(f => [f.id, f]));
export const CAT_BY_ID = Object.fromEntries(CATEGORIES.map(c => [c.id, c]));

export const UNITS = ['ea', 'lb', 'oz', 'g', 'kg', 'cup', 'tbsp', 'tsp', 'gal', 'qt', 'pint', 'L', 'ml', 'dozen', 'can', 'jar', 'box', 'bag', 'bottle', 'carton', 'pack', 'packet', 'loaf', 'bunch', 'head', 'canister', 'roll', 'set', 'tub', 'container', 'ear', 'clove'];

// Ingredients nobody needs on a shopping list to call a recipe "makeable".
export const ALWAYS_HAVE = new Set(['water', 'ice-water', 'hot-water']);

const norm = s => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const singular = w => w.replace(/(ies)$/, 'y').replace(/(oes)$/, 'o').replace(/([^s])s$/, '$1');

// Resolve free text ("2 large yellow onions, diced") to a catalog food.
export function matchFood(text) {
  if (!text) return null;
  const t = norm(text);
  if (FOOD_BY_ID[slug(text)]) return FOOD_BY_ID[slug(text)];
  const words = new Set(t.split(' ').map(singular));
  let best = null, bestScore = 0;
  for (const f of FOODS) {
    for (const cand of [f.name.toLowerCase(), ...f.aliases]) {
      const c = norm(cand);
      if (!c) continue;
      let score = 0;
      if (t === c) score = 100;
      else if (` ${t} `.includes(` ${c} `)) score = 50 + c.length;
      else {
        const cw = c.split(' ').map(singular);
        if (cw.every(w => words.has(w))) score = 40 + c.length;
      }
      if (score > bestScore) { bestScore = score; best = f; }
    }
  }
  return bestScore >= 42 ? best : null;
}

export function searchFoods(q, limit = 12) {
  const t = norm(q);
  if (!t) return [];
  const out = [];
  for (const f of FOODS) {
    const hay = [f.name.toLowerCase(), ...f.aliases];
    const idx = Math.min(...hay.map(h => { const i = h.indexOf(t); return i < 0 ? 999 : i + (h === f.name.toLowerCase() ? 0 : 5); }));
    if (idx < 999) out.push([idx + (f.cat === 'kitchenware' || f.cat === 'household' ? 3 : 0), f]);
  }
  return out.sort((a, b) => a[0] - b[0] || a[1].name.length - b[1].name.length).slice(0, limit).map(x => x[1]);
}

export { slug };
