# PowerShell script to properly import data into SQL Server with correct encoding

$Server = "localhost"
$Database = "tracuudiemthi"

# Drop and recreate database
Write-Host "Dropping old database..."
sqlcmd -S $Server -Q "IF EXISTS (SELECT * FROM sys.databases WHERE name = '$Database') BEGIN ALTER DATABASE $Database SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE $Database; END"

Write-Host "Creating database..."
sqlcmd -S $Server -Q "CREATE DATABASE $Database"

# Create tables
Write-Host "Creating tables..."
$createTableSQL = @"
USE $Database;

CREATE TABLE dbo.monthi (
    mamon NVARCHAR(50) NOT NULL PRIMARY KEY,
    tenmon NVARCHAR(100) NOT NULL
);

CREATE TABLE dbo.truongdaihoc (
    matruong NVARCHAR(50) NOT NULL PRIMARY KEY,
    tentruong NVARCHAR(255) NOT NULL,
    diem_san FLOAT
);

CREATE TABLE dbo.nganh (
    manganh NVARCHAR(50) NOT NULL PRIMARY KEY,
    tennganh NVARCHAR(255) NOT NULL,
    matruong NVARCHAR(50) NOT NULL,
    FOREIGN KEY (matruong) REFERENCES dbo.truongdaihoc(matruong)
);

CREATE TABLE dbo.thisinh (
    sbd NVARCHAR(50) NOT NULL PRIMARY KEY,
    hoten NVARCHAR(255) NOT NULL,
    email NVARCHAR(255),
    sdt NVARCHAR(20),
    diachi NVARCHAR(255)
);

CREATE TABLE dbo.taikhoan (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sbd NVARCHAR(50) NOT NULL UNIQUE,
    matkhau NVARCHAR(255) NOT NULL,
    vaitro NVARCHAR(50),
    FOREIGN KEY (sbd) REFERENCES dbo.thisinh(sbd)
);

CREATE TABLE dbo.diemthi (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sbd NVARCHAR(50) NOT NULL,
    mamon NVARCHAR(50) NOT NULL,
    diem FLOAT,
    FOREIGN KEY (sbd) REFERENCES dbo.thisinh(sbd),
    FOREIGN KEY (mamon) REFERENCES dbo.monthi(mamon)
);

CREATE TABLE dbo.nguyenvong (
    id INT IDENTITY(1,1) PRIMARY KEY,
    sbd NVARCHAR(50) NOT NULL,
    manganh NVARCHAR(50) NOT NULL,
    thutu INT,
    trangthai NVARCHAR(50),
    FOREIGN KEY (sbd) REFERENCES dbo.thisinh(sbd),
    FOREIGN KEY (manganh) REFERENCES dbo.nganh(manganh)
);
"@

sqlcmd -S $Server -Q $createTableSQL

# Insert monthi data
Write-Host "Inserting monthi data..."
$monthi = @(
    ('TOAN', 'Toán'),
    ('VAN', 'Văn'),
    ('ANH', 'Tiếng Anh'),
    ('LY', 'Vật Lý'),
    ('HOA', 'Hóa Học'),
    ('SINH', 'Sinh Học'),
    ('SU', 'Sử'),
    ('DIA', 'Địa'),
    ('GDCD', 'GDCD')
)

foreach ($item in $monthi) {
    $mamon = $item[0]
    $tenmon = $item[1]
    sqlcmd -S $Server -d $Database -Q "INSERT INTO dbo.monthi (mamon, tenmon) VALUES (N'$mamon', N'$tenmon')"
}

# Insert truongdaihoc data
Write-Host "Inserting universities..."
$truong = @(
    ('BKH', 'ĐH Bách Khoa', 22),
    ('CDCT', 'Cao Đặng Công Thương', 13.5),
    ('CDE', 'Cao Đặng Kinh Tế Đối Ngoại', 14.5),
    ('CDGTVT', 'Cao Đặng Giao Thông Vận Tải', 14),
    ('CDTD', 'Cao Đặng Công Nghệ Thực Phẩm', 13.5),
    ('CN', 'ĐH Công Nghiệp', 17.8),
    ('CNTP', 'ĐH Công Nghiệp Thực Phẩm', 16),
    ('CNTT', 'ĐH Công Nghệ Thông Tin', 23.5),
    ('CTU', 'ĐH Cần Thơ', 18),
    ('DHD', 'ĐH Đà Lạt', 18),
    ('FPT', 'ĐH FPT', 19),
    ('HB', 'ĐH Quốc Tế Hàng Bàng', 15),
    ('HSU', 'ĐH Hoa Sen', 17),
    ('HUTECH', 'ĐH Công Nghệ TP.HCM (HUTECH)', 17),
    ('IUH', 'ĐH Công Nghiệp TP.HCM', 17),
    ('KHTN', 'ĐH Khoa Học Tự Nhiên', 19),
    ('KHXH', 'ĐH KHXH & Nhân Văn', 20.5),
    ('KT', 'ĐH Kinh Tế', 22.5),
    ('KT-CN', 'ĐH Kỹ Thuật - Công Nghệ', 16),
    ('KTL', 'ĐH Kinh Tế - Luật', 21.5),
    ('KTTRUC', 'ĐH Kiến Trúc', 19),
    ('LUAT', 'ĐH Luật', 23),
    ('MO', 'ĐH Mỏ', 17.5),
    ('NL', 'ĐH Nông Lâm', 17),
    ('NTT', 'ĐH Nguyễn Tất Thành', 15),
    ('SP', 'ĐH Sư Phạm', 19.5),
    ('SPKT', 'ĐH Sư Phạm Kỹ Thuật', 21),
    ('TDTT', 'ĐH Tây Nguyên', 18.5),
    ('TNMT', 'ĐH Tài Nguyên & Môi Trường', 18.5),
    ('UEF', 'ĐH Kinh Tế - Tài Chính (UEF)', 18),
    ('VLU', 'ĐH Văn Lang', 18)
)

foreach ($item in $truong) {
    $matruong = $item[0]
    $tentruong = $item[1]
    $diem_san = $item[2]
    $escapedName = $tentruong -replace "'", "''"
    sqlcmd -S $Server -d $Database -Q "INSERT INTO dbo.truongdaihoc (matruong, tentruong, diem_san) VALUES (N'$matruong', N'$escapedName', $diem_san)"
}

Write-Host "Import completed!"
