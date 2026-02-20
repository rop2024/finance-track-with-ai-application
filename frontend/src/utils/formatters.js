/**
 * Format currency amount
 */
export const formatCurrency = (amount, currency = 'USD') => {
  if (amount === undefined || amount === null) return '$0.00';
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Format percentage
 */
export const formatPercentage = (value, decimals = 1) => {
  if (value === undefined || value === null) return '0%';
  
  return `${value > 0 ? '+' : ''}${value.toFixed(decimals)}%`;
};

/**
 * Format date
 */
export const formatDate = (date, format = 'medium') => {
  if (!date) return '';
  
  const d = new Date(date);
  
  const options = {
    short: { month: 'numeric', day: 'numeric', year: '2-digit' },
    medium: { month: 'short', day: 'numeric', year: 'numeric' },
    long: { month: 'long', day: 'numeric', year: 'numeric' },
    full: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  };

  return d.toLocaleDateString('en-US', options[format] || options.medium);
};

/**
 * Format time
 */
export const formatTime = (date) => {
  if (!date) return '';
  
  return new Date(date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
};

/**
 * Format datetime
 */
export const formatDateTime = (date) => {
  if (!date) return '';
  
  return `${formatDate(date)} at ${formatTime(date)}`;
};

/**
 * Format number with commas
 */
export const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  
  return num.toLocaleString('en-US');
};

/**
 * Format file size
 */
export const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Truncate text
 */
export const truncateText = (text, maxLength = 100) => {
  if (!text || text.length <= maxLength) return text;
  
  return text.substring(0, maxLength) + '...';
};

/**
 * Capitalize first letter
 */
export const capitalizeFirst = (str) => {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Get relative time
 */
export const getRelativeTime = (date) => {
  const now = new Date();
  const diff = now - new Date(date);
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 7) return formatDate(date);
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
  return 'Just now';
};