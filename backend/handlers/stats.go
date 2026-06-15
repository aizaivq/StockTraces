package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sort"
	"strconv"
	"time"

	"github.com/go-resty/resty/v2"

	"stocktraces/backend/db"
)

// ExchangeStats represents the database raw query scan target.
type ExchangeStats struct {
	Exchange  string  `gorm:"column:exchange"`
	Total     int64   `gorm:"column:total"`
	Rise      int64   `gorm:"column:rise"`
	Fall      int64   `gorm:"column:fall"`
	Flat      int64   `gorm:"column:flat"`
	LimitUp   int64   `gorm:"column:limit_up"`
	LimitDown int64   `gorm:"column:limit_down"`
	AvgZdf    float64 `gorm:"column:avg_zdf"`
	MedianZdf float64 `gorm:"column:median_zdf"`
}

// MarketStats represents the final structured stats returned for each exchange.
type MarketStats struct {
	Total     int64   `json:"total"`
	Rise      int64   `json:"rise"`
	Fall      int64   `json:"fall"`
	Flat      int64   `json:"flat"`
	LimitUp   int64   `json:"limit_up"`
	LimitDown int64   `json:"limit_down"`
	AvgZdf    float64 `json:"avg_zdf"`
	MedianZdf float64 `json:"median_zdf"`
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
			THEN 1 ELSE 0 END) as limit_down,
			AVG(zdf) as avg_zdf,
			percentile_cont(0.5) WITHIN GROUP (ORDER BY zdf) as median_zdf
		FROM stocks
		WHERE stock_type IN ('GP-A', 'GP-A-CYB', 'GP-A-KCB', 'GP')
		GROUP BY exchange;
	`

	var results []ExchangeStats
	if err := db.DB.Raw(sqlQuery).Scan(&results).Error; err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		log.Printf("Error querying stock statistics: %v", err)
		return
	}

	summarySqlQuery := `
		SELECT 
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
			THEN 1 ELSE 0 END) as limit_down,
			AVG(zdf) as avg_zdf,
			percentile_cont(0.5) WITHIN GROUP (ORDER BY zdf) as median_zdf
		FROM stocks
		WHERE stock_type IN ('GP-A', 'GP-A-CYB', 'GP-A-KCB', 'GP');
	`

	var summaryRes ExchangeStats
	if err := db.DB.Raw(summarySqlQuery).Scan(&summaryRes).Error; err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		log.Printf("Error querying A-share summary statistics: %v", err)
		return
	}

	// Initialize individual market stats
	shMainStats := MarketStats{}
	shKcbStats := MarketStats{}
	szMainStats := MarketStats{}
	szCybStats := MarketStats{}
	bjStats := MarketStats{}
	summary := MarketStats{
		Total:     summaryRes.Total,
		Rise:      summaryRes.Rise,
		Fall:      summaryRes.Fall,
		Flat:      summaryRes.Flat,
		LimitUp:   summaryRes.LimitUp,
		LimitDown: summaryRes.LimitDown,
		AvgZdf:    summaryRes.AvgZdf,
		MedianZdf: summaryRes.MedianZdf,
	}

	// Map database results
	for _, res := range results {
		stats := MarketStats{
			Total:     res.Total,
			Rise:      res.Rise,
			Fall:      res.Fall,
			Flat:      res.Flat,
			LimitUp:   res.LimitUp,
			LimitDown: res.LimitDown,
			AvgZdf:    res.AvgZdf,
			MedianZdf: res.MedianZdf,
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
	}

	// Fetch industry sector statistics
	sectorStats, err := getIndustrySectorStats()
	if err != nil {
		log.Printf("Warning: Failed to fetch industry sector stats: %v", err)
		sectorStats = map[string]interface{}{
			"total":       0,
			"rise":        0,
			"fall":        0,
			"flat":        0,
			"top_gainers": []interface{}{},
			"top_losers":  []interface{}{},
		}
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
			"sectors": sectorStats,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding stats response: %v", err)
	}
}

// GetHkStockStats handles GET requests to retrieve statistics of HK stocks.
func GetHkStockStats(w http.ResponseWriter, r *http.Request) {
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

	// SQL Query grouping by stock_type for HK boards.
	// Virtual limit ups: zdf >= 10.0
	// Virtual limit downs: zdf <= -10.0
	sqlQuery := `
		SELECT 
			CASE 
				WHEN stock_type IN ('GP-HK', 'GP-HK-AH') THEN 'hk_main'
				WHEN stock_type = 'GP-HK-GEM' THEN 'hk_gem'
				ELSE 'other' 
			END as exchange,
			COUNT(*) as total,
			SUM(CASE WHEN zdf > 0 THEN 1 ELSE 0 END) as rise,
			SUM(CASE WHEN zdf < 0 THEN 1 ELSE 0 END) as fall,
			SUM(CASE WHEN zdf = 0 THEN 1 ELSE 0 END) as flat,
			SUM(CASE WHEN zdf >= 10.0 THEN 1 ELSE 0 END) as limit_up,
			SUM(CASE WHEN zdf <= -10.0 THEN 1 ELSE 0 END) as limit_down,
			AVG(zdf) as avg_zdf,
			percentile_cont(0.5) WITHIN GROUP (ORDER BY zdf) as median_zdf
		FROM stocks
		WHERE stock_type IN ('GP-HK', 'GP-HK-GEM', 'GP-HK-AH')
		GROUP BY exchange;
	`

	var results []ExchangeStats
	if err := db.DB.Raw(sqlQuery).Scan(&results).Error; err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		log.Printf("Error querying HK stock statistics: %v", err)
		return
	}

	summarySqlQuery := `
		SELECT 
			COUNT(*) as total,
			SUM(CASE WHEN zdf > 0 THEN 1 ELSE 0 END) as rise,
			SUM(CASE WHEN zdf < 0 THEN 1 ELSE 0 END) as fall,
			SUM(CASE WHEN zdf = 0 THEN 1 ELSE 0 END) as flat,
			SUM(CASE WHEN zdf >= 10.0 THEN 1 ELSE 0 END) as limit_up,
			SUM(CASE WHEN zdf <= -10.0 THEN 1 ELSE 0 END) as limit_down,
			AVG(zdf) as avg_zdf,
			percentile_cont(0.5) WITHIN GROUP (ORDER BY zdf) as median_zdf
		FROM stocks
		WHERE stock_type IN ('GP-HK', 'GP-HK-GEM', 'GP-HK-AH');
	`

	var summaryRes ExchangeStats
	if err := db.DB.Raw(summarySqlQuery).Scan(&summaryRes).Error; err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		log.Printf("Error querying HK stock summary statistics: %v", err)
		return
	}

	hkMainStats := MarketStats{}
	hkGemStats := MarketStats{}
	summary := MarketStats{
		Total:     summaryRes.Total,
		Rise:      summaryRes.Rise,
		Fall:      summaryRes.Fall,
		Flat:      summaryRes.Flat,
		LimitUp:   summaryRes.LimitUp,
		LimitDown: summaryRes.LimitDown,
		AvgZdf:    summaryRes.AvgZdf,
		MedianZdf: summaryRes.MedianZdf,
	}

	for _, res := range results {
		stats := MarketStats{
			Total:     res.Total,
			Rise:      res.Rise,
			Fall:      res.Fall,
			Flat:      res.Flat,
			LimitUp:   res.LimitUp,
			LimitDown: res.LimitDown,
			AvgZdf:    res.AvgZdf,
			MedianZdf: res.MedianZdf,
		}

		switch res.Exchange {
		case "hk_main":
			hkMainStats = stats
		case "hk_gem":
			hkGemStats = stats
		}
	}

	response := map[string]interface{}{
		"code": 0,
		"msg":  "ok",
		"data": map[string]interface{}{
			"hk_main": hkMainStats,
			"hk_gem":  hkGemStats,
			"summary": summary,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding HK stats response: %v", err)
	}
}

// GetUsStockStats handles GET requests to retrieve statistics of US stocks.
func GetUsStockStats(w http.ResponseWriter, r *http.Request) {
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

	// SQL Query with UNION ALL to handle overlapping stock_type records
	sqlQuery := `
		SELECT 'us_cdr' as exchange, COUNT(*) as total,
			SUM(CASE WHEN zdf > 0 THEN 1 ELSE 0 END) as rise,
			SUM(CASE WHEN zdf < 0 THEN 1 ELSE 0 END) as fall,
			SUM(CASE WHEN zdf = 0 THEN 1 ELSE 0 END) as flat,
			SUM(CASE WHEN zdf >= 10.0 THEN 1 ELSE 0 END) as limit_up,
			SUM(CASE WHEN zdf <= -10.0 THEN 1 ELSE 0 END) as limit_down,
			AVG(zdf) as avg_zdf,
			percentile_cont(0.5) WITHIN GROUP (ORDER BY zdf) as median_zdf
		FROM stocks WHERE stock_type LIKE '%GP-US-CDR%'
		UNION ALL
		SELECT 'us_tec' as exchange, COUNT(*) as total,
			SUM(CASE WHEN zdf > 0 THEN 1 ELSE 0 END) as rise,
			SUM(CASE WHEN zdf < 0 THEN 1 ELSE 0 END) as fall,
			SUM(CASE WHEN zdf = 0 THEN 1 ELSE 0 END) as flat,
			SUM(CASE WHEN zdf >= 10.0 THEN 1 ELSE 0 END) as limit_up,
			SUM(CASE WHEN zdf <= -10.0 THEN 1 ELSE 0 END) as limit_down,
			AVG(zdf) as avg_zdf,
			percentile_cont(0.5) WITHIN GROUP (ORDER BY zdf) as median_zdf
		FROM stocks WHERE stock_type LIKE '%GP-US-TEC%'
		UNION ALL
		SELECT 'summary' as exchange, COUNT(*) as total,
			SUM(CASE WHEN zdf > 0 THEN 1 ELSE 0 END) as rise,
			SUM(CASE WHEN zdf < 0 THEN 1 ELSE 0 END) as fall,
			SUM(CASE WHEN zdf = 0 THEN 1 ELSE 0 END) as flat,
			SUM(CASE WHEN zdf >= 10.0 THEN 1 ELSE 0 END) as limit_up,
			SUM(CASE WHEN zdf <= -10.0 THEN 1 ELSE 0 END) as limit_down,
			AVG(zdf) as avg_zdf,
			percentile_cont(0.5) WITHIN GROUP (ORDER BY zdf) as median_zdf
		FROM stocks WHERE stock_type LIKE '%GP-US-CDR%' OR stock_type LIKE '%GP-US-TEC%';
	`

	var results []ExchangeStats
	if err := db.DB.Raw(sqlQuery).Scan(&results).Error; err != nil {
		http.Error(w, "Database query error", http.StatusInternalServerError)
		log.Printf("Error querying US stock statistics: %v", err)
		return
	}

	usCdrStats := MarketStats{}
	usTecStats := MarketStats{}
	summary := MarketStats{}

	for _, res := range results {
		stats := MarketStats{
			Total:     res.Total,
			Rise:      res.Rise,
			Fall:      res.Fall,
			Flat:      res.Flat,
			LimitUp:   res.LimitUp,
			LimitDown: res.LimitDown,
			AvgZdf:    res.AvgZdf,
			MedianZdf: res.MedianZdf,
		}

		switch res.Exchange {
		case "us_cdr":
			usCdrStats = stats
		case "us_tec":
			usTecStats = stats
		case "summary":
			summary = stats
		}
	}

	response := map[string]interface{}{
		"code": 0,
		"msg":  "ok",
		"data": map[string]interface{}{
			"us_cdr":  usCdrStats,
			"us_tec":  usTecStats,
			"summary": summary,
		},
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("Error encoding US stats response: %v", err)
	}
}

type TencentIndustryResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		RankList []TencentIndustryItem `json:"rank_list"`
		Total    int                   `json:"total"`
	} `json:"data"`
}

type TencentIndustryItem struct {
	Code string `json:"code"`
	Name string `json:"name"`
	Zdf  string `json:"zdf"`
	Lzg  *struct {
		Code string `json:"code"`
		Name string `json:"name"`
		Zdf  string `json:"zdf"`
		Zxj  string `json:"zxj"`
	} `json:"lzg"`
}

func getIndustrySectorStats() (map[string]interface{}, error) {
	client := resty.New()
	client.SetTimeout(10 * time.Second)
	client.SetHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	url := "https://proxy.finance.qq.com/cgi/cgi-bin/rank/pt/getRank"

	var apiResponse TencentIndustryResponse
	resp, err := client.R().
		SetQueryParam("_appver", "11.17.0").
		SetQueryParam("board_type", "hy2").
		SetQueryParam("count", "200").
		SetQueryParam("direct", "down").
		SetQueryParam("offset", "0").
		SetQueryParam("sort_type", "priceRatio").
		Get(url)

	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(resp.Body(), &apiResponse); err != nil {
		return nil, err
	}

	totalSectors := len(apiResponse.Data.RankList)
	var riseSectors, fallSectors, flatSectors int64

	type sectorInfo struct {
		Name    string
		Zdf     float64
		LzgName string
		LzgCode string
		LzgZdf  float64
	}

	var sectors []sectorInfo
	for _, item := range apiResponse.Data.RankList {
		zdfVal := parseFloat(item.Zdf)
		if zdfVal > 0 {
			riseSectors++
		} else if zdfVal < 0 {
			fallSectors++
		} else {
			flatSectors++
		}

		var lzgName, lzgCode string
		var lzgZdf float64
		if item.Lzg != nil {
			lzgName = item.Lzg.Name
			lzgCode = item.Lzg.Code
			lzgZdf = parseFloat(item.Lzg.Zdf)
		}

		sectors = append(sectors, sectorInfo{
			Name:    item.Name,
			Zdf:     zdfVal,
			LzgName: lzgName,
			LzgCode: lzgCode,
			LzgZdf:  lzgZdf,
		})
	}

	// Sort sectors by Zdf descending
	sort.Slice(sectors, func(i, j int) bool {
		return sectors[i].Zdf > sectors[j].Zdf
	})

	// Get top 3 gainers
	topGainers := []map[string]interface{}{}
	for i := 0; i < len(sectors) && i < 3; i++ {
		if sectors[i].Zdf <= 0 {
			break
		}
		topGainers = append(topGainers, map[string]interface{}{
			"name":     sectors[i].Name,
			"zdf":      sectors[i].Zdf,
			"lzg_name": sectors[i].LzgName,
			"lzg_code": sectors[i].LzgCode,
			"lzg_zdf":  sectors[i].LzgZdf,
		})
	}

	// Sort sectors by Zdf ascending
	sort.Slice(sectors, func(i, j int) bool {
		return sectors[i].Zdf < sectors[j].Zdf
	})

	// Get top 3 losers
	topLosers := []map[string]interface{}{}
	for i := 0; i < len(sectors) && i < 3; i++ {
		if sectors[i].Zdf >= 0 {
			break
		}
		topLosers = append(topLosers, map[string]interface{}{
			"name":     sectors[i].Name,
			"zdf":      sectors[i].Zdf,
			"lzg_name": sectors[i].LzgName,
			"lzg_code": sectors[i].LzgCode,
			"lzg_zdf":  sectors[i].LzgZdf,
		})
	}

	return map[string]interface{}{
		"total":       int64(totalSectors),
		"rise":        riseSectors,
		"fall":        fallSectors,
		"flat":        flatSectors,
		"top_gainers": topGainers,
		"top_losers":  topLosers,
	}, nil
}

func parseFloat(val string) float64 {
	v, err := strconv.ParseFloat(val, 64)
	if err != nil {
		return 0
	}
	return v
}
