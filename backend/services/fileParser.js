const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Parse a PDF buffer and return extracted text.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
const parsePDF = async (buffer) => {
  const data = await pdfParse(buffer);
  return data.text ? data.text.trim() : '';
};

/**
 * Parse a Word (.docx / .doc) buffer and return extracted plain text.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
const parseWord = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value ? result.value.trim() : '';
};

/**
 * Auto-detect file type and parse accordingly.
 * Supports detection by mimetype and file extension fallback.
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @param {string} originalname
 * @returns {Promise<string>}
 */
const parseFile = async (buffer, mimetype, originalname = '') => {
  const ext = path.extname(originalname || '').toLowerCase();

  if (mimetype === 'application/pdf' || ext === '.pdf') {
    return parsePDF(buffer);
  }

  if (
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimetype === 'application/msword' ||
    ext === '.docx' ||
    ext === '.doc'
  ) {
    return parseWord(buffer);
  }

  throw new Error(`Tipe file tidak didukung: ${originalname || mimetype}. Silakan unggah file PDF atau Word (.doc/.docx).`);
};

module.exports = { parsePDF, parseWord, parseFile };
