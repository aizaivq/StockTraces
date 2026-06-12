package services

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
	"golang.org/x/text/encoding/simplifiedchinese"
	"golang.org/x/text/transform"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"stocktraces/backend/models"
)

// TencentRankResponse maps the response of the Tencent Finance Rank API.
type TencentRankResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		RankList []TencentStockItem `json:"rank_list"`
		Offset   int                `json:"offset"`
		Total    int                `json:"total"`
	} `json:"data"`
}

// TencentHkRankResponse maps the response of the Tencent HK Main Board Rank API.
type TencentHkRankResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		PageData   []string `json:"page_data"`
		PageCount  int      `json:"page_count"`
		StockCount int      `json:"stock_count"`
	} `json:"data"`
}

// TencentStockItem maps the elements of rank_list in the API response.
// Note: Tencent API fields are returned as string representations.
type TencentStockItem struct {
	Code      string `json:"code"`
	Name      string `json:"name"`
	Zxj       string `json:"zxj"`
	Zd        string `json:"zd"`
	Zdf       string `json:"zdf"`
	Hsl       string `json:"hsl"`
	Zf        string `json:"zf"`
	Volume    string `json:"volume"`
	Turnover  string `json:"turnover"`
	Ltsz      string `json:"ltsz"`
	Zsz       string `json:"zsz"`
	PeTtm     string `json:"pe_ttm"`
	Pn        string `json:"pn"`
	Lb        string `json:"lb"`
	Speed     string `json:"speed"`
	State     string `json:"state"`
	StockType string `json:"stock_type"`
	Zljlr     string `json:"zljlr"`
	Zllr      string `json:"zllr"`
	Zllc      string `json:"zllc"`
	ZllrD5    string `json:"zllr_d5"`
	ZllcD5    string `json:"zllc_d5"`
	ZdfD5     string `json:"zdf_d5"`
	ZdfD10    string `json:"zdf_d10"`
	ZdfD20    string `json:"zdf_d20"`
	ZdfD60    string `json:"zdf_d60"`
	ZdfW52    string `json:"zdf_w52"`
	ZdfY      string `json:"zdf_y"`
}

// parseFloat safely converts string fields into float64 database equivalents.
func parseFloat(val string) float64 {
	val = strings.TrimSpace(val)
	if val == "" || val == "-" {
		return 0.0
	}
	f, err := strconv.ParseFloat(val, 64)
	if err != nil {
		return 0.0
	}
	return f
}

// SyncAllStocks fetches all A-share stocks from the Tencent Finance Rank API
// and upserts them into the database in batches.
func SyncAllStocks(db *gorm.DB) {
	log.Println("Starting stock data sync from Tencent Finance API...")

	client := resty.New()
	client.SetTimeout(15 * time.Second)
	client.SetHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	url := "https://proxy.finance.qq.com/cgi/cgi-bin/rank/hs/getBoardRankList"
	offset := 0
	count := 200
	total := 1 // Initial seed to trigger loop

	for offset < total {
		var response TencentRankResponse
		resp, err := client.R().
			SetQueryParams(map[string]string{
				"_appver":    "11.17.0",
				"board_code": "aStock",
				"sort_type":  "price",
				"direct":      "down",
				"offset":     strconv.Itoa(offset),
				"count":      strconv.Itoa(count),
			}).
			SetResult(&response).
			Get(url)

		if err != nil {
			log.Printf("Error requesting Tencent API at offset %d: %v", offset, err)
			break
		}

		if !resp.IsSuccess() || response.Code != 0 {
			log.Printf("Tencent API returned error at offset %d: HTTP %d, Code %d, Msg: %s",
				offset, resp.StatusCode(), response.Code, response.Msg)
			break
		}

		total = response.Data.Total
		log.Printf("Fetched stocks %d - %d of total %d", offset, offset+len(response.Data.RankList), total)

		if len(response.Data.RankList) == 0 {
			log.Println("Received empty rank list from API. Ending synchronization.")
			break
		}

		// Convert Tencent API response format to GORM stock models
		stocks := make([]models.Stock, len(response.Data.RankList))
		for i, item := range response.Data.RankList {
			stocks[i] = models.Stock{
				Code:      item.Code,
				Name:      item.Name,
				Zxj:       parseFloat(item.Zxj),
				Zd:        parseFloat(item.Zd),
				Zdf:       parseFloat(item.Zdf),
				Hsl:       parseFloat(item.Hsl),
				Zf:        parseFloat(item.Zf),
				Volume:    parseFloat(item.Volume),
				Turnover:  parseFloat(item.Turnover),
				Ltsz:      parseFloat(item.Ltsz),
				Zsz:       parseFloat(item.Zsz),
				PeTtm:     parseFloat(item.PeTtm),
				Pn:        parseFloat(item.Pn),
				Lb:        parseFloat(item.Lb),
				Speed:     parseFloat(item.Speed),
				State:     item.State,
				StockType: item.StockType,
				Zljlr:     parseFloat(item.Zljlr),
				Zllr:      parseFloat(item.Zllr),
				Zllc:      parseFloat(item.Zllc),
				ZllrD5:    parseFloat(item.ZllrD5),
				ZllcD5:    parseFloat(item.ZllcD5),
				ZdfD5:     parseFloat(item.ZdfD5),
				ZdfD10:    parseFloat(item.ZdfD10),
				ZdfD20:    parseFloat(item.ZdfD20),
				ZdfD60:    parseFloat(item.ZdfD60),
				ZdfW52:    parseFloat(item.ZdfW52),
				ZdfY:      parseFloat(item.ZdfY),
				UpdatedAt: time.Now(),
			}
		}

		// Batch upsert using standard GORM clauses
		err = db.Clauses(clause.OnConflict{
			UpdateAll: true,
		}).CreateInBatches(&stocks, 100).Error

		if err != nil {
			log.Printf("Failed to batch upsert stocks at offset %d: %v", offset, err)
			break
		}

		offset += count
		// Brief pause to prevent hitting API rate limit too aggressively
		time.Sleep(100 * time.Millisecond)
	}

	log.Println("Stock data synchronization completed successfully.")

	// Sync HK stocks after A-share sync
	SyncHkStocks(db)

	// Sync US stocks after HK sync
	SyncUsStocks(db)

	// Sync exchange rates after US sync
	SyncExchangeRates(db)

	// Sync futures after exchange rates sync
	SyncFutures(db)

	// Sync ETFs after futures sync
	SyncEtfs(db)

	// Sync Funds after ETFs sync
	SyncFunds(db)
}

// SyncHkStocks fetches all Hong Kong Main Board and GEM Board stocks from the Tencent Finance API
// and upserts them into the database in batches.
func SyncHkStocks(db *gorm.DB) {
	log.Println("Starting HK stock data sync from Tencent Finance API...")

	client := resty.New()
	client.SetTimeout(15 * time.Second)
	client.SetHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	url := "https://stock.gtimg.cn/data/hk_rank.php"
	pageSize := 100

	boards := []struct {
		code      string
		stockType string
	}{
		{"main_all", "GP-HK"},
		{"gem_all", "GP-HK-GEM"},
		{"A_H", "GP-HK-AH"},
	}

	for _, boardInfo := range boards {
		page := 1
		log.Printf("Syncing HK board: %s (DB StockType: %s)...", boardInfo.code, boardInfo.stockType)

		for {
			resp, err := client.R().
				SetQueryParams(map[string]string{
					"board":    boardInfo.code,
					"metric":   "change_rate",
					"pageSize": strconv.Itoa(pageSize),
					"reqPage":  strconv.Itoa(page),
					"order":    "desc",
					"var_name": "list_data",
				}).
				Get(url)

			if err != nil {
				log.Printf("Error requesting Tencent HK API for %s at page %d: %v", boardInfo.code, page, err)
				break
			}

			if !resp.IsSuccess() {
				log.Printf("Tencent HK API for %s returned HTTP error at page %d: HTTP %d", boardInfo.code, page, resp.StatusCode())
				break
			}

			body := string(resp.Body())
			idx := strings.Index(body, "{")
			if idx == -1 {
				log.Printf("Invalid Tencent HK API response for %s at page %d (no JSON block)", boardInfo.code, page)
				break
			}
			body = body[idx:]
			body = strings.TrimSuffix(body, ";")

			var response TencentHkRankResponse
			if err := json.Unmarshal([]byte(body), &response); err != nil {
				log.Printf("Error unmarshaling HK stock response for %s at page %d: %v", boardInfo.code, page, err)
				break
			}

			if response.Code != 0 {
				log.Printf("Tencent HK API for %s returned error code at page %d: %d, msg: %s", boardInfo.code, page, response.Code, response.Msg)
				break
			}

			pageData := response.Data.PageData
			if len(pageData) == 0 {
				break
			}

			log.Printf("Fetched HK %s stocks page %d (count: %d of total %d)", boardInfo.code, page, len(pageData), response.Data.StockCount)

			var stocks []models.Stock
			for _, itemStr := range pageData {
				parts := strings.Split(itemStr, "~")
				if len(parts) < 14 {
					continue
				}

				symbol := parts[0]
				name := parts[1]
				zxj := parseFloat(parts[2])
				zdf := parseFloat(parts[3])
				zd := parseFloat(parts[4])
				volume := parseFloat(parts[7])
				turnover := parseFloat(parts[8])
				high := parseFloat(parts[11])
				low := parseFloat(parts[12])
				prevClose := parseFloat(parts[10])
				hsl := parseFloat(parts[13])

				zf := 0.0
				if prevClose > 0 {
					zf = (high - low) / prevClose * 100.0
				}

				stocks = append(stocks, models.Stock{
					Code:      "hk" + symbol,
					Name:      name,
					Zxj:       zxj,
					Zd:        zd,
					Zdf:       zdf,
					Hsl:       hsl,
					Zf:        zf,
					Volume:    volume / 100.0,
					Turnover:  turnover / 10000.0,
					StockType: boardInfo.stockType,
					State:     "",
					UpdatedAt: time.Now(),
				})
			}

			if len(stocks) > 0 {
				err = db.Clauses(clause.OnConflict{
					UpdateAll: true,
				}).CreateInBatches(&stocks, 100).Error

				if err != nil {
					log.Printf("Failed to batch upsert HK %s stocks at page %d: %v", boardInfo.code, page, err)
					break
				}
			}

			if len(pageData) < pageSize || page >= response.Data.PageCount {
				break
			}

			page++
			time.Sleep(100 * time.Millisecond)
		}
	}

	log.Println("HK Stock data synchronization completed successfully.")
}

// SyncUsStocks fetches all US China Concept Stocks (CDR) and Tech Stocks (TEC) from the Tencent Finance API
// and upserts them into the database in batches, merging stock types on overlap.
func SyncUsStocks(db *gorm.DB) {
	log.Println("Starting US stock data sync from Tencent Finance API...")

	client := resty.New()
	client.SetTimeout(15 * time.Second)
	client.SetHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	url := "https://proxy.finance.qq.com/cgi/cgi-bin/rank/us/getList"
	pageSize := 100

	boards := []struct {
		code      string
		stockType string
	}{
		{"cdr", "GP-US-CDR"},
		{"tec", "GP-US-TEC"},
	}

	for _, boardInfo := range boards {
		offset := 0
		total := 1 // Initial seed to trigger loop
		log.Printf("Syncing US board: %s (DB StockType: %s)...", boardInfo.code, boardInfo.stockType)

		for offset < total {
			var response TencentRankResponse
			resp, err := client.R().
				SetQueryParams(map[string]string{
					"_appver":    "11.17.0",
					"board_type": boardInfo.code,
					"sort_type":  "price",
					"direct":      "down",
					"offset":     strconv.Itoa(offset),
					"count":      strconv.Itoa(pageSize),
				}).
				SetResult(&response).
				Get(url)

			if err != nil {
				log.Printf("Error requesting Tencent US API for %s at offset %d: %v", boardInfo.code, offset, err)
				break
			}

			if !resp.IsSuccess() || response.Code != 0 {
				log.Printf("Tencent US API for %s returned error at offset %d: HTTP %d, Code %d, Msg: %s",
					boardInfo.code, offset, resp.StatusCode(), response.Code, response.Msg)
				break
			}

			total = response.Data.Total
			log.Printf("Fetched US %s stocks %d - %d of total %d", boardInfo.code, offset, offset+len(response.Data.RankList), total)

			if len(response.Data.RankList) == 0 {
				break
			}

			// Gather codes to look up existing types to prevent overwrite leaks
			codes := make([]string, len(response.Data.RankList))
			for i, item := range response.Data.RankList {
				codes[i] = item.Code
			}

			var existingList []models.Stock
			if err := db.Where("code IN ?", codes).Find(&existingList).Error; err != nil {
				log.Printf("Failed to query existing US stocks: %v", err)
			}
			existingMap := make(map[string]models.Stock)
			for _, es := range existingList {
				existingMap[es.Code] = es
			}

			stocks := make([]models.Stock, len(response.Data.RankList))
			for i, item := range response.Data.RankList {
				targetStockType := boardInfo.stockType
				if es, exists := existingMap[item.Code]; exists {
					types := strings.Split(es.StockType, ",")
					typeExists := false
					for _, t := range types {
						if t == boardInfo.stockType {
							typeExists = true
							break
						}
					}
					if !typeExists {
						targetStockType = es.StockType + "," + boardInfo.stockType
					} else {
						targetStockType = es.StockType
					}
				}

				stocks[i] = models.Stock{
					Code:      item.Code,
					Name:      item.Name,
					Zxj:       parseFloat(item.Zxj),
					Zd:        parseFloat(item.Zd),
					Zdf:       parseFloat(item.Zdf),
					Hsl:       parseFloat(item.Hsl),
					Zf:        parseFloat(item.Zf),
					Volume:    parseFloat(item.Volume) / 100.0,
					Turnover:  parseFloat(item.Turnover) / 10000.0,
					Ltsz:      parseFloat(item.Ltsz),
					Zsz:       parseFloat(item.Zsz),
					PeTtm:     parseFloat(item.PeTtm),
					Pn:        parseFloat(item.Pn),
					Lb:        parseFloat(item.Lb),
					Speed:     parseFloat(item.Speed),
					State:     item.State,
					StockType: targetStockType,
					UpdatedAt: time.Now(),
				}
			}

			err = db.Clauses(clause.OnConflict{
				UpdateAll: true,
			}).CreateInBatches(&stocks, 100).Error

			if err != nil {
				log.Printf("Failed to batch upsert US stocks for %s at offset %d: %v", boardInfo.code, offset, err)
				break
			}

			offset += pageSize
			time.Sleep(100 * time.Millisecond)
		}
	}

	log.Println("US Stock data synchronization completed successfully.")
}

// SyncExchangeRates fetches and synchronizes real-time exchange rates (Forex and metals) from Tencent API.
func SyncExchangeRates(db *gorm.DB) {
	log.Println("Starting exchange rate sync from Tencent Finance API...")

	client := resty.New()
	client.SetTimeout(15 * time.Second)
	client.SetHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	symbols := []string{
		"whXAUUSD", "whXAGUSD", "whEURUSD", "whGBPUSD", "whUSDCHF", "whUSDCAD", "whUSDJPY", "whUSDHKD",
		"whAUDUSD", "whSGDUSD", "whUSDSEK", "whUSDCNY", "whNZDUSD", "whEURJPY", "whCHFJPY", "whNZDCHF",
		"whNZDHKD", "whNZDJPY", "whAUDHKD", "whAUDJPY", "whXAUGBP", "whEURHKD", "whCASF", "whAUDEUR",
		"whEURCHF", "whHKDCNY", "whAUDCHF", "whGBPJPY", "whGBPCHF", "whXAUEUR", "whEURNZD", "whCADJPY",
		"whGBPHKD", "whEURCAD", "whGBPAUD", "whAUDCAD", "whCHFHKD", "whNZDAUD", "whGBPCAD", "whCADHKD",
		"whGBPEUR", "whXAGEUR", "whEURGBP", "whAUDNZD", "whHKDJPY", "whXAGGBP", "whCHFCAD", "whNZDEUR",
		"whNZDCAD", "whEURAUD", "whXAUAUD",
	}

	url := "https://qt.gtimg.cn/"
	resp, err := client.R().
		SetQueryParam("q", strings.Join(symbols, ",")).
		Get(url)

	if err != nil {
		log.Printf("Error requesting Tencent Forex API: %v", err)
		return
	}

	if !resp.IsSuccess() {
		log.Printf("Tencent Forex API returned HTTP error: %d", resp.StatusCode())
		return
	}

	// The API response is in GBK. Let's decode it to UTF-8.
	bodyBytes := resp.Body()
	decodedReader := transform.NewReader(bytes.NewReader(bodyBytes), simplifiedchinese.GBK.NewDecoder())
	utf8Bytes, err := io.ReadAll(decodedReader)
	if err != nil {
		log.Printf("Failed to decode GBK response from Forex API: %v", err)
		return
	}

	lines := strings.Split(string(utf8Bytes), ";")
	var rates []models.ExchangeRate

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Line format: v_whUSDCNY="310~美元人民币~USDCNY~6.7770~..."
		idx := strings.Index(line, "=")
		if idx == -1 {
			continue
		}

		val := line[idx+1:]
		val = strings.Trim(val, "\"") // Strip enclosing quotes

		parts := strings.Split(val, "~")
		if len(parts) < 14 {
			continue
		}

		name := parts[1]
		code := parts[2]
		zxj := parseFloat(parts[3])
		prevClose := parseFloat(parts[6])
		high := parseFloat(parts[8])
		low := parseFloat(parts[9])
		open := parseFloat(parts[10])
		zd := parseFloat(parts[12])
		zdf := parseFloat(parts[13])

		// Skip if name or code is empty (indicates invalid/omitted symbol)
		if name == "" || code == "" {
			continue
		}

		rates = append(rates, models.ExchangeRate{
			Code:      code,
			Name:      name,
			Zxj:       zxj,
			Zd:        zd,
			Zdf:       zdf,
			High:      high,
			Low:       low,
			Open:      open,
			PrevClose: prevClose,
			UpdatedAt: time.Now(),
		})
	}

	if len(rates) > 0 {
		err = db.Clauses(clause.OnConflict{
			UpdateAll: true,
		}).CreateInBatches(&rates, 100).Error

		if err != nil {
			log.Printf("Failed to batch upsert Exchange Rates: %v", err)
			return
		}
		log.Printf("Successfully synchronized %d exchange rates.", len(rates))
	} else {
		log.Println("No exchange rates synced.")
	}
}

// TencentFuturesResponse represents the JSON response of Tencent commodities API.
type TencentFuturesResponse struct {
	Code int    `json:"code"`
	Msg  string `json:"msg"`
	Data struct {
		StockIndex     []TencentFutureItem `json:"stockIndex"`
		ExchangeRate   []TencentFutureItem `json:"exchangeRate"`
		InterestRate   []TencentFutureItem `json:"interestRate"`
		PreciousMetal  []TencentFutureItem `json:"preciousMetal"`
		BasicMetal     []TencentFutureItem `json:"basicMetal"`
		Agriculture    []TencentFutureItem `json:"agriculture"`
		Energy         []TencentFutureItem `json:"energy"`
	} `json:"data"`
}

// TencentFutureItem maps each future item inside the API category lists.
type TencentFutureItem struct {
	Code     string `json:"code"`
	Name     string `json:"name"`
	Zxj      string `json:"zxj"`
	Zde      string `json:"zde"`
	Zdf      string `json:"zdf"`
	Location string `json:"location"`
	State    string `json:"state"`
	Img      string `json:"img"`
	Qtcode   string `json:"qtcode"`
}

// SyncFutures fetches and synchronizes global commodities/futures from the Tencent Finance API.
func SyncFutures(db *gorm.DB) {
	log.Println("Starting futures/commodities sync from Tencent Finance API...")

	client := resty.New()
	client.SetTimeout(15 * time.Second)
	client.SetHeader("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")

	url := "https://proxy.finance.qq.com/ifzqgtimg/appstock/app/rank/worldCommodities"
	
	resp, err := client.R().
		SetQueryParam("_appver", "11.17.0").
		Get(url)

	if err != nil {
		log.Printf("Error requesting Tencent Futures API: %v", err)
		return
	}

	if !resp.IsSuccess() {
		log.Printf("Tencent Futures API returned HTTP error: %d", resp.StatusCode())
		return
	}

	var response TencentFuturesResponse
	if err := json.Unmarshal(resp.Body(), &response); err != nil {
		log.Printf("Failed to unmarshal Tencent Futures JSON response: %v", err)
		return
	}

	if response.Code != 0 {
		log.Printf("Tencent Futures API returned error code: %d, Msg: %s", response.Code, response.Msg)
		return
	}

	var futures []models.Future
	
	// Helper to process a category slice and convert to GORM models
	processCategory := func(items []TencentFutureItem, catName string) {
		for _, item := range items {
			if item.Code == "" || item.Name == "" {
				continue
			}
			futures = append(futures, models.Future{
				Code:      item.Code,
				Name:      item.Name,
				Category:  catName,
				Zxj:       parseFloat(item.Zxj),
				Zd:        parseFloat(item.Zde),
				Zdf:       parseFloat(item.Zdf),
				Location:  item.Location,
				State:     item.State,
				Img:       item.Img,
				Qtcode:    item.Qtcode,
				UpdatedAt: time.Now(),
			})
		}
	}

	processCategory(response.Data.StockIndex, "index")
	processCategory(response.Data.ExchangeRate, "forex")
	processCategory(response.Data.InterestRate, "interest_rate")
	processCategory(response.Data.PreciousMetal, "precious_metal")
	processCategory(response.Data.BasicMetal, "basic_metal")
	processCategory(response.Data.Agriculture, "agriculture")
	processCategory(response.Data.Energy, "energy")

	if len(futures) > 0 {
		err = db.Clauses(clause.OnConflict{
			UpdateAll: true,
		}).CreateInBatches(&futures, 100).Error

		if err != nil {
			log.Printf("Failed to batch upsert Futures: %v", err)
			return
		}
		log.Printf("Successfully synchronized %d futures contracts.", len(futures))
	} else {
		log.Println("No futures data found to sync.")
	}
}

// SyncEtfs fetches and synchronizes all ETFs from Eastmoney API.
func SyncEtfs(db *gorm.DB) {
	log.Println("Starting ETF data sync from Eastmoney Mobile API...")
	startTime := time.Now()

	client := resty.New()
	client.SetTimeout(15 * time.Second)
	client.SetHeader("User-Agent", "Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36")

	url := "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNRankNewList"
	page := 1
	pageSize := 30
	total := 1

	for (page-1)*pageSize < total {
		var response struct {
			Success    bool `json:"Success"`
			TotalCount int  `json:"TotalCount"`
			Datas      []struct {
				Fcode     string `json:"FCODE"`
				Shortname string `json:"SHORTNAME"`
				Fsrq      string `json:"FSRQ"`
				Rzdf      string `json:"RZDF"`
				Dwjz      string `json:"DWJZ"`
				Ljjz      string `json:"LJJZ"`
			} `json:"Datas"`
		}

		resp, err := client.R().
			SetQueryParams(map[string]string{
				"FundType":   "3",
				"SortColumn": "RZDF",
				"Sort":       "desc",
				"pageIndex":  strconv.Itoa(page),
				"pageSize":   strconv.Itoa(pageSize),
				"plat":       "Android",
				"deviceid":   "123456789",
				"product":    "EFund",
				"Version":    "651",
			}).
			SetResult(&response).
			Get(url)

		if err != nil {
			log.Printf("Error requesting Eastmoney ETF API at page %d: %v", page, err)
			break
		}

		if !resp.IsSuccess() || !response.Success {
			log.Printf("Eastmoney ETF API returned error at page %d: HTTP %d", page, resp.StatusCode())
			break
		}

		total = response.TotalCount
		log.Printf("Fetched ETFs page %d, items %d - %d of total %d", page, (page-1)*pageSize, (page-1)*pageSize+len(response.Datas), total)

		if len(response.Datas) == 0 {
			break
		}

		var stocks []models.Stock
		for _, item := range response.Datas {
			code := item.Fcode
			if strings.HasPrefix(code, "5") {
				code = "sh" + code
			} else if strings.HasPrefix(code, "1") {
				code = "sz" + code
			} else {
				// Default fallback
				code = "sh" + code
			}

			rzdfVal := parseFloat(item.Rzdf)
			dwjzVal := parseFloat(item.Dwjz)
			zdVal := 0.0
			if rzdfVal != -100.0 {
				zdVal = dwjzVal - (dwjzVal / (1.0 + rzdfVal/100.0))
			}

			stocks = append(stocks, models.Stock{
				Code:      code,
				Name:      item.Shortname,
				Zxj:       dwjzVal,
				Zd:        zdVal,
				Zdf:       rzdfVal,
				Ljjz:      parseFloat(item.Ljjz),
				State:     item.Fsrq, // Storing net value date in State field
				StockType: "ETF",
				UpdatedAt: time.Now(),
			})
		}

		err = db.Clauses(clause.OnConflict{
			UpdateAll: true,
		}).CreateInBatches(&stocks, 100).Error

		if err != nil {
			log.Printf("Failed to batch upsert ETFs at page %d: %v", page, err)
			break
		}

		page++
		time.Sleep(100 * time.Millisecond)
	}

	log.Println("ETF data synchronization completed successfully.")
	// Clean up stale records that were not updated in this sync run
	if err := db.Where("stock_type = ? AND updated_at < ?", "ETF", startTime).Delete(&models.Stock{}).Error; err != nil {
		log.Printf("Failed to delete stale ETFs: %v", err)
	}
}

// SyncFunds fetches and synchronizes open-end mutual funds from Eastmoney API (capped at 3,000 for efficiency).
func SyncFunds(db *gorm.DB) {
	log.Println("Starting Mutual Fund data sync from Eastmoney Mobile API...")
	startTime := time.Now()

	client := resty.New()
	client.SetTimeout(15 * time.Second)
	client.SetHeader("User-Agent", "Mozilla/5.0 (Linux; Android 10; SM-G960F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/81.0.4044.138 Mobile Safari/537.36")

	url := "https://fundmobapi.eastmoney.com/FundMNewApi/FundMNRankNewList"
	page := 1
	pageSize := 30
	maxFunds := 3000
	total := 1

	for (page-1)*pageSize < total && (page-1)*pageSize < maxFunds {
		var response struct {
			Success    bool `json:"Success"`
			TotalCount int  `json:"TotalCount"`
			Datas      []struct {
				Fcode     string `json:"FCODE"`
				Shortname string `json:"SHORTNAME"`
				Fsrq      string `json:"FSRQ"`
				Rzdf      string `json:"RZDF"`
				Dwjz      string `json:"DWJZ"`
				Ljjz      string `json:"LJJZ"`
			} `json:"Datas"`
		}

		resp, err := client.R().
			SetQueryParams(map[string]string{
				"FundType":   "0",
				"SortColumn": "FCODE",
				"Sort":       "asc",
				"pageIndex":  strconv.Itoa(page),
				"pageSize":   strconv.Itoa(pageSize),
				"plat":       "Android",
				"deviceid":   "123456789",
				"product":    "EFund",
				"Version":    "651",
			}).
			SetResult(&response).
			Get(url)

		if err != nil {
			log.Printf("Error requesting Eastmoney Fund API at page %d: %v", page, err)
			break
		}

		if !resp.IsSuccess() || !response.Success {
			log.Printf("Eastmoney Fund API returned error at page %d: HTTP %d", page, resp.StatusCode())
			break
		}

		total = response.TotalCount
		log.Printf("Fetched Funds page %d, items %d - %d of total %d", page, (page-1)*pageSize, (page-1)*pageSize+len(response.Datas), total)

		if len(response.Datas) == 0 {
			break
		}

		var stocks []models.Stock
		for _, item := range response.Datas {
			code := "of" + item.Fcode

			rzdfVal := parseFloat(item.Rzdf)
			dwjzVal := parseFloat(item.Dwjz)
			zdVal := 0.0
			if rzdfVal != -100.0 {
				zdVal = dwjzVal - (dwjzVal / (1.0 + rzdfVal/100.0))
			}

			stocks = append(stocks, models.Stock{
				Code:      code,
				Name:      item.Shortname,
				Zxj:       dwjzVal,
				Zd:        zdVal,
				Zdf:       rzdfVal,
				Ljjz:      parseFloat(item.Ljjz),
				State:     item.Fsrq, // Storing net value date in State field
				StockType: "FUND",
				UpdatedAt: time.Now(),
			})
		}

		err = db.Clauses(clause.OnConflict{
			UpdateAll: true,
		}).CreateInBatches(&stocks, 100).Error

		if err != nil {
			log.Printf("Failed to batch upsert Funds at page %d: %v", page, err)
			break
		}

		page++
		time.Sleep(100 * time.Millisecond)
	}

	log.Println("Mutual Fund data synchronization completed successfully.")
	// Clean up stale records that were not updated in this sync run
	if err := db.Where("stock_type = ? AND updated_at < ?", "FUND", startTime).Delete(&models.Stock{}).Error; err != nil {
		log.Printf("Failed to delete stale funds: %v", err)
	}
}

