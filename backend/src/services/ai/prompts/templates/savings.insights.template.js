const savingsInsightsTemplate = (data) => {
  const {
    goals,
    contributions,
    projectedTimelines,
    savingsRate,
    opportunities,
    userPreferences
  } = data;

  return `
You are a financial analyst assistant. Analyze the following savings data and provide structured recommendations.

## SAVINGS GOALS
${goals.map(g => `
- Goal: ${g.name}
  Target: $${g.targetAmount}
  Current: $${g.currentAmount} (${g.progress}%)
  Priority: ${g.priority}/5
  Target Date: ${g.targetDate}
  Status: ${g.status}
  Type: ${g.category}
`).join('')}

## CONTRIBUTION ANALYSIS
${goals.map(g => `
- ${g.name}:
  Required Monthly: $${g.requiredMonthly}
  Current Monthly: $${g.currentMonthly}
  Shortfall: $${g.shortfall}
  Consistency: ${g.consistency}%
  Last Contribution: ${g.lastContribution || 'N/A'}
`).join('')}

## PROJECTED TIMELINES
${projectedTimelines.map(p => `
- ${p.goalName}:
  Target Date: ${p.targetDate}
  Projected Completion: ${p.projectedDate}
  ${p.onTrack ? '✅ On track' : '❌ Behind schedule'}
  Gap: ${p.gapMonths} months
`).join('')}

## SAVINGS RATE ANALYSIS
- Current Savings Rate: ${savingsRate.current}% of income
- Recommended Rate: ${savingsRate.recommended}%
- Monthly Savings Potential: $${savingsRate.potential}
- Historical Trend: ${savingsRate.trend}

## SAVINGS OPPORTUNITIES
${opportunities.map(o => `
- ${o.description}
  Potential Savings: $${o.amount}/month
  Confidence: ${o.confidence}%
  Effort: ${o.effort}
`).join('')}

## USER PREFERENCES
- Risk Tolerance: ${userPreferences.riskTolerance || 'medium'}
- Primary Goal: ${userPreferences.primaryGoal || 'Not specified'}
- Auto-save Enabled: ${userPreferences.autoSave ? 'Yes' : 'No'}

## ANALYSIS TASK
Provide 3-5 actionable savings insights and recommendations. Each insight must:

1. Focus on goal achievement and optimization
2. Reference specific savings goals
3. Include confidence score based on contribution history
4. Suggest realistic monthly increases
5. Consider priority levels

## RESPONSE FORMAT
{
  "insights": [
    {
      "title": "string",
      "description": "string",
      "type": "savings_opportunity|goal_progress|optimization",
      "confidence": number (0-100),
      "priority": "high|medium|low",
      "dataReferences": [
        {
          "type": "goal|contribution|opportunity",
          "name": "string",
          "value": number
        }
      ],
      "actionItems": [
        {
          "description": "string",
          "type": "increase_savings|create_goal|adjust_target|enable_autosave",
          "priority": "high|medium|low",
          "parameters": {
            "goalId": "string",
            "suggestedAmount": number,
            "frequency": "monthly|weekly",
            "reason": "string"
          }
        }
      ],
      "impact": {
        "type": "positive",
        "amount": number,
        "percentage": number,
        "timeframe": "immediate|this_month|by_target"
      }
    }
  ],
  "summary": {
    "totalGoals": number,
    "goalsOnTrack": number,
    "goalsAtRisk": number,
    "monthlyShortfall": number,
    "projectedSavingsRate": number,
    "topPriority": "string"
  }
}

## CONSTRAINTS
- Only recommend increases that are ≤ 20% of income
- Consider goal priority in recommendations
- Require at least 2 contributions for trend analysis
- Minimum confidence: 80 for timeline projections
`;
};

module.exports = savingsInsightsTemplate;