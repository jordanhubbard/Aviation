import axios, { AxiosError } from 'axios'
import toast from 'react-hot-toast'

import { reportFrontendErrorToBeads } from '../utils/beadsReporting'
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

    // Avoid recursion if the beads endpoint itself errors.
    const url = String(config?.url ?? '')
    const isBeadsEndpoint = url.includes('/beads/')

    const status = error.response?.status
    const shouldReport =
      !isBeadsEndpoint &&
      (status == null || status >= 500 || (status >= 400 && status < 500 && status !== 404))

    if (shouldReport) {
      const detail =
        error.response?.data &&
        typeof error.response.data === 'object' &&
        'detail' in error.response.data
          ? String((error.response.data as { detail: unknown }).detail)
          : undefined

      void reportFrontendErrorToBeads(error, {
        kind: 'api-client',
        extra: {
          status,
          method: config?.method,
          url,
          detail,
        },
      })
    }

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
