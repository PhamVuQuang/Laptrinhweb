const sql = require('mssql');

const config = {
    server: 'localhost',
    database: 'master',
    authentication: {
        type: 'default'
    },
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

const universitiesData = [
    { matruong: 'BKH', tentruong: 'ĐH Bách Khoa', diem_san: 22 },
    { matruong: 'CDCT', tentruong: 'Cao Đẳng Công Thương', diem_san: 13.5 },
    { matruong: 'CDE', tentruong: 'Cao Đẳng Kinh Tế Đối Ngoại', diem_san: 14.5 },
    { matruong: 'CDGTVT', tentruong: 'Cao Đẳng Giao Thông Vận Tải', diem_san: 14 },
    { matruong: 'CDTD', tentruong: 'Cao Đẳng Công Nghệ Thực Phẩm', diem_san: 13.5 },
    { matruong: 'CN', tentruong: 'ĐH Công Nghiệp', diem_san: 17.8 },
    { matruong: 'CNTP', tentruong: 'ĐH Công Nghiệp Thực Phẩm', diem_san: 16 },
    { matruong: 'CNTT', tentruong: 'ĐH Công Nghệ Thông Tin', diem_san: 23.5 },
    { matruong: 'CTU', tentruong: 'ĐH Cần Thơ', diem_san: 18 },
    { matruong: 'DHD', tentruong: 'ĐH Đà Lạt', diem_san: 18 },
    { matruong: 'FPT', tentruong: 'ĐH FPT', diem_san: 19 },
    { matruong: 'HB', tentruong: 'ĐH Quốc Tế Hàng Bàng', diem_san: 15 },
    { matruong: 'HSU', tentruong: 'ĐH Hoa Sen', diem_san: 17 },
    { matruong: 'HUTECH', tentruong: 'ĐH Công Nghệ TP.HCM (HUTECH)', diem_san: 17 },
    { matruong: 'IUH', tentruong: 'ĐH Công Nghiệp TP.HCM', diem_san: 17 },
    { matruong: 'KHTN', tentruong: 'ĐH Khoa Học Tự Nhiên', diem_san: 19 },
    { matruong: 'KHXH', tentruong: 'ĐH KHXH & Nhân Văn', diem_san: 20.5 },
    { matruong: 'KT', tentruong: 'ĐH Kinh Tế', diem_san: 22.5 },
    { matruong: 'KT-CN', tentruong: 'ĐH Kỹ Thuật - Công Nghệ', diem_san: 16 },
    { matruong: 'KTL', tentruong: 'ĐH Kinh Tế - Luật', diem_san: 21.5 },
    { matruong: 'KTTRUC', tentruong: 'ĐH Kiến Trúc', diem_san: 19 },
    { matruong: 'LUAT', tentruong: 'ĐH Luật', diem_san: 23 },
    { matruong: 'MO', tentruong: 'ĐH Mỏ', diem_san: 17.5 },
    { matruong: 'NL', tentruong: 'ĐH Nông Lâm', diem_san: 17 },
    { matruong: 'NTT', tentruong: 'ĐH Nguyễn Tất Thành', diem_san: 15 },
    { matruong: 'SP', tentruong: 'ĐH Sư Phạm', diem_san: 19.5 },
    { matruong: 'SPKT', tentruong: 'ĐH Sư Phạm Kỹ Thuật', diem_san: 21 },
    { matruong: 'TDTT', tentruong: 'ĐH Tây Nguyên', diem_san: 18.5 },
    { matruong: 'TNMT', tentruong: 'ĐH Tài Nguyên & Môi Trường', diem_san: 18.5 },
    { matruong: 'UEF', tentruong: 'ĐH Kinh Tế - Tài Chính (UEF)', diem_san: 18 },
    { matruong: 'VLU', tentruong: 'ĐH Văn Lang', diem_san: 18 }
];

async function main() {
    try {
        console.log('Connecting to SQL Server...');
        const pool = new sql.ConnectionPool(config);
        await pool.connect();
        
        console.log('Dropping old database...');
        try {
            await pool.query(`
                IF EXISTS (SELECT * FROM sys.databases WHERE name = 'tracuudiemthi')
                BEGIN
                    ALTER DATABASE tracuudiemthi SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                    DROP DATABASE tracuudiemthi;
                END
            `);
        } catch (e) {
            console.log('Drop existing DB result:', e.message);
        }
        
        console.log('Creating database...');
        await pool.query(`CREATE DATABASE tracuudiemthi`);
        
        // Kết nối lại với cơ sở dữ liệu mới
        config.database = 'tracuudiemthi';
        const pool2 = new sql.ConnectionPool(config);
        await pool2.connect();
        
        console.log('Creating tables...');
        await pool2.query(`
            CREATE TABLE dbo.truongdaihoc (
                matruong NVARCHAR(50) NOT NULL PRIMARY KEY,
                tentruong NVARCHAR(255) NOT NULL,
                diem_san FLOAT
            );
        `);
        
        console.log('Inserting universities...');
        for (const uni of universitiesData) {
            await pool2.query(
                'INSERT INTO dbo.truongdaihoc (matruong, tentruong, diem_san) VALUES (@matruong, @tentruong, @diem_san)',
                [
                    {name: 'matruong', value: uni.matruong},
                    {name: 'tentruong', value: uni.tentruong},
                    {name: 'diem_san', value: uni.diem_san}
                ]
            );
        }
        
        console.log('Verifying data...');
        const result = await pool2.query('SELECT COUNT(*) as count FROM dbo.truongdaihoc');
        console.log(`Inserted ${result.recordset[0].count} universities`);
        
        const sample = await pool2.query('SELECT TOP 2 * FROM dbo.truongdaihoc');
        console.log('Sample data:', JSON.stringify(sample.recordset, null, 2));
        
        await pool2.close();
        process.exit(0);
    } catch (err) {
        console.error('Error:', err.message);
        process.exit(1);
    }
}

main();
