/**
 * Parse a date string, handling date-only strings (YYYY-MM-DD) correctly
 * to avoid timezone shifts. Date-only strings are parsed in local timezone.
 * 
 * @param dateString - ISO date string (YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss)
 * @returns Date object in local timezone
 */
export function parseDate(dateString: string): Date {
  // If it's a date-only string (no 'T'), parse it in local timezone
  if (!dateString.includes('T')) {
    const [year, month, day] = dateString.split('-').map(Number);
    // month is 0-indexed in Date constructor
    return new Date(year, month - 1, day);
  }
  // ISO string with time - use standard parsing
  return new Date(dateString);
}

/**
 * Format a date string for display, handling all-day events correctly
 * 
 * @param dateString - ISO date string
 * @param isAllDay - Whether this is an all-day event
 * @param options - Formatting options
 * @returns Formatted date string
 */
export function formatDate(
  dateString: string, 
  isAllDay: boolean = false,
  options?: Intl.DateTimeFormatOptions
): string {
  const date = parseDate(dateString);
  
  if (isAllDay || !dateString.includes('T')) {
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      ...options
    });
  }
  
  return date.toLocaleString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    ...options
  });
}

