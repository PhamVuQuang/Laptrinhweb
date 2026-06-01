const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Sample Vietnamese student names
const studentNames = [
    'Nguyễn Văn An', 'Trần Thị Bình', 'Phạm Minh Châu', 'Hoàng Đức Duy',
    'Vũ Thế Hiệp', 'Ngô Thanh Hoàng', 'Phạm Vũ Quảng', 'Nguyễn Mạnh Tiến',
    'Lê Quốc Khang', 'Đặng Thu Linh', 'Phan Huy Mạnh', 'Trương Văn Nam',
    'Dương Thành Phát', 'Bùi Minh Quân', 'Võ Quốc Tùng', 'Lý Trọng Uy',
    'Cao Văn Việt', 'Chu Minh Xuyên', 'Đỗ Thanh Yên', 'Huỳnh Quang Zalo'
];

const majors = [
    { manganh: 'CNTT', tennganh: 'Công Nghệ Thông Tin', matruong: 'CNTT' },
    { manganh: 'KT', tennganh: 'Kế Toán', matruong: 'KT' },
    { manganh: 'QT', tennganh: 'Quản Trị Kinh Doanh', matruong: 'KT' },
    { manganh: 'XDCV', tennganh: 'Xây Dựng Công Trình', matruong: 'BKH' },
    { manganh: 'DT', tennganh: 'Điện Tử', matruong: 'BKH' },
    { manganh: 'CX', tennganh: 'Cơ Khí', matruong: 'BKH' },
    { manganh: 'SP', tennganh: 'Sư Phạm Toán', matruong: 'SP' },
    { manganh: 'LS', tennganh: 'Luật Sư', matruong: 'LUAT' },
    { manganh: 'TKCC', tennganh: 'Tài Chính Cấp Cao', matruong: 'UEF' },
    { manganh: 'YH', tennganh: 'Y Học', matruong: 'CTU' },
];

const exams = ['TOAN', 'VAN', 'ANH', 'LY', 'HOA'];

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
    try {
        console.log('Creating tables...');
        
        // Create all tables
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

IF OBJECT_ID('dbo.nganh','U') IS NULL
CREATE TABLE dbo.nganh (
    manganh NVARCHAR(50) NOT NULL PRIMARY KEY,
    tennganh NVARCHAR(255) NOT NULL,
    matruong NVARCHAR(50) NOT NULL,
    FOREIGN KEY (matruong) REFERENCES dbo.truongdaihoc(matruong)
);

IF OBJECT_ID('dbo.thisinh','U') IS NULL
CREATE TABLE dbo.thisinh (
    sbd NVARCHAR(50) NOT NULL PRIMARY KEY,
    hoten NVARCHAR(255) NOT NULL,
    email NVARCHAR(255),
    sdt NVARCHAR(20),
    diachi NVARCHAR(255)
);

IF OBJECT_ID('dbo.taikhoan','U') IS NULL
CREATE TABLE dbo.taikhoan (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sbd NVARCHAR(50) NOT NULL UNIQUE,
    matkhau NVARCHAR(255) NOT NULL,
    vaitro NVARCHAR(50),
    FOREIGN KEY (sbd) REFERENCES dbo.thisinh(sbd)
);

IF OBJECT_ID('dbo.diemthi','U') IS NULL
CREATE TABLE dbo.diemthi (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sbd NVARCHAR(50) NOT NULL,
    mamon NVARCHAR(50) NOT NULL,
    diem FLOAT,
    FOREIGN KEY (sbd) REFERENCES dbo.thisinh(sbd),
    FOREIGN KEY (mamon) REFERENCES dbo.monthi(mamon)
);

IF OBJECT_ID('dbo.nguyenvong','U') IS NULL
CREATE TABLE dbo.nguyenvong (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sbd NVARCHAR(50) NOT NULL,
    manganh NVARCHAR(50) NOT NULL,
    thutu INT,
    trangthai NVARCHAR(50),
    FOREIGN KEY (sbd) REFERENCES dbo.thisinh(sbd),
    FOREIGN KEY (manganh) REFERENCES dbo.nganh(manganh)
);
`;
        
        const tmpFile = path.join(require('os').tmpdir(), `sql_${Date.now()}_tables.sql`);
        fs.writeFileSync(tmpFile, createTablesSQL, 'utf8');
        await execAsync('sqlcmd', ['-S', 'localhost', '-i', tmpFile]);
        fs.unlinkSync(tmpFile);
        
        console.log('Inserting monthi data...');
        const exams_data = [
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
        for (const [mamon, tenmon] of exams_data) {
            const sql = `INSERT INTO tracuudiemthi.dbo.monthi (mamon, tenmon) VALUES (N'${mamon}', N'${escapeSQL(tenmon)}')`;
            await execAsync('sqlcmd', ['-S', 'localhost', '-Q', sql]);
        }
        
        console.log('Inserting universities...');
        const truong = [
            ['BKH', 'ĐH Bách Khoa', 22],
            ['CDCT', 'Cao Đặng Công Thương', 13.5],
            ['CDE', 'Cao Đặng Kinh Tế Đối Ngoại', 14.5],
            ['CDGTVT', 'Cao Đặng Giao Thông Vận Tải', 14],
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
        for (const [matruong, tentruong, diem_san] of truong) {
            const sql = `INSERT INTO tracuudiemthi.dbo.truongdaihoc (matruong, tentruong, diem_san) VALUES (N'${matruong}', N'${escapeSQL(tentruong)}', ${diem_san})`;
            await execAsync('sqlcmd', ['-S', 'localhost', '-Q', sql]);
        }
        
        console.log('Inserting majors...');
        for (const maj of majors) {
            const sql = `INSERT INTO tracuudiemthi.dbo.nganh (manganh, tennganh, matruong) VALUES (N'${maj.manganh}', N'${escapeSQL(maj.tennganh)}', N'${maj.matruong}')`;
            await execAsync('sqlcmd', ['-S', 'localhost', '-Q', sql]);
        }
        
        console.log('Inserting students...');
        for (let i = 0; i < studentNames.length; i++) {
            const sbd = `TS${String(i + 1).padStart(3, '0')}`;
            const hoten = studentNames[i];
            const email = `student${i + 1}@edu.vn`;
            const sdt = `09${String(Math.floor(Math.random() * 100000000)).padStart(8, '0')}`;
            const diachi = `${i + 1} Đường ABC, TP. HCM`;
            
            const sql = `INSERT INTO tracuudiemthi.dbo.thisinh (sbd, hoten, email, sdt, diachi) VALUES (N'${sbd}', N'${escapeSQL(hoten)}', N'${email}', N'${sdt}', N'${escapeSQL(diachi)}')`;
            await execAsync('sqlcmd', ['-S', 'localhost', '-Q', sql]);
        }
        
        console.log('Inserting user accounts...');
        for (let i = 0; i < studentNames.length; i++) {
            const sbd = `TS${String(i + 1).padStart(3, '0')}`;
            const matkhau = 'pass123';
            const vaitro = 'student';
            
            const sql = `INSERT INTO tracuudiemthi.dbo.taikhoan (sbd, matkhau, vaitro) VALUES (N'${sbd}', N'${matkhau}', N'${vaitro}')`;
            await execAsync('sqlcmd', ['-S', 'localhost', '-Q', sql]);
        }
        
        console.log('Inserting exam scores...');
        for (let i = 0; i < studentNames.length; i++) {
            const sbd = `TS${String(i + 1).padStart(3, '0')}`;
            for (const mamon of ['TOAN', 'VAN', 'ANH', 'LY', 'HOA']) {
                const diem = (Math.random() * 10).toFixed(1);
                const sql = `INSERT INTO tracuudiemthi.dbo.diemthi (sbd, mamon, diem) VALUES (N'${sbd}', N'${mamon}', ${diem})`;
                await execAsync('sqlcmd', ['-S', 'localhost', '-Q', sql]);
            }
        }
        
        console.log('Verifying data...');
        const results = await execAsync('sqlcmd', ['-S', 'localhost', '-Q', `
            SELECT 
                'monthi' as [table], COUNT(*) as count FROM tracuudiemthi.dbo.monthi
            UNION ALL
            SELECT 'truongdaihoc', COUNT(*) FROM tracuudiemthi.dbo.truongdaihoc
            UNION ALL
            SELECT 'nganh', COUNT(*) FROM tracuudiemthi.dbo.nganh
            UNION ALL
            SELECT 'thisinh', COUNT(*) FROM tracuudiemthi.dbo.thisinh
            UNION ALL
            SELECT 'taikhoan', COUNT(*) FROM tracuudiemthi.dbo.taikhoan
            UNION ALL
            SELECT 'diemthi', COUNT(*) FROM tracuudiemthi.dbo.diemthi
        `]);
        console.log(results);
        
        console.log('\n✓ All data loaded successfully!');
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

main();
