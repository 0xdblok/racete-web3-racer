export type PlayerProfile = {
  id: string;
  wallet_address: string;
  username: string | null;
  earned_race_cash: number;
  purchased_race_cash: number;
  total_token_spent: number;
  season_token_spent: number;
};

export type PlayerCar = {
  id: string;
  wallet_address: string;
  car_id: string;
  engine_level: number;
  tires_level: number;
  nitro_level: number;
  handling_level: number;
  power_rating: number;
  is_selected: boolean;
};

export type PlayerInitResponse = {
  player: PlayerProfile;
  ownedCars: PlayerCar[];
  selectedCar: PlayerCar | null;
};
