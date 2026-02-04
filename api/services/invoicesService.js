"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicesService = void 0;
var InvoicesService = /** @class */ (function () {
    function InvoicesService(pool, ownersService) {
        this.pool = pool;
        this.ownersService = ownersService;
    }
    /**
     * OPERACIÓN CRÍTICA: Marcar reserva como pagada y generar factura
     * Todo se ejecuta en una transacción atómica para evitar:
     * - Facturas duplicadas
     * - Saltos en numeración
     * - Inconsistencias entre reserva y factura
     *
     * Usa SELECT ... FOR UPDATE en owner para lock de numeración
     */
    InvoicesService.prototype.markPaidAndCreateInvoice = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var conn, reservations, reservation, ownerId, invoiceNumber, now, invoiceResult, invoices, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.getConnection()];
                    case 1:
                        conn = _a.sent();
                        _a.label = 2;
                    case 2:
                        _a.trys.push([2, 10, 12, 13]);
                        return [4 /*yield*/, conn.beginTransaction()];
                    case 3:
                        _a.sent();
                        return [4 /*yield*/, conn.query('SELECT r.*, p.ownerId FROM reservations r JOIN properties p ON r.propertyId = p.id WHERE r.id = ? FOR UPDATE', [data.reservationId])];
                    case 4:
                        reservations = (_a.sent())[0];
                        if (reservations.length === 0) {
                            throw new Error('Reservation not found');
                        }
                        reservation = reservations[0];
                        if (reservation.status === 'paid') {
                            throw new Error('Reservation is already paid');
                        }
                        ownerId = reservation.ownerId;
                        return [4 /*yield*/, this.ownersService.incrementInvoiceNumber(ownerId, conn)];
                    case 5:
                        invoiceNumber = _a.sent();
                        now = new Date();
                        return [4 /*yield*/, conn.query("INSERT INTO invoices (reservationId, invoiceNumber, issueDate, paidDate, amount, paymentMethod)\n         VALUES (?, ?, ?, ?, ?, ?)", [data.reservationId, invoiceNumber, now, now, data.amount, data.paymentMethod])];
                    case 6:
                        invoiceResult = (_a.sent())[0];
                        // 4. Actualizar reserva a 'paid'
                        return [4 /*yield*/, conn.query('UPDATE reservations SET status = ?, paymentMethod = ? WHERE id = ?', ['paid', data.paymentMethod, data.reservationId])];
                    case 7:
                        // 4. Actualizar reserva a 'paid'
                        _a.sent();
                        return [4 /*yield*/, conn.commit()];
                    case 8:
                        _a.sent();
                        return [4 /*yield*/, conn.query('SELECT * FROM invoices WHERE id = ?', [invoiceResult.insertId])];
                    case 9:
                        invoices = (_a.sent())[0];
                        return [2 /*return*/, invoices[0]];
                    case 10:
                        error_1 = _a.sent();
                        return [4 /*yield*/, conn.rollback()];
                    case 11:
                        _a.sent();
                        console.error('Error in markPaidAndCreateInvoice:', error_1);
                        throw error_1;
                    case 12:
                        conn.release();
                        return [7 /*endfinally*/];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    InvoicesService.prototype.getInvoiceById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.query('SELECT * FROM invoices WHERE id = ?', [id])];
                    case 1:
                        rows = (_a.sent())[0];
                        return [2 /*return*/, rows.length > 0 ? rows[0] : null];
                }
            });
        });
    };
    InvoicesService.prototype.getInvoicesByReservation = function (reservationId) {
        return __awaiter(this, void 0, void 0, function () {
            var rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.query('SELECT * FROM invoices WHERE reservationId = ? ORDER BY issueDate DESC', [reservationId])];
                    case 1:
                        rows = (_a.sent())[0];
                        return [2 /*return*/, rows];
                }
            });
        });
    };
    InvoicesService.prototype.getAllInvoices = function () {
        return __awaiter(this, arguments, void 0, function (limit, offset) {
            var rows;
            if (limit === void 0) { limit = 100; }
            if (offset === void 0) { offset = 0; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.query('SELECT * FROM invoices ORDER BY issueDate DESC LIMIT ? OFFSET ?', [limit, offset])];
                    case 1:
                        rows = (_a.sent())[0];
                        return [2 /*return*/, rows];
                }
            });
        });
    };
    return InvoicesService;
}());
exports.InvoicesService = InvoicesService;
