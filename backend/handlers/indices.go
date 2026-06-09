package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/go-resty/resty/v2"
)

// GetIndices handles GET requests to fetch global stock indices data from Tencent Finance API.
func GetIndices(w http.ResponseWriter, r *http.Request) {
	// Enable CORS
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == "OPTIONS" {
		w.WriteHeader(http.StatusOK)
		return
	}

	if r.Method != "GET" {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Parse Query Parameters
	query := r.URL.Query()

	// Validate required _appver parameter
	appVer := query.Get("_appver")
	if appVer == "" {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"code": 400,
			"msg":  "_appver parameter is required",
		})
		return
	}

	// Initialize Resty client
	client := resty.New()
	client.SetTimeout(10 * time.Second)
	client.SetHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	// Call Tencent Finance API
	url := "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/rank/indexRankDetail2"
	resp, err := client.R().
		SetQueryParam("_appver", appVer).
		Get(url)

	if err != nil {
		log.Printf("Error calling Tencent indices API: %v", err)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"code": 500,
			"msg":  "Tencent API request failed",
		})
		return
	}

	// Forward response to client
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(resp.StatusCode())
	_, _ = w.Write(resp.Body())
}
