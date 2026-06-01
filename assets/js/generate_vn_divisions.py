import json

provinces = [
    {"code": "01", "name": "Thành ph? Hà N?i", "type": "Thành ph? Trung uong", "district_count": 30},
    {"code": "79", "name": "Thành ph? H? Chí Minh", "type": "Thành ph? Trung uong", "district_count": 22},
    {"code": "31", "name": "Thành ph? H?i Phòng", "type": "Thành ph? Trung uong", "district_count": 15},
    {"code": "48", "name": "Thành ph? Ðà N?ng", "type": "Thành ph? Trung uong", "district_count": 8},
    {"code": "92", "name": "Thành ph? C?n Tho", "type": "Thành ph? Trung uong", "district_count": 9},
    {"code": "02", "name": "T?nh Hà Giang", "type": "T?nh", "district_count": 11},
    {"code": "04", "name": "T?nh Cao B?ng", "type": "T?nh", "district_count": 10},
    {"code": "06", "name": "T?nh B?c K?n", "type": "T?nh", "district_count": 8},
    {"code": "08", "name": "T?nh Tuyên Quang", "type": "T?nh", "district_count": 7},
    {"code": "10", "name": "T?nh Lào Cai", "type": "T?nh", "district_count": 9},
    {"code": "11", "name": "T?nh Ði?n Biên", "type": "T?nh", "district_count": 10},
    {"code": "12", "name": "T?nh Lai Châu", "type": "T?nh", "district_count": 8},
    {"code": "14", "name": "T?nh Son La", "type": "T?nh", "district_count": 12},
    {"code": "15", "name": "T?nh Yên Bái", "type": "T?nh", "district_count": 9},
    {"code": "17", "name": "T?nh Hoà Bình", "type": "T?nh", "district_count": 10},
    {"code": "19", "name": "T?nh Thái Nguyên", "type": "T?nh", "district_count": 9},
    {"code": "20", "name": "T?nh L?ng Son", "type": "T?nh", "district_count": 11},
    {"code": "22", "name": "T?nh Qu?ng Ninh", "type": "T?nh", "district_count": 13},
    {"code": "24", "name": "T?nh B?c Giang", "type": "T?nh", "district_count": 10},
    {"code": "25", "name": "T?nh Phú Th?", "type": "T?nh", "district_count": 13},
    {"code": "26", "name": "T?nh Vinh Phúc", "type": "T?nh", "district_count": 9},
    {"code": "27", "name": "T?nh B?c Ninh", "type": "T?nh", "district_count": 8},
    {"code": "30", "name": "T?nh H?i Duong", "type": "T?nh", "district_count": 12},
    {"code": "33", "name": "T?nh Hung Yên", "type": "T?nh", "district_count": 10},
    {"code": "34", "name": "T?nh Thái Bình", "type": "T?nh", "district_count": 8},
    {"code": "35", "name": "T?nh Hà Nam", "type": "T?nh", "district_count": 6},
    {"code": "36", "name": "T?nh Nam Ð?nh", "type": "T?nh", "district_count": 10},
    {"code": "37", "name": "T?nh Ninh Bình", "type": "T?nh", "district_count": 8},
    {"code": "38", "name": "T?nh Thanh Hóa", "type": "T?nh", "district_count": 27},
    {"code": "40", "name": "T?nh Ngh? An", "type": "T?nh", "district_count": 21},
    {"code": "42", "name": "T?nh Hà Tinh", "type": "T?nh", "district_count": 13},
    {"code": "44", "name": "T?nh Qu?ng Bình", "type": "T?nh", "district_count": 8},
    {"code": "45", "name": "T?nh Qu?ng Tr?", "type": "T?nh", "district_count": 10},
    {"code": "46", "name": "T?nh Th?a Thiên Hu?", "type": "T?nh", "district_count": 9},
    {"code": "49", "name": "T?nh Qu?ng Nam", "type": "T?nh", "district_count": 18},
    {"code": "51", "name": "T?nh Qu?ng Ngãi", "type": "T?nh", "district_count": 13},
    {"code": "52", "name": "T?nh Bình Ð?nh", "type": "T?nh", "district_count": 11},
    {"code": "54", "name": "T?nh Phú Yên", "type": "T?nh", "district_count": 9},
    {"code": "56", "name": "T?nh Khánh Hòa", "type": "T?nh", "district_count": 9},
    {"code": "58", "name": "T?nh Ninh Thu?n", "type": "T?nh", "district_count": 7},
    {"code": "60", "name": "T?nh Bình Thu?n", "type": "T?nh", "district_count": 10},
    {"code": "62", "name": "T?nh Kon Tum", "type": "T?nh", "district_count": 10},
    {"code": "64", "name": "T?nh Gia Lai", "type": "T?nh", "district_count": 17},
    {"code": "66", "name": "T?nh Ð?k L?k", "type": "T?nh", "district_count": 15},
    {"code": "67", "name": "T?nh Ð?k Nông", "type": "T?nh", "district_count": 8},
    {"code": "68", "name": "T?nh Lâm Ð?ng", "type": "T?nh", "district_count": 12},
    {"code": "70", "name": "T?nh Bình Phu?c", "type": "T?nh", "district_count": 11},
    {"code": "72", "name": "T?nh Tây Ninh", "type": "T?nh", "district_count": 9},
    {"code": "74", "name": "T?nh Bình Duong", "type": "T?nh", "district_count": 9},
    {"code": "75", "name": "T?nh Ð?ng Nai", "type": "T?nh", "district_count": 11},
    {"code": "77", "name": "T?nh Bà R?a - Vung Tàu", "type": "T?nh", "district_count": 8},
    {"code": "80", "name": "T?nh Long An", "type": "T?nh", "district_count": 15},
    {"code": "82", "name": "T?nh Ti?n Giang", "type": "T?nh", "district_count": 11},
    {"code": "83", "name": "T?nh B?n Tre", "type": "T?nh", "district_count": 9},
    {"code": "84", "name": "T?nh Trà Vinh", "type": "T?nh", "district_count": 9},
    {"code": "86", "name": "T?nh Vinh Long", "type": "T?nh", "district_count": 8},
    {"code": "87", "name": "T?nh Ð?ng Tháp", "type": "T?nh", "district_count": 12},
    {"code": "89", "name": "T?nh An Giang", "type": "T?nh", "district_count": 11},
    {"code": "91", "name": "T?nh Kiên Giang", "type": "T?nh", "district_count": 15},
    {"code": "93", "name": "T?nh H?u Giang", "type": "T?nh", "district_count": 8},
    {"code": "94", "name": "T?nh Sóc Trang", "type": "T?nh", "district_count": 11},
    {"code": "95", "name": "T?nh B?c Liêu", "type": "T?nh", "district_count": 7},
    {"code": "96", "name": "T?nh Cà Mau", "type": "T?nh", "district_count": 9}
]

def generate_districts(province):
    districts = []
    p_name = province["name"].replace("T?nh ", "").replace("Thành ph? ", "")
    is_city = "Thành ph?" in province["type"]
    
    for i in range(1, province["district_count"] + 1):
        d_code = f"{province['code']}{i:02d}"
        if is_city:
            if i <= province["district_count"] // 2:
                d_name = f"Qu?n {i}" if i > 5 else ["Ba Ðình", "Hoàn Ki?m", "Tây H?", "Long Biên", "C?u Gi?y"][i-1] if p_name == "Hà N?i" else f"Qu?n {i}"
                if p_name == "H? Chí Minh" and i <= 5:
                    d_name = ["Qu?n 1", "Qu?n 3", "Qu?n 4", "Qu?n 5", "Qu?n 6"][i-1]
            else:
                d_name = f"Huy?n {p_name} {i}"
        else:
            if i == 1:
                d_name = f"Thành ph? {p_name}"
            elif i == 2:
                d_name = f"Th? xã {p_name} 2"
            else:
                d_name = f"Huy?n {p_name} {i}"
        
        communes = []
        if i <= 3: # Sample communes for first 3 districts
            for j in range(1, 4):
                c_type = "Phu?ng" if "Qu?n" in d_name or "Thành ph?" in d_name else "Xã"
                communes.append({"code": f"{d_code}{j:02d}", "name": f"{c_type} {j}"})
        
        districts.append({
            "code": d_code,
            "name": d_name,
            "communes": communes
        })
    return districts

full_data = []
for p in provinces:
    full_data.append({
        "code": p["code"],
        "name": p["name"],
        "districts": generate_districts(p)
    })

js_content = "const vietnameseAdminDivisions = " + json.dumps(full_data, ensure_ascii=False, indent=2) + ";"
with open("vietnamese-admin-divisions.js", "w", encoding="utf-8") as f:
    f.write(js_content)
