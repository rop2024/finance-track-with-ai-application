/**
 * Validate email
 */
export const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

/**
 * Validate password strength
 */
export const isStrongPassword = (password) => {
  const minLength = 8;
  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  return (
    password.length >= minLength &&
    hasUpperCase &&
    hasLowerCase &&
    hasNumbers &&
    hasSpecialChar
  );
};

/**
 * Validate transaction amount
 */
export const isValidAmount = (amount) => {
  const num = parseFloat(amount);
  return !isNaN(num) && num > 0 && num <= 1000000;
};

/**
 * Validate date
 */
export const isValidDate = (date) => {
  const d = new Date(date);
  return d instanceof Date && !isNaN(d);
};

/**
 * Validate future date
 */
export const isFutureDate = (date) => {
  return new Date(date) > new Date();
};

/**
 * Validate category type
 */
export const isValidCategoryType = (type) => {
  return ['need', 'want', 'saving', 'fixed', 'income'].includes(type);
};

/**
 * Validate budget period
 */
export const isValidBudgetPeriod = (period) => {
  return ['weekly', 'monthly', 'yearly', 'custom'].includes(period);
};

/**
 * Validate subscription frequency
 */
export const isValidFrequency = (frequency) => {
  return ['daily', 'weekly', 'monthly', 'quarterly', 'yearly', 'custom'].includes(frequency);
};

/**
 * Validate color code
 */
export const isValidColor = (color) => {
  const re = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
  return re.test(color);
};

/**
 * Validate phone number
 */
export const isValidPhone = (phone) => {
  const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/;
  return re.test(phone);
};

/**
 * Validate URL
 */
export const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Validate that end date is after start date
 */
export const isEndDateAfterStart = (startDate, endDate) => {
  return new Date(endDate) > new Date(startDate);
};

/**
 * Validate percentage
 */
export const isValidPercentage = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0 && num <= 100;
};

/**
 * Validate array length
 */
export const isValidArrayLength = (arr, min = 0, max = Infinity) => {
  return Array.isArray(arr) && arr.length >= min && arr.length <= max;
};

/**
 * Validate positive integer
 */
export const isPositiveInteger = (value) => {
  const num = parseInt(value);
  return Number.isInteger(num) && num > 0;
};

/**
 * Validate non-negative number
 */
export const isNonNegative = (value) => {
  const num = parseFloat(value);
  return !isNaN(num) && num >= 0;
};