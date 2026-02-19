const integratedAnalysisSchema = {
  type: 'object',
  properties: {
    integratedInsights: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          relatedTypes: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['spending', 'budget', 'savings', 'risk']
            }
          },
          confidence: {
            type: 'number',
            minimum: 0,
            maximum: 100
          },
          priority: {
            type: 'string',
            enum: ['high', 'medium', 'low']
          }
        },
        required: ['title', 'description', 'relatedTypes', 'confidence', 'priority']
      }
    },
    conflicts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          between: {
            type: 'array',
            items: { type: 'string' },
            minItems: 2
          },
          description: { type: 'string' },
          resolution: { type: 'string' }
        },
        required: ['between', 'description', 'resolution']
      }
    },
    actionPlan: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          step: { type: 'number' },
          action: { type: 'string' },
          type: { type: 'string' },
          timeframe: {
            type: 'string',
            enum: ['immediate', 'this_week', 'this_month']
          }
        },
        required: ['step', 'action', 'type', 'timeframe']
      }
    },
    overallHealth: {
      type: 'object',
      properties: {
        score: {
          type: 'number',
          minimum: 0,
          maximum: 100
        },
        level: {
          type: 'string',
          enum: ['excellent', 'good', 'fair', 'poor']
        },
        summary: { type: 'string' }
      },
      required: ['score', 'level', 'summary']
    }
  },
  required: ['integratedInsights', 'overallHealth'],
  additionalProperties: false
};

module.exports = {
  insightSchema,
  integratedAnalysisSchema
};