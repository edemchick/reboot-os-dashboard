// Calculate quarter info based on standard calendar quarters
// Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec
export function getQuarterInfo() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed (0 = January, 11 = December)

  console.log('getQuarterInfo called - Date:', now.toISOString(), 'Month:', month);

  let quarter, startDate, endDate;

  if (month >= 0 && month <= 2) {
    // Q1: January 1 - March 31
    quarter = 'Q1';
    startDate = new Date(year, 0, 1);
    endDate = new Date(year, 2, 31);
  } else if (month >= 3 && month <= 5) {
    // Q2: April 1 - June 30
    quarter = 'Q2';
    startDate = new Date(year, 3, 1);
    endDate = new Date(year, 5, 30);
  } else if (month >= 6 && month <= 8) {
    // Q3: July 1 - September 30
    quarter = 'Q3';
    startDate = new Date(year, 6, 1);
    endDate = new Date(year, 8, 30);
  } else {
    // Q4: October 1 - December 31
    quarter = 'Q4';
    startDate = new Date(year, 9, 1);
    endDate = new Date(year, 11, 31);
  }

  // Calculate progress through the quarter
  const totalQuarterDays = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const daysSinceStart = (now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
  const quarterProgress = Math.max(0, Math.min(100, (daysSinceStart / totalQuarterDays) * 100));

  return {
    quarter,
    quarterProgress,
    startDate,
    endDate
  };
}