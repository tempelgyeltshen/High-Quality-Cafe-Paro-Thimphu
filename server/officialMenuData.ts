import { MenuCategory, MenuItem } from '../src/types/index.ts';

export const officialCategories: MenuCategory[] = [
  {
    id: 'cat_starter',
    name: 'Starter',
    sortOrder: 1,
    iconName: 'Sparkles',
    description: 'Fresh Bhutanese appetizers, salads, and crispy starters'
  },
  {
    id: 'cat_main',
    name: 'Main Course',
    sortOrder: 2,
    iconName: 'Utensils',
    description: 'Hearty pastas, artisan burgers, Bhutanese specialties, and fresh seafood'
  },
  {
    id: 'cat_hot_drinks',
    name: 'Hot Drinks',
    sortOrder: 3,
    iconName: 'Coffee',
    description: 'Freshly roasted espresso, handcrafted lattes, cappuccinos, and Himalayan teas'
  },
  {
    id: 'cat_cold_drinks',
    name: 'Cold Drinks',
    sortOrder: 4,
    iconName: 'GlassWater',
    description: 'Chilled iced espresso, iced matcha, shaken espresso, and cold lattes'
  },
  {
    id: 'cat_beverages',
    name: 'Beverages',
    sortOrder: 5,
    iconName: 'Wine',
    description: 'Fine whiskeys, chilled beers, soju, breezers, sodas, and pure mineral water'
  },
  {
    id: 'cat_cocktails',
    name: 'Cocktails',
    sortOrder: 6,
    iconName: 'Flame',
    description: 'Signature cocktails, classic mojitos, margaritas, and daiquiris'
  },
  {
    id: 'cat_mocktails',
    name: 'Mocktails',
    sortOrder: 7,
    iconName: 'Leaf',
    description: 'Refreshing non-alcoholic spritzers, virgin mojitos, and fruit coolers'
  }
];

export const officialMenuItems: MenuItem[] = [
  // ==========================================
  // 1. STARTER (From Menu Page 2)
  // ==========================================
  {
    id: 'item_suja_shamdray',
    name: 'SUJA-SHAMDRAY',
    categoryId: 'cat_starter',
    description: 'Traditional Bhutanese-style dish prepared with fresh vegetables, aromatic spices and a rich, flavorful sauce. Served hot with butter tea (suja).',
    price: 180,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_ema_datshi_1792466932457.jpg',
    preparationTimeMinutes: 12,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_suja_spice',
        name: 'Spice Level',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_mild', name: 'Mild Flavor', priceModifier: 0 },
          { id: 'opt_medium', name: 'Medium Spice', priceModifier: 0 },
          { id: 'opt_bhutanese', name: 'Authentic Bhutanese Spicy', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_caesar_salad',
    name: 'CAESAR SALAD WITH GRILLED CHICKEN BREAST',
    categoryId: 'cat_starter',
    description: 'Fresh crisp lettuce, grilled chicken breast, Caesar dressing, Parmesan cheese and crunchy croutons, finished with freshly ground pepper.',
    price: 260,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy', 'Gluten'],
    imageUrl: '/src/assets/images/dish_momos_steamed_1792466933578.jpg',
    preparationTimeMinutes: 10,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_caesar_dressing',
        name: 'Dressing Preference',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_tossed', name: 'Tossed in Dressing', priceModifier: 0 },
          { id: 'opt_side', name: 'Dressing on the Side', priceModifier: 0 }
        ]
      },
      {
        id: 'grp_caesar_croutons',
        name: 'Croutons',
        type: 'single',
        required: false,
        options: [
          { id: 'opt_crouton_yes', name: 'Crispy Croutons Included', priceModifier: 0 },
          { id: 'opt_crouton_no', name: 'No Croutons (Gluten-friendly)', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_potato_wedges',
    name: 'POTATO WEDGES',
    categoryId: 'cat_starter',
    description: 'Golden crispy potato wedges seasoned with herbs and spices. Served with a creamy dipping sauce.',
    price: 150,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_yak_burger_1792466934556.jpg',
    preparationTimeMinutes: 12,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_wedges_dip',
        name: 'Dip Choice',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_creamy_dip', name: 'House Creamy Dipping Sauce', priceModifier: 0 },
          { id: 'opt_ezay_dip', name: 'Spicy Bhutanese Ezay Dip', priceModifier: 0 },
          { id: 'opt_garlic_mayo', name: 'Garlic Herb Aioli', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_fish_and_chips',
    name: 'FISH & CHIPS',
    categoryId: 'cat_starter',
    description: 'Crispy battered fish served with golden French fries, fresh salad and tartar sauce.',
    price: 320,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Fish', 'Gluten'],
    imageUrl: '/src/assets/images/dish_ema_datshi_1792466932457.jpg',
    preparationTimeMinutes: 15,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_fish_sauce',
        name: 'Condiments',
        type: 'single',
        required: false,
        options: [
          { id: 'opt_tartar', name: 'Classic Tartar & Lemon', priceModifier: 0 },
          { id: 'opt_vinegar', name: 'Malt Vinegar & Tartar', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_prawn_tempura',
    name: 'PRAWN TEMPURA',
    categoryId: 'cat_starter',
    description: 'Succulent prawns lightly coated in a delicate, crispy tempura batter and deep-fried to golden perfection. Served with Japanese-style dipping sauce and fresh salad.',
    price: 380,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Shellfish', 'Gluten'],
    imageUrl: '/src/assets/images/dish_momos_steamed_1792466933578.jpg',
    preparationTimeMinutes: 14,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_tempura_dip',
        name: 'Dipping Style',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_dashi', name: 'Japanese Dashi Tempura Dip', priceModifier: 0 },
          { id: 'opt_sweet_chili', name: 'Sweet Chilli Dip', priceModifier: 0 }
        ]
      }
    ]
  },

  // ==========================================
  // 2. MAIN COURSE (From Menu Page 3 & 4)
  // ==========================================
  {
    id: 'item_spaghetti_carbonara',
    name: 'SPAGHETTI CARBONARA',
    categoryId: 'cat_main',
    description: 'Spaghetti Carbonara is a classic Italian pasta dish made with spaghetti, eggs, cheese, cured pork, and black pepper.',
    price: 340,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Gluten', 'Dairy', 'Egg', 'Pork'],
    imageUrl: '/src/assets/images/dish_ema_datshi_1792466932457.jpg',
    preparationTimeMinutes: 16,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_carbonara_cheese',
        name: 'Parmesan & Pepper',
        type: 'single',
        required: false,
        options: [
          { id: 'opt_carb_regular', name: 'Chef Traditional Balance', priceModifier: 0 },
          { id: 'opt_carb_extra_cheese', name: 'Extra Shaved Parmesan', priceModifier: 25 },
          { id: 'opt_carb_extra_pepper', name: 'Extra Fresh Black Pepper', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_tomato_tho_tshe',
    name: 'TOMATO THO TSHE',
    categoryId: 'cat_main',
    description: 'A traditional Bhutanese vegetarian dish made with fresh tomatoes, onions, green chillies and Bhutanese spices. Simple, fresh and flavorful.',
    price: 220,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/dish_ema_datshi_1792466932457.jpg',
    preparationTimeMinutes: 14,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_thotshe_spice',
        name: 'Spice Level',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_tho_mild', name: 'Mild Spice', priceModifier: 0 },
          { id: 'opt_tho_medium', name: 'Medium Spice', priceModifier: 0 },
          { id: 'opt_tho_authentic', name: 'Authentic Bhutanese Green Chili Heat', priceModifier: 0 }
        ]
      },
      {
        id: 'grp_thotshe_rice',
        name: 'Rice Accompaniment',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_rice_white', name: 'Steamed White Rice Included', priceModifier: 0 },
          { id: 'opt_rice_red', name: 'Organic Bhutanese Red Rice', priceModifier: 20 }
        ]
      }
    ]
  },
  {
    id: 'item_golden_egg_fried_rice',
    name: 'GOLDEN EGG FRIED RICE',
    categoryId: 'cat_main',
    description: 'Fragrant rice wok-fried with eggs, fresh vegetables and aromatic seasonings, finished to a delicious golden perfection.',
    price: 200,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Egg', 'Soy'],
    imageUrl: '/src/assets/images/dish_momos_steamed_1792466933578.jpg',
    preparationTimeMinutes: 12,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_fried_rice_style',
        name: 'Preparation Style',
        type: 'single',
        required: false,
        options: [
          { id: 'opt_fr_standard', name: 'Classic Golden Wok', priceModifier: 0 },
          { id: 'opt_fr_extra_veg', name: 'Extra Garden Vegetables', priceModifier: 20 },
          { id: 'opt_fr_spicy', name: 'Wok-Fried Spicy with Chili', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_chicken_khatshu',
    name: 'CHICKEN KHATSHU',
    categoryId: 'cat_main',
    description: 'Tender chicken cooked with a flavorful Bhutanese-style sauce, fresh chillies and aromatic spices. Served with steamed rice.',
    price: 290,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/dish_ema_datshi_1792466932457.jpg',
    preparationTimeMinutes: 16,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_khatshu_spice',
        name: 'Spice Level',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_khatshu_medium', name: 'Medium Bhutanese Spice', priceModifier: 0 },
          { id: 'opt_khatshu_spicy', name: 'Authentic Fiery Spice', priceModifier: 0 },
          { id: 'opt_khatshu_mild', name: 'Mild Chili', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_teriyaki_chicken',
    name: 'TERIYAKI CHICKEN',
    categoryId: 'cat_main',
    description: 'Juicy grilled chicken glazed with a sweet and savory teriyaki sauce, garnished with sesame seeds and spring onions. Served with steamed rice.',
    price: 310,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Sesame', 'Soy'],
    imageUrl: '/src/assets/images/dish_yak_burger_1792466934556.jpg',
    preparationTimeMinutes: 15,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_teriyaki_glaze',
        name: 'Glaze Preference',
        type: 'single',
        required: false,
        options: [
          { id: 'opt_glaze_standard', name: 'Standard Teriyaki Glaze', priceModifier: 0 },
          { id: 'opt_glaze_extra', name: 'Extra Sweet-Savory Glaze', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_teriyaki_basa',
    name: 'TERIYAKI BASA',
    categoryId: 'cat_main',
    description: 'Tender Basa fillet glazed with a rich sweet and savory teriyaki sauce, finished with sesame seeds and spring onions. Severed with steamed rice.',
    price: 330,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Fish', 'Sesame', 'Soy'],
    imageUrl: '/src/assets/images/dish_ema_datshi_1792466932457.jpg',
    preparationTimeMinutes: 16,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_basa_rice',
        name: 'Rice Selection',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_basa_steamed', name: 'Steamed Fragrant Rice', priceModifier: 0 },
          { id: 'opt_basa_fried', name: 'Upgrade to Golden Fried Rice', priceModifier: 40 }
        ]
      }
    ]
  },
  {
    id: 'item_beef_burger',
    name: 'BEEF BURGER',
    categoryId: 'cat_main',
    description: 'Juicy seasoned beef patty served in a soft burger bun with fresh lettuce, tomato, onion, cheese and our signature burger sauce. Served with French fries.',
    price: 350,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Gluten', 'Dairy', 'Beef'],
    imageUrl: '/src/assets/images/dish_yak_burger_1792466934556.jpg',
    preparationTimeMinutes: 16,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_burger_doneness',
        name: 'Patty Doneness',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_done_well', name: 'Well Done', priceModifier: 0 },
          { id: 'opt_done_medium', name: 'Medium Well', priceModifier: 0 }
        ]
      },
      {
        id: 'grp_burger_extras',
        name: 'Custom Add-ons',
        type: 'multiple',
        required: false,
        options: [
          { id: 'opt_add_cheese', name: 'Double Melted Cheese', priceModifier: 30 },
          { id: 'opt_add_bacon', name: 'Crispy Bacon Strips', priceModifier: 45 },
          { id: 'opt_add_egg', name: 'Sunny-Side Fried Egg', priceModifier: 25 }
        ]
      }
    ]
  },
  {
    id: 'item_pizza_bacon_chicken',
    name: 'PIZZA (Bacon, Chicken & Cheese Pizza)',
    categoryId: 'cat_main',
    description: 'Freshly baked pizza topped with crispy bacon, seasoned chicken and generous melted cheese on a golden, crispy crust.',
    price: 390,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Gluten', 'Dairy', 'Pork'],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 18,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_pizza_crust',
        name: 'Crust & Seasoning',
        type: 'single',
        required: false,
        options: [
          { id: 'opt_crust_classic', name: 'Classic Golden Crust', priceModifier: 0 },
          { id: 'opt_crust_chili', name: 'Sprinkled with Chili Flakes & Oregano', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_spicy_chicken_wings',
    name: 'SPICY CHICKEN WINGS',
    categoryId: 'cat_main',
    description: 'Crispy chicken wings tossed in a bold and spicy sauce, seasoned with aromatic herbs and spices. Served with a dipping sauce.',
    price: 270,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/dish_yak_burger_1792466934556.jpg',
    preparationTimeMinutes: 14,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_wings_heat',
        name: 'Heat Level',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_wings_medium', name: 'Medium Bold Sauce', priceModifier: 0 },
          { id: 'opt_wings_extra_hot', name: 'Extra Fiery Hot Wings', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_chicken_chilli',
    name: 'CHICKEN CHILLI',
    categoryId: 'cat_main',
    description: 'Tender pieces of chicken stir-fried with fresh green chillis, onions, bell peppers and aromatic spices in a flavorful chilli sauce.',
    price: 280,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Soy'],
    imageUrl: '/src/assets/images/dish_ema_datshi_1792466932457.jpg',
    preparationTimeMinutes: 14,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_chicken_chilli_style',
        name: 'Preparation Style',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_cc_dry', name: 'Crispy Dry Stir-Fry', priceModifier: 0 },
          { id: 'opt_cc_gravy', name: 'Saucier Gravy Style', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_prawn_chilli',
    name: 'PRAWN CHILLI',
    categoryId: 'cat_main',
    description: 'Succulent prawns stir-fried with fresh green chillis, onions, bell peppers and aromatic spices in a flavorful sweet and spicy chilli sauce. Served hot and garnished with spring onions.',
    price: 360,
    dietType: 'non-veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Shellfish', 'Soy'],
    imageUrl: '/src/assets/images/dish_momos_steamed_1792466933578.jpg',
    preparationTimeMinutes: 15,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_prawn_style',
        name: 'Flavor Balance',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_pc_sweet_spicy', name: 'Sweet & Spicy Glaze', priceModifier: 0 },
          { id: 'opt_pc_extra_spicy', name: 'Extra Green Chili Hot', priceModifier: 0 }
        ]
      }
    ]
  },

  // ==========================================
  // 3. HOT DRINKS (From Menu Page 5)
  // ==========================================
  {
    id: 'item_espresso',
    name: 'ESPRESSO',
    categoryId: 'cat_hot_drinks',
    description: 'Concentrated full-bodied shot of fresh artisanal roasted coffee with a thick, golden crema.',
    price: 90,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 3,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_espresso_shot',
        name: 'Shot Size',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_esp_single', name: 'Single Shot', priceModifier: 0 },
          { id: 'opt_esp_double', name: 'Double Shot (Doppio)', priceModifier: 30 }
        ]
      }
    ]
  },
  {
    id: 'item_americano',
    name: 'AMERICANO',
    categoryId: 'cat_hot_drinks',
    description: 'Double shot of rich espresso topped with piping hot pure mountain spring water.',
    price: 110,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 3,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_cafe_latte',
    name: 'CAFÉ LATTE',
    categoryId: 'cat_hot_drinks',
    description: 'Espresso balanced with steamed silky microfoam milk and delicate barista latte art.',
    price: 140,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_milk_type',
        name: 'Milk Choice',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_milk_whole', name: 'Fresh Whole Milk', priceModifier: 0 },
          { id: 'opt_milk_oat', name: 'Barista Oat Milk', priceModifier: 30 },
          { id: 'opt_milk_skim', name: 'Skim Milk', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_cappuccino',
    name: 'CAPPUCCINO',
    categoryId: 'cat_hot_drinks',
    description: 'Harmonious balance of espresso, steamed milk, and a thick cushion of velvety foam, dusted with fine cocoa.',
    price: 140,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_mocha',
    name: 'MOCHA',
    categoryId: 'cat_hot_drinks',
    description: 'Rich espresso blended with dark bittersweet chocolate and steamed milk, topped with light foam.',
    price: 160,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_white_mocha',
    name: 'WHITE MOCHA',
    categoryId: 'cat_hot_drinks',
    description: 'Velvety espresso combined with creamy melted white chocolate and gently textured warm milk.',
    price: 170,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_caramel_macchiato',
    name: 'CARAMEL MACCHIATO',
    categoryId: 'cat_hot_drinks',
    description: 'Freshly steamed milk with vanilla-flavored syrup marked with espresso and finished with caramel drizzle.',
    price: 170,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_macchiato',
    name: 'MACCHIATO',
    categoryId: 'cat_hot_drinks',
    description: 'Bold espresso marked with a small dollop of creamy microfoam.',
    price: 110,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 3,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_cortado',
    name: 'CORTADO',
    categoryId: 'cat_hot_drinks',
    description: 'Equal parts espresso and warm milk to gently reduce acidity while retaining coffee intensity.',
    price: 120,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 4,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_flat_white',
    name: 'FLAT WHITE',
    categoryId: 'cat_hot_drinks',
    description: 'Double shot of espresso expertly integrated with velvety steamed whole milk for a punchy coffee note.',
    price: 150,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_hot_chocolate',
    name: 'HOT CHOCOLATE',
    categoryId: 'cat_hot_drinks',
    description: 'Comforting rich Belgian cocoa melted with fresh whole milk and a hint of vanilla.',
    price: 150,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 4,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_milk_tea',
    name: 'MILK TEA',
    categoryId: 'cat_hot_drinks',
    description: 'Fragrant steeped black tea simmered with fresh milk and crushed Himalayan cardamom.',
    price: 70,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 4,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_lemon_honey_tea',
    name: 'LEMON HONEY TEA',
    categoryId: 'cat_hot_drinks',
    description: 'Soothing hot mountain tea infused with freshly squeezed lemon and pure organic wildflower honey.',
    price: 90,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 3,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },

  // ==========================================
  // 4. COLD DRINKS (From Menu Page 5)
  // ==========================================
  {
    id: 'item_iced_americano',
    name: 'ICED AMERICANO',
    categoryId: 'cat_cold_drinks',
    description: 'Chilled double espresso shots poured over crystal ice and cold spring water for a crisp pick-me-up.',
    price: 130,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 3,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_iced_matcha',
    name: 'ICED MATCHA',
    categoryId: 'cat_cold_drinks',
    description: 'Premium ceremonial Japanese matcha green tea whisked smooth, served over cold milk and clear ice.',
    price: 180,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_iced_latte',
    name: 'ICED LATTE',
    categoryId: 'cat_cold_drinks',
    description: 'Fresh espresso poured gently over cold milk and ice cubes for a refreshing coffee break.',
    price: 160,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Dairy'],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 4,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_espresso_shaker',
    name: 'ESPRESSO SHAKER',
    categoryId: 'cat_cold_drinks',
    description: 'Double espresso vigorously hand-shaken with ice and cane sugar syrup, creating an ultra-creamy chilled froth.',
    price: 150,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/dish_himalayan_latte_1792466933805.jpg',
    preparationTimeMinutes: 4,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },

  // ==========================================
  // 5. BEVERAGES (From Menu Page 6)
  // ==========================================
  {
    id: 'item_jack_daniels',
    name: 'JACK DANIEL’S',
    categoryId: 'cat_beverages',
    description: 'Tennessee sour mash whiskey known for its mellow balance of caramel, vanilla, and toasted oak notes.',
    price: 380,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 2,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_jack_serve',
        name: 'Serving Style',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_jack_rocks', name: 'On the Rocks', priceModifier: 0 },
          { id: 'opt_jack_neat', name: 'Neat', priceModifier: 0 },
          { id: 'opt_jack_coke', name: 'With Chilled Coke', priceModifier: 30 }
        ]
      }
    ]
  },
  {
    id: 'item_black_label',
    name: 'BLACK LABEL',
    categoryId: 'cat_beverages',
    description: 'Johnnie Walker Black Label 12-Year blended Scotch whisky with rich dried fruit, smoke, and cedar aromas.',
    price: 380,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 2,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_bl_serve',
        name: 'Serving Style',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_bl_rocks', name: 'On the Rocks', priceModifier: 0 },
          { id: 'opt_bl_neat', name: 'Neat', priceModifier: 0 },
          { id: 'opt_bl_water', name: 'With Dash of Mineral Water', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_red_label',
    name: 'RED LABEL',
    categoryId: 'cat_beverages',
    description: 'Johnnie Walker Red Label scotch with bold, vibrant spices and a long smoky finish.',
    price: 300,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 2,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_double_black',
    name: 'DOUBLE BLACK',
    categoryId: 'cat_beverages',
    description: 'Intense, smoky interpretation of Black Label, aged in heavily charred oak casks for profound depth.',
    price: 420,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 2,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_k5',
    name: 'K5',
    categoryId: 'cat_beverages',
    description: 'Bhutan’s premier coronation whiskey, specially crafted to honor the 5th Druk Gyalpo with smooth grain warmth.',
    price: 280,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 2,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_misty_peak',
    name: 'MISTY PEAK',
    categoryId: 'cat_beverages',
    description: 'Artisanal Himalayan small-batch craft whiskey with subtle alpine heather and honeyed malt notes.',
    price: 260,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 2,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_lager',
    name: 'LAGER',
    categoryId: 'cat_beverages',
    description: 'Crisp, refreshing golden lager beer served ice cold with a bright malt finish.',
    price: 160,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Gluten'],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 2,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_11000',
    name: '11,000',
    categoryId: 'cat_beverages',
    description: 'Renowned super-strong Bhutanese malt lager with high gravity and rich body.',
    price: 180,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: ['Gluten'],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 2,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_high_land',
    name: 'HIGH LAND',
    categoryId: 'cat_beverages',
    description: 'Traditional Bhutanese highland spirit distilled with pure mountain glacier water.',
    price: 240,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 2,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_soju',
    name: 'SOJU',
    categoryId: 'cat_beverages',
    description: 'Clear, smooth Korean distilled spirit served chilled in traditional small glasses.',
    price: 320,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 2,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_breezer',
    name: 'BREEZER',
    categoryId: 'cat_beverages',
    description: 'Refreshing fruit-infused alcoholic cooler served over ice.',
    price: 160,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 2,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_breezer_flavor',
        name: 'Flavor',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_br_cranberry', name: 'Cranberry', priceModifier: 0 },
          { id: 'opt_br_orange', name: 'Orange', priceModifier: 0 },
          { id: 'opt_br_blackberry', name: 'Blackberry', priceModifier: 0 }
        ]
      }
    ]
  },
  {
    id: 'item_coke_can',
    name: 'COKE (CAN)',
    categoryId: 'cat_beverages',
    description: 'Classic Coca-Cola 330ml chilled can served with ice and lemon slice upon request.',
    price: 60,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 1,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_sprite_can',
    name: 'SPRITE (CAN)',
    categoryId: 'cat_beverages',
    description: 'Refreshing lemon-lime Sprite 330ml chilled can served with ice.',
    price: 60,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 1,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_lipton',
    name: 'LIPTON',
    categoryId: 'cat_beverages',
    description: 'Chilled Lipton iced tea in refreshing peach or lemon flavor.',
    price: 70,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 1,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_water_bottle',
    name: 'WATER (1000ML/ 500ML)',
    categoryId: 'cat_beverages',
    description: 'Pure Himalayan natural mountain spring mineral water.',
    price: 40,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 1,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: [
      {
        id: 'grp_water_size',
        name: 'Bottle Size',
        type: 'single',
        required: true,
        options: [
          { id: 'opt_w500', name: '500ml Chilled Bottle', priceModifier: 0 },
          { id: 'opt_w1000', name: '1000ml Large Bottle', priceModifier: 20 }
        ]
      }
    ]
  },

  // ==========================================
  // 6. COCKTAILS (From Menu Page 7)
  // ==========================================
  {
    id: 'item_mojito',
    name: 'MOJITO',
    categoryId: 'cat_cocktails',
    description: 'Refreshing blend of white rum, fresh muddled mint leaves, tart lime wedges, pure cane sugar, and sparkling club soda.',
    price: 350,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_blue_lagoon',
    name: 'BLUE LAGOON',
    categoryId: 'cat_cocktails',
    description: 'Electric blue cocktail made with vodka, Blue Curaçao liqueur, and zesty fresh lemonade over crushed ice.',
    price: 360,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_margarita',
    name: 'MARGARITA',
    categoryId: 'cat_cocktails',
    description: 'Crisp tequila, triple sec, and freshly pressed lime juice, served in a chilled glass with a Himalayan pink salt rim.',
    price: 370,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_tequila_sunrise',
    name: 'TEQUILA SUNRISE',
    categoryId: 'cat_cocktails',
    description: 'Vibrant layers of tequila, freshly squeezed orange juice, and rich red grenadine giving a radiant sunrise effect.',
    price: 360,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 4,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_cosmopolitan',
    name: 'COSMOPOLITAN',
    categoryId: 'cat_cocktails',
    description: 'Sophisticated cocktail combining citrus vodka, triple sec, tart cranberry juice, and freshly squeezed lime.',
    price: 370,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_whiskey_sour',
    name: 'WHISKEY SOUR',
    categoryId: 'cat_cocktails',
    description: 'Smooth bourbon whiskey shaken with freshly squeezed lemon juice, cane sugar, and aromatic Angostura bitters.',
    price: 360,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 5,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_daiquiri',
    name: 'DAIQUIRI',
    categoryId: 'cat_cocktails',
    description: 'Classic Cuban recipe with fine white rum, fresh lime juice, and simple cane syrup, shaken ice-cold.',
    price: 350,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 4,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_sex_on_the_beach',
    name: 'SEX ON THE BEACH',
    categoryId: 'cat_cocktails',
    description: 'Fruity cocktail of vodka, peach schnapps, orange juice, and cranberry juice served over crushed ice.',
    price: 380,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 4,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_screwdriver',
    name: 'SCREWDRIVER',
    categoryId: 'cat_cocktails',
    description: 'Highball drink made with smooth triple-distilled vodka and fresh sweet orange juice garnished with an orange slice.',
    price: 320,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 3,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },

  // ==========================================
  // 7. MOCKTAILS (From Menu Page 7)
  // ==========================================
  {
    id: 'item_virgin_mojito',
    name: 'VIRGIN MOJITO',
    categoryId: 'cat_mocktails',
    description: 'Muddled fresh garden mint, crushed lime wedges, cane sugar syrup, and fizzy sparkling soda over crushed ice.',
    price: 180,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 4,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_blue_lagoon_mocktail',
    name: 'BLUE LAGOON MOCKTAIL',
    categoryId: 'cat_mocktails',
    description: 'Non-alcoholic Blue Curaçao syrup mixed with zesty citrus lime, chilled Sprite, and crushed ice.',
    price: 190,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 4,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_shirley_temple',
    name: 'SHIRLEY TEMPLE',
    categoryId: 'cat_mocktails',
    description: 'Classic mocktail of ginger ale or lemon-lime soda with sweet grenadine, garnished with a maraschino cherry.',
    price: 180,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 3,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_lemon_mint_cooler',
    name: 'LEMON MINT COOLER',
    categoryId: 'cat_mocktails',
    description: 'Freshly squeezed mountain lemon, bruised sweet mint, and chilled Himalayan water with a touch of rock salt.',
    price: 160,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 3,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_sunrise_mocktail',
    name: 'SUNRISE MOCKTAIL',
    categoryId: 'cat_mocktails',
    description: 'Chilled natural orange juice layered with a sweet grenadine base, creating an eye-catching mountain sunrise gradient.',
    price: 190,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 3,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  },
  {
    id: 'item_cranberry_spritzer',
    name: 'CRANBERRY SPRITZER',
    categoryId: 'cat_mocktails',
    description: 'Tart mountain cranberry juice topped with bubbly sparkling soda, fresh lime squeeze, and fresh rosemary sprig.',
    price: 180,
    dietType: 'veg',
    isAvailable: true,
    soldOut: false,
    allergens: [],
    imageUrl: '/src/assets/images/hero_cafe_ambiance_1792466932618.jpg',
    preparationTimeMinutes: 3,
    timeSlot: 'all_day',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    customizationGroups: []
  }
];
