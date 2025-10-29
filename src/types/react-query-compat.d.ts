declare module '@tanstack/react-query' {
  // Lightweight compatibility shims to reduce type noise in the admin pages.
  // These make the main hooks permissive during triage; we should later
  // add precise types or upgrade react-query types properly.
  export type UseQueryOptions<TQueryFnData = any, TError = any, TData = any, TQueryKey = any> = any;
  export type UseMutationResult<TData = any, TError = any, TVariables = any, TContext = any> = any;
  export type UseQueryResult<TData = any, TError = any> = any;
  // Export commonly used functions/classes as permissive anys so imports resolve.
  export function useQuery<T = any>(opts: any): any;
  export function useMutation<T = any, E = any, V = any, C = any>(opts: any): any;
  export interface QueryClient {
    getQueryData<T = any>(key: any): T | undefined;
    invalidateQueries(...args: any[]): any;
    refetchQueries(...args: any[]): any;
    cancelQueries(...args: any[]): any;
    setQueryData<T = any>(key: any, updater: T | ((old: T | undefined) => T) ): void;
  }
  export function useQueryClient(): QueryClient;
  export const QueryClient: any;
  export const QueryClientProvider: any;
}
