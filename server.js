const express = require("express");
const sql = require("mssql");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const multer = require("multer");
const iconv = require("iconv-lite");

const app = express();
app.use(cors());
app.use(express.json());

// Đảm bảo phản hồi JSON bao gồm charset UTF-8 để tránh Unicode bị hỏng
app.use((req, res, next) => {
    const origJson = res.json && res.json.bind(res);
    if (origJson) {
        res.json = function (body) {
            res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
            res.setHeader("Pragma", "no-cache");
            res.setHeader("Expires", "0");
            const cur = res.getHeader && res.getHeader("Content-Type");
            if (!cur) {
                res.setHeader("Content-Type", "application/json; charset=utf-8");
            } else if (/application\/json/i.test(String(cur)) && !/charset/i.test(String(cur))) {
                res.setHeader("Content-Type", String(cur) + "; charset=utf-8");
            }

            // Áp dụng fix sâu để đảm bảo mojibake được sửa
            try {
                const fixedBody = deepFixStrings(body);
                const jsonStr = JSON.stringify(fixedBody);
                
                // Debug: ghi log phản hồi userinfo đầu tiên để kiểm tra fix đã xảy ra
                if (body && body.SBD && typeof body.hoten === 'string') {
                    console.log(`[DEBUG] Middleware: hoten before fix: "${body.hoten}", after: "${fixedBody.hoten}"`);
                }

                // Gửi chuỗi JSON UTF-8 cuối cùng
                res.setHeader('Content-Length', Buffer.byteLength(jsonStr, 'utf8'));
                return res.send(jsonStr);
            } catch (e) {
                return origJson(body);
            }
        };
    }
    next();
});

// Trả về lỗi sạch khi client gửi body JSON không hợp lệ
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({ message: "JSON body khong hop le" });
    }
    return next(err);
});

app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});

const dbServer = process.env.DB_SERVER || "localhost";
const dbPortEnv = typeof process.env.DB_PORT === "string" ? process.env.DB_PORT.trim() : "";
const hasDbPortEnv = dbPortEnv !== "";
const dbPort = Number(dbPortEnv || 1433);
const dbName = (process.env.DB_NAME || "tracuudiemthi").trim();
const dbUser = typeof process.env.DB_USER === "string" ? process.env.DB_USER.trim() : "";
const dbPassword = typeof process.env.DB_PASSWORD === "string" ? process.env.DB_PASSWORD.trim() : "";
const dbInstance = process.env.DB_INSTANCE || "";
// Sử dụng kết nối mssql driver trực tiếp nếu có thể, fallback đến sqlcmd khi lỗi xác thực
// Windows Auth thường thất bại trên một số hệ thống, vì vậy fallback sqlcmd rất hữu ích
const useSqlcmdFallback = true;
const useIntegratedAuth = !dbUser && !dbPassword;

// Các trường để xóa khỏi phản hồi web (cũng được xóa khỏi dulieuthi.sql)
const removedMatruong = new Set(['CDCT','CDE','CDTD','HSU','IUH','MO','NTT','CTU','DHD']);

function execFileAsync(file, args) {
    return new Promise((resolve, reject) => {
        execFile(file, args, { windowsHide: true, maxBuffer: 1024 * 1024, encoding: 'buffer' }, (err, stdout, stderr) => {
            if (err) {
                err.stdout = stdout;
                err.stderr = stderr;
                reject(err);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

function escapeSqlLiteral(value) {
    return String(value || "").replace(/'/g, "''");
}

function getSqlcmdServerTarget() {
    if (dbInstance) {
        return `${dbServer}\\${dbInstance}`;
    }
    if (!hasDbPortEnv) {
        return dbServer;
    }
    return `${dbServer},${dbPort}`;
}

function loadLocalLoginAccounts() {
    try {
        const filePath = path.join(__dirname, "login.json");
        const raw = fs.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.log("[DEBUG] Unable to read login.json:", err.message);
        return [];
    }
}

async function runSqlcmdQuery(query) {
    const tempFile = path.join(os.tmpdir(), `sqlcmd-${process.pid}-${crypto.randomBytes(6).toString("hex")}.txt`);
    // Thêm câu lệnh USE thay vì sử dụng flag -d để tránh vấn đề xác thực
    const fullQuery = `USE ${dbName};\n${query}`;
    const args = [
        "-S", getSqlcmdServerTarget(),
        "-E",  // Xác thực Windows
        "-w", "65535",
        "-y", "0",
        "-Y", "0",
        "-u",
        "-o", tempFile,
        "-Q", fullQuery
    ];
    try {
        await execFileAsync("sqlcmd", args);
        const buffer = fs.readFileSync(tempFile);
        // Debug: hiển thị BOM/byte đầu tiên để giúp phát hiện vấn đề mã hóa
        try {
            const firstBytes = buffer.slice(0, 8);
            console.log('[DEBUG] sqlcmd temp file bytes (hex):', firstBytes.toString('hex'), 'len=', buffer.length);
        } catch (e) {
            // ignore
        }

        // Cố gắng phát hiện BOM/mã hóa từ bộ đệm và giải mã tương ứng
        // BOM phổ biến: UTF-8 EF BB BF, UTF-16 LE FF FE, UTF-16 BE FE FF
        let text = null;
        try {
            if (buffer && buffer.length >= 2) {
                const b0 = buffer[0];
                const b1 = buffer[1];
                if (b0 === 0xFF && b1 === 0xFE) {
                    // UTF-16 LE: bỏ qua BOM và giải mã bằng bộ giải mã UTF-16LE tích hợp của Node
                    // Bộ giải mã utf16le của Node xử lý UTF-16LE một cách chính xác
                    const withoutBom = buffer.slice(2);
                    text = withoutBom.toString("utf16le");
                    console.log('[DEBUG] Decoded as UTF-16LE, first 100 chars:', text.substring(0, 100).replace(/[\r\n]/g, '\\n'));
                } else if (b0 === 0xFE && b1 === 0xFF) {
                    // UTF-16 BE (Big Endian)
                    const withoutBom = buffer.slice(2);
                    text = withoutBom.toString("utf16be");
                } else if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
                    // UTF-8 với BOM
                    text = buffer.toString("utf8");
                } else {
                    // Mặc định là UTF-8 (hầu hết xử lý node/string mong đợi UTF-8)
                    text = buffer.toString("utf8");
                }
            } else {
                text = buffer.toString("utf8");
            }
        } catch (decErr) {
            // Fallback: thử UTF-16LE trực tiếp trên toàn bộ bộ đệm, sau đó UTF-8
            try {
                console.log('[DEBUG] Decode error, trying fallback:', decErr.message);
                text = buffer.toString("utf16le");
            } catch (_) {
                text = buffer.toString("utf8");
            }
        }

        const cleaned = String(text || "").replace(/^\uFEFF/, "").trim();
        try {
            console.log('[DEBUG] sqlcmd decoded snippet:', cleaned.substring(0, 300).replace(/\r?\n/g, '\\n'));
        } catch (e) {}
        return cleaned;
    } finally {
        try {
            fs.unlinkSync(tempFile);
        } catch (_) {
            // bỏ qua lỗi dọn dẹp
        }
    }
}

function extractJsonFromSqlcmdOutput(rawText) {
    const text = String(rawText || "");

    // Không thay thế tích cực ký tự xuống dòng/kiểm soát trên toàn bộ đầu ra
    // vì điều đó có thể làm hỏng khóa/cấu trúc JSON khi có khoảng trắng xuất hiện
    // giữa các token. Thay vào đó, xác định vị trí bắt đầu/kết thúc JSON trong đầu ra thô
    // và trả về chuỗi con nguyên vẹn (được cắt bớt). Điều này bảo toàn trong chuỗi
    // khoảng trắng và tránh tạo khóa không đúng định dạng như " matruong".
    const startArr = text.indexOf("[");
    const endArr = text.lastIndexOf("]");
    if (startArr >= 0 && endArr > startArr) {
        return text.slice(startArr, endArr + 1).trim();
    }

    const startObj = text.indexOf("{");
    const endObj = text.lastIndexOf("}");
    if (startObj >= 0 && endObj > startObj) {
        return text.slice(startObj, endObj + 1).trim();
    }

    return "";
}

async function querySqlcmdJson(query, fallbackValue) {
    if (!useSqlcmdFallback) {
        return { ok: false, payload: fallbackValue };
    }

    try {
        const out = await runSqlcmdQuery(`
            SET NOCOUNT ON;
            ${query}
        `);
        const jsonText = extractJsonFromSqlcmdOutput(out);
        if (!jsonText) {
            return { ok: true, payload: fallbackValue };
        }
        try {
            const parsed = JSON.parse(jsonText);
            return { ok: true, payload: parsed };
        } catch (e) {
            return { ok: true, payload: fallbackValue };
        }
    } catch (_) {
        return { ok: false, payload: fallbackValue };
    }
}

async function readSqlcmdJsonArray(query) {
    const out = await runSqlcmdQuery(`
        SET NOCOUNT ON;
        ${query}
    `);
    console.log("[readSqlcmdJsonArray] sqlcmd output length:", out.length);
    
    let jsonText = extractJsonFromSqlcmdOutput(out);
    console.log("[readSqlcmdJsonArray] Extracted JSON length:", jsonText.length);
    console.log("[readSqlcmdJsonArray] JSON preview:", jsonText.substring(0, 200));
    
    if (!jsonText) {
        console.log("[readSqlcmdJsonArray] No JSON found!");
        return [];
    }
        try {
            // Thoát các ký tự điều khiển chỉ bên trong các ký tự JSON để
            // JSON.parse không thất bại trên byte điều khiển thô trong khi bảo toàn
            // khoảng trắng cấu trúc bên ngoài chuỗi
            let cleaned = escapeControlCharsInJsonStrings(jsonText);

            try {
                const parsed = JSON.parse(cleaned);
                console.log("[readSqlcmdJsonArray] Parsed successfully, records:", Array.isArray(parsed) ? parsed.length : "single");
                // Sau đó áp dụng fixUtf8Mojibake cho dữ liệu được phân tích cú pháp qua deepFixStrings
                return deepFixStrings(parsed);
            } catch(parseErr) {
                console.error("[readSqlcmdJsonArray] JSON parse failed:", parseErr.message);
                console.error("[readSqlcmdJsonArray] JSON text length:", cleaned.length);
                return [];
            }
    } catch (e) {
        console.error("[readSqlcmdJsonArray] Exception:", e.message);
        return [];
    }
}

function normalizeSqlcmdLines(rawText) {
    return String(rawText || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !/^\(+\d+ rows affected\)+$/i.test(line))
        .filter((line) => !/^-+$/.test(line));
}

// Cố gắng sửa mojibake phổ biến trong đó byte UTF-8 bị hiểu nhầm là Latin1/UTF-16
function fixUtf8Mojibake(value) {
    if (typeof value !== 'string' || value.length === 0) return value;
    
    try {
        // Kiểm tra xem chuỗi có byte ASCII mở rộng (0x80-0xFF) không
        // Chỉ cố gắng sửa khi chuỗi hiển thị các điểm đánh dấu mojibake rõ ràng
        // chẳng hạn như 'Ã', 'Â', '�' hoặc các ký tự hộp/dòng được tạo ra bằng mã hóa kép.
        const hasVietnamese = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/i.test(value);
        const hasMojibakeMarkers = /(�|�|Ã|Â|Ä|Å|∩┐|┐╜|├|┤|╜)/.test(value);

        // Nếu không có điểm đánh dấu mojibake, đừng chạm vào chuỗi (có khả năng nó đúng)
        if (!hasMojibakeMarkers) return value;

        // Tạo các bản giải mã ứng viên
        const candidates = [value];
        try { candidates.push(Buffer.from(value, 'latin1').toString('utf8')); } catch(_) {}
        try { candidates.push(Buffer.from(value, 'utf8').toString('latin1')); } catch(_) {}
        try { candidates.push(Buffer.from(Buffer.from(value, 'latin1').toString('utf8'),'latin1').toString('utf8')); } catch(_) {}
        try { candidates.push(Buffer.from(value, 'utf16le').toString('utf8')); } catch(_) {}

        // Tính điểm: ưu tiên chuỗi có chữ cái tiếng Việt và ít ký tự mojibake/điều khiển hơn
        function score(s) {
            if (typeof s !== 'string') return -1000;
            const vietnamese = (s.match(/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđĐ]/gi) || []).length;
            const bad = (s.match(/[∩┐╜�\u0000-\u001F]/g) || []).length;
            return vietnamese * 10 - bad;
        }

        let best = value;
        let bestScore = score(value);
        for (const c of candidates) {
            const sc = score(c);
            if (sc > bestScore) {
                bestScore = sc;
                best = c;
            }
        }

        if (best !== value) {
            console.log(`[MOJIBAKE_FIX] Best candidate selected for "${value.substring(0,40)}" -> "${best.substring(0,40)}"`);
        }
        return best;
    } catch (e) {
        return value;
    }
}

// Thoát các ký tự điều khiển không được thoát xuất hiện bên trong các ký tự JSON
// bằng cách chuyển đổi chúng thành thoát \u00XX. Điều này bảo toàn cấu trúc JSON
// trong khi tránh lỗi phân tích cú pháp từ các ký tự điều khiển thô trong đầu ra sqlcmd.
function escapeControlCharsInJsonStrings(text) {
    if (typeof text !== 'string' || text.length === 0) return text;
    let out = '';
    let inString = false;
    let esc = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const code = ch.charCodeAt(0);

        if (esc) {
            out += ch;
            esc = false;
            continue;
        }

        if (ch === '\\') {
            out += ch;
            esc = true;
            continue;
        }

        if (ch === '"') {
            inString = !inString;
            out += ch;
            continue;
        }

        if (inString && code >= 0 && code <= 0x1F) {
            const hex = code.toString(16).padStart(4, '0');
            out += '\\u' + hex;
        } else {
            out += ch;
        }
    }

    return out;
}

function deepFixStrings(obj) {
    // Đi bộ đệ quy qua JSON được phân tích cú pháp và cố gắng sửa mojibake chỉ khi
    // có vẻ như chuỗi chứa các byte được giải mã sai.
    function fixValue(v) {
        if (v == null) return v;
        if (typeof v === 'string') {
            return fixUtf8Mojibake(v);
        }
        if (Array.isArray(v)) {
            return v.map(fixValue);
        }
        if (typeof v === 'object') {
            const out = {};
            for (const k of Object.keys(v)) {
                out[k] = fixValue(v[k]);
            }
            return out;
        }
        return v;
    }

    try {
        return fixValue(obj);
    } catch (e) {
        return obj;
    }
}

function normalizeThisinhRecord(record) {
    if (!record || typeof record !== 'object') return record;

    const normalized = { ...record };
    const hoten = record.hoten ?? record.HoTen ?? record.HOTEN ?? record.HoTen?.toString?.();
    const ngaysinh = record.ngaysinh ?? record.NgaySinh ?? record.NGAYSINH;
    const quequan = record.quequan ?? record.QueQuan ?? record.QUEQUAN;
    const truong = record.truong ?? record.Truong ?? record.TRUONG;
    const tinhthanh = record.tinhthanh ?? record.TinhThanh ?? record.TINHTHANH;
    const sdt = record.sdt ?? record.SDT ?? record.Sdt;
    const cccd = record.cccd ?? record.CCCD ?? record.Cccd;
    const namthi = record.namthi ?? record.NamThi ?? record.NAMTHI;
    const diadiemthi = record.diadiemthi ?? record.DiaDiemThi ?? record.DIADIEMTHI;
    const gender = record.gender ?? record.Gender;
    const priorityCode = record.priorityCode ?? record.PriorityCode;
    const huyenCode = record.huyenCode ?? record.HuyenCode;
    const xaCode = record.xaCode ?? record.XaCode;
    const diachi = record.diachi ?? record.DiaChi;

    if (hoten !== undefined) normalized.hoten = hoten;
    if (ngaysinh !== undefined) normalized.ngaysinh = ngaysinh;
    if (cccd !== undefined) normalized.cccd = cccd;
    if (sdt !== undefined) normalized.sdt = sdt;
    if (quequan !== undefined) normalized.quequan = quequan;
    if (truong !== undefined) normalized.truong = truong;
    if (tinhthanh !== undefined) normalized.tinhthanh = tinhthanh;
    if (namthi !== undefined) normalized.namthi = namthi;
    if (diadiemthi !== undefined) normalized.diadiemthi = diadiemthi;
    if (gender !== undefined) normalized.gender = gender;
    if (priorityCode !== undefined) normalized.priorityCode = priorityCode;
    if (huyenCode !== undefined) normalized.huyenCode = huyenCode;
    if (xaCode !== undefined) normalized.xaCode = xaCode;
    if (diachi !== undefined) normalized.diachi = diachi;

    return normalized;
}

function isSqlAuthError(err) {
    const msg = String((err && err.message) || "");
    const code = String((err && err.code) || "");
    return /Login failed for user/i.test(msg) || /ELOGIN/i.test(code);
}

function createSqlConfig({ useInstance = false, instanceName = "", usePort = true, forceWindowsAuth = false } = {}) {
    const host = dbServer === "localhost" ? "127.0.0.1" : dbServer;
    const cfg = {
        server: useInstance && instanceName ? `${host}\\${instanceName}` : host,
        database: dbName,
        options: {
            encrypt: false,
            trustServerCertificate: true
        },
        connectionTimeout: 8000,
        requestTimeout: 30000
    };

    if (usePort && hasDbPortEnv) {
        cfg.port = dbPort;
    }

    // Xác thực Windows: khi không có người dùng/mật khẩu, hãy sử dụng thông tin xác thực Windows
    // trình điều khiển mssql sẽ sử dụng NTLM tự động khi không cung cấp người dùng/mật khẩu
    if (!dbUser && !dbPassword) {
        // Không đặt xác thực rõ ràng - hãy để mssql sử dụng Windows Auth theo mặc định
        // Không đặt người dùng/mật khẩu cho mssql biết sử dụng thông tin xác thực OS
    } else {
        // Xác thực SQL Server
        cfg.user = dbUser;
        cfg.password = dbPassword;
    }

    return cfg;
}

let poolPromise;
async function getPool() {
    if (!poolPromise) {
        const cfg = createSqlConfig({
            useInstance: !!dbInstance,
            instanceName: dbInstance,
            usePort: !dbInstance,
            forceWindowsAuth: useIntegratedAuth
        });

        poolPromise = sql.connect(cfg);
    }
    return poolPromise;
}

function formatDbError(err) {
    const msg = String(err.message || "Loi ket noi SQL Server");
    if (/Login failed for user/i.test(msg) || /ELOGIN/i.test(String(err.code || ""))) {
        if (useIntegratedAuth) {
            return "SQL Server dang su dung Windows Authentication. Hay chay server bang account co quyen truy cap SQL Server, hoac cau hinh SQL Server de ho tro Mixed Mode neu muon su dung DB_USER/DB_PASSWORD.";
        }
        return "SQL da ket noi duoc nhung tai khoan bi tu choi. Hay kiem tra DB_USER/DB_PASSWORD, trang thai login SQL, va quyen truy cap database.";
    }
    if (/Failed to connect to .*1433|Could not connect/i.test(msg)) {
        return "Khong ket noi duoc SQL Server qua TCP 1433. Hay kiem tra DB_SERVER, DB_PORT, trang thai dich vu SQL Server, va cau hinh TCP/IP.";
    }
    return msg;
}

function maskSecret(value) {
    if (!value) return "<empty>";
    if (value.length <= 2) return "**";
    return `${value[0]}${"*".repeat(value.length - 2)}${value[value.length - 1]}`;
}

async function tableExists(pool, tableName) {
    const result = await pool.request()
        .input("tableName", sql.NVarChar, tableName)
        .query("SELECT COUNT(1) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName");
    return Number(result.recordset[0].c || 0) > 0;
}

async function getColumns(pool, tableName) {
    const result = await pool.request()
        .input("tableName", sql.NVarChar, tableName)
        .query("SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName");
    return result.recordset.map((r) => String(r.COLUMN_NAME || "").toLowerCase());
}

// KIỂM TRA CƠSỞ DỮ LIỆU
app.get("/doctor/db", async (req, res) => {
    const report = {
        ok: false,
        config: {
            server: dbServer,
            port: dbPort,
            instance: dbInstance || "<empty>",
            database: dbName,
            user: dbUser,
            passwordMask: maskSecret(dbPassword)
        },
        checks: {
            connected: false,
            currentDb: null,
            serverName: null,
            hasThisinh: false,
            hasTaikhoan: false,
            hasUsernameColumn: false,
            hasPasswordColumn: false
        },
        debug: {
            sqlCode: null,
            sqlName: null,
            rawMessage: null
        },
        message: "",
        hint: []
    };

    try {
        const pool = await getPool();
        report.checks.connected = true;

        const dbInfo = await pool.request().query("SELECT DB_NAME() AS currentDb, @@SERVERNAME AS serverName");
        report.checks.currentDb = dbInfo.recordset[0].currentDb;
        report.checks.serverName = dbInfo.recordset[0].serverName;

        report.checks.hasThisinh = await tableExists(pool, "thisinh");
        report.checks.hasTaikhoan = await tableExists(pool, "taikhoan");

        if (report.checks.hasTaikhoan) {
            const cols = await getColumns(pool, "taikhoan");
            report.checks.hasUsernameColumn = cols.includes("username");
            report.checks.hasPasswordColumn = cols.includes("password");
        }

        const schemaOk = report.checks.hasThisinh
            && report.checks.hasTaikhoan
            && report.checks.hasUsernameColumn
            && report.checks.hasPasswordColumn;

        report.ok = schemaOk;
        report.message = schemaOk
            ? "Database ket noi tot va schema login hop le."
            : "Database ket noi duoc nhung schema login chua day du.";

        if (!report.checks.hasTaikhoan) {
            report.hint.push("Tao bang taikhoan(username, password).\n");
        }
        if (report.checks.hasTaikhoan && (!report.checks.hasUsernameColumn || !report.checks.hasPasswordColumn)) {
            report.hint.push("Bang taikhoan phai co cot username va password.");
        }
        if (!report.checks.hasThisinh) {
            report.hint.push("Bang thisinh chua ton tai trong DB hien tai.");
        }

        return res.status(report.ok ? 200 : 422).json(report);
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                await runSqlcmdQuery("SET NOCOUNT ON; SELECT TOP 1 1 AS ok FROM thisinh;");
                report.ok = true;
                report.checks.connected = true;
                report.message = "Dang fallback qua Windows Authentication (sqlcmd -E). Nen cap DB_USER/DB_PASSWORD de dung ket noi truc tiep.";
                report.hint.push("He thong dang doc du lieu bang sqlcmd -E tren may chu.");
                return res.status(200).json(report);
            } catch (_) {
                // giữ phản hồi lỗi mặc định dưới đây
            }
        }

        report.debug.sqlCode = err && err.code ? String(err.code) : null;
        report.debug.sqlName = err && err.name ? String(err.name) : null;
        report.debug.rawMessage = err && err.message ? String(err.message) : null;
        report.message = formatDbError(err);
        if (report.debug.rawMessage) {
            report.hint.push("RAW: " + report.debug.rawMessage);
        }
        res.status(500).json(report);
    }
});

// ĐĂNG NHẬP
app.post("/login", async (req, res) => {
    const username = (req.body?.username || req.body?.sbd || "").trim();
    const password = (req.body?.password || req.body?.matkhau || "").trim();

    if (!username || !password) {
        return res.status(400).json({ message: "Thiếu tài khoản hoặc mật khẩu" });
    }

    try {
        const pool = await getPool();
        const request = pool.request();
        request.input("username", sql.NVarChar, username);
        request.input("password", sql.NVarChar, password);

        const result = await request.query(`
            SELECT TOP 1 t.SBD, ts.HoTen
            FROM taikhoan t
            LEFT JOIN thisinh ts ON t.SBD = ts.SBD
            WHERE LTRIM(RTRIM(t.username)) = @username
              AND LTRIM(RTRIM(t.password)) = @password
        `);

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            console.log("[DEBUG] /login query result:", {
                sbd: user.SBD,
                hoten: user.HoTen
            });
            res.json({
                message: "OK",
                sbd: user.SBD || "",
                hoten: user.HoTen || ""
            });
        } else {
            res.status(401).json({ message: "Sai tài khoản hoặc mật khẩu" });
        }

    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const u = escapeSqlLiteral(username);
                const p = escapeSqlLiteral(password);
                const out = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT TOP 1 t.SBD, ts.HoTen
                    FROM taikhoan t
                    LEFT JOIN thisinh ts ON t.SBD = ts.SBD
                    WHERE LTRIM(RTRIM(t.username)) = N'${u}'
                      AND LTRIM(RTRIM(t.password)) = N'${p}'
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
                `);

                const jsonText = extractJsonFromSqlcmdOutput(out);
                if (!jsonText) {
                    return res.status(401).json({ message: "Sai SBD hoặc mật khẩu" });
                }
                
                const user = JSON.parse(jsonText);
                console.log("[DEBUG] /login fallback sqlcmd result:", {
                    sbd: user.SBD,
                    hoten: user.HoTen
                });
                return res.json({
                    message: "OK",
                    sbd: user.SBD || "",
                    hoten: user.HoTen || ""
                });
            } catch (fallbackErr) {
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }

        res.status(500).json({ message: formatDbError(err) });
    }
});

// QUÊN MẬT KHẨU
app.post("/forgot-password", async (req, res) => {
    const username = (req.body?.username || "").trim();
    const sbd = (req.body?.sbd || "").trim();
    const cccd = (req.body?.cccd || "").trim();
    const newPassword = (req.body?.newPassword || "").trim();

    if (!username || !sbd || !cccd || !newPassword) {
        return res.status(400).json({ message: "Thieu thong tin" });
    }

    try {
        const pool = await getPool();

        const check = await pool.request()
            .input("username", sql.NVarChar, username)
            .input("sbd", sql.NVarChar, sbd)
            .input("cccd", sql.NVarChar, cccd)
            .query(`
                SELECT TOP 1 1 AS ok
                FROM taikhoan t
                JOIN thisinh ts ON t.SBD = ts.SBD
                WHERE LTRIM(RTRIM(t.username)) = @username
                  AND LTRIM(RTRIM(t.SBD)) = @sbd
                  AND LTRIM(RTRIM(ts.CCCD)) = @cccd
            `);

        if (check.recordset.length === 0) {
            return res.status(404).json({ message: "Thong tin xac thuc khong dung" });
        }

        await pool.request()
            .input("username", sql.NVarChar, username)
            .input("sbd", sql.NVarChar, sbd)
            .input("cccd", sql.NVarChar, cccd)
            .input("newPassword", sql.NVarChar, newPassword)
            .query(`
                UPDATE t
                SET t.password = @newPassword
                FROM taikhoan t
                JOIN thisinh ts ON t.SBD = ts.SBD
                WHERE LTRIM(RTRIM(t.username)) = @username
                  AND LTRIM(RTRIM(t.SBD)) = @sbd
                  AND LTRIM(RTRIM(ts.CCCD)) = @cccd
            `);

        return res.json({ message: "OK" });
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const u = escapeSqlLiteral(username);
                const s = escapeSqlLiteral(sbd);
                const c = escapeSqlLiteral(cccd);
                const p = escapeSqlLiteral(newPassword);

                const out = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT TOP 1 1 AS ok
                    FROM taikhoan t
                    JOIN thisinh ts ON t.SBD = ts.SBD
                    WHERE LTRIM(RTRIM(t.username)) = N'${u}'
                      AND LTRIM(RTRIM(t.SBD)) = N'${s}'
                      AND LTRIM(RTRIM(ts.CCCD)) = N'${c}'
                    FOR JSON PATH;
                `);

                const jsonText = extractJsonFromSqlcmdOutput(out);
                const payload = jsonText ? JSON.parse(jsonText) : [];
                if (!Array.isArray(payload) || payload.length === 0) {
                    return res.status(404).json({ message: "Thong tin xac thuc khong dung" });
                }

                await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    UPDATE t
                    SET t.password = N'${p}'
                    FROM taikhoan t
                    JOIN thisinh ts ON t.SBD = ts.SBD
                    WHERE LTRIM(RTRIM(t.username)) = N'${u}'
                      AND LTRIM(RTRIM(t.SBD)) = N'${s}'
                      AND LTRIM(RTRIM(ts.CCCD)) = N'${c}';
                `);

                return res.json({ message: "OK" });
            } catch (fallbackErr) {
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }

        return res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY DANH SÁCH THÍ SINH
app.get("/thisinh", async (req, res) => {
    const sqlcmdResult = await querySqlcmdJson("SELECT * FROM thisinh FOR JSON PATH;", []);
    if (sqlcmdResult.ok) {
        const payload = Array.isArray(sqlcmdResult.payload)
            ? sqlcmdResult.payload.map(normalizeThisinhRecord)
            : normalizeThisinhRecord(sqlcmdResult.payload);
        return res.json(payload);
    }

    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT * FROM thisinh");
        res.json((result.recordset || []).map(normalizeThisinhRecord));
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const out = await runSqlcmdQuery("SET NOCOUNT ON; SELECT * FROM thisinh FOR JSON PATH;");
                const jsonText = extractJsonFromSqlcmdOutput(out);
                const payload = jsonText ? JSON.parse(jsonText) : [];
                return res.json(Array.isArray(payload) ? payload.map(normalizeThisinhRecord) : normalizeThisinhRecord(payload));
            } catch (fallbackErr) {
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY THÍ SINH THEO SBD
app.get("/thisinh/:sbd", async (req, res) => {
    const sbd = escapeSqlLiteral(req.params.sbd);
    const sqlcmdResult = await querySqlcmdJson(`SELECT * FROM thisinh WHERE SBD = N'${sbd}' FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;`, null);
    if (sqlcmdResult.ok) {
        return res.json(normalizeThisinhRecord(sqlcmdResult.payload));
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("sbd", sql.NVarChar, req.params.sbd)
            .query("SELECT * FROM thisinh WHERE SBD = @sbd");
        res.json(normalizeThisinhRecord(result.recordset[0] || null));
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const sbd = escapeSqlLiteral(req.params.sbd);
                const out = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT * FROM thisinh WHERE SBD = N'${sbd}' FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
                `);
                const jsonText = extractJsonFromSqlcmdOutput(out);
                const payload = jsonText ? JSON.parse(jsonText) : null;
                return res.json(normalizeThisinhRecord(payload));
            } catch (fallbackErr) {
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }
        res.status(500).json({ message: formatDbError(err) });
    }
});

// CẬP NHẬT THÍ SINH THEO SBD
app.put("/thisinh/:sbd", async (req, res) => {
    const sbd = String(req.params.sbd || "").trim();
    const { hoten, ngaysinh, cccd, sdt, quequan, huyenCode, xaCode, gender, priorityCode, diachi, namthi, diadiemthi } = req.body || {};

    console.log(`[DEBUG] PUT /thisinh/:sbd for ${sbd}:`, { hoten, ngaysinh, cccd, sdt, quequan, huyenCode, xaCode, gender, priorityCode, diachi, namthi, diadiemthi });

    if (!sbd || !hoten || !ngaysinh || !cccd || !sdt) {
        return res.status(400).json({ message: "Thiếu thông tin cập nhật bắt buộc" });
    }

    // Tạo câu lệnh SQL để lưu vào file
    const updateSqlForLog = `UPDATE thisinh SET hoten=N'${escapeSqlLiteral(hoten)}', ngaysinh=N'${escapeSqlLiteral(ngaysinh)}', CCCD=N'${escapeSqlLiteral(cccd)}', sdt=N'${escapeSqlLiteral(sdt)}', quequan=N'${escapeSqlLiteral(quequan||"")}', huyenCode=N'${escapeSqlLiteral(huyenCode||"")}', xaCode=N'${escapeSqlLiteral(xaCode||"")}', gender=N'${escapeSqlLiteral(gender||"")}', priorityCode=N'${escapeSqlLiteral(priorityCode||"")}', diachi=N'${escapeSqlLiteral(diachi||"")}', namthi=${namthi || "NULL"}, diadiemthi=N'${escapeSqlLiteral(diadiemthi||"")}' WHERE SBD=N'${escapeSqlLiteral(sbd)}'`;

    // Ghi vào file updates.sql
    const updatesFilePath = path.join(__dirname, "updates.sql");
    const timestamp = new Date().toISOString();
    const logContent = `-- Cập nhật ${timestamp} SBD=${sbd}\n${updateSqlForLog}\nGO\n\n`;
    
    try {
        await fs.promises.appendFile(updatesFilePath, logContent, "utf8");
        console.log(`[DEBUG] Logged update to updates.sql for SBD: ${sbd}`);
    } catch (fileErr) {
        console.log(`[DEBUG] Lỗi ghi file updates.sql:`, fileErr.message);
    }

    try {
        const pool = await getPool();
        await pool.request()
            .input("sbd", sql.NVarChar, sbd)
            .input("hoten", sql.NVarChar, hoten)
            .input("ngaysinh", sql.NVarChar, ngaysinh)
            .input("cccd", sql.NVarChar, cccd)
            .input("sdt", sql.NVarChar, sdt)
            .input("quequan", sql.NVarChar, quequan || "")
            .input("huyenCode", sql.NVarChar, huyenCode || "")
            .input("xaCode", sql.NVarChar, xaCode || "")
            .input("gender", sql.NVarChar, gender || "")
            .input("priorityCode", sql.NVarChar, priorityCode || "")
            .input("diachi", sql.NVarChar, diachi || "")
            .input("namthi", sql.Int, namthi || null)
            .input("diadiemthi", sql.NVarChar, diadiemthi || "")
            .query(`
                UPDATE thisinh
                SET hoten = @hoten,
                    ngaysinh = @ngaysinh,
                    CCCD = @cccd,
                    sdt = @sdt,
                    quequan = @quequan,
                    huyenCode = @huyenCode,
                    xaCode = @xaCode,
                    gender = @gender,
                    priorityCode = @priorityCode,
                    diachi = @diachi,
                    namthi = @namthi,
                    diadiemthi = @diadiemthi
                WHERE SBD = @sbd;
                
                SELECT * FROM thisinh WHERE SBD = @sbd
            `);

        console.log(`[DEBUG] PUT /thisinh/:sbd successful for ${sbd}`);
        return res.json({ message: "Cập nhật thành công", success: true });
    } catch (err) {
        console.log(`[DEBUG] PUT error (pool):`, err.message);
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                console.log(`[DEBUG] PUT executing SQL:`, updateSqlForLog.substring(0, 150));
                const updateResult = await runSqlcmdQuery(updateSqlForLog);
                console.log(`[DEBUG] PUT /thisinh/:sbd sqlcmd result for ${sbd}:`, updateResult.substring(0, 300));
                return res.json({ message: "Cập nhật thành công", success: true });
            } catch (fallbackErr) {
                console.log(`[DEBUG] PUT error (sqlcmd):`, fallbackErr.message);
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY ĐIỂM THI THEO SBD
app.get("/diemthi/:sbd", async (req, res) => {
    const sbd = escapeSqlLiteral(req.params.sbd);
    // Ư u tiên driver trực tiếp (mssql) để tránh vấn đề mã hóa từ đầu ra sqlcmd.
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("sbd", sql.NVarChar, req.params.sbd)
            .query(`
                SELECT m.mamon, m.tenmon, d.DiemThi AS diemthi, d.DiemSauPhucKhao AS diemsauphuckhao
                FROM diemthi d
                JOIN monthi m ON d.MaMon = m.mamon
                WHERE d.SBD = @sbd
            `);

        if (result && Array.isArray(result.recordset) && result.recordset.length > 0) {
            const fixed = result.recordset;
            return res.json(fixed);
        }

        // Nếu driver không trả về hàng nào, quay lại sqlcmd (các hệ thống cũ có thể yêu cầu)
        if (useSqlcmdFallback) {
            const sbdEsc = escapeSqlLiteral(req.params.sbd);
            const qres = await querySqlcmdJson(`
                SELECT m.mamon, m.tenmon, d.DiemThi AS diemthi, d.DiemSauPhucKhao AS diemsauphuckhao
                FROM diemthi d
                JOIN monthi m ON d.MaMon = m.mamon
                WHERE d.SBD = N'${sbdEsc}'
                FOR JSON PATH;
            `, []);
            if (qres.ok) {
                try {
                    return res.json(qres.payload);
                } catch (_) {
                    return res.json(qres.payload);
                }
            }
        }

        // Không tìm thấy dữ liệu
        return res.json([]);
    } catch (err) {
        // Như một lựa chọn cuối cùng, thử sqlcmd thô
        if (useSqlcmdFallback) {
            try {
                const sbd = escapeSqlLiteral(req.params.sbd);
                const out = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT m.mamon, m.tenmon, d.DiemThi AS diemthi, d.DiemSauPhucKhao AS diemsauphuckhao
                    FROM diemthi d
                    JOIN monthi m ON d.MaMon = m.mamon
                    WHERE d.SBD = N'${sbd}'
                    FOR JSON PATH;
                `);
                const jsonText = extractJsonFromSqlcmdOutput(out);
                const payload = jsonText ? JSON.parse(jsonText) : [];
                return res.json(payload);
            } catch (fallbackErr) {
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }

        return res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY TẤT CẢ ĐIỂM THI (cho tra cứu)
app.get("/diemthi", async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT ts.SBD, ts.HoTen, m.mamon, m.tenmon, d.DiemThi
            FROM thisinh ts
            JOIN diemthi d ON ts.SBD = d.SBD
            JOIN monthi m ON d.MaMon = m.mamon
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY NGUYỆN VỌNG + LOGIC XÉT ĐẬU/TRƯỢT
app.get("/nguyenvong", async (req, res) => {
    try {
        const pool = await getPool();
        
        // Lấy tất cả nguyện vọng
        const result = await pool.request().query(`
            SELECT nv.SBD, nv.Thutu, nv.manganh, t.tentruong, n.tennganh, n.monxettuyen, n.diemchuan
            FROM nguyenvong nv
            JOIN nganh n ON nv.manganh = n.manganh
            JOIN truongdaihoc t ON n.matruong = t.matruong
            ORDER BY nv.SBD, nv.Thutu
        `);
        
        let nguyenVongList = result.recordset || [];
        
        // Lấy tất cả điểm thi để xét đậu/trượt
        const diemThiAll = await pool.request().query(`
            SELECT SBD, MaMon, DiemThi FROM diemthi
        `);
        
        const diemThiByStudent = {};
        (diemThiAll.recordset || []).forEach(d => {
            if (!diemThiByStudent[d.SBD]) {
                diemThiByStudent[d.SBD] = {};
            }
            diemThiByStudent[d.SBD][d.MaMon] = d.DiemThi;
        });
        
        // Thêm trạng thái đậu/trượt
        nguyenVongList = nguyenVongList.map(nv => {
            const sbdKey = nv.SBD;
            const diemThiMap = diemThiByStudent[sbdKey] || {};
            const monXetTuyen = nv.monxettuyen || nv.MONXETTUYEN;
            const diemChuan = nv.diemchuan || nv.DIEMCHUAN || 20;
            const diemMon = diemThiMap[monXetTuyen] || 0;
            const trangThai = diemMon >= diemChuan ? "Đậu" : "Trượt";
            
            return {
                ...nv,
                diemMon: diemMon,
                diemChuan: diemChuan,
                trangThai: trangThai
            };
        });
        
        return res.json(nguyenVongList);
    } catch (err) {
        console.log(`[DEBUG] GET /nguyenvong error (pool):`, err.message);
        
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const out = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT nv.SBD, nv.Thutu, nv.manganh, t.tentruong, n.tennganh, n.monxettuyen, n.diemchuan
                    FROM nguyenvong nv
                    JOIN nganh n ON nv.manganh = n.manganh
                    JOIN truongdaihoc t ON n.matruong = t.matruong
                    ORDER BY nv.SBD, nv.Thutu
                    FOR JSON PATH;
                `);
                
                const jsonText = extractJsonFromSqlcmdOutput(out);
                let nguyenVongList = jsonText ? JSON.parse(jsonText) : [];
                
                // Lấy tất cả điểm thi
                const diemOut = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT SBD, MaMon, DiemThi FROM diemthi FOR JSON PATH;
                `);
                
                const diemJsonText = extractJsonFromSqlcmdOutput(diemOut);
                const diemList = diemJsonText ? JSON.parse(diemJsonText) : [];
                
                const diemThiByStudent = {};
                diemList.forEach(d => {
                    const sbdKey = d.SBD || d.SBD;
                    if (!diemThiByStudent[sbdKey]) {
                        diemThiByStudent[sbdKey] = {};
                    }
                    diemThiByStudent[sbdKey][d.MaMon || d.MAMON] = d.DiemThi || d.DIEMTHI;
                });
                
                // Thêm trạng thái
                nguyenVongList = nguyenVongList.map(nv => {
                    const sbdKey = nv.SBD || nv.SBD;
                    const diemThiMap = diemThiByStudent[sbdKey] || {};
                    const monXetTuyen = nv.monxettuyen || nv.MONXETTUYEN;
                    const diemChuan = nv.diemchuan || nv.DIEMCHUAN || 20;
                    const diemMon = diemThiMap[monXetTuyen] || 0;
                    const trangThai = diemMon >= diemChuan ? "Đậu" : "Trượt";
                    
                    return {
                        ...nv,
                        diemMon: diemMon,
                        diemChuan: diemChuan,
                        trangThai: trangThai
                    };
                });
                
                return res.json(nguyenVongList);
            } catch (fallbackErr) {
                console.log(`[DEBUG] GET /nguyenvong error (sqlcmd):`, fallbackErr.message);
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }
        
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY NGUYỆN VỌNG THEO SBD + LOGIC XÉT ĐẬU/TRƯỢT
app.get("/nguyenvong/:sbd", async (req, res) => {
    const sbd = escapeSqlLiteral(req.params.sbd);
    
    try {
        const pool = await getPool();
        
        // Lấy danh sách nguyện vọng của thí sinh
        const nguyenVongResult = await pool.request()
            .input("sbd", sql.NVarChar, req.params.sbd)
            .query(`
                SELECT nv.id, nv.SBD, nv.manganh, nv.Thutu, t.tentruong, n.tennganh, n.monxettuyen, n.diemchuan
                FROM nguyenvong nv
                JOIN nganh n ON nv.manganh = n.manganh
                JOIN truongdaihoc t ON n.matruong = t.matruong
                WHERE nv.SBD = @sbd
                ORDER BY nv.Thutu
            `);
        
        let nguyenVongList = nguyenVongResult.recordset || [];
        
        // Nếu có nguyện vọng, lấy điểm thi để xét đậu/trượt
        if (nguyenVongList.length > 0) {
            // Lấy điểm thi của thí sinh
            const diemThiResult = await pool.request()
                .input("sbd", sql.NVarChar, req.params.sbd)
                .query(`
                    SELECT MaMon, DiemThi FROM diemthi WHERE SBD = @sbd
                `);
            
            const diemThiMap = {};
            (diemThiResult.recordset || []).forEach(d => {
                diemThiMap[d.MaMon] = d.DiemThi;
            });
            
            // Thêm trạng thái đậu/trượt cho mỗi nguyện vọng
            nguyenVongList = nguyenVongList.map(nv => {
                const monXetTuyen = nv.monxettuyen || nv.MONXETTUYEN;
                const diemChuan = nv.diemchuan || nv.DIEMCHUAN || 20;
                const diemMon = diemThiMap[monXetTuyen] || 0;
                
                // Tính tổng điểm xét tuyển (có thể cộng 3 môn hoặc nhân 10 điểm môn chính)
                // Ví dụ: tổng điểm = (điểm môn chính * 10) + tổng điểm 2 môn phụ
                // Hoặc đơn giản: so sánh điểm môn chính với điểm chuyên ngành
                const trangThai = diemMon >= diemChuan ? "Đậu" : "Trượt";
                
                return {
                    ...nv,
                    diemMon: diemMon,
                    diemChuan: diemChuan,
                    trangThai: trangThai
                };
            });
        }
        
        return res.json(nguyenVongList);
    } catch (err) {
        console.log(`[DEBUG] GET /nguyenvong/:sbd error (pool):`, err.message);
        
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const out = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT nv.id, nv.SBD, nv.manganh, nv.Thutu, t.tentruong, n.tennganh, n.monxettuyen, n.diemchuan
                    FROM nguyenvong nv
                    JOIN nganh n ON nv.manganh = n.manganh
                    JOIN truongdaihoc t ON n.matruong = t.matruong
                    WHERE nv.SBD = N'${sbd}'
                    ORDER BY nv.Thutu
                    FOR JSON PATH;
                `);
                
                const jsonText = extractJsonFromSqlcmdOutput(out);
                let nguyenVongList = jsonText ? JSON.parse(jsonText) : [];
                
                // Lấy điểm thi bằng sqlcmd
                if (nguyenVongList.length > 0) {
                    const diemOut = await runSqlcmdQuery(`
                        SET NOCOUNT ON;
                        SELECT MaMon, DiemThi FROM diemthi WHERE SBD = N'${sbd}' FOR JSON PATH;
                    `);
                    
                    const diemJsonText = extractJsonFromSqlcmdOutput(diemOut);
                    const diemList = diemJsonText ? JSON.parse(diemJsonText) : [];
                    const diemThiMap = {};
                    diemList.forEach(d => {
                        diemThiMap[d.MaMon || d.MAMON] = d.DiemThi || d.DIEMTHI;
                    });
                    
                    // Thêm trạng thái
                    nguyenVongList = nguyenVongList.map(nv => {
                        const monXetTuyen = nv.monxettuyen || nv.MONXETTUYEN;
                        const diemChuan = nv.diemchuan || nv.DIEMCHUAN || 20;
                        const diemMon = diemThiMap[monXetTuyen] || 0;
                        const trangThai = diemMon >= diemChuan ? "Đậu" : "Trượt";
                        
                        return {
                            ...nv,
                            diemMon: diemMon,
                            diemChuan: diemChuan,
                            trangThai: trangThai
                        };
                    });
                }
                
                return res.json(nguyenVongList);
            } catch (fallbackErr) {
                console.log(`[DEBUG] GET /nguyenvong/:sbd error (sqlcmd):`, fallbackErr.message);
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }
        
        res.status(500).json({ message: formatDbError(err) });
    }
});

// XÓA NGUYỆN VỌNG
app.delete("/nguyenvong/:sbd/:manganh", async (req, res) => {
    const sbd = (req.params.sbd || "").trim();
    const manganh = (req.params.manganh || "").trim();
    const isPaid = req.query.paid === "true";

    if (!sbd || !manganh) {
        return res.status(400).json({ message: "Thieu thong tin" });
    }

    // Kiểm tra nếu đã thanh toán thì không cho phép xóa
    if (isPaid) {
        return res.status(403).json({ message: "Bạn đã thanh toán nên không thể xóa nguyện vọng!" });
    }

    try {
        const pool = await getPool();
        const check = await pool.request()
            .input("sbd", sql.NVarChar, sbd)
            .input("manganh", sql.NVarChar, manganh)
            .query(`SELECT COUNT(1) AS c FROM nguyenvong WHERE SBD = @sbd AND manganh = @manganh`);

        if (Number(check.recordset[0].c || 0) === 0) {
            return res.status(404).json({ message: "Khong tim thay nguyen vong" });
        }

        await pool.request()
            .input("sbd", sql.NVarChar, sbd)
            .input("manganh", sql.NVarChar, manganh)
            .query(`
                DELETE FROM nguyenvong
                WHERE SBD = @sbd AND manganh = @manganh;

                ;WITH r AS (
                    SELECT id, ROW_NUMBER() OVER (PARTITION BY SBD ORDER BY Thutu, id) AS new_thutu
                    FROM nguyenvong
                    WHERE SBD = @sbd
                )
                UPDATE nv
                SET nv.Thutu = r.new_thutu
                FROM nguyenvong nv
                JOIN r ON nv.id = r.id;
            `);

        return res.json({ message: "OK" });
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const escapedSbd = escapeSqlLiteral(sbd);
                const escapedManganh = escapeSqlLiteral(manganh);
                const checkJson = await querySqlcmdJson(`
                    SELECT COUNT(1) AS c
                    FROM nguyenvong
                    WHERE SBD = N'${escapedSbd}' AND manganh = N'${escapedManganh}'
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
                `, null);

                const count = checkJson.ok && checkJson.payload
                    ? Number(checkJson.payload.c || 0)
                    : 0;
                if (count === 0) {
                    return res.status(404).json({ message: "Khong tim thay nguyen vong" });
                }

                await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    DELETE FROM nguyenvong
                    WHERE SBD = N'${escapedSbd}' AND manganh = N'${escapedManganh}';

                    ;WITH r AS (
                        SELECT id, ROW_NUMBER() OVER (PARTITION BY SBD ORDER BY Thutu, id) AS new_thutu
                        FROM nguyenvong
                        WHERE SBD = N'${escapedSbd}'
                    )
                    UPDATE nv
                    SET nv.Thutu = r.new_thutu
                    FROM nguyenvong nv
                    JOIN r ON nv.id = r.id;
                `);

                return res.json({ message: "OK" });
            } catch (fallbackErr) {
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }

        return res.status(500).json({ message: formatDbError(err) });
    }
});

// THÊM NGUYỆN VỌNG
app.post("/nguyenvong", async (req, res) => {
    const { sbd, manganh, thutu } = req.body;
    if (!sbd || !manganh || !thutu) {
        return res.status(400).json({ message: "Thieu thong tin" });
    }

    // Tạo câu lệnh SQL để lưu vào file
    const insertSqlForLog = `INSERT INTO nguyenvong (SBD, manganh, Thutu) VALUES (N'${escapeSqlLiteral(sbd)}', N'${escapeSqlLiteral(manganh)}', ${Number(thutu)})`;

    // Ghi vào file updates.sql
    const updatesFilePath = path.join(__dirname, "updates.sql");
    const timestamp = new Date().toISOString();
    const logContent = `-- Thêm nguyện vọng ${timestamp} SBD=${sbd}\n${insertSqlForLog}\nGO\n\n`;
    
    try {
        await fs.promises.appendFile(updatesFilePath, logContent, "utf8");
        console.log(`[DEBUG] Logged nguyenvong to updates.sql for SBD: ${sbd}`);
    } catch (fileErr) {
        console.log(`[DEBUG] Lỗi ghi file updates.sql:`, fileErr.message);
    }

    try {
        const pool = await getPool();
        const duplicateCheck = await pool.request()
            .input("sbd", sql.NVarChar, sbd)
            .input("manganh", sql.NVarChar, manganh)
            .query(`
                SELECT 1 AS found
                FROM nguyenvong
                WHERE SBD = @sbd AND manganh = @manganh
            `);

        if (duplicateCheck.recordset.length > 0) {
            return res.status(409).json({ message: "Nguyen vong da ton tai" });
        }

        await pool.request()
            .input("sbd", sql.NVarChar, sbd)
            .input("manganh", sql.NVarChar, manganh)
            .input("thutu", sql.Int, thutu)
            .query(`
                INSERT INTO nguyenvong (SBD, manganh, Thutu)
                VALUES (@sbd, @manganh, @thutu)
            `);
        res.json({ message: "OK" });
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const duplicateRows = await querySqlcmdJson(`
                    SELECT 1 AS found
                    FROM nguyenvong
                    WHERE SBD = N'${escapeSqlLiteral(sbd)}'
                      AND manganh = N'${escapeSqlLiteral(manganh)}'
                    FOR JSON PATH;
                `, []);

                if (duplicateRows.ok && Array.isArray(duplicateRows.payload) && duplicateRows.payload.length > 0) {
                    return res.status(409).json({ message: "Nguyen vong da ton tai" });
                }

                await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    ${insertSqlForLog};
                `);
                return res.json({ message: "OK" });
            } catch (fallbackErr) {
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY DANH SÁCH TRƯỜNG
app.get("/truongdaihoc", async (req, res) => {
    try {
        const payload = await readSqlcmdJsonArray("SELECT matruong, tentruong, CAST(diem_san as DECIMAL(5,1)) as diem_san FROM truongdaihoc FOR JSON PATH;");
        const filtered = Array.isArray(payload)
            ? payload.filter(r => !removedMatruong.has(String(r.matruong ?? r.MATRUONG ?? '').trim()))
            : payload;
        return res.json(filtered);
    } catch (err) {
        // rơi xuống pool khi có lỗi sqlcmd không mong đợi
    }

    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT * FROM truongdaihoc");
        const rows = (result.recordset || []).filter(r => !removedMatruong.has(String(r.matruong ?? r.MATRUONG ?? '').trim()));
        res.json(rows);
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const out = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT * FROM truongdaihoc
                    FOR JSON PATH;
                `);
                const jsonText = extractJsonFromSqlcmdOutput(out);
                const payload = jsonText ? JSON.parse(jsonText) : [];
                const filtered2 = Array.isArray(payload)
                    ? payload.filter(r => !removedMatruong.has(String(r.matruong ?? r.MATRUONG ?? '').trim()))
                    : payload;
                return res.json(filtered2);
            } catch (fallbackErr) {
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY DANH SÁCH NGÀNH
app.get("/nganh", async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT n.manganh, n.matruong, n.tennganh, n.monxettuyen, n.diemchuan, t.tentruong
            FROM nganh n
            JOIN truongdaihoc t ON n.matruong = t.matruong
            ORDER BY n.manganh
        `);
        const rows = (result.recordset || []).filter(r => !removedMatruong.has(String(r.matruong ?? r.MATRUONG ?? r.matruong ?? '').trim()));
        return res.json(rows);
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                // Sử dụng sqlcmd với FOR JSON PATH vì pool trực tiếp thất bại
                const result = await readSqlcmdJsonArray(`
                    SELECT n.manganh, n.matruong, n.tennganh, n.monxettuyen, n.diemchuan, t.tentruong as tentruong_truong
                    FROM nganh n
                    JOIN truongdaihoc t ON n.matruong = t.matruong
                    FOR JSON PATH;
                `);
                const filtered = Array.isArray(result)
                    ? result.filter(r => !removedMatruong.has(String(r.matruong ?? r.MATRUONG ?? '').trim()))
                    : result;
                return res.json(filtered);
            } catch (fallbackErr) {
                console.error("[/nganh] Fallback error:", fallbackErr.message);
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY NGÀNH THEO TRƯỜNG
app.get("/nganh/:matruong", async (req, res) => {
    try {
        const rawMatruong = (req.params.matruong || "").trim();
        if (removedMatruong.has(rawMatruong)) {
            // Rõ ràng trả về danh sách trống cho các trường bị xóa
            return res.json([]);
        }
        const matruong = escapeSqlLiteral(rawMatruong);
        const result = await readSqlcmdJsonArray(`
            SELECT * FROM nganh WHERE matruong = N'${matruong}'
            FOR JSON PATH;
        `);
        return res.json(result);
    } catch (err) {
        console.error("Error in GET /nganh:", err);
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY THÔNG TIN USER (THSINH) THEO SBD
app.get("/userinfo/:sbd", async (req, res) => {
    const sbd = (req.params.sbd || "").trim();
    console.log(`[DEBUG] Requesting userinfo for SBD: ${sbd}`);
    
    if (!sbd) {
        return res.status(400).json({ message: "Thiếu SBD" });
    }

    try {
        const payload = await readSqlcmdJsonArray(`
            SET NOCOUNT ON;
            SELECT * FROM thisinh WHERE SBD = N'${escapeSqlLiteral(sbd)}'
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
        `);
        console.log(`[DEBUG] sqlcmd payload:`, payload);
        
        // Xử lý cả mảng và đối tượng đơn lẻ (từ WITHOUT_ARRAY_WRAPPER)
        if (!payload) {
            return res.status(404).json({ message: "Không tìm thấy thí sinh" });
        }
        
        // Nếu là mảng, sử dụng phần tử đầu tiên; nếu là đối tượng, sử dụng trực tiếp
        const result = Array.isArray(payload) ? payload[0] : payload;
        if (!result) {
            return res.status(404).json({ message: "Không tìm thấy thí sinh" });
        }
        const normalized = normalizeThisinhRecord(result);
        console.log(`[DEBUG] Sending userinfo response:`, normalized);
        return res.json(normalized);
    } catch (err) {
        console.log(`[DEBUG] sqlcmd error:`, err.message);
        // rơi qua pool
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("sbd", sql.NVarChar, sbd)
            .query("SELECT * FROM thisinh WHERE SBD = @sbd");
        
        console.log(`[DEBUG] pool result:`, result.recordset);
        if (result.recordset.length === 0) {
            return res.status(404).json({ message: "Không tìm thấy thí sinh" });
        }
        res.json(normalizeThisinhRecord(result.recordset[0]));
    } catch (err) {
        console.log(`[DEBUG] pool error:`, err.message);
        res.status(500).json({ message: formatDbError(err) });
    }
});

// CẬP NHẬT THÔNG TIN THÍ SINH VỚI UPLOAD FILE ƯU TIÊN
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Cấu hình multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const sbd = req.params.sbd || 'unknown';
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext);
        cb(null, `${sbd}_${timestamp}${ext}`);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        const allowedExts = ['.pdf', '.jpg', '.jpeg', '.png', '.doc', '.docx'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (!allowedExts.includes(ext)) {
            return cb(new Error(`File type not allowed. Accepted: PDF, JPG, PNG, DOC, DOCX`));
        }
        cb(null, true);
    }
});

app.post("/thisinh/:sbd/priority", upload.single('priorityFile'), async (req, res) => {
    const sbd = (req.params.sbd || "").trim();
    const { hoten, ngaysinh, cccd, sdt, quequan, huyenCode, xaCode, gender, priorityCode, diachi, namthi, diadiemthi } = req.body;
    
    console.log(`[DEBUG] POST /thisinh/:sbd/priority for SBD: ${sbd}`);
    console.log(`[DEBUG] Body:`, { hoten, ngaysinh, cccd, sdt, quequan, huyenCode, xaCode, gender, priorityCode, diachi, namthi, diadiemthi });
    console.log(`[DEBUG] File:`, req.file);
    
    // Validation
    if (!sbd) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Thiếu SBD" });
    }
    
    if (!priorityCode) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ message: "Thiếu mã ưu tiên" });
    }
    
    if (!req.file) {
        return res.status(400).json({ message: "Thiếu file tài liệu ưu tiên" });
    }
    
    try {
        // Lưu file name vào database
        const fileName = req.file.filename;
        
        // Tạo câu lệnh SQL để lưu vào file
        const updateSqlForLog = `UPDATE thisinh SET hoten=N'${escapeSqlLiteral(hoten)}', ngaysinh=N'${escapeSqlLiteral(ngaysinh)}', CCCD=N'${escapeSqlLiteral(cccd)}', sdt=N'${escapeSqlLiteral(sdt)}', quequan=N'${escapeSqlLiteral(quequan)}', huyenCode=N'${escapeSqlLiteral(huyenCode)}', xaCode=N'${escapeSqlLiteral(xaCode)}', gender=N'${escapeSqlLiteral(gender)}', priorityCode=N'${escapeSqlLiteral(priorityCode)}', diachi=N'${escapeSqlLiteral(diachi)}', namthi=${namthi || "NULL"}, diadiemthi=N'${escapeSqlLiteral(diadiemthi || "")}', priorityFile=N'${escapeSqlLiteral(fileName)}', priorityStatus=N'Chờ xác nhận' WHERE SBD=N'${escapeSqlLiteral(sbd)}'`;

        // Ghi vào file updates.sql
        const updatesFilePath = path.join(__dirname, "updates.sql");
        const timestamp = new Date().toISOString();
        const logContent = `-- Cập nhật ưu tiên ${timestamp} SBD=${sbd} File=${fileName}\n${updateSqlForLog}\nGO\n\n`;
        
        try {
            await fs.promises.appendFile(updatesFilePath, logContent, "utf8");
            console.log(`[DEBUG] Logged priority update to updates.sql for SBD: ${sbd}`);
        } catch (fileErr) {
            console.log(`[DEBUG] Lỗi ghi file updates.sql:`, fileErr.message);
        }
        
        // Cập nhật database
        const query = `
            UPDATE thisinh 
            SET 
                hoten = N'${escapeSqlLiteral(hoten)}',
                ngaysinh = N'${escapeSqlLiteral(ngaysinh)}',
                CCCD = N'${escapeSqlLiteral(cccd)}',
                sdt = N'${escapeSqlLiteral(sdt)}',
                quequan = N'${escapeSqlLiteral(quequan)}',
                huyenCode = N'${escapeSqlLiteral(huyenCode)}',
                xaCode = N'${escapeSqlLiteral(xaCode)}',
                gender = N'${escapeSqlLiteral(gender)}',
                priorityCode = N'${escapeSqlLiteral(priorityCode)}',
                diachi = N'${escapeSqlLiteral(diachi)}',
                namthi = ${namthi || "NULL"},
                diadiemthi = N'${escapeSqlLiteral(diadiemthi || "")}',
                priorityFile = N'${escapeSqlLiteral(fileName)}',
                priorityStatus = N'Chờ xác nhận'
            WHERE SBD = N'${escapeSqlLiteral(sbd)}';
            
            SELECT * FROM thisinh WHERE SBD = N'${escapeSqlLiteral(sbd)}'
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
        `;
        
        let result = null;
        
        try {
            result = await readSqlcmdJsonArray(query);
        } catch (err) {
            console.log(`[DEBUG] sqlcmd error for priority update:`, err.message);
            // Quay lại pool
        }
        
        if (!result) {
            try {
                const pool = await getPool();
                const updateResult = await pool.request()
                    .input("sbd", sql.NVarChar, sbd)
                    .input("hoten", sql.NVarChar, hoten)
                    .input("ngaysinh", sql.NVarChar, ngaysinh)
                    .input("cccd", sql.NVarChar, cccd)
                    .input("sdt", sql.NVarChar, sdt)
                    .input("quequan", sql.NVarChar, quequan)
                    .input("huyenCode", sql.NVarChar, huyenCode)
                    .input("xaCode", sql.NVarChar, xaCode)
                    .input("gender", sql.NVarChar, gender)
                    .input("priorityCode", sql.NVarChar, priorityCode)
                    .input("diachi", sql.NVarChar, diachi)
                    .input("namthi", sql.Int, namthi || null)
                    .input("diadiemthi", sql.NVarChar, diadiemthi || "")
                    .input("priorityFile", sql.NVarChar, fileName)
                    .input("priorityStatus", sql.NVarChar, "Chờ xác nhận")
                    .query(`
                        UPDATE thisinh 
                        SET hoten = @hoten, ngaysinh = @ngaysinh, CCCD = @cccd, sdt = @sdt,
                            quequan = @quequan, huyenCode = @huyenCode, xaCode = @xaCode,
                            gender = @gender, priorityCode = @priorityCode, diachi = @diachi,
                            namthi = @namthi, diadiemthi = @diadiemthi,
                            priorityFile = @priorityFile, priorityStatus = @priorityStatus
                        WHERE SBD = @sbd
                    `);
                
                const getResult = await pool.request()
                    .input("sbd", sql.NVarChar, sbd)
                    .query("SELECT * FROM thisinh WHERE SBD = @sbd");
                
                result = getResult.recordset[0];
            } catch (err2) {
                console.log(`[DEBUG] pool error for priority update:`, err2.message);
                throw err2;
            }
        } else if (Array.isArray(result)) {
            result = result[0];
        }
        
        console.log(`[DEBUG] Priority update successful for SBD ${sbd}, file: ${fileName}`);
        return res.json({
            message: "Cập nhật ưu tiên thành công. Tài liệu của bạn sẽ được xem xét.",
            priorityStatus: "Chờ xác nhận",
            file: fileName,
            user: result
        });
    } catch (err) {
        console.log(`[DEBUG] Priority update error:`, err.message);
        // Cố gắng xóa file đã tải lên khi có lỗi
        if (req.file && fs.existsSync(req.file.path)) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (_) {}
        }
        res.status(500).json({ message: formatDbError(err) });
    }
});

// Xử lý unhandled exceptions
process.on('uncaughtException', (err) => {
    console.error('\n❌ UNCAUGHT EXCEPTION:', err);
    console.error(err.stack);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('\n❌ UNHANDLED REJECTION:', reason);
    console.error('Promise:', promise);
});

// Điểm cuối DEBUG
app.get('/debug/login', (req, res) => {
    // Kiểm tra các tham số truy vấn
    const sbd = req.query.sbd || "";
    const hoten = req.query.hoten || "";
    res.json({
        message: "DEBUG - Pass sbd and hoten as query params",
        received: { sbd, hoten },
        example: "/debug/login?sbd=TS001&hoten=NguyenManhTien"
    });
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
    console.log(`Server chạy tại http://localhost:${PORT}`);
}).on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`\n❌ LỖI: Port ${PORT} đã bị chiếm dụng!`);
        console.error(`\nCách khắc phục:`);
        console.error(`1. Dùng port khác: PORT=3001 node server.js`);
        console.error(`2. Hoặc kill process cũ: taskkill /F /IM node.exe`);
        process.exit(1);
    } else {
        console.error('Server error:', err);
        process.exit(1);
    }
});

// Tắt máy chủ Graceful - Đóng connections sạch sẽ khi tắt
const gracefulShutdown = async () => {
    console.log('\n⏹️ Đang tắt server...');
    
    // Đóng pool SQL Server
    try {
        if (poolPromise && typeof poolPromise.then === 'function') {
            const pool = await poolPromise;
            if (pool && typeof pool.close === 'function') {
                await pool.close();
                console.log('✓ Đóng SQL Server connection');
            }
        }
    } catch (err) {
        console.error('Lỗi khi đóng SQL connection:', err.message);
    }
    
    // Đóng máy chủ HTTP
    return new Promise((resolve) => {
        server.close(() => {
            console.log('✓ Đóng HTTP server');
            console.log('✅ Server đã tắt sạch sẽ\n');
            resolve();
        });
        
        // Force close sau 10 giây nếu còn connections
        setTimeout(() => {
            console.warn('⚠️  Timeout - Force close server');
            process.exit(0);
        }, 10000);
    });
};

// Xử lý tín hiệu tắt server (Ctrl+C, kill, ...)
process.on('SIGTERM', async () => {
    console.log('\n📢 Nhận tín hiệu SIGTERM');
    await gracefulShutdown();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('\n📢 Nhận tín hiệu SIGINT (Ctrl+C)');
    await gracefulShutdown();
    process.exit(0);
});
