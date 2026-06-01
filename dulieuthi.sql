-- ===== TẠO DATABASE & BẢNG DỮ LIỆU =====
CREATE DATABASE tracuudiemthi;
USE tracuudiemthi;
GO

-- ===== TẠO BẢNG MONTHI =====
IF OBJECT_ID('dbo.monthi','U') IS NULL
BEGIN
CREATE TABLE dbo.monthi (
    mamon NVARCHAR(50) NOT NULL PRIMARY KEY,
    tenmon NVARCHAR(100) NOT NULL
);
END
GO

-- ===== TẠO BẢNG TRUONGDAIHOC =====
IF OBJECT_ID('dbo.truongdaihoc','U') IS NULL
BEGIN
CREATE TABLE dbo.truongdaihoc (
    matruong NVARCHAR(50) NOT NULL PRIMARY KEY,
    tentruong NVARCHAR(255) NOT NULL,
    diem_san FLOAT
);
END
GO

-- ===== TẠO BẢNG NGANH =====
IF OBJECT_ID('dbo.nganh','U') IS NULL
BEGIN
CREATE TABLE dbo.nganh (
    manganh NVARCHAR(50) NOT NULL PRIMARY KEY,
    matruong NVARCHAR(50) NOT NULL,
    tennganh NVARCHAR(255),
    monxettuyen NVARCHAR(100),
    diemchuan FLOAT,
    tentruong NVARCHAR(255)
);
END
GO

-- ===== TẠO BẢNG THISINH =====
IF OBJECT_ID('dbo.thisinh','U') IS NULL
BEGIN
CREATE TABLE dbo.thisinh (
    SBD NVARCHAR(50) NOT NULL PRIMARY KEY,
    HoTen NVARCHAR(100),
    NgaySinh NVARCHAR(50),
    QueQuan NVARCHAR(100),
    Truong NVARCHAR(100),
    TinhThanh NVARCHAR(100),
    NamThi INT,
    DiaDiemThi NVARCHAR(100),
    SDT NVARCHAR(20),
    CCCD NVARCHAR(20),
    gender NVARCHAR(10),
    huyenCode NVARCHAR(50),
    xaCode NVARCHAR(50),
    diachi NVARCHAR(200),
    priorityCode NVARCHAR(50),
    priorityFile NVARCHAR(255),
    priorityStatus NVARCHAR(100)
);
END
GO

-- ===== TẠO BẢNG TAIKHOAN =====
IF OBJECT_ID('dbo.taikhoan','U') IS NULL
BEGIN
CREATE TABLE dbo.taikhoan (
    username NVARCHAR(50) NOT NULL PRIMARY KEY,
    password NVARCHAR(100) NOT NULL,
    SBD NVARCHAR(50)
);
END
GO

-- ===== TẠO BẢNG DIEMTHI =====
IF OBJECT_ID('dbo.diemthi','U') IS NULL
BEGIN
CREATE TABLE dbo.diemthi (
    SBD NVARCHAR(50) NOT NULL,
    MaMon NVARCHAR(50) NOT NULL,
    DiemThi FLOAT,
    DiemSauPhucKhao FLOAT,
    PRIMARY KEY (SBD, MaMon)
);
END
GO

-- ===== TẠO BẢNG NGUYENVONG =====
IF OBJECT_ID('dbo.nguyenvong','U') IS NULL
BEGIN
CREATE TABLE dbo.nguyenvong (
    ID INT PRIMARY KEY IDENTITY(1,1),
    SBD NVARCHAR(50),
    MaNganh NVARCHAR(50),
    TenNganh NVARCHAR(100),
    ThuTu INT
);
END
GO


-- ===== THÊM DỮ LIỆU MONTHI =====
INSERT INTO monthi (mamon, tenmon)
VALUES
(N'TOAN', N'Toán'),
(N'VAN', N'Văn'),
(N'ANH', N'Tiếng Anh'),
(N'LY', N'Lý'),
(N'HOA', N'Hóa'),
(N'SINH', N'Sinh'),
(N'SU', N'Sử'),
(N'DIA', N'Địa'),
(N'GDCD', N'GDCD');
GO

-- ===== THÊM DỮ LIỆU TRUONGDAIHOC =====
INSERT INTO truongdaihoc (matruong, tentruong, diem_san)
VALUES
(
N'BKH', N'ĐH Bách Khoa', 22),
(N'CDGTVT', N'Cao Đẳng Giao Thông Vận Tải', 14),
(N'CN', N'ĐH Công Nghiệp', 17.8),
(N'CNTP', N'ĐH Công Nghiệp Thực Phẩm', 16),
(N'CNTT', N'ĐH Công Nghệ Thông Tin', 23.5),
(N'FPT', N'ĐH FPT', 19),
(N'HB', N'ĐH Quốc Tế Hồng Bàng', 15),
(N'HUTECH', N'ĐH Công Nghệ TP.HCM (HUTECH)', 17),
(N'KHTN', N'ĐH Khoa Học Tự Nhiên', 19),
(N'KHXH', N'ĐH KHXH & Nhân Văn', 20.5),
(N'KT', N'ĐH Kinh Tế', 22.5),
(N'KT-CN', N'ĐH Kỹ Thuật - Công Nghệ', 16),
(N'KTL', N'ĐH Kinh Tế - Luật', 21.5),
(N'KTTRUC', N'ĐH Kiến Trúc', 19),
(N'LUAT', N'ĐH Luật', 23),
(N'NL', N'ĐH Nông Lâm', 17),
(N'SP', N'ĐH Sư Phạm', 19.5),
(N'SPKT', N'ĐH Sư Phạm Kỹ Thuật', 21),
(N'TNMT', N'ĐH Tài Nguyên & Môi Trường', 18.5),
(N'UEF', N'ĐH Kinh Tế - Tài Chính (UEF)', 18),
(N'VLU', N'ĐH Văn Lang', 18),
(N'TDTT', N'ĐH Tây Nguyên', 18.5)
);
GO

-- ===== THÊM DỮ LIỆU NGANH (CÁC NGÀNH HỌC) =====
INSERT INTO nganh (manganh, matruong, tennganh, monxettuyen, diemchuan, tentruong)
VALUES
-- Công Nghệ Thông Tin
(N'CNTT001', N'CNTT', N'Công Nghệ Thông Tin', N'TOAN', 25, N'ĐH Công Nghệ Thông Tin'),
(N'CNTT002', N'BKH', N'Công Nghệ Thông Tin', N'TOAN', 24, N'ĐH Bách Khoa'),
(N'CNTT003', N'FPT', N'Công Nghệ Thông Tin', N'TOAN', 22, N'ĐH FPT'),
(N'CNTT004', N'KT-CN', N'Công Nghệ Thông Tin', N'TOAN', 20, N'ĐH Kỹ Thuật - Công Nghệ'),
(N'CNTT005', N'HUTECH', N'Công Nghệ Thông Tin', N'TOAN', 19, N'ĐH Công Nghệ TP.HCM (HUTECH)'),

-- Kỹ Thuật Điện - Điện Tử
(N'KTDE001', N'BKH', N'Kỹ Thuật Điện - Điện Tử', N'LY', 23, N'ĐH Bách Khoa'),
(N'KTDE002', N'KT-CN', N'Kỹ Thuật Điện - Điện Tử', N'LY', 21, N'ĐH Kỹ Thuật - Công Nghệ'),
(N'KTDE003', N'CN', N'Kỹ Thuật Điện - Điện Tử', N'LY', 19.5, N'ĐH Công Nghiệp'),

-- Quản Lý Kinh Doanh
(N'QLKD001', N'KT', N'Quản Lý Kinh Doanh', N'TOAN', 22, N'ĐH Kinh Tế'),
(N'QLKD002', N'KTL', N'Quản Lý Kinh Doanh', N'TOAN', 21, N'ĐH Kinh Tế - Luật'),
(N'QLKD003', N'VLU', N'Quản Lý Kinh Doanh', N'TOAN', 18, N'ĐH Văn Lang'),
(N'QLKD004', N'UEF', N'Quản Lý Kinh Doanh', N'TOAN', 19, N'ĐH Kinh Tế - Tài Chính (UEF)'),

-- Kế Toán
(N'KT001', N'KT', N'Kế Toán', N'TOAN', 21, N'ĐH Kinh Tế'),
(N'KT002', N'KTL', N'Kế Toán', N'TOAN', 20.5, N'ĐH Kinh Tế - Luật'),
(N'KT003', N'UEF', N'Kế Toán', N'TOAN', 19.5, N'ĐH Kinh Tế - Tài Chính (UEF)'),

-- Luật
(N'LUAT001', N'LUAT', N'Luật Đại Cương', N'VAN', 24, N'ĐH Luật'),
(N'LUAT002', N'KTL', N'Luật Đại Cương', N'VAN', 22, N'ĐH Kinh Tế - Luật'),

-- Sư Phạm
(N'SP001', N'SP', N'Sư Phạm Toán', N'TOAN', 20, N'ĐH Sư Phạm'),
(N'SP002', N'SP', N'Sư Phạm Hóa', N'HOA', 19.5, N'ĐH Sư Phạm'),
(N'SP003', N'SP', N'Sư Phạm Vật Lý', N'LY', 19, N'ĐH Sư Phạm'),
(N'SP004', N'SP', N'Sư Phạm Tiếng Anh', N'ANH', 20, N'ĐH Sư Phạm'),
(N'SP005', N'SPKT', N'Sư Phạm Kỹ Thuật', N'TOAN', 21, N'ĐH Sư Phạm Kỹ Thuật'),

-- Nông Nghiệp - Lâm Nghiệp
(N'NN001', N'NL', N'Nông Nghiệp', N'SINH', 18, N'ĐH Nông Lâm'),
(N'NN002', N'TNMT', N'Quản Lý Tài Nguyên Thiên Nhiên', N'SINH', 17.5, N'ĐH Tài Nguyên & Môi Trường'),
(N'NN003', N'TDTT', N'Nông Lâm Ngành Nông Nghiệp', N'SINH', 17, N'ĐH Tây Nguyên'),

-- Kiến Trúc
(N'KTR001', N'KTTRUC', N'Kiến Trúc', N'TOAN', 19.5, N'ĐH Kiến Trúc'),

-- Khoa Học Tự Nhiên
(N'KHTN001', N'KHTN', N'Toán Học', N'TOAN', 20.5, N'ĐH Khoa Học Tự Nhiên'),
(N'KHTN002', N'KHTN', N'Hóa Học', N'HOA', 19.5, N'ĐH Khoa Học Tự Nhiên'),
(N'KHTN003', N'KHTN', N'Vật Lý', N'LY', 20, N'ĐH Khoa Học Tự Nhiên'),
(N'KHTN004', N'KHTN', N'Sinh Học', N'SINH', 19, N'ĐH Khoa Học Tự Nhiên'),

-- Khoa Học Xã Hội & Nhân Văn
(N'KHXH001', N'KHXH', N'Ngôn Ngữ Anh', N'ANH', 20.5, N'ĐH KHXH & Nhân Văn'),
(N'KHXH002', N'KHXH', N'Ngôn Ngữ Việt', N'VAN', 20, N'ĐH KHXH & Nhân Văn'),
(N'KHXH003', N'KHXH', N'Lịch Sử', N'SU', 19.5, N'ĐH KHXH & Nhân Văn'),
(N'KHXH004', N'KHXH', N'Địa Lý', N'DIA', 19, N'ĐH KHXH & Nhân Văn'),

-- Marketing
(N'MKT001', N'KT', N'Marketing', N'TOAN', 20, N'ĐH Kinh Tế'),
(N'MKT002', N'VLU', N'Marketing', N'TOAN', 17.5, N'ĐH Văn Lang'),

-- Xây Dựng
(N'XD001', N'BKH', N'Xây Dựng', N'TOAN', 22.5, N'ĐH Bách Khoa'),
(N'XD002', N'KT-CN', N'Xây Dựng', N'TOAN', 20, N'ĐH Kỹ Thuật - Công Nghệ'),

-- Công Nghệ Thực Phẩm
(N'CNTP001', N'CNTP', N'Công Nghệ Thực Phẩm', N'HOA', 17, N'ĐH Công Nghiệp Thực Phẩm'),

-- Giao Thông Vận Tải
(N'GTVT001', N'CDGTVT', N'Giao Thông Vận Tải Đường Bộ', N'TOAN', 15, N'Cao Đặng Giao Thông Vận Tải'),

-- Quốc Tế
(N'QT001', N'HB', N'Quản Lý Kinh Doanh Quốc Tế', N'ANH', 16, N'ĐH Quốc Tế Hồng Bàng'),

-- Hàng Hải
(N'HH001', N'CDGTVT', N'Hàng Hải', N'TOAN', 14.5, N'Cao Đặng Giao Thông Vận Tải');
GO

SELECT 'Step 1: Dữ liệu NGANH đã insert' AS [Status], COUNT(*) AS [Count] FROM nganh;
GO

-- ===== THÊM DỮ LIỆU THISINH =====
INSERT INTO ThiSinh 
(SBD, HoTen, NgaySinh, QueQuan, Truong, TinhThanh, NamThi, DiaDiemThi, SDT)
VALUES
(N'TS001', N'Nguyễn Mạnh Tiến', N'2006-03-16', N'Bình Định', N'THPT Hùng Vương', N'Bình Định', 2024, N'Điểm thi 1', N'0911111111'),
(N'TS002', N'Võ Văn Minh Vương', N'2006-02-15', N'Vĩnh Long', N'THPT Trung Vương', N'Vĩnh Long', 2024, N'Điểm thi 2', N'0922222222'),
(N'TS003', N'Lê Tuấn Nhã', N'2006-12-03', N'Bến Tre', N'THPT Trương Vĩnh Ký', N'Bến Tre', 2024, N'Điểm thi 3', N'0933333333'),
(N'TS004', N'Phạm Vũ Quảng', N'2006-01-04', N'Quảng Bình', N'THPT Trị An', N'Quảng Bình', 2024, N'Điểm thi 4', N'0944444444'),
(N'TS005', N'Nguyễn Văn A', N'2006-04-30', N'Trà Vinh', N'THPT Long Hữu', N'Cần Thơ', 2024, N'Điểm thi 5', N'0955555555'),
(N'TS006', N'Nguyễn Thành Công', N'2008-01-12', N'Đống Đa', N'THPT Kim Liên', N'Hà Nội', 2025, N'ĐH Kinh Tế Quốc Dân', N'0911222333'),
(N'TS007', N'Lê Thị Hồng', N'2008-05-22', N'Tân Bình', N'THPT Nguyễn Thượng Hiền', N'TP Hồ Chí Minh', 2025, N'ĐH Sư Phạm TP.HCM', N'0922333444'),
(N'TS008', N'Trần Quốc Việt', N'2008-08-09', N'Sơn Trà', N'THPT Hoàng Hoa Thám', N'Đà Nẵng', 2025, N'ĐH Bách Khoa Đà Nẵng', N'0933444555'),
(N'TS009', N'Phạm Gia Bảo', N'2008-03-30', N'Ninh Kiều', N'THPT Châu Văn Liêm', N'Cần Thơ', 2025, N'ĐH Cần Thơ', N'0944555666'),
(N'TS0010', N'Đỗ Khánh Linh', N'2008-11-17', N'Hồng Bàng', N'THPT Thái Phiên', N'Hải Phòng', 2025, N'ĐH Hàng Hải', N'0955666777'),
(N'TS0011', N'Nguyễn Hoài Nam', N'2008-02-18', N'Biên Hòa', N'THPT Ngô Quyền', N'Đồng Nai', 2025, N'ĐH Đồng Nai', N'0961112233'),
(N'TS0012', N'Trần Minh Khoa', N'2008-07-25', N'Tam Kỳ', N'THPT Chuyên Nguyễn Bỉnh Khiêm', N'Quảng Nam', 2025, N'ĐH Quảng Nam', N'0972223344'),
(N'TS0013', N'Lê Thu Trang', N'2008-09-14', N'Pleiku', N'THPT Pleiku', N'Gia Lai', 2025, N'ĐH Nông Lâm TP.HCM', N'0983334455'),
(N'TS0014', N'Phạm Nhật Huy', N'2008-12-05', N'Long Xuyên', N'THPT Chuyên Thoại Ngọc Hầu', N'An Giang', 2025, N'ĐH An Giang', N'0994445566'),
(N'TS0015', N'Võ Ngọc Ánh', N'2008-04-21', N'Rạch Giá', N'THPT Nguyễn Trung Trực', N'Kiên Giang', 2025, N'ĐH Kiên Giang', N'0905556677'),
(N'TS0016', N'Bùi Đức Anh', N'2008-06-11', N'Nam Định', N'THPT Trần Hưng Đạo', N'Nam Định', 2025, N'ĐH Điều Dưỡng Nam Định', N'0916667788'),
(N'TS0017', N'Đặng Thị Mai', N'2008-10-28', N'Việt Trì', N'THPT Việt Trì', N'Phú Thọ', 2025, N'Học Viện Nông Nghiệp', N'0927778899'),
(N'TS0018', N'Ngô Quang Huy', N'2008-03-07', N'Hạ Long', N'THPT Hòn Gai', N'Quảng Ninh', 2025, N'ĐH Hạ Long', N'0938889900'),
(N'TS0020', N'Hoàng Minh Tú', N'2008-08-19', N'Buôn Ma Thuót', N'THPT Chuyên Nguyễn Du', N'Đắk Lắk', 2025, N'ĐH Tây Nguyên', N'0949990011'),
(N'TS0021', N'Phan Thảo Vy', N'2008-01-29', N'Bảo Lộc', N'THPT Bảo Lộc', N'Lâm Đồng', 2025, N'ĐH Đà Lạt', N'0950001122');
GO

SELECT 'Step 2: Dữ liệu THISINH đã insert' AS [Status], COUNT(*) AS [Count] FROM thisinh;
GO

-- ===== THÊM DỮ LIỆU TAIKHOAN =====
INSERT INTO taikhoan (username, password, SBD)
VALUES
(N'admin', N'123', NULL),
(N'tien01', N'123456', N'TS001'),
(N'vuong02', N'123456', N'TS002'),
(N'nha03', N'123456', N'TS003'),
(N'quang04', N'123456', N'TS004'),
(N'hoang05', N'123456', N'TS005'),
(N'thanhcong06', N'123456', N'TS006'),
(N'thihong07', N'123456', N'TS007'),
(N'quocviet08', N'123456', N'TS008'),
(N'giabao9', N'123456', N'TS009'),
(N'khanhlinh10', N'123456', N'TS0010'),
(N'hoainam11', N'123456', N'TS0011'),
(N'minhkhoa12', N'123456', N'TS0012'),
(N'thutrang13', N'123456', N'TS0013'),
(N'nhathuy14', N'123456', N'TS0014'),
(N'ngocanh15', N'123456', N'TS0015'),
(N'ducanh16', N'123456', N'TS0016'),
(N'thimai17', N'123456', N'TS0017'),
(N'quanghuy18', N'123456', N'TS0018'),
(N'minhtu19', N'123456', N'TS0020'),
(N'thaovy20', N'123456', N'TS0021');
GO

SELECT 'Step 3: Dữ liệu TAIKHOAN đã insert' AS [Status], COUNT(*) AS [Count] FROM taikhoan;
GO

-- ===== THÊM DỮ LIỆU DIEMTHI =====
INSERT INTO diemthi (SBD, MaMon, DiemThi, DiemSauPhucKhao)
VALUES
-- TS001
(N'TS001', N'TOAN', 7.5, NULL),
(N'TS001', N'VAN', 8.0, NULL),
(N'TS001', N'ANH', 7.8, NULL),
(N'TS001', N'LY', 7.2, NULL),
(N'TS001', N'HOA', 7.6, NULL),
(N'TS001', N'SINH', 7.4, NULL),
-- TS002
(N'TS002', N'TOAN', 8.5, NULL),
(N'TS002', N'VAN', 8.2, NULL),
(N'TS002', N'ANH', 8.7, NULL),
(N'TS002', N'SU', 8.1, NULL),
(N'TS002', N'DIA', 8.4, NULL),
(N'TS002', N'GDCD', 8.6, NULL),
-- TS003
(N'TS003', N'TOAN', 7.0, NULL),
(N'TS003', N'VAN', 7.3, NULL),
(N'TS003', N'ANH', 7.5, NULL),
(N'TS003', N'LY', 7.1, NULL),
(N'TS003', N'HOA', 7.2, NULL),
(N'TS003', N'SINH', 7.4, NULL),
-- TS004
(N'TS004', N'TOAN', 6.8, NULL),
(N'TS004', N'VAN', 7.0, NULL),
(N'TS004', N'ANH', 6.9, NULL),
(N'TS004', N'LY', 6.7, NULL),
(N'TS004', N'HOA', 6.8, NULL),
(N'TS004', N'SINH', 7.1, NULL),
-- TS005
(N'TS005', N'TOAN', 7.2, NULL),
(N'TS005', N'VAN', 7.5, NULL),
(N'TS005', N'ANH', 7.1, NULL),
(N'TS005', N'LY', 7.0, NULL),
(N'TS005', N'HOA', 7.3, NULL),
(N'TS005', N'SINH', 7.2, NULL),
-- TS006
(N'TS006', N'TOAN', 8.4, NULL),
(N'TS006', N'VAN', 7.2, NULL),
(N'TS006', N'ANH', 8.1, NULL),
(N'TS006', N'LY', 7.8, NULL),
(N'TS006', N'HOA', 8.0, NULL),
(N'TS006', N'SINH', 7.5, NULL),
-- TS007
(N'TS007', N'TOAN', 8.9, NULL),
(N'TS007', N'VAN', 8.5, NULL),
(N'TS007', N'ANH', 9.1, NULL),
(N'TS007', N'SU', 8.4, NULL),
(N'TS007', N'DIA', 8.7, NULL),
(N'TS007', N'GDCD', 9.0, NULL),
-- TS008
(N'TS008', N'TOAN', 7.5, NULL),
(N'TS008', N'VAN', 7.8, NULL),
(N'TS008', N'ANH', 8.7, NULL),
(N'TS008', N'LY', 8.0, NULL),
(N'TS008', N'HOA', 7.6, NULL),
(N'TS008', N'SINH', 7.9, NULL),
-- TS009
(N'TS009', N'TOAN', 7.2, NULL),
(N'TS009', N'VAN', 9.0, NULL),
(N'TS009', N'ANH', 7.5, NULL),
(N'TS009', N'SU', 8.6, NULL),
(N'TS009', N'DIA', 8.2, NULL),
(N'TS009', N'GDCD', 8.8, NULL),
-- TS0010
(N'TS0010', N'TOAN', 7.2, NULL),
(N'TS0010', N'VAN', 6.9, NULL),
(N'TS0010', N'ANH', 7.1, NULL),
(N'TS0010', N'LY', 7.0, NULL),
(N'TS0010', N'HOA', 7.8, NULL),
(N'TS0010', N'SINH', 7.3, NULL),
-- TS0011
(N'TS0011', N'TOAN', 8.1, NULL),
(N'TS0011', N'VAN', 7.0, NULL),
(N'TS0011', N'ANH', 7.4, NULL),
(N'TS0011', N'HOA', 8.4, NULL),
(N'TS0011', N'SINH', 8.0, NULL),
(N'TS0011', N'LY', 7.8, NULL),
-- TS0012
(N'TS0012', N'TOAN', 8.3, NULL),
(N'TS0012', N'VAN', 7.9, NULL),
(N'TS0012', N'ANH', 8.8, NULL),
(N'TS0012', N'SU', 7.5, NULL),
(N'TS0012', N'DIA', 7.8, NULL),
(N'TS0012', N'GDCD', 8.1, NULL),
-- TS0013
(N'TS0013', N'TOAN', 9.2, NULL),
(N'TS0013', N'VAN', 8.7, NULL),
(N'TS0013', N'ANH', 9.0, NULL),
(N'TS0013', N'LY', 8.8, NULL),
(N'TS0013', N'HOA', 8.5, NULL),
(N'TS0013', N'SINH', 8.9, NULL),
-- TS0014
(N'TS0014', N'TOAN', 7.6, NULL),
(N'TS0014', N'VAN', 8.0, NULL),
(N'TS0014', N'ANH', 7.2, NULL),
(N'TS0014', N'SU', 7.8, NULL),
(N'TS0014', N'DIA', 8.1, NULL),
(N'TS0014', N'GDCD', 8.3, NULL),
-- TS0015
(N'TS0015', N'TOAN', 7.1, NULL),
(N'TS0015', N'VAN', 8.5, NULL),
(N'TS0015', N'ANH', 7.0, NULL),
(N'TS0015', N'SU', 8.9, NULL),
(N'TS0015', N'DIA', 8.4, NULL),
(N'TS0015', N'GDCD', 8.7, NULL),
-- TS0016
(N'TS0016', N'TOAN', 7.9, NULL),
(N'TS0016', N'VAN', 7.3, NULL),
(N'TS0016', N'ANH', 7.1, NULL),
(N'TS0016', N'HOA', 8.2, NULL),
(N'TS0016', N'SINH', 7.7, NULL),
(N'TS0016', N'LY', 7.8, NULL),
-- TS0017
(N'TS0017', N'TOAN', 8.8, NULL),
(N'TS0017', N'VAN', 9.1, NULL),
(N'TS0017', N'ANH', 8.9, NULL),
(N'TS0017', N'SU', 8.5, NULL),
(N'TS0017', N'DIA', 8.6, NULL),
(N'TS0017', N'GDCD', 9.0, NULL),
-- TS0018
(N'TS0018', N'TOAN', 7.7, NULL),
(N'TS0018', N'VAN', 7.4, NULL),
(N'TS0018', N'ANH', 8.5, NULL),
(N'TS0018', N'LY', 8.0, NULL),
(N'TS0018', N'HOA', 7.9, NULL),
(N'TS0018', N'SINH', 7.6, NULL),
-- TS0020
(N'TS0020', N'TOAN', 8.0, NULL),
(N'TS0020', N'VAN', 7.1, NULL),
(N'TS0020', N'ANH', 7.8, NULL),
(N'TS0020', N'LY', 7.5, NULL),
(N'TS0020', N'HOA', 7.9, NULL),
(N'TS0020', N'SINH', 7.7, NULL),
-- TS0021
(N'TS0021', N'TOAN', 7.4, NULL),
(N'TS0021', N'VAN', 9.1, NULL),
(N'TS0021', N'ANH', 8.0, NULL),
(N'TS0021', N'SU', 8.8, NULL),
(N'TS0021', N'DIA', 8.7, NULL),
(N'TS0021', N'GDCD', 9.0, NULL);
GO

-- ===== KIỂM TRA TỔNG HỢP DỮ LIỆU =====
SELECT '=== TỔNG HỢP DỮ LIỆU ===' AS [Status];
SELECT N'monthi' AS [Table], COUNT(*) AS [Count] FROM monthi
UNION ALL
SELECT N'truongdaihoc', COUNT(*) FROM truongdaihoc
UNION ALL
SELECT N'nganh', COUNT(*) FROM nganh
UNION ALL
SELECT N'thisinh', COUNT(*) FROM thisinh
UNION ALL
SELECT N'taikhoan', COUNT(*) FROM taikhoan
UNION ALL
SELECT N'diemthi', COUNT(*) FROM diemthi
ORDER BY [Table];
GO
