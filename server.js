const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const multer = require('multer'); 
const path = require('path');     

const app = express();
app.use(cors());
app.use(express.json());

// อนุญาตให้ Frontend สามารถเข้าถึงไฟล์ในโฟลเดอร์ uploads ได้โดยตรง
app.use('/uploads', express.static('uploads'));

// ==========================================
// 1. ตั้งค่าเชื่อมต่อฐานข้อมูล townpulse_db
// ==========================================
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'townpulse_db'
});

// ==========================================
// 2. ตั้งค่าการอัปโหลดไฟล์ด้วย Multer
// ==========================================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); 
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname)); 
    }
});
const upload = multer({ storage: storage });


const badWords = ['เหี้ย', 'สัส', 'ควย', 'หี', 'แตด', 'พ่อง', 'แม่ง', 'ควาย', 'กาก', 'สถุล', 'ระยำ', 'จัญไร', 'แย่มาก', 'เลว'];

// ==========================================
//  API ฝั่ง User ทั่วไป (แอปมือถือ)
// ==========================================

app.post('/register', (req, res) => {
  const { username, email, password } = req.body;
  const sql = "INSERT INTO users (username, email, password) VALUES (?, ?, ?)";
  db.query(sql, [username, email, password], (err, result) => {
    if (err) return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดที่ฐานข้อมูล' });
    res.json({ status: 'success', message: 'สมัครสมาชิกสำเร็จ', user: { id: result.insertId, username: username, email: email } });
  });
});

app.post('/login', (req, res) => {
  const { email, password } = req.body;
  const sql = "SELECT * FROM users WHERE email = ? AND password = ?";
  db.query(sql, [email, password], (err, result) => {
    if (err) return res.status(500).json({ status: 'error', message: 'เกิดข้อผิดพลาดที่ฐานข้อมูล' });
    if (result.length > 0) res.json({ status: 'success', message: 'เข้าสู่ระบบสำเร็จ', user: result[0] }); 
    else res.status(401).json({ status: 'error', message: 'email หรือ password ไม่ถูกต้อง' });
  });
});

app.post('/toggle-save', (req, res) => {
  const { user_id, event_id } = req.body;
  const checkSql = "SELECT * FROM saved_events WHERE user_id = ? AND event_id = ?";
  db.query(checkSql, [user_id, event_id], (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    if (results.length > 0) {
      const deleteSql = "DELETE FROM saved_events WHERE user_id = ? AND event_id = ?";
      db.query(deleteSql, [user_id, event_id], () => res.json({ status: 'un-saved', message: 'ลบออกจากรายการที่บันทึกแล้ว' }));
    } else {
      const insertSql = "INSERT INTO saved_events (user_id, event_id) VALUES (?, ?)";
      db.query(insertSql, [user_id, event_id], () => res.json({ status: 'saved', message: 'บันทึกกิจกรรมเรียบร้อย' }));
    }
  });
});

app.get('/saved-events/:user_id', (req, res) => {
  const userId = req.params.user_id;
  const sql = `SELECT events.* FROM saved_events JOIN events ON saved_events.event_id = events.id WHERE saved_events.user_id = ? ORDER BY saved_events.created_at DESC`;
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ status: 'error', message: err.message });
    res.json({ status: 'success', data: results });
  });
});

app.get('/events/:event_id/reviews', (req, res) => {
  const eventId = req.params.event_id;
  const sql = `SELECT r.*, u.username FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.event_id = ? ORDER BY r.created_at DESC`;
  db.query(sql, [eventId], (err, results) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      let totalRating = 0;
      results.forEach(r => totalRating += r.rating);
      const averageRating = results.length > 0 ? (totalRating / results.length).toFixed(1) : "0.0";
      res.json({ status: 'success', reviews: results, averageRating: averageRating, totalReviews: results.length });
  });
});

app.post('/add-review', (req, res) => {
  const { user_id, event_id, rating, comment } = req.body;
  const finalRating = parseInt(rating, 10);
  if (isNaN(finalRating)) return res.status(400).json({ status: 'error', message: 'ค่าคะแนนดาวไม่ถูกต้อง' });

  let isReported = 0;
  if (comment) {
    for (let word of badWords) {
      if (comment.includes(word)) {
        isReported = 1; 
        break;
      }
    }
  }

  const sql = "INSERT INTO reviews (user_id, event_id, rating, comment, is_reported) VALUES (?, ?, ?, ?, ?)";
  db.query(sql, [user_id, event_id, finalRating, comment, isReported], (err, result) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      res.json({ status: 'success', message: 'บันทึกรีวิวสำเร็จ' });
  });
});

app.get('/all-ratings', (req, res) => {
  const sql = `SELECT event_id, ROUND(AVG(rating), 1) as avg_rating, COUNT(id) as total_reviews FROM reviews GROUP BY event_id`;
  db.query(sql, (err, results) => {
      if (err) return res.status(500).json({ status: 'error' });
      res.json({ status: 'success', data: results });
  });
});

app.get('/user-reviews/:user_id', (req, res) => {
  const userId = req.params.user_id;
  const sql = `SELECT r.*, e.title as event_title, e.image_url FROM reviews r JOIN events e ON r.event_id = e.id WHERE r.user_id = ? ORDER BY r.created_at DESC`;
  db.query(sql, [userId], (err, results) => {
      if (err) return res.status(500).json({ status: 'error', message: err.message });
      res.json({ status: 'success', reviews: results, totalCount: results.length });
  });
});

app.get('/api/events', (req, res) => {
    // 🌟 ใช้ Subquery เพื่อนับจำนวนรีวิวที่โดนรายงาน (is_reported = 1) ในแต่ละ event
    const sql = `
        SELECT e.*, 
        (SELECT COUNT(*) FROM reviews r WHERE r.event_id = e.id AND r.is_reported = 1) AS reported_count
        FROM events e 
        ORDER BY e.id DESC
    `; 
    
    db.query(sql, (err, results) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: results });
    });
});

app.get('/api/events/:id', (req, res) => {
    const eventId = req.params.id;
    const sql = "SELECT * FROM events WHERE id = ?";
    db.query(sql, [eventId], (err, results) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        if (results.length === 0) return res.status(404).json({ status: 'error', message: 'ไม่พบกิจกรรมนี้' });
        res.json({ status: 'success', data: results[0] });
    });
});

app.put('/api/reviews/:id/report', (req, res) => {
    const reviewId = req.params.id;
    const sql = "UPDATE reviews SET is_reported = TRUE WHERE id = ?";
    db.query(sql, [reviewId], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'รายงานรีวิวนี้ให้แอดมินทราบแล้ว' });
    });
});

app.put('/api/reviews/:id/edit', (req, res) => {
    const reviewId = req.params.id;
    const { user_id, rating, comment } = req.body;

    let isReported = 0;
    if (comment) {
      for (let word of badWords) {
        if (comment.includes(word)) {
          isReported = 1;
          break;
        }
      }
    }

    const sql = "UPDATE reviews SET rating = ?, comment = ?, is_reported = ? WHERE id = ? AND user_id = ?";
    db.query(sql, [rating, comment, isReported, reviewId, user_id], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        if (result.affectedRows === 0) return res.status(403).json({ status: 'error', message: 'คุณไม่มีสิทธิ์แก้ไขรีวิวนี้' });
        res.json({ status: 'success', message: 'อัปเดตรีวิวสำเร็จ' });
    });
});

app.delete('/api/reviews/:id', (req, res) => {
    const reviewId = req.params.id;
    const sql = "DELETE FROM reviews WHERE id = ?";
    db.query(sql, [reviewId], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'ลบรีวิวออกจากระบบแล้ว' });
    });
});

// ==========================================
// 🔴 API ฝั่ง Admin (ระบบหลังบ้าน)
// ==========================================

app.post('/api/admin/login', (req, res) => {
    const { username, password, keyAdmin } = req.body;
    if (!username || !password || !keyAdmin) {
        return res.status(400).json({ success: false, message: 'กรุณากรอก Username, Password และ Key Admin ให้ครบถ้วน' });
    }
    const sql = 'SELECT * FROM Admins WHERE username = ? AND password = ? AND keyAdmin = ?';
    db.query(sql, [username, password, keyAdmin], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'เกิดข้อผิดพลาดที่ฝั่งเซิร์ฟเวอร์' });
        if (results.length > 0) {
            const adminData = results[0];
            res.status(200).json({ success: true, message: 'เข้าสู่ระบบสำเร็จ', data: { id: adminData.id, username: adminData.username, role: 'admin' } });
        } else {
            res.status(401).json({ success: false, message: 'Username, Password หรือ Key Admin ไม่ถูกต้อง' });
        }
    });
});

app.put('/api/admin/reviews/:id/unreport', (req, res) => {
    const reviewId = req.params.id;
    const sql = "UPDATE reviews SET is_reported = FALSE WHERE id = ?";
    db.query(sql, [reviewId], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'ยกเลิกสถานะการรายงานแล้ว' });
    });
});

// 📍 Admin: เพิ่มกิจกรรม (เพิ่ม category, latitude, longitude)
app.post('/api/admin/events', upload.single('image'), (req, res) => {
    const { title, description, location_name, category, start_date, end_date, location, imageUrlInput, latitude, longitude } = req.body;
    const finalImageUrl = req.file ? `/uploads/${req.file.filename}` : imageUrlInput;

    if (!finalImageUrl) return res.status(400).json({ status: 'error', message: 'กรุณาอัปโหลดรูปภาพ หรือใส่ลิงก์รูปภาพ' });

    const sql = "INSERT INTO events (title, description, location_name, category, start_date, end_date, location, image_url, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
    db.query(sql, [title, description, location_name, category, start_date, end_date, location, finalImageUrl, latitude, longitude], (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success' });
    });
});

// 📍 Admin: แก้ไขกิจกรรม (เพิ่ม category, latitude, longitude)
app.put('/api/admin/events/:id', upload.single('image'), (req, res) => {
    const eventId = req.params.id;
    const { title, description, location_name, category, start_date, end_date, location, imageUrlInput, latitude, longitude } = req.body;
    const finalImageUrl = req.file ? `/uploads/${req.file.filename}` : imageUrlInput;

    let sql, params;
    if (finalImageUrl) {
        sql = "UPDATE events SET title=?, description=?, location_name=?, category=?, start_date=?, end_date=?, location=?, image_url=?, latitude=?, longitude=? WHERE id=?";
        params = [title, description, location_name, category, start_date, end_date, location, finalImageUrl, latitude, longitude, eventId];
    } else {
        sql = "UPDATE events SET title=?, description=?, location_name=?, category=?, start_date=?, end_date=?, location=?, latitude=?, longitude=? WHERE id=?";
        params = [title, description, location_name, category, start_date, end_date, location, latitude, longitude, eventId];
    }

    db.query(sql, params, (err, result) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', message: 'อัปเดตข้อมูลสำเร็จ' });
    });
});

// ==========================================
// 📍 เริ่มการทำงานของ Server (ต้องอยู่ล่างสุดเสมอ)
// ==========================================
// ==========================================
// 📍 API: ระบบแจ้งเตือน (Notifications)
// ==========================================

// 1. ดึงการแจ้งเตือนของผู้ใช้คนนั้นๆ
app.get('/api/notifications/:user_id', (req, res) => {
    const userId = req.params.user_id;
    const sql = "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC";
    db.query(sql, [userId], (err, results) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        res.json({ status: 'success', data: results });
    });
});

// 2. API สำหรับ แอดมิน ลบรีวิวโดยเฉพาะ (พร้อมส่งแจ้งเตือน)
app.delete('/api/admin/reviews/:id', (req, res) => {
    const reviewId = req.params.id;

    // สเต็ป 1: ดึงข้อมูลรีวิวเพื่อดูว่าเป็นของ User คนไหน และงานอะไร
    const getReviewSql = `SELECT r.user_id, e.title as event_title FROM reviews r JOIN events e ON r.event_id = e.id WHERE r.id = ?`;
    
    db.query(getReviewSql, [reviewId], (err, results) => {
        if (err) return res.status(500).json({ status: 'error', message: err.message });
        
        if (results.length > 0) {
            const review = results[0];
            
            // สเต็ป 2: สร้างการแจ้งเตือนบันทึกลง Database
            const title = 'รีวิวของคุณถูกลบ 🚨';
            const message = `รีวิวของคุณในกิจกรรม "${review.event_title}" ถูกลบโดยแอดมิน เนื่องจากอาจมีเนื้อหาที่ไม่เหมาะสมหรือผิดกฎการใช้งาน`;
            const insertNotifSql = "INSERT INTO notifications (user_id, title, message, type) VALUES (?, ?, ?, 'warning')";
            
            db.query(insertNotifSql, [review.user_id, title, message], (err) => {
                if (err) console.error("สร้างแจ้งเตือนไม่สำเร็จ:", err);
            });
        }

        // สเต็ป 3: ลบรีวิวทิ้ง
        const deleteSql = "DELETE FROM reviews WHERE id = ?";
        db.query(deleteSql, [reviewId], (err, result) => {
            if (err) return res.status(500).json({ status: 'error', message: err.message });
            res.json({ status: 'success', message: 'ลบรีวิวและส่งแจ้งเตือนแล้ว' });
        });
    });
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});