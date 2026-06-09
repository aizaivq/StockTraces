package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"stocktraces/backend/db"
)

// ExchangeStats represents the database raw query scan target.
type ExchangeStats struct {
	Exchange  string `gorm:"column:exchange"`
	Total     int64  `gorm:"column:total"`
	Rise      int64  `gorm:"column:rise"`
	Fall      int64  `gorm:"column:fall"`
	Flat      int64  `gorm:"column:flat"`
	LimitUp   int64  `gorm:"column:limit_up"`
	LimitDown int64  `gorm:"column:limit_down"`
}

// MarketStats represents the final structured stats returned for each exchange.
type MarketStats struct {
	Total     int64 `json:"total"`
	Rise      int64 `json:"rise"`
	Fall      int64 `json:"fall"`
	Flat      int64 `json:"flat"`
	LimitUp   int64 `json:"limit_up"`
	LimitDown int64 `json:"limit_down"`
}

// GetStockStats handles GET requests to retrieve statistics of A-shares.
func GetStockStats(w http.ResponseWriter, r *http.Request) {
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

	// Validate required _appver parameter
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

	// SQL Query: grouping stocks by exchange (sh, sz, bj) and calculating counts.
	// Limits:
	// - bj (BSE): 30% limit (zdf >= 29.9% / <= -29.9%)
	// - sz30 (ChiNext) / sh68 (STAR): 20% limit (zdf >= 19.9% / <= -19.9%)
	// - ST stock (name contains ST or *ST): 5% limit (zdf >= 4.9% / <= -4.9%)
	// - others (Main boards): 10% limit (zdf >= 9.9% / <= -9.9%)
	sqlQuery := `
		SELECT 
			CASE 
				WHEN code LIKE 'sh68%' THEN 'sh_kcb'
				WHEN code LIKE 'sh%' THEN 'sh_main'
				WHEN code LIKE 'sz30%' THEN 'sz_cyb'
				WHEN code LIKE 'sz%' THEN 'sz_main'
				WHEN code LIKE 'bj%' THEN 'bj'
				ELSE 'other' 
			END as exchange,
			COUNT(*) as total,
			SUM(CASE WHEN zdf > 0 THEN 1 ELSE 0 END) as rise,
			SUM(CASE WHEN zdf < 0 THEN 1 ELSE 0 END) as fall,
			SUM(CASE WHEN zdf = 0 THEN 1 ELSE 0 END) as flat,
			SUM(CASE WHEN 
				(code LIKE 'bj%' AND zdf >= 29.9) OR
				((code LIKE 'sz30%' OR code LIKE 'sh68%') AND zdf >= 19.9) OR
				((name LIKE '%ST%' OR name LIKE '%*ST%') AND zdf >= 4.9 AND code NOT LIKE 'bj%' AND code NOT LIKE 'sz30%' AND code NOT LIKE 'sh68%') OR
				(zdf >= 9.9 AND code NOT LIKE 'bj%' AND code NOT LIKE 'sz30%' AND code NOT LIKE 'sh68%' AND name NOT LIKE '%ST%' AND name NOT LIKE '%*ST%')
			THEN 1 ELSE 0 END) as limit_up,
			SUM(CASE WHEN 
				(code LIKE 'bj%' AND zdf <= -29.9) OR
				((code LIKE 'sz30%' OR code LIKE 'sh68%') AND zdf <= -19.9) OR
				((name LIKE '%ST%' OR name LIKE '%*ST%') AND zdf <= -4.9 AND code NOT LIKE 'bj%' AND code NOT LIKE 'sz30%' AND code NOT LIKE 'sh68%') OR
				(zdf <= -9.9 AND code NOT LIKE 'bj%' AND code NOT LIKE 'sz30%' AND code NOT LIKE 'sh68%' AND name NOT LIKE '%ST%' AND name NOT LIKE '%*ST%')
			THEN 1 ELSE 0 END) as limit_down
		FROM stocks
		GROUP BY exchange;
	`

	var results []ExchangeStats
	if err := db.DB.Raw(sqlQuery).Scan(&results).Error; err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		log.Printf("Error querying stock statistics: %v", err)
		return
	}

	// Initialize individual market stats
	shMainStats := MarketStats{}
	shKcbStats := MarketStats{}
	szMainStats := MarketStats{}
	szCybStats := MarketStats{}
	bjStats := MarketStats{}
	summary := MarketStats{}

	// Map database results
	for _, res := range results {
		stats := MarketStats{
			Total:     res.Total,
			Rise:      res.Rise,
			Fall:      res.Fall,
			Flat:      res.Flat,
			LimitUp:   res.LimitUp,
			LimitDown: res.LimitDown,
		}

		switch res.Exchange {
		case "sh_main":
			shMainStats = stats
		case "sh_kcb":
			shKcbStats = stats
		case "sz_main":
			szMainStats = stats
		case "sz_cyb":
			szCybStats = stats
		case "bj":
			bjStats = stats
		}

		// Accumulate overall summary
		summary.Total += res.Total
		summary.Rise += res.Rise
		summary.Fall += res.Fall
		summary.Flat += res.Flat
		summary.LimitUp += res.LimitUp
		summary.LimitDown += res.LimitDown
	}

	// Return formatted response
	response := map[string]interface{}{
		"code": 0,
		"msg":  "ok",
		"data": map[string]interface{}{
			"sh_main": shMainStats,
			"sh_kcb":  shKcbStats,
			"sz_main": szMainStats,
			"sz_cyb":  szCybStats,
			"bj":      bjStats,
			"summary": summary,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding stats response: %v", err)
	}
}
