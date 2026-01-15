import { useMutation, UseMutationResult } from 'react-query'
import toast from 'react-hot-toast'

interface UseApiMutationOptions<TData> {
  onSuccess?: (data: TData) => void
  onError?: (error: Error) => void
  successMessage?: string
  errorMessage?: string
}

export function useApiMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: UseApiMutationOptions<TData>,
): UseMutationResult<TData, Error, TVariables> {
  return useMutation<TData, Error, TVariables>(mutationFn, {
    onSuccess: (data) => {
      if (options?.successMessage) {
        toast.success(options.successMessage)
      }
      options?.onSuccess?.(data)
    },
    onError: (error) => {
      if (options?.errorMessage) {
        toast.error(options.errorMessage)
      }
      options?.onError?.(error)
    },
  })
}
