function getStartOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getStartOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust for Monday start
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfWeek(date = new Date()) {
  const d = getStartOfWeek(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getStartOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfMonth(date = new Date()) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  d.setHours(23, 59, 59, 999);
  return d;
}

function getDateRangeForAnalysis(endDate = new Date(), days = 90) {
  if (days > 90) {
    throw new Error('Analysis window cannot exceed 90 days');
  }
  
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);
  
  return {
    start: startDate,
    end: endDate,
    days: days
  };
}

function getNextBillingDate(frequency, interval = 1, billingDate = 1, currentDate = new Date()) {
  const next = new Date(currentDate);
  
  switch(frequency) {
    case 'daily':
      next.setDate(next.getDate() + interval);
      break;
    case 'weekly':
      next.setDate(next.getDate() + (7 * interval));
      break;
    case 'monthly':
      next.setMonth(next.getMonth() + interval);
      next.setDate(billingDate);
      break;
    case 'quarterly':
      next.setMonth(next.getMonth() + (3 * interval));
      next.setDate(billingDate);
      break;
    case 'yearly':
      next.setFullYear(next.getFullYear() + interval);
      next.setDate(billingDate);
      break;
    default:
      throw new Error('Invalid frequency');
  }
  
  return next;
}

function isWithinAnalysisWindow(date, endDate = new Date(), maxDays = 90) {
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - maxDays);
  
  const checkDate = new Date(date);
  return checkDate >= startDate && checkDate <= endDate;
}

module.exports = {
  getStartOfDay,
  getEndOfDay,
  getStartOfWeek,
  getEndOfWeek,
  getStartOfMonth,
  getEndOfMonth,
  getDateRangeForAnalysis,
  getNextBillingDate,
  isWithinAnalysisWindow
};