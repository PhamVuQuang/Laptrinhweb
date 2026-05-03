const sql = require("mssql");

function getEnv(name, fallback = "") {
  const v = process.env[name];
  return (typeof v === "string" ? v : fallback).trim();
}

const dbServer = getEnv("DB_SERVER", "localhost");
const dbPort = Number(getEnv("DB_PORT", "1433"));
const dbName = getEnv("DB_NAME", "tracuudiemthidh");
const dbUser = getEnv("DB_USER", "sa");
const dbPassword = getEnv("DB_PASSWORD", "123456");
const dbInstance = getEnv("DB_INSTANCE", "");
const loginTable = getEnv("LOGIN_TABLE", "taikhoan");
const loginUserCol = getEnv("LOGIN_USER_COL", "username");
const loginPassCol = getEnv("LOGIN_PASS_COL", "password");

function mask(value) {
  if (!value) return "<empty>";
  if (value.length <= 2) return "**";
  return `${value[0]}${"*".repeat(Math.max(1, value.length - 2))}${value[value.length - 1]}`;
}

function makeConfig(opts = {}) {
  const cfg = {
    user: dbUser,
    password: dbPassword,
    server: opts.server || dbServer,
    database: opts.database || dbName,
    options: {
      encrypt: false,
      trustServerCertificate: true,
      ...(opts.instanceName ? { instanceName: opts.instanceName } : {}),
    },
    connectionTimeout: 8000,
    requestTimeout: 8000,
  };

  if (opts.usePort) {
    cfg.port = opts.port || dbPort;
  }

  return cfg;
}

function printHeader(title) {
  console.log("\n=== " + title + " ===");
}

function formatError(err) {
  return String((err && err.message) || err || "Unknown error");
}

function hintFromError(errMsg) {
  const m = errMsg.toLowerCase();

  if (m.includes("login failed for user") || m.includes("elogin")) {
    return [
      "Sai DB_USER/DB_PASSWORD hoac login bi disable.",
      "Trong SSMS: Security -> Logins -> sa -> Status = Enabled.",
      "Server Properties -> Security -> SQL Server and Windows Authentication mode.",
    ];
  }

  if (m.includes("failed to connect") || m.includes("esocket") || m.includes("etimeout")) {
    return [
      "Khong mo duoc ket noi SQL Server.",
      "Kiem tra DB_SERVER/DB_PORT/DB_INSTANCE.",
      "Bat TCP/IP trong SQL Server Configuration Manager va restart SQL service.",
    ];
  }

  if (m.includes("cannot open database") || m.includes("invalid object") || m.includes("does not exist")) {
    return [
      "Sai ten DB/table/cot hoac chua tao schema.",
      "Kiem tra DB_NAME va script tao bang.",
    ];
  }

  return ["Xem thong diep loi chi tiet va doi chieu cau hinh server.js."];
}

async function tryConnect(configs) {
  let lastErr;
  for (const entry of configs) {
    const { label, config } = entry;
    try {
      const pool = await sql.connect(config);
      return { pool, label, config };
    } catch (err) {
      lastErr = err;
      console.log(`[FAIL] ${label}: ${formatError(err)}`);
    }
  }
  throw lastErr;
}

async function tableExists(pool, tableName) {
  const r = await pool
    .request()
    .input("tableName", sql.NVarChar, tableName)
    .query(`SELECT COUNT(1) AS c FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = @tableName`);
  return Number(r.recordset[0].c) > 0;
}

async function columnsForTable(pool, tableName) {
  const r = await pool
    .request()
    .input("tableName", sql.NVarChar, tableName)
    .query(`SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @tableName`);
  return r.recordset.map((x) => String(x.COLUMN_NAME || "").toLowerCase());
}

async function main() {
  printHeader("DB DOCTOR CONFIG");
  console.log("DB_SERVER   =", dbServer);
  console.log("DB_PORT     =", dbPort);
  console.log("DB_INSTANCE =", dbInstance || "<empty>");
  console.log("DB_NAME     =", dbName);
  console.log("DB_USER     =", dbUser);
  console.log("DB_PASSWORD =", mask(dbPassword));
  console.log("LOGIN_TABLE =", loginTable);
  console.log("USER_COL    =", loginUserCol);
  console.log("PASS_COL    =", loginPassCol);

  const configs = [];
  if (dbInstance) {
    configs.push({
      label: `instance ${dbServer}\\${dbInstance}`,
      config: makeConfig({ instanceName: dbInstance, usePort: false }),
    });
  }

  configs.push({
    label: `tcp ${dbServer}:${dbPort}`,
    config: makeConfig({ usePort: true, port: dbPort }),
  });

  if (!dbInstance) {
    configs.push({
      label: "instance fallback localhost\\SQLEXPRESS",
      config: makeConfig({ server: "localhost", instanceName: "SQLEXPRESS", usePort: false }),
    });
  }

  let pool;
  try {
    printHeader("CONNECT TEST");
    const conn = await tryConnect(configs);
    pool = conn.pool;
    console.log("[OK] Connected via", conn.label);
  } catch (err) {
    printHeader("RESULT");
    const msg = formatError(err);
    console.log("[ERROR] Connect failed:", msg);
    for (const h of hintFromError(msg)) {
      console.log("-", h);
    }
    process.exitCode = 1;
    return;
  }

  try {
    printHeader("DB CHECK");
    const dbInfo = await pool.request().query("SELECT DB_NAME() AS currentDb, @@SERVERNAME AS serverName");
    console.log("Current DB  =", dbInfo.recordset[0].currentDb);
    console.log("SQL Server  =", dbInfo.recordset[0].serverName);

    const hasThisinh = await tableExists(pool, "thisinh");
    console.log("Table thisinh:", hasThisinh ? "OK" : "MISSING");

    const hasLogin = await tableExists(pool, loginTable);
    console.log(`Table ${loginTable}:`, hasLogin ? "OK" : "MISSING");

    if (!hasLogin) {
      console.log("\nFix goi y:");
      console.log(`CREATE TABLE ${loginTable} (${loginUserCol} NVARCHAR(50) PRIMARY KEY, ${loginPassCol} NVARCHAR(100) NOT NULL);`);
      console.log(`INSERT INTO ${loginTable}(${loginUserCol}, ${loginPassCol}) VALUES (N'admin', N'123');`);
      process.exitCode = 2;
      return;
    }

    const cols = await columnsForTable(pool, loginTable);
    const hasUserCol = cols.includes(loginUserCol.toLowerCase());
    const hasPassCol = cols.includes(loginPassCol.toLowerCase());

    console.log(`Column ${loginUserCol}:`, hasUserCol ? "OK" : "MISSING");
    console.log(`Column ${loginPassCol}:`, hasPassCol ? "OK" : "MISSING");

    if (!hasUserCol || !hasPassCol) {
      console.log("\nFix goi y: doi cau SQL login trong server.js cho dung ten cot that te.");
      process.exitCode = 3;
      return;
    }

    const countResult = await pool
      .request()
      .query(`SELECT COUNT(1) AS c FROM ${loginTable}`);
    const count = Number(countResult.recordset[0].c || 0);
    console.log(`Rows in ${loginTable}:`, count);

    if (count === 0) {
      console.log("\nFix goi y: bang login dang rong, them it nhat 1 tai khoan.");
      console.log(`INSERT INTO ${loginTable}(${loginUserCol}, ${loginPassCol}) VALUES (N'admin', N'123');`);
      process.exitCode = 4;
      return;
    }

    console.log("\n[OK] DB doctor passed. Co the login duoc neu user/pass nhap trung du lieu trong bang.");
  } catch (err) {
    const msg = formatError(err);
    printHeader("RESULT");
    console.log("[ERROR] Query check failed:", msg);
    for (const h of hintFromError(msg)) {
      console.log("-", h);
    }
    process.exitCode = 5;
  } finally {
    try {
      await sql.close();
    } catch (_) {
      // bỏ qua lỗi đóng
    }
  }
}

main();
