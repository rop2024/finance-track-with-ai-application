const spendingInsightsTemplate = (data) => {
  const {
    period,
    categoryTotals,
    categoryDeltas,
    topCategories,
    unusualTransactions,
    patterns,
    userPreferences = {}
  } = data;

  return `
You are a financial analyst assistant. Analyze the following spending data and provide structured insights.

## CONTEXT
- User ID: ${data.userId}
- Analysis Period: ${period.startDate} to ${period.endDate}
- Total Transactions Analyzed: ${data.totalTransactions || 'N/A'}

## FINANCIAL DATA (Aggregated Only - No Raw Transactions)

### Spending by Category
${categoryTotals.map(c => `
- Category: ${c.categoryName} (${c.categoryType})
  Total: $${c.total.toFixed(2)}
  Percentage of Total: ${c.percentageOfTotal.toFixed(1)}%
  Transaction Count: ${c.count}
  Average: $${c.avgAmount.toFixed(2)}
  Frequency: ${c.frequency?.toFixed(2) || 'N/A'} per day
`).join('')}

### Category Changes vs Previous Period
${categoryDeltas.map(d => `
- ${d.categoryName}: ${d.percentageDelta > 0 ? '+' : ''}${d.percentageDelta.toFixed(1)}% ($${Math.abs(d.absoluteDelta).toFixed(2)})
  Trend: ${d.trend}
  ${d.isSignificant ? '⚠️ Significant change' : ''}
`).join('')}

### Top Spending Categories
${topCategories.map(c => `
- ${c.name}: $${c.amount.toFixed(2)} (${c.percentage.toFixed(1)}% of total)
`).join('')}

### Spending Patterns Detected
${patterns ? `
- Overall Trend: ${patterns.trend || 'Stable'}
- Volatility: ${patterns.volatility?.toFixed(2) || 'Low'}
- Seasonal Patterns: ${patterns.seasonal?.join(', ') || 'None detected'}
- Unusual Clusters: ${patterns.clusters || 0} detected
` : 'No significant patterns detected'}

### Unusual Transactions
${unusualTransactions?.map(t => `
- Date: ${t.date}
  Amount: $${t.amount.toFixed(2)}
  Category: ${t.category}
  Reason: ${t.reason}
`).join('') || 'No unusual transactions detected'}

## ANALYSIS TASK
Provide 3-5 actionable insights about this user's spending patterns. Each insight must:

1. Be based ONLY on the provided data
2. Reference specific categories and amounts
3. Include a confidence score (0-100)
4. Suggest concrete action items
5. Prioritize as high/medium/low

## RESPONSE FORMAT
Respond with a JSON object following this exact schema:
{
  "insights": [
    {
      "title": "string (concise insight title)",
      "description": "string (detailed explanation)",
      "type": "spending_pattern",
      "confidence": number (0-100),
      "priority": "high|medium|low",
      "dataReferences": [
        {
          "type": "category|transaction|pattern",
          "name": "string",
          "value": number
        }
      ],
      "actionItems": [
        {
          "description": "string",
          "type": "review|adjust_budget|track_category",
          "priority": "high|medium|low"
        }
      ],
      "impact": {
        "type": "positive|negative|neutral",
        "amount": number (optional),
        "percentage": number (optional),
        "timeframe": "immediate|short_term|long_term"
      }
    }
  ],
  "summary": {
    "totalSpent": number,
    "averageDaily": number,
    "topCategory": "string",
    "significantChanges": number,
    "riskLevel": "low|medium|high"
  }
}

IMPORTANT: 
- Only include insights you are highly confident about (confidence > 70)
- Never mention specific transaction details beyond categories
- If data is insufficient, return {"insights": [], "summary": {...}}
- Be conservative - don't over-interpret the data
`;
};

module.exports = spendingInsightsTemplate;