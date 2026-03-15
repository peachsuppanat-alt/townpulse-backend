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
// ==========================================
// 1. API ดึงรีวิวของแต่ละกิจกรรม (พร้อมคำนวณดาวเฉลี่ยให้หน้า Detail)
// ==========================================
app.get('/events/:event_id/reviews', (req, res) => {
  const eventId = req.params.event_id;
  const sql = `
      SELECT r.*, u.username 
      FROM reviews r 
      JOIN users u ON r.user_id = u.id 
      WHERE r.event_id = ? 
      ORDER BY r.created_at DESC
  `;
  
  db.query(sql, [eventId], (err, results) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      
      let totalRating = 0;
      results.forEach(r => totalRating += r.rating);
      // ถ้าไม่มีคนรีวิวให้เป็น 0.0 ถ้ามีให้หาค่าเฉลี่ย
      const averageRating = results.length > 0 ? (totalRating / results.length).toFixed(1) : "0.0";
      
      res.json({ status: 'success', reviews: results, averageRating: averageRating, totalReviews: results.length });
  });
});

// ==========================================
// 2. API ส่งรีวิวใหม่ลง Database
// ==========================================
app.post('/add-review', (req, res) => {
  const { user_id, event_id, rating, comment } = req.body;
  const finalRating = parseInt(rating, 10);

  if (isNaN(finalRating)) return res.status(400).json({ status: 'error', message: 'ค่าคะแนนดาวไม่ถูกต้อง' });

  const sql = "INSERT INTO reviews (user_id, event_id, rating, comment) VALUES (?, ?, ?, ?)";
  db.query(sql, [user_id, event_id, finalRating, comment], (err, result) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      res.json({ status: 'success', message: 'บันทึกรีวิวสำเร็จ' });
  });
});

// ==========================================
// 3. API ดึงดาวเฉลี่ยของ "ทุกกิจกรรม" (ส่งให้หน้า Explore การ์ดโชว์)
// ==========================================
app.get('/all-ratings', (req, res) => {
  const sql = `
      SELECT event_id, ROUND(AVG(rating), 1) as avg_rating, COUNT(id) as total_reviews 
      FROM reviews GROUP BY event_id
  `;
  db.query(sql, (err, results) => {
      if (err) return res.status(500).json({ status: 'error' });
      res.json({ status: 'success', data: results });
  });
});
// ==========================================
// 4. API ดึงประวัติการรีวิวทั้งหมดของ User คนนั้นๆ
// ==========================================
app.get('/user-reviews/:user_id', (req, res) => {
  const userId = req.params.user_id;
  // ดึงรีวิว พร้อมกับเชื่อมเอาชื่อกิจกรรม (title) จากตาราง events มาแสดงด้วย
  const sql = `
      SELECT r.*, e.title as event_title, e.image_url 
      FROM reviews r 
      JOIN events e ON r.event_id = e.id 
      WHERE r.user_id = ? 
      ORDER BY r.created_at DESC
  `;
  
  db.query(sql, [userId], (err, results) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      res.json({ status: 'success', reviews: results, totalCount: results.length });
  });
});
app.listen(3000, () => {
    console.log('Server is running on port 3000');
});