import { QueryClient, DefaultOptions } from '@tanstack/react-query';

const queryConfig: DefaultOptions = {
  queries: {
    // Data is considered fresh for 1 minute
    staleTime: 60 * 1000,

    // Keep unused data in cache for 5 minutes
    gcTime: 5 * 60 * 1000,

    // Don't refetch on window focus (too aggressive for this app)
    refetchOnWindowFocus: false,

    // Retry failed requests
    retry: 1,

    // Don't refetch on mount if data exists
    refetchOnMount: false,
  },
  mutations: {
    // Retry mutations once on failure
    retry: 1,
  },
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: queryConfig,
  });
}

// Export config for use in components
export { queryConfig };
