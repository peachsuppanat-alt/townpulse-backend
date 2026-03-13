const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// อนุญาตให้แอปอื่นเข้าถึงข้อมูลได้
app.use(cors());
// ให้ API อ่านข้อมูลที่ส่งมาเป็น JSON ได้
app.use(express.json()); 

// 1. ตั้งค่าการเชื่อมต่อฐานข้อมูล XAMPP
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      // ชื่อผู้ใช้เริ่มต้นของ XAMPP
    password: '',      // รหัสผ่านเริ่มต้น (ปล่อยว่างไว้)
    database: 'townpulse_db' // ชื่อฐานข้อมูลของคุณ
});

// 2. สั่งให้ลองเชื่อมต่อ
db.connect((err) => {
    if (err) {
        console.error('❌ เชื่อมต่อฐานข้อมูลล้มเหลว: ', err);
        return;
    }
    console.log('✅ เชื่อมต่อ MySQL (XAMPP) สำเร็จแล้ว!');
});

// 3. สร้าง API เส้นแรกสำหรับทดสอบ (Route)
app.get('/', (req, res) => {
    res.send('ยินดีต้อนรับสู่ TownPulse Backend API!');
});

app.get('/api/test', (req, res) => {
    res.json({ 
        status: 'success', 
        message: 'แอปมือถือสามารถเชื่อมต่อ Backend ได้แล้ว!' 
    });
});

// 4. สั่งให้เซิร์ฟเวอร์เริ่มทำงานที่ Port 5000
const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 เซิร์ฟเวอร์รันอยู่ที่ http://localhost:${PORT}`);
});