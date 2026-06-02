const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Dữ liệu để chèn
const monthi = [
    ['TOAN', 'Toán'],
    ['VAN', 'Văn'],
    ['ANH', 'Tiếng Anh'],
    ['LY', 'Vật Lý'],
    ['HOA', 'Hóa Học'],
    ['SINH', 'Sinh Học'],
    ['SU', 'Sử'],
    ['DIA', 'Địa'],
    ['GDCD', 'GDCD']
];

const truong = [
    ['BKH', 'ĐH Bách Khoa', 22],
    ['CDCT', 'Cao Đẳng Công Thương', 13.5],
    ['CDE', 'Cao Đẳng Kinh Tế Đối Ngoại', 14.5],
    ['CDGTVT', 'Cao Đẳng Giao Thông Vận Tải', 14],
    ['CDTD', 'Cao Đặng Công Nghệ Thực Phẩm', 13.5],
    ['CN', 'ĐH Công Nghiệp', 17.8],
    ['CNTP', 'ĐH Công Nghiệp Thực Phẩm', 16],
    ['CNTT', 'ĐH Công Nghệ Thông Tin', 23.5],
    ['CTU', 'ĐH Cần Thơ', 18],
    ['DHD', 'ĐH Đà Lạt', 18],
    ['FPT', 'ĐH FPT', 19],
    ['HB', 'ĐH Quốc Tế Hàng Bàng', 15],
    ['HSU', 'ĐH Hoa Sen', 17],
    ['HUTECH', 'ĐH Công Nghệ TP.HCM (HUTECH)', 17],
    ['IUH', 'ĐH Công Nghiệp TP.HCM', 17],
    ['KHTN', 'ĐH Khoa Học Tự Nhiên', 19],
    ['KHXH', 'ĐH KHXH & Nhân Văn', 20.5],
    ['KT', 'ĐH Kinh Tế', 22.5],
    ['KT-CN', 'ĐH Kỹ Thuật - Công Nghệ', 16],
    ['KTL', 'ĐH Kinh Tế - Luật', 21.5],
    ['KTTRUC', 'ĐH Kiến Trúc', 19],
    ['LUAT', 'ĐH Luật', 23],
    ['MO', 'ĐH Mỏ', 17.5],
    ['NL', 'ĐH Nông Lâm', 17],
    ['NTT', 'ĐH Nguyễn Tất Thành', 15],
    ['SP', 'ĐH Sư Phạm', 19.5],
    ['SPKT', 'ĐH Sư Phạm Kỹ Thuật', 21],
    ['TDTT', 'ĐH Tây Nguyên', 18.5],
    ['TNMT', 'ĐH Tài Nguyên & Môi Trường', 18.5],
    ['UEF', 'ĐH Kinh Tế - Tài Chính (UEF)', 18],
    ['VLU', 'ĐH Văn Lang', 18]
];

function escapeSQL(str) {
    return str.replace(/'/g, "''");
}

async function execAsync(cmd, args) {
    return new Promise((resolve, reject) => {
        try {
            const output = execFileSync(cmd, args, { encoding: 'utf8' });
            resolve(output);
        } catch (err) {
            reject(err);
        }
    });
}

async function main() {
    console.log('Creating database...');
    
    // Xóa và tạo lại
    try {
        await execAsync('sqlcmd', ['-S', 'localhost', '-Q', `IF EXISTS (SELECT * FROM sys.databases WHERE name = 'tracuudiemthi') BEGIN ALTER DATABASE tracuudiemthi SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE tracuudiemthi; END`]);
    } catch (e) {
        console.log('Drop output:', e.message);
    }
    
    // Tạo cơ sở dữ liệu
    await execAsync('sqlcmd', ['-S', 'localhost', '-Q', 'CREATE DATABASE tracuudiemthi']);
    
    // Tạo bảng
    const createTablesSQL = `
USE tracuudiemthi;

IF OBJECT_ID('dbo.monthi','U') IS NULL
CREATE TABLE dbo.monthi (
    mamon NVARCHAR(50) NOT NULL PRIMARY KEY,
    tenmon NVARCHAR(100) NOT NULL
);

IF OBJECT_ID('dbo.truongdaihoc','U') IS NULL
CREATE TABLE dbo.truongdaihoc (
    matruong NVARCHAR(50) NOT NULL PRIMARY KEY,
    tentruong NVARCHAR(255) NOT NULL,
    diem_san FLOAT
);
`;
    
    const tmpFile = path.join(require('os').tmpdir(), `sql_${Date.now()}.sql`);
    fs.writeFileSync(tmpFile, createTablesSQL, 'utf8');
    await execAsync('sqlcmd', ['-S', 'localhost', '-i', tmpFile]);
    fs.unlinkSync(tmpFile);
    
    console.log('Inserting monthi data...');
    for (const [mamon, tenmon] of monthi) {
        const sql = `INSERT INTO tracuudiemthi.dbo.monthi (mamon, tenmon) VALUES (N'${mamon}', N'${escapeSQL(tenmon)}')`;
        await execAsync('sqlcmd', ['-S', 'localhost', '-Q', sql]);
    }
    
    console.log('Inserting truongdaihoc data...');
    for (const [matruong, tentruong, diem_san] of truong) {
        const sql = `INSERT INTO tracuudiemthi.dbo.truongdaihoc (matruong, tentruong, diem_san) VALUES (N'${matruong}', N'${escapeSQL(tentruong)}', ${diem_san})`;
        await execAsync('sqlcmd', ['-S', 'localhost', '-Q', sql]);
    }
    
    console.log('Verifying data...');
    const result = await execAsync('sqlcmd', ['-S', 'localhost', '-Q', 'SELECT COUNT(*) FROM tracuudiemthi.dbo.truongdaihoc']);
    console.log('Universities in database:', result);
    
    console.log('Done!');
}

main().catch(console.error);
