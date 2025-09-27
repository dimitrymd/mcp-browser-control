export abstract class MCPError extends Error {
  abstract readonly code: string;
  abstract readonly troubleshooting: string[];

  public readonly timestamp: number;
  public readonly originalError: Error | undefined;

  constructor(message: string, originalError?: Error) {
    super(message);
    this.name = this.constructor.name;
    this.timestamp = Date.now();
    this.originalError = originalError;

    // Ensure the stack trace points to the actual error location
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      timestamp: this.timestamp,
      troubleshooting: this.troubleshooting,
      stack: this.stack,
      originalError: this.originalError ? {
        name: this.originalError.name,
        message: this.originalError.message,
        stack: this.originalError.stack
      } : undefined
    };
  }
}

export class SessionError extends MCPError {
  readonly code = 'E001';
  readonly troubleshooting = [
    'Check if the browser driver is installed and accessible',
    'Verify that the browser is not already running with incompatible flags',
    'Ensure sufficient system resources are available',
    'Check if the session timeout is appropriate for your use case'
  ];
}

export class NavigationError extends MCPError {
  readonly code = 'E002';
  readonly troubleshooting = [
    'Verify the URL is valid and accessible',
    'Check if the target website is blocking automated requests',
    'Ensure network connectivity is stable',
    'Try increasing the navigation timeout',
    'Check if the page requires authentication or cookies'
  ];
}

export class TimeoutError extends MCPError {
  readonly code = 'E003';
  readonly troubleshooting = [
    'Increase the timeout value for slow-loading pages',
    'Check if the page is experiencing performance issues',
    'Verify network connectivity and latency',
    'Consider using a different wait condition (load vs domcontentloaded)',
    'Check if the page has blocking resources or scripts'
  ];
}

export class ValidationError extends MCPError {
  readonly code = 'E004';
  readonly troubleshooting = [
    'Review the parameter documentation for correct format',
    'Ensure all required parameters are provided',
    'Check data types match the expected schema',
    'Validate URL format if applicable',
    'Ensure numeric values are within acceptable ranges'
  ];

  constructor(message: string, public readonly field: string, public readonly value: any, originalError?: Error) {
    super(message, originalError);
  }

  override toJSON() {
    return {
      ...super.toJSON(),
      field: this.field,
      value: this.value
    };
  }
}

export class WebDriverError extends MCPError {
  readonly code = 'E005';
  readonly troubleshooting = [
    'Verify the WebDriver binary is installed and up to date',
    'Check browser version compatibility with WebDriver',
    'Ensure no other browser instances are interfering',
    'Try restarting the browser session',
    'Check system permissions for browser execution'
  ];
}

export class ConfigurationError extends MCPError {
  readonly code = 'E006';
  readonly troubleshooting = [
    'Check the configuration file syntax and format',
    'Verify all required configuration values are provided',
    'Ensure file paths in configuration are accessible',
    'Validate environment variables are set correctly',
    'Review the configuration schema documentation'
  ];
}

export class ConcurrencyError extends MCPError {
  readonly code = 'E007';
  readonly troubleshooting = [
    'Reduce the number of concurrent operations',
    'Increase the maximum concurrent session limit',
    'Wait for existing sessions to complete before starting new ones',
    'Consider implementing request queuing',
    'Check system resources (CPU, memory) availability'
  ];
}

export class ElementNotFoundError extends MCPError {
  readonly code = 'E008';
  readonly troubleshooting = [
    'Verify the element selector is correct (CSS or XPath)',
    'Check if the element is dynamically loaded and needs wait conditions',
    'Ensure the page has fully loaded before searching for the element',
    'Try using a more specific or robust selector',
    'Check if the element is inside an iframe that needs to be switched to',
    'Verify the element is not hidden by CSS or JavaScript'
  ];
}

export class ElementNotInteractableError extends MCPError {
  readonly code = 'E009';
  readonly troubleshooting = [
    'Verify the element is visible and not hidden by other elements',
    'Ensure the element is enabled and not disabled',
    'Check if the element is currently scrolled into view',
    'Wait for any animations or transitions to complete',
    'Verify the element is not covered by overlays or modals',
    'Try clicking at a different offset within the element'
  ];
}

export class StaleElementError extends MCPError {
  readonly code = 'E010';
  readonly troubleshooting = [
    'Re-find the element before performing the action',
    'Check if the page has been refreshed or modified',
    'Verify the element still exists in the DOM',
    'Use fresh element references for each operation',
    'Implement retry logic with element re-finding',
    'Check for dynamic content updates that might remove the element'
  ];
}

export class InvalidSelectorError extends MCPError {
  readonly code = 'E011';
  readonly troubleshooting = [
    'Check the selector syntax for CSS or XPath validity',
    'Ensure quotes and brackets are properly balanced',
    'Verify special characters are properly escaped',
    'Test the selector in browser developer tools',
    'Use simpler selectors and avoid complex expressions',
    'Check for typos in class names, IDs, or attribute values'
  ];
}

export function createErrorResponse(error: Error): { status: 'error'; error: any } {
  if (error instanceof MCPError) {
    return {
      status: 'error',
      error: {
        code: error.code,
        message: error.message,
        troubleshooting: error.troubleshooting,
        timestamp: error.timestamp,
        ...(error instanceof ValidationError && {
          field: error.field,
          value: error.value
        })
      }
    };
  }

  // Handle unknown errors
  return {
    status: 'error',
    error: {
      code: 'E999',
      message: 'An unexpected error occurred',
      troubleshooting: [
        'Check the server logs for more details',
        'Retry the operation',
        'Contact support if the issue persists'
      ],
      timestamp: Date.now(),
      originalMessage: error.message
    }
  };
}

export function isRecoverableError(error: Error): boolean {
  if (error instanceof TimeoutError || error instanceof NavigationError) {
    return true;
  }

  if (error instanceof WebDriverError) {
    // Some WebDriver errors are recoverable
    const recoverableMessages = [
      'stale element reference',
      'element not interactable',
      'element click intercepted'
    ];
    return recoverableMessages.some(msg =>
      error.message.toLowerCase().includes(msg)
    );
  }

  return false;
}