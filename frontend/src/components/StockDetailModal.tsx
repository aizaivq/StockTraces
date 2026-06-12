import { useState, useEffect } from 'react'
import { Modal, Tabs, Spin, Row, Col, Tag, Empty } from 'antd'

interface StockDetailModalProps {
  visible: boolean
  onClose: () => void
  stock: {
    code: string
    name: string
    zxj: number
    zd: number
    zdf: number
    volume?: number
    turnover?: number
    stock_type?: string
  } | null
}

export default function StockDetailModal({ visible, onClose, stock }: StockDetailModalProps) {
  const [activeTab, setActiveTab] = useState<string>('min')
  const [imgLoading, setImgLoading] = useState<boolean>(true)
  const [hasError, setHasError] = useState<boolean>(false)

  // Reset tab and states when a different stock is selected
  useEffect(() => {
    if (visible && stock) {
      setActiveTab('min')
      setImgLoading(true)
      setHasError(false)
    }
  }, [visible, stock])

  if (!stock) return null

  // Determine stock color
  const getPriceColorStyle = (val: number) => {
    if (val > 0) return { color: 'var(--stock-up)' }
    if (val < 0) return { color: 'var(--stock-down)' }
    return { color: 'var(--stock-zero)' }
  };

  // Helper to map code to Sina image code
  const getSinaCode = (rawCode: string, stockType: string | undefined): string => {
    let code = rawCode.trim();
    const lower = code.toLowerCase();

    // Handlers for global indices
    if (lower.includes('dji')) return 'dji';
    if (lower.includes('ixic')) return 'ixic';
    if (lower.includes('inx') || lower.includes('spx')) return 'inx';
    if (lower.includes('hsi')) return 'hkHSI';

    // HK-shares: e.g. "00700" -> "hk00700"
    if (stockType === 'GP-HK' || /^\d{5}$/.test(code)) {
      return `hk${code.padStart(5, '0')}`;
    }

    // US-shares: e.g. "AAPL.OQ" -> "us_aapl"
    if ((stockType && stockType.includes('US')) || /^[a-zA-Z]+\.[a-zA-Z]+$/.test(code)) {
      const ticker = code.split('.')[0].toLowerCase();
      return `us_${ticker}`;
    }

    // Default A-shares (already includes "sh"/"sz"/"bj" prefix)
    return lower;
  };

  const sinaCode = getSinaCode(stock.code, stock.stock_type)
  const chartUrl = `https://image.sinajs.cn/newchart/${activeTab}/n/${sinaCode}.gif`

  const formatVolume = (vol?: number) => {
    if (vol === undefined || vol === null || isNaN(vol)) return '-'
    if (vol >= 100000000) return `${(vol / 100000000).toFixed(2)}亿`
    if (vol >= 10000) return `${(vol / 10000).toFixed(2)}万`
    return Math.round(vol).toLocaleString()
  };

  const formatTurnover = (to?: number) => {
    if (to === undefined || to === null || isNaN(to)) return '-'
    if (to >= 100000000) return `${(to / 100000000).toFixed(2)}亿`
    if (to >= 10000) return `${(to / 10000).toFixed(2)}万`
    return to.toFixed(2)
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key)
    setImgLoading(true)
    setHasError(false)
  };

  const tabsItems = [
    { key: 'min', label: '分时图' },
    { key: 'five', label: '五日分时' },
    { key: 'daily', label: '日K线' },
    { key: 'weekly', label: '周K线' },
    { key: 'monthly', label: '月K线' },
  ]

  const isFund = stock.stock_type === 'FUND' || stock.code.startsWith('of')

  return (
    <Modal
      title={null}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={720}
      centered
      styles={{
        body: { padding: '24px 24px 12px 24px' }
      }}
      style={{ borderRadius: '12px', overflow: 'hidden' }}
    >
      {/* Header Info */}
      <div style={{ marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
        <Row align="middle" justify="space-between" gutter={[16, 8]}>
          <Col>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
              <span style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text-h)' }}>{stock.name}</span>
              <span style={{ fontSize: '15px', color: 'var(--text)', fontFamily: 'var(--mono)' }}>
                {stock.code.replace(/^(sh|sz|of)/, '').toUpperCase()}
              </span>
              {stock.stock_type && (
                <Tag color="purple" style={{ border: 'none', borderRadius: '4px', fontSize: '12px' }}>
                  {stock.stock_type === 'FUND' ? '开放式基金' : stock.stock_type}
                </Tag>
              )}
            </div>
          </Col>
          <Col>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', textAlign: 'right' }}>
              <div>
                <span 
                  style={{ 
                    fontSize: '28px', 
                    fontWeight: 700, 
                    fontFamily: 'var(--mono)',
                    ...getPriceColorStyle(stock.zd)
                  }}
                >
                  {stock.zxj !== undefined ? stock.zxj.toFixed(isFund ? 4 : (stock.stock_type === 'GP-HK' ? 3 : 2)) : '-'}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', fontSize: '13px' }}>
                <span style={{ fontWeight: 600, ...getPriceColorStyle(stock.zd) }}>
                  {stock.zd > 0 ? '+' : ''}{stock.zd !== undefined ? stock.zd.toFixed(isFund ? 4 : (stock.stock_type === 'GP-HK' ? 3 : 2)) : '-'}
                </span>
                <span style={{ fontWeight: 600, ...getPriceColorStyle(stock.zd) }}>
                  {stock.zdf > 0 ? '+' : ''}{stock.zdf !== undefined ? stock.zdf.toFixed(2) : '-'}%
                </span>
              </div>
            </div>
          </Col>
        </Row>
      </div>

      {/* Basic Metrics Grid */}
      <div 
        style={{ 
          background: 'var(--social-bg)', 
          borderRadius: '8px', 
          padding: '12px 16px', 
          marginBottom: '20px',
          border: '1px solid var(--border)',
          fontSize: '13px'
        }}
      >
        <Row gutter={[16, 12]}>
          {isFund ? (
            <>
              <Col span={12} sm={6}>
                <div style={{ color: 'var(--text)', marginBottom: '4px' }}>单位净值</div>
                <div style={{ fontWeight: 600, color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>
                  {stock.zxj !== undefined ? stock.zxj.toFixed(4) : '-'}
                </div>
              </Col>
              <Col span={12} sm={6}>
                <div style={{ color: 'var(--text)', marginBottom: '4px' }}>日增长率</div>
                <div style={{ fontWeight: 600, ...getPriceColorStyle(stock.zd), fontFamily: 'var(--mono)' }}>
                  {stock.zdf !== undefined ? `${stock.zdf > 0 ? '+' : ''}${stock.zdf.toFixed(2)}%` : '-'}
                </div>
              </Col>
            </>
          ) : (
            <>
              <Col span={12} sm={6}>
                <div style={{ color: 'var(--text)', marginBottom: '4px' }}>成交量</div>
                <div style={{ fontWeight: 600, color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>
                  {formatVolume(stock.volume)}
                </div>
              </Col>
              <Col span={12} sm={6}>
                <div style={{ color: 'var(--text)', marginBottom: '4px' }}>成交额</div>
                <div style={{ fontWeight: 600, color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>
                  {formatTurnover(stock.turnover)}
                </div>
              </Col>
            </>
          )}
          <Col span={12} sm={6}>
            <div style={{ color: 'var(--text)', marginBottom: '4px' }}>{isFund ? '基金代码' : '股票代码'}</div>
            <div style={{ fontWeight: 600, color: 'var(--text-h)', fontFamily: 'var(--mono)' }}>
              {stock.code.replace(/^(sh|sz|of)/, '').toUpperCase()}
            </div>
          </Col>
          <Col span={12} sm={6}>
            <div style={{ color: 'var(--text)', marginBottom: '4px' }}>数据源</div>
            <div style={{ fontWeight: 600, color: 'var(--text-h)' }}>
              {isFund ? '天天基金 (Eastmoney)' : '新浪财经 (sinajs)'}
            </div>
          </Col>
        </Row>
      </div>

      {isFund ? (
        <div 
          style={{ 
            width: '100%', 
            minHeight: '260px', 
            display: 'flex', 
            flexDirection: 'column',
            justifyContent: 'center', 
            alignItems: 'center',
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '24px',
            textAlign: 'center',
            color: 'var(--text)'
          }}
        >
          <Empty 
            description={
              <div>
                <p style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-h)', marginBottom: '8px' }}>
                  场外开放式基金行情
                </p>
                <p style={{ margin: '0 auto', maxWidth: '440px', color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6' }}>
                  该开放式基金仅在每个交易日结束后更新一次基金单位净值，不提供日内分时或日/周/月K线等实时交易图表。
                </p>
              </div>
            }
          />
        </div>
      ) : (
        <>
          {/* Tabs for Charts */}
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={tabsItems}
            centered
            style={{ marginBottom: '12px' }}
          />

          {/* Chart Display Area */}
          <div 
            style={{ 
              position: 'relative', 
              width: '100%', 
              minHeight: '340px', 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              overflow: 'hidden',
              padding: '10px'
            }}
          >
            {imgLoading && (
              <div style={{ position: 'absolute', zIndex: 5 }}>
                <Spin size="large" tip="正在载入行情走势图..." />
              </div>
            )}

            {hasError ? (
              <Empty description="未能加载该周期的走势图。该标的可能无此时间维度的图表。" />
            ) : (
              <img
                src={chartUrl}
                alt={`${stock.name} ${activeTab} chart`}
                referrerPolicy="no-referrer"
                style={{ 
                  maxWidth: '100%', 
                  maxHeight: '320px', 
                  objectFit: 'contain',
                  display: imgLoading ? 'none' : 'block',
                  transition: 'opacity 0.3s ease'
                }}
                onLoad={() => setImgLoading(false)}
                onError={() => {
                  setImgLoading(false)
                  setHasError(true)
                }}
              />
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
