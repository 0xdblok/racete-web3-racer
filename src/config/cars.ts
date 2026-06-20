export type CarConfig = {
  id: string;
  name: string;
  class: string;
  modelUrl: string;
  basePowerRating: number;
  priceRaceCash: number;
  priceToken: number;
  isStarter: boolean;
  vibe: string;
  stats: { speed: number; acceleration: number; handling: number; nitro: number };
};

export const CARS: CarConfig[] = [
  // === ORIGINAL 6 ===
  { id: "street-rat", name: "Street Rat", class: "D", modelUrl: "/models/cars/street-rat/scene.gltf", basePowerRating: 120, priceRaceCash: 0, priceToken: 0, isStarter: true, vibe: "Free starter street build", stats: { speed: 35, acceleration: 40, handling: 50, nitro: 25 } },
  { id: "bavaro-coupe", name: "Bavaro Coupe", class: "C", modelUrl: "/models/cars/bavaro-coupe/scene.gltf", basePowerRating: 240, priceRaceCash: 40000, priceToken: 0, isStarter: false, vibe: "Sharp sports coupe", stats: { speed: 48, acceleration: 50, handling: 58, nitro: 40 } },
  { id: "aurox-v10", name: "Aurox V10", class: "B", modelUrl: "", basePowerRating: 390, priceRaceCash: 120000, priceToken: 0, isStarter: false, vibe: "Mid-engine V10 supercar", stats: { speed: 62, acceleration: 62, handling: 64, nitro: 58 } },
  { id: "sturm-rs", name: "Sturm RS", class: "B+", modelUrl: "", basePowerRating: 520, priceRaceCash: 250000, priceToken: 25000, isStarter: false, vibe: "Track-focused precision build", stats: { speed: 70, acceleration: 68, handling: 78, nitro: 66 } },
  { id: "furia-gt", name: "Furia GT", class: "A", modelUrl: "/models/cars/furia-gt/scene.gltf", basePowerRating: 720, priceRaceCash: 500000, priceToken: 75000, isStarter: false, vibe: "Redline exotic GT", stats: { speed: 84, acceleration: 82, handling: 78, nitro: 82 } },
  { id: "toro-x", name: "Toro X", class: "S", modelUrl: "/models/cars/toro-x/scene.gltf", basePowerRating: 900, priceRaceCash: 1000000, priceToken: 200000, isStarter: false, vibe: "Aggressive hypercar monster", stats: { speed: 96, acceleration: 92, handling: 86, nitro: 95 } },

  // === NEW 11 FROM SKETCHFAB ===
  // Audi Novulari → Nova S1
  { id: "nova-s1", name: "Nova S1", class: "B", modelUrl: "/models/cars/audi-novulari/scene.gltf", basePowerRating: 410, priceRaceCash: 140000, priceToken: 0, isStarter: false, vibe: "Futuristic German performance concept", stats: { speed: 65, acceleration: 64, handling: 66, nitro: 60 } },

  // BMW 330i → Bavaro Sport
  { id: "bavaro-sport", name: "Bavaro Sport", class: "C", modelUrl: "/models/cars/bmw-330i/scene.gltf", basePowerRating: 260, priceRaceCash: 50000, priceToken: 0, isStarter: false, vibe: "Precision sport sedan", stats: { speed: 50, acceleration: 52, handling: 60, nitro: 42 } },

  // Subaru BRZ → Zephyr Z8
  { id: "zephyr-z8", name: "Zephyr Z8", class: "C", modelUrl: "/models/cars/subaru-brz/scene.gltf", basePowerRating: 250, priceRaceCash: 45000, priceToken: 0, isStarter: false, vibe: "Lightweight drift coupe", stats: { speed: 46, acceleration: 48, handling: 68, nitro: 38 } },

  // BMW M5 2025 → Bavaro M5
  { id: "bavaro-m5", name: "Bavaro M5", class: "B+", modelUrl: "/models/cars/bmw-m5-sedan/scene.gltf", basePowerRating: 550, priceRaceCash: 300000, priceToken: 30000, isStarter: false, vibe: "Executive autobahn missile", stats: { speed: 74, acceleration: 72, handling: 72, nitro: 70 } },

  // Lambo Urus SE 2025 → Toro SE
  { id: "toro-se", name: "Toro SE", class: "A", modelUrl: "/models/cars/lambo-urus-se/scene.gltf", basePowerRating: 740, priceRaceCash: 600000, priceToken: 80000, isStarter: false, vibe: "Super SUV dominance", stats: { speed: 82, acceleration: 80, handling: 72, nitro: 78 } },

  // Aston Martin Valiant 2025 → Valor GT
  { id: "valor-gt", name: "Valor GT", class: "A", modelUrl: "/models/cars/aston-martin-valiant/scene.gltf", basePowerRating: 760, priceRaceCash: 650000, priceToken: 85000, isStarter: false, vibe: "British racing aristocracy", stats: { speed: 86, acceleration: 84, handling: 76, nitro: 80 } },

  // McLaren W1 2025 → Warp X1
  { id: "warp-x1", name: "Warp X1", class: "S", modelUrl: "/models/cars/mclaren-w1/scene.gltf", basePowerRating: 950, priceRaceCash: 1200000, priceToken: 250000, isStarter: false, vibe: "Ultimate hybrid hypercar", stats: { speed: 98, acceleration: 96, handling: 88, nitro: 98 } },

  // McLaren Artura Spider 2025 → Nova Spider
  { id: "nova-spider", name: "Nova Spider", class: "A", modelUrl: "/models/cars/mclaren-artura/scene.gltf", basePowerRating: 710, priceRaceCash: 550000, priceToken: 70000, isStarter: false, vibe: "Open-top hybrid supercar", stats: { speed: 80, acceleration: 78, handling: 82, nitro: 76 } },

  // BYD Seal 6 DM-i Touring → Volt W6
  { id: "volt-w6", name: "Volt W6", class: "C", modelUrl: "/models/cars/byd-seal-6/scene.gltf", basePowerRating: 230, priceRaceCash: 35000, priceToken: 0, isStarter: false, vibe: "Electric touring efficiency", stats: { speed: 44, acceleration: 46, handling: 56, nitro: 36 } },

  // BYD Seal 5 DM-i Chazor → Volt C5
  { id: "volt-c5", name: "Volt C5", class: "C", modelUrl: "/models/cars/byd-seal-5/scene.gltf", basePowerRating: 220, priceRaceCash: 30000, priceToken: 0, isStarter: false, vibe: "Electric sedan disruptor", stats: { speed: 42, acceleration: 44, handling: 54, nitro: 34 } },

  // BMW M3 CS Touring → Bavaro CS
  { id: "bavaro-cs", name: "Bavaro CS", class: "B+", modelUrl: "/models/cars/bmw-m3-cs/scene.gltf", basePowerRating: 580, priceRaceCash: 350000, priceToken: 40000, isStarter: false, vibe: "Wagon with supercar DNA", stats: { speed: 76, acceleration: 74, handling: 74, nitro: 72 } },
];

export const STARTER_CAR_ID = "street-rat";
