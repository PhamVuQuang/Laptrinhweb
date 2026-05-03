const express = require("express");
const sql = require("mssql");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");

const app = express();
app.use(cors());
app.use(express.json());

// Đảm bảo phản hồi JSON bao gồm charset UTF-8 để tránh Unicode bị hỏng
app.use((req, res, next) => {
    const origJson = res.json && res.json.bind(res);
    if (origJson) {
        res.json = function (body) {
            const cur = res.getHeader && res.getHeader("Content-Type");
            if (!cur) {
                res.setHeader("Content-Type", "application/json; charset=utf-8");
            } else if (/application\/json/i.test(String(cur)) && !/charset/i.test(String(cur))) {
                res.setHeader("Content-Type", String(cur) + "; charset=utf-8");
            }
            return origJson(body);
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
const dbPort = Number(process.env.DB_PORT || 1433);
const dbName = (process.env.DB_NAME || "tracuudiemthidh").trim();
const dbUser = (process.env.DB_USER || "web_app").trim();
const dbPassword = (process.env.DB_PASSWORD || "WebApp@123456").trim();
const dbInstance = process.env.DB_INSTANCE || "";
const useSqlcmdFallback = (process.env.USE_SQLCMD_FALLBACK || "true").toLowerCase() !== "false";

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
    return `${dbServer},${dbPort}`;
}

async function runSqlcmdQuery(query) {
    const tempFile = path.join(os.tmpdir(), `sqlcmd-${process.pid}-${crypto.randomBytes(6).toString("hex")}.txt`);
    const args = [
        "-S", getSqlcmdServerTarget(),
        "-E",
        "-d", dbName,
        "-w", "65535",
        "-y", "0",
        "-Y", "0",
        "-u",
        "-o", tempFile,
        "-Q", query
    ];
    try {
        await execFileAsync("sqlcmd", args);
        const text = fs.readFileSync(tempFile, "utf16le");
        return String(text || "").replace(/^\uFEFF/, "").trim();
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
    const start = text.indexOf("[");
    const end = text.lastIndexOf("]");
    if (start >= 0 && end > start) {
        return text.slice(start, end + 1);
    }

    const startObj = text.indexOf("{");
    const endObj = text.lastIndexOf("}");
    if (startObj >= 0 && endObj > startObj) {
        return text.slice(startObj, endObj + 1);
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
        return { ok: true, payload: JSON.parse(jsonText) };
    } catch (_) {
        return { ok: false, payload: fallbackValue };
    }
}

async function readSqlcmdJsonArray(query) {
    const out = await runSqlcmdQuery(`
        SET NOCOUNT ON;
        ${query}
    `);
    const jsonText = extractJsonFromSqlcmdOutput(out);
    return jsonText ? JSON.parse(jsonText) : [];
}

function normalizeSqlcmdLines(rawText) {
    return String(rawText || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !/^\(+\d+ rows affected\)+$/i.test(line))
        .filter((line) => !/^-+$/.test(line));
}

function isSqlAuthError(err) {
    const msg = String((err && err.message) || "");
    const code = String((err && err.code) || "");
    return /Login failed for user/i.test(msg) || /ELOGIN/i.test(code);
}

function createSqlConfig({ useInstance = false, instanceName = "", usePort = true } = {}) {
    const host = dbServer === "localhost" ? "127.0.0.1" : dbServer;
    const cfg = {
        user: dbUser,
        password: dbPassword,
        server: useInstance && instanceName ? `${host}\\${instanceName}` : host,
        database: dbName,
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    };

    if (usePort) {
        cfg.port = dbPort;
    }

    return cfg;
}

let poolPromise;
async function getPool() {
    if (!poolPromise) {
        const baseConfig = createSqlConfig({
            useInstance: !!dbInstance,
            instanceName: dbInstance,
            usePort: !dbInstance
        });

        poolPromise = sql.connect(baseConfig).catch(async (firstErr) => {
            const msg = String(firstErr.message || "");
            // Quay lại Windows Authentication khi SQL auth thất bại
            if (/Login failed for user/i.test(msg) || /ELOGIN/i.test(String(firstErr.code || ""))) {
                const winAuthConfig = {
                    server: dbServer === "localhost" ? "127.0.0.1" : dbServer,
                    database: dbName,
                    port: dbPort,
                    options: {
                        encrypt: false,
                        trustServerCertificate: true
                    },
                    authentication: {
                        type: "ntlm",
                        options: {
                            domain: "",
                            userName: "",
                            password: ""
                        }
                    }
                };
                // Thử Windows auth qua mssql ntlm trước, nếu thất bại thử sqlcmd
                try {
                    return await sql.connect(winAuthConfig);
                } catch (_) {
                    // sẽ quay lại sqlcmd mỗi route
                    throw firstErr;
                }
            }

            throw firstErr;
        });
    }
    return poolPromise;
}

function formatDbError(err) {
    const msg = String(err.message || "Loi ket noi SQL Server");
    if (/Login failed for user/i.test(msg) || /ELOGIN/i.test(String(err.code || ""))) {
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
    const username = (req.body?.username || "").trim();
    const password = (req.body?.password || "").trim();

    if (!username || !password) {
        return res.status(400).json({ message: "Thiếu tài khoản hoặc mật khẩu" });
    }

    try {
        const pool = await getPool();
        const request = pool.request();
        request.input("username", sql.NVarChar, username);
        request.input("password", sql.NVarChar, password);

        const result = await request.query(`
            SELECT TOP 1 t.*, ts.hoten
            FROM taikhoan t
            LEFT JOIN thisinh ts ON t.SBD = ts.SBD
            WHERE LTRIM(RTRIM(t.username)) = @username
              AND LTRIM(RTRIM(t.password)) = @password
        `);

        if (result.recordset.length > 0) {
            const user = result.recordset[0];
            res.json({
                message: "OK",
                sbd: user.SBD || "",
                hoten: user.hoten || ""
            });
        } else {
            res.status(401).json({ message: "Sai tài khoản" });
        }

    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const u = escapeSqlLiteral(username);
                const p = escapeSqlLiteral(password);
                const out = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT TOP 1 t.SBD, ts.hoten
                    FROM taikhoan t
                    LEFT JOIN thisinh ts ON t.SBD = ts.SBD
                    WHERE LTRIM(RTRIM(t.username)) = N'${u}'
                      AND LTRIM(RTRIM(t.password)) = N'${p}'
                    FOR JSON PATH, WITHOUT_ARRAY_WRAPPER;
                `);

                const jsonText = extractJsonFromSqlcmdOutput(out);
                if (!jsonText) {
                    return res.status(401).json({ message: "Sai tài khoản" });
                }
                
                const user = JSON.parse(jsonText);
                return res.json({
                    message: "OK",
                    sbd: user.SBD || "",
                    hoten: user.hoten || ""
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
        return res.json(sqlcmdResult.payload);
    }

    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT * FROM thisinh");
        res.json(result.recordset);
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const out = await runSqlcmdQuery("SET NOCOUNT ON; SELECT * FROM thisinh FOR JSON PATH;");
                const jsonText = extractJsonFromSqlcmdOutput(out);
                const payload = jsonText ? JSON.parse(jsonText) : [];
                return res.json(payload);
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
        return res.json(sqlcmdResult.payload);
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("sbd", sql.NVarChar, req.params.sbd)
            .query("SELECT * FROM thisinh WHERE SBD = @sbd");
        res.json(result.recordset[0] || null);
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
                return res.json(payload);
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
    const { hoten, ngaysinh, cccd, sdt, quequan } = req.body || {};

    if (!sbd || !hoten || !ngaysinh || !cccd || !sdt || !quequan) {
        return res.status(400).json({ message: "Thieu thong tin cap nhat" });
    }

    try {
        const pool = await getPool();
        await pool.request()
            .input("sbd", sql.NVarChar, sbd)
            .input("hoten", sql.NVarChar, hoten)
            .input("ngaysinh", sql.NVarChar, ngaysinh)
            .input("cccd", sql.NVarChar, cccd)
            .input("sdt", sql.NVarChar, sdt)
            .input("quequan", sql.NVarChar, quequan)
            .query(`
                UPDATE thisinh
                SET hoten = @hoten,
                    ngaysinh = @ngaysinh,
                    CCCD = @cccd,
                    sdt = @sdt,
                    quequan = @quequan
                WHERE SBD = @sbd
            `);

        return res.json({ message: "OK" });
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    UPDATE thisinh
                    SET hoten = N'${escapeSqlLiteral(hoten)}',
                        ngaysinh = N'${escapeSqlLiteral(ngaysinh)}',
                        CCCD = N'${escapeSqlLiteral(cccd)}',
                        sdt = N'${escapeSqlLiteral(sdt)}',
                        quequan = N'${escapeSqlLiteral(quequan)}'
                    WHERE SBD = N'${escapeSqlLiteral(sbd)}';
                `);
                return res.json({ message: "OK" });
            } catch (fallbackErr) {
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY ĐIỂM THI THEO SBD
app.get("/diemthi/:sbd", async (req, res) => {
    const sbd = escapeSqlLiteral(req.params.sbd);
    const sqlcmdResult = await querySqlcmdJson(`
        SELECT m.mamon, m.tenmon, d.diemthi, d.diemsauphuckhao
        FROM diemthi d
        JOIN monthi m ON d.mamon = m.mamon
        WHERE d.SBD = N'${sbd}'
        FOR JSON PATH;
    `, []);
    if (sqlcmdResult.ok) {
        return res.json(sqlcmdResult.payload);
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("sbd", sql.NVarChar, req.params.sbd)
            .query(`
                SELECT m.mamon, m.tenmon, d.diemthi, d.diemsauphuckhao
                FROM diemthi d
                JOIN monthi m ON d.mamon = m.mamon
                WHERE d.SBD = @sbd
            `);
        res.json(result.recordset);
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const sbd = escapeSqlLiteral(req.params.sbd);
                const out = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT m.mamon, m.tenmon, d.diemthi, d.diemsauphuckhao
                    FROM diemthi d
                    JOIN monthi m ON d.mamon = m.mamon
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
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY TẤT CẢ ĐIỂM THI (cho tra cứu)
app.get("/diemthi", async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT ts.SBD, ts.hoten, m.mamon, m.tenmon, d.diemthi, d.diemsauphuckhao
            FROM thisinh ts
            JOIN diemthi d ON ts.SBD = d.SBD
            JOIN monthi m ON d.mamon = m.mamon
        `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY NGUYỆN VỌNG
app.get("/nguyenvong", async (req, res) => {
    const sqlcmdResult = await querySqlcmdJson(`
        SELECT nv.SBD, nv.Thutu, t.tentruong, n.tennganh, n.monxettuyen
        FROM nguyenvong nv
        JOIN nganh n ON nv.manganh = n.manganh
        JOIN truongdaihoc t ON n.matruong = t.matruong
        FOR JSON PATH;
    `, []);
    if (sqlcmdResult.ok) {
        return res.json(sqlcmdResult.payload);
    }

    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT nv.SBD, nv.Thutu, t.tentruong, n.tennganh, n.monxettuyen
            FROM nguyenvong nv
            JOIN nganh n ON nv.manganh = n.manganh
            JOIN truongdaihoc t ON n.matruong = t.matruong
        `);
        res.json(result.recordset);
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const out = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT nv.SBD, nv.Thutu, t.tentruong, n.tennganh, n.monxettuyen
                    FROM nguyenvong nv
                    JOIN nganh n ON nv.manganh = n.manganh
                    JOIN truongdaihoc t ON n.matruong = t.matruong
                    FOR JSON PATH;
                `);
                const jsonText = extractJsonFromSqlcmdOutput(out);
                const payload = jsonText ? JSON.parse(jsonText) : [];
                return res.json(payload);
            } catch (fallbackErr) {
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY NGUYỆN VỌNG THEO SBD
app.get("/nguyenvong/:sbd", async (req, res) => {
    const sbd = escapeSqlLiteral(req.params.sbd);
    const sqlcmdResult = await querySqlcmdJson(`
        SELECT nv.id, nv.SBD, nv.manganh, nv.Thutu, t.tentruong, n.tennganh, n.monxettuyen
        FROM nguyenvong nv
        JOIN nganh n ON nv.manganh = n.manganh
        JOIN truongdaihoc t ON n.matruong = t.matruong
        WHERE nv.SBD = N'${sbd}'
        ORDER BY nv.Thutu
        FOR JSON PATH;
    `, []);
    if (sqlcmdResult.ok) {
        return res.json(sqlcmdResult.payload);
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input("sbd", sql.NVarChar, req.params.sbd)
            .query(`
                SELECT nv.id, nv.SBD, nv.manganh, nv.Thutu, t.tentruong, n.tennganh, n.monxettuyen
                FROM nguyenvong nv
                JOIN nganh n ON nv.manganh = n.manganh
                JOIN truongdaihoc t ON n.matruong = t.matruong
                WHERE nv.SBD = @sbd
                ORDER BY nv.Thutu
            `);
        res.json(result.recordset);
    } catch (err) {
        res.status(500).json({ message: formatDbError(err) });
    }
});

// XÓA NGUYỆN VỌNG
app.delete("/nguyenvong/:sbd/:manganh", async (req, res) => {
    const sbd = (req.params.sbd || "").trim();
    const manganh = (req.params.manganh || "").trim();

    if (!sbd || !manganh) {
        return res.status(400).json({ message: "Thieu thong tin" });
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
                    INSERT INTO nguyenvong (SBD, manganh, Thutu)
                    VALUES (N'${escapeSqlLiteral(sbd)}', N'${escapeSqlLiteral(manganh)}', ${Number(thutu)});
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
        const payload = await readSqlcmdJsonArray("SELECT * FROM truongdaihoc FOR JSON PATH;");
        return res.json(payload);
    } catch (_) {
        // rơi xuống pool khi có lỗi sqlcmd không mong đợi
    }

    try {
        const pool = await getPool();
        const result = await pool.request().query("SELECT * FROM truongdaihoc");
        res.json(result.recordset);
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
                return res.json(payload);
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
        const payload = await readSqlcmdJsonArray(`
            SELECT n.*, t.tentruong
            FROM nganh n
            JOIN truongdaihoc t ON n.matruong = t.matruong
            FOR JSON PATH;
        `);
        return res.json(payload);
    } catch (_) {
        // fall through to pool on unexpected sqlcmd failures
    }

    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT n.*, t.tentruong
            FROM nganh n
            JOIN truongdaihoc t ON n.matruong = t.matruong
        `);
        res.json(result.recordset);
    } catch (err) {
        if (useSqlcmdFallback && isSqlAuthError(err)) {
            try {
                const out = await runSqlcmdQuery(`
                    SET NOCOUNT ON;
                    SELECT n.*, t.tentruong
                    FROM nganh n
                    JOIN truongdaihoc t ON n.matruong = t.matruong
                    FOR JSON PATH;
                `);
                const jsonText = extractJsonFromSqlcmdOutput(out);
                const payload = jsonText ? JSON.parse(jsonText) : [];
                return res.json(payload);
            } catch (fallbackErr) {
                return res.status(500).json({ message: formatDbError(fallbackErr) });
            }
        }
        res.status(500).json({ message: formatDbError(err) });
    }
});

// LẤY NGÀNH THEO TRƯỜNG
app.get("/nganh/:matruong", async (req, res) => {
    try {
        const matruong = escapeSqlLiteral(req.params.matruong);
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

app.listen(3000, () => {
    console.log("Server chạy tại http://localhost:3000");
});