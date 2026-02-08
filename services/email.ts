import axios from 'axios';
import { logger } from '../utils/logger';

export interface EmailTemplate {
  type: 'reservation_confirmation' | 'payment_reminder' | 'invoice_issued' | 'guest_welcome';
  to: string;
  guestName: string;
  data: {
    reservationId?: string;
    propertyName?: string;
    dates?: { start: string; end: string };
    amount?: number;
    invoiceNumber?: string;
    paymentDeadline?: string;
  };
}

export class EmailService {
  private static readonly API_BASE = '/api';

  /**
   * Enviar email de confirmación de reserva
   */
  static async sendReservationConfirmation(
    guestEmail: string,
    guestName: string,
    propertyName: string,
    startDate: string,
    endDate: string,
    reservationId: string,
    amount: number
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.API_BASE}/email/send`, {
        type: 'reservation_confirmation',
        to: guestEmail,
        guestName,
        data: {
          reservationId,
          propertyName,
          dates: { start: startDate, end: endDate },
          amount
        }
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error enviando email'
      };
    }
  }

  /**
   * Enviar recordatorio de pago
   */
  static async sendPaymentReminder(
    guestEmail: string,
    guestName: string,
    amount: number,
    dueDate: string,
    reservationId: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.API_BASE}/email/send`, {
        type: 'payment_reminder',
        to: guestEmail,
        guestName,
        data: {
          reservationId,
          amount,
          paymentDeadline: dueDate
        }
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error enviando recordatorio'
      };
    }
  }

  /**
   * Enviar factura al cliente
   */
  static async sendInvoice(
    guestEmail: string,
    guestName: string,
    invoiceNumber: string,
    amount: number,
    invoiceFile?: Blob
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const formData = new FormData();
      formData.append('type', 'invoice_issued');
      formData.append('to', guestEmail);
      formData.append('guestName', guestName);
      formData.append('data', JSON.stringify({
        invoiceNumber,
        amount
      }));

      if (invoiceFile) {
        formData.append('invoice', invoiceFile, `invoice-${invoiceNumber}.pdf`);
      }

      const response = await axios.post(`${this.API_BASE}/email/send`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error enviando factura'
      };
    }
  }

  /**
   * Enviar email de bienvenida
   */
  static async sendWelcomeEmail(
    guestEmail: string,
    guestName: string,
    propertyName: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.API_BASE}/email/send`, {
        type: 'guest_welcome',
        to: guestEmail,
        guestName,
        data: {
          propertyName
        }
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error enviando email de bienvenida'
      };
    }
  }

  /**
   * Enviar email genérico
   */
  static async sendCustomEmail(
    to: string,
    subject: string,
    htmlBody: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.API_BASE}/email/custom`, {
        to,
        subject,
        htmlBody
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error enviando email'
      };
    }
  }

  /**
   * Verificar configuración de email
   */
  static async verifyConfiguration(): Promise<{ configured: boolean; provider?: string }> {
    try {
      const response = await axios.get(`${this.API_BASE}/email/status`);
      return response.data;
    } catch (error) {
      return { configured: false };
    }
  }
}
