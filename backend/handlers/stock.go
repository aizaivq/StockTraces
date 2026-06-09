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

// GetStocks handles GET requests to fetch paginated, sorted, and searched stock list data.
func GetStocks(w http.ResponseWriter, r *http.Request) {
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

	// 1. Pagination parameters (limit and offset)
	limitVal := 20
	if limitStr := query.Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			if l > 200 {
				limitVal = 200 // Cap limit to 200 to protect server memory
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

	// 2. Keyword search parameter
	keyword := query.Get("keyword")

	// 3. Sorting parameters
	sortBy := query.Get("sort_by")
	order := strings.ToLower(query.Get("order"))

	// 4. Board filter parameter
	board := query.Get("board")

	// Whitelist allowed sort fields to prevent SQL injection
	allowedSortColumns := map[string]string{
		"code":       "code",
		"name":       "name",
		"zxj":        "zxj",
		"zd":         "zd",
		"zdf":        "zdf",
		"hsl":        "hsl",
		"zf":         "zf",
		"volume":     "volume",
		"turnover":   "turnover",
		"ltsz":       "ltsz",
		"zsz":        "zsz",
		"pe_ttm":     "pe_ttm",
		"pn":         "pn",
		"lb":         "lb",
		"speed":      "speed",
		"state":      "state",
		"stock_type": "stock_type",
		"zljlr":      "zljlr",
	}

	sortColumn, ok := allowedSortColumns[strings.ToLower(sortBy)]
	if !ok {
		sortColumn = "code" // Default sorting
	}

	if order != "desc" {
		order = "asc" // Default ordering direction
	}

	// Build GORM Query
	tx := db.DB.Model(&models.Stock{})

	if board != "" {
		switch strings.ToLower(board) {
		case "main":
			tx = tx.Where("stock_type = ?", "GP-A")
		case "cyb":
			tx = tx.Where("stock_type = ?", "GP-A-CYB")
		case "kcb":
			tx = tx.Where("stock_type = ?", "GP-A-KCB")
		case "bj":
			tx = tx.Where("stock_type = ?", "GP")
		}
	}

	if keyword != "" {
		// Use ILIKE for case-insensitive search in PostgreSQL
		searchPattern := "%" + keyword + "%"
		tx = tx.Where("code ILIKE ? OR name ILIKE ?", searchPattern, searchPattern)
	}

	// Get total matching count for pagination metadata
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		log.Printf("Error counting stocks: %v", err)
		return
	}

	// Retrieve paginated records
	var stocks []models.Stock
	orderClause := fmt.Sprintf("%s %s", sortColumn, order)
	if err := tx.Order(orderClause).Limit(limitVal).Offset(offsetVal).Find(&stocks).Error; err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		log.Printf("Error fetching stocks list: %v", err)
		return
	}

	// Format response
	response := map[string]interface{}{
		"code": 0,
		"msg":  "ok",
		"data": map[string]interface{}{
			"list":   stocks,
			"total":  total,
			"limit":  limitVal,
			"offset": offsetVal,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding stock list response: %v", err)
	}
}
