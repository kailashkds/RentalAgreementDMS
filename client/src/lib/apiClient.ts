/**
 * Enhanced API client with proper response handling and error logging
 * Prevents "Response body is already used" errors by cloning responses
 */

export interface ApiRequestOptions extends RequestInit {
  timeout?: number;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body: string,
    public url: string
  ) {
    super(`API Error ${status}: ${statusText} - ${body}`);
    this.name = 'ApiError';
  }
}

/**
 * Enhanced API request function with proper error handling
 * Clones response when needed to prevent "Response body is already used" errors
 */
export async function apiRequest<T = any>(
  url: string, 
  options: ApiRequestOptions = {}
): Promise<T> {
  const { timeout = 30000, ...fetchOptions } = options;

  // Add default headers
  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...fetchOptions.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    console.log(`[API Request] ${fetchOptions.method || 'GET'} ${url}`);
    
    const response = await fetch(url, {
      ...fetchOptions,
      headers: defaultHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Log response status
    console.log(`[API Response] ${response.status} ${response.statusText} - ${url}`);

    if (!response.ok) {
      // Clone response to read error message without consuming the body
      const errorText = await response.clone().text();
      console.error(`[API Error] ${response.status} ${response.statusText}:`, errorText);
      
      throw new ApiError(
        response.status,
        response.statusText,
        errorText,
        url
      );
    }

    // Check if response has content to parse
    const contentType = response.headers.get('content-type');
    
    if (contentType && contentType.includes('application/json')) {
      const data = await response.json();
      console.log(`[API Success] Parsed JSON response from ${url}`);
      return data;
    } else {
      // For non-JSON responses, return text
      const text = await response.text();
      console.log(`[API Success] Parsed text response from ${url}`);
      return text as T;
    }
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[API Timeout] Request to ${url} timed out after ${timeout}ms`);
      throw new Error(`Request timeout: ${url}`);
    }
    
    if (error instanceof ApiError) {
      throw error;
    }
    
    console.error(`[API Error] Network error for ${url}:`, error);
    throw new Error(`Network error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Convenience methods for different HTTP methods
 */
export const apiClient = {
  get: <T = any>(url: string, options?: Omit<ApiRequestOptions, 'method'>) =>
    apiRequest<T>(url, { ...options, method: 'GET' }),
    
  post: <T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(url, { 
      ...options, 
      method: 'POST', 
      body: data ? JSON.stringify(data) : undefined 
    }),
    
  put: <T = any>(url: string, data?: any, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(url, { 
      ...options, 
      method: 'PUT', 
      body: data ? JSON.stringify(data) : undefined 
    }),
    
  delete: <T = any>(url: string, options?: Omit<ApiRequestOptions, 'method'>) =>
    apiRequest<T>(url, { ...options, method: 'DELETE' }),

  // Special method for file downloads that returns blob
  downloadBlob: async (url: string, options?: ApiRequestOptions): Promise<Blob> => {
    const { timeout = 30000, ...fetchOptions } = options || {};
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      console.log(`[API Download] ${url}`);
      
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Clone response to read error message
        const errorText = await response.clone().text();
        console.error(`[API Download Error] ${response.status}:`, errorText);
        throw new ApiError(response.status, response.statusText, errorText, url);
      }

      const blob = await response.blob();
      console.log(`[API Download Success] Downloaded ${blob.size} bytes from ${url}`);
      return blob;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Download timeout: ${url}`);
      }
      
      if (error instanceof ApiError) {
        throw error;
      }
      
      throw new Error(`Download error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};