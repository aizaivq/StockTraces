package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"stocktraces/backend/db"
	"stocktraces/backend/models"
)

type FuturesResponse struct {
	Code int             `json:"code"`
	Data []models.Future `json:"data"`
	Msg  string          `json:"msg"`
}

// GetFutures handles GET requests for commodities/futures.
// It checks the _appver query parameter and returns all futures.
func GetFutures(w http.ResponseWriter, r *http.Request) {
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

	var futures []models.Future
	if err := db.DB.Order("category ASC, code ASC").Find(&futures).Error; err != nil {
		log.Printf("Error querying futures: %v", err)
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"code": 500,
			"msg":  "Internal database error",
		})
		return
	}

	response := FuturesResponse{
		Code: 0,
		Data: futures,
		Msg:  "ok",
	}

	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Failed to encode futures response: %v", err)
	}
}
