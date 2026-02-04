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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MigrationRunner = void 0;
var promises_1 = __importDefault(require("fs/promises"));
var path_1 = __importDefault(require("path"));
var MigrationRunner = /** @class */ (function () {
    function MigrationRunner(connection, migrationsDir) {
        if (migrationsDir === void 0) { migrationsDir = __dirname; }
        this.connection = connection;
        this.migrationsDir = migrationsDir;
    }
    MigrationRunner.prototype.ensureMigrationTable = function () {
        return __awaiter(this, void 0, void 0, function () {
            var createTableSQL;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        createTableSQL = "\n      CREATE TABLE IF NOT EXISTS migration_history (\n        id INT AUTO_INCREMENT PRIMARY KEY,\n        version VARCHAR(50) NOT NULL UNIQUE,\n        name VARCHAR(255) NOT NULL,\n        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n        execution_time_ms INT,\n        status ENUM('success', 'failed', 'rolled_back') DEFAULT 'success',\n        error_message TEXT,\n        rollback_script TEXT,\n        INDEX idx_version (version),\n        INDEX idx_executed_at (executed_at),\n        INDEX idx_status (status)\n      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;\n    ";
                        return [4 /*yield*/, this.connection.query(createTableSQL)];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MigrationRunner.prototype.getExecutedMigrations = function () {
        return __awaiter(this, void 0, void 0, function () {
            var rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.connection.query('SELECT version FROM migration_history WHERE status = "success" ORDER BY version')];
                    case 1:
                        rows = (_a.sent())[0];
                        return [2 /*return*/, rows.map(function (row) { return row.version; })];
                }
            });
        });
    };
    MigrationRunner.prototype.getPendingMigrations = function () {
        return __awaiter(this, void 0, void 0, function () {
            var files, sqlFiles, executed;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, promises_1.default.readdir(this.migrationsDir)];
                    case 1:
                        files = _a.sent();
                        sqlFiles = files
                            .filter(function (f) { return f.endsWith('.sql'); })
                            .sort();
                        return [4 /*yield*/, this.getExecutedMigrations()];
                    case 2:
                        executed = _a.sent();
                        return [2 /*return*/, sqlFiles.filter(function (f) { return !executed.includes(f); })];
                }
            });
        });
    };
    MigrationRunner.prototype.runMigration = function (fileName) {
        return __awaiter(this, void 0, void 0, function () {
            var startTime, filePath, sql, statements, _i, statements_1, statement, executionTime, error_1, executionTime, errorMessage;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        startTime = Date.now();
                        filePath = path_1.default.join(this.migrationsDir, fileName);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 10, , 13]);
                        return [4 /*yield*/, promises_1.default.readFile(filePath, 'utf-8')];
                    case 2:
                        sql = _a.sent();
                        // Ejecutar la migración dentro de una transacción
                        return [4 /*yield*/, this.connection.beginTransaction()];
                    case 3:
                        // Ejecutar la migración dentro de una transacción
                        _a.sent();
                        statements = sql
                            .split(';')
                            .map(function (s) { return s.trim(); })
                            .filter(function (s) { return s.length > 0 && !s.startsWith('--'); });
                        _i = 0, statements_1 = statements;
                        _a.label = 4;
                    case 4:
                        if (!(_i < statements_1.length)) return [3 /*break*/, 7];
                        statement = statements_1[_i];
                        return [4 /*yield*/, this.connection.query(statement)];
                    case 5:
                        _a.sent();
                        _a.label = 6;
                    case 6:
                        _i++;
                        return [3 /*break*/, 4];
                    case 7:
                        executionTime = Date.now() - startTime;
                        // Registrar la migración exitosa
                        return [4 /*yield*/, this.connection.query('INSERT INTO migration_history (version, name, execution_time_ms, status) VALUES (?, ?, ?, ?)', [fileName, fileName.replace('.sql', ''), executionTime, 'success'])];
                    case 8:
                        // Registrar la migración exitosa
                        _a.sent();
                        return [4 /*yield*/, this.connection.commit()];
                    case 9:
                        _a.sent();
                        console.log("\u2713 Migraci\u00F3n ".concat(fileName, " ejecutada exitosamente en ").concat(executionTime, "ms"));
                        return [2 /*return*/, {
                                version: fileName,
                                name: fileName.replace('.sql', ''),
                                status: 'success',
                                executionTime: executionTime
                            }];
                    case 10:
                        error_1 = _a.sent();
                        return [4 /*yield*/, this.connection.rollback()];
                    case 11:
                        _a.sent();
                        executionTime = Date.now() - startTime;
                        errorMessage = error_1.message || String(error_1);
                        // Registrar el error
                        return [4 /*yield*/, this.connection.query('INSERT INTO migration_history (version, name, execution_time_ms, status, error_message) VALUES (?, ?, ?, ?, ?)', [fileName, fileName.replace('.sql', ''), executionTime, 'failed', errorMessage])];
                    case 12:
                        // Registrar el error
                        _a.sent();
                        console.error("\u2717 Error en migraci\u00F3n ".concat(fileName, ":"), errorMessage);
                        return [2 /*return*/, {
                                version: fileName,
                                name: fileName.replace('.sql', ''),
                                status: 'failed',
                                executionTime: executionTime,
                                error: errorMessage
                            }];
                    case 13: return [2 /*return*/];
                }
            });
        });
    };
    MigrationRunner.prototype.runAllPending = function () {
        return __awaiter(this, void 0, void 0, function () {
            var pending, results, _i, pending_1, migration, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.ensureMigrationTable()];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this.getPendingMigrations()];
                    case 2:
                        pending = _a.sent();
                        if (pending.length === 0) {
                            console.log('✓ No hay migraciones pendientes');
                            return [2 /*return*/, []];
                        }
                        console.log("Ejecutando ".concat(pending.length, " migraci\u00F3n(es) pendiente(s)..."));
                        results = [];
                        _i = 0, pending_1 = pending;
                        _a.label = 3;
                    case 3:
                        if (!(_i < pending_1.length)) return [3 /*break*/, 6];
                        migration = pending_1[_i];
                        return [4 /*yield*/, this.runMigration(migration)];
                    case 4:
                        result = _a.sent();
                        results.push(result);
                        if (result.status === 'failed') {
                            console.error('Deteniendo ejecución de migraciones debido a un error');
                            return [3 /*break*/, 6];
                        }
                        _a.label = 5;
                    case 5:
                        _i++;
                        return [3 /*break*/, 3];
                    case 6: return [2 /*return*/, results];
                }
            });
        });
    };
    return MigrationRunner;
}());
exports.MigrationRunner = MigrationRunner;
