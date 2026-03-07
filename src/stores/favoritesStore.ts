import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface FavoriteStop {
  stopId: number;
  stopName: string;
  routeType: number;
  routeName?: string;
  latitude?: number;
  longitude?: number;
}

interface FavoritesState {
  favorites: FavoriteStop[];
  addFavorite: (stop: FavoriteStop) => void;
  removeFavorite: (stopId: number, routeType: number) => void;
  isFavorite: (stopId: number, routeType: number) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      addFavorite: (stop) =>
        set((state) => ({
          favorites: [...state.favorites, stop],
        })),
      removeFavorite: (stopId, routeType) =>
        set((state) => ({
          favorites: state.favorites.filter(
            (f) => !(f.stopId === stopId && f.routeType === routeType)
          ),
        })),
      isFavorite: (stopId, routeType) =>
        get().favorites.some(
          (f) => f.stopId === stopId && f.routeType === routeType
        ),
    }),
    {
      name: 'ptv-favorites',
    }
  )
);
