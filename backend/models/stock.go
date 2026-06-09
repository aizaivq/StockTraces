package models

import (
	"time"
)

// Stock represents the stock data schema mapping the Tencent Finance rank API fields.
type Stock struct {
	Code      string    `gorm:"primaryKey;size:20;comment:股票代码" json:"code"`
	Name      string    `gorm:"size:100;comment:股票名称" json:"name"`
	Zxj       float64   `gorm:"type:numeric(16,4);comment:最新价(元)" json:"zxj"`
	Zd        float64   `gorm:"type:numeric(16,4);comment:涨跌额(元)" json:"zd"`
	Zdf       float64   `gorm:"type:numeric(8,4);comment:涨跌幅(%)" json:"zdf"`
	Hsl       float64   `gorm:"type:numeric(8,4);comment:换手率(%)" json:"hsl"`
	Zf        float64   `gorm:"type:numeric(8,4);comment:振幅(%)" json:"zf"`
	Volume    float64   `gorm:"type:numeric(20,4);comment:成交量(手)" json:"volume"`
	Turnover  float64   `gorm:"type:numeric(20,4);comment:成交额(万元)" json:"turnover"`
	Ltsz      float64   `gorm:"type:numeric(16,4);comment:流通市值(亿元)" json:"ltsz"`
	Zsz       float64   `gorm:"type:numeric(16,4);comment:总市值(亿元)" json:"zsz"`
	PeTtm     float64   `gorm:"type:numeric(12,4);comment:市盈率 TTM" json:"pe_ttm"`
	Pn        float64   `gorm:"type:numeric(12,4);comment:市净率 PB" json:"pn"`
	Lb        float64   `gorm:"type:numeric(12,4);comment:量比" json:"lb"`
	Speed     float64   `gorm:"type:numeric(8,4);comment:涨速(%)" json:"speed"`
	State     string    `gorm:"size:50;comment:股票状态" json:"state"`
	StockType string    `gorm:"size:50;comment:股票类型" json:"stock_type"`
	Zljlr     float64   `gorm:"type:numeric(20,4);comment:主力净流入(万元)" json:"zljlr"`
	Zllr      float64   `gorm:"type:numeric(20,4);comment:主力流入(万元)" json:"zllr"`
	Zllc      float64   `gorm:"type:numeric(20,4);comment:主力流出(万元)" json:"zllc"`
	ZllrD5    float64   `gorm:"type:numeric(20,4);comment:5日主力流入(万元)" json:"zllr_d5"`
	ZllcD5    float64   `gorm:"type:numeric(20,4);comment:5日主力流出(万元)" json:"zllc_d5"`
	ZdfD5     float64   `gorm:"type:numeric(8,4);comment:5日涨跌幅(%)" json:"zdf_d5"`
	ZdfD10    float64   `gorm:"type:numeric(8,4);comment:10日涨跌幅(%)" json:"zdf_d10"`
	ZdfD20    float64   `gorm:"type:numeric(8,4);comment:20日涨跌幅(%)" json:"zdf_d20"`
	ZdfD60    float64   `gorm:"type:numeric(8,4);comment:60日涨跌幅(%)" json:"zdf_d60"`
	ZdfW52    float64   `gorm:"type:numeric(8,4);comment:52周涨跌幅(%)" json:"zdf_w52"`
	ZdfY      float64   `gorm:"type:numeric(8,4);comment:今年以来涨跌幅(%)" json:"zdf_y"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;comment:更新时间" json:"updated_at"`
}
