// kiểm tra login
function checkLoginStatus(){
    const userMenu = document.getElementById("userMenu");
    if(!userMenu) return; // trang không có menu thì bỏ qua
    const isLogin = localStorage.getItem("isLogin");
    if(isLogin === "true"){
        userMenu.onclick = () =>
            location.href="/assets/html/user.html";
    }else{
        userMenu.onclick = () =>
            location.href="/assets/html/login.html";
    }
}
// login 
async function dangNhap(){
    const usernameEl = document.getElementById("username");
    const passwordEl = document.getElementById("password");
    const captchaInputEl = document.getElementById("captchaInput");
    if(!usernameEl || !passwordEl) return;

    const username = usernameEl.value.trim();
    const password = passwordEl.value.trim();
    const captchaInput = captchaInputEl ? captchaInputEl.value.trim().toUpperCase() : "";

    if(!username || !password){
        alert("Vui lòng nhập tên tài khoản và mật khẩu!");
        return;
    }

    if(captchaInputEl && captchaInput !== currentCaptcha){
        alert("Captcha không đúng!");
        generateCaptcha();
        captchaInputEl.value = "";
        return;
    }

    try {
        const res = await fetch("/login", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ username, password })
        });

        let data = {};
        try {
            data = await res.json();
        } catch (_) {
            data = {};
        }

        if(res.ok){
            localStorage.setItem("isLogin","true");
            localStorage.setItem("userName", data.hoten || username);
            localStorage.setItem("sbd", data.sbd || "");
            alert("Đăng nhập thành công!");
            location.href="/index.html";
        } else {
            alert(data.message || "Đăng nhập thất bại!");
        }
    } catch (err) {
        alert("Không kết nối được server. Vui lòng kiểm tra lại server Node.");
    }
}
//captcha
let currentCaptcha = "";
function generateCaptcha(){
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    currentCaptcha = "";
    for(let i=0;i<5;i++){
        currentCaptcha += chars[Math.floor(Math.random()*chars.length)];
    }
    const captchaBox = document.getElementById("captcha");
    if(captchaBox) captchaBox.innerText = currentCaptcha;
}
// login bang sbd
function dangNhapSBD(){
    const sbdInput = document.getElementById("sbd");
    const cccdInput = document.getElementById("cccd");
    const captchaInputEl = document.getElementById("captchaInput");
    // nếu trang không có input thì thoát (tránh lỗi trang khác)
    if(!sbdInput || !cccdInput) return;
    const sbd = sbdInput.value.trim();
    const cccd = cccdInput.value.trim();
    const captchaInput = captchaInputEl ? captchaInputEl.value.trim().toUpperCase() : "";

    if(captchaInputEl && captchaInput !== currentCaptcha){
        alert("Captcha không đúng!");
        generateCaptcha();
        captchaInputEl.value = "";
        return;
    }

    if(sbd !== "" && cccd !== ""){
        localStorage.setItem("isLogin","true");
        localStorage.setItem("userName","Thi sinh");
        localStorage.setItem("sbd",sbd);
        addNotification("Dang nhap bang so bao danh thanh cong: " + sbd + ".");
        alert("Đăng nhập thành công!");
        window.location.href = "/index.html";
    }
    else{
        alert("Vui lòng nhập đầy đủ Số Báo Danh và CCCD!");
    }
}

async function quenMatKhau(){
    const usernameEl = document.getElementById("fp_username");
    const sbdEl = document.getElementById("fp_sbd");
    const cccdEl = document.getElementById("fp_cccd");
    const newPasswordEl = document.getElementById("fp_new_password");
    const confirmPasswordEl = document.getElementById("fp_confirm_password");

    if(!usernameEl || !sbdEl || !cccdEl || !newPasswordEl || !confirmPasswordEl) return;

    const username = usernameEl.value.trim();
    const sbd = sbdEl.value.trim();
    const cccd = cccdEl.value.trim();
    const newPassword = newPasswordEl.value.trim();
    const confirmPassword = confirmPasswordEl.value.trim();

    if(!username || !sbd || !cccd || !newPassword || !confirmPassword){
        alert("Vui lòng nhập đầy đủ thông tin!");
        return;
    }

    if(newPassword !== confirmPassword){
        alert("Mật khẩu xác nhận không khớp!");
        return;
    }

    try {
        const res = await fetch("/forgot-password", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, sbd, cccd, newPassword })
        });

        let data = {};
        try {
            data = await res.json();
        } catch (_) {
            data = {};
        }

        if(res.ok){
            alert("Đổi mật khẩu thành công! Vui lòng đăng nhập lại.");
            location.href = "/assets/html/login.html";
        } else {
            alert(data.message || "Không thể đổi mật khẩu.");
        }
    } catch (err) {
        alert("Không kết nối được server. Vui lòng kiểm tra lại server Node.");
    }
}
//logout
function logout(){
    localStorage.removeItem("isLogin");
    localStorage.removeItem("userName");
    localStorage.removeItem("sbd");
    location.href="/assets/html/login.html";
}
//CHẶN TRANG LOGIN KHI ĐÃ LOGIN
function blockLoginPage(){
    if(localStorage.getItem("isLogin")==="true"){
        location.href="/index.html";
    }
}
// BẢO VỆ TRANG (PHẢI LOGIN) 
function requireLogin(){
    if(localStorage.getItem("isLogin")!=="true"){
        alert("Vui lòng đăng nhập!");
        location.href="/assets/html/login.html";
    }
}
//CHẠY SAU KHI HTML LOAD 
document.addEventListener("DOMContentLoaded", function(){
    checkLoginStatus();
    const logo = document.getElementById("logo");
    if(logo){
        logo.onclick = function() {
            window.location.href = "../../index.html";
        };
    }

    updatePaymentSummary();
    if(soNV === 0 && localStorage.getItem("sbd")){
        syncNguyenVongFromServer();
    }
});
document.addEventListener("DOMContentLoaded", function(){
    if(document.getElementById("captcha")){
        generateCaptcha();
    }
});
// lấy tất cả menu
var menus = document.querySelectorAll('.navbar__page');
menus.forEach(function(menu) {
    menu.addEventListener('click', function () {
        var name = this.innerText.trim();
        if (name === "Trang Chủ") {
            window.location.href = "../../index.html";
        }
         if (name === "Tra Cứu Điểm Thi") {
            window.location.href = "/assets/html/tracuudiemthi.html";
        }
        if (name === "Tra Cứu Nguyện Vọng") {
            window.location.href = "/assets/html/tracuunguyenvong.html";
        }
        if (name === "Đăng Kí Nguyện Vọng") {
            window.location.href = "/assets/html/dangkynv.html";
        }
        if (name === "Thanh Toán") {
            if(localStorage.getItem("isLogin") === "true"){
                window.location.href = "/assets/html/thanhtoan.html";
            } else {
                alert("Vui lòng đăng nhập!");
                window.location.href = "/assets/html/login.html";
            }
        }
        if (name === "Hướng Dẫn") {
            window.location.href = "/assets/html/huongdan.html";
        }
    });
});
let danhSachNV = [];

/* đăng ký */
function dangKy(){

    let truong = document.querySelectorAll("select")[0].value;
    let nganh = document.querySelectorAll("select")[1].value;
    let tohop = document.querySelectorAll("select")[2].value;

    if(!truong || !nganh || !tohop){
        alert("Vui lòng chọn đầy đủ thông tin!");
        return;
    }

    danhSachNV.push({ truong, nganh, tohop });

    addNotification("Da dang ky nguyen vong: " + truong + " - " + nganh + " (" + tohop + ").");

    hienThi();

    localStorage.setItem("dsNV", JSON.stringify(danhSachNV));
    localStorage.setItem("soNV", danhSachNV.length);
}

/* hiển thị */
function hienThi(){
    let tbody = document.getElementById("dsNV");
    if(!tbody) return;

    tbody.innerHTML = "";

    danhSachNV.forEach((nv, index)=>{
        tbody.innerHTML += `
            <tr>
                <td>${index+1}</td>
                <td>${nv.truong}</td>
                <td>${nv.nganh}</td>
                <td>${nv.tohop}</td>
            </tr>
        `;
    });

    let box = document.getElementById("ketqua");
    if(box) box.style.display = "block";
}
function getCachedNguyenVongCount(){
    const dsNVRaw = localStorage.getItem("dsNV");
    if(dsNVRaw){
        try {
            const dsNV = JSON.parse(dsNVRaw);
            if(Array.isArray(dsNV)){
                return dsNV.length;
            }
        } catch (_) {
            // bỏ qua cache bị hỏng và tiếp tục
        }
    }

    return parseInt(localStorage.getItem("soNV"), 10) || 0;
}

function getCachedNguyenVongList(){
    const dsNVRaw = localStorage.getItem("dsNV");
    if(!dsNVRaw) return [];

    try {
        const dsNV = JSON.parse(dsNVRaw);
        return Array.isArray(dsNV) ? dsNV : [];
    } catch (_) {
        return [];
    }
}

/* ===== LẤY DỮ LIỆU ===== */
let soNV = getCachedNguyenVongCount();
let soTien = soNV * 10000;

function updatePaymentSummary(){
    const soNVEl = document.getElementById("soNV");
    const soTienEl = document.getElementById("soTien");
    if(soNVEl && soTienEl){
        soNVEl.innerText = soNV;
        soTienEl.innerText = soTien.toLocaleString();
    }
}

async function syncNguyenVongFromServer(){
    const sbd = localStorage.getItem("sbd");
    if(!sbd) return soNV;

    try {
        const res = await fetch(`/nguyenvong/${sbd}`, { cache: "no-store" });
        if(!res.ok) return soNV;

        const nvList = await res.json();
        if(Array.isArray(nvList)){
            soNV = nvList.length;
            soTien = soNV * 10000;
            localStorage.setItem("dsNV", JSON.stringify(nvList));
            localStorage.setItem("soNV", String(soNV));
            updatePaymentSummary();
        }
    } catch (_) {
        // giữ các giá trị cached nếu server không available
    }

    return soNV;
}

function savePaymentOutcome(){
    const sbd = localStorage.getItem("sbd");
    if(!sbd) return;

    const dsNV = getCachedNguyenVongList();
    const trangThaiList = dsNV.map((_, index) => index === 0 ? "Đậu" : "Trượt");
    localStorage.setItem(`paymentDone_${sbd}`, "true");
    localStorage.setItem(`paymentStatus_${sbd}`, JSON.stringify(trangThaiList));
}

/* ===== QR THANH TOAN ===== */
const qrData = {
    momo: {
        img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MOMO_THANHTOAN",
        text: "Quét QR MoMo để thanh toán"
    },
    zalopay: {
        img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ZALOPAY_THANHTOAN",
        text: "Quét QR ZaloPay để thanh toán"
    },
    viettelpay: {
        img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=VIETTEL_PAY_THANHTOAN",
        text: "Quét QR Viettel Pay để thanh toán"
    },
    bank: {
        vietcombank: {
            img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=VCB_TRANSFER",
            text: "Quét QR Vietcombank để chuyển khoản"
        },
        techcombank: {
            img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TCB_TRANSFER",
            text: "Quét QR Techcombank để chuyển khoản"
        },
        mbbank: {
            img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MBB_TRANSFER",
            text: "Quét QR MB Bank để chuyển khoản"
        },
        bidv: {
            img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=BIDV_TRANSFER",
            text: "Quét QR BIDV để chuyển khoản"
        },
        agribank: {
            img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=AGRIBANK_TRANSFER",
            text: "Quét QR Agribank để chuyển khoản"
        },
        acb: {
            img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=ACB_TRANSFER",
            text: "Quét QR ACB để chuyển khoản"
        },
        vpbank: {
            img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=VPBANK_TRANSFER",
            text: "Quét QR VPBank để chuyển khoản"
        },
        sacombank: {
            img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=SACOMBANK_TRANSFER",
            text: "Quét QR Sacombank để chuyển khoản"
        },
        tpbank: {
            img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=TPBANK_TRANSFER",
            text: "Quét QR TPBank để chuyển khoản"
        },
        hdbank: {
            img: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=HDBANK_TRANSFER",
            text: "Quét QR HDBank để chuyển khoản"
        }
    }
};

let selected = "";
let selectedBank = "";

/* ===== CHỌN PHƯƠNG THỨC ===== */
function chon(el, method){
    document.querySelectorAll(".method").forEach(m=>m.classList.remove("active"));
    el.classList.add("active");

    selected = method;
    selectedBank = "";

    const bankOptions = document.getElementById("bankOptions");
    const qrBox = document.getElementById("qrBox");

    document.querySelectorAll(".bank-item").forEach(b=>b.classList.remove("active"));

    if(method === "bank"){
        bankOptions.style.display = "grid";
        qrBox.style.display = "none";
        document.getElementById("qrImg").src = "";
        document.getElementById("qrText").innerText = "Vui lòng chọn ngân hàng để hiện mã thanh toán";
        return;
    }

    bankOptions.style.display = "none";
    qrBox.style.display = "block";
    document.getElementById("qrImg").src = qrData[method].img;
    document.getElementById("qrText").innerText = qrData[method].text;
}

function chonNganHang(el, bankKey){
    if(selected !== "bank") return;

    document.querySelectorAll(".bank-item").forEach(b=>b.classList.remove("active"));
    el.classList.add("active");

    selectedBank = bankKey;

    document.getElementById("qrBox").style.display = "block";
    document.getElementById("qrImg").src = qrData.bank[bankKey].img;
    document.getElementById("qrText").innerText = qrData.bank[bankKey].text;
}

/* ===== THANH TOÁN ===== */
async function thanhToan(){

    if(soNV === 0){
        await syncNguyenVongFromServer();
    }

    if(soNV === 0){
        alert("Bạn chưa đăng ký nguyện vọng!");
        return;
    }

    if(selected === ""){
        alert("Vui lòng chọn phương thức!");
        return;
    }

    if(selected === "bank" && selectedBank === ""){
        alert("Vui lòng chọn ngân hàng trước khi thanh toán!");
        return;
    }

    if(selected === "bank"){
        addNotification("Da thanh toan le phi xet tuyen qua ngan hang: " + selectedBank + ". So tien: " + soTien.toLocaleString() + " VND.");
    }else if(selected === "momo"){
        addNotification("Da thanh toan le phi xet tuyen qua MoMo. So tien: " + soTien.toLocaleString() + " VND.");
    }else if(selected === "zalopay"){
        addNotification("Da thanh toan le phi xet tuyen qua ZaloPay. So tien: " + soTien.toLocaleString() + " VND.");
    }else if(selected === "viettelpay"){
        addNotification("Da thanh toan le phi xet tuyen qua Viettel Pay. So tien: " + soTien.toLocaleString() + " VND.");
    }

    savePaymentOutcome();

    alert("Thanh toán thành công!\nSố tiền: " + soTien.toLocaleString() + " VNĐ");

    localStorage.removeItem("soNV");
}

/* load lại */
window.onload = function(){
    let data = localStorage.getItem("dsNV");

    if(data){
        danhSachNV = JSON.parse(data);
        hienThi();
    }
}

function getNotificationScope(){
    const sbd = String(localStorage.getItem("sbd") || "").trim();
    if(sbd && sbd !== "-"){
        return `sbd:${sbd}`;
    }

    const userName = String(localStorage.getItem("userName") || "").trim().toLowerCase();
    if(userName){
        return `user:${userName}`;
    }

    return "guest";
}

function getNotificationStorageKey(scope){
    const resolvedScope = scope || getNotificationScope();
    return `notiList:${resolvedScope}`;
}

function readNotificationsByKey(storageKey){
    const raw = localStorage.getItem(storageKey);
    if(!raw) return [];

    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
}

function loadNotificationsForCurrentAccount(){
    const storageKey = getNotificationStorageKey();
    let list = readNotificationsByKey(storageKey);

    // Di chuyển danh sách thông báo cũ sang khóa tài khoản hiện tại một lần.
    if(list.length === 0){
        const legacyRaw = localStorage.getItem("notiList");
        if(legacyRaw){
            try {
                const legacyList = JSON.parse(legacyRaw);
                if(Array.isArray(legacyList) && legacyList.length > 0){
                    list = legacyList;
                    localStorage.setItem(storageKey, JSON.stringify(list));
                }
            } catch (_) {
                // bỏ qua dữ liệu cũ bị hỏng
            }
        }
    }

    return list;
}

/* lấy danh sách thông báo */
let notifications = loadNotificationsForCurrentAccount();

/* thêm thông báo */
function addNotification(message){
    const scope = getNotificationScope();
    const storageKey = getNotificationStorageKey(scope);

    setTimeout(() => {

        const scopedNotifications = readNotificationsByKey(storageKey);

        scopedNotifications.unshift(message);

        localStorage.setItem(storageKey, JSON.stringify(scopedNotifications));

        if(storageKey === getNotificationStorageKey()){
            notifications = scopedNotifications;
        }

        renderNotification();

    }, 10000); // trễ 10s
}

/* hiển thị */
function renderNotification(){

    notifications = loadNotificationsForCurrentAccount();

    ensureNotificationArea();

    let list = document.getElementById("notifyList");
    if(!list) return;

    list.innerHTML = "";

    if(notifications.length === 0){
        list.innerHTML = "<li class='empty'>Chưa có thông báo</li>";
        return;
    }

    notifications.forEach(noti => {
        list.innerHTML += `<li>${noti}</li>`;
    });
}

function ensureNotificationArea(){
    if(document.getElementById("notifyBox")) return;

    const headerMenu = document.querySelector(".navbar__page-right");
    if(!headerMenu) return;

    const existingNotifyItem = Array.from(headerMenu.children).find(item => item.querySelector && item.querySelector(".fa-bell"));
    if(existingNotifyItem){
        existingNotifyItem.classList.add("navbar__notify");
        if(!existingNotifyItem.querySelector("#notifyBox")){
            existingNotifyItem.insertAdjacentHTML("beforeend", `
                <div class="notify-box" id="notifyBox">
                    <ul id="notifyList">
                        <li class="empty">Chưa có thông báo</li>
                    </ul>
                </div>
            `);
        }
        return;
    }

    const notifyItem = document.createElement("li");
    notifyItem.className = "navbar__page navbar__notify";
    notifyItem.innerHTML = `
        <i class="fa-regular fa-bell navbar__user"></i>
        <div class="notify-box" id="notifyBox">
            <ul id="notifyList">
                <li class="empty">Chưa có thông báo</li>
            </ul>
        </div>
    `;

    if(headerMenu.firstElementChild){
        headerMenu.insertBefore(notifyItem, headerMenu.firstElementChild);
    } else {
        headerMenu.appendChild(notifyItem);
    }
}

/* load lại khi vào trang */
window.addEventListener("load", renderNotification);