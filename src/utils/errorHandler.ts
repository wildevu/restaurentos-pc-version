import { uuidv4 } from './uuid';

export interface StandardErrorResponse {
  error: string;
  code: number;
  message: string;
  errorId: string;
}

/**
 * Standard error response helper for Express API routes.
 */
export function errorResponse(error: string, message: string, code: number = 500): StandardErrorResponse {
  return {
    error,
    code,
    message,
    errorId: uuidv4()
  };
}
