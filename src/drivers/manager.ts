import { Builder, WebDriver, Capabilities } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import firefox from 'selenium-webdriver/firefox.js';
import { DriverOptions } from '../types/index.js';
import { WebDriverError, ConfigurationError } from '../utils/errors.js';
import winston from 'winston';

export class WebDriverManager {
  private logger: winston.Logger;

  constructor(logger: winston.Logger) {
    this.logger = logger;
  }

  async createDriver(browserType: 'chrome' | 'firefox', options: DriverOptions): Promise<WebDriver> {
    this.logger.debug('Creating WebDriver instance', { browserType, options });

    try {
      const builder = new Builder();

      switch (browserType) {
        case 'chrome':
          return await this.createChromeDriver(builder, options);
        case 'firefox':
          return await this.createFirefoxDriver(builder, options);
        default:
          throw new ConfigurationError(`Unsupported browser type: ${browserType}`);
      }
    } catch (error) {
      this.logger.error('Failed to create WebDriver', { browserType, error });

      if (error instanceof WebDriverError || error instanceof ConfigurationError) {
        throw error;
      }

      throw new WebDriverError(
        `Failed to create ${browserType} driver: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  private async createChromeDriver(builder: Builder, options: DriverOptions): Promise<WebDriver> {
    const chromeOptions = new chrome.Options();

    // Configure headless mode
    if (options.headless) {
      chromeOptions.addArguments('--headless=new');
    }

    // Set window size
    if (options.windowSize) {
      chromeOptions.addArguments(`--window-size=${options.windowSize.width},${options.windowSize.height}`);
    } else {
      chromeOptions.addArguments('--window-size=1920,1080');
    }

    // Security and stability options
    chromeOptions.addArguments(
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding'
    );

    // Audio-related options for testing
    chromeOptions.addArguments(
      '--autoplay-policy=no-user-gesture-required',
      '--disable-background-media-suspend',
      '--disable-media-suspend'
    );

    // User agent
    if (options.userAgent) {
      chromeOptions.addArguments(`--user-agent=${options.userAgent}`);
    }

    // Proxy configuration
    if (options.proxy) {
      const proxyString = options.proxy.username && options.proxy.password
        ? `${options.proxy.username}:${options.proxy.password}@${options.proxy.host}:${options.proxy.port}`
        : `${options.proxy.host}:${options.proxy.port}`;
      chromeOptions.addArguments(`--proxy-server=http://${proxyString}`);
    }

    // Performance optimizations
    chromeOptions.addArguments(
      '--memory-pressure-off',
      '--max_old_space_size=4096'
    );

    const service = new chrome.ServiceBuilder();

    builder
      .forBrowser('chrome')
      .setChromeOptions(chromeOptions)
      .setChromeService(service);

    return await builder.build();
  }

  private async createFirefoxDriver(builder: Builder, options: DriverOptions): Promise<WebDriver> {
    const firefoxOptions = new firefox.Options();

    // Configure headless mode
    if (options.headless) {
      firefoxOptions.addArguments('--headless');
    }

    // Set window size
    if (options.windowSize) {
      firefoxOptions.addArguments(`--width=${options.windowSize.width}`);
      firefoxOptions.addArguments(`--height=${options.windowSize.height}`);
    }

    // Configure preferences for testing
    firefoxOptions.setPreference('media.autoplay.default', 0); // Allow autoplay
    firefoxOptions.setPreference('media.autoplay.blocking_policy', 0);
    firefoxOptions.setPreference('media.block-autoplay-until-in-foreground', false);
    firefoxOptions.setPreference('dom.webdriver.enabled', false);
    firefoxOptions.setPreference('useAutomationExtension', false);

    // Security preferences
    firefoxOptions.setPreference('security.tls.unrestricted_rc4_fallback', false);
    firefoxOptions.setPreference('security.tls.insecure_fallback_hosts', '');

    // Performance preferences
    firefoxOptions.setPreference('browser.cache.disk.enable', false);
    firefoxOptions.setPreference('browser.cache.memory.enable', false);
    firefoxOptions.setPreference('browser.cache.offline.enable', false);
    firefoxOptions.setPreference('network.http.use-cache', false);

    // User agent
    if (options.userAgent) {
      firefoxOptions.setPreference('general.useragent.override', options.userAgent);
    }

    // Proxy configuration
    if (options.proxy) {
      firefoxOptions.setPreference('network.proxy.type', 1); // Manual proxy
      firefoxOptions.setPreference('network.proxy.http', options.proxy.host);
      firefoxOptions.setPreference('network.proxy.http_port', options.proxy.port);
      firefoxOptions.setPreference('network.proxy.ssl', options.proxy.host);
      firefoxOptions.setPreference('network.proxy.ssl_port', options.proxy.port);

      if (options.proxy.username && options.proxy.password) {
        firefoxOptions.setPreference('network.proxy.username', options.proxy.username);
        firefoxOptions.setPreference('network.proxy.password', options.proxy.password);
      }
    }

    const service = new firefox.ServiceBuilder();

    builder
      .forBrowser('firefox')
      .setFirefoxOptions(firefoxOptions)
      .setFirefoxService(service);

    return await builder.build();
  }

  async validateDriver(driver: WebDriver): Promise<boolean> {
    try {
      // Try to get the current URL to validate the driver is working
      await driver.getCurrentUrl();
      return true;
    } catch (error) {
      this.logger.warn('Driver validation failed', { error });
      return false;
    }
  }

  async closeDriver(driver: WebDriver): Promise<void> {
    try {
      await driver.quit();
      this.logger.debug('WebDriver closed successfully');
    } catch (error) {
      this.logger.error('Error closing WebDriver', { error });
      // Don't throw here as we want to clean up as much as possible
    }
  }

  async getDriverCapabilities(driver: WebDriver): Promise<Capabilities> {
    try {
      return await driver.getCapabilities();
    } catch (error) {
      this.logger.error('Failed to get driver capabilities', { error });
      throw new WebDriverError(
        'Failed to retrieve driver capabilities',
        error instanceof Error ? error : undefined
      );
    }
  }

  async checkDriverHealth(driver: WebDriver): Promise<{
    isHealthy: boolean;
    details: {
      canNavigate: boolean;
      canExecuteScript: boolean;
      responseTime: number;
    };
  }> {
    const startTime = Date.now();
    const details = {
      canNavigate: false,
      canExecuteScript: false,
      responseTime: 0
    };

    try {
      // Test navigation capability
      await driver.getCurrentUrl();
      details.canNavigate = true;

      // Test script execution capability
      await driver.executeScript('return true;');
      details.canExecuteScript = true;

      details.responseTime = Date.now() - startTime;

      return {
        isHealthy: details.canNavigate && details.canExecuteScript,
        details
      };
    } catch (error) {
      details.responseTime = Date.now() - startTime;
      this.logger.warn('Driver health check failed', { error, details });

      return {
        isHealthy: false,
        details
      };
    }
  }
}