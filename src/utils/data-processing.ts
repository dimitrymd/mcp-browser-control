/**
 * Advanced data processing utilities for Sprint 4
 */

export interface CSVOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  skipEmptyLines?: boolean;
  headers?: boolean;
}

export interface TransformRule {
  field: string;
  type: 'text' | 'number' | 'date' | 'boolean' | 'url';
  format?: string;
  default?: any;
}

export interface TransformSchema {
  rules: TransformRule[];
  strict?: boolean;
}

export interface ValidationRule {
  field: string;
  required?: boolean;
  type?: string;
  pattern?: string;
  min?: number;
  max?: number;
}

export interface ValidationRules {
  rules: ValidationRule[];
  strict?: boolean;
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string; value: any }>;
  warnings: string[];
}

export interface Metric {
  field: string;
  operation: 'sum' | 'avg' | 'min' | 'max' | 'count';
  as?: string;
}

/**
 * Parse CSV text with advanced options
 */
export function parseCSV(text: string, options: CSVOptions = {}): any[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const {
    delimiter = ',',
    quote = '"',
    escape = '\\',
    skipEmptyLines = true,
    headers = false
  } = options;

  const result: any[] = [];
  const lines = text.split('\n');
  let headerRow: string[] | null = null;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];

    if (skipEmptyLines && !line.trim()) continue;

    const row: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === escape && nextChar) {
        // Handle escaped characters
        currentField += nextChar;
        i += 2;
        continue;
      }

      if (char === quote) {
        if (inQuotes && nextChar === quote) {
          // Escaped quote within quoted field
          currentField += quote;
          i += 2;
          continue;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        row.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }

      i++;
    }

    // Add the last field
    row.push(currentField);

    // Handle headers
    if (headers && lineIndex === 0) {
      headerRow = row;
      continue;
    }

    // Convert row to object if headers are available
    if (headerRow) {
      const rowObject: Record<string, string> = {};
      headerRow.forEach((header, index) => {
        rowObject[header] = row[index] || '';
      });
      result.push(rowObject);
    } else {
      result.push(row);
    }
  }

  return result;
}

/**
 * Parse JSON with repair capabilities
 */
export function parseJSON(text: string, repair: boolean = false): any {
  if (!text || typeof text !== 'string') {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch (error) {
    if (!repair) {
      throw error;
    }

    // Attempt basic JSON repair
    let repairedText = text
      // Fix common issues
      .replace(/,\s*}/g, '}')           // Remove trailing commas in objects
      .replace(/,\s*]/g, ']')           // Remove trailing commas in arrays
      .replace(/'/g, '"')               // Replace single quotes with double quotes
      .replace(/([{,]\s*)(\w+):/g, '$1"$2":')  // Quote unquoted keys
      .trim();

    // Remove any trailing commas
    repairedText = repairedText.replace(/,(\s*[}\]])/g, '$1');

    try {
      return JSON.parse(repairedText);
    } catch {
      // If repair fails, return the error from original parse
      throw error;
    }
  }
}

/**
 * Transform data according to schema
 */
export function transformData(data: any[], schema: TransformSchema): any[] {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  return data.map(item => {
    const transformed: any = { ...item };

    schema.rules.forEach(rule => {
      const value = item[rule.field];

      if (value === undefined || value === null) {
        if (rule.default !== undefined) {
          transformed[rule.field] = rule.default;
        }
        return;
      }

      try {
        switch (rule.type) {
          case 'text':
            transformed[rule.field] = String(value).trim();
            break;

          case 'number':
            const numValue = typeof value === 'string' ?
              parseFloat(value.replace(/[^0-9.-]/g, '')) :
              Number(value);
            transformed[rule.field] = isNaN(numValue) ? (rule.default || 0) : numValue;
            break;

          case 'date':
            if (typeof value === 'string') {
              const dateValue = new Date(value);
              transformed[rule.field] = isNaN(dateValue.getTime()) ?
                (rule.default || null) :
                dateValue.toISOString();
            }
            break;

          case 'boolean':
            if (typeof value === 'string') {
              const lowerValue = value.toLowerCase();
              transformed[rule.field] = ['true', 'yes', '1', 'on'].includes(lowerValue);
            } else {
              transformed[rule.field] = Boolean(value);
            }
            break;

          case 'url':
            if (typeof value === 'string') {
              try {
                const url = new URL(value);
                transformed[rule.field] = url.toString();
              } catch {
                transformed[rule.field] = rule.default || value;
              }
            }
            break;

          default:
            // No transformation
            break;
        }
      } catch (error) {
        if (schema.strict) {
          throw new Error(`Transformation failed for field ${rule.field}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        // Use default value or original value
        transformed[rule.field] = rule.default !== undefined ? rule.default : value;
      }
    });

    return transformed;
  });
}

/**
 * Validate data according to rules
 */
export function validateData(data: any[], rules: ValidationRules): ValidationResult {
  const errors: Array<{ field: string; message: string; value: any }> = [];
  const warnings: string[] = [];

  if (!Array.isArray(data)) {
    return {
      isValid: false,
      errors: [{ field: 'data', message: 'Data must be an array', value: data }],
      warnings: []
    };
  }

  data.forEach((item, index) => {
    rules.rules.forEach(rule => {
      const value = item[rule.field];

      // Check required fields
      if (rule.required && (value === undefined || value === null || value === '')) {
        errors.push({
          field: rule.field,
          message: `Required field missing at row ${index}`,
          value: value
        });
        return;
      }

      if (value === undefined || value === null) {
        return; // Skip validation for optional empty fields
      }

      // Check type
      if (rule.type) {
        const actualType = typeof value;
        if (rule.type === 'array' && !Array.isArray(value)) {
          errors.push({
            field: rule.field,
            message: `Expected array but got ${actualType} at row ${index}`,
            value: value
          });
        } else if (rule.type !== 'array' && actualType !== rule.type) {
          if (rules.strict) {
            errors.push({
              field: rule.field,
              message: `Expected ${rule.type} but got ${actualType} at row ${index}`,
              value: value
            });
          } else {
            warnings.push(`Type mismatch for ${rule.field} at row ${index}: expected ${rule.type}, got ${actualType}`);
          }
        }
      }

      // Check pattern
      if (rule.pattern && typeof value === 'string') {
        const regex = new RegExp(rule.pattern);
        if (!regex.test(value)) {
          errors.push({
            field: rule.field,
            message: `Pattern validation failed for ${rule.field} at row ${index}`,
            value: value
          });
        }
      }

      // Check numeric ranges
      if (typeof value === 'number') {
        if (rule.min !== undefined && value < rule.min) {
          errors.push({
            field: rule.field,
            message: `Value ${value} is below minimum ${rule.min} at row ${index}`,
            value: value
          });
        }
        if (rule.max !== undefined && value > rule.max) {
          errors.push({
            field: rule.field,
            message: `Value ${value} is above maximum ${rule.max} at row ${index}`,
            value: value
          });
        }
      }
    });
  });

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  };
}

/**
 * Aggregate data with grouping and metrics
 */
export function aggregateData(
  data: any[],
  groupBy: string[],
  metrics: Metric[]
): any[] {
  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  // Group data
  const groups = new Map<string, any[]>();

  data.forEach(item => {
    const groupKey = groupBy.map(field => item[field] || '').join('|');

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(item);
  });

  // Calculate metrics for each group
  const result: any[] = [];

  groups.forEach((groupItems, groupKey) => {
    const groupResult: any = {};

    // Add grouping fields
    groupBy.forEach((field, index) => {
      const groupValues = groupKey.split('|');
      groupResult[field] = groupValues[index] || '';
    });

    // Calculate metrics
    metrics.forEach(metric => {
      const fieldName = metric.as || `${metric.field}_${metric.operation}`;
      const values = groupItems
        .map(item => item[metric.field])
        .filter(val => val !== undefined && val !== null);

      switch (metric.operation) {
        case 'sum':
          groupResult[fieldName] = values.reduce((sum, val) => sum + (Number(val) || 0), 0);
          break;

        case 'avg':
          const numValues = values.map(val => Number(val) || 0);
          groupResult[fieldName] = numValues.length > 0 ?
            numValues.reduce((sum, val) => sum + val, 0) / numValues.length : 0;
          break;

        case 'min':
          const minValues = values.map(val => Number(val) || 0);
          groupResult[fieldName] = minValues.length > 0 ? Math.min(...minValues) : 0;
          break;

        case 'max':
          const maxValues = values.map(val => Number(val) || 0);
          groupResult[fieldName] = maxValues.length > 0 ? Math.max(...maxValues) : 0;
          break;

        case 'count':
          groupResult[fieldName] = values.length;
          break;

        default:
          groupResult[fieldName] = values.length;
      }
    });

    result.push(groupResult);
  });

  return result;
}

/**
 * Detect data types in a dataset
 */
export function detectDataTypes(data: any[]): Record<string, string> {
  if (!Array.isArray(data) || data.length === 0) {
    return {};
  }

  const fieldTypes: Record<string, Record<string, number>> = {};
  const result: Record<string, string> = {};

  // Analyze each field across all records
  data.forEach(item => {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach(field => {
        if (!fieldTypes[field]) {
          fieldTypes[field] = {};
        }

        const value = item[field];
        let detectedType = 'unknown';

        if (value === null || value === undefined) {
          detectedType = 'null';
        } else if (typeof value === 'boolean') {
          detectedType = 'boolean';
        } else if (typeof value === 'number') {
          detectedType = Number.isInteger(value) ? 'integer' : 'float';
        } else if (typeof value === 'string') {
          // Try to detect more specific types
          if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
            detectedType = 'date';
          } else if (/^https?:\/\//.test(value)) {
            detectedType = 'url';
          } else if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(value)) {
            detectedType = 'email';
          } else if (/^\+?[\d\s\-\(\)]+$/.test(value)) {
            detectedType = 'phone';
          } else if (!isNaN(Number(value)) && value.trim() !== '') {
            detectedType = 'numeric_string';
          } else {
            detectedType = 'string';
          }
        } else if (Array.isArray(value)) {
          detectedType = 'array';
        } else if (typeof value === 'object') {
          detectedType = 'object';
        }

        fieldTypes[field][detectedType] = (fieldTypes[field][detectedType] || 0) + 1;
      });
    }
  });

  // Determine the most common type for each field
  Object.keys(fieldTypes).forEach(field => {
    const typeCounts = fieldTypes[field];
    let maxCount = 0;
    let mostCommonType = 'unknown';

    Object.entries(typeCounts).forEach(([type, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonType = type;
      }
    });

    result[field] = mostCommonType;
  });

  return result;
}

/**
 * Clean and normalize data
 */
export function cleanData(data: any[], options: {
  trimStrings?: boolean;
  removeEmptyRows?: boolean;
  removeEmptyFields?: boolean;
  standardizeNulls?: boolean;
} = {}): any[] {
  const {
    trimStrings = true,
    removeEmptyRows = true,
    removeEmptyFields = false,
    standardizeNulls = true
  } = options;

  if (!Array.isArray(data)) {
    return [];
  }

  let cleaned = data.filter(item => {
    if (removeEmptyRows) {
      if (item === null || item === undefined) return false;
      if (typeof item === 'object') {
        const values = Object.values(item);
        return values.some(val => val !== null && val !== undefined && val !== '');
      }
    }
    return true;
  });

  cleaned = cleaned.map(item => {
    if (typeof item !== 'object' || item === null) {
      return item;
    }

    const cleanedItem: any = {};

    Object.entries(item).forEach(([key, value]) => {
      let cleanedValue = value;

      // Standardize nulls
      if (standardizeNulls && (value === '' || value === 'null' || value === 'NULL')) {
        cleanedValue = null;
      }

      // Trim strings
      if (trimStrings && typeof cleanedValue === 'string') {
        cleanedValue = cleanedValue.trim();
      }

      // Remove empty fields if requested
      if (removeEmptyFields && (cleanedValue === null || cleanedValue === undefined || cleanedValue === '')) {
        return;
      }

      cleanedItem[key] = cleanedValue;
    });

    return cleanedItem;
  });

  return cleaned;
}

/**
 * Extract table data from HTML with advanced options
 */
export function extractTableFromHTML(
  html: string,
  options: {
    skipRows?: number;
    maxRows?: number;
    headerRow?: number;
    parseNumbers?: boolean;
    parseDates?: boolean;
  } = {}
): { data: any[][]; headers: string[] | null } {
  if (!html || typeof html !== 'string') {
    return { data: [], headers: null };
  }

  const {
    skipRows = 0,
    maxRows,
    headerRow,
    parseNumbers = false,
    parseDates = false
  } = options;

  const data: any[][] = [];
  let headers: string[] | null = null;

  // Extract table content
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    return { data: [], headers: null };
  }

  const tableContent = tableMatch[1] || '';

  // Extract rows
  const rowMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rowMatches) {
    return { data: [], headers: null };
  }

  rowMatches.forEach((rowMatch, rowIndex) => {
    if (skipRows && rowIndex < skipRows) return;
    if (maxRows && data.length >= maxRows) return;

    const row: any[] = [];

    // Extract cells (th or td)
    const cellMatches = rowMatch.match(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi) || [];

    cellMatches.forEach(cellMatch => {
      // Extract cell content and clean it
      let cellContent = cellMatch.replace(/<[^>]*>/g, '').trim();

      // Decode HTML entities
      cellContent = cellContent
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      // Parse numbers if requested
      if (parseNumbers && /^-?\d+\.?\d*$/.test(cellContent.trim())) {
        const numValue = parseFloat(cellContent);
        if (!isNaN(numValue)) {
          cellContent = numValue.toString();
        }
      }

      // Parse dates if requested
      if (parseDates && typeof cellContent === 'string' && /\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4}/.test(cellContent)) {
        const dateValue = new Date(cellContent);
        if (!isNaN(dateValue.getTime())) {
          cellContent = dateValue.toISOString();
        }
      }

      row.push(cellContent);
    });

    // Check if this should be the header row
    if (headerRow === rowIndex) {
      headers = row.map(cell => String(cell));
    } else {
      data.push(row);
    }
  });

  return { data, headers };
}

/**
 * Convert data to different formats
 */
export function convertToFormat(data: any[], format: 'json' | 'csv' | 'array' | 'object', headers?: string[]): any {
  if (!Array.isArray(data)) {
    return null;
  }

  switch (format) {
    case 'json':
      return JSON.stringify(data, null, 2);

    case 'csv':
      if (data.length === 0) return '';

      let csvContent = '';

      // Add headers if available
      if (headers && headers.length > 0) {
        csvContent += headers.map(header =>
          header.includes(',') || header.includes('"') ? `"${header.replace(/"/g, '""')}"` : header
        ).join(',') + '\n';
      }

      // Add data rows
      data.forEach(row => {
        if (Array.isArray(row)) {
          csvContent += row.map(cell => {
            const cellStr = String(cell || '');
            return cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n') ?
              `"${cellStr.replace(/"/g, '""')}"` : cellStr;
          }).join(',') + '\n';
        }
      });

      return csvContent.trim();

    case 'array':
      return data;

    case 'object':
      if (headers && headers.length > 0) {
        return data.map(row => {
          if (Array.isArray(row)) {
            const obj: Record<string, any> = {};
            headers.forEach((header, index) => {
              obj[header] = row[index];
            });
            return obj;
          }
          return row;
        });
      }
      return data;

    default:
      return data;
  }
}

/**
 * Analyze data quality
 */
export function analyzeDataQuality(data: any[]): {
  totalRows: number;
  completeness: Record<string, number>;
  duplicates: number;
  dataTypes: Record<string, string>;
  summary: string;
} {
  if (!Array.isArray(data) || data.length === 0) {
    return {
      totalRows: 0,
      completeness: {},
      duplicates: 0,
      dataTypes: {},
      summary: 'No data to analyze'
    };
  }

  const totalRows = data.length;
  const completeness: Record<string, number> = {};
  const dataTypes = detectDataTypes(data);

  // Calculate completeness for each field
  if (data.length > 0 && typeof data[0] === 'object') {
    const fields = Object.keys(data[0]);

    fields.forEach(field => {
      const nonEmptyCount = data.filter(item =>
        item[field] !== null &&
        item[field] !== undefined &&
        item[field] !== ''
      ).length;

      completeness[field] = totalRows > 0 ? (nonEmptyCount / totalRows) * 100 : 0;
    });
  }

  // Detect duplicates (simple approach)
  const uniqueRows = new Set(data.map(item => JSON.stringify(item)));
  const duplicates = totalRows - uniqueRows.size;

  // Generate summary
  const avgCompleteness = Object.values(completeness).length > 0 ?
    Object.values(completeness).reduce((sum, val) => sum + val, 0) / Object.values(completeness).length : 0;

  const summary = `Dataset: ${totalRows} rows, ${Object.keys(completeness).length} fields, ` +
    `${avgCompleteness.toFixed(1)}% avg completeness, ${duplicates} duplicates`;

  return {
    totalRows,
    completeness,
    duplicates,
    dataTypes,
    summary
  };
}