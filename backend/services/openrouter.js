/**
 * OpenRouter API Integration for Backend
 * Handles communication with OpenRouter API for model listing and chat completion
 */

const fetch = require('node-fetch');

class OpenRouterAPI {
    constructor() {
        this.baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
        this.apiKey = process.env.OPENROUTER_API_KEY || '';
        this.models = [];
    }

    /**
     * Set the API key for authentication
     * @param {string} apiKey - OpenRouter API key
     */
    setApiKey(apiKey) {
        this.apiKey = apiKey;
    }

    /**
     * Set the base URL for OpenRouter API
     * @param {string} url - Base URL
     */
    setBaseURL(url) {
        this.baseURL = url;
    }

    /**
     * Fetch available models from OpenRouter
     * @returns {Promise<Array>} Array of available models
     */
    async fetchModels() {
        if (!this.apiKey) {
            throw new Error('API key is required to fetch models');
        }

        try {
            const response = await fetch(`${this.baseURL}/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            this.models = data.data || [];
            return this.models;
        } catch (error) {
            console.error('Error fetching models:', error);
            throw error;
        }
    }

    /**
     * Send a chat completion request to OpenRouter
     * @param {string} model - Model ID
     * @param {Array} content - Array of content objects (text and/or image_url)
     * @param {Object} options - Additional options
     * @returns {Promise<string>} AI response
     */
    async chatCompletion(model, content, options = {}) {
        if (!this.apiKey) {
            throw new Error('API key is required for chat completion');
        }

        if (!model) {
            throw new Error('Model is required for chat completion');
        }

        const requestBody = {
            model: model,
            messages: [
                {
                    role: 'user',
                    content: content
                }
            ],
            max_tokens: options.maxTokens || 4000,
            temperature: options.temperature || 0.1,
            stream: false
        };

        // Add provider sort for latency optimization if specified
        if (options.priority === 'latency') {
            requestBody.provider = {
                sort: 'latency'
            };
        }

        try {
            const response = await fetch(`${this.baseURL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.HTTP_REFERER || 'http://localhost:3000',
                    'X-Title': 'PDF & Image to Table Converter'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                try {
                    const errorData = await response.json();
                    errorMessage = errorData.error?.message || errorData.message || errorMessage;
                } catch (parseError) {
                    console.warn('Could not parse error response:', parseError);
                }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            // Debug logging to understand response structure
            console.log('OpenRouter API Response:', data);

            // Handle different response structures
            let responseContent = '';

            if (data.choices && data.choices.length > 0) {
                responseContent = data.choices[0]?.message?.content || '';
            } else if (data.output && data.output.text) {
                responseContent = data.output.text;
            } else if (data.content) {
                responseContent = data.content;
            } else if (typeof data === 'string') {
                responseContent = data;
            } else {
                console.warn('Unexpected response structure:', data);
                responseContent = JSON.stringify(data);
            }

            return responseContent;
        } catch (error) {
            console.error('Error in chat completion:', error);
            throw error;
        }
    }

    /**
     * Process file content with OpenRouter AI using multimodal format
     * @param {string} model - Model ID
     * @param {string} fileContent - Base64 encoded file content
     * @param {string} fileType - MIME type of the file
     * @param {string} customPrompt - Custom prompt for processing
     * @returns {Promise<string>} AI response with table data
     */
    async processFile(model, fileContent, fileType, customPrompt) {
        const content = this._buildMultimodalContent(fileContent, fileType, customPrompt);
        return await this.chatCompletion(model, content, { priority: 'latency' });
    }

    /**
     * Build multimodal content array for OpenRouter API using file type
     * @param {string} fileContent - Base64 encoded file content
     * @param {string} fileType - MIME type of the file
     * @param {string} customPrompt - Custom prompt
     * @returns {Array} Array of content objects for multimodal API
     */
    _buildMultimodalContent(fileContent, fileType, customPrompt) {
        // Determine the data URL format based on file type
        let dataUrl;
        let filename;

        if (fileType === 'application/pdf') {
            dataUrl = `data:application/pdf;base64,${fileContent}`;
            filename = 'document.pdf';
        } else if (fileType.startsWith('image/')) {
            dataUrl = `data:${fileType};base64,${fileContent}`;
            // Extract extension from MIME type
            const extension = fileType.split('/')[1];
            filename = `image.${extension}`;
        } else {
            throw new Error(`Unsupported file type: ${fileType}`);
        }

        return [
            {
                type: 'text',
                text: `${customPrompt}

Please analyze the attached ${fileType === 'application/pdf' ? 'PDF document' : 'image'} and extract all tabular data. Return the data in JSON format with the structure: {"data": [{ key: value }]}. If there are multiple tables, separate them clearly. Focus on extracting numerical data, text, and maintaining the original structure as much as possible.`
            },
            {
                type: 'file',
                file: {
                    filename: filename,
                    file_data: dataUrl
                }
            }
        ];
    }

    /**
     * Get models filtered for table extraction (prefer vision-capable models)
     * @returns {Array} Filtered array of models
     */
    getTableExtractionModels() {
        const visionKeywords = ['vision', 'gpt-4-vision', 'claude-3', 'gemini'];
        return this.models.filter(model => {
            const id = model.id.toLowerCase();
            return visionKeywords.some(keyword => id.includes(keyword)) ||
                   model.context_length >= 8000;
        });
    }

    /**
     * Validate API key format
     * @param {string} apiKey - API key to validate
     * @returns {boolean} True if valid format
     */
    static validateApiKey(apiKey) {
        return apiKey && apiKey.length > 20 && apiKey.startsWith('sk-or-');
    }
}

module.exports = OpenRouterAPI;