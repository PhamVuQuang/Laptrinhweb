USE tracuudiemthidh;
GO
IF OBJECT_ID('dbo.taikhoan','U') IS NULL
BEGIN
CREATE TABLE dbo.taikhoan (
username NVARCHAR(50) NOT NULL PRIMARY KEY,
password NVARCHAR(100) NOT NULL
);
END
GO
IF EXISTS (SELECT 1 FROM dbo.taikhoan WHERE LTRIM(RTRIM(username)) = N'admin')
UPDATE dbo.taikhoan SET password = N'123' WHERE LTRIM(RTRIM(username)) = N'admin';
ELSE
INSERT INTO dbo.taikhoan(username, password) VALUES (N'admin', N'123');
GO
SELECT username, password FROM dbo.taikhoan WHERE LTRIM(RTRIM(username)) = N'admin';