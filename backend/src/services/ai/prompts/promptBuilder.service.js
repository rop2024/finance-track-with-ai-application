const spendingTemplate = require('./templates/spending.insights.template');
const budgetTemplate = require('./templates/budget.insights.template');
const savingsTemplate = require('./templates/savings.insights.template');
const riskTemplate = require('./templates/risk.insights.template');

class PromptBuilderService {
  constructor() {
    this.templates = {
      spending: spendingTemplate,
      budget: budgetTemplate,
      savings: savingsTemplate,
      risk: riskTemplate
    };

    this.maxDataSize = 10000; // Max characters for aggregated data
    this.minDataPoints = 3; // Minimum data points required
  }

  /**
   * Build prompt for specific analysis type
   */
  buildPrompt(type, data, options = {}) {
    // Validate data sufficiency
    if (!this.hasSufficientData(data, type)) {
      return this.buildInsufficientDataPrompt(type);
    }

    // Sanitize and truncate data
    const sanitizedData = this.sanitizeData(data);
    const truncatedData = this.truncateData(sanitizedData, type);

    // Get template
    const template = this.templates[type];
    if (!template) {
      throw new Error(`Unknown analysis type: ${type}`);
    }

    // Build prompt with constraints
    let prompt = template(truncatedData);

    // Add global constraints
    prompt = this.addGlobalConstraints(prompt, options);

    // Add system instructions
    prompt = this.addSystemInstructions(prompt);

    return prompt;
  }

  /**
   * Build prompt for multiple analysis types
   */
  buildCompositePrompt(types, data, options = {}) {
    const sections = [];

    types.forEach(type => {
      if (this.hasSufficientData(data[type], type)) {
        sections.push(this.buildPrompt(type, data[type], { ...options, standalone: false }));
      }
    });

    if (sections.length === 0) {
      return this.buildInsufficientDataPrompt('composite');
    }

    const compositePrompt = `
You are a comprehensive financial analyst. Analyze the following multiple aspects of this user's finances.

${sections.join('\n\n---\n\n')}

## INTEGRATION TASK
Synthesize insights across all provided data sections. Identify:

1. Cross-cutting patterns
2. Conflicts between recommendations
3. Prioritized action plan
4. Overall financial health assessment

## RESPONSE FORMAT
{
  "integratedInsights": [
    {
      "title": "string",
      "description": "string",
      "relatedTypes": ["spending", "budget", "savings", "risk"],
      "confidence": number,
      "priority": "high|medium|low"
    }
  ],
  "conflicts": [
    {
      "between": ["type1", "type2"],
      "description": "string",
      "resolution": "string"
    }
  ],
  "actionPlan": [
    {
      "step": number,
      "action": "string",
      "type": "string",
      "timeframe": "immediate|this_week|this_month"
    }
  ],
  "overallHealth": {
    "score": number,
    "level": "excellent|good|fair|poor",
    "summary": "string"
  }
}
`;

    return this.addSystemInstructions(compositePrompt);
  }

  /**
   * Check if we have sufficient data for analysis
   */
  hasSufficientData(data, type) {
    if (!data) return false;

    switch(type) {
      case 'spending':
        return data.categoryTotals?.length >= this.minDataPoints;
      case 'budget':
        return data.budgets?.length > 0;
      case 'savings':
        return data.goals?.length > 0;
      case 'risk':
        return data.overallRiskScore !== undefined;
      default:
        return Object.keys(data).length > 0;
    }
  }

  /**
   * Build prompt for insufficient data
   */
  buildInsufficientDataPrompt(type) {
    return `
You are a financial analyst. The user does not have sufficient data for ${type} analysis.

Please respond with:
{
  "insights": [],
  "summary": {
    "message": "Insufficient data for meaningful analysis. Please add more transactions and set up budgets/goals to receive insights.",
    "requiredData": ${JSON.stringify(this.getRequiredDataForType(type))}
  }
}

Be helpful and suggest what data the user should add to start receiving insights.
`;
  }

  /**
   * Get required data fields for analysis type
   */
  getRequiredDataForType(type) {
    const requirements = {
      spending: ['At least 10 transactions', 'Categorized expenses', '30+ days of data'],
      budget: ['Active budgets', 'Budget categories', '30+ days of spending history'],
      savings: ['Savings goals', 'Contribution history', 'Target dates'],
      risk: ['Transaction history', 'Budget data', 'Goal data'],
      composite: ['Transaction history (30+ days)', 'Active budgets', 'Savings goals']
    };

    return requirements[type] || ['More financial data'];
  }

  /**
   * Sanitize data to remove any PII
   */
  sanitizeData(data) {
    if (!data) return data;

    // Deep clone to avoid mutating original
    const sanitized = JSON.parse(JSON.stringify(data));

    // Remove any potential PII fields
    const piiFields = ['email', 'phone', 'address', 'name', 'ssn', 'accountNumber'];
    
    const removePII = (obj) => {
      if (!obj || typeof obj !== 'object') return;
      
      Object.keys(obj).forEach(key => {
        if (piiFields.includes(key.toLowerCase())) {
          delete obj[key];
        } else if (typeof obj[key] === 'object') {
          removePII(obj[key]);
        }
      });
    };

    removePII(sanitized);
    return sanitized;
  }

  /**
   * Truncate data to fit within token limits
   */
  truncateData(data, type) {
    const dataStr = JSON.stringify(data);
    
    if (dataStr.length <= this.maxDataSize) {
      return data;
    }

    // Truncate based on type
    switch(type) {
      case 'spending':
        return {
          ...data,
          categoryTotals: data.categoryTotals?.slice(0, 10),
          categoryDeltas: data.categoryDeltas?.slice(0, 10),
          unusualTransactions: data.unusualTransactions?.slice(0, 5)
        };
      case 'budget':
        return {
          ...data,
          budgets: data.budgets?.slice(0, 10),
          budgetPerformance: data.budgetPerformance?.slice(0, 10),
          historicalData: data.historicalData?.slice(0, 5)
        };
      case 'savings':
        return {
          ...data,
          goals: data.goals?.slice(0, 5),
          opportunities: data.opportunities?.slice(0, 5)
        };
      case 'risk':
        return {
          ...data,
          budgetRisks: data.budgetRisks?.slice(0, 5),
          goalRisks: data.goalRisks?.slice(0, 5),
          cashFlowRisks: data.cashFlowRisks?.slice(0, 5)
        };
      default:
        return data;
    }
  }

  /**
   * Add global constraints to prompt
   */
  addGlobalConstraints(prompt, options) {
    const constraints = `
## GLOBAL CONSTRAINTS
- Never mention specific transaction details (dates, merchants, descriptions)
- Only use aggregated category data
- If confidence < 70%, don't generate insight
- Be conservative - don't over-interpret
- Each insight must reference specific data
- Suggest actionable steps only
- Consider user's risk tolerance: ${options.riskTolerance || 'medium'}
- Respect budget flexibility preferences
- Keep language clear and non-technical
`;

    return prompt + constraints;
  }

  /**
   * Add system instructions to prompt
   */
  addSystemInstructions(prompt) {
    const instructions = `
## SYSTEM INSTRUCTIONS
You are a conservative financial analyst. Your insights must be:
- Data-driven (only from provided numbers)
- Actionable (clear next steps)
- Conservative (avoid speculation)
- Clear (no jargon)
- Structured (follow response format exactly)

Remember: Quality over quantity. Fewer high-confidence insights are better than many low-confidence ones.
`;

    return instructions + prompt;
  }

  /**
   * Estimate token count for prompt
   */
  estimateTokens(prompt) {
    // Rough estimate: ~4 characters per token for English
    return Math.ceil(prompt.length / 4);
  }

  /**
   * Validate prompt before sending
   */
  validatePrompt(prompt) {
    if (!prompt || prompt.length < 100) {
      throw new Error('Prompt too short');
    }

    if (prompt.length > 30000) {
      throw new Error('Prompt too long (exceeds 30k characters)');
    }

    // Check for required sections
    const requiredSections = ['ANALYSIS TASK', 'RESPONSE FORMAT'];
    for (const section of requiredSections) {
      if (!prompt.includes(section)) {
        throw new Error(`Prompt missing required section: ${section}`);
      }
    }

    return true;
  }
}

module.exports = new PromptBuilderService();