const weeklySummaryTemplate = (data) => {
  const {
    weekStart,
    weekEnd,
    metrics,
    shifts,
    historicalContext,
    userPreferences
  } = data;

  return `
You are a neutral financial analyst. Generate a concise weekly financial summary with exactly 5 insights based on the data below.

## WEEK PERIOD
${weekStart} to ${weekEnd}

## KEY METRICS
- Income: $${metrics.income.total.toFixed(2)} (${metrics.income.change > 0 ? '+' : ''}${metrics.income.change.toFixed(1)}% vs last week)
- Expenses: $${metrics.expenses.total.toFixed(2)} (${metrics.expenses.change > 0 ? '+' : ''}${metrics.expenses.change.toFixed(1)}% vs last week)
- Net Savings: $${metrics.savings.total.toFixed(2)} (${metrics.savings.change > 0 ? '+' : ''}${metrics.savings.change.toFixed(1)}% vs last week)
- Savings Rate: ${metrics.savings.rate.toFixed(1)}% (${metrics.savings.rate - (historicalContext?.avgSavingsRate || 0) > 0 ? '+' : ''}${(metrics.savings.rate - (historicalContext?.avgSavingsRate || 0)).toFixed(1)}% vs average)

## CATEGORY BREAKDOWN
${metrics.expenses.byCategory.map(c => 
  `- ${c.categoryName}: $${c.amount.toFixed(2)} (${c.percentage.toFixed(1)}% of total)`
).join('\n')}

## SIGNIFICANT SHIFTS DETECTED
${shifts.map(s => `- ${s.description} (${s.significance} significance)`).join('\n')}

## BUDGET STATUS
- On Track: ${metrics.budgets.onTrack}
- At Risk: ${metrics.budgets.atRisk}
- Exceeded: ${metrics.budgets.exceeded}

## GOAL PROGRESS
- Overall Progress: ${metrics.goals.progress.toFixed(1)}%
- Contributions This Week: $${metrics.goals.contributions.toFixed(2)}

## SUBSCRIPTIONS
- Active: ${metrics.subscriptions.active}
- Monthly Total: $${metrics.subscriptions.totalMonthly.toFixed(2)}

## HISTORICAL CONTEXT (4-week average)
- Avg Income: $${historicalContext.avgIncome.toFixed(2)}
- Avg Expenses: $${historicalContext.avgExpenses.toFixed(2)}
- Avg Savings Rate: ${historicalContext.avgSavingsRate.toFixed(1)}%

## USER PREFERENCES
- Risk Tolerance: ${userPreferences.riskTolerance || 'medium'}
- Primary Goals: ${userPreferences.primaryGoals?.join(', ') || 'Not specified'}

## TASK
Generate exactly 5 neutral, data-driven insights about this week's finances.
Each insight must:
1. Be based strictly on the provided data
2. Include specific numbers and percentages
3. Be neutral in tone (neither overly positive nor negative)
4. Focus on significant observations
5. Be concise and clear

## RESPONSE FORMAT
Return a JSON object with exactly this structure:
{
  "insights": [
    {
      "id": "1",
      "type": "spending|savings|budget|goal|subscription|income|warning|achievement",
      "title": "Clear, concise title (max 60 chars)",
      "description": "Detailed observation with specific numbers (max 150 chars)",
      "impact": {
        "amount": number (optional),
        "percentage": number (optional),
        "direction": "positive|negative|neutral"
      },
      "confidence": number (0-100),
      "priority": "high|medium|low",
      "actionItems": ["Optional suggestion 1", "Optional suggestion 2"]
    }
  ],
  "summary": {
    "overview": "One sentence summary of the week",
    "topInsight": "The most important observation",
    "highlights": ["Positive observation 1", "Positive observation 2"],
    "lowlights": ["Area for attention 1", "Area for attention 2"],
    "neutral": ["Neutral observation 1"]
  }
}

## CONSTRAINTS
- Generate EXACTLY 5 insights
- Keep titles under 60 characters
- Keep descriptions under 150 characters
- Confidence must be > 70 for all insights
- No speculation beyond the data
- Be neutral - don't judge, just observe
`;
};

module.exports = weeklySummaryTemplate;