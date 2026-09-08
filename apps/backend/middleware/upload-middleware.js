const storageService = require('../services/storage-service');
const multer = require('multer');

// Some tests mock storage-service partially; fallback keeps routes bootable in that case.
const upload = typeof storageService.createUploader === 'function'
    ? storageService.createUploader('', ['image/jpeg', 'image/png', 'application/pdf'], 20)
    : multer({ storage: multer.memoryStorage() });

module.exports = upload;

