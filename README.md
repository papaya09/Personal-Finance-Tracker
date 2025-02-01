# Portfolio Summary Project

โปรเจคนี้เป็นแอปพลิเคชันเว็บสำหรับจัดการบัญชีและยอดเงินในพอร์ตการลงทุน โดยสามารถเพิ่ม แก้ไข ลบบัญชี และคำนวณยอดรวมในสกุลเงิน THB และ USD อีกทั้งยังมีฟังก์ชันสำหรับบันทึกและโหลดข้อมูลผ่าน API ของเซิร์ฟเวอร์ Node.js (Express)

## โครงสร้างโปรเจค

```
my-portfolio/
├── node_modules/         // โฟลเดอร์สำหรับ dependencies (ไม่อัปโหลดใน Git)
├── public/
│   └── index.html        // หน้าเว็บหลัก
├── save/                 // โฟลเดอร์สำหรับเก็บไฟล์ JSON (ไม่อัปโหลดใน Git)
├── .gitignore            // กำหนดไม่ให้ติดตาม node_modules และ save
├── package.json          // รายละเอียดโปรเจคและ dependencies
├── server.js             // โค้ดสำหรับเซิร์ฟเวอร์ Node.js (Express)
└── README.md             // ไฟล์นี้
```

## การติดตั้ง

1. **Prerequisites:**  
   ติดตั้ง [Node.js](https://nodejs.org) ให้เรียบร้อย

2. **Clone โปรเจค:**

   ```
   git clone <repository-url>
   cd my-portfolio
   ```

3. **ติดตั้ง Dependencies:**

   ```
   npm install
   ```

## การรันโปรเจค

1. **เริ่มเซิร์ฟเวอร์ Node.js:**

   ```
   node server.js
   ```

2. **เข้าถึงแอปพลิเคชัน:**  
   เปิดเว็บเบราว์เซอร์แล้วเข้าไปที่ [http://localhost:3000](http://localhost:3000)

## ฟังก์ชันการทำงาน

- **เพิ่ม/แก้ไข/ลบบัญชี:**  
  ใช้ฟอร์มบนหน้าเว็บในการจัดการบัญชีและยอดเงิน

- **คำนวณยอดรวม:**  
  ระบบคำนวณยอดรวมในสกุลเงิน THB และ USD โดยอิงอัตราแลกเปลี่ยนเรียลไทม์

- **บันทึกข้อมูล:**  
  กดปุ่ม **Save Data** เพื่อส่งข้อมูลไปยังเซิร์ฟเวอร์และบันทึกลงไฟล์ในโฟลเดอร์ `save`

- **โหลดข้อมูล:**  
  กดปุ่ม **Load Data** เพื่อดึงข้อมูลจากไฟล์ในโฟลเดอร์ `save` และอัปเดตตารางในหน้าเว็บ

## การจัดการ Git

ในไฟล์ **.gitignore** ได้กำหนดให้ไม่ติดตามโฟลเดอร์ `node_modules` และ `save` ดังนี้:

```
/node_modules
/save
```

หากคุณเคย commit โฟลเดอร์เหล่านี้ไปแล้ว ให้ใช้คำสั่งต่อไปนี้เพื่อรีเฟรช Git Cache:

```
git rm -r --cached node_modules
git rm -r --cached save
git add .
git commit -m "Refresh .gitignore to exclude node_modules and save folder"
git push
```

## หมายเหตุ

- Frontend ใช้ HTML, CSS และ JavaScript โดยดึงข้อมูลอัตราแลกเปลี่ยนเรียลไทม์จาก API
- Backend ใช้ Express สำหรับจัดการ API ในการบันทึกและโหลดข้อมูล

โปรเจคนี้เปิดให้พัฒนาและปรับปรุงเพิ่มเติมได้ตามความต้องการ
