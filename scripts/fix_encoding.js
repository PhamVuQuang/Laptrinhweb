const sql = require('mssql');
const iconv = require('iconv-lite');

const config = {
    user: process.env.DB_USER || 'web_app',
    password: process.env.DB_PASSWORD || 'WebApp@123456',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME || 'tracuudiemthidh',
    port: Number(process.env.DB_PORT || 1433),
    options: { encrypt: false, trustServerCertificate: true }
};

const tables = [
    { name: 'truongdaihoc', key: 'matruong', cols: ['tentruong'] },
    { name: 'nganh', key: 'manganh', cols: ['tennganh','monxettuyen'] },
    { name: 'thisinh', key: 'SBD', cols: ['quequan','truong'] }
];

const encodings = ['utf8','latin1','win1252','win1258'];
const vietRegex = /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/i;

function scoreText(s){
    if(!s) return -999;
    if(s.includes('\uFFFD') || s.includes('?')){
        // phạt ký tự thay thế hoặc dấu chấm hỏi
        return -1;
    }
    const m = s.match(vietRegex);
    return (m ? m.length : 0) + (s.length > 0 ? 0.1 : 0);
}

async function processColumn(pool, table, key, col){
    const q = `SELECT ${key} as __key, ${col} as orig, CAST(${col} AS VARBINARY(MAX)) as raw FROM ${table}`;
    const result = await pool.request().query(q);
    for(const row of result.recordset){
        const id = row.__key;
        const orig = row.orig || '';
        const raw = row.raw;
        if(!raw) continue;
        let best = {text: orig, score: scoreText(orig), enc: 'orig'};
        for(const enc of encodings){
            try{
                const decoded = iconv.decode(raw, enc);
                const sc = scoreText(decoded);
                if(sc > best.score){
                    best = {text: decoded, score: sc, enc};
                }
            }catch(e){ }
        }
        if(best.enc !== 'orig' && best.score > 0 && best.text !== orig){
            console.log(`Cập nhật ${table}.${col} cho ${key}=${id} sử dụng ${best.enc} (điểm=${best.score})`);
            try{
                await pool.request()
                    .input('val', sql.NVarChar, best.text)
                    .input('id', sql.NVarChar, id)
                    .query(`UPDATE ${table} SET ${col} = @val WHERE ${key} = @id`);
            }catch(updateErr){
                console.error('Cập nhật thất bại', updateErr);
            }
        }
    }
}

async function main(){
    console.log('Đang kết nối đến CSDL...');
    await sql.connect(config);
    const pool = sql;
    for(const t of tables){
        for(const col of t.cols){
            console.log('Đang xử lý', t.name, col);
            await processColumn(pool, t.name, t.key, col);
        }
    }
    // đặt CCCD thực tế cho TS001
    try{
        await pool.request()
            .input('cccd', sql.NVarChar, '123456789012')
            .input('sbd', sql.NVarChar, 'TS001')
            .query('UPDATE thisinh SET CCCD = @cccd WHERE SBD = @sbd');
        console.log('Cập nhật CCCD cho TS001 thành công');
    }catch(e){
        console.error('Cập nhật CCCD thất bại', e);
    }
    console.log('Hoàn tất');
    process.exit(0);
}

main().catch(e=>{console.error(e); process.exit(1);});
