const { execFile } = require('child_process');
const util = require('util');
const execFileAsync = util.promisify(execFile);
const iconv = require('iconv-lite');

const dbName = 'tracuudiemthidh';
const serverTarget = `tcp:localhost,1433`;
const encodings = ['utf16le','utf8','latin1','win1252','win1258'];
const vietRegex = /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

function scoreText(s){
    if(!s) return -999;
    if(s.includes('\uFFFD')) return -1;
    const qmCount = (s.match(/\?/g)||[]).length;
    const m = s.match(vietRegex);
    return (m?m.length:0) - qmCount*0.5 + (s.length>0?0.01:0);
}

async function dumpHex(table, key, col){
    const q = `SET NOCOUNT ON; SELECT ${key} + '|' + master.sys.fn_varbintohexstr(CAST(${col} AS VARBINARY(MAX))) FROM ${table};`;
    const args = ['-S', serverTarget, '-E', '-d', dbName, '-w', '65535', '-Q', q, '-W', '-h', '-1'];
    const { stdout } = await execFileAsync('sqlcmd', args, { windowsHide: true, maxBuffer: 5*1024*1024 });
    return String(stdout || '');
}

async function runSqlcmd(q){
    const args = ['-S', serverTarget, '-E', '-d', dbName, '-w', '65535', '-Q', q];
    const { stdout } = await execFileAsync('sqlcmd', args, { windowsHide: true, maxBuffer: 5*1024*1024 });
    return String(stdout || '');
}

async function process(table, key, col){
    console.log('Processing', table, col);
    const out = await dumpHex(table, key, col);
    const lines = out.split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
    for(const line of lines){
        const idx = line.indexOf('|');
        if(idx < 0) continue;
        const id = line.slice(0, idx);
        let hex = line.slice(idx+1).trim();
        if(!hex) continue;
        hex = hex.replace(/^0x/i,'');
        const buf = Buffer.from(hex, 'hex');
        // thử các tùy chọn giải mã
        let best = {text: null, score: -999, enc: null};
        for(const enc of encodings){
            try{
                const dec = iconv.decode(buf, enc);
                const sc = scoreText(dec);
                if(sc > best.score){ best = {text: dec, score: sc, enc}; }
            }catch(e){}
        }
        // chuỗi gốc: cần lấy gốc qua truy vấn riêng
        const origQ = `SET NOCOUNT ON; SELECT ${col} FROM ${table} WHERE ${key} = '${id}'`;
        let orig = '';
        try{ const r = await runSqlcmd(origQ); orig = String(r||'').trim().split(/\r?\n/).pop()||''; }catch(e){}
        // so sánh và cập nhật
        if(best.enc && best.score > 0 && best.text && best.text !== orig){
            console.log(`Update ${table}.${col} ${key}=${id} using ${best.enc} (score=${best.score})`);
            // xóa NULL nhúng trong đó sẽ phá vỡ execFile args
            const cleaned = best.text.replace(/\u0000/g, '');
            const safe = cleaned.replace(/'/g,"''");
            const uq = `SET NOCOUNT ON; UPDATE ${table} SET ${col} = N'${safe}' WHERE ${key} = '${id}';`;
            try{ await runSqlcmd(uq); }catch(e){ console.error('update failed', e); }
        }
    }
}

(async ()=>{
    try{
        await process('truongdaihoc','matruong','tentruong');
        await process('nganh','manganh','tennganh');
        await process('nganh','manganh','monxettuyen');
        await process('thisinh','SBD','quequan');
        await process('thisinh','SBD','truong');
        console.log('Set realistic CCCD for TS001');
        await runSqlcmd("SET NOCOUNT ON; UPDATE thisinh SET CCCD = N'123456789012' WHERE SBD = 'TS001';");
        console.log('Done');
    }catch(e){ console.error(e); process.exit(1); }
})();
