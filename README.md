# Personal Finance Tracker

โปรเจคนี้เป็นแอปพลิเคชันเว็บสำหรับจัดการบัญชีและยอดเงินในพอร์ตการลงทุน  
คุณสามารถเพิ่ม แก้ไข และลบบัญชี รวมถึงคำนวณยอดรวมในสกุลเงิน THB (และแปลงจาก USD โดยอิงอัตราแลกเปลี่ยนเรียลไทม์)  
ส่วน backend ใช้ Node.js (Express) และข้อมูลจะถูกจัดเก็บใน MongoDB

## โครงสร้างโปรเจค

```
my-portfolio/
├── node_modules/         // โฟลเดอร์สำหรับ dependencies (ไม่อัปโหลดใน Git)
├── public/
│   └── index.html        // หน้าเว็บหลัก
├── .gitignore            // กำหนดไม่ให้ติดตาม node_modules, .env, .vercel เป็นต้น
├── package.json          // รายละเอียดโปรเจคและ dependencies
├── server.js             // โค้ดสำหรับเซิร์ฟเวอร์ Node.js (Express)
├── .env_example          // ตัวอย่างไฟล์ Environment Variables (คัดลอกไปเป็น .env แล้วตั้งค่าเอง)
└── README.md             // ไฟล์นี้
```


## การติดตั้ง

1. **Prerequisites:**  
   ติดตั้ง [Node.js](https://nodejs.org) ให้เรียบร้อย

2. **Clone โปรเจค:**

   ```bash
   git clone <repository-url>
   cd my-portfolio
   ```

3. **ติดตั้ง Dependencies:**

   ```bash
   npm install
   ```

4. **ตั้งค่า Environment Variables:**  
   - คัดลอกไฟล์ `.env_example` ไปเป็น `.env`:
     
     ```bash
     cp .env_example .env
     ```
     
   - เปิดไฟล์ `.env` แล้วตั้งค่าตัวแปรต่าง ๆ ให้ตรงกับของคุณ:
     
     ```
     PORT=3000
     SESSION_SECRET=your_session_secret_here
     GOOGLE_CLIENT_ID=your_google_client_id_here
     GOOGLE_CLIENT_SECRET=your_google_client_secret_here
     DEVMODE=true         # ตั้งเป็น false ใน production
     MONGO_URI=your_mongodb_connection_string_here
     ```

## การรันโปรเจค

1. **เริ่มเซิร์ฟเวอร์ Node.js:**

   ```bash
   node server.js
   ```

2. **เข้าถึงแอปพลิเคชัน:**  
   เปิดเว็บเบราว์เซอร์แล้วเข้าไปที่ [http://localhost:3000](http://localhost:3000)

## ฟังก์ชันการทำงาน

- **เพิ่ม/แก้ไข/ลบบัญชี:**  
  ใช้ฟอร์มบนหน้าเว็บเพื่อจัดการบัญชีและยอดเงิน

- **คำนวณยอดรวม:**  
  ระบบคำนวณยอดรวมในสกุลเงิน THB และแปลงจาก USD โดยใช้อัตราแลกเปลี่ยนเรียลไทม์

- **บันทึกและโหลดข้อมูล:**  
  เมื่อกดปุ่ม **Save Data** ข้อมูลจะถูกส่งไปยัง API ที่บันทึกข้อมูลใน MongoDB (ในฐานข้อมูล "finance" และ collection "accounts")  
  ปุ่ม **Load Data** จะดึงข้อมูลจาก MongoDB ตามผู้ใช้ที่ล็อกอิน (โดยใช้ Google Authentication)  
  (ในโหมดพัฒนา หากตั้งค่า `DEVMODE=true` ผู้ใช้สามารถใช้ admin credentials เพื่อทดสอบ)

- **Google Authentication:**  
  ผู้ใช้สามารถลงชื่อเข้าใช้ด้วยบัญชี Google  
  (ในโหมดพัฒนา คุณสามารถล็อกอินด้วย admin/admin ได้หาก `DEVMODE=true`)

## การจัดการ Git

ไฟล์และโฟลเดอร์ต่อไปนี้จะถูกละเว้น (ignored) ไม่ให้ commit ลงใน Git:

```
/node_modules
.env
.vercel
```

หากคุณเคย commit ไฟล์หรือโฟลเดอร์เหล่านี้ไปแล้ว ให้ใช้คำสั่งต่อไปนี้เพื่อรีเฟรช Git cache:

```bash
git rm --cached -r node_modules
git rm --cached .env
git rm --cached -r .vercel
git add .
git commit -m "Refresh .gitignore to exclude node_modules, .env, and .vercel"
git push
```

## หมายเหตุเพิ่มเติม

- **Frontend:**  
  ใช้ HTML, Tailwind CSS และ JavaScript โดยดึงอัตราแลกเปลี่ยนเรียลไทม์จาก API ภายนอก

- **Backend:**  
  ใช้ Express ในการจัดการ API สำหรับบันทึกและโหลดข้อมูล และใช้ MongoDB เพื่อเก็บข้อมูลผู้ใช้และบัญชี  
  (ข้อมูลจะถูกเก็บในฐานข้อมูล "finance" ใน collection "accounts")

- **Deployment:**  
  โปรเจคนี้สามารถ deploy ขึ้นแพลตฟอร์มอย่าง Vercel ได้  
  อย่าลืมตั้งค่า Environment Variables บนแพลตฟอร์ม deployment ตามที่ได้ระบุในไฟล์ `.env_example`

โปรเจคนี้เปิดให้พัฒนาและปรับปรุงเพิ่มเติมได้ตามความต้องการของคุณ!
