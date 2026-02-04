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
exports.PropertiesService = void 0;
var PropertiesService = /** @class */ (function () {
    function PropertiesService(pool) {
        this.pool = pool;
    }
    PropertiesService.prototype.getAllProperties = function (ownerId) {
        return __awaiter(this, void 0, void 0, function () {
            var rows_1, rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!ownerId) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.pool.query('SELECT * FROM properties WHERE ownerId = ? ORDER BY name', [ownerId])];
                    case 1:
                        rows_1 = (_a.sent())[0];
                        return [2 /*return*/, rows_1];
                    case 2: return [4 /*yield*/, this.pool.query('SELECT * FROM properties ORDER BY name')];
                    case 3:
                        rows = (_a.sent())[0];
                        return [2 /*return*/, rows];
                }
            });
        });
    };
    PropertiesService.prototype.getPropertyById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.query('SELECT * FROM properties WHERE id = ?', [id])];
                    case 1:
                        rows = (_a.sent())[0];
                        return [2 /*return*/, rows.length > 0 ? rows[0] : null];
                }
            });
        });
    };
    PropertiesService.prototype.createProperty = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var conn, result, propertyId, _i, _a, room, newProperty, error_1;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.pool.getConnection()];
                    case 1:
                        conn = _b.sent();
                        _b.label = 2;
                    case 2:
                        _b.trys.push([2, 11, 13, 14]);
                        return [4 /*yield*/, conn.beginTransaction()];
                    case 3:
                        _b.sent();
                        return [4 /*yield*/, conn.query('INSERT INTO properties (ownerId, name, address) VALUES (?, ?, ?)', [data.ownerId, data.name, data.address])];
                    case 4:
                        result = (_b.sent())[0];
                        propertyId = result.insertId;
                        if (!(data.rooms && data.rooms.length > 0)) return [3 /*break*/, 8];
                        _i = 0, _a = data.rooms;
                        _b.label = 5;
                    case 5:
                        if (!(_i < _a.length)) return [3 /*break*/, 8];
                        room = _a[_i];
                        return [4 /*yield*/, conn.query('INSERT INTO rooms (propertyId, name, type, pricePerNight, isActive) VALUES (?, ?, ?, ?, ?)', [propertyId, room.name, room.type, room.pricePerNight, true])];
                    case 6:
                        _b.sent();
                        _b.label = 7;
                    case 7:
                        _i++;
                        return [3 /*break*/, 5];
                    case 8: return [4 /*yield*/, conn.commit()];
                    case 9:
                        _b.sent();
                        return [4 /*yield*/, this.getPropertyById(propertyId)];
                    case 10:
                        newProperty = _b.sent();
                        if (!newProperty) {
                            throw new Error('Failed to create property');
                        }
                        return [2 /*return*/, newProperty];
                    case 11:
                        error_1 = _b.sent();
                        return [4 /*yield*/, conn.rollback()];
                    case 12:
                        _b.sent();
                        throw error_1;
                    case 13:
                        conn.release();
                        return [7 /*endfinally*/];
                    case 14: return [2 /*return*/];
                }
            });
        });
    };
    PropertiesService.prototype.updateProperty = function (id, data) {
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
                        if (data.address !== undefined) {
                            updates.push('address = ?');
                            values.push(data.address);
                        }
                        if (updates.length === 0) {
                            throw new Error('No fields to update');
                        }
                        values.push(id);
                        return [4 /*yield*/, this.pool.query("UPDATE properties SET ".concat(updates.join(', '), ", updatedAt = CURRENT_TIMESTAMP WHERE id = ?"), values)];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.getPropertyById(id)];
                    case 2:
                        updated = _a.sent();
                        if (!updated) {
                            throw new Error('Property not found');
                        }
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    PropertiesService.prototype.deleteProperty = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var reservations;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.query('SELECT COUNT(*) as count FROM reservations WHERE propertyId = ? AND status != "cancelled"', [id])];
                    case 1:
                        reservations = (_a.sent())[0];
                        if (reservations[0].count > 0) {
                            throw new Error('Cannot delete property with active reservations');
                        }
                        return [4 /*yield*/, this.pool.query('DELETE FROM properties WHERE id = ?', [id])];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    PropertiesService.prototype.getRoomsByProperty = function (propertyId) {
        return __awaiter(this, void 0, void 0, function () {
            var rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.pool.query('SELECT * FROM rooms WHERE propertyId = ? ORDER BY name', [propertyId])];
                    case 1:
                        rows = (_a.sent())[0];
                        return [2 /*return*/, rows];
                }
            });
        });
    };
    return PropertiesService;
}());
exports.PropertiesService = PropertiesService;
