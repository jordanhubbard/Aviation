import { useLocalStorage } from './useLocalStorage'
import { STORAGE_KEYS } from '../utils/constants'

export interface Favorite {
  code: string
  name?: string
  type: 'airport' | 'route'
  addedAt: number
}

export function useFavorites() {
  const [favorites, setFavorites] = useLocalStorage<Favorite[]>(STORAGE_KEYS.favorites, [])

  const addFavorite = (code: string, name?: string, type: Favorite['type'] = 'airport') => {
    setFavorites((prev) => {
      // Don't add duplicates
      if (prev.some((fav) => fav.code === code && fav.type === type)) {
        return prev
      }
      return [...prev, { code, name, type, addedAt: Date.now() }]
    })
  }

  const removeFavorite = (code: string, type: Favorite['type'] = 'airport') => {
    setFavorites((prev) => prev.filter((fav) => !(fav.code === code && fav.type === type)))
  }

  const isFavorite = (code: string, type: Favorite['type'] = 'airport'): boolean => {
    return favorites.some((fav) => fav.code === code && fav.type === type)
  }

  const getFavoritesByType = (type: Favorite['type']) => {
    return favorites.filter((fav) => fav.type === type).sort((a, b) => b.addedAt - a.addedAt)
  }

  const clearFavorites = () => {
    setFavorites([])
  }

  return {
    favorites,
    addFavorite,
    removeFavorite,
    isFavorite,
    getFavoritesByType,
    clearFavorites,
  }
}
