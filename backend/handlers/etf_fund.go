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

// GetEtfs handles GET requests to fetch paginated, sorted, and searched ETF data.
func GetEtfs(w http.ResponseWriter, r *http.Request) {
	handleGetEtfsOrFunds(w, r, "ETF")
}

// GetFunds handles GET requests to fetch paginated, sorted, and searched Open-end Mutual Fund data.
func GetFunds(w http.ResponseWriter, r *http.Request) {
	handleGetEtfsOrFunds(w, r, "FUND")
}

func handleGetEtfsOrFunds(w http.ResponseWriter, r *http.Request, stockType string) {
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

	// Whitelist allowed sort fields to prevent SQL injection
	allowedSortColumns := map[string]string{
		"code":  "code",
		"name":  "name",
		"zxj":   "zxj",
		"zd":    "zd",
		"zdf":   "zdf",
		"ljjz":  "ljjz",
		"state": "state", // state stores the net value date (FSRQ)
	}

	sortColumn, ok := allowedSortColumns[strings.ToLower(sortBy)]
	if !ok {
		sortColumn = "code" // Default sorting
	}

	if order != "desc" {
		order = "asc" // Default ordering direction
	}

	// Build GORM Query
	tx := db.DB.Model(&models.Stock{}).Where("stock_type = ?", stockType)

	if keyword != "" {
		// Remove 'of', 'sh', 'sz' prefix for search convenience
		searchPattern := "%" + keyword + "%"
		cleanedKeyword := keyword
		if strings.HasPrefix(strings.ToLower(keyword), "of") && len(keyword) > 2 {
			cleanedKeyword = keyword[2:]
		} else if (strings.HasPrefix(strings.ToLower(keyword), "sh") || strings.HasPrefix(strings.ToLower(keyword), "sz")) && len(keyword) > 2 {
			cleanedKeyword = keyword[2:]
		}
		cleanPattern := "%" + cleanedKeyword + "%"

		tx = tx.Where("code ILIKE ? OR name ILIKE ? OR code ILIKE ?", searchPattern, searchPattern, cleanPattern)
	}

	// Get total matching count for pagination metadata
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		log.Printf("Error counting etfs/funds: %v", err)
		return
	}

	// Retrieve paginated records
	var items []models.Stock
	orderClause := fmt.Sprintf("%s %s", sortColumn, order)
	if err := tx.Order(orderClause).Limit(limitVal).Offset(offsetVal).Find(&items).Error; err != nil {
		http.Error(w, "Database error", http.StatusInternalServerError)
		log.Printf("Error fetching etfs/funds list: %v", err)
		return
	}

	// Format response
	response := map[string]interface{}{
		"code": 0,
		"msg":  "ok",
		"data": map[string]interface{}{
			"list":   items,
			"total":  total,
			"limit":  limitVal,
			"offset": offsetVal,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding etfs/funds response: %v", err)
	}
}

// GetEtfStats handles GET requests to retrieve statistics of ETFs.
func GetEtfStats(w http.ResponseWriter, r *http.Request) {
	handleGetEtfOrFundStats(w, r, "ETF")
}

// GetFundStats handles GET requests to retrieve statistics of Open-end Mutual Funds.
func GetFundStats(w http.ResponseWriter, r *http.Request) {
	handleGetEtfOrFundStats(w, r, "FUND")
}

func handleGetEtfOrFundStats(w http.ResponseWriter, r *http.Request, stockType string) {
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

	// 1. Basic Counts (Total, Rise, Fall, Flat, Average Net Value)
	var stats struct {
		Total      int64   `gorm:"column:total"`
		Rise       int64   `gorm:"column:rise"`
		Fall       int64   `gorm:"column:fall"`
		Flat       int64   `gorm:"column:flat"`
		AverageNav float64 `gorm:"column:average_nav"`
	}

	sqlQuery := `
		SELECT 
			COUNT(*) as total,
			SUM(CASE WHEN zdf > 0 THEN 1 ELSE 0 END) as rise,
			SUM(CASE WHEN zdf < 0 THEN 1 ELSE 0 END) as fall,
			SUM(CASE WHEN zdf = 0 THEN 1 ELSE 0 END) as flat,
			COALESCE(AVG(zxj), 0) as average_nav
		FROM stocks
		WHERE stock_type = ?;
	`

	if err := db.DB.Raw(sqlQuery, stockType).Scan(&stats).Error; err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		log.Printf("Error querying %s stats: %v", stockType, err)
		return
	}

	// 2. Top Gainer (max zdf)
	var topGainer models.Stock
	err1 := db.DB.Where("stock_type = ? AND zdf > 0", stockType).Order("zdf DESC").First(&topGainer).Error

	// 3. Top Loser (min zdf)
	var topLoser models.Stock
	err2 := db.DB.Where("stock_type = ? AND zdf < 0", stockType).Order("zdf ASC").First(&topLoser).Error

	// 4. Format Response
	data := map[string]interface{}{
		"total":       stats.Total,
		"rise":        stats.Rise,
		"fall":        stats.Fall,
		"flat":        stats.Flat,
		"average_nav": stats.AverageNav,
	}

	if err1 == nil {
		data["top_gainer"] = topGainer
	} else {
		data["top_gainer"] = nil
	}

	if err2 == nil {
		data["top_loser"] = topLoser
	} else {
		data["top_loser"] = nil
	}

	response := map[string]interface{}{
		"code": 0,
		"msg":  "ok",
		"data": data,
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding %s stats response: %v", stockType, err)
	}
}
