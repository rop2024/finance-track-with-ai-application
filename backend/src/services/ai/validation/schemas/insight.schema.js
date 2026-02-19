const insightSchema = {
  type: 'object',
  properties: {
    insights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            minLength: 5,
            maxLength: 100
          },
          description: {
            type: 'string',
            minLength: 20,
            maxLength: 500
          },
          type: {
            type: 'string',
            enum: [
              'spending_pattern',
              'budget_recommendation',
              'savings_opportunity',
              'risk_alert',
              'income_insight',
              'subscription_optimization',
              'goal_progress',
              'financial_health'
            ]
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 100
          },
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low']
          },
          dataReferences: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['category', 'budget', 'goal', 'signal', 'risk']
                },
                name: { type: 'string' },
                value: { type: 'number' }
              },
              required: ['type', 'name', 'value']
            },
            minItems: 1,
            maxItems: 5
          },
          actionItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: {
                  type: 'string',
                  minLength: 10,
                  maxLength: 200
                },
                type: {
                  type: 'string',
                  enum: [
                    'review',
                    'adjust_budget',
                    'cancel_subscription',
                    'increase_savings',
                    'create_goal',
                    'track_category',
                    'alert',
                    'mitigate'
                  ]
                },
                priority: {
                  type: 'string',
                  enum: ['high', 'medium', 'low']
                },
                parameters: {
                  type: 'object',
                  additionalProperties: true
                }
              },
              required: ['description', 'type', 'priority']
            },
            minItems: 1,
            maxItems: 3
          },
          impact: {
            type: 'object',
            properties: {
              type: {
                type: 'string',
                enum: ['positive', 'negative', 'neutral']
              },
              amount: { type: 'number' },
              percentage: { type: 'number' },
              timeframe: {
                type: 'string',
                enum: ['immediate', 'short_term', 'long_term', 'this_month', 'by_target']
              },
              probability: {
                type: 'number',
                minimum: 0,
                maximum: 100
              }
            },
            required: ['type']
          }
        },
        required: [
          'title',
          'description',
          'type',
          'confidence',
          'priority',
          'dataReferences',
          'actionItems'
        ],
        additionalProperties: false
      },
      minItems: 0,
      maxItems: 10
    },
    summary: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        requiredData: { type: 'array', items: { type: 'string' } },
        totalSpent: { type: 'number' },
        averageDaily: { type: 'number' },
        topCategory: { type: 'string' },
        significantChanges: { type: 'number' },
        riskLevel: { type: 'string', enum: ['low', 'medium', 'high'] },
        totalBudgeted: { type: 'number' },
        totalSpent: { type: 'number' },
        budgetsOnTrack: { type: 'number' },
        budgetsAtRisk: { type: 'number' },
        recommendedAdjustments: { type: 'number' },
        overallHealth: { type: 'string', enum: ['excellent', 'good', 'fair', 'poor'] },
        totalGoals: { type: 'number' },
        goalsOnTrack: { type: 'number' },
        goalsAtRisk: { type: 'number' },
        monthlyShortfall: { type: 'number' },
        projectedSavingsRate: { type: 'number' },
        topPriority: { type: 'string' },
        overallRisk: { type: 'number' },
        criticalCount: { type: 'number' },
        highCount: { type: 'number' },
        mediumCount: { type: 'number' },
        lowCount: { type: 'number' },
        topRisk: { type: 'string' },
        trend: { type: 'string', enum: ['improving', 'worsening', 'stable'] }
      },
      additionalProperties: true
    }
  },
  required: ['insights', 'summary'],
  additionalProperties: false
};

module.exports = insightSchema;