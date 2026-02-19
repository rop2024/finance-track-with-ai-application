class BaseAIClient {
  constructor(config) {
    this.config = config;
    this.maxRetries = 3;
    this.retryDelay = 1000;
    this.timeout = 30000; // 30 seconds
  }

  async generate(prompt, options = {}) {
    throw new Error('generate() must be implemented by subclass');
  }

  async generateWithRetry(prompt, options = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.generate(prompt, options);
        return result;
      } catch (error) {
        lastError = error;
        
        if (attempt === this.maxRetries) break;
        
        // Exponential backoff
        await this.sleep(this.retryDelay * Math.pow(2, attempt - 1));
      }
    }
    
    throw lastError;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  validateResponse(response, schema) {
    // Basic validation - subclasses can override
    if (!response) {
      throw new Error('Empty response from AI');
    }
    return response;
  }

  countTokens(text) {
    // Rough estimation - subclasses should implement properly
    return Math.ceil(text.length / 4);
  }

  sanitizeInput(text) {
    // Remove any potentially harmful content
    return text
      .replace(/[<>]/g, '') // Remove HTML tags
      .replace(/[\\$;|&]/g, '') // Remove shell metacharacters
      .trim();
  }
}

module.exports = BaseAIClient;