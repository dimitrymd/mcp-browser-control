import { WebDriver } from 'selenium-webdriver';
import { SessionManager } from '../drivers/session.js';
import {
  ExtractTableDataParams,
  ExtractTableDataResult,
  ExtractStructuredDataParams,
  ExtractStructuredDataResult,
  ExtractFormDataParams,
  ExtractFormDataResult,
  ExtractMediaInfoParams,
  ExtractMediaInfoResult,
  ExtractLinksParams,
  ExtractLinksResult,
  MCPToolResult
} from '../types/index.js';
import {
  extractTableFromHTML,
  convertToFormat,
  transformData,
  validateData,
  detectDataTypes,
  cleanData,
  analyzeDataQuality
} from '../utils/data-processing.js';
import { findElementWithRetry, findElementsWithRetry } from '../utils/elements.js';
import { ValidationError, createErrorResponse } from '../utils/errors.js';
import { normalizeSelector } from '../utils/selectors.js';
import winston from 'winston';

export class AdvancedExtractionTools {
  private sessionManager: SessionManager;
  private logger: winston.Logger;

  constructor(sessionManager: SessionManager, logger: winston.Logger) {
    this.sessionManager = sessionManager;
    this.logger = logger;
  }

  async extractTableData(params: unknown, sessionId?: string): Promise<MCPToolResult<ExtractTableDataResult>> {
    const startTime = Date.now();
    this.logger.info('Executing extract_table_data tool', { params, sessionId });

    try {
      const validatedParams = this.validateExtractTableDataParams(params);
      const {
        selector,
        format,
        headers = 'auto',
        columnMapping,
        skipRows = 0,
        maxRows,
        cleanData: shouldCleanData = true,
        parseNumbers = false,
        parseDates = false
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Extracting table data', {
        selector,
        format,
        headers,
        skipRows,
        maxRows,
        sessionId: actualSessionId
      });

      // Find the table element
      const tableElement = await findElementWithRetry(session.driver, selector, 3, this.logger);

      // Get table HTML
      const tableHTML = await tableElement.getAttribute('outerHTML');

      // Extract table data
      const extractionOptions = {
        skipRows,
        maxRows,
        headerRow: headers === 'first-row' ? 0 : undefined,
        parseNumbers,
        parseDates
      };

      const { data: rawData, headers: extractedHeaders } = extractTableFromHTML(tableHTML, extractionOptions);

      let finalHeaders: string[] = [];
      let processedData = rawData;

      // Handle headers
      if (headers === 'auto') {
        finalHeaders = extractedHeaders || [];
      } else if (headers === 'first-row') {
        finalHeaders = extractedHeaders || [];
      } else if (headers === 'custom' && Array.isArray(validatedParams.headers)) {
        finalHeaders = validatedParams.headers as string[];
      } else if (Array.isArray(headers)) {
        finalHeaders = headers;
      }

      // Apply column mapping if provided
      if (columnMapping && Object.keys(columnMapping).length > 0) {
        finalHeaders = finalHeaders.map(header => columnMapping[header] || header);
      }

      // Clean data if requested
      if (shouldCleanData) {
        processedData = cleanData(processedData.map(row => {
          if (finalHeaders.length > 0) {
            const obj: Record<string, any> = {};
            finalHeaders.forEach((header, index) => {
              obj[header] = row[index];
            });
            return obj;
          }
          return row;
        }));
      }

      // Convert to requested format
      const formattedData = convertToFormat(processedData, format, finalHeaders);

      // Generate metadata
      const dataTypes = detectDataTypes(processedData);
      const quality = analyzeDataQuality(processedData);

      const metadata = {
        rows: processedData.length,
        columns: finalHeaders.length || (processedData[0] ? Object.keys(processedData[0]).length : 0),
        headers: finalHeaders,
        emptyCells: quality.totalRows - Object.values(quality.completeness).reduce((sum, val) => sum + val, 0),
        dataTypes
      };

      const warnings: string[] = [];
      if (quality.duplicates > 0) {
        warnings.push(`Found ${quality.duplicates} duplicate rows`);
      }

      const result: ExtractTableDataResult = {
        data: formattedData,
        metadata,
        warnings
      };

      this.logger.info('Table extraction completed', {
        selector,
        rowsExtracted: metadata.rows,
        columnsExtracted: metadata.columns,
        format,
        warningsCount: warnings.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'extractTableData', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Table extraction failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'extractTableData', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Table extraction failed'));
    }
  }

  async extractStructuredData(params: unknown, sessionId?: string): Promise<MCPToolResult<ExtractStructuredDataResult>> {
    const startTime = Date.now();
    this.logger.info('Executing extract_structured_data tool', { params, sessionId });

    try {
      const validatedParams = this.validateExtractStructuredDataParams(params);
      const { schema } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Extracting structured data', {
        schemaSelector: schema.selector,
        fieldsCount: schema.fields.length,
        hasPagination: !!schema.pagination,
        sessionId: actualSessionId
      });

      const extractedData: any[] = [];
      const errors: Array<{ field: string; error: string }> = [];
      let pagesProcessed = 1;

      // Extract data from current page
      await this.extractDataFromPage(session.driver, schema, extractedData, errors);

      // Handle pagination if specified
      if (schema.pagination) {
        const { nextSelector, maxPages } = schema.pagination;

        while (pagesProcessed < maxPages) {
          try {
            // Look for next page button
            const nextButton = await session.driver.findElement({ css: nextSelector });
            const isEnabled = await nextButton.isEnabled();
            const isVisible = await nextButton.isDisplayed();

            if (!isEnabled || !isVisible) {
              this.logger.debug('Next button not available, stopping pagination', { page: pagesProcessed });
              break;
            }

            // Click next button
            await nextButton.click();

            // Wait for page to load
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Extract data from new page
            await this.extractDataFromPage(session.driver, schema, extractedData, errors);
            pagesProcessed++;

          } catch (error) {
            this.logger.warn('Pagination failed, stopping', { page: pagesProcessed, error });
            break;
          }
        }
      }

      const result: ExtractStructuredDataResult = {
        data: extractedData,
        pagesProcessed,
        errors
      };

      this.logger.info('Structured data extraction completed', {
        recordsExtracted: extractedData.length,
        pagesProcessed,
        errorsCount: errors.length,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'extractStructuredData', schema.selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Structured data extraction failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'extractStructuredData', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Structured data extraction failed'));
    }
  }

  async extractFormData(params: unknown, sessionId?: string): Promise<MCPToolResult<ExtractFormDataResult>> {
    const startTime = Date.now();
    this.logger.info('Executing extract_form_data tool', { params, sessionId });

    try {
      const validatedParams = this.validateExtractFormDataParams(params);
      const {
        selector,
        includeHidden = false,
        includeDisabled = false,
        groupByName = false
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Extracting form data', {
        selector,
        includeHidden,
        includeDisabled,
        groupByName,
        sessionId: actualSessionId
      });

      // Find form element or search entire page
      let formElement;
      let formAction = '';
      let formMethod = 'GET';

      if (selector) {
        formElement = await findElementWithRetry(session.driver, selector, 3, this.logger);
        const tagName = await formElement.getTagName();

        if (tagName.toLowerCase() === 'form') {
          formAction = await formElement.getAttribute('action') || '';
          formMethod = await formElement.getAttribute('method') || 'GET';
        }
      }

      // Find all form elements
      const formFields = await session.driver.executeScript(`
        const includeHidden = arguments[0];
        const includeDisabled = arguments[1];
        const formSelector = arguments[2];

        const fields = [];
        const container = formSelector ? document.querySelector(formSelector) : document;

        if (!container) return [];

        const formElements = container.querySelectorAll('input, textarea, select, button');

        formElements.forEach(element => {
          // Skip hidden elements if not requested
          if (!includeHidden && element.type === 'hidden') return;

          // Skip disabled elements if not requested
          if (!includeDisabled && element.disabled) return;

          const field = {
            name: element.name || '',
            type: element.type || element.tagName.toLowerCase(),
            value: element.value || '',
            required: element.required || false,
            validation: element.pattern || '',
            label: ''
          };

          // Get label if available
          if (element.id) {
            const label = document.querySelector('label[for="' + element.id + '"]');
            if (label) {
              field.label = label.textContent || '';
            }
          }

          // Get options for select and radio elements
          if (element.tagName.toLowerCase() === 'select') {
            field.options = Array.from(element.options).map(option => ({
              value: option.value,
              text: option.text,
              selected: option.selected
            }));
          } else if (element.type === 'radio' || element.type === 'checkbox') {
            const relatedElements = container.querySelectorAll('[name="' + element.name + '"]');
            field.options = Array.from(relatedElements).map(el => ({
              value: el.value,
              checked: el.checked
            }));
          }

          fields.push(field);
        });

        return fields;
      `, includeHidden, includeDisabled, selector);

      let fields = formFields as any[];

      // Group by name if requested
      if (groupByName) {
        const groupedFields = new Map<string, any[]>();

        fields.forEach(field => {
          const name = field.name || 'unnamed';
          if (!groupedFields.has(name)) {
            groupedFields.set(name, []);
          }
          groupedFields.get(name)!.push(field);
        });

        // Convert grouped fields back to array
        fields = Array.from(groupedFields.entries()).map(([name, fieldGroup]) => {
          if (fieldGroup.length === 1) {
            return fieldGroup[0];
          } else {
            return {
              name,
              type: 'group',
              value: fieldGroup.map(f => f.value),
              options: fieldGroup.flatMap(f => f.options || []),
              required: fieldGroup.some(f => f.required),
              validation: fieldGroup.map(f => f.validation).filter(Boolean).join(' | '),
              label: fieldGroup.map(f => f.label).filter(Boolean).join(' / ')
            };
          }
        });
      }

      const result: ExtractFormDataResult = {
        fields,
        formAction,
        formMethod
      };

      this.logger.info('Form data extraction completed', {
        fieldsExtracted: fields.length,
        formAction,
        formMethod,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'extractFormData', selector, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Form data extraction failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'extractFormData', (params as any)?.selector, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Form data extraction failed'));
    }
  }

  async extractMediaInfo(params: unknown, sessionId?: string): Promise<MCPToolResult<ExtractMediaInfoResult>> {
    const startTime = Date.now();
    this.logger.info('Executing extract_media_info tool', { params, sessionId });

    try {
      const validatedParams = this.validateExtractMediaInfoParams(params);
      const {
        mediaType = 'all',
        includeDimensions = true,
        includeMetadata = true,
        checkLoaded = true
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Extracting media info', {
        mediaType,
        includeDimensions,
        includeMetadata,
        checkLoaded,
        sessionId: actualSessionId
      });

      // Build selector based on media type
      let mediaSelector = '';
      switch (mediaType) {
        case 'image':
          mediaSelector = 'img';
          break;
        case 'video':
          mediaSelector = 'video';
          break;
        case 'audio':
          mediaSelector = 'audio';
          break;
        case 'all':
        default:
          mediaSelector = 'img, video, audio';
          break;
      }

      // Extract media information
      const mediaInfo = await session.driver.executeScript(`
        const mediaSelector = arguments[0];
        const includeDimensions = arguments[1];
        const includeMetadata = arguments[2];
        const checkLoaded = arguments[3];

        const mediaElements = document.querySelectorAll(mediaSelector);
        const mediaData = [];
        const byType = { image: 0, video: 0, audio: 0 };

        mediaElements.forEach((element, index) => {
          const info = {
            type: element.tagName.toLowerCase(),
            src: element.src || element.currentSrc || '',
            alt: element.alt || '',
            loaded: false,
            visible: false
          };

          // Count by type
          if (info.type === 'img') byType.image++;
          else if (info.type === 'video') byType.video++;
          else if (info.type === 'audio') byType.audio++;

          // Check if loaded
          if (checkLoaded) {
            if (info.type === 'img') {
              info.loaded = element.complete && element.naturalWidth > 0;
            } else if (info.type === 'video' || info.type === 'audio') {
              info.loaded = element.readyState >= 2; // HAVE_CURRENT_DATA
              if (includeMetadata && element.duration) {
                info.duration = element.duration;
              }
            }
          }

          // Check visibility
          const rect = element.getBoundingClientRect();
          info.visible = rect.width > 0 && rect.height > 0 &&
                        rect.top < window.innerHeight &&
                        rect.bottom > 0;

          // Get dimensions
          if (includeDimensions) {
            if (info.type === 'img') {
              info.dimensions = {
                width: element.width || rect.width,
                height: element.height || rect.height
              };
              if (element.naturalWidth && element.naturalHeight) {
                info.naturalSize = {
                  width: element.naturalWidth,
                  height: element.naturalHeight
                };
              }
            } else if (info.type === 'video') {
              info.dimensions = {
                width: element.videoWidth || element.clientWidth,
                height: element.videoHeight || element.clientHeight
              };
            }
          }

          // Estimate file size (rough approximation)
          if (includeMetadata && info.naturalSize) {
            // Very rough estimate: width * height * 3 bytes per pixel / compression factor
            info.fileSize = Math.round(info.naturalSize.width * info.naturalSize.height * 3 / 10);
          }

          mediaData.push(info);
        });

        return {
          media: mediaData,
          total: mediaData.length,
          byType: byType
        };
      `, mediaSelector, includeDimensions, includeMetadata, checkLoaded);

      const result = mediaInfo as ExtractMediaInfoResult;

      this.logger.info('Media info extraction completed', {
        mediaType,
        totalMedia: result.total,
        byType: result.byType,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'extractMediaInfo', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Media info extraction failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'extractMediaInfo', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Media info extraction failed'));
    }
  }

  async extractLinks(params: unknown, sessionId?: string): Promise<MCPToolResult<ExtractLinksResult>> {
    const startTime = Date.now();
    this.logger.info('Executing extract_links tool', { params, sessionId });

    try {
      const validatedParams = this.validateExtractLinksParams(params);
      const {
        internal = true,
        external = true,
        includeAnchors = false,
        checkStatus = false,
        pattern
      } = validatedParams;

      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      this.logger.debug('Extracting links', {
        internal,
        external,
        includeAnchors,
        checkStatus,
        hasPattern: !!pattern,
        sessionId: actualSessionId
      });

      // Extract all links
      const linksData = await session.driver.executeScript(`
        const includeAnchors = arguments[0];
        const pattern = arguments[1];

        const links = [];
        const currentOrigin = window.location.origin;

        // Get all anchor elements
        const anchorElements = document.querySelectorAll('a[href]');

        anchorElements.forEach(element => {
          const href = element.href;

          // Apply pattern filter if provided
          if (pattern) {
            const regex = new RegExp(pattern);
            if (!regex.test(href)) return;
          }

          // Check if it's an anchor link
          const isAnchor = href.includes('#') && new URL(href).pathname === window.location.pathname;

          if (!includeAnchors && isAnchor) return;

          const linkInfo = {
            href: href,
            text: element.textContent || '',
            title: element.title || '',
            target: element.target || '',
            rel: element.rel || '',
            isInternal: href.startsWith(currentOrigin) || href.startsWith('/'),
            isAnchor: isAnchor
          };

          links.push(linkInfo);
        });

        return links;
      `, includeAnchors, pattern);

      let links = linksData as any[];

      // Filter by internal/external preference
      links = links.filter(link => {
        if (link.isAnchor && !includeAnchors) return false;
        if (link.isInternal && !internal) return false;
        if (!link.isInternal && !external) return false;
        return true;
      });

      // Check link status if requested
      if (checkStatus) {
        // Note: This would require additional HTTP requests which can be slow
        // For now, we'll simulate the feature
        this.logger.warn('Link status checking not fully implemented yet - would require HTTP requests');
      }

      // Calculate statistics
      const statistics = {
        total: links.length,
        internal: links.filter(l => l.isInternal).length,
        external: links.filter(l => !l.isInternal).length,
        broken: 0, // Would be populated by status checking
        anchors: links.filter(l => l.isAnchor).length
      };

      const result: ExtractLinksResult = {
        links,
        statistics
      };

      this.logger.info('Link extraction completed', {
        totalLinks: statistics.total,
        internal: statistics.internal,
        external: statistics.external,
        anchors: statistics.anchors,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'extractLinks', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: result
      };

    } catch (error) {
      this.logger.error('Link extraction failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'extractLinks', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Link extraction failed'));
    }
  }

  // Private helper methods

  private async extractDataFromPage(
    driver: WebDriver,
    schema: any,
    extractedData: any[],
    errors: Array<{ field: string; error: string }>
  ): Promise<void> {
    try {
      // Find container elements
      const containerElements = await findElementsWithRetry(driver, schema.selector, 3, this.logger);

      for (const container of containerElements) {
        const record: any = {};

        // Extract each field
        for (const fieldSchema of schema.fields) {
          try {
            const elements = await container.findElements({ css: fieldSchema.selector });

            if (elements.length === 0) {
              if (fieldSchema.required) {
                errors.push({
                  field: fieldSchema.name,
                  error: `Required field not found: ${fieldSchema.selector}`
                });
              } else if (fieldSchema.default !== undefined) {
                record[fieldSchema.name] = fieldSchema.default;
              }
              continue;
            }

            let fieldValue: any;

            if (fieldSchema.multiple) {
              // Extract from all matching elements
              fieldValue = await Promise.all(elements.map(async el => {
                return await this.extractFieldValue(el, fieldSchema);
              }));
            } else {
              // Extract from first element
              fieldValue = await this.extractFieldValue(elements[0], fieldSchema);
            }

            record[fieldSchema.name] = fieldValue;

          } catch (error) {
            errors.push({
              field: fieldSchema.name,
              error: `Extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`
            });

            if (fieldSchema.default !== undefined) {
              record[fieldSchema.name] = fieldSchema.default;
            }
          }
        }

        extractedData.push(record);
      }
    } catch (error) {
      this.logger.warn('Failed to extract data from page', { error });
    }
  }

  private async extractFieldValue(element: any, fieldSchema: any): Promise<any> {
    let value: any;

    if (fieldSchema.attribute) {
      value = await element.getAttribute(fieldSchema.attribute);
    } else {
      value = await element.getText();
    }

    // Apply transformation
    if (fieldSchema.transform && value !== null && value !== undefined) {
      switch (fieldSchema.transform) {
        case 'number':
          const numValue = parseFloat(String(value).replace(/[^0-9.-]/g, ''));
          value = isNaN(numValue) ? fieldSchema.default : numValue;
          break;

        case 'date':
          if (typeof value === 'string') {
            const dateValue = new Date(value);
            value = isNaN(dateValue.getTime()) ? fieldSchema.default : dateValue.toISOString();
          }
          break;

        case 'boolean':
          if (typeof value === 'string') {
            const lowerValue = value.toLowerCase();
            value = ['true', 'yes', '1', 'on'].includes(lowerValue);
          } else {
            value = Boolean(value);
          }
          break;

        case 'url':
          if (typeof value === 'string') {
            try {
              const url = new URL(value, window.location.href);
              value = url.toString();
            } catch {
              value = fieldSchema.default || value;
            }
          }
          break;

        case 'text':
        default:
          value = String(value).trim();
          break;
      }
    }

    return value;
  }

  private async getDefaultSession(): Promise<string> {
    const sessions = this.sessionManager.listSessions();
    if (sessions.length > 0) {
      return sessions[0].id;
    }
    throw new Error('No session ID provided and no active sessions available. Create a session first.');
  }

  // Validation methods

  private validateExtractTableDataParams(params: unknown): ExtractTableDataParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!p.selector || typeof p.selector !== 'string') {
      throw new ValidationError('selector is required and must be a string', 'selector', p.selector);
    }

    const validFormats = ['json', 'csv', 'array', 'object'];
    if (!p.format || !validFormats.includes(p.format)) {
      throw new ValidationError(
        `format is required and must be one of: ${validFormats.join(', ')}`,
        'format',
        p.format
      );
    }

    if (p.headers && typeof p.headers !== 'string' && !Array.isArray(p.headers)) {
      throw new ValidationError('headers must be a string or array', 'headers', p.headers);
    }

    return {
      selector: normalizeSelector(p.selector),
      format: p.format,
      headers: p.headers,
      columnMapping: p.columnMapping,
      skipRows: p.skipRows,
      maxRows: p.maxRows,
      cleanData: p.cleanData,
      parseNumbers: p.parseNumbers,
      parseDates: p.parseDates
    };
  }

  private validateExtractStructuredDataParams(params: unknown): ExtractStructuredDataParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (!p.schema || typeof p.schema !== 'object') {
      throw new ValidationError('schema is required and must be an object', 'schema', p.schema);
    }

    if (!p.schema.selector || typeof p.schema.selector !== 'string') {
      throw new ValidationError('schema.selector is required and must be a string', 'schema.selector', p.schema.selector);
    }

    if (!Array.isArray(p.schema.fields) || p.schema.fields.length === 0) {
      throw new ValidationError('schema.fields is required and must be a non-empty array', 'schema.fields', p.schema.fields);
    }

    // Validate each field schema
    p.schema.fields.forEach((field: any, index: number) => {
      if (!field.name || typeof field.name !== 'string') {
        throw new ValidationError(`schema.fields[${index}].name is required and must be a string`, 'field.name', field.name);
      }
      if (!field.selector || typeof field.selector !== 'string') {
        throw new ValidationError(`schema.fields[${index}].selector is required and must be a string`, 'field.selector', field.selector);
      }
    });

    return {
      schema: {
        selector: normalizeSelector(p.schema.selector),
        fields: p.schema.fields,
        pagination: p.schema.pagination
      }
    };
  }

  private validateExtractFormDataParams(params: unknown): ExtractFormDataParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (p.selector && typeof p.selector !== 'string') {
      throw new ValidationError('selector must be a string', 'selector', p.selector);
    }

    return {
      selector: p.selector ? normalizeSelector(p.selector) : undefined,
      includeHidden: p.includeHidden,
      includeDisabled: p.includeDisabled,
      groupByName: p.groupByName
    };
  }

  private validateExtractMediaInfoParams(params: unknown): ExtractMediaInfoParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    const validMediaTypes = ['image', 'video', 'audio', 'all'];
    if (p.mediaType && !validMediaTypes.includes(p.mediaType)) {
      throw new ValidationError(
        `mediaType must be one of: ${validMediaTypes.join(', ')}`,
        'mediaType',
        p.mediaType
      );
    }

    return {
      mediaType: p.mediaType,
      includeDimensions: p.includeDimensions,
      includeMetadata: p.includeMetadata,
      checkLoaded: p.checkLoaded
    };
  }

  private validateExtractLinksParams(params: unknown): ExtractLinksParams {
    if (!params || typeof params !== 'object') {
      throw new ValidationError('Parameters must be an object', 'params', params);
    }

    const p = params as any;

    if (p.pattern && typeof p.pattern !== 'string') {
      throw new ValidationError('pattern must be a string', 'pattern', p.pattern);
    }

    // Validate regex pattern if provided
    if (p.pattern) {
      try {
        new RegExp(p.pattern);
      } catch (error) {
        throw new ValidationError(
          `Invalid regex pattern: ${error instanceof Error ? error.message : 'Invalid pattern'}`,
          'pattern',
          p.pattern
        );
      }
    }

    return {
      internal: p.internal,
      external: p.external,
      includeAnchors: p.includeAnchors,
      checkStatus: p.checkStatus,
      pattern: p.pattern
    };
  }

  // Additional method to complete the 5 required tools
  async extractCompletePageData(params: unknown, sessionId?: string): Promise<MCPToolResult<any>> {
    const startTime = Date.now();
    this.logger.info('Executing extract_complete_page_data tool', { params, sessionId });

    try {
      const actualSessionId = sessionId || await this.getDefaultSession();
      const session = this.sessionManager.getSession(actualSessionId);

      // Extract comprehensive page data
      const pageData = await session.driver.executeScript(`
        return {
          url: window.location.href,
          title: document.title,
          tables: document.querySelectorAll('table').length,
          forms: document.querySelectorAll('form').length,
          images: document.querySelectorAll('img').length,
          videos: document.querySelectorAll('video').length,
          audios: document.querySelectorAll('audio').length,
          links: document.querySelectorAll('a[href]').length,
          iframes: document.querySelectorAll('iframe').length,
          scripts: document.querySelectorAll('script').length,
          stylesheets: document.querySelectorAll('link[rel="stylesheet"]').length,
          metaTags: Array.from(document.querySelectorAll('meta')).map(meta => ({
            name: meta.name || meta.getAttribute('property') || '',
            content: meta.content || ''
          })),
          headings: {
            h1: document.querySelectorAll('h1').length,
            h2: document.querySelectorAll('h2').length,
            h3: document.querySelectorAll('h3').length,
            h4: document.querySelectorAll('h4').length,
            h5: document.querySelectorAll('h5').length,
            h6: document.querySelectorAll('h6').length
          }
        };
      `);

      this.logger.info('Complete page data extraction completed', {
        ...pageData,
        duration: Date.now() - startTime,
        sessionId: actualSessionId
      });

      // Track action
      this.sessionManager.trackAction(actualSessionId, 'extractCompletePageData', undefined, true, Date.now() - startTime);

      return {
        status: 'success',
        data: pageData
      };

    } catch (error) {
      this.logger.error('Complete page data extraction failed', {
        params,
        sessionId,
        error,
        duration: Date.now() - startTime
      });

      if (sessionId) {
        this.sessionManager.trackAction(sessionId, 'extractCompletePageData', undefined, false, Date.now() - startTime);
      }

      return createErrorResponse(error instanceof Error ? error : new Error('Complete page data extraction failed'));
    }
  }
}