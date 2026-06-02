-- ===== FILE GHI LẠI CÁC CẬP NHẬT TỪ HỆ THỐNG =====
-- Mỗi lần user cập nhật thông tin, câu lệnh SQL sẽ được ghi lại vào đây
-- Format: -- Comment với timestamp
--         Câu lệnh SQL
--         GO

-- Bắt đầu ghi logs từ:
-- Cập nhật 2026-06-03T00:00:00.000Z - Hệ thống khởi tạo file
-- (Các cập nhật sẽ được thêm vào dưới)

-- Cập nhật 2026-06-02T17:39:33.569Z SBD=TS004
UPDATE thisinh SET hoten=N'Phạm Vũ Quảng', ngaysinh=N'2006-01-04', CCCD=N'075209060209', sdt=N'0376784444', quequan=N'75', huyenCode=N'735', xaCode=N'26170', gender=N'Nam', priorityCode=N'khongco', diachi=N'Tổ 7, Khu Phố 3', namthi=2025, diadiemthi=N'THPT Trị An' WHERE SBD=N'TS004'
GO

-- Thêm nguyện vọng 2026-06-02T17:53:27.931Z SBD=TS001
INSERT INTO nguyenvong (SBD, manganh, Thutu) VALUES (N'TS001', N'KTDE001', 1)
GO

-- Thêm nguyện vọng 2026-06-02T17:53:42.788Z SBD=TS001
INSERT INTO nguyenvong (SBD, manganh, Thutu) VALUES (N'TS001', N'CNTT002', 2)
GO

-- Thêm nguyện vọng 2026-06-02T17:55:36.463Z SBD=TS001
INSERT INTO nguyenvong (SBD, manganh, Thutu) VALUES (N'TS001', N'KT002', 1)
GO

-- Cập nhật 2026-06-02T17:59:41.659Z SBD=TS001
UPDATE thisinh SET hoten=N'Nguyễn Mạnh Tiến', ngaysinh=N'2006-03-16', CCCD=N'075782698358', sdt=N'0912619362', quequan=N'52', huyenCode=N'540', xaCode=N'21559', gender=N'Nam', priorityCode=N'khongco', diachi=N'Tổ 7, Khu Phố 3', namthi=2025, diadiemthi=N'THPT Hùng Vương' WHERE SBD=N'TS001'
GO

