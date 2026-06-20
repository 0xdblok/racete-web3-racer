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
  // === ORIGINAL 6 — renamed to real models ===

  {
    id: "street-rat",
    name: "Tesla Cybertruck",
    class: "C",
    modelUrl: "/models/cars/street-rat/scene.gltf",
    basePowerRating: 280,
    priceRaceCash: 0,
    priceToken: 0,
    isStarter: true,
    vibe: "Free starter electric truck",
    stats: { speed: 50, acceleration: 72, handling: 48, nitro: 55 },
  },

  {
    id: "bavaro-coupe",
    name: "BMW M4 Competition",
    class: "B",
    modelUrl: "/models/cars/bavaro-coupe/scene.gltf",
    basePowerRating: 480,
    priceRaceCash: 40000,
    priceToken: 0,
    isStarter: false,
    vibe: "Precision German sports coupe",
    stats: { speed: 68, acceleration: 58, handling: 72, nitro: 62 },
  },

  {
    id: "aurox-v10",
    name: "Audi e-tron GT quattro",
    class: "B",
    modelUrl: "",
    basePowerRating: 450,
    priceRaceCash: 120000,
    priceToken: 0,
    isStarter: false,
    vibe: "Electric grand tourer",
    stats: { speed: 62, acceleration: 56, handling: 68, nitro: 55 },
  },

  {
    id: "sturm-rs",
    name: "Bugatti Chiron Pur Sport",
    class: "S",
    modelUrl: "",
    basePowerRating: 940,
    priceRaceCash: 250000,
    priceToken: 25000,
    isStarter: false,
    vibe: "Ultimate hypercar — 1,500 hp quad-turbo W16",
    stats: { speed: 96, acceleration: 90, handling: 80, nitro: 94 },
  },

  {
    id: "furia-gt",
    name: "Ferrari SF90 Spider",
    class: "S",
    modelUrl: "/models/cars/furia-gt/scene.gltf",
    basePowerRating: 900,
    priceRaceCash: 500000,
    priceToken: 75000,
    isStarter: false,
    vibe: "Hybrid V8 hypercar from Maranello",
    stats: { speed: 92, acceleration: 88, handling: 84, nitro: 90 },
  },

  {
    id: "toro-x",
    name: "Lamborghini Urus",
    class: "A",
    modelUrl: "/models/cars/toro-x/scene.gltf",
    basePowerRating: 720,
    priceRaceCash: 1000000,
    priceToken: 200000,
    isStarter: false,
    vibe: "Super SUV — 641 hp twin-turbo V8",
    stats: { speed: 76, acceleration: 66, handling: 62, nitro: 72 },
  },

  // === NEW 11 FROM SKETCHFAB — renamed to real models ===

  {
    id: "nova-s1",
    name: "Audi Nuvolari concept",
    class: "B+",
    modelUrl: "/models/cars/audi-novulari/scene.gltf",
    basePowerRating: 620,
    priceRaceCash: 140000,
    priceToken: 0,
    isStarter: false,
    vibe: "Futuristic performance concept — estimated specs",
    stats: { speed: 72, acceleration: 62, handling: 74, nitro: 68 },
  },

  {
    id: "bavaro-sport",
    name: "BMW 330i",
    class: "C+",
    modelUrl: "/models/cars/bmw-330i/scene.gltf",
    basePowerRating: 380,
    priceRaceCash: 50000,
    priceToken: 0,
    isStarter: false,
    vibe: "Precision sport sedan — 255 hp",
    stats: { speed: 58, acceleration: 42, handling: 66, nitro: 45 },
  },

  {
    id: "zephyr-z8",
    name: "Subaru BRZ",
    class: "C",
    modelUrl: "/models/cars/subaru-brz/scene.gltf",
    basePowerRating: 350,
    priceRaceCash: 45000,
    priceToken: 0,
    isStarter: false,
    vibe: "Lightweight rear-drive drift coupe",
    stats: { speed: 52, acceleration: 36, handling: 78, nitro: 40 },
  },

  {
    id: "bavaro-m5",
    name: "BMW M5 2025",
    class: "A",
    modelUrl: "/models/cars/bmw-m5-sedan/scene.gltf",
    basePowerRating: 730,
    priceRaceCash: 300000,
    priceToken: 30000,
    isStarter: false,
    vibe: "Executive autobahn missile — 717 hp hybrid V8",
    stats: { speed: 78, acceleration: 68, handling: 72, nitro: 72 },
  },

  {
    id: "toro-se",
    name: "Lamborghini Urus SE 2025",
    class: "A",
    modelUrl: "/models/cars/lambo-urus-se/scene.gltf",
    basePowerRating: 760,
    priceRaceCash: 600000,
    priceToken: 80000,
    isStarter: false,
    vibe: "Hybrid super SUV — 789 hp",
    stats: { speed: 82, acceleration: 70, handling: 66, nitro: 76 },
  },

  {
    id: "valor-gt",
    name: "Aston Martin Valiant",
    class: "S",
    modelUrl: "/models/cars/aston-martin-valiant/scene.gltf",
    basePowerRating: 850,
    priceRaceCash: 650000,
    priceToken: 85000,
    isStarter: false,
    vibe: "Limited-edition V12 manual track weapon — 734 hp",
    stats: { speed: 90, acceleration: 72, handling: 84, nitro: 84 },
  },

  {
    id: "warp-x1",
    name: "McLaren W1 2025",
    class: "S",
    modelUrl: "/models/cars/mclaren-w1/scene.gltf",
    basePowerRating: 980,
    priceRaceCash: 1200000,
    priceToken: 250000,
    isStarter: false,
    vibe: "Ultimate hybrid hypercar — 1,258 hp",
    stats: { speed: 98, acceleration: 86, handling: 90, nitro: 98 },
  },

  {
    id: "nova-spider",
    name: "McLaren Artura Spider",
    class: "S",
    modelUrl: "/models/cars/mclaren-artura/scene.gltf",
    basePowerRating: 820,
    priceRaceCash: 550000,
    priceToken: 70000,
    isStarter: false,
    vibe: "Open-top hybrid supercar — 690 hp",
    stats: { speed: 86, acceleration: 78, handling: 86, nitro: 82 },
  },

  {
    id: "volt-w6",
    name: "BYD Seal 6 DM-i Touring",
    class: "D",
    modelUrl: "/models/cars/byd-seal-6/scene.gltf",
    basePowerRating: 200,
    priceRaceCash: 35000,
    priceToken: 0,
    isStarter: false,
    vibe: "Hybrid electric touring wagon — 215 hp combined",
    stats: { speed: 38, acceleration: 32, handling: 52, nitro: 30 },
  },

  {
    id: "volt-c5",
    name: "BYD Seal 5 DM-i",
    class: "D",
    modelUrl: "/models/cars/byd-seal-5/scene.gltf",
    basePowerRating: 190,
    priceRaceCash: 30000,
    priceToken: 0,
    isStarter: false,
    vibe: "Plug-in hybrid sedan — 212 hp",
    stats: { speed: 36, acceleration: 30, handling: 50, nitro: 28 },
  },

  {
    id: "bavaro-cs",
    name: "BMW M3 CS Touring",
    class: "A",
    modelUrl: "/models/cars/bmw-m3-cs/scene.gltf",
    basePowerRating: 700,
    priceRaceCash: 350000,
    priceToken: 40000,
    isStarter: false,
    vibe: "Wagon with supercar DNA — 543 hp",
    stats: { speed: 76, acceleration: 66, handling: 76, nitro: 72 },
  },
];

export const STARTER_CAR_ID = "street-rat";
