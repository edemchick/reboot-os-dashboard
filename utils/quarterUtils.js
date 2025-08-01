import { getQuarterlyConfig } from '../pages/api/admin/quarterly-config.js';

// Calculate quarter info based on configurable dates
export function getQuarterInfo() {
  const config = getQuarterlyConfig();
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1; // January is 1
  const day = now.getDate();

  // Check each quarter to see which one we're in
  for (const [quarterName, quarterConfig] of Object.entries(config.quarters)) {
    const { start, end } = quarterConfig;
    
    let startDate, endDate;
    
    if (end.nextYear) {
      // Handle Q4 case where end date is in next year
      startDate = new Date(year, start.month - 1, start.day);
      endDate = new Date(year + 1, end.month - 1, end.day);
      
      // Check if we're in the current year part of Q4 or next year part
      if ((month > start.month || (month === start.month && day >= start.day)) ||
          (month < end.month || (month === end.month && day <= end.day))) {
        
        // We're in this quarter
        const totalQuarterDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const daysSinceStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const quarterProgress = Math.max(0, Math.min(1, daysSinceStart / totalQuarterDays));
        
        return {
          quarter: quarterName,
          quarterProgress: quarterProgress * 100,
          startDate,
          endDate
        };
      }
    } else {
      // Handle normal quarters within the same year
      startDate = new Date(year, start.month - 1, start.day);
      endDate = new Date(year, end.month - 1, end.day);
      
      // Check if current date falls within this quarter
      if ((month > start.month || (month === start.month && day >= start.day)) &&
          (month < end.month || (month === end.month && day <= end.day))) {
        
        // We're in this quarter
        const totalQuarterDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const daysSinceStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
        const quarterProgress = Math.max(0, Math.min(1, daysSinceStart / totalQuarterDays));
        
        return {
          quarter: quarterName,
          quarterProgress: quarterProgress * 100,
          startDate,
          endDate
        };
      }
    }
  }

  // Fallback - shouldn't happen with proper config
  return {
    quarter: 'Q1',
    quarterProgress: 0,
    startDate: new Date(year, 0, 11),
    endDate: new Date(year, 3, 10)
  };
}