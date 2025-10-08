import { Municipality, Dish, Restaurant, SearchResult } from '../types';
// Mock Municipalities Data
export const mockMunicipalities: Municipality[] = [{
  id: 'malolos',
  name: 'Malolos',
  description: 'Malolos is the capital city of Bulacan province known for its historical significance and rich culinary heritage.',
  coordinates: [14.8527, 120.816],
  image: 'https://images.unsplash.com/photo-1605538032404-d7f061675571?q=80&w=2070&auto=format&fit=crop',
  dishes: ['pancit-malolos', 'kalamay-buna', 'gorgorya']
}, {
  id: 'baliuag',
  name: 'Baliuag',
  description: 'Baliuag is known for its longganisa (Filipino sausage) and other traditional delicacies.',
  coordinates: [14.9545, 120.8968],
  image: 'https://images.unsplash.com/photo-1600093463592-8e36ae95ef56?q=80&w=2070&auto=format&fit=crop',
  dishes: ['longganisang-baliuag', 'inipit', 'minasa']
}, {
  id: 'san-miguel',
  name: 'San Miguel',
  description: 'San Miguel is famous for its rice cakes and traditional Filipino pastries.',
  coordinates: [15.1453, 120.9789],
  image: 'https://images.unsplash.com/photo-1551339352-e875aef08b83?q=80&w=1974&auto=format&fit=crop',
  dishes: ['putong-polo', 'tinapang-bangus', 'biko']
}, {
  id: 'hagonoy',
  name: 'Hagonoy',
  description: 'Hagonoy is known for its seafood dishes due to its proximity to Manila Bay.',
  coordinates: [14.8345, 120.7307],
  image: 'https://images.unsplash.com/photo-1579684947550-22e945225d9a?q=80&w=2074&auto=format&fit=crop',
  dishes: ['adobong-pusit', 'binagoongang-baboy', 'rellenong-bangus']
}, {
  id: 'bustos',
  name: 'Bustos',
  description: 'Bustos is known for its rice products and traditional Filipino snacks.',
  coordinates: [14.9501, 120.9147],
  image: 'https://images.unsplash.com/photo-1604909052743-94e838986d24?q=80&w=2080&auto=format&fit=crop',
  dishes: ['bustos-chicharon', 'nilupak', 'bulacan-pastillas']
}];
// Mock Dishes Data
export const mockDishes: Dish[] = [{
  id: 'pancit-malolos',
  name: 'Pancit Malolos',
  description: 'A traditional noodle dish made with rice noodles, meat, and vegetables, seasoned with a special sauce.',
  history: 'Pancit Malolos has been a staple dish in Bulacan since the Spanish colonial period. It was influenced by Chinese cuisine but adapted to local tastes.',
  culturalSignificance: 'This dish is commonly served during celebrations and fiestas in Malolos, symbolizing long life and prosperity.',
  ingredients: ['rice noodles', 'pork', 'shrimp', 'chicken', 'carrots', 'cabbage', 'soy sauce', 'calamansi'],
  image: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?q=80&w=2080&auto=format&fit=crop',
  municipalityId: 'malolos',
  restaurantIds: ['resto-1', 'resto-2', 'resto-3'],
  rating: 4.7
}, {
  id: 'kalamay-buna',
  name: 'Kalamay Buna',
  description: 'A sticky sweet rice cake made with glutinous rice, coconut milk, and brown sugar.',
  history: "Kalamay Buna originated from Malolos and has been passed down through generations. It's a traditional dessert often made during special occasions.",
  culturalSignificance: 'This dessert represents the sweetness of Filipino hospitality and is often given as gifts to visitors.',
  ingredients: ['glutinous rice', 'coconut milk', 'brown sugar', 'latik'],
  image: 'https://images.unsplash.com/photo-1610192244261-3f33de3f72e1?q=80&w=2069&auto=format&fit=crop',
  municipalityId: 'malolos',
  restaurantIds: ['resto-2', 'resto-5'],
  rating: 4.5
}, {
  id: 'longganisang-baliuag',
  name: 'Longganisang Baliuag',
  description: 'A type of Filipino sausage made with ground pork, garlic, and spices, known for its garlicky flavor.',
  history: "Longganisang Baliuag has been a specialty of Baliuag since the early 20th century. It's made using a secret family recipe passed down through generations.",
  culturalSignificance: 'This sausage is a source of pride for the people of Baliuag and is often served during breakfast with garlic rice and eggs.',
  ingredients: ['ground pork', 'garlic', 'vinegar', 'black pepper', 'salt', 'sugar'],
  image: 'https://images.unsplash.com/photo-1588690793273-3cbc6a8d917a?q=80&w=2043&auto=format&fit=crop',
  municipalityId: 'baliuag',
  restaurantIds: ['resto-3', 'resto-4'],
  rating: 4.8
}, {
  id: 'putong-polo',
  name: 'Putong Polo',
  description: 'A steamed rice cake topped with cheese or salted egg, a specialty of San Miguel.',
  history: 'Putong Polo originated in the Polo district of San Miguel. It was initially made as an offering during religious festivals.',
  culturalSignificance: "These rice cakes are often used in the 'pamisa' or thanksgiving ritual after a successful harvest.",
  ingredients: ['rice flour', 'sugar', 'baking powder', 'water', 'cheese', 'salted egg'],
  image: 'https://images.unsplash.com/photo-1614707267537-b85aaf00c4b7?q=80&w=2044&auto=format&fit=crop',
  municipalityId: 'san-miguel',
  restaurantIds: ['resto-1', 'resto-5'],
  rating: 4.3
}, {
  id: 'adobong-pusit',
  name: 'Adobong Pusit',
  description: 'Squid cooked in soy sauce, vinegar, and garlic, a specialty of coastal Hagonoy.',
  history: 'Adobong Pusit became popular in Hagonoy due to its abundant supply of fresh squid from Manila Bay.',
  culturalSignificance: 'This dish represents the fishing heritage of Hagonoy and is often served during town fiestas.',
  ingredients: ['squid', 'soy sauce', 'vinegar', 'garlic', 'black pepper', 'bay leaves', 'cooking oil'],
  image: 'https://images.unsplash.com/photo-1626645738196-c2a7c87a8f58?q=80&w=2070&auto=format&fit=crop',
  municipalityId: 'hagonoy',
  restaurantIds: ['resto-2', 'resto-4'],
  rating: 4.6
}, {
  id: 'bustos-chicharon',
  name: 'Bustos Chicharon',
  description: 'Crispy pork rinds made through a special process, making them extra crunchy.',
  history: 'Bustos Chicharon has been a specialty of the town since the 1950s when a local family perfected the recipe.',
  culturalSignificance: "This snack is often given as 'pasalubong' (gift) when visiting friends and relatives from other places.",
  ingredients: ['pork skin', 'salt', 'cooking oil', 'garlic powder'],
  image: 'https://images.unsplash.com/photo-1573551089778-46a7abc39d9f?q=80&w=2016&auto=format&fit=crop',
  municipalityId: 'bustos',
  restaurantIds: ['resto-3', 'resto-5'],
  rating: 4.9
}];

export const mockRestaurants: Restaurant[] = [{
  id: 'resto-1',
  name: 'Kamayan sa Palaisdaan',
  description: 'A traditional Filipino restaurant serving authentic Bulacan dishes in a rustic setting with fish ponds.',
  address: 'Brgy. Panasahan, Malolos City, Bulacan',
  coordinates: [14.8601, 120.815],
  contactNumber: '+63 44 791 2371',
  website: 'http://www.kamayansamalolos.com',
  openingHours: {
    Monday: '10:00 AM - 9:00 PM',
    Tuesday: '10:00 AM - 9:00 PM',
    Wednesday: '10:00 AM - 9:00 PM',
    Thursday: '10:00 AM - 9:00 PM',
    Friday: '10:00 AM - 10:00 PM',
    Saturday: '10:00 AM - 10:00 PM',
    Sunday: '10:00 AM - 10:00 PM'
  },
  priceRange: '₱₱',
  cuisineType: ['Filipino', 'Bulacan Specialties', 'Seafood'],
  dishIds: ['pancit-malolos', 'putong-polo'],
  images: ['https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop', 'https://images.unsplash.com/photo-1559339352-11d035aa65de?q=80&w=2070&auto=format&fit=crop'],
  rating: 4.7,
  reviews: [{
    id: 'rev-1',
    userId: 'user-1',
    userName: 'Maria Santos',
    userImage: 'https://randomuser.me/api/portraits/women/12.jpg',
    rating: 5,
    comment: 'The Pancit Malolos here is the best in the province! Authentic flavors and generous servings.',
    date: '2023-10-15',
    helpful: 24,
    restaurantId: 'resto-1'
  }, {
    id: 'rev-2',
    userId: 'user-2',
    userName: 'Juan Dela Cruz',
    userImage: 'https://randomuser.me/api/portraits/men/22.jpg',
    rating: 4,
    comment: 'Great ambiance with the fish ponds. The putong polo was delicious but a bit pricey.',
    date: '2023-09-28',
    helpful: 12,
    restaurantId: 'resto-1'
  }]
}, {
  id: 'resto-2',
  name: 'Bahay Kubo Restaurant',
  description: 'A restaurant housed in a traditional Filipino hut serving home-style Bulacan cuisine.',
  address: 'National Highway, Malolos City, Bulacan',
  coordinates: [14.8527, 120.816],
  contactNumber: '+63 44 794 1234',
  openingHours: {
    Monday: '11:00 AM - 9:00 PM',
    Tuesday: '11:00 AM - 9:00 PM',
    Wednesday: '11:00 AM - 9:00 PM',
    Thursday: '11:00 AM - 9:00 PM',
    Friday: '11:00 AM - 10:00 PM',
    Saturday: '11:00 AM - 10:00 PM',
    Sunday: '11:00 AM - 9:00 PM'
  },
  priceRange: '₱',
  cuisineType: ['Filipino', 'Home-style Cooking'],
  dishIds: ['pancit-malolos', 'kalamay-buna', 'adobong-pusit'],
  images: ['https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?q=80&w=2070&auto=format&fit=crop', 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1974&auto=format&fit=crop'],
  rating: 4.5,
  reviews: [{
    id: 'rev-3',
    userId: 'user-3',
    userName: 'Elena Reyes',
    userImage: 'https://randomuser.me/api/portraits/women/33.jpg',
    rating: 5,
    comment: "The kalamay buna here reminds me of my grandmother's cooking. Truly authentic!",
    date: '2023-10-05',
    helpful: 18,
    restaurantId: 'resto-2'
  }]
}, {
  id: 'resto-3',
  name: 'Baliuag Lechon Manok',
  description: 'Famous for its roasted chicken and longganisa, this restaurant offers traditional Baliuag specialties.',
  address: 'Poblacion, Baliuag, Bulacan',
  coordinates: [14.9545, 120.8968],
  contactNumber: '+63 44 766 5678',
  openingHours: {
    Monday: '9:00 AM - 8:00 PM',
    Tuesday: '9:00 AM - 8:00 PM',
    Wednesday: '9:00 AM - 8:00 PM',
    Thursday: '9:00 AM - 8:00 PM',
    Friday: '9:00 AM - 9:00 PM',
    Saturday: '9:00 AM - 9:00 PM',
    Sunday: '9:00 AM - 8:00 PM'
  },
  priceRange: '₱',
  cuisineType: ['Filipino', 'Baliuag Specialties'],
  dishIds: ['longganisang-baliuag', 'pancit-malolos', 'bustos-chicharon'],
  images: ['https://images.unsplash.com/photo-1555396273-367ea4eb4db5?q=80&w=1974&auto=format&fit=crop', 'https://images.unsplash.com/photo-1601050690597-df0568f70950?q=80&w=2071&auto=format&fit=crop'],
  rating: 4.8,
  reviews: [{
    id: 'rev-4',
    userId: 'user-4',
    userName: 'Ricardo Lim',
    userImage: 'https://randomuser.me/api/portraits/men/44.jpg',
    rating: 5,
    comment: 'Best longganisa in Bulacan! I always buy some to take home whenever I visit.',
    date: '2023-09-10',
    helpful: 32,
    restaurantId: 'resto-3'
  }]
}, {
  id: 'resto-4',
  name: 'Hagonoy Seafood Grill',
  description: 'Specializing in fresh seafood dishes from Manila Bay, particularly famous for its grilled seafood and adobong pusit.',
  address: "Fisherman's Wharf, Hagonoy, Bulacan",
  coordinates: [14.8345, 120.7307],
  contactNumber: '+63 44 793 8901',
  openingHours: {
    Monday: '10:00 AM - 9:00 PM',
    Tuesday: '10:00 AM - 9:00 PM',
    Wednesday: '10:00 AM - 9:00 PM',
    Thursday: '10:00 AM - 9:00 PM',
    Friday: '10:00 AM - 10:00 PM',
    Saturday: '10:00 AM - 10:00 PM',
    Sunday: '10:00 AM - 10:00 PM'
  },
  priceRange: '₱₱',
  cuisineType: ['Seafood', 'Filipino'],
  dishIds: ['adobong-pusit', 'longganisang-baliuag'],
  images: ['https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop', 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?q=80&w=1925&auto=format&fit=crop'],
  rating: 4.6,
  reviews: [{
    id: 'rev-5',
    userId: 'user-5',
    userName: 'Sofia Garcia',
    userImage: 'https://randomuser.me/api/portraits/women/55.jpg',
    rating: 4,
    comment: 'The adobong pusit is exceptional! Fresh squid and perfect seasoning.',
    date: '2023-10-20',
    helpful: 15,
    restaurantId: 'resto-4'
  }]
}, {
  id: 'resto-5',
  name: 'San Miguel Delicacies',
  description: 'A family-owned restaurant specializing in traditional rice cakes and pastries from San Miguel.',
  address: 'Town Plaza, San Miguel, Bulacan',
  coordinates: [15.1453, 120.9789],
  contactNumber: '+63 44 764 5432',
  openingHours: {
    Monday: '7:00 AM - 7:00 PM',
    Tuesday: '7:00 AM - 7:00 PM',
    Wednesday: '7:00 AM - 7:00 PM',
    Thursday: '7:00 AM - 7:00 PM',
    Friday: '7:00 AM - 8:00 PM',
    Saturday: '7:00 AM - 8:00 PM',
    Sunday: '7:00 AM - 8:00 PM'
  },
  priceRange: '₱',
  cuisineType: ['Filipino Desserts', 'Rice Cakes'],
  dishIds: ['putong-polo', 'kalamay-buna', 'bustos-chicharon'],
  images: ['https://images.unsplash.com/photo-1587314168485-3236d6710814?q=80&w=2078&auto=format&fit=crop', 'https://images.unsplash.com/photo-1600335895229-6e75511892c8?q=80&w=2187&auto=format&fit=crop'],
  rating: 4.3,
  reviews: [{
    id: 'rev-6',
    userId: 'user-6',
    userName: 'Antonio Mendoza',
    userImage: 'https://randomuser.me/api/portraits/men/66.jpg',
    rating: 4,
    comment: 'Their putong polo is authentic and tasty. Great place to try traditional Bulacan desserts.',
    date: '2023-09-15',
    helpful: 9,
    restaurantId: 'resto-5'
  }]
}];
// Mock Search Results
export const mockSearchResults: SearchResult[] = [{
  type: 'dish',
  id: 'pancit-malolos',
  name: 'Pancit Malolos',
  image: 'https://images.unsplash.com/photo-1585238342024-78d387f4a707?q=80&w=2080&auto=format&fit=crop',
  description: 'A traditional noodle dish from Malolos'
}, {
  type: 'dish',
  id: 'longganisang-baliuag',
  name: 'Longganisang Baliuag',
  image: 'https://images.unsplash.com/photo-1588690793273-3cbc6a8d917a?q=80&w=2043&auto=format&fit=crop',
  description: 'Famous Filipino sausage from Baliuag'
}, {
  type: 'restaurant',
  id: 'resto-1',
  name: 'Kamayan sa Palaisdaan',
  image: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=2070&auto=format&fit=crop',
  description: 'Traditional Filipino restaurant in Malolos'
}, {
  type: 'municipality',
  id: 'malolos',
  name: 'Malolos',
  image: 'https://images.unsplash.com/photo-1605538032404-d7f061675571?q=80&w=2070&auto=format&fit=crop',
  description: 'The capital city of Bulacan province'
}, {
  type: 'restaurant',
  id: 'resto-4',
  name: 'Hagonoy Seafood Grill',
  image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=2070&auto=format&fit=crop',
  description: 'Fresh seafood dishes from Manila Bay'
}];