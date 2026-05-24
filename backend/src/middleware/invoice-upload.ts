import multer, { FileFilterCallback } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { Request } from 'express';

export const invoiceUploadDir = path.resolve(__dirname, '../../uploads/invoices');
if (!fs.existsSync(invoiceUploadDir)) {
  fs.mkdirSync(invoiceUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, invoiceUploadDir),
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const ext = path.extname(file.originalname).toLowerCase() || '';
    cb(null, `${unique}${ext}`);
  },
});

const ALLOWED_MIMES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

function fileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback) {
  if (ALLOWED_MIMES.has(file.mimetype.toLowerCase())) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF or image files are allowed'));
  }
}

export const invoiceUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 },
});
