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

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});