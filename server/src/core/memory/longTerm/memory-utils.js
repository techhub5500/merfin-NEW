/**
 * NOTE (memory-utils.js):
 * Purpose: Utility functions for Long-Term Memory date handling and category descriptions.
 * Controls: Date extraction, formatting with "Em DD/MM/YYYY, ..." prefix, word counting.
 * Behavior: Pure functions for data transformation, no external API calls.
 * Integration notes: Used by long-term-memory.js during propose().
 */

const wordCounter = require('../shared/word-counter');

/**
 * Extract date from memory content
 * Patterns recognized:
 * - DD/MM/YYYY
 * - DD-MM-YYYY
 * - DD de MONTH de YYYY
 * - "hoje", "ontem", "esta semana", etc.
 * 
 * @param {string} content - Memory content
 * @returns {Date|null} - Extracted date or null if none found
 */
function extractDateFromContent(content) {
  // Pattern 1: DD/MM/YYYY or DD-MM-YYYY
  const numericDateRegex = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/;
  const numericMatch = content.match(numericDateRegex);
  
  if (numericMatch) {
    const [, day, month, year] = numericMatch;
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  // Pattern 2: DD de MONTH de YYYY
  const portugueseMonths = {
    'janeiro': 0, 'jan': 0,
    'fevereiro': 1, 'fev': 1,
    'março': 2, 'mar': 2,
    'abril': 3, 'abr': 3,
    'maio': 4, 'mai': 4,
    'junho': 5, 'jun': 5,
    'julho': 6, 'jul': 6,
    'agosto': 7, 'ago': 7,
    'setembro': 8, 'set': 8,
    'outubro': 9, 'out': 9,
    'novembro': 10, 'nov': 10,
    'dezembro': 11, 'dez': 11
  };

  const monthNameRegex = /\b(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})\b/i;
  const monthMatch = content.match(monthNameRegex);
  
  if (monthMatch) {
    const [, day, monthName, year] = monthMatch;
    const monthIndex = portugueseMonths[monthName.toLowerCase()];
    
    if (monthIndex !== undefined) {
      const date = new Date(year, monthIndex, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }
  }

  // Pattern 3: Relative dates (hoje, ontem, etc.)
  const now = new Date();
  const relativePatterns = {
    'hoje': 0,
    'ontem': -1,
    'anteontem': -2
  };

  for (const [keyword, daysOffset] of Object.entries(relativePatterns)) {
    if (content.toLowerCase().includes(keyword)) {
      const date = new Date(now);
      date.setDate(date.getDate() + daysOffset);
      return date;
    }
  }

  // Pattern 4: "esta semana", "semana passada", "mês passado", "ano passado"
  if (content.toLowerCase().includes('esta semana') || content.toLowerCase().includes('nesta semana')) {
    return now;
  }
  if (content.toLowerCase().includes('semana passada')) {
    const date = new Date(now);
    date.setDate(date.getDate() - 7);
    return date;
  }
  if (content.toLowerCase().includes('mês passado') || content.toLowerCase().includes('mes passado')) {
    const date = new Date(now);
    date.setMonth(date.getMonth() - 1);
    return date;
  }
  if (content.toLowerCase().includes('ano passado')) {
    const date = new Date(now);
    date.setFullYear(date.getFullYear() - 1);
    return date;
  }

  // No date found, return current date as default
  return now;
}

/**
 * Format date to DD/MM/YYYY
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Ensure memory content starts with "Em DD/MM/YYYY, ..."
 * If content already has date prefix, replace it. Otherwise, prepend it.
 * 
 * @param {string} content - Original memory content
 * @param {Date} eventDate - Date of the event
 * @returns {string} - Content with date prefix
 */
function ensureDatePrefix(content, eventDate) {
  const formattedDate = formatDate(eventDate);
  const datePrefix = `Em ${formattedDate}, `;
  
  // Check if content already starts with "Em DD/MM/YYYY, "
  const existingPrefixRegex = /^Em \d{2}\/\d{2}\/\d{4}, /;
  
  if (existingPrefixRegex.test(content)) {
    // Replace existing date prefix
    return content.replace(existingPrefixRegex, datePrefix);
  } else {
    // Prepend date prefix
    return datePrefix + content;
  }
}

/**
 * Extract date and ensure proper formatting in one step
 * @param {string} content - Original memory content
 * @returns {{formattedContent: string, eventDate: Date}} - Content with date prefix and extracted date
 */
function processDateInContent(content) {
  const eventDate = extractDateFromContent(content);
  const formattedContent = ensureDatePrefix(content, eventDate);
  
  return {
    formattedContent,
    eventDate
  };
}

/**
 * Count words in description (for 25-word limit enforcement)
 * @param {string} text - Text to count
 * @returns {number} - Word count
 */
function countWords(text) {
  return wordCounter.count(text);
}

/**
 * Truncate text to maximum word count
 * @param {string} text - Text to truncate
 * @param {number} maxWords - Maximum number of words
 * @returns {string} - Truncated text
 */
function truncateToWords(text, maxWords) {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) {
    return text;
  }
  return words.slice(0, maxWords).join(' ') + '...';
}

module.exports = {
  extractDateFromContent,
  formatDate,
  ensureDatePrefix,
  processDateInContent,
  countWords,
  truncateToWords
};
