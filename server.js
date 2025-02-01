const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// ใช้ middleware สำหรับแปลง body ให้อยู่ในรูปแบบ JSON
app.use(bodyParser.json());

// เซิร์ฟไฟล์ static จากโฟลเดอร์ public
app.use(express.static(path.join(__dirname, 'public')));

// Endpoint สำหรับบันทึกข้อมูล (Save)
app.post('/save', (req, res) => {
  const data = req.body;
  const saveFolder = path.join(__dirname, 'save');

  // ตรวจสอบว่าโฟลเดอร์ save มีอยู่หรือไม่ ถ้าไม่มีให้สร้าง
  if (!fs.existsSync(saveFolder)) {
    fs.mkdirSync(saveFolder);
  }

  const filePath = path.join(saveFolder, 'accounts.json');
  fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
    if (err) {
      console.error('Error saving file:', err);
      return res.status(500).json({ error: 'Failed to save data.' });
    }
    res.json({ message: 'Data saved successfully.' });
  });
});

// Endpoint สำหรับโหลดข้อมูล (Load)
app.get('/load', (req, res) => {
  const filePath = path.join(__dirname, 'save', 'accounts.json');
  if (fs.existsSync(filePath)) {
    fs.readFile(filePath, 'utf8', (err, fileData) => {
      if (err) {
        console.error('Error reading file:', err);
        return res.status(500).json({ error: 'Failed to load data.' });
      }
      try {
        const data = JSON.parse(fileData);
        res.json(data);
      } catch (parseErr) {
        console.error('Error parsing JSON:', parseErr);
        res.status(500).json({ error: 'Invalid data format.' });
      }
    });
  } else {
    // ถ้าไฟล์ไม่พบ ให้ส่งข้อมูลว่างกลับไป
    res.json({ accounts: [] });
  }
});

// เริ่มเซิร์ฟเวอร์
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
