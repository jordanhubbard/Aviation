/**
 * Utility functions for handling date and time conversions in the frontend.
 * 
 * Rule:
 * - Backend/database: UTC
 * - Frontend display: Local time
 * - Frontend input: Local time → converted to UTC for backend
 */

/**
 * Convert a UTC datetime string to local time and format it
 * @param {string} utcString - UTC datetime string (ISO format)
 * @param {string} format - Optional format string ('full', 'date', 'time', 'datetime')
 * @returns {string} Formatted local datetime string
 */
function utcToLocal(utcString, format = 'datetime') {
    if (!utcString) return '';
    
    // Parse the UTC date string
    const date = new Date(utcString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) return utcString;
    
    // Format options
    const options = {};
    
    switch (format) {
        case 'full':
            options.weekday = 'long';
            options.year = 'numeric';
            options.month = 'long';
            options.day = 'numeric';
            options.hour = '2-digit';
            options.minute = '2-digit';
            break;
        case 'date':
            options.year = 'numeric';
            options.month = 'short';
            options.day = 'numeric';
            break;
        case 'time':
            options.hour = '2-digit';
            options.minute = '2-digit';
            break;
        case 'datetime':
        default:
            options.year = 'numeric';
            options.month = 'short';
            options.day = 'numeric';
            options.hour = '2-digit';
            options.minute = '2-digit';
            break;
    }
    
    return date.toLocaleString(undefined, options);
}

/**
 * Convert a local datetime to UTC for sending to the backend
 * @param {Date} localDate - Local datetime object
 * @returns {string} UTC datetime string in ISO format
 */
function localToUtc(localDate) {
    if (!localDate) return '';
    
    // Convert to UTC ISO string
    return localDate.toISOString();
}

/**
 * Initialize datetime conversion for all elements with the 'utc-datetime' class
 */
function initDateTimeConversion() {
    document.addEventListener('DOMContentLoaded', function() {
        // For each element with class 'utc-datetime', convert to local
        document.querySelectorAll('.utc-datetime').forEach(function(el) {
            const utc = el.getAttribute('data-utc');
            const format = el.getAttribute('data-format') || 'datetime';
            
            if (utc) {
                el.textContent = utcToLocal(utc, format);
            }
        });
        
        // Initialize flatpickr datetime pickers with local timezone handling
        const datetimePickers = document.querySelectorAll('.datetime-picker');
        if (datetimePickers.length > 0 && typeof flatpickr === 'function') {
            datetimePickers.forEach(function(picker) {
                flatpickr(picker, {
                    enableTime: true,
                    dateFormat: "Y-m-d H:i",
                    time_24hr: true,
                    minuteIncrement: 15,
                    // Convert UTC to local when displaying
                    onReady: function(selectedDates, dateStr, instance) {
                        const utcValue = instance.element.getAttribute('data-utc-value');
                        if (utcValue) {
                            instance.setDate(new Date(utcValue), false);
                        }
                    },
                    // Convert local to UTC when submitting
                    onChange: function(selectedDates, dateStr, instance) {
                        if (selectedDates.length > 0) {
                            const utcValue = localToUtc(selectedDates[0]);
                            instance.element.setAttribute('data-utc-value', utcValue);
                        }
                    }
                });
            });
        }
    });
}

// Initialize datetime conversion
initDateTimeConversion();
