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
  { id: "street-rat", name: "Street Rat", class: "D", modelUrl: "/models/cars/street-rat/scene.gltf", basePowerRating: 120, priceRaceCash: 0, priceToken: 0, isStarter: true, vibe: "Free starter street build", stats: { speed: 35, acceleration: 40, handling: 50, nitro: 25 } },
  { id: "bavaro-coupe", name: "Bavaro Coupe", class: "C", modelUrl: "/models/cars/bavaro-coupe/scene.gltf", basePowerRating: 240, priceRaceCash: 40000, priceToken: 0, isStarter: false, vibe: "Sharp sports coupe", stats: { speed: 48, acceleration: 50, handling: 58, nitro: 40 } },
  { id: "aurox-v10", name: "Aurox V10", class: "B", modelUrl: "/models/cars/aurox-v10.glb", basePowerRating: 390, priceRaceCash: 120000, priceToken: 0, isStarter: false, vibe: "Mid-engine V10 supercar", stats: { speed: 62, acceleration: 62, handling: 64, nitro: 58 } },
  { id: "sturm-rs", name: "Sturm RS", class: "B+", modelUrl: "/models/cars/sturm-rs.glb", basePowerRating: 520, priceRaceCash: 250000, priceToken: 25000, isStarter: false, vibe: "Track-focused precision build", stats: { speed: 70, acceleration: 68, handling: 78, nitro: 66 } },
  { id: "furia-gt", name: "Furia GT", class: "A", modelUrl: "/models/cars/furia-gt/scene.gltf", basePowerRating: 720, priceRaceCash: 500000, priceToken: 75000, isStarter: false, vibe: "Redline exotic GT", stats: { speed: 84, acceleration: 82, handling: 78, nitro: 82 } },
  { id: "toro-x", name: "Toro X", class: "S", modelUrl: "/models/cars/toro-x/scene.gltf", basePowerRating: 900, priceRaceCash: 1000000, priceToken: 200000, isStarter: false, vibe: "Aggressive hypercar monster", stats: { speed: 96, acceleration: 92, handling: 86, nitro: 95 } },
];

export const STARTER_CAR_ID = "street-rat";
