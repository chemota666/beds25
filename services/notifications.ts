import { EmailService } from './email';
import { Reservation, Guest } from '../types';

export type NotificationType = 
  | 'reservation_created'
  | 'payment_reminder'
  | 'payment_received'
  | 'invoice_generated'
  | 'guest_message'
  | 'overbooking_alert'
  | 'cancellation_notice';

export interface NotificationLog {
  id: string;
  type: NotificationType;
  recipient: string;
  sentAt: string;
  status: 'sent' | 'failed' | 'pending';
  message?: string;
  error?: string;
}

export class NotificationService {
  private static notificationLogs: NotificationLog[] = [];

  /**
   * Notificar creación de reserva
   */
  static async notifyReservationCreated(
    guest: Guest,
    reservation: Reservation,
    propertyName: string
  ): Promise<boolean> {
    if (!guest.email) {
      this.logNotification(
        'reservation_created',
        guest.id,
        'failed',
        'No email available'
      );
      return false;
    }

    const result = await EmailService.sendReservationConfirmation(
      guest.email,
      `${guest.name} ${guest.surname}`,
      propertyName,
      reservation.startDate,
      reservation.endDate,
      reservation.id,
      reservation.amount || 0
    );

    this.logNotification(
      'reservation_created',
      guest.email,
      result.success ? 'sent' : 'failed',
      undefined,
      result.error
    );

    return result.success;
  }

  /**
   * Recordatorio de pago
   */
  static async notifyPaymentReminder(
    guest: Guest,
    amount: number,
    dueDate: string,
    reservationId: string
  ): Promise<boolean> {
    if (!guest.email) {
      this.logNotification(
        'payment_reminder',
        guest.id,
        'failed',
        'No email available'
      );
      return false;
    }

    const result = await EmailService.sendPaymentReminder(
      guest.email,
      `${guest.name} ${guest.surname}`,
      amount,
      dueDate,
      reservationId
    );

    this.logNotification(
      'payment_reminder',
      guest.email,
      result.success ? 'sent' : 'failed',
      undefined,
      result.error
    );

    return result.success;
  }

  /**
   * Notificar pago recibido
   */
  static async notifyPaymentReceived(
    guest: Guest,
    amount: number,
    paymentDate: string,
    reservationId: string
  ): Promise<boolean> {
    if (!guest.email) {
      this.logNotification(
        'payment_received',
        guest.id,
        'failed',
        'No email available'
      );
      return false;
    }

    const result = await EmailService.sendCustomEmail(
      guest.email,
      '✅ Pago Recibido',
      `
        <h1>¡Pago Recibido!</h1>
        <p>Estimado/a ${guest.name} ${guest.surname},</p>
        <p>Hemos recibido tu pago de <strong>${amount}€</strong> en la fecha ${paymentDate}.</p>
        <p>Tu reserva está confirmada y lista para disfrutar.</p>
        <p>Si tienes alguna pregunta, no dudes en contactarnos.</p>
      `
    );

    this.logNotification(
      'payment_received',
      guest.email,
      result.success ? 'sent' : 'failed',
      undefined,
      result.error
    );

    return result.success;
  }

  /**
   * Notificar factura generada
   */
  static async notifyInvoiceGenerated(
    guest: Guest,
    invoiceNumber: string,
    amount: number,
    invoiceFile?: Blob
  ): Promise<boolean> {
    if (!guest.email) {
      this.logNotification(
        'invoice_generated',
        guest.id,
        'failed',
        'No email available'
      );
      return false;
    }

    const result = await EmailService.sendInvoice(
      guest.email,
      `${guest.name} ${guest.surname}`,
      invoiceNumber,
      amount,
      invoiceFile
    );

    this.logNotification(
      'invoice_generated',
      guest.email,
      result.success ? 'sent' : 'failed',
      undefined,
      result.error
    );

    return result.success;
  }

  /**
   * Alerta de sobocupación (para staff)
   */
  static async notifyOverbookingAlert(
    propertyName: string,
    dates: { start: string; end: string },
    staffEmail: string
  ): Promise<boolean> {
    const result = await EmailService.sendCustomEmail(
      staffEmail,
      '⚠️ Alerta: Conflicto de Fechas',
      `
        <h1>Alerta de Sobocupación</h1>
        <p>Se detectó un conflicto de fechas en la propiedad <strong>${propertyName}</strong>.</p>
        <p><strong>Fechas afectadas:</strong> ${dates.start} a ${dates.end}</p>
        <p>Por favor, revisa las reservas inmediatamente.</p>
      `
    );

    this.logNotification(
      'overbooking_alert',
      staffEmail,
      result.success ? 'sent' : 'failed',
      undefined,
      result.error
    );

    return result.success;
  }

  /**
   * Obtener historial de notificaciones
   */
  static getNotificationHistory(limit: number = 100): NotificationLog[] {
    return this.notificationLogs.slice(-limit);
  }

  /**
   * Registrar notificación en el log
   */
  private static logNotification(
    type: NotificationType,
    recipient: string,
    status: 'sent' | 'failed' | 'pending',
    message?: string,
    error?: string
  ): void {
    const log: NotificationLog = {
      id: `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      recipient,
      sentAt: new Date().toISOString(),
      status,
      message,
      error
    };

    this.notificationLogs.push(log);

    // Mantener solo los últimos 1000 logs en memoria
    if (this.notificationLogs.length > 1000) {
      this.notificationLogs = this.notificationLogs.slice(-1000);
    }
  }

  /**
   * Limpiar logs antiguos
   */
  static clearOldLogs(daysOld: number = 30): void {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    this.notificationLogs = this.notificationLogs.filter(log => {
      const logDate = new Date(log.sentAt);
      return logDate > cutoffDate;
    });
  }
}
