const riskInsightsTemplate = (data) => {
  const {
    budgetRisks,
    goalRisks,
    cashFlowRisks,
    categoryRisks,
    overallRiskScore,
    riskBreakdown,
    historicalComparison
  } = data;

  return `
You are a financial risk analyst assistant. Analyze the following risk data and provide structured insights.

## RISK SUMMARY
- Overall Risk Score: ${overallRiskScore}/100
- Risk Level: ${overallRiskScore > 70 ? 'High' : overallRiskScore > 40 ? 'Medium' : 'Low'}
- Total Risks Detected: ${riskBreakdown.total}
- Critical Risks: ${riskBreakdown.critical}

### Risk Breakdown
${riskBreakdown.byType.map(r => `
- ${r.type}: ${r.count} (${r.severity} severity)
`).join('')}

## BUDGET RISKS
${budgetRisks.map(r => `
- Risk: ${r.type}
  Category: ${r.category}
  Severity: ${r.severity}
  Current: $${r.currentSpent} / $${r.budgetedAmount}
  Projected Overshoot: $${r.projectedOvershoot}
  Days Remaining: ${r.daysRemaining}
  Confidence: ${r.confidence}%
`).join('')}

## GOAL RISKS
${goalRisks.map(r => `
- Risk: ${r.type}
  Goal: ${r.goalName}
  Severity: ${r.severity}
  Shortfall: $${r.shortfall}/month
  Will Miss Target: ${r.willMissTarget ? 'Yes' : 'No'}
  Months Remaining: ${r.monthsRemaining}
`).join('')}

## CASH FLOW RISKS
${cashFlowRisks.map(r => `
- Risk: ${r.type}
  Severity: ${r.severity}
  Details: ${r.details}
  Impact: $${r.impact}
  Probability: ${r.probability}%
`).join('')}

## CATEGORY RISKS
${categoryRisks.map(r => `
- Risk: ${r.type}
  Category: ${r.category}
  Severity: ${r.severity}
  Volatility: ${r.volatility}%
  Concentration: ${r.concentration}% of spending
`).join('')}

## HISTORICAL COMPARISON
- Previous Risk Score: ${historicalComparison.previousScore}
- Change: ${historicalComparison.change > 0 ? '+' : ''}${historicalComparison.change}%
- Trend: ${historicalComparison.trend}
- New Risks: ${historicalComparison.newRisks}
- Resolved Risks: ${historicalComparison.resolvedRisks}

## ANALYSIS TASK
Provide 3-5 actionable risk insights. Each insight must:

1. Focus on the most critical risks first
2. Include specific data references
3. Provide confidence score based on data quality
4. Suggest concrete mitigation actions
5. Consider risk severity and urgency

## RESPONSE FORMAT
{
  "insights": [
    {
      "title": "string",
      "description": "string",
      "type": "risk_alert",
      "confidence": number (0-100),
      "priority": "high|medium|low",
      "dataReferences": [
        {
          "type": "budget_risk|goal_risk|cashflow_risk|category_risk",
          "name": "string",
          "value": number
        }
      ],
      "actionItems": [
        {
          "description": "string",
          "type": "review|adjust|alert|mitigate",
          "priority": "high|medium|low",
          "parameters": {
            "riskType": "string",
            "target": "string",
            "suggestedAction": "string"
          }
        }
      ],
      "impact": {
        "type": "negative",
        "amount": number,
        "percentage": number,
        "probability": number,
        "timeframe": "immediate|short_term|long_term"
      }
    }
  ],
  "summary": {
    "overallRisk": number,
    "criticalCount": number,
    "highCount": number,
    "mediumCount": number,
    "lowCount": number,
    "topRisk": "string",
    "trend": "improving|worsening|stable"
  }
}

## CONSTRAINTS
- Only include risks with confidence > 70%
- Prioritize by severity and immediacy
- Each insight must reference actual data
- Never suggest actions that exceed user's financial capacity
`;
};

module.exports = riskInsightsTemplate;