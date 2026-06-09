package db

import (
	"fmt"
	"log"
	"os"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"stocktraces/backend/models"
)

// DB is the global gorm DB instance
var DB *gorm.DB

// InitDB initializes the database connection.
// It checks if the target database exists, creates it if it doesn't,
// and then runs the migrations.
func InitDB() {
	host := getEnv("DB_HOST", "localhost")
	port := getEnv("DB_PORT", "5432")
	user := getEnv("DB_USER", "postgres")
	password := getEnv("DB_PASSWORD", "123456") 
	dbname := getEnv("DB_NAME", "stock_db")
	sslmode := getEnv("DB_SSLMODE", "disable")

	// 1. Connect to default 'postgres' database first to ensure the target database exists
	postgresDsn := fmt.Sprintf("host=%s user=%s password=%s dbname=postgres port=%s sslmode=%s",
		host, user, password, port, sslmode)

	tempDb, err := gorm.Open(postgres.Open(postgresDsn), &gorm.Config{})
	if err != nil {
		// Try password '123456' from docker run command if '1223456' fails
		log.Printf("Connecting with password %s failed, trying default 123456...", password)
		password = getEnv("DB_PASSWORD", "123456")
		postgresDsn = fmt.Sprintf("host=%s user=%s password=%s dbname=postgres port=%s sslmode=%s",
			host, user, password, port, sslmode)
		tempDb, err = gorm.Open(postgres.Open(postgresDsn), &gorm.Config{})
		if err != nil {
			log.Fatalf("Failed to connect to default postgres database: %v", err)
		}
	}

	// Check if the target database exists
	var count int
	err = tempDb.Raw("SELECT count(*) FROM pg_database WHERE datname = ?", dbname).Scan(&count).Error
	if err != nil {
		log.Fatalf("Failed to query pg_database: %v", err)
	}

	if count == 0 {
		log.Printf("Database '%s' does not exist. Creating it...", dbname)
		sqlDb, err := tempDb.DB()
		if err != nil {
			log.Fatalf("Failed to get raw db connection: %v", err)
		}
		_, err = sqlDb.Exec(fmt.Sprintf("CREATE DATABASE %s", dbname))
		if err != nil {
			log.Fatalf("Failed to create database '%s': %v", dbname)
		}
		log.Printf("Database '%s' created successfully.", dbname)
	}

	// Close temporary connection to 'postgres' db
	if sqlDb, err := tempDb.DB(); err == nil && sqlDb != nil {
		sqlDb.Close()
	}

	// 2. Connect to the actual target database
	dsn := fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%s sslmode=%s",
		host, user, password, dbname, port, sslmode)

	DB, err = gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("Failed to connect to database '%s': %v", dbname)
	}

	log.Printf("Database connection established for database: %s", dbname)

	// Run auto migrations for the Stock model
	if err := DB.AutoMigrate(&models.Stock{}); err != nil {
		log.Fatalf("Failed to auto migrate Stock model: %v", err)
	}
	log.Println("Database migration completed successfully.")
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
