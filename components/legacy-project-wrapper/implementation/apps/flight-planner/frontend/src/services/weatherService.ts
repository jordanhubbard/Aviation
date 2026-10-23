import { apiClient } from './apiClient'
import type { AxiosRequestConfig } from 'axios'
import type {
  ForecastResponse,
  RouteWeatherResponse,
  WeatherData,
  WeatherRecommendationsResponse,
} from '../types'

export const weatherService = {
  getWeather: async (
    airport: string,
    opts?: {
      suppressToast?: boolean
    },
  ): Promise<WeatherData> => {
    const config: AxiosRequestConfig | undefined = opts?.suppressToast
      ? ({ suppressToast: true } as unknown as AxiosRequestConfig)
      : undefined
    const response = await apiClient.get<WeatherData>(`/weather/${airport}`, config)
    return response.data
  },

  getForecast: async (airport: string, days = 3): Promise<ForecastResponse> => {
    const response = await apiClient.get<ForecastResponse>(`/weather/${airport}/forecast`, {
      params: { days },
    })
    return response.data
  },

  getRouteWeather: async (
    points: Array<[number, number]>,
    maxPoints = 10,
  ): Promise<RouteWeatherResponse> => {
    const response = await apiClient.post<RouteWeatherResponse>('/weather/route', {
      points,
      max_points: maxPoints,
    })
    return response.data
  },

  getRecommendations: async (airport: string): Promise<WeatherRecommendationsResponse> => {
    const response = await apiClient.get<WeatherRecommendationsResponse>(
      `/weather/${airport}/recommendations`,
    )
    return response.data
  },
}
