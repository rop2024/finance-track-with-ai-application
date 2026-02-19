const budgetInsightsTemplate = (data) => {
  const {
    budgets,
    budgetPerformance,
    categorySpending,
    historicalData,
    userPreferences
  } = data;

  return `
You are a financial analyst assistant. Analyze the following budget data and provide structured recommendations.

## BUDGET DATA

### Current Budgets
${budgets.map(b => `
- Budget: ${b.name}
  Category: ${b.category}
  Amount: $${b.amount}/month
  Period: ${b.period}
  Flexibility: ${b.flexibility}
  Status: ${b.isActive ? 'Active' : 'Inactive'}
`).join('')}

### Budget Performance
${budgetPerformance.map(b => `
- ${b.category}:
  Budgeted: $${b.budgeted}/month
  Actual: $${b.spent}/month
  Variance: ${b.variance > 0 ? '+' : ''}${b.variance}% ($${Math.abs(b.actual - b.budgeted)})
  Status: ${b.status}
  Days in Period: ${b.daysElapsed}/${b.totalDays}
  Projected: $${b.projectedTotal} (${b.projectedVariance > 0 ? '+' : ''}${b.projectedVariance}%)
`).join('')}

### Historical Patterns (Last 3 Months)
${historicalData.map(h => `
- ${h.category}:
  Month 1: $${h.month1}
  Month 2: $${h.month2}
  Month 3: $${h.month3}
  Average: $${h.average}
  Trend: ${h.trend}
`).join('')}

### Category Spending vs Budget
${categorySpending.map(c => `
- ${c.category}:
  Avg Monthly: $${c.averageMonthly}
  Budget: $${c.budgetAmount}
  Difference: ${c.difference > 0 ? '+' : ''}${c.difference}%
  Consistency: ${c.consistency}%
`).join('')}

## USER PREFERENCES
- Risk Tolerance: ${userPreferences.riskTolerance || 'medium'}
- Savings Goal: ${userPreferences.savingsGoal || 'Not specified'}
- Budget Style: ${userPreferences.budgetStyle || 'balanced'}

## ANALYSIS TASK
Provide 3-5 actionable budget insights and recommendations. Each insight must:

1. Focus on budget optimization and adherence
2. Reference specific budget categories
3. Include confidence score based on historical consistency
4. Suggest realistic adjustments
5. Consider user's budget flexibility preferences

## RESPONSE FORMAT
{
  "insights": [
    {
      "title": "string",
      "description": "string",
      "type": "budget_recommendation",
      "confidence": number (0-100),
      "priority": "high|medium|low",
      "dataReferences": [
        {
          "type": "budget|category|historical",
          "name": "string",
          "value": number
        }
      ],
      "actionItems": [
        {
          "description": "string",
          "type": "adjust_budget|create_budget|review_spending",
          "priority": "high|medium|low",
          "parameters": {
            "category": "string",
            "suggestedAmount": number,
            "reason": "string"
          }
        }
      ],
      "impact": {
        "type": "positive|negative|neutral",
        "amount": number,
        "percentage": number,
        "timeframe": "immediate|this_month|next_month"
      }
    }
  ],
  "summary": {
    "totalBudgeted": number,
    "totalSpent": number,
    "budgetsOnTrack": number,
    "budgetsAtRisk": number,
    "recommendedAdjustments": number,
    "overallHealth": "excellent|good|fair|poor"
  }
}

## CONSTRAINTS
- Only suggest budget adjustments within ±30% of current budget
- Consider budget flexibility setting
- Require at least 2 months of data for trend insights
- Minimum confidence threshold: 75 for adjustments, 60 for observations
`;
};

module.exports = budgetInsightsTemplate;