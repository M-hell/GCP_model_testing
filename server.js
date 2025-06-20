const express = require('express');
const cors = require('cors');
const path = require('path');
const { GoogleAuth } = require('google-auth-library');
const { GoogleGenAI } = require('@google/genai');
require('dotenv').config()

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve static files from public directory

// Set environment variable for service account key
// process.env.GOOGLE_APPLICATION_CREDENTIALS = './service-account-key.json';

// Initialize Vertex AI
const ai = new GoogleGenAI({
  vertexai: true,
  project: '1090274914317',
  location: 'us-central1'
});

const model = 'projects/1090274914317/locations/us-central1/endpoints/4269180449793769472';

// Generation config
const generationConfig = {
  maxOutputTokens: 8192,
  temperature: 1,
  topP: 0.95,
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'OFF',
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'OFF',
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'OFF',
    },
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'OFF',
    }
  ],
};

// API endpoint to generate content
app.post('/api/generate', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    const req_data = {
      model: model,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      config: generationConfig,
    };

    // For streaming response
    const streamingResp = await ai.models.generateContentStream(req_data);
    
    let fullResponse = '';
    for await (const chunk of streamingResp) {
      if (chunk.text) {
        fullResponse += chunk.text;
      }
    }

    res.json({ response: fullResponse });
    
  } catch (error) {
    console.error('Error generating content:', error);
    res.status(500).json({ 
      error: 'Failed to generate content', 
      details: error.message 
    });
  }
});

// API endpoint for streaming response
app.post('/api/generate-stream', async (req, res) => {
  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    // Set headers for Server-Sent Events
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    const req_data = {
      model: model,
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ],
      config: generationConfig,
    };

    const streamingResp = await ai.models.generateContentStream(req_data);
    
    for await (const chunk of streamingResp) {
      if (chunk.text) {
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }
    
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    
  } catch (error) {
    console.error('Error in streaming:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
});

// Serve the HTML file
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Make sure to place your service-account-key.json file in the root directory');
});