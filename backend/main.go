package main

import (
	"encoding/json"
	"log"
	"net/http"

	"stocktraces/backend/db"
	"stocktraces/backend/handlers"
	"stocktraces/backend/services"
)

type HealthResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	response := HealthResponse{
		Status:  "ok",
		Message: "StockTraces Go Backend is running",
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding response: %v", err)
	}
}

func main() {
	// Initialize database and run migrations
	db.InitDB()

	// Run stock sync asynchronously in a background goroutine to prevent blocking server startup
	go services.SyncAllStocks(db.DB)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/health", healthHandler)
	mux.HandleFunc("/api/stocks", handlers.GetStocks)
	mux.HandleFunc("/api/stocks/stats", handlers.GetStockStats)
	mux.HandleFunc("/api/hk-stocks", handlers.GetHkStocks)
	mux.HandleFunc("/api/hk-stocks/stats", handlers.GetHkStockStats)
	mux.HandleFunc("/api/us-stocks", handlers.GetUsStocks)
	mux.HandleFunc("/api/us-stocks/stats", handlers.GetUsStockStats)
	mux.HandleFunc("/api/exchange-rates", handlers.GetExchangeRates)
	mux.HandleFunc("/api/futures", handlers.GetFutures)
	mux.HandleFunc("/api/indices", handlers.GetIndices)
	mux.HandleFunc("/api/industries", handlers.GetIndustries)
	mux.HandleFunc("/api/etfs", handlers.GetEtfs)
	mux.HandleFunc("/api/etfs/stats", handlers.GetEtfStats)
	mux.HandleFunc("/api/funds", handlers.GetFunds)
	mux.HandleFunc("/api/funds/stats", handlers.GetFundStats)

	port := ":8080"
	log.Printf("Server starting on port %s...", port)
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
