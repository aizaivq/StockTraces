package services

import (
	"log"
	"strconv"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
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
}
