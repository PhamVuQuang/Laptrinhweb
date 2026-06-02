const { execFile } = require('child_process');
const iconv = require('iconv-lite');
const util = require('util');
const execFileAsync = util.promisify(execFile);

const dbName = process.env.DB_NAME || 'tracuudiemthidh';
const serverTarget = `tcp:localhost,1433`;
const encodings = ['utf8','latin1','win1252','win1258'];
const vietRegex = /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

function extractJsonFromSqlcmdOutput(raw) {
    const text = String(raw || '');
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start >= 0 && end > start) return text.slice(start, end + 1);
    return '';
}

function scoreText(s){
    if(!s) return -999;
    if(s.includes('\uFFFD') || s.includes('?')) return -1;
    const m = s.match(vietRegex);
    return (m ? m.length : 0) + (s.length>0?0.1:0);
}

async function runSqlcmdQuery(query){
    const args = ['-S', serverTarget, '-E', '-d', dbName, '-w', '65535', '-Q', query];
    const { stdout, stderr } = await execFileAsync('sqlcmd', args, { windowsHide: true, maxBuffer: 1024*1024 });
    return String(stdout || '');
}

async function processColumn(table, key, col){
    console.log('Reading', table, col);
    const q = `SET NOCOUNT ON; SELECT ${key} as __key, '0x' + SUBSTRING(master.sys.fn_varbintohexstr(CAST(${col} AS VARBINARY(MAX))),3,8000) as rawhex, ${col} as orig FROM ${table} FOR JSON PATH;`;
    const out = await runSqlcmdQuery(q);
    const jsonText = extractJsonFromSqlcmdOutput(out);
    if(!jsonText) { console.warn('No JSON for', table, col); return; }
    let arr;
    try{ arr = JSON.parse(jsonText); } catch(e){ console.error('JSON parse failed', e); return; }
    for(const row of arr){
        const id = row.__key;
        const orig = row.orig || '';
        let rawhex = row.rawhex || '';
        if(!rawhex) continue;
        // rawhex có thể bị cắt ngắn bởi SUBSTRING; thử đầy đủ qua fn_varbintohexstr trực tiếp
        // nhưng để đơn giản, hãy xóa bất kỳ ký tự không phải hex nào
        rawhex = rawhex.replace(/[^0-9A-Fa-f]/g,'');
        if(!rawhex) continue;
        const buf = Buffer.from(rawhex, 'hex');
        let best = {text: orig, score: scoreText(orig), enc: 'orig'};
        for(const enc of encodings){
            try{
                const dec = iconv.decode(buf, enc);
                const sc = scoreText(dec);
                if(sc > best.score){ best = {text: dec, score: sc, enc}; }
            }catch(e){}
        }
        if(best.enc !== 'orig' && best.score > 0 && best.text !== orig){
            console.log(`Updating ${table}.${col} ${key}=${id} via ${best.enc} (score=${best.score})`);
            const safe = best.text.replace(/'/g, "''");
            const uq = `SET NOCOUNT ON; UPDATE ${table} SET ${col} = N'${safe}' WHERE ${key} = '${id}';`;
            try{
                await runSqlcmdQuery(uq);
            }catch(uerr){ console.error('Update failed', uerr); }
        }
    }
}

async function main(){
    try{
        await processColumn('truongdaihoc','matruong','tentruong');
        await processColumn('nganh','manganh','tennganh');
        await processColumn('nganh','manganh','monxettuyen');
        await processColumn('thisinh','SBD','quequan');
        await processColumn('thisinh','SBD','truong');
        // Cập nhật CCCD cho TS001 thành số 12 chữ số thực tế
        console.log('Setting CCCD for TS001');
        await runSqlcmdQuery("SET NOCOUNT ON; UPDATE thisinh SET CCCD = N'123456789012' WHERE SBD = 'TS001';");
        console.log('Done');
    }catch(e){ console.error(e); process.exit(1); }
}

main();
