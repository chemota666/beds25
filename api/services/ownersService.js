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
exports.OwnersService = void 0;
var OwnersService = /** @class */ (function () {
    function OwnersService(pool) {
        this.pool = pool;
    }
    OwnersService.prototype.getAllOwners = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.query('SELECT * FROM owners ORDER BY name')];
                    case 1:
                        rows = (_a.sent())[0];
                        return [2 /*return*/, rows];
                }
            });
        });
    };
    OwnersService.prototype.getOwnerById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.query('SELECT * FROM owners WHERE id = ?', [id])];
                    case 1:
                        rows = (_a.sent())[0];
                        return [2 /*return*/, rows.length > 0 ? rows[0] : null];
                }
            });
        });
    };
    OwnersService.prototype.createOwner = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var name, dni, phone, _a, invoiceSeries, result, newOwner;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        name = data.name, dni = data.dni, phone = data.phone, _a = data.invoiceSeries, invoiceSeries = _a === void 0 ? 'INV' : _a;
                        return [4 /*yield*/, this.pool.query("INSERT INTO owners (name, dni, phone, invoiceSeries, lastInvoiceNumber) \n       VALUES (?, ?, ?, ?, 0)", [name, dni, phone, invoiceSeries])];
                    case 1:
                        result = (_b.sent())[0];
                        return [4 /*yield*/, this.getOwnerById(result.insertId)];
                    case 2:
                        newOwner = _b.sent();
                        if (!newOwner) {
                            throw new Error('Failed to create owner');
                        }
                        return [2 /*return*/, newOwner];
                }
            });
        });
    };
    OwnersService.prototype.updateOwner = function (id, data) {
        return __awaiter(this, void 0, void 0, function () {
            var updates, values, updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        updates = [];
                        values = [];
                        if (data.name !== undefined) {
                            updates.push('name = ?');
                            values.push(data.name);
                        }
                        if (data.dni !== undefined) {
                            updates.push('dni = ?');
                            values.push(data.dni);
                        }
                        if (data.phone !== undefined) {
                            updates.push('phone = ?');
                            values.push(data.phone);
                        }
                        if (data.invoiceSeries !== undefined) {
                            updates.push('invoiceSeries = ?');
                            values.push(data.invoiceSeries);
                        }
                        if (updates.length === 0) {
                            throw new Error('No fields to update');
                        }
                        values.push(id);
                        return [4 /*yield*/, this.pool.query("UPDATE owners SET ".concat(updates.join(', '), ", updatedAt = CURRENT_TIMESTAMP WHERE id = ?"), values)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.getOwnerById(id)];
                    case 2:
                        updated = _a.sent();
                        if (!updated) {
                            throw new Error('Owner not found after update');
                        }
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    OwnersService.prototype.deleteOwner = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var properties;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.query('SELECT COUNT(*) as count FROM properties WHERE ownerId = ?', [id])];
                    case 1:
                        properties = (_a.sent())[0];
                        if (properties[0].count > 0) {
                            throw new Error('Cannot delete owner with associated properties');
                        }
                        return [4 /*yield*/, this.pool.query('DELETE FROM owners WHERE id = ?', [id])];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Incrementa lastInvoiceNumber de forma atómica con lock
     * Usa SELECT ... FOR UPDATE para evitar race conditions
     */
    OwnersService.prototype.incrementInvoiceNumber = function (ownerId, connection) {
        return __awaiter(this, void 0, void 0, function () {
            var conn, _a, rows, _b, invoiceSeries, lastInvoiceNumber, newNumber, invoiceNumber, error_1;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        _a = connection;
                        if (_a) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.pool.getConnection()];
                    case 1:
                        _a = (_c.sent());
                        _c.label = 2;
                    case 2:
                        conn = _a;
                        _c.label = 3;
                    case 3:
                        _c.trys.push([3, 10, 13, 14]);
                        if (!!connection) return [3 /*break*/, 5];
                        return [4 /*yield*/, conn.beginTransaction()];
                    case 4:
                        _c.sent();
                        _c.label = 5;
                    case 5: return [4 /*yield*/, conn.query('SELECT invoiceSeries, lastInvoiceNumber FROM owners WHERE id = ? FOR UPDATE', [ownerId])];
                    case 6:
                        rows = (_c.sent())[0];
                        if (rows.length === 0) {
                            throw new Error('Owner not found');
                        }
                        _b = rows[0], invoiceSeries = _b.invoiceSeries, lastInvoiceNumber = _b.lastInvoiceNumber;
                        newNumber = (lastInvoiceNumber || 0) + 1;
                        return [4 /*yield*/, conn.query('UPDATE owners SET lastInvoiceNumber = ? WHERE id = ?', [newNumber, ownerId])];
                    case 7:
                        _c.sent();
                        invoiceNumber = "".concat(invoiceSeries || 'INV', "-").concat(String(newNumber).padStart(6, '0'));
                        if (!!connection) return [3 /*break*/, 9];
                        return [4 /*yield*/, conn.commit()];
                    case 8:
                        _c.sent();
                        _c.label = 9;
                    case 9: return [2 /*return*/, invoiceNumber];
                    case 10:
                        error_1 = _c.sent();
                        if (!!connection) return [3 /*break*/, 12];
                        return [4 /*yield*/, conn.rollback()];
                    case 11:
                        _c.sent();
                        _c.label = 12;
                    case 12: throw error_1;
                    case 13:
                        if (!connection) {
                            conn.release();
                        }
                        return [7 /*endfinally*/];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    return OwnersService;
}());
exports.OwnersService = OwnersService;
