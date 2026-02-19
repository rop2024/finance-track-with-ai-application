const { GoogleGenerativeAI } = require('@google/generative-ai');
const BaseAIClient = require('./base.client');

class GeminiClient extends BaseAIClient {
  constructor(apiKey, config = {}) {
    super(config);
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = config.model || 'gemini-pro';
    this.temperature = config.temperature || 0.2; // Low temp for consistency
    this.maxOutputTokens = config.maxOutputTokens || 2048;
    this.topP = config.topP || 0.8;
    this.topK = config.topK || 40;
  }

  async generate(prompt, options = {}) {
    const model = this.genAI.getGenerativeModel({ model: this.model });
    
    const generationConfig = {
      temperature: options.temperature || this.temperature,
      maxOutputTokens: options.maxOutputTokens || this.maxOutputTokens,
      topP: options.topP || this.topP,
      topK: options.topK || this.topK,
    };

    try {
      const startTime = Date.now();
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig,
      });

      const response = result.response;
      const text = response.text();
      
      const endTime = Date.now();
      
      return {
        text,
        metadata: {
          model: this.model,
          processingTime: endTime - startTime,
          promptTokens: this.countTokens(prompt),
          responseTokens: this.countTokens(text),
          temperature: generationConfig.temperature,
          finishReason: response.candidates?.[0]?.finishReason || 'unknown'
        }
      };
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  async generateStructured(prompt, schema, options = {}) {
    // Add schema instruction to prompt
    const schemaPrompt = `${prompt}\n\nIMPORTANT: Your response MUST be valid JSON that conforms to this schema:\n${JSON.stringify(schema, null, 2)}\n\nRespond with ONLY the JSON object, no additional text.`;
    
    const response = await this.generate(schemaPrompt, {
      ...options,
      temperature: 0.1 // Even lower temperature for structured output
    });

    try {
      // Extract JSON from response (handle potential markdown code blocks)
      const jsonStr = this.extractJSON(response.text);
      const parsed = JSON.parse(jsonStr);
      
      return {
        data: parsed,
        metadata: response.metadata
      };
    } catch (error) {
      throw new Error(`Failed to parse structured response: ${error.message}\nResponse: ${response.text}`);
    }
  }

  extractJSON(text) {
    // Remove markdown code blocks if present
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                     text.match(/{[\s\S]*}/);
    
    if (jsonMatch) {
      return jsonMatch[1] || jsonMatch[0];
    }
    
    return text;
  }

  countTokens(text) {
    // Gemini has specific token counting - this is a rough estimate
    // In production, use the actual token counting API
    const words = text.split(/\s+/).length;
    return Math.ceil(words * 1.3); // Approximate tokens (~1.3 tokens per word)
  }
}

module.exports = GeminiClient;