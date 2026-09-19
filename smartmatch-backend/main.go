package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"gorm.io/driver/mysql"
	"gorm.io/gorm"
)

var DB *gorm.DB

func main() {
	// 1. โหลดค่าจากไฟล์ .env (ถ้าอยู่บนเซิร์ฟเวอร์ Render มันจะข้ามจุดนี้ไปอ่านค่าจาก Environment ของระบบแทน)
	_ = godotenv.Load()

	// 2. ดึงค่า Connection String
	dsn := os.Getenv("DB_URL")
	if dsn == "" {
		log.Fatal("🚨 Error: ไม่พบตัวแปร DB_URL")
	}

	// 3. เชื่อมต่อฐานข้อมูลด้วย GORM
	var err error
	DB, err = gorm.Open(mysql.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatal("🚨 Failed to connect to database:", err)
	}
	fmt.Println("✅ Database Connected Successfully!")

	// 4. ตั้งค่า Web Server ด้วย Gin
	r := gin.Default()

	// API เส้นทดสอบระบบ (Health Check)
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"message": "SmartMatch API is running! 🚀",
		})
	})

	// 5. รันเซิร์ฟเวอร์
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Println("🚀 Server is running on port:", port)
	r.Run(":" + port)
}
