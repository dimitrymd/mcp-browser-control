import { WebDriver, WebElement, By, until } from 'selenium-webdriver';
import { isXPath, normalizeSelector } from './selectors.js';
import { ElementNotFoundError, ElementNotInteractableError, StaleElementError, TimeoutError } from './errors.js';
import winston from 'winston';

export type WaitCondition = 'present' | 'visible' | 'clickable' | 'hidden' | 'removed';

/**
 * Wait for an element to meet a specific condition
 */
export async function waitForElement(
  driver: WebDriver,
  selector: string,
  condition: WaitCondition,
  timeout: number = 10000,
  logger?: winston.Logger
): Promise<WebElement | null> {
  const normalizedSelector = normalizeSelector(selector);
  const locator = isXPath(normalizedSelector) ? By.xpath(normalizedSelector) : By.css(normalizedSelector);

  logger?.debug('Waiting for element', { selector: normalizedSelector, condition, timeout });

  try {
    switch (condition) {
      case 'present':
        return await driver.wait(until.elementLocated(locator), timeout);

      case 'visible':
        const visibleElement = await driver.wait(until.elementLocated(locator), timeout);
        await driver.wait(until.elementIsVisible(visibleElement), timeout);
        return visibleElement;

      case 'clickable':
        const clickableElement = await driver.wait(until.elementLocated(locator), timeout);
        await driver.wait(until.elementIsEnabled(clickableElement), timeout);
        await driver.wait(until.elementIsVisible(clickableElement), timeout);
        return clickableElement;

      case 'hidden':
        // Wait for element to be present but not visible
        const hiddenElement = await driver.wait(until.elementLocated(locator), timeout);
        await driver.wait(async () => {
          try {
            const isDisplayed = await hiddenElement.isDisplayed();
            return !isDisplayed;
          } catch {
            return true; // Element might be stale, consider it hidden
          }
        }, timeout);
        return hiddenElement;

      case 'removed':
        // Wait for element to be removed from DOM
        await driver.wait(async () => {
          try {
            await driver.findElement(locator);
            return false; // Element still exists
          } catch {
            return true; // Element not found, it's removed
          }
        }, timeout);
        return null;

      default:
        throw new Error(`Unsupported wait condition: ${condition}`);
    }
  } catch (error) {
    if (error instanceof Error && error.name === 'TimeoutError') {
      throw new TimeoutError(
        `Timeout waiting for element '${selector}' to be '${condition}' after ${timeout}ms`,
        error
      );
    }
    throw error;
  }
}

/**
 * Find element with retry logic for stale element references
 */
export async function findElementWithRetry(
  driver: WebDriver,
  selector: string,
  maxRetries: number = 3,
  logger?: winston.Logger
): Promise<WebElement> {
  const normalizedSelector = normalizeSelector(selector);
  const locator = isXPath(normalizedSelector) ? By.xpath(normalizedSelector) : By.css(normalizedSelector);

  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const element = await driver.findElement(locator);

      // Verify element is still attached to DOM
      await element.getTagName();

      return element;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (isStaleElementError(lastError) && attempt < maxRetries) {
        logger?.warn(`Stale element reference, retrying (${attempt}/${maxRetries})`, {
          selector: normalizedSelector,
          attempt
        });
        await new Promise(resolve => setTimeout(resolve, 100 * attempt)); // Exponential backoff
        continue;
      }

      break;
    }
  }

  if (lastError!.name === 'NoSuchElementError') {
    throw new ElementNotFoundError(`Element not found: ${selector}`, lastError!);
  }

  throw new ElementNotInteractableError(
    `Failed to find element '${selector}' after ${maxRetries} attempts: ${lastError!.message}`,
    lastError!
  );
}

/**
 * Find multiple elements with error handling
 */
export async function findElementsWithRetry(
  driver: WebDriver,
  selector: string,
  maxRetries: number = 3,
  logger?: winston.Logger
): Promise<WebElement[]> {
  const normalizedSelector = normalizeSelector(selector);
  const locator = isXPath(normalizedSelector) ? By.xpath(normalizedSelector) : By.css(normalizedSelector);

  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await driver.findElements(locator);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (isStaleElementError(lastError) && attempt < maxRetries) {
        logger?.warn(`Stale element reference in findElements, retrying (${attempt}/${maxRetries})`, {
          selector: normalizedSelector,
          attempt
        });
        await new Promise(resolve => setTimeout(resolve, 100 * attempt));
        continue;
      }

      break;
    }
  }

  throw new ElementNotInteractableError(
    `Failed to find elements '${selector}' after ${maxRetries} attempts: ${lastError!.message}`,
    lastError!
  );
}

/**
 * Scroll element into view
 */
export async function scrollIntoView(
  driver: WebDriver,
  element: WebElement,
  behavior: 'auto' | 'smooth' = 'smooth',
  block: 'start' | 'center' | 'end' | 'nearest' = 'center',
  logger?: winston.Logger
): Promise<void> {
  try {
    await driver.executeScript(
      `
      arguments[0].scrollIntoView({
        behavior: arguments[1],
        block: arguments[2],
        inline: 'nearest'
      });
      `,
      element,
      behavior,
      block
    );

    // Wait a moment for scrolling to complete
    await new Promise(resolve => setTimeout(resolve, 100));

    logger?.debug('Element scrolled into view', { behavior, block });
  } catch (error) {
    logger?.warn('Failed to scroll element into view', { error });
    throw new ElementNotInteractableError(
      'Failed to scroll element into view',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Check if element is visible
 */
export async function isElementVisible(element: WebElement): Promise<boolean> {
  try {
    const isDisplayed = await element.isDisplayed();
    if (!isDisplayed) return false;

    // Check if element has non-zero dimensions
    const rect = await element.getRect();
    return rect.width > 0 && rect.height > 0;
  } catch (error) {
    if (isStaleElementError(error)) {
      throw new StaleElementError('Element is stale and no longer attached to DOM', error as Error);
    }
    return false;
  }
}

/**
 * Get element center coordinates
 */
export async function getElementCenter(element: WebElement): Promise<{ x: number; y: number }> {
  try {
    const rect = await element.getRect();
    return {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2
    };
  } catch (error) {
    if (isStaleElementError(error)) {
      throw new StaleElementError('Element is stale and no longer attached to DOM', error as Error);
    }
    throw new ElementNotInteractableError(
      'Failed to get element center coordinates',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Highlight element for debugging (visual feedback)
 */
export async function highlightElement(
  driver: WebDriver,
  element: WebElement,
  duration: number = 2000,
  color: string = '#ff0000',
  logger?: winston.Logger
): Promise<void> {
  try {
    // Store original style
    const originalStyle = await element.getAttribute('style') || '';

    // Apply highlight style
    await driver.executeScript(
      `
      arguments[0].style.border = '3px solid ' + arguments[1];
      arguments[0].style.backgroundColor = arguments[1] + '33'; // 20% opacity
      `,
      element,
      color
    );

    // Wait for specified duration
    await new Promise(resolve => setTimeout(resolve, duration));

    // Restore original style
    await driver.executeScript(
      'arguments[0].setAttribute("style", arguments[1]);',
      element,
      originalStyle
    );

    logger?.debug('Element highlighted', { duration, color });
  } catch (error) {
    logger?.warn('Failed to highlight element', { error });
    // Don't throw error for highlighting failures
  }
}

/**
 * Get element information for debugging and logging
 */
export async function getElementInfo(element: WebElement): Promise<{
  tag: string;
  text: string;
  attributes: Record<string, string>;
  rect: { x: number; y: number; width: number; height: number };
  visible: boolean;
}> {
  try {
    const [tag, text, rect, visible] = await Promise.all([
      element.getTagName(),
      element.getText(),
      element.getRect(),
      isElementVisible(element)
    ]);

    // Get common attributes
    const attributeNames = ['id', 'class', 'name', 'type', 'value', 'href', 'src', 'alt', 'title'];
    const attributes: Record<string, string> = {};

    for (const attr of attributeNames) {
      try {
        const value = await element.getAttribute(attr);
        if (value) {
          attributes[attr] = value;
        }
      } catch {
        // Ignore errors getting individual attributes
      }
    }

    return { tag, text, attributes, rect, visible };
  } catch (error) {
    if (isStaleElementError(error)) {
      throw new StaleElementError('Element is stale and no longer attached to DOM', error as Error);
    }
    throw new ElementNotInteractableError(
      'Failed to get element information',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Wait for element to be stable (not moving)
 */
export async function waitForElementStable(
  element: WebElement,
  timeout: number = 5000,
  checkInterval: number = 100,
  logger?: winston.Logger
): Promise<void> {
  const startTime = Date.now();
  let lastRect: { x: number; y: number; width: number; height: number } | null = null;
  let stableCount = 0;
  const requiredStableChecks = 3;

  while (Date.now() - startTime < timeout) {
    try {
      const currentRect = await element.getRect();

      if (lastRect &&
          Math.abs(currentRect.x - lastRect.x) < 1 &&
          Math.abs(currentRect.y - lastRect.y) < 1 &&
          Math.abs(currentRect.width - lastRect.width) < 1 &&
          Math.abs(currentRect.height - lastRect.height) < 1) {
        stableCount++;

        if (stableCount >= requiredStableChecks) {
          logger?.debug('Element is stable', { stableCount, duration: Date.now() - startTime });
          return;
        }
      } else {
        stableCount = 0;
      }

      lastRect = currentRect;
      await new Promise(resolve => setTimeout(resolve, checkInterval));
    } catch (error) {
      if (isStaleElementError(error)) {
        throw new StaleElementError('Element became stale while waiting for stability', error as Error);
      }
      throw error;
    }
  }

  throw new TimeoutError(`Element did not stabilize within ${timeout}ms`);
}

/**
 * Execute action with element retry logic
 */
export async function executeWithElementRetry<T>(
  action: () => Promise<T>,
  maxRetries: number = 3,
  logger?: winston.Logger
): Promise<T> {
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Unknown error');

      if (isRetryableElementError(lastError) && attempt < maxRetries) {
        logger?.warn(`Element operation failed, retrying (${attempt}/${maxRetries})`, {
          error: lastError.message,
          attempt
        });
        await new Promise(resolve => setTimeout(resolve, 200 * attempt)); // Exponential backoff
        continue;
      }

      break;
    }
  }

  throw lastError!;
}

/**
 * Check if an error is a stale element reference
 */
function isStaleElementError(error: any): boolean {
  return error instanceof Error && (
    error.name === 'StaleElementReferenceError' ||
    error.message.includes('stale element reference') ||
    error.message.includes('element is not attached to the page document')
  );
}

/**
 * Check if an error is retryable for element operations
 */
function isRetryableElementError(error: Error): boolean {
  const retryablePatterns = [
    'stale element reference',
    'element not interactable',
    'element click intercepted',
    'element not attached',
    'no such element'
  ];

  return retryablePatterns.some(pattern =>
    error.message.toLowerCase().includes(pattern)
  );
}

/**
 * Get element selector for an element (best effort)
 */
export async function getElementSelector(
  driver: WebDriver,
  element: WebElement
): Promise<string> {
  try {
    // Try to generate a unique selector
    const script = `
      function getSelector(el) {
        if (el.id) return '#' + el.id;

        let selector = el.tagName.toLowerCase();

        if (el.className) {
          const classes = el.className.trim().split(/\\s+/);
          selector += '.' + classes.join('.');
        }

        // Add attribute selectors for uniqueness
        if (el.name) selector += '[name="' + el.name + '"]';
        if (el.type) selector += '[type="' + el.type + '"]';

        return selector;
      }

      return getSelector(arguments[0]);
    `;

    return await driver.executeScript(script, element) as string;
  } catch (error) {
    // Fallback to tag name
    try {
      return await element.getTagName();
    } catch {
      return 'unknown';
    }
  }
}