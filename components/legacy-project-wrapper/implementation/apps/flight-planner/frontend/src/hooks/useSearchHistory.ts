import { useLocalStorage } from './useLocalStorage'
import { STORAGE_KEYS } from '../utils/constants'

interface SearchHistoryItem {
  query: string
  timestamp: number
  type: 'airport' | 'weather' | 'flight'
}

const MAX_HISTORY_ITEMS = 10

export function useSearchHistory() {
  const [history, setHistory] = useLocalStorage<SearchHistoryItem[]>(STORAGE_KEYS.searchHistory, [])

  const addToHistory = (query: string, type: SearchHistoryItem['type']) => {
    setHistory((prev) => {
      const filtered = prev.filter((item) => item.query !== query)
      const newHistory = [{ query, timestamp: Date.now(), type }, ...filtered].slice(
        0,
        MAX_HISTORY_ITEMS,
      )
      return newHistory
    })
  }

  const removeFromHistory = (query: string) => {
    setHistory((prev) => prev.filter((item) => item.query !== query))
  }

  const clearHistory = () => {
    setHistory([])
  }

  const getRecentSearches = (type?: SearchHistoryItem['type'], limit = 5) => {
    let filtered = history
    if (type) {
      filtered = history.filter((item) => item.type === type)
    }
    return filtered.slice(0, limit)
  }

  return {
    history,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getRecentSearches,
  }
}
