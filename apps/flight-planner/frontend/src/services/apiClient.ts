import axios, { AxiosError } from 'axios'
import toast from 'react-hot-toast'

import { API_CONSTANTS } from '../utils/constants'

const toastOnce = (message: string) => {
  toast.error(message, { id: message })
}

export const apiClient = axios.create({
  baseURL: '/api',
  timeout: API_CONSTANTS.timeout,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const config = error.config as unknown as {
      suppressToast?: boolean
      url?: string
      method?: string
    }
    const suppressToast = Boolean(config?.suppressToast)

    if (!suppressToast) {
      if (error.response?.status === 429) {
        toastOnce('Too many requests. Please wait a moment.')
      } else if (error.response?.status === 500) {
        toastOnce('Server error. Please try again later.')
      } else if (error.response?.status === 404) {
        toastOnce('Resource not found.')
      } else if (!error.response) {
        toastOnce('Network error. Check your connection.')
      } else if (
        error.response?.data &&
        typeof error.response.data === 'object' &&
        'detail' in error.response.data
      ) {
        toastOnce(String(error.response.data.detail))
      }
    }
    return Promise.reject(error)
  },
)
