const express = require('express');
const mysql = require('mysql2'); // หรือโมดูลเชื่อมต่อ DB ที่คุณใช้
const app = express();
const cors = require('cors');

app.use(cors());
app.use(express.json()); // เพื่อให้รับข้อมูลจากมือถือได้

// 1. ตั้งค่าเชื่อมต่อฐานข้อมูล townpulse_db
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'townpulse_db'
});

// ==========================================
// 📍 จุดที่ 1: นำ INSERT ไปใส่ใน API สมัครสมาชิก
// ==========================================
app.post('/register', (req, res) => {
  const { username, email, password } = req.body;

  const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
  
  db.query(sql, [username, email, password], (err, result) => {
    if (err) {
      console.error('❌ SQL Error:', err); 
      return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดที่ฐานข้อมูล' });
    }
    
    console.log('✅ สมัครสมาชิกสำเร็จ:', email);
    // 🌟 จุดที่แก้: ให้ส่ง user กลับไปพร้อมกับ id ที่เพิ่งสร้างใหม่ (result.insertId)
    res.json({ 
      status: 'success', 
      message: 'สมัครสมาชิกสำเร็จ',
      user: { id: result.insertId, username: username, email: email }
    });
  });
});

// ==========================================
// 📍 จุดที่ 2: นำ SELECT ไปใส่ใน API ล็อกอิน
// ==========================================
app.post('/login', (req, res) => {
  const { email, password } = req.body;

  // ค้นหาอีเมลและรหัสผ่านในฐานข้อมูล
  const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
  
  db.query(sql, [email, password], (err, result) => {
    if (err) {
      console.error('❌ SQL Error (Login):', err);
      return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดที่ฐานข้อมูล' });
    }

    // เช็กว่ามีข้อมูลตรงกันไหม (ความยาวของผลลัพธ์มากกว่า 0 คือเจอข้อมูล)
    if (result.length > 0) {
      console.log('✅ เข้าสู่ระบบสำเร็จ:', email);
      // ส่งข้อมูล user กลับไปให้แอปด้วย เผื่อเอาไปโชว์ชื่อหน้า Home
      res.json({ status: 'success', message: 'เข้าสู่ระบบสำเร็จ', user: result[0] }); 
    } else {
      console.log('❌ เข้าสู่ระบบไม่สำเร็จ: รหัสผิดหรือไม่มีอีเมลนี้');
      res.status(401).json({ status: 'error', message: 'email หรือ password ไม่ถูกต้อง' });
    }
  });
});
// ==========================================
// 1. API สำหรับกดหัวใจ / ยกเลิกหัวใจ (Toggle Save)
// ==========================================
app.post('/toggle-save', (req, res) => {
  const { user_id, event_id } = req.body;

  // เช็กก่อนว่า User คนนี้ เคยกดหัวใจให้ Event นี้ไปแล้วหรือยัง?
  const checkSql = "SELECT * FROM saved_events WHERE user_id = ? AND event_id = ?";
  db.query(checkSql, [user_id, event_id], (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });

    if (results.length > 0) {
      // 💔 ถ้ามีข้อมูลแล้ว แปลว่ากดซ้ำ = สั่ง "ยกเลิกหัวใจ" (ลบออกจากตาราง)
      const deleteSql = "DELETE FROM saved_events WHERE user_id = ? AND event_id = ?";
      db.query(deleteSql, [user_id, event_id], (err) => {
        if (err) return res.status(500).json({ status: 'error' });
        res.json({ status: 'un-saved', message: 'ลบออกจากรายการที่บันทึกแล้ว' });
      });
    } else {
      // ❤️ ถ้ายังไม่มีข้อมูล แปลว่าเพิ่งกด = สั่ง "บันทึกหัวใจ" (เพิ่มลงตาราง)
      const insertSql = "INSERT INTO saved_events (user_id, event_id) VALUES (?, ?)";
      db.query(insertSql, [user_id, event_id], (err) => {
        if (err) return res.status(500).json({ status: 'error' });
        res.json({ status: 'saved', message: 'บันทึกกิจกรรมเรียบร้อย' });
      });
    }
  });
});

// ==========================================
// 2. API สำหรับดึง "รายการที่บันทึกไว้" ของ User นั้นๆ
// ==========================================
app.get('/saved-events/:user_id', (req, res) => {
  const userId = req.params.user_id;
  
  // สั่งให้ไปดึงข้อมูล Event เฉพาะอันที่โผล่ในตาราง saved_events ของ user คนนี้
  const sql = `
    SELECT events.* FROM saved_events 
    JOIN events ON saved_events.event_id = events.id 
    WHERE saved_events.user_id = ?
    ORDER BY saved_events.created_at DESC
  `;
  
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    res.json({ status: 'success', data: results });
  });
});
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});