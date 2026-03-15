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
  // 1. รับค่าให้ตรงกับที่แอปส่งมา
  const { first_name, last_name, email, password } = req.body;

  // 2. คำสั่ง SQL ยัดลงคอลัมน์ที่มีอยู่จริงในตาราง
  const sql = "INSERT INTO users (first_name, last_name, email, password) VALUES (?, ?, ?, ?)";
  
  db.query(sql, [first_name, last_name, email, password], (err, result) => {
    if (err) {
      console.error('❌ SQL Error:', err); // ถ้าพัง จะโชว์สาเหตุสีแดงใน Terminal
      return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดที่ฐานข้อมูล' });
    }
    console.log('✅ สมัครสมาชิกสำเร็จ:', email);
    res.json({ status: 'success', message: 'สมัครสมาชิกสำเร็จ' });
  });
});

// ==========================================
// 📍 จุดที่ 2: นำ SELECT ไปใส่ใน API ล็อกอิน
// ==========================================
app.post('/login', (req, res) => {
    // รับค่า Email และ Password จากมือถือ
    const { email, password } = req.body;

    // นำคำสั่ง SQL มาใส่ตรงนี้ครับ 👇 (เพื่อค้นหา user จากอีเมล)
    const sql = "SELECT * FROM users WHERE email = ?";
    
    // สั่งค้นหาในฐานข้อมูล
    db.query(sql, [email], (err, results) => {
        if (err) return res.status(500).send("Error");

        // ถ้าค้นไม่เจอ (ไม่มีข้อมูลกลับมา)
        if (results.length === 0) {
            return res.status(401).send("ไม่พบผู้ใช้งานนี้");
        }

        // ถ้าค้นเจอ เอา Password มาเทียบกัน
        const user = results[0];
        if (user.password !== password) {
            return res.status(401).send("รหัสผ่านไม่ถูกต้อง");
        }

        // ถ้าผ่านหมด ให้เข้าสู่ระบบได้
        res.send("เข้าสู่ระบบสำเร็จ!");
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});