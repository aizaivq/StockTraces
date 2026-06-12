package models

import "time"

// ExchangeRate represents the currency exchange rate schema mapping the Tencent Finance API.
type ExchangeRate struct {
	Code      string    `gorm:"primaryKey;size:20;comment:汇率代码" json:"code"`
	Name      string    `gorm:"size:100;comment:汇率名称" json:"name"`
	Zxj       float64   `gorm:"type:numeric(16,4);comment:最新价" json:"zxj"`
	Zd        float64   `gorm:"type:numeric(16,4);comment:涨跌额" json:"zd"`
	Zdf       float64   `gorm:"type:numeric(16,4);comment:涨跌幅(%)" json:"zdf"`
	High      float64   `gorm:"type:numeric(16,4);comment:最高价" json:"high"`
	Low       float64   `gorm:"type:numeric(16,4);comment:最低价" json:"low"`
	Open      float64   `gorm:"type:numeric(16,4);comment:开盘价" json:"open"`
	PrevClose float64   `gorm:"type:numeric(16,4);comment:昨收价" json:"prev_close"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;comment:更新时间" json:"updated_at"`
}
