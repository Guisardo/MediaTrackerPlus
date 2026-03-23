/**
 * Stable machine-readable error codes returned in API error responses.
 * Consumers (e.g. the frontend) should match on `code` rather than
 * parsing `errorMessage`, which may change between releases.
 */
export type RequestErrorCode = 'AGE_RESTRICTED';

export type RequestError = {
  errorMessage: string;
  MediaTrackerError: true;
  /**
   * Optional stable machine-readable error code.
   * Present only when the error represents a well-known condition that
   * clients may want to handle programmatically (e.g. age-restricted content).
   */
  code?: RequestErrorCode;
};

export const toRequestErrorObject = (message: string): RequestError => {
  return {
    errorMessage: message,
    MediaTrackerError: true,
  };
};

/**
 * Creates a RequestError with a stable machine-readable error code.
 *
 * @param message - Human-readable error description.
 * @param code - Stable error code for programmatic handling.
 */
export const toCodedRequestErrorObject = (
  message: string,
  code: RequestErrorCode
): RequestError => {
  return {
    errorMessage: message,
    MediaTrackerError: true,
    code,
  };
};
