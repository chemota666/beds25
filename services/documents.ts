import { Document } from '../types';
import { mysqlApi } from './mysqlApi';

export const documents = {
  // Obtener documentos de un usuario
  getDocuments: async (userId: string): Promise<Document[]> => {
    try {
      const all = await mysqlApi.fetchData('documents');
      return all.filter((d: Document) => String(d.userId) === String(userId));
    } catch (err) {
      console.error('Error fetching documents:', err);
      return [];
    }
  },

  // Subir documento
  uploadDocument: async (userId: string, file: File, documentType: string): Promise<Document | null> => {
    try {
      // Validaciones
      const MAX_SIZE = 10 * 1024 * 1024; // 10MB
      const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];

      if (file.size > MAX_SIZE) {
        throw new Error(`Archivo demasiado grande. Máximo: 10MB (${Math.round(file.size / 1024 / 1024)}MB)`);
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        throw new Error(`Tipo de archivo no permitido. Permitidos: PDF, JPG, PNG`);
      }

      // Convertir a base64
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64 = reader.result as string;
            const timestamp = Date.now();
            const fileName = `${timestamp}-${file.name}`;

            const document: any = {
              userId: String(userId),
              documentType,
              fileName,
              filePath: base64,
              fileSize: file.size,
              mimeType: file.type,
              uploadedAt: new Date().toISOString()
            };

            const result = await mysqlApi.insertData('documents', document);
            resolve(result);
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
    } catch (err: any) {
      console.error('Error uploading document:', err.message);
      throw err;
    }
  },

  // Borrar documento
  deleteDocument: async (documentId: string): Promise<void> => {
    try {
      await mysqlApi.deleteData('documents', documentId);
    } catch (err) {
      console.error('Error deleting document:', err);
      throw err;
    }
  },

  // Descargar documento
  downloadDocument: (filePath: string, fileName: string): void => {
    try {
      const link = document.createElement('a');
      link.href = filePath;
      link.download = fileName;
      link.click();
    } catch (err) {
      console.error('Error downloading document:', err);
    }
  }
};
