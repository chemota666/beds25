import axios from 'axios';

export interface PaymentIntent {
  id: string;
  amount: number;
  currency: string;
  status: 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
  clientSecret?: string;
  error?: string;
}

export interface PaymentMethod {
  id: string;
  type: 'card' | 'bank_account';
  last4: string;
  brand?: string;
  expMonth?: number;
  expYear?: number;
}

export interface PaymentHistory {
  id: string;
  reservationId: string;
  amount: number;
  currency: string;
  status: string;
  paymentDate: string;
  method: 'card' | 'bank_account' | 'cash' | 'transfer';
  transactionId?: string;
}

export class PaymentService {
  private static readonly API_BASE = '/api';

  /**
   * Crear intención de pago con Stripe
   */
  static async createPaymentIntent(
    amount: number,
    reservationId: string,
    guestEmail: string
  ): Promise<PaymentIntent> {
    try {
      const response = await axios.post(`${this.API_BASE}/payments/create-intent`, {
        amount: Math.round(amount * 100), // Convertir a centavos
        reservationId,
        guestEmail
      });
      return response.data;
    } catch (error: any) {
      return {
        id: '',
        amount,
        currency: 'EUR',
        status: 'canceled',
        error: error.response?.data?.message || 'Error creando intención de pago'
      };
    }
  }

  /**
   * Confirmar pago
   */
  static async confirmPayment(
    paymentIntentId: string,
    paymentMethodId?: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.API_BASE}/payments/confirm`, {
        paymentIntentId,
        paymentMethodId
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error confirmando pago'
      };
    }
  }

  /**
   * Obtener métodos de pago guardados del cliente
   */
  static async getPaymentMethods(
    customerId: string
  ): Promise<PaymentMethod[]> {
    try {
      const response = await axios.get(
        `${this.API_BASE}/payments/methods/${customerId}`
      );
      return response.data.methods || [];
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      return [];
    }
  }

  /**
   * Guardar método de pago para uso futuro
   */
  static async savePaymentMethod(
    customerId: string,
    paymentMethodId: string,
    setAsDefault: boolean = false
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await axios.post(
        `${this.API_BASE}/payments/save-method`,
        {
          customerId,
          paymentMethodId,
          setAsDefault
        }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error guardando método de pago'
      };
    }
  }

  /**
   * Procesar pago automático (para pagos recurrentes o transferencias)
   */
  static async processAutoPayment(
    reservationId: string,
    customerId: string,
    amount: number
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.API_BASE}/payments/auto-pay`, {
        reservationId,
        customerId,
        amount: Math.round(amount * 100)
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error procesando pago automático'
      };
    }
  }

  /**
   * Obtener historial de pagos de una reserva
   */
  static async getPaymentHistory(
    reservationId: string
  ): Promise<PaymentHistory[]> {
    try {
      const response = await axios.get(
        `${this.API_BASE}/payments/history/${reservationId}`
      );
      return response.data.history || [];
    } catch (error) {
      console.error('Error fetching payment history:', error);
      return [];
    }
  }

  /**
   * Registrar pago manual (efectivo o transferencia)
   */
  static async recordManualPayment(
    reservationId: string,
    amount: number,
    method: 'cash' | 'transfer' | 'check',
    notes?: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      const response = await axios.post(
        `${this.API_BASE}/payments/manual`,
        {
          reservationId,
          amount,
          method,
          notes,
          date: new Date().toISOString()
        }
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error registrando pago'
      };
    }
  }

  /**
   * Crear reembolso
   */
  static async createRefund(
    transactionId: string,
    amount?: number,
    reason?: string
  ): Promise<{ success: boolean; refundId?: string; error?: string }> {
    try {
      const response = await axios.post(`${this.API_BASE}/payments/refund`, {
        transactionId,
        amount: amount ? Math.round(amount * 100) : undefined,
        reason
      });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        error: error.response?.data?.message || 'Error creando reembolso'
      };
    }
  }

  /**
   * Verificar configuración de pagos
   */
  static async verifyConfiguration(): Promise<{ configured: boolean; provider?: string }> {
    try {
      const response = await axios.get(`${this.API_BASE}/payments/status`);
      return response.data;
    } catch (error) {
      return { configured: false };
    }
  }

  /**
   * Obtener saldo de cuenta Stripe
   */
  static async getAccountBalance(): Promise<{ available: number; pending: number; currency: string }> {
    try {
      const response = await axios.get(`${this.API_BASE}/payments/balance`);
      return response.data;
    } catch (error) {
      return { available: 0, pending: 0, currency: 'EUR' };
    }
  }
}
