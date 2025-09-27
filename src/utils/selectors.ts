import { WebElement } from 'selenium-webdriver';
import { InvalidSelectorError } from './errors.js';

/**
 * Check if a selector is an XPath expression
 */
export function isXPath(selector: string): boolean {
  if (!selector || typeof selector !== 'string') {
    return false;
  }

  // XPath expressions typically start with these patterns
  const xpathPatterns = [
    /^\/\//, // Descendant axis
    /^\/[^\/]/, // Root element
    /^\(/, // Grouped expression
    /^\.\//, // Current context
    /^\.\.\// // Parent context
  ];

  return xpathPatterns.some(pattern => pattern.test(selector.trim()));
}

/**
 * Convert a simple CSS selector to XPath (basic implementation)
 * For complex selectors, this may not work perfectly
 */
export function cssToXPath(css: string): string {
  if (!css || typeof css !== 'string') {
    throw new InvalidSelectorError('CSS selector cannot be empty');
  }

  let xpath = css.trim();

  // Handle ID selector
  xpath = xpath.replace(/#([a-zA-Z0-9_-]+)/g, "[@id='$1']");

  // Handle class selector
  xpath = xpath.replace(/\.([a-zA-Z0-9_-]+)/g, "[contains(@class,'$1')]");

  // Handle attribute selectors
  xpath = xpath.replace(/\[([a-zA-Z0-9_-]+)=["']([^"']+)["']\]/g, "[@$1='$2']");
  xpath = xpath.replace(/\[([a-zA-Z0-9_-]+)\]/g, "[@$1]");

  // Handle descendant combinator
  xpath = xpath.replace(/\s+/g, '//');

  // Handle child combinator
  xpath = xpath.replace(/>/g, '/');

  // If it doesn't start with //, add it for descendant search
  if (!xpath.startsWith('//') && !xpath.startsWith('/')) {
    xpath = '//' + xpath;
  }

  return xpath;
}

/**
 * Generate the best possible selector for an element
 */
export async function findBestSelector(element: WebElement): Promise<string> {
  try {
    // Try to get ID first (most specific)
    const id = await element.getAttribute('id');
    if (id && id.trim()) {
      return `#${id}`;
    }

    // Try to get a unique class combination
    const className = await element.getAttribute('class');
    if (className && className.trim()) {
      const classes = className.trim().split(/\s+/);
      if (classes.length > 0) {
        return `.${classes.join('.')}`;
      }
    }

    // Try to get tag with unique attributes
    const tagName = await element.getTagName();
    const name = await element.getAttribute('name');
    if (name && name.trim()) {
      return `${tagName}[name="${name}"]`;
    }

    // Try data attributes
    const dataTestId = await element.getAttribute('data-testid');
    if (dataTestId && dataTestId.trim()) {
      return `[data-testid="${dataTestId}"]`;
    }

    const dataTest = await element.getAttribute('data-test');
    if (dataTest && dataTest.trim()) {
      return `[data-test="${dataTest}"]`;
    }

    // Fallback to tag name
    return tagName;

  } catch (error) {
    throw new InvalidSelectorError('Failed to generate selector for element');
  }
}

/**
 * Validate a selector string
 */
export function validateSelector(selector: string): boolean {
  if (!selector || typeof selector !== 'string' || !selector.trim()) {
    return false;
  }

  const trimmed = selector.trim();

  // Check for XPath
  if (isXPath(trimmed)) {
    return validateXPath(trimmed);
  }

  // Check for CSS
  return validateCSS(trimmed);
}

/**
 * Validate XPath expression (basic validation)
 */
function validateXPath(xpath: string): boolean {
  try {
    // Basic XPath validation - check for balanced brackets and quotes
    const brackets = xpath.split('[').length - xpath.split(']').length;
    const singleQuotes = (xpath.match(/'/g) || []).length;
    const doubleQuotes = (xpath.match(/"/g) || []).length;

    return brackets === 0 && singleQuotes % 2 === 0 && doubleQuotes % 2 === 0;
  } catch {
    return false;
  }
}

/**
 * Validate CSS selector (basic validation)
 */
function validateCSS(css: string): boolean {
  try {
    // Basic CSS validation - check for invalid characters and structure
    const invalidChars = /[<>&{}]/;
    if (invalidChars.test(css)) {
      return false;
    }

    // Check for balanced brackets and quotes
    const brackets = css.split('[').length - css.split(']').length;
    const parentheses = css.split('(').length - css.split(')').length;

    return brackets === 0 && parentheses === 0;
  } catch {
    return false;
  }
}

/**
 * Escape special characters in text for use in selectors
 */
export function escapeSelector(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    .replace(/\\/g, '\\\\') // Escape backslashes
    .replace(/"/g, '\\"') // Escape double quotes
    .replace(/'/g, "\\'") // Escape single quotes
    .replace(/\n/g, '\\n') // Escape newlines
    .replace(/\r/g, '\\r') // Escape carriage returns
    .replace(/\t/g, '\\t'); // Escape tabs
}

/**
 * Normalize selector for consistent usage
 */
export function normalizeSelector(selector: string): string {
  if (!selector || typeof selector !== 'string') {
    throw new InvalidSelectorError('Selector cannot be empty');
  }

  const trimmed = selector.trim();

  if (!validateSelector(trimmed)) {
    throw new InvalidSelectorError('Invalid selector format');
  }

  return trimmed;
}

/**
 * Create a robust selector that tries multiple strategies
 */
export function createRobustSelector(baseSelector: string, fallbacks: string[] = []): string[] {
  const selectors = [baseSelector, ...fallbacks].filter(Boolean);

  return selectors.map(selector => normalizeSelector(selector));
}

/**
 * Get selector type for debugging and logging
 */
export function getSelectorType(selector: string): 'xpath' | 'css' | 'invalid' {
  if (!validateSelector(selector)) {
    return 'invalid';
  }

  return isXPath(selector) ? 'xpath' : 'css';
}

/**
 * Parse compound CSS selector into parts
 */
export function parseCSS(css: string): {
  tag?: string;
  id?: string;
  classes: string[];
  attributes: Array<{ name: string; value?: string; operator?: string }>;
} {
  const result: {
    tag?: string;
    id?: string;
    classes: string[];
    attributes: Array<{ name: string; value?: string; operator?: string }>;
  } = {
    classes: [] as string[],
    attributes: [] as Array<{ name: string; value?: string; operator?: string }>
  };

  let remaining = css.trim();

  // Extract tag name
  const tagMatch = remaining.match(/^([a-zA-Z][a-zA-Z0-9]*)/);
  if (tagMatch && tagMatch[1]) {
    result.tag = tagMatch[1];
    remaining = remaining.substring(tagMatch[0].length);
  }

  // Extract ID
  const idMatch = remaining.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch && idMatch[1]) {
    result.id = idMatch[1];
    remaining = remaining.replace(idMatch[0], '');
  }

  // Extract classes
  const classMatches = remaining.match(/\.([a-zA-Z0-9_-]+)/g);
  if (classMatches) {
    result.classes = classMatches.map(cls => cls.substring(1));
    classMatches.forEach(cls => {
      remaining = remaining.replace(cls, '');
    });
  }

  // Extract attributes
  const attrMatches = remaining.match(/\[([^\]]+)\]/g);
  if (attrMatches) {
    attrMatches.forEach(attr => {
      const attrContent = attr.slice(1, -1); // Remove brackets
      const parts = attrContent.match(/([^=~|^$*]+)([=~|^$*]*)"?([^"]*)"?/) as RegExpMatchArray | null;

      if (parts && parts[1]) {
        const attr: { name: string; value?: string; operator?: string } = {
          name: parts[1]
        };
        if (parts[2]) attr.operator = parts[2];
        if (parts[3]) attr.value = parts[3];
        result.attributes.push(attr);
      } else {
        result.attributes.push({
          name: attrContent
        });
      }
    });
  }

  return result;
}