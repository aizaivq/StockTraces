package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"

	"stocktraces/backend/db"
	"stocktraces/backend/models"
)

// UsStockResponseItem represents the formatted stock details sent to the frontend.
type UsStockResponseItem struct {
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Zxj       float64 `json:"zxj"`
	Zd        float64 `json:"zd"`
	Zdf       float64 `json:"zdf"`
	Hsl       float64 `json:"hsl"`
	Zf        float64 `json:"zf"`
	Volume    float64 `json:"volume"`
	Turnover  float64 `json:"turnover"`
	Ltsz      float64 `json:"ltsz"`
	Zsz       float64 `json:"zsz"`
	PeRatio   float64 `json:"pe_ratio"`
	StockType string  `json:"stock_type"`
}

// GetUsStocks handles GET requests to fetch US stocks from the local database.
func GetUsStocks(w http.ResponseWriter, r *http.Request) {
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

	query := r.URL.Query()

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

	limitVal := 20
	if limitStr := query.Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			if l > 200 {
				limitVal = 200
			} else {
				limitVal = l
			}
		}
	}

	offsetVal := 0
	if offsetStr := query.Get("offset"); offsetStr != "" {
		if o, err := strconv.Atoi(offsetStr); err == nil && o >= 0 {
			offsetVal = o
		}
	}

	keyword := query.Get("keyword")
	sortBy := query.Get("sort_by")
	order := strings.ToLower(query.Get("order"))

	// Whitelist allowed sort fields to prevent SQL injection
	allowedSortColumns := map[string]string{
		"code":     "code",
		"name":     "name",
		"zxj":      "zxj",
		"zd":       "zd",
		"zdf":      "zdf",
		"volume":   "volume",
		"turnover": "turnover",
		"pe_ratio": "pe_ttm",
	}

	sortColumn, ok := allowedSortColumns[strings.ToLower(sortBy)]
	if !ok {
		sortColumn = "code" // Default sorting
	}

	if order != "desc" {
		order = "asc" // Default ordering direction
	}

	board := query.Get("board")

	// Build GORM Query
	tx := db.DB.Model(&models.Stock{})

	switch strings.ToLower(board) {
	case "cdr":
		tx = tx.Where("stock_type LIKE ?", "%GP-US-CDR%")
	case "tec":
		tx = tx.Where("stock_type LIKE ?", "%GP-US-TEC%")
	default:
		tx = tx.Where("stock_type LIKE ? OR stock_type LIKE ?", "%GP-US-CDR%", "%GP-US-TEC%")
	}

	if keyword != "" {
		searchPattern := "%" + keyword + "%"
		tx = tx.Where("code ILIKE ? OR name ILIKE ?", searchPattern, searchPattern)
	}

	// Get total matching count
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		log.Printf("Error counting US stocks: %v", err)
		return
	}

	// Retrieve paginated records
	var dbStocks []models.Stock
	orderClause := fmt.Sprintf("%s %s", sortColumn, order)
	if err := tx.Order(orderClause).Limit(limitVal).Offset(offsetVal).Find(&dbStocks).Error; err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		log.Printf("Error fetching US stocks list: %v", err)
		return
	}

	// Convert database records to UsStockResponseItem
	responseStocks := make([]UsStockResponseItem, len(dbStocks))
	for i, s := range dbStocks {
		cleanCode := strings.TrimPrefix(s.Code, "us")

		responseStocks[i] = UsStockResponseItem{
			Code:      cleanCode,
			Name:      s.Name,
			Zxj:       s.Zxj,
			Zd:        s.Zd,
			Zdf:       s.Zdf,
			Hsl:       s.Hsl,
			Zf:        s.Zf,
			Volume:    s.Volume * 100.0,     // Restore volume to shares
			Turnover:  s.Turnover * 10000.0, // Restore turnover to USD
			Ltsz:      s.Ltsz,               // in 100m USD
			Zsz:       s.Zsz,                // in 100m USD
			PeRatio:   s.PeTtm,
			StockType: s.StockType,
		}
	}

	// Format response
	response := map[string]interface{}{
		"code": 0,
		"msg":  "ok",
		"data": map[string]interface{}{
			"list":   responseStocks,
			"total":  total,
			"limit":  limitVal,
			"offset": offsetVal,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding US stock list response: %v", err)
	}
}
