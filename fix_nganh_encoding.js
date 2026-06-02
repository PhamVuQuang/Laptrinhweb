const sql = require('mssql');

const config = {
  server: 'localhost',
  database: 'tracuudiemthidaihoc',
  options: {
    encrypt: false,
    trustServerCertificate: true
  }
};

// Tên ngành Việt Nam - đây là các chuỗi ĐÚNG
const majors = [
  { manganh: 'CNTT-BKH-001', matruong: 'BKH', tennganh: 'Công Nghệ Thông Tin', monxettuyen: 'TOAN', diemchuan: 25.0, tentruong: 'ĐH Bách Khoa' },
  { manganh: 'KTDT-BKH-001', matruong: 'BKH', tennganh: 'Kỹ Thuật Điều Khiển', monxettuyen: 'LY', diemchuan: 24.5, tentruong: 'ĐH Bách Khoa' },
  { manganh: 'XD-BKH-001', matruong: 'BKH', tennganh: 'Kỹ Thuật Xây Dựng', monxettuyen: 'TOAN', diemchuan: 23.5, tentruong: 'ĐH Bách Khoa' },
  { manganh: 'CNTT-CDCT-001', matruong: 'CDCT', tennganh: 'Công Nghệ Thông Tin', monxettuyen: 'TOAN', diemchuan: 15.5, tentruong: 'Cao Đặng Công Thương' },
  { manganh: 'HTCT-CDCT-001', matruong: 'CDCT', tennganh: 'Hệ Thống Thương Mại', monxettuyen: 'TOAN', diemchuan: 14.0, tentruong: 'Cao Đặng Công Thương' },
  { manganh: 'KT-CDE-001', matruong: 'CDE', tennganh: 'Kinh Tế Quốc Tế', monxettuyen: 'TOAN', diemchuan: 16.0, tentruong: 'Cao Đặng Kinh Tế Đối Ngoại' },
  { manganh: 'QL-CDE-001', matruong: 'CDE', tennganh: 'Quản Lý Du Lịch', monxettuyen: 'VAN', diemchuan: 15.5, tentruong: 'Cao Đặng Kinh Tế Đối Ngoại' },
  { manganh: 'GTVT-CDGTVT-001', matruong: 'CDGTVT', tennganh: 'Giao Thông Vận Tải', monxettuyen: 'TOAN', diemchuan: 14.5, tentruong: 'Cao Đặng Giao Thông Vận Tải' },
  { manganh: 'KTGT-CDGTVT-001', matruong: 'CDGTVT', tennganh: 'Kỹ Thuật Giao Thông', monxettuyen: 'LY', diemchuan: 14.0, tentruong: 'Cao Đặng Giao Thông Vận Tải' },
  { manganh: 'TP-CDTD-001', matruong: 'CDTD', tennganh: 'Công Nghệ Thực Phẩm', monxettuyen: 'HOA', diemchuan: 13.5, tentruong: 'Cao Đặng Công Nghệ Thực Phẩm' },
  { manganh: 'QL-CDTD-001', matruong: 'CDTD', tennganh: 'Quản Lý Chất Lượng', monxettuyen: 'TOAN', diemchuan: 13.0, tentruong: 'Cao Đặng Công Nghệ Thực Phẩm' },
  { manganh: 'CNTT-CN-001', matruong: 'CN', tennganh: 'Công Nghệ Thông Tin', monxettuyen: 'TOAN', diemchuan: 20.0, tentruong: 'ĐH Công Nghiệp' },
  { manganh: 'CNCo-CN-001', matruong: 'CN', tennganh: 'Công Nghệ Cơ Khí', monxettuyen: 'LY', diemchuan: 19.5, tentruong: 'ĐH Công Nghiệp' },
  { manganh: 'TP-CNTP-001', matruong: 'CNTP', tennganh: 'Công Nghệ Thực Phẩm', monxettuyen: 'HOA', diemchuan: 18.0, tentruong: 'ĐH Công Nghiệp Thực Phẩm' },
  { manganh: 'TPG-CNTP-001', matruong: 'CNTP', tennganh: 'Công Nghệ Thực Phẩm Giá Trị Cao', monxettuyen: 'HOA', diemchuan: 17.5, tentruong: 'ĐH Công Nghiệp Thực Phẩm' },
  { manganh: 'CNTT-CNTT-001', matruong: 'CNTT', tennganh: 'Công Nghệ Thông Tin', monxettuyen: 'TOAN', diemchuan: 27.0, tentruong: 'ĐH Công Nghệ Thông Tin' },
  { manganh: 'MMT-CNTT-001', matruong: 'CNTT', tennganh: 'Mạng Máy Tính & An Ninh Mạng', monxettuyen: 'TOAN', diemchuan: 26.5, tentruong: 'ĐH Công Nghệ Thông Tin' },
  { manganh: 'SP-CTU-001', matruong: 'CTU', tennganh: 'Sư Phạm Toán', monxettuyen: 'TOAN', diemchuan: 19.0, tentruong: 'ĐH Cần Thơ' },
  { manganh: 'NK-CTU-001', matruong: 'CTU', tennganh: 'Nông Nghiệp Ứng Dụng', monxettuyen: 'SINH', diemchuan: 18.5, tentruong: 'ĐH Cần Thơ' },
  { manganh: 'VL-DHD-001', matruong: 'DHD', tennganh: 'Vật Lý', monxettuyen: 'LY', diemchuan: 18.0, tentruong: 'ĐH Đà Lạt' },
  { manganh: 'HC-DH-001', matruong: 'DH', tennganh: 'Hóa Học', monxettuyen: 'HOA', diemchuan: 17.5, tentruong: 'ĐH Đại Học Quốc Gia' },
  { manganh: 'VL-DH-001', matruong: 'DH', tennganh: 'Vật Lý Giáo Dục', monxettuyen: 'LY', diemchuan: 17.0, tentruong: 'ĐH Đại Học Quốc Gia' },
  { manganh: 'VH-DH-001', matruong: 'DH', tennganh: 'Văn Học', monxettuyen: 'VAN', diemchuan: 16.0, tentruong: 'ĐH Đại Học Quốc Gia' },
  { manganh: 'KT-DHD-001', matruong: 'DHD', tennganh: 'Kinh Tế', monxettuyen: 'TOAN', diemchuan: 18.0, tentruong: 'ĐH Đà Lạt' },
  { manganh: 'KTDL-DHDE-001', matruong: 'DHDE', tennganh: 'Kinh Tế Du Lịch', monxettuyen: 'VAN', diemchuan: 17.0, tentruong: 'ĐH Du Lịch' },
  { manganh: 'QL-DHDE-001', matruong: 'DHDE', tennganh: 'Quản Lý Khách Sạn', monxettuyen: 'TOAN', diemchuan: 16.5, tentruong: 'ĐH Du Lịch' },
  { manganh: 'CNTT-FPT-001', matruong: 'FPT', tennganh: 'Công Nghệ Thông Tin', monxettuyen: 'TOAN', diemchuan: 26.0, tentruong: 'ĐH FPT' },
  { manganh: 'IS-FPT-001', matruong: 'FPT', tennganh: 'Hệ Thống Thông Tin', monxettuyen: 'TOAN', diemchuan: 25.0, tentruong: 'ĐH FPT' },
  { manganh: 'CNTT-HUST-001', matruong: 'HUST', tennganh: 'Công Nghệ Thông Tin', monxettuyen: 'TOAN', diemchuan: 28.0, tentruong: 'ĐH Bách Khoa Hà Nội' },
  { manganh: 'CK-HUST-001', matruong: 'HUST', tennganh: 'Cơ Khí', monxettuyen: 'LY', diemchuan: 26.0, tentruong: 'ĐH Bách Khoa Hà Nội' },
  { manganh: 'CNTT-HSU-001', matruong: 'HSU', tennganh: 'Sư Phạm Khoa Học', monxettuyen: 'LY', diemchuan: 17.5, tentruong: 'ĐH Sư Phạm Hà Nội' },
  { manganh: 'SP-HSU-001', matruong: 'HSU', tennganh: 'Sư Phạm Khoa Học Kỹ Thuật', monxettuyen: 'LY', diemchuan: 17.0, tentruong: 'ĐH Sư Phạm Hà Nội' },
  { manganh: 'SPT-HSU-001', matruong: 'HSU', tennganh: 'Sư Phạm Toán', monxettuyen: 'TOAN', diemchuan: 16.5, tentruong: 'ĐH Sư Phạm Hà Nội' },
  { manganh: 'SPV-HSU-001', matruong: 'HSU', tennganh: 'Sư Phạm Văn', monxettuyen: 'VAN', diemchuan: 16.0, tentruong: 'ĐH Sư Phạm Hà Nội' },
];

async function insertMajors() {
  try {
    const pool = new sql.ConnectionPool(config);
    await pool.connect();
    
    console.log('Connected to database');
    
    // Xóa dữ liệu hiện có
    await pool.request().query('DELETE FROM nganh');
    console.log('Cleared existing nganh data');
    
    // Chèn dữ liệu mới
    let count = 0;
    for (const major of majors) {
      const request = pool.request();
      request.input('manganh', sql.NVarChar, major.manganh);
      request.input('matruong', sql.NVarChar, major.matruong);
      request.input('tennganh', sql.NVarChar, major.tennganh);
      request.input('monxettuyen', sql.NVarChar, major.monxettuyen);
      request.input('diemchuan', sql.Float, major.diemchuan);
      request.input('tentruong', sql.NVarChar, major.tentruong);
      
      await request.query(
        'INSERT INTO nganh (manganh, matruong, tennganh, monxettuyen, diemchuan, tentruong) ' +
        'VALUES (@manganh, @matruong, @tennganh, @monxettuyen, @diemchuan, @tentruong)'
      );
      count++;
      console.log(`Inserted ${count}: ${major.tennganh}`);
    }
    
    // Verify
    const result = await pool.request().query('SELECT COUNT(*) as cnt FROM nganh');
    console.log(`\n✅ Successfully inserted ${result.recordset[0].cnt} majors with correct encoding!`);
    
    await pool.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

insertMajors();
