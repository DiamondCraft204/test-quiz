const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

/**
 * Parse a PDF buffer and return extracted text.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
const parsePDF = async (buffer) => {
  const data = await pdfParse(buffer);
  return data.text.trim();
};

/**
 * Parse a Word (.docx / .doc) buffer and return extracted plain text.
 * @param {Buffer} buffer
 * @returns {Promise<string>}
 */
const parseWord = async (buffer) => {
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
};

/**
 * Auto-detect file type and parse accordingly.
 * @param {Buffer} buffer
 * @param {string} mimetype
 * @returns {Promise<string>}
 */
const parseFile = async (buffer, mimetype) => {
  const SUPPORTED = {
    'application/pdf': parsePDF,
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': parseWord,
    'application/msword': parseWord,
  };

  const parser = SUPPORTED[mimetype];
  if (!parser) {
    throw new Error(`Tipe file tidak didukung: ${mimetype}. Gunakan PDF atau Word (.doc/.docx).`);
  }

  return parser(buffer);
};

module.exports = { parsePDF, parseWord, parseFile };
