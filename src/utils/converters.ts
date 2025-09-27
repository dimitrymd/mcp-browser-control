/**
 * Content conversion utilities for various formats
 */

/**
 * Convert HTML to plain text
 */
export function htmlToText(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  return html
    // Remove script and style elements
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')

    // Replace common block elements with newlines
    .replace(/<\/?(div|p|br|h[1-6]|li|tr|td|th|section|article|header|footer|nav|aside)[^>]*>/gi, '\n')

    // Remove all other HTML tags
    .replace(/<[^>]*>/g, '')

    // Decode HTML entities
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")

    // Clean up whitespace
    .replace(/\n\s*\n/g, '\n') // Remove empty lines
    .replace(/[ \t]+/g, ' ') // Normalize spaces
    .trim();
}

/**
 * Convert HTML to Markdown (basic implementation)
 */
export function htmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') {
    return '';
  }

  let markdown = html;

  // Headers
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n\n');
  markdown = markdown.replace(/<h5[^>]*>(.*?)<\/h5>/gi, '##### $1\n\n');
  markdown = markdown.replace(/<h6[^>]*>(.*?)<\/h6>/gi, '###### $1\n\n');

  // Bold and italic
  markdown = markdown.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  markdown = markdown.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  markdown = markdown.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  markdown = markdown.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');

  // Links
  markdown = markdown.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/gi, '[$2]($1)');

  // Images
  markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*alt=["']([^"']*)["'][^>]*>/gi, '![$2]($1)');
  markdown = markdown.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*src=["']([^"']*)["'][^>]*>/gi, '![$1]($2)');
  markdown = markdown.replace(/<img[^>]*src=["']([^"']*)["'][^>]*>/gi, '![]($1)');

  // Code
  markdown = markdown.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  markdown = markdown.replace(/<pre[^>]*><code[^>]*>(.*?)<\/code><\/pre>/gis, '```\n$1\n```\n');
  markdown = markdown.replace(/<pre[^>]*>(.*?)<\/pre>/gis, '```\n$1\n```\n');

  // Lists
  markdown = markdown.replace(/<ul[^>]*>/gi, '');
  markdown = markdown.replace(/<\/ul>/gi, '\n');
  markdown = markdown.replace(/<ol[^>]*>/gi, '');
  markdown = markdown.replace(/<\/ol>/gi, '\n');
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');

  // Blockquotes
  markdown = markdown.replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gis, (match, content) => {
    const lines = content.trim().split('\n');
    return lines.map((line: string) => `> ${line.trim()}`).join('\n') + '\n\n';
  });

  // Line breaks and paragraphs
  markdown = markdown.replace(/<br[^>]*>/gi, '\n');
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  markdown = markdown.replace(/<div[^>]*>(.*?)<\/div>/gi, '$1\n');

  // Tables (basic support)
  markdown = markdown.replace(/<table[^>]*>/gi, '');
  markdown = markdown.replace(/<\/table>/gi, '\n');
  markdown = markdown.replace(/<tr[^>]*>/gi, '|');
  markdown = markdown.replace(/<\/tr>/gi, '|\n');
  markdown = markdown.replace(/<th[^>]*>(.*?)<\/th>/gi, ' $1 |');
  markdown = markdown.replace(/<td[^>]*>(.*?)<\/td>/gi, ' $1 |');

  // Remove remaining HTML tags
  markdown = markdown.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  markdown = markdown
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");

  // Clean up whitespace
  markdown = markdown
    .replace(/\n\s*\n\s*\n/g, '\n\n') // Remove excessive empty lines
    .replace(/[ \t]+/g, ' ') // Normalize spaces
    .trim();

  return markdown;
}

/**
 * Clean and normalize text content
 */
export function cleanText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  return text
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    // Remove control characters except newlines and tabs
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Remove excessive empty lines
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

/**
 * Extract table data from HTML table
 */
export function extractTableData(html: string): Array<Array<string>> {
  if (!html || typeof html !== 'string') {
    return [];
  }

  const tableData: Array<Array<string>> = [];

  // Simple regex-based table extraction
  const tableMatch = html.match(/<table[^>]*>([\s\S]*?)<\/table>/i);
  if (!tableMatch) {
    return [];
  }

  const tableContent = tableMatch[1] || '';

  // Extract rows
  const rowMatches = tableContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi);
  if (!rowMatches) {
    return [];
  }

  for (const rowMatch of rowMatches) {
    const row: string[] = [];

    // Extract cells (th or td)
    const cellMatches = rowMatch.match(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi) || [];
    if (cellMatches.length > 0) {
      for (const cellMatch of cellMatches) {
        // Extract cell content and clean it
        const cellContent = cellMatch.replace(/<[^>]*>/g, '').trim();
        const cleanContent = cleanText(cellContent);
        row.push(cleanContent);
      }
    }

    if (row.length > 0) {
      tableData.push(row);
    }
  }

  return tableData;
}

/**
 * Convert table data to CSV format
 */
export function tableToCSV(tableData: Array<Array<string>>): string {
  if (!Array.isArray(tableData) || tableData.length === 0) {
    return '';
  }

  return tableData
    .map(row =>
      row.map(cell => {
        // Escape cells containing commas, quotes, or newlines
        if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
          return `"${cell.replace(/"/g, '""')}"`;
        }
        return cell;
      }).join(',')
    )
    .join('\n');
}

/**
 * Convert table data to JSON format
 */
export function tableToJSON(
  tableData: Array<Array<string>>,
  useFirstRowAsHeaders: boolean = true
): Array<Record<string, string>> {
  if (!Array.isArray(tableData) || tableData.length === 0) {
    return [];
  }

  if (tableData.length === 1 && !useFirstRowAsHeaders) {
    return [];
  }

  let headers: string[];
  let dataRows: Array<Array<string>>;

  if (useFirstRowAsHeaders) {
    headers = tableData[0] || [];
    dataRows = tableData.slice(1);
  } else {
    // Generate column headers
    const maxColumns = Math.max(...tableData.map(row => row.length));
    headers = Array.from({ length: maxColumns }, (_, i) => `column_${i + 1}`);
    dataRows = tableData;
  }

  return dataRows.map(row => {
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
}

/**
 * Parse CSV string to table data
 */
export function parseCSV(csv: string): Array<Array<string>> {
  if (!csv || typeof csv !== 'string') {
    return [];
  }

  const result: Array<Array<string>> = [];
  const lines = csv.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let currentField = '';
    let inQuotes = false;
    let i = 0;

    while (i < line.length) {
      const char = line[i];

      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        if (line[i + 1] === '"') {
          // Escaped quote
          currentField += '"';
          i++; // Skip next quote
        } else {
          inQuotes = false;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }

      i++;
    }

    // Add the last field
    row.push(currentField);
    result.push(row);
  }

  return result;
}

/**
 * Format text content for display with proper line breaks
 */
export function formatForDisplay(text: string, maxWidth: number = 80): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  const lines = text.split('\n');
  const formattedLines: string[] = [];

  for (const line of lines) {
    if (line.length <= maxWidth) {
      formattedLines.push(line);
    } else {
      // Word wrap
      const words = line.split(' ');
      let currentLine = '';

      for (const word of words) {
        if (currentLine.length + word.length + 1 <= maxWidth) {
          currentLine += (currentLine ? ' ' : '') + word;
        } else {
          if (currentLine) {
            formattedLines.push(currentLine);
          }
          currentLine = word;
        }
      }

      if (currentLine) {
        formattedLines.push(currentLine);
      }
    }
  }

  return formattedLines.join('\n');
}

/**
 * Extract structured data from HTML lists
 */
export function extractListData(html: string): {
  ordered: Array<Array<string>>;
  unordered: Array<Array<string>>;
} {
  const result = {
    ordered: [] as Array<Array<string>>,
    unordered: [] as Array<Array<string>>
  };

  // Extract ordered lists
  const olMatches = html.match(/<ol[^>]*>([\s\S]*?)<\/ol>/gi);
  if (olMatches) {
    for (const olMatch of olMatches) {
      const items = extractListItems(olMatch);
      if (items.length > 0) {
        result.ordered.push(items);
      }
    }
  }

  // Extract unordered lists
  const ulMatches = html.match(/<ul[^>]*>([\s\S]*?)<\/ul>/gi);
  if (ulMatches) {
    for (const ulMatch of ulMatches) {
      const items = extractListItems(ulMatch);
      if (items.length > 0) {
        result.unordered.push(items);
      }
    }
  }

  return result;
}

/**
 * Extract list items from a list HTML
 */
function extractListItems(listHtml: string): string[] {
  const items: string[] = [];
  const liMatches = listHtml.match(/<li[^>]*>([\s\S]*?)<\/li>/gi);

  if (liMatches) {
    for (const liMatch of liMatches) {
      const content = liMatch.replace(/<li[^>]*>([\s\S]*?)<\/li>/i, '$1');
      const cleanContent = htmlToText(content).trim();
      if (cleanContent) {
        items.push(cleanContent);
      }
    }
  }

  return items;
}

/**
 * Detect and parse JSON from text content
 */
export function extractJSON(text: string): any[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const jsonObjects: any[] = [];

  // Find potential JSON objects and arrays
  const jsonPattern = /(\{[^{}]*\}|\[[^\[\]]*\])/g;
  const matches = text.match(jsonPattern);

  if (matches) {
    for (const match of matches) {
      try {
        const parsed = JSON.parse(match);
        jsonObjects.push(parsed);
      } catch {
        // Ignore invalid JSON
      }
    }
  }

  return jsonObjects;
}