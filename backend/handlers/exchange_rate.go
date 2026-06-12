package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"stocktraces/backend/db"
	"stocktraces/backend/models"
)

type ExchangeRateResponse struct {
	Code int                   `json:"code"`
	Data []models.ExchangeRate `json:"data"`
	Msg  string                `json:"msg"`
}

// GetExchangeRates handles GET requests for exchange rates.
// It checks the _appver query parameter and returns all exchange rates sorted by code.
func GetExchangeRates(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Validate _appver query param
	appVer := r.URL.Query().Get("_appver")
	if appVer == "" {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"code": 400,
			"msg":  "_appver parameter is required",
		})
		return
	}

	var rates []models.ExchangeRate
	if err := db.DB.Order("code ASC").Find(&rates).Error; err != nil {
		log.Printf("Error querying exchange rates: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"code": 500,
			"msg":  "Internal database error",
		})
		return
	}

	response := ExchangeRateResponse{
		Code: 0,
		Data: rates,
		Msg:  "ok",
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode exchange rates response: %v", err)
	}
}
