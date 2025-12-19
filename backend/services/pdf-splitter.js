const { PDFDocument } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

class PDFSplitter {
  constructor() {
    this.splitPagesDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'split-pages');
    this.resultsDir = path.join(process.env.UPLOAD_DIR || 'uploads', 'results');
    
    // Create directories if they don't exist
    [this.splitPagesDir, this.resultsDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Split PDF into individual pages
   * @param {Buffer} fileBuffer - PDF file buffer
   * @returns {Promise<Array>} Array of page buffers
   */
  async splitPDF(fileBuffer) {
    try {
      const pdfDoc = await PDFDocument.load(fileBuffer, { ignoreEncryption: true });
      const pageCount = pdfDoc.getPageCount();
      const pageBuffers = [];

      for (let i = 0; i < pageCount; i++) {
        // Create a new PDF document for the single page
        const singlePageDoc = await PDFDocument.create();
        
        // Copy the page from the original document
        const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [i]);
        singlePageDoc.addPage(copiedPage);
        
        // Save the single page PDF as buffer
        const pageBuffer = await singlePageDoc.save();
        pageBuffers.push(pageBuffer);
      }

      return pageBuffers;
    } catch (error) {
      throw new Error(`Failed to split PDF: ${error.message}`);
    }
  }

  /**
   * Save individual split page
   * @param {Buffer} pageBuffer - Page buffer
   * @param {string} originalFileId - Original file ID
   * @param {number} pageNumber - Page number (1-indexed)
   * @returns {Promise<string>} Path to saved page file
   */
  async saveSplitPage(pageBuffer, originalFileId, pageNumber) {
    try {
      const filename = `${originalFileId}_page_${pageNumber}.pdf`;
      const filePath = path.join(this.splitPagesDir, filename);
      
      fs.writeFileSync(filePath, pageBuffer);
      
      return {
        pageId: filename.replace('.pdf', ''),
        filePath,
        pageNumber,
        originalFileId
      };
    } catch (error) {
      throw new Error(`Failed to save split page: ${error.message}`);
    }
  }

  /**
   * Get all split pages for a file
   * @param {string} originalFileId - Original file ID
   * @returns {Array} Array of page information objects
   */
  getSplitPages(originalFileId) {
    try {
      const files = fs.readdirSync(this.splitPagesDir);
      const pages = files
        .filter(file => file.startsWith(originalFileId) && file.includes('_page_'))
        .map(file => {
          const match = file.match(/_page_(\d+)\.pdf$/);
          return {
            pageId: file.replace('.pdf', ''),
            filePath: path.join(this.splitPagesDir, file),
            pageNumber: match ? parseInt(match[1]) : 0,
            originalFileId
          };
        })
        .sort((a, b) => a.pageNumber - b.pageNumber);

      return pages;
    } catch (error) {
      throw new Error(`Failed to get split pages: ${error.message}`);
    }
  }

  /**
   * Clean up temporary split pages
   * @param {string} originalFileId - Original file ID
   */
  cleanupSplitPages(originalFileId) {
    try {
      const pages = this.getSplitPages(originalFileId);
      
      pages.forEach(page => {
        try {
          if (fs.existsSync(page.filePath)) {
            fs.unlinkSync(page.filePath);
          }
        } catch (error) {
          console.error(`Error deleting page file ${page.filePath}:`, error);
        }
      });

      // Also clean up any result files
      const resultFiles = fs.readdirSync(this.resultsDir)
        .filter(file => file.startsWith(originalFileId));
      
      resultFiles.forEach(file => {
        try {
          const filePath = path.join(this.resultsDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (error) {
          console.error(`Error deleting result file ${file}:`, error);
        }
      });

      return { deletedPages: pages.length, deletedResults: resultFiles.length };
    } catch (error) {
      throw new Error(`Failed to cleanup split pages: ${error.message}`);
    }
  }

  /**
   * Save processing result for a page
   * @param {string} pageId - Page ID
   * @param {Object} result - Processing result
   * @returns {string} Path to saved result file
   */
  savePageResult(pageId, result) {
    try {
      const filename = `${pageId}_result.json`;
      const filePath = path.join(this.resultsDir, filename);
      
      fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
      return filePath;
    } catch (error) {
      throw new Error(`Failed to save page result: ${error.message}`);
    }
  }

  /**
   * Get processing result for a page
   * @param {string} pageId - Page ID
   * @returns {Object|null} Processing result or null if not found
   */
  getPageResult(pageId) {
    try {
      const filename = `${pageId}_result.json`;
      const filePath = path.join(this.resultsDir, filename);
      
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(content);
      }
      return null;
    } catch (error) {
      throw new Error(`Failed to get page result: ${error.message}`);
    }
  }
}

module.exports = PDFSplitter;