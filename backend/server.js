require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const OpenRouterAPI = require('./services/openrouter');
const PDFSplitter = require('./services/pdf-splitter');

const app = express();
const PORT = process.env.PORT || 5000;

// Initialize OpenRouter API service
const openRouter = new OpenRouterAPI();
const pdfSplitter = new PDFSplitter();

// Create uploads directory if it doesn't exist
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Middleware
app.use(helmet()); // Security headers
app.use(morgan('combined')); // Logging
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, uploadDir)));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow common file types
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|txt|json/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from the backend!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV
  });
});

// OpenRouter API Configuration endpoints
app.get('/api/config', (req, res) => {
  try {
    res.json({
      hasApiKey: !!process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL,
      httpReferer: process.env.HTTP_REFERER
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/config', (req, res) => {
  try {
    const { apiKey, baseUrl, httpReferer } = req.body;

    if (apiKey !== undefined) {
      if (!OpenRouterAPI.validateApiKey(apiKey)) {
        return res.status(400).json({ error: 'Invalid API key format' });
      }
      process.env.OPENROUTER_API_KEY = apiKey;
      openRouter.setApiKey(apiKey);
    }

    if (baseUrl) {
      process.env.OPENROUTER_BASE_URL = baseUrl;
      openRouter.setBaseURL(baseUrl);
    }

    if (httpReferer) {
      process.env.HTTP_REFERER = httpReferer;
    }

    res.json({
      message: 'Configuration updated successfully',
      hasApiKey: !!process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL,
      httpReferer: process.env.HTTP_REFERER
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OpenRouter Models endpoint
app.get('/api/models', async (req, res) => {
  try {
    const models = await openRouter.fetchModels();
    const tableExtractionModels = openRouter.getTableExtractionModels();

    res.json({
      all: models,
      tableExtraction: tableExtractionModels
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// File processing endpoint (legacy - for base64 content)
app.post('/api/process-file', async (req, res) => {
  try {
    const { model, fileContent, fileType, customPrompt } = req.body;

    if (!model || !fileContent || !fileType) {
      return res.status(400).json({
        error: 'Missing required parameters: model, fileContent, fileType'
      });
    }

    const result = await openRouter.processFile(model, fileContent, fileType, customPrompt);

    res.json({
      success: true,
      result: result
    });
  } catch (error) {
    console.error('File processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process uploaded files endpoint
app.post('/api/process-uploaded-files', upload.array('files', 10), async (req, res) => {
  try {
    const { model, customPrompt, splitPdf } = req.body;

    if (!model) {
      return res.status(400).json({
        error: 'Missing required parameter: model'
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const results = [];
    const shouldSplitPdf = splitPdf === 'true' || splitPdf === true;

    for (const file of req.files) {
      try {
        // Check if we should split PDF files
        if (shouldSplitPdf && file.mimetype === 'application/pdf') {
          // Split and process PDF pages individually
          const fileBuffer = fs.readFileSync(file.path);
          const originalFileId = file.filename.replace('.pdf', '');
          
          // Split PDF into pages
          const pageBuffers = await pdfSplitter.splitPDF(fileBuffer);
          const pageResults = [];

          for (let i = 0; i < pageBuffers.length; i++) {
            try {
              const base64Content = pageBuffers[i].toString('base64');
              const aiResponse = await openRouter.processFile(model, base64Content, 'application/pdf', customPrompt);

              // Save page result
              const pageId = `${originalFileId}_page_${i + 1}`;
              pdfSplitter.savePageResult(pageId, aiResponse);

              pageResults.push({
                pageNumber: i + 1,
                success: true,
                result: aiResponse,
                pageId: pageId
              });
            } catch (pageError) {
              console.error(`Error processing page ${i + 1} of ${file.originalname}:`, pageError);
              pageResults.push({
                pageNumber: i + 1,
                success: false,
                error: pageError.message
              });
            }
          }

          results.push({
            fileName: file.originalname,
            fileSize: file.size,
            fileType: file.mimetype,
            split: true,
            totalPages: pageBuffers.length,
            pages: pageResults,
            originalFileId: originalFileId
          });

        } else {
          // Process file as whole (original behavior)
          const fileBuffer = fs.readFileSync(file.path);
          const base64Content = fileBuffer.toString('base64');
          const fileType = file.mimetype;

          const aiResponse = await openRouter.processFile(model, base64Content, fileType, customPrompt);

          results.push({
            fileName: file.originalname,
            fileSize: file.size,
            fileType: fileType,
            success: true,
            result: aiResponse,
            split: false
          });
        }

        // Clean up uploaded file
        fs.unlinkSync(file.path);

      } catch (error) {
        console.error(`Error processing ${file.originalname}:`, error);
        results.push({
          fileName: file.originalname,
          fileSize: file.size,
          fileType: file.mimetype,
          success: false,
          error: error.message,
          split: shouldSplitPdf && file.mimetype === 'application/pdf'
        });

        // Clean up uploaded file even on error
        try {
          fs.unlinkSync(file.path);
        } catch (cleanupError) {
          console.error('Error cleaning up file:', cleanupError);
        }
      }
    }

    res.json({
      success: true,
      totalFiles: req.files.length,
      processedFiles: results.length,
      splitPdf: shouldSplitPdf,
      results: results
    });

  } catch (error) {
    console.error('Batch file processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// File upload route
app.post('/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    res.json({
      message: 'File uploaded successfully',
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      path: req.file.path
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Multiple files upload route
app.post('/upload-multiple', upload.array('files', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      size: file.size,
      path: file.path
    }));

    res.json({
      message: `${req.files.length} files uploaded successfully`,
      files: files
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PDF Splitting endpoints
app.post('/api/split-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    if (req.file.mimetype !== 'application/pdf') {
      return res.status(400).json({ error: 'File must be a PDF' });
    }

    const fileBuffer = fs.readFileSync(req.file.path);
    const originalFileId = req.file.filename.replace('.pdf', '');

    // Split PDF into pages
    const pageBuffers = await pdfSplitter.splitPDF(fileBuffer);
    const savedPages = [];

    for (let i = 0; i < pageBuffers.length; i++) {
      const pageInfo = await pdfSplitter.saveSplitPage(pageBuffers[i], originalFileId, i + 1);
      savedPages.push(pageInfo);
    }

    // Clean up the original upload
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      originalFileId,
      totalPages: pageBuffers.length,
      pages: savedPages
    });

  } catch (error) {
    console.error('PDF splitting error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get split pages for a file
app.get('/api/split-pages/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    const pages = pdfSplitter.getSplitPages(fileId);
    
    res.json({
      success: true,
      fileId,
      pages: pages
    });
  } catch (error) {
    console.error('Error getting split pages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process individual page with LLM
app.post('/api/process-page', async (req, res) => {
  try {
    const { pageId, model, customPrompt } = req.body;

    if (!pageId || !model) {
      return res.status(400).json({
        error: 'Missing required parameters: pageId, model'
      });
    }

    // Get the page file
    const pages = pdfSplitter.getSplitPages(pageId.split('_page_')[0]);
    const page = pages.find(p => p.pageId === pageId);
    
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    // Read page file and convert to base64
    const pageBuffer = fs.readFileSync(page.filePath);
    const base64Content = pageBuffer.toString('base64');

    // Process with OpenRouter
    const aiResponse = await openRouter.processFile(model, base64Content, 'application/pdf', customPrompt);

    // Save the result
    const resultPath = pdfSplitter.savePageResult(pageId, aiResponse);

    res.json({
      success: true,
      pageId,
      result: aiResponse,
      resultPath
    });

  } catch (error) {
    console.error('Page processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download specific split page
app.get('/api/download-page/:pageId', (req, res) => {
  try {
    const { pageId } = req.params;
    
    const pages = pdfSplitter.getSplitPages(pageId.split('_page_')[0]);
    const page = pages.find(p => p.pageId === pageId);
    
    if (!page) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.download(page.filePath, `page_${page.pageNumber}.pdf`);
  } catch (error) {
    console.error('Error downloading page:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download conversion result for page
app.get('/api/download-page-result/:pageId', (req, res) => {
  try {
    const { pageId } = req.params;
    const result = pdfSplitter.getPageResult(pageId);
    
    if (!result) {
      return res.status(404).json({ error: 'Result not found' });
    }

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${pageId}_result.json"`);
    res.send(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error downloading result:', error);
    res.status(500).json({ error: error.message });
  }
});

// Cleanup endpoints for split pages
app.delete('/api/cleanup-pages/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    const cleanupResult = pdfSplitter.cleanupSplitPages(fileId);
    
    res.json({
      success: true,
      fileId,
      cleanupResult
    });
  } catch (error) {
    console.error('Error cleaning up pages:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  res.status(500).json({ error: error.message });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
});