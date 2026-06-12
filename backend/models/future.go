package models

import "time"

// Future represents a commodity or financial future contract mapping the Tencent commodities API.
type Future struct {
	Code      string    `gorm:"primaryKey;size:20;comment:期货代码" json:"code"`
	Name      string    `gorm:"size:100;comment:期货名称" json:"name"`
	Category  string    `gorm:"size:50;comment:期货分类" json:"category"` // forex, precious_metal, basic_metal, agriculture, energy
	Zxj       float64   `gorm:"type:numeric(16,4);comment:最新价" json:"zxj"`
	Zd        float64   `gorm:"type:numeric(16,4);comment:涨跌额" json:"zd"`
	Zdf       float64   `gorm:"type:numeric(16,4);comment:涨跌幅(%)" json:"zdf"`
	Location  string    `gorm:"size:100;comment:交易场所" json:"location"`
	State     string    `gorm:"size:50;comment:交易状态" json:"state"`
	Img       string    `gorm:"size:255;comment:图片URL" json:"img"`
	Qtcode    string    `gorm:"size:50;comment:行情代码" json:"qtcode"`
	UpdatedAt time.Time `gorm:"autoUpdateTime;comment:更新时间" json:"updated_at"`
}
