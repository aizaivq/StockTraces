import { useState, useEffect } from 'react'
import { Table, Input, Tabs, Alert, Card, Empty, Tag, Button, Spin, Row, Col } from 'antd'
import type { TableColumnsType, TablePaginationConfig } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import StockDetailModal from '../components/StockDetailModal'

interface Stock {
  code: string
  name: string
  zxj: number
  zd: number
  zdf: number
  hsl: number
  zf: number
  volume: number
  turnover: number
  ltsz: number
  zsz: number
  pe_ttm: number
  pn: number
  lb: number
  speed: number
  state: string
  stock_type: string
  zljlr: number
  zllr: number
  zllc: number
  zllr_d5: number
  zllc_d5: number
  zdf_d5: number
  zdf_d10: number
  zdf_d20: number
  zdf_d60: number
  zdf_w52: number
  zdf_y: number
  updated_at: string
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

interface IndustryDetail {
  code: string
  name: string
  hsl: string
  ltsz: string
  zsz: string
  volume: string
  turnover: string
  zd: string
  zdf: string
  zgb: string
  zxj: string
  lzg: {
    code: string
    name: string
    zd: string
    zdf: string
    zxj: string
  }
}

interface MarketStatsItem {
  total: number
  rise: number
  fall: number
  flat: number
  limit_up: number
  limit_down: number
}

interface SectorDetailItem {
  name: string
  zdf: number
  lzg_name: string
  lzg_code: string
  lzg_zdf: number
}

interface SectorStats {
  total: number
  rise: number
  fall: number
  flat: number
  top_gainers: SectorDetailItem[]
  top_losers: SectorDetailItem[]
}

interface StatsData {
  sh_main: MarketStatsItem
  sh_kcb: MarketStatsItem
  sz_main: MarketStatsItem
  sz_cyb: MarketStatsItem
  bj: MarketStatsItem
  summary: MarketStatsItem
  sectors?: SectorStats
}

export default function CnA() {
  // Navigation State
  const [activeMainTab, setActiveMainTab] = useState('indices')

  // Details Modal States
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedStock, setSelectedStock] = useState<any>(null)

  // Tab 1: Indices States
  const [indices, setIndices] = useState<IndexDetail[]>([])
  const [indicesLoading, setIndicesLoading] = useState(false)
  const [indicesError, setIndicesError] = useState<string | null>(null)

  // Tab 2: Stocks States
  const [stocks, setStocks] = useState<Stock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [sortBy, setSortBy] = useState('code')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [board, setBoard] = useState('')

  // Tab 4: Stats States
  const [stats, setStats] = useState<StatsData | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Tab 3: Sectors States
  const [sectors, setSectors] = useState<IndustryDetail[]>([])
  const [sectorsLoading, setSectorsLoading] = useState(false)
  const [sectorsError, setSectorsError] = useState<string | null>(null)
  const [sectorsTotal, setSectorsTotal] = useState(0)
  const [sectorsLimit, setSectorsLimit] = useState(200)
  const [sectorsOffset, setSectorsOffset] = useState(0)
  const [sectorsSortBy, setSectorsSortBy] = useState('priceRatio')
  const [sectorsOrder, setSectorsOrder] = useState<'asc' | 'desc'>('desc')

  // Helper functions
  const getStockColorClass = (val: number) => {
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

  // Effect for Tab 1: Indices
  useEffect(() => {
    if (activeMainTab !== 'indices') return

    const fetchIndices = async () => {
      setIndicesLoading(true)
      setIndicesError(null)
      try {
        const url = new URL('http://localhost:8080/api/indices')
        url.searchParams.append('_appver', '11.17.0')
        const response = await fetch(url.toString())
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }
        const data = await response.json()
        if (data.code === 0) {
          // Merge all index lists
          const allList: IndexDetail[] = [
            ...(data.data.common || []),
            ...(data.data.asia || []),
            ...(data.data.america || []),
            ...(data.data.europe || []),
            ...(data.data.other || [])
          ]
          
          // Deduplicate A-share indices by qtcode (Shanghai, Shenzhen, Beijing)
          const uniqueMap = new Map<string, IndexDetail>()
          allList.forEach(item => {
            const nameLower = item.name.toLowerCase()
            const isAShare = 
              item.location === '上海' || 
              item.location === '深圳' || 
              item.location === '北京' ||
              item.qtcode.startsWith('sh') || 
              item.qtcode.startsWith('sz') || 
              item.qtcode.startsWith('bj') ||
              nameLower.includes('上证') ||
              nameLower.includes('深证') ||
              nameLower.includes('沪深') ||
              nameLower.includes('科创') ||
              nameLower.includes('创业板')

            if (isAShare) {
              uniqueMap.set(item.qtcode, item)
            }
          })
          setIndices(Array.from(uniqueMap.values()))
        } else {
          setIndicesError(data.msg || '获取股指数据失败')
        }
      } catch (err: unknown) {
        setIndicesError('无法连接到后端服务')
        console.error(err)
      } finally {
        setIndicesLoading(false)
      }
    }

    fetchIndices()
  }, [activeMainTab])

  // Effect for Tab 2: Stocks List
  useEffect(() => {
    if (activeMainTab !== 'stocks') return

    const fetchStocks = async () => {
      setLoading(true)
      setError(null)
      try {
        const url = new URL('http://localhost:8080/api/stocks')
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
          setError(data.msg || '获取数据失败')
        }
      } catch (err: unknown) {
        setError('无法连接到后端服务，请确认后端服务运行在 http://localhost:8080')
        console.error('Fetch error:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchStocks()
  }, [activeMainTab, limit, offset, keyword, sortBy, order, board])

  // Effect for Tab 3: Sectors List
  useEffect(() => {
    if (activeMainTab !== 'sectors') return

    const fetchSectors = async () => {
      setSectorsLoading(true)
      setSectorsError(null)
      try {
        const url = new URL('http://localhost:8080/api/industries')
        url.searchParams.append('_appver', '11.17.0')
        url.searchParams.append('board_type', 'hy2')
        url.searchParams.append('sort_type', sectorsSortBy)
        url.searchParams.append('direct', sectorsOrder === 'asc' ? 'up' : 'down')
        url.searchParams.append('offset', String(sectorsOffset))
        url.searchParams.append('count', String(sectorsLimit))

        const response = await fetch(url.toString())
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }
        const data = await response.json()
        if (data.code === 0) {
          setSectors(data.data.rank_list || [])
          setSectorsTotal(data.data.total || 0)
        } else {
          setSectorsError(data.msg || '获取行业板块失败')
        }
      } catch (err: unknown) {
        setSectorsError('无法连接到后端服务')
        console.error(err)
      } finally {
        setSectorsLoading(false)
      }
    }

    fetchSectors()
  }, [activeMainTab, sectorsLimit, sectorsOffset, sectorsSortBy, sectorsOrder])

  // Effect for Tab 4: Stats
  useEffect(() => {
    if (activeMainTab !== 'stats') return

    const fetchStats = async () => {
      setStatsLoading(true)
      setStatsError(null)
      try {
        const url = new URL('http://localhost:8080/api/stocks/stats')
        url.searchParams.append('_appver', '11.17.0')
        const response = await fetch(url.toString())
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`)
        }
        const data = await response.json()
        if (data.code === 0) {
          setStats(data.data)
        } else {
          setStatsError(data.msg || '获取统计数据失败')
        }
      } catch (err: unknown) {
        setStatsError('无法连接到后端服务')
        console.error(err)
      } finally {
        setStatsLoading(false)
      }
    }

    fetchStats()
  }, [activeMainTab])

  // Handlers for Stocks Table
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

  // Handlers for Sectors Table
  const handleSectorsTableChange = (
    pagination: TablePaginationConfig,
    _filters: any,
    sorter: any
  ) => {
    if (pagination.current && pagination.pageSize) {
      setSectorsLimit(pagination.pageSize)
      setSectorsOffset((pagination.current - 1) * pagination.pageSize)
    }

    if (sorter && sorter.field) {
      const field = sorter.field
      if (field === 'zdf') {
        setSectorsSortBy('priceRatio')
      } else if (field === 'zxj') {
        setSectorsSortBy('price')
      } else {
        setSectorsSortBy('priceRatio')
      }
      setSectorsOrder(sorter.order === 'ascend' ? 'asc' : 'desc')
    }
  }

  // Columns definition for Stocks
  const columns: TableColumnsType<Stock> = [
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
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>
    },
    {
      title: '最新价',
      dataIndex: 'zxj',
      key: 'zxj',
      sorter: true,
      align: 'right',
      render: (val: number, record: Stock) => (
        <span className={getStockColorClass(record.zd)}>{formatNumber(val, 2)}</span>
      )
    },
    {
      title: '涨跌额',
      dataIndex: 'zd',
      key: 'zd',
      sorter: true,
      align: 'right',
      render: (val: number) => (
        <span className={getStockColorClass(val)}>{formatWithSign(val, 2)}</span>
      )
    },
    {
      title: '涨跌幅',
      dataIndex: 'zdf',
      key: 'zdf',
      sorter: true,
      align: 'right',
      render: (val: number, record: Stock) => (
        <span className={getStockColorClass(record.zd)}>{formatWithSign(val, 2)}%</span>
      )
    },
    {
      title: '换手率',
      dataIndex: 'hsl',
      key: 'hsl',
      sorter: true,
      align: 'right',
      render: (val: number) => <span>{formatNumber(val, 2)}%</span>
    },
    {
      title: '振幅',
      dataIndex: 'zf',
      key: 'zf',
      sorter: true,
      align: 'right',
      render: (val: number) => <span>{formatNumber(val, 2)}%</span>
    },
    {
      title: '成交量(手)',
      dataIndex: 'volume',
      key: 'volume',
      sorter: true,
      align: 'right',
      render: (val: number) => <span>{Math.round(val).toLocaleString()}</span>
    },
    {
      title: '成交额',
      dataIndex: 'turnover',
      key: 'turnover',
      sorter: true,
      align: 'right',
      render: (val: number) => (
        <span>
          {val >= 10000
            ? `${(val / 10000).toFixed(2)}亿`
            : `${val.toFixed(2)}万`}
        </span>
      )
    },
    {
      title: '流通市值',
      dataIndex: 'ltsz',
      key: 'ltsz',
      sorter: true,
      align: 'right',
      render: (val: number) => <span>{formatNumber(val, 2)}亿</span>
    },
    {
      title: '总市值',
      dataIndex: 'zsz',
      key: 'zsz',
      sorter: true,
      align: 'right',
      render: (val: number) => <span>{formatNumber(val, 2)}亿</span>
    }
  ]

  // Columns definition for Sectors
  const sectorColumns: TableColumnsType<IndustryDetail> = [
    {
      title: '行业代码',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <span className="stock-code">{code}</span>
    },
    {
      title: '行业名称',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>
    },
    {
      title: '行业涨跌幅',
      dataIndex: 'zdf',
      key: 'zdf',
      sorter: true,
      align: 'right',
      render: (val: string) => {
        const floatVal = parseFloat(val)
        return <span className={getStockColorClass(floatVal)}>{formatWithSign(floatVal, 2)}%</span>
      }
    },
    {
      title: '行业指数',
      dataIndex: 'zxj',
      key: 'zxj',
      sorter: true,
      align: 'right',
      render: (val: string) => <span>{formatPrice(val)}</span>
    },
    {
      title: '平均换手率',
      dataIndex: 'hsl',
      key: 'hsl',
      align: 'right',
      render: (val: string) => <span>{parseFloat(val).toFixed(2)}%</span>
    },
    {
      title: '涨跌家数比',
      dataIndex: 'zgb',
      key: 'zgb',
      align: 'center',
      render: (val: string) => <span>{val}</span>
    },
    {
      title: '领涨个股',
      dataIndex: ['lzg', 'name'],
      key: 'lzg_name',
      render: (_val: string, record: IndustryDetail) => {
        if (!record.lzg) return '-'
        return (
          <div>
            <span style={{ fontWeight: 500 }}>{record.lzg.name}</span>
            <span className="stock-code" style={{ marginLeft: '6px' }}>({record.lzg.code})</span>
          </div>
        )
      }
    },
    {
      title: '领涨股最新价',
      dataIndex: ['lzg', 'zxj'],
      key: 'lzg_zxj',
      align: 'right',
      render: (_val: string, record: IndustryDetail) => {
        if (!record.lzg) return '-'
        const floatPrice = parseFloat(record.lzg.zxj)
        const floatChange = parseFloat(record.lzg.zd)
        return <span className={getStockColorClass(floatChange)}>{formatNumber(floatPrice, 2)}</span>
      }
    },
    {
      title: '领涨股涨跌幅',
      dataIndex: ['lzg', 'zdf'],
      key: 'lzg_zdf',
      align: 'right',
      render: (_val: string, record: IndustryDetail) => {
        if (!record.lzg) return '-'
        const floatVal = parseFloat(record.lzg.zdf)
        return <span className={getStockColorClass(floatVal)}>{formatWithSign(floatVal, 2)}%</span>
      }
    }
  ]

  const boardTabs = [
    { key: '', label: '全部 A 股' },
    { key: 'main', label: '主板股票' },
    { key: 'cyb', label: '创业板股票' },
    { key: 'kcb', label: '科创板股票' },
    { key: 'bj', label: '北交所股票' }
  ]

  const mainTabs = [
    { key: 'indices', label: '股指' },
    { key: 'stocks', label: '股票' },
    { key: 'sectors', label: '板块' },
    { key: 'stats', label: '统计' }
  ]

  const currentPage = Math.floor(offset / limit) + 1

  // Render Sub-sections
  const renderStocksList = () => {
    return (
      <>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
          <Tabs
            activeKey={board}
            onChange={handleBoardTabChange}
            items={boardTabs.map(tab => ({ key: tab.key, label: tab.label }))}
            style={{ flex: 1 }}
          />
          <Input.Search
            placeholder="搜索股票代码或名称..."
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
                stock_type: record.stock_type
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
            showTotal: (totalCount) => `共 ${totalCount} 只股票`,
            style: { marginTop: '24px' }
          }}
        />
      </>
    )
  }

  const renderMarketStats = () => {
    if (!stats) return null

    const marketGroups = [
      { key: 'summary', title: '全市场汇总', desc: '包含沪深京全部A股数据统计', item: stats.summary, color: '#aa3bff' },
      { key: 'sh_main', title: '沪市主板', desc: '上海证券交易所主板股票数据统计', item: stats.sh_main, color: '#ef4444' },
      { key: 'sh_kcb', title: '科创板', desc: '上海证券交易所科创板股票数据统计', item: stats.sh_kcb, color: '#ec4899' },
      { key: 'sz_main', title: '深市主板', desc: '深圳证券交易所主板股票数据统计', item: stats.sz_main, color: '#3b82f6' },
      { key: 'sz_cyb', title: '创业板', desc: '深圳证券交易所创业板股票数据统计', item: stats.sz_cyb, color: '#06b6d4' },
      { key: 'bj', title: '北交所 (京市)', desc: '北京证券交易所公开发行股票数据统计', item: stats.bj, color: '#f59e0b' }
    ]

    const sectors = stats.sectors

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        {/* Section 1: Stock Market Boards */}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ width: '4px', height: '18px', background: 'var(--accent)', borderRadius: '2px' }} />
            大盘指数及股票市场统计
          </h2>
          <Row gutter={[24, 24]}>
            {marketGroups.map((group) => {
              const { item, title, desc, color } = group
              if (!item) return null

              const risePercent = ((item.rise / item.total) * 100).toFixed(1)
              const fallPercent = ((item.fall / item.total) * 100).toFixed(1)
              const flatPercent = (100 - parseFloat(risePercent) - parseFloat(fallPercent)).toFixed(1)

              return (
                <Col xs={24} md={12} key={group.key}>
                  <Card 
                    bordered 
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '4px', height: '18px', background: color, borderRadius: '2px' }} />
                        <span style={{ fontSize: '15px', fontWeight: 600 }}>{title}</span>
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

                    {/* Limit Ups and Limit Downs */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #f5f5f5', paddingTop: '16px' }}>
                      <div style={{ background: 'rgba(239, 68, 68, 0.04)', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.08)' }}>
                        <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', marginBottom: '4px' }}>涨停数 (Limit Up)</div>
                        <div className="stock-up" style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                          {item.limit_up}
                        </div>
                      </div>
                      <div style={{ background: 'rgba(34, 197, 94, 0.04)', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(34, 197, 94, 0.08)' }}>
                        <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', marginBottom: '4px' }}>跌停数 (Limit Down)</div>
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
        </div>

        {/* Section 2: Industry Sector statistics */}
        {sectors && sectors.total > 0 && (
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '4px', height: '18px', background: 'var(--accent)', borderRadius: '2px' }} />
              行业板块统计看板
            </h2>
            <Row gutter={[24, 24]}>
              {/* Overview Card */}
              <Col xs={24} md={12}>
                <Card 
                  bordered 
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '4px', height: '18px', background: '#3b82f6', borderRadius: '2px' }} />
                      <span style={{ fontSize: '15px', fontWeight: 600 }}>行业板块整体概况</span>
                    </div>
                  }
                  style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', border: '1px solid #f0f0f0', height: '100%' }}
                >
                  <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'rgba(0,0,0,0.45)' }}>基于二级行业分类的板块上涨与下跌比例统计</p>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <span style={{ fontSize: '14px', color: 'rgba(0,0,0,0.65)' }}>总计板块数量</span>
                    <span style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                      {sectors.total.toLocaleString()}
                    </span>
                  </div>

                  {/* Sentiment Bar */}
                  {(() => {
                    const riseP = ((sectors.rise / sectors.total) * 100).toFixed(1)
                    const fallP = ((sectors.fall / sectors.total) * 100).toFixed(1)
                    const flatP = (100 - parseFloat(riseP) - parseFloat(fallP)).toFixed(1)
                    return (
                      <>
                        <div style={{ display: 'flex', height: '10px', borderRadius: '5px', overflow: 'hidden', margin: '16px 0 8px 0', background: '#f0f0f0' }}>
                          <div style={{ width: `${riseP}%`, background: 'var(--stock-up)', transition: 'width 0.5s ease' }} />
                          <div style={{ width: `${flatP}%`, background: 'var(--stock-zero)', transition: 'width 0.5s ease' }} />
                          <div style={{ width: `${fallP}%`, background: 'var(--stock-down)', transition: 'width 0.5s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'rgba(0,0,0,0.45)', marginBottom: '20px' }}>
                          <span>上涨: {sectors.rise} ({riseP}%)</span>
                          <span>平盘: {sectors.flat} ({flatP}%)</span>
                          <span>下跌: {sectors.fall} ({fallP}%)</span>
                        </div>

                        {/* Rise and Fall Sectors */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid #f5f5f5', paddingTop: '16px', marginTop: '16px' }}>
                          <div style={{ background: 'rgba(239, 68, 68, 0.04)', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(239, 68, 68, 0.08)' }}>
                            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', marginBottom: '4px' }}>上涨板块数</div>
                            <div className="stock-up" style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                              {sectors.rise}
                            </div>
                          </div>
                          <div style={{ background: 'rgba(34, 197, 94, 0.04)', padding: '12px', borderRadius: '8px', textAlign: 'center', border: '1px solid rgba(34, 197, 94, 0.08)' }}>
                            <div style={{ fontSize: '12px', color: 'rgba(0,0,0,0.45)', marginBottom: '4px' }}>下跌板块数</div>
                            <div className="stock-down" style={{ fontSize: '20px', fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                              {sectors.fall}
                            </div>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </Card>
              </Col>

              {/* Leaderboards Card */}
              <Col xs={24} md={12}>
                <Card 
                  bordered
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '4px', height: '18px', background: '#ec4899', borderRadius: '2px' }} />
                      <span style={{ fontSize: '15px', fontWeight: 600 }}>行业行情排行领涨/领跌</span>
                    </div>
                  }
                  style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.02)', border: '1px solid #f0f0f0', height: '100%' }}
                >
                  {/* Gainers */}
                  <div style={{ marginBottom: '16px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--stock-up)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📈 领涨板块 Top 3
                    </div>
                    {sectors.top_gainers && sectors.top_gainers.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '6px 0', borderBottom: '1px dashed #f5f5f5' }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.45)', marginLeft: '8px' }}>
                            领涨股: {item.lzg_name} ({item.lzg_code})
                          </span>
                        </div>
                        <span style={{ color: 'var(--stock-up)', fontWeight: 600, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                          +{item.zdf.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Losers */}
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--stock-down)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      📉 领跌板块 Top 3
                    </div>
                    {sectors.top_losers && sectors.top_losers.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', padding: '6px 0', borderBottom: '1px dashed #f5f5f5' }}>
                        <div>
                          <span style={{ fontWeight: 600 }}>{item.name}</span>
                          <span style={{ fontSize: '11px', color: 'rgba(0,0,0,0.45)', marginLeft: '8px' }}>
                            领跌股: {item.lzg_name} ({item.lzg_code})
                          </span>
                        </div>
                        <span style={{ color: 'var(--stock-down)', fontWeight: 600, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                          {item.zdf.toFixed(2)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      {/* Title Card */}
      <Card bordered={false} style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'rgba(0,0,0,0.85)' }}>A股市场中心</h1>
            <p style={{ margin: '4px 0 0 0', color: 'rgba(0,0,0,0.45)', fontSize: '14px' }}>
              提供 A 股大盘指数、股票行情排行、行业板块热度与市场统计
            </p>
          </div>
          {activeMainTab === 'indices' && (
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={() => {
                // Fetch indices again
                setActiveMainTab('')
                setTimeout(() => setActiveMainTab('indices'), 50)
              }}
              loading={indicesLoading}
            >
              刷新股指
            </Button>
          )}
          {activeMainTab === 'sectors' && (
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={() => {
                // Fetch sectors again
                setActiveMainTab('')
                setTimeout(() => setActiveMainTab('sectors'), 50)
              }}
              loading={sectorsLoading}
            >
              刷新板块
            </Button>
          )}
          {activeMainTab === 'stats' && (
            <Button 
              type="primary" 
              icon={<ReloadOutlined />} 
              onClick={() => {
                // Fetch stats again
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
          <Spin spinning={indicesLoading} tip="正在获取最新 A 股大盘指数...">
            {indicesError && <Alert message={indicesError} type="error" showIcon style={{ marginBottom: '24px' }} />}
            {!indicesLoading && !indicesError && indices.length === 0 && (
              <Empty description="暂无 A 股大盘指数数据。" />
            )}
            {!indicesLoading && !indicesError && indices.length > 0 && (
              <Row gutter={[20, 20]}>
                {indices.map((item) => {
                  const colorClass = getStockColorClass(parseFloat(item.zdf))
                  return (
                    <Col xs={24} sm={12} md={8} lg={6} key={item.qtcode}>
                      <Card 
                        hoverable 
                        style={{ borderRadius: '8px', border: '1px solid #f0f0f0', cursor: 'pointer' }}
                        styles={{ body: { padding: '16px' } }}
                        onClick={() => {
                          setSelectedStock({
                            code: item.qtcode || item.code,
                            name: item.name,
                            zxj: parseFloat(item.zxj),
                            zd: parseFloat(item.zdf),
                            zdf: parseFloat(item.zdf),
                            stock_type: 'INDEX'
                          })
                          setDetailVisible(true)
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
                            <span style={{ fontSize: '15px', fontWeight: 600, color: 'rgba(0,0,0,0.85)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }} title={item.name}>
                              {item.name}
                            </span>
                            <span style={{ fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '12px', color: 'rgba(0,0,0,0.45)' }}>
                              {item.code}
                            </span>
                          </div>
                          {item.img && (
                            <img 
                              src={item.img} 
                              alt={item.name} 
                              style={{ width: '28px', height: '28px', borderRadius: '50%', border: '1px solid #f0f0f0', objectFit: 'cover' }}
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          )}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '12px' }}>
                          <span className={colorClass} style={{ fontSize: '22px', fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                            {formatPrice(item.zxj)}
                          </span>
                          <span className={colorClass} style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'ui-monospace, Consolas, monospace' }}>
                            {formatZdfWithSign(item.zdf)}
                          </span>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', color: 'rgba(0,0,0,0.45)', borderTop: '1px solid #f0f0f0', paddingTop: '10px' }}>
                          <span>地区: {item.location}</span>
                          <Tag color={item.state === 'open' ? 'success' : 'default'}>
                            {item.state === 'open' ? '交易中' : '已收盘'}
                          </Tag>
                        </div>
                      </Card>
                    </Col>
                  )
                })}
              </Row>
            )}
          </Spin>
        )}

        {/* Tab 2: Stocks List */}
        {activeMainTab === 'stocks' && renderStocksList()}

        {/* Tab 3: Sectors List */}
        {activeMainTab === 'sectors' && (
          <Spin spinning={sectorsLoading} tip="正在获取最新行业板块...">
            {sectorsError && <Alert message={sectorsError} type="error" showIcon style={{ marginBottom: '24px' }} />}
            <Table
              dataSource={sectors}
              columns={sectorColumns}
              rowKey="code"
              onChange={handleSectorsTableChange}
              scroll={{ x: 'max-content' }}
              pagination={{
                current: Math.floor(sectorsOffset / sectorsLimit) + 1,
                pageSize: sectorsLimit,
                total: sectorsTotal,
                showSizeChanger: true,
                pageSizeOptions: ['50', '100', '200', '500'],
                showTotal: (t) => `共 ${t} 个行业板块`,
                style: { marginTop: '24px' }
              }}
            />
          </Spin>
        )}

        {/* Tab 4: Stats Dashboard */}
        {activeMainTab === 'stats' && (
          <Spin spinning={statsLoading} tip="正在获取最新 A 股统计数据...">
            {statsError && <Alert message={statsError} type="error" showIcon style={{ marginBottom: '24px' }} />}
            {!statsLoading && !statsError && !stats && (
              <Empty description="暂无 A 股统计数据。" />
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
