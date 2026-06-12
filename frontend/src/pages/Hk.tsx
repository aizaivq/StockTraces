import { useState, useEffect } from 'react'
import { Table, Input, Card, Alert, Tag, Button, Spin, Row, Col, Tabs, Empty } from 'antd'
import type { TableColumnsType, TablePaginationConfig } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import StockDetailModal from '../components/StockDetailModal'

interface HkStock {
  code: string
  name: string
  engname: string
  zxj: number
  zd: number
  zdf: number
  volume: number
  turnover: number
  high_52week: number
  low_52week: number
  pe_ratio: number
  stock_type: string
}

interface IndexDetail {
  img: string
  code: string
  qtcode: string
  name: string
  location: string
  zxj: string
  zdf: string
  state: string
}

interface MarketStatsItem {
  total: number
  rise: number
  fall: number
  flat: number
  limit_up: number
  limit_down: number
}

interface HkStatsData {
  hk_main: MarketStatsItem
  hk_gem: MarketStatsItem
  summary: MarketStatsItem
}

export default function Hk() {
  // Navigation State
  const [activeMainTab, setActiveMainTab] = useState('indices')

  // Details Modal States
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedStock, setSelectedStock] = useState<any>(null)

  // Hang Seng Index States
  const [hsi, setHsi] = useState<IndexDetail | null>(null)
  const [hsiLoading, setHsiLoading] = useState(false)

  // HK Stocks States
  const [stocks, setStocks] = useState<HkStock[]>([])

  // Tab 3: Stats States
  const [stats, setStats] = useState<HkStatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [sortBy, setSortBy] = useState('code')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [board, setBoard] = useState('')

  const getStockColorClass = (val: number) => {
    if (val > 0) return 'stock-up'
    if (val < 0) return 'stock-down'
    return 'stock-zero'
  }

  const getIndexColorClass = (valStr: string) => {
    const val = parseFloat(valStr)
    if (isNaN(val)) return 'stock-zero'
    if (val > 0) return 'stock-up'
    if (val < 0) return 'stock-down'
    return 'stock-zero'
  }

  const formatNumber = (num: number, digits: number = 2) => {
    if (num === undefined || num === null) return '-'
    return num.toFixed(digits)
  }

  const formatWithSign = (num: number, digits: number = 2) => {
    if (num === undefined || num === null) return '-'
    const prefix = num > 0 ? '+' : ''
    return prefix + num.toFixed(digits)
  }

  const formatZdfWithSign = (zdfStr: string) => {
    const val = parseFloat(zdfStr)
    if (isNaN(val)) return '-'
    const prefix = val > 0 ? '+' : ''
    return `${prefix}${val.toFixed(2)}%`
  }

  const formatPrice = (zxjStr: string) => {
    const val = parseFloat(zxjStr)
    if (isNaN(val)) return zxjStr
    return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  // Fetch Hang Seng Index
  const fetchHsi = async () => {
    setHsiLoading(true)
    try {
      const url = new URL('http://localhost:8080/api/indices')
      url.searchParams.append('_appver', '11.17.0')
      const response = await fetch(url.toString())
      if (response.ok) {
        const data = await response.json()
        if (data.code === 0) {
          const allList: IndexDetail[] = [
            ...(data.data.common || []),
            ...(data.data.asia || [])
          ]
          const found = allList.find(item => item.code === 'HSI' || item.qtcode === 'hkHSI')
          if (found) {
            setHsi(found)
          }
        }
      }
    } catch (err) {
      console.error('Error fetching HSI:', err)
    } finally {
      setHsiLoading(false)
    }
  }

  // Fetch HK Stocks list
  const fetchStocks = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('http://localhost:8080/api/hk-stocks')
      url.searchParams.append('_appver', '11.17.0')
      url.searchParams.append('limit', String(limit))
      url.searchParams.append('offset', String(offset))
      if (keyword) {
        url.searchParams.append('keyword', keyword)
      }
      if (board) {
        url.searchParams.append('board', board)
      }
      url.searchParams.append('sort_by', sortBy)
      url.searchParams.append('order', order)

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      if (data.code === 0) {
        setStocks(data.data.list || [])
        setTotal(data.data.total || 0)
      } else {
        setError(data.msg || '获取港股数据失败')
      }
    } catch (err) {
      setError('无法连接到后端服务，请确认后端服务已启动')
      console.error('Fetch HK stocks error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (activeMainTab !== 'indices') return
    fetchHsi()
  }, [activeMainTab])

  useEffect(() => {
    if (activeMainTab !== 'stocks') return
    fetchStocks()
  }, [activeMainTab, limit, offset, keyword, sortBy, order, board])

  useEffect(() => {
    if (activeMainTab !== 'stats') return

    const fetchStats = async () => {
      setStatsLoading(true)
      setStatsError(null)
      try {
        const url = new URL('http://localhost:8080/api/hk-stocks/stats')
        url.searchParams.append('_appver', '11.17.0')
        const response = await fetch(url.toString())
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }
        const data = await response.json()
        if (data.code === 0) {
          setStats(data.data)
        } else {
          setStatsError(data.msg || '获取港股统计数据失败')
        }
      } catch (err: any) {
        setStatsError('无法连接到后端服务，请确认后端服务已启动')
        console.error(err)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchStats()
  }, [activeMainTab])

  const handleSearch = (value: string) => {
    setKeyword(value.trim())
    setOffset(0)
  }

  const handleBoardTabChange = (key: string) => {
    setBoard(key)
    setOffset(0)
  }

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: any,
    sorter: any
  ) => {
    if (pagination.current && pagination.pageSize) {
      setLimit(pagination.pageSize)
      setOffset((pagination.current - 1) * pagination.pageSize)
    }

    if (sorter && sorter.field) {
      setSortBy(sorter.field)
      setOrder(sorter.order === 'ascend' ? 'asc' : 'desc')
    }
  }

  const columns: TableColumnsType<HkStock> = [
    {
      title: '代码',
      dataIndex: 'code',
      key: 'code',
      sorter: true,
      render: (code: string) => <span className="stock-code">{code}</span>
    },
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (name: string, record: HkStock) => (
        <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
          <span style={{ fontWeight: 500 }}>{name}</span>
          {record.engname && (
            <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.35)', textTransform: 'uppercase' }}>{record.engname}</span>
          )}
        </div>
      )
    },
    {
      title: '最新价 (HKD)',
      dataIndex: 'zxj',
      key: 'zxj',
      sorter: true,
      align: 'right',
      render: (val: number, record: HkStock) => (
        <span className={getStockColorClass(record.zd)} style={{ fontWeight: 600, fontFamily: 'ui-monospace, Consolas, monospace' }}>
          {formatNumber(val, 3)}
        </span>
      )
    },
    {
      title: '涨跌额',
      dataIndex: 'zd',
      key: 'zd',
      sorter: true,
      align: 'right',
      render: (val: number) => (
        <span className={getStockColorClass(val)} style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>
          {formatWithSign(val, 3)}
        </span>
      )
    },
    {
      title: '涨跌幅',
      dataIndex: 'zdf',
      key: 'zdf',
      sorter: true,
      align: 'right',
      render: (val: number, record: HkStock) => (
        <span className={getStockColorClass(record.zd)} style={{ fontWeight: 600, fontFamily: 'ui-monospace, Consolas, monospace' }}>
          {formatWithSign(val, 2)}%
        </span>
      )
    },
    {
      title: '成交量 (股)',
      dataIndex: 'volume',
      key: 'volume',
      sorter: true,
      align: 'right',
      render: (val: number) => <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{Math.round(val).toLocaleString()}</span>
    },
    {
      title: '成交额 (HKD)',
      dataIndex: 'turnover',
      key: 'turnover',
      sorter: true,
      align: 'right',
      render: (val: number) => (
        <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>
          {val >= 100000000
            ? `${(val / 100000000).toFixed(2)}亿`
            : val >= 10000
            ? `${(val / 10000).toFixed(2)}万`
            : val.toFixed(0)}
        </span>
      )
    },
    {
      title: '52周最高',
      dataIndex: 'high_52week',
      key: 'high_52week',
      align: 'right',
      render: (val: number) => <span style={{ color: 'rgba(0,0,0,0.65)', fontFamily: 'ui-monospace, Consolas, monospace' }}>{formatNumber(val, 3)}</span>
    },
    {
      title: '52周最低',
      dataIndex: 'low_52week',
      key: 'low_52week',
      align: 'right',
      render: (val: number) => <span style={{ color: 'rgba(0,0,0,0.65)', fontFamily: 'ui-monospace, Consolas, monospace' }}>{formatNumber(val, 3)}</span>
    },
    {
      title: '市盈率 (PE)',
      dataIndex: 'pe_ratio',
      key: 'pe_ratio',
      sorter: true,
      align: 'right',
      render: (val: number) => (
        <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>
          {val > 0 ? formatNumber(val, 2) : '-'}
        </span>
      )
    }
  ]

  const renderMarketStats = () => {
    if (!stats) return null

    const marketGroups = [
      { key: 'summary', title: '全市场汇总', desc: '包含港股主板与创业板全部股票数据统计', item: stats.summary, color: '#aa3bff' },
      { key: 'hk_main', title: '港股主板', desc: '香港联合交易所主板股票数据统计', item: stats.hk_main, color: '#ef4444' },
      { key: 'hk_gem', title: '港股创业板', desc: '香港联合交易所创业板股票数据统计', item: stats.hk_gem, color: '#06b6d4' }
    ]

    return (
      <Row gutter={[24, 24]}>
        {marketGroups.map((group) => {
          const { item, title, desc, color } = group
          if (!item) return null

          const risePercent = item.total > 0 ? ((item.rise / item.total) * 100).toFixed(1) : '0.0'
          const fallPercent = item.total > 0 ? ((item.fall / item.total) * 100).toFixed(1) : '0.0'
          const flatPercent = item.total > 0 ? (100 - parseFloat(risePercent) - parseFloat(fallPercent)).toFixed(1) : '0.0'

          return (
            <Col xs={24} md={12} lg={8} key={group.key}>
              <Card 
                bordered 
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '4px', height: '18px', background: color, borderRadius: '2px' }} />
                    <span style={{ fontSize: '16px', fontWeight: 600 }}>{title}</span>
                  </div>
                }
                style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', border: '1px solid #f0f0f0' }}
              >
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'rgba(0,0,0,0.45)' }}>{desc}</p>
                
                {/* Big summary total */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <span style={{ fontSize: '14px', color: 'rgba(0,0,0,0.65)' }}>总计股票家数</span>
                  <span style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                    {item.total.toLocaleString()}
                  </span>
                </div>

                {/* Sentiment Bar Chart */}
                <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', margin: '16px 0 8px 0', background: '#f0f0f0' }}>
                  <div style={{ width: `${risePercent}%`, background: 'var(--stock-up)', transition: 'width 0.5s ease' }} title={`上涨: ${risePercent}%`} />
                  <div style={{ width: `${flatPercent}%`, background: 'var(--stock-zero)', transition: 'width 0.5s ease' }} title={`平盘: ${flatPercent}%`} />
                  <div style={{ width: `${fallPercent}%`, background: 'var(--stock-down)', transition: 'width 0.5s ease' }} title={`下跌: ${fallPercent}%`} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(0,0,0,0.45)', marginBottom: '20px' }}>
                  <span>上涨: {item.rise} ({risePercent}%)</span>
                  <span>平盘: {item.flat} ({flatPercent}%)</span>
                  <span>下跌: {item.fall} ({fallPercent}%)</span>
                </div>

                {/* Large Price Moves */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #f5f5f5', paddingTop: '16px' }}>
                  <div style={{ background: 'rgba(239, 68, 68, 0.04)', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.08)' }}>
                    <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', marginBottom: '4px' }}>大涨数 (zdf &gt;= 10%)</div>
                    <div className="stock-up" style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                      {item.limit_up}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(34, 197, 94, 0.04)', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(34, 197, 94, 0.08)' }}>
                    <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', marginBottom: '4px' }}>大跌数 (zdf &lt;= -10%)</div>
                    <div className="stock-down" style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                      {item.limit_down}
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          )
        })}
      </Row>
    )
  }

  const mainTabs = [
    { key: 'indices', label: '股指' },
    { key: 'stocks', label: '股票' },
    { key: 'stats', label: '统计' }
  ]

  const boardTabs = [
    { key: '', label: '全部港股' },
    { key: 'main', label: '主板股票' },
    { key: 'gem', label: '创业板股票' },
    { key: 'ah', label: 'A+H股' }
  ]

  const currentPage = Math.floor(offset / limit) + 1

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Title Card */}
      <Card bordered={false} style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'rgba(0,0,0,0.85)' }}>港股市场中心</h1>
            <p style={{ margin: '4px 0 0 0', color: 'rgba(0,0,0,0.45)', fontSize: '14px' }}>
              提供港股大盘指数、股票行情排行与大盘股指
            </p>
          </div>
          {activeMainTab === 'indices' && (
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={() => {
                setActiveMainTab('')
                setTimeout(() => setActiveMainTab('indices'), 50)
              }}
              loading={hsiLoading}
            >
              刷新股指
            </Button>
          )}
          {activeMainTab === 'stocks' && (
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={() => {
                setActiveMainTab('')
                setTimeout(() => setActiveMainTab('stocks'), 50)
              }}
              loading={loading}
            >
              刷新股票
            </Button>
          )}
          {activeMainTab === 'stats' && (
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={() => {
                setActiveMainTab('')
                setTimeout(() => setActiveMainTab('stats'), 50)
              }}
              loading={statsLoading}
            >
              刷新统计
            </Button>
          )}
        </div>
      </Card>

      <Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Tabs
          activeKey={activeMainTab}
          onChange={(key) => setActiveMainTab(key)}
          items={mainTabs.map(tab => ({ key: tab.key, label: tab.label }))}
          style={{ marginBottom: '24px' }}
        />

        {/* Tab 1: Indices */}
        {activeMainTab === 'indices' && (
          <Spin spinning={hsiLoading} tip="正在获取最新港股大盘指数...">
            {!hsiLoading && !hsi && (
              <Empty description="暂无港股大盘指数数据。" />
            )}
            {hsi && (
              <Row gutter={[20, 20]}>
                <Col xs={24} sm={12} md={8} lg={6} key={hsi.qtcode}>
                  <Card 
                    hoverable 
                    style={{ borderRadius: '8px', border: '1px solid #f0f0f0', cursor: 'pointer' }}
                    styles={{ body: { padding: '16px' } }}
                    onClick={() => {
                      setSelectedStock({
                        code: hsi.qtcode || hsi.code,
                        name: hsi.name,
                        zxj: parseFloat(hsi.zxj),
                        zd: parseFloat(hsi.zdf),
                        zdf: parseFloat(hsi.zdf),
                        stock_type: 'INDEX'
                      })
                      setDetailVisible(true)
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                        <span style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(0,0,0,0.85)' }}>
                          {hsi.name}
                        </span>
                        <span style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12px', color: 'rgba(0,0,0,0.45)' }}>
                          {hsi.code}
                        </span>
                      </div>
                      {hsi.img && (
                        <img 
                          src={hsi.img} 
                          alt={hsi.name} 
                          style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #f0f0f0', objectFit: 'cover' }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none'
                          }}
                        />
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                      <span className={getIndexColorClass(hsi.zdf)} style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                        {formatPrice(hsi.zxj)}
                      </span>
                      <span className={getIndexColorClass(hsi.zdf)} style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                        {formatZdfWithSign(hsi.zdf)}
                      </span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'rgba(0,0,0,0.45)', borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
                      <span>地区: {hsi.location}</span>
                      <Tag color={hsi.state === 'open' ? 'success' : 'default'}>
                        {hsi.state === 'open' ? '交易中' : '已收盘'}
                      </Tag>
                    </div>
                  </Card>
                </Col>
              </Row>
            )}
          </Spin>
        )}

        {/* Tab 2: Stocks */}
        {activeMainTab === 'stocks' && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
              <Tabs
                activeKey={board}
                onChange={handleBoardTabChange}
                items={boardTabs.map(tab => ({ key: tab.key, label: tab.label }))}
                style={{ flex: 1 }}
              />
              <Input.Search
                placeholder="搜索港股代码或名称..."
                onSearch={handleSearch}
                enterButton
                style={{ maxWidth: '300px' }}
                allowClear
              />
            </div>

            {error && <Alert message={error} type="error" showIcon style={{ marginBottom: '24px' }} />}

            <Table
              dataSource={stocks}
              columns={columns}
              rowKey="code"
              loading={loading}
              onChange={handleTableChange}
              scroll={{ x: 'max-content' }}
              onRow={(record) => ({
                onClick: () => {
                  setSelectedStock({
                    code: record.code,
                    name: record.name,
                    zxj: record.zxj,
                    zd: record.zd,
                    zdf: record.zdf,
                    volume: record.volume,
                    turnover: record.turnover,
                    stock_type: record.stock_type || 'GP-HK'
                  })
                  setDetailVisible(true)
                },
                style: { cursor: 'pointer' }
              })}
              pagination={{
                current: currentPage,
                pageSize: limit,
                total: total,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '50', '100'],
                showTotal: (totalCount) => `共 ${totalCount} 只${board === 'main' ? '港股主板' : board === 'gem' ? '港股创业板' : board === 'ah' ? 'A+H股' : '港股'}股票`,
                style: { marginTop: '24px' }
              }}
            />
          </>
        )}

        {/* Tab 3: Stats Dashboard */}
        {activeMainTab === 'stats' && (
          <Spin spinning={statsLoading} tip="正在获取最新港股统计数据...">
            {statsError && <Alert message={statsError} type="error" showIcon style={{ marginBottom: '24px' }} />}
            {!statsLoading && !statsError && !stats && (
              <Empty description="暂无港股统计数据。" />
            )}
            {!statsLoading && !statsError && stats && renderMarketStats()}
          </Spin>
        )}
      </Card>
      <StockDetailModal 
        visible={detailVisible}
        onClose={() => {
          setDetailVisible(false)
          setSelectedStock(null)
        }}
        stock={selectedStock}
      />
    </div>
  )
}
