import { useState, useEffect } from 'react'
import { Table, Input, Card, Alert, Button, Spin, Row, Col, Tabs } from 'antd'
import type { TableColumnsType, TablePaginationConfig } from 'antd'
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons'
import StockDetailModal from '../components/StockDetailModal'

interface FundItem {
  code: string
  name: string
  zxj: number
  zd: number
  zdf: number
  ljjz: number
  state: string
  stock_type: string
  updated_at: string
}

interface FundStats {
  total: number
  rise: number
  fall: number
  flat: number
  average_nav: number
  top_gainer: FundItem | null
  top_loser: FundItem | null
}

export default function Funds() {
  const [activeTab, setActiveTab] = useState<string>('list')

  // List states
  const [funds, setFunds] = useState<FundItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(20)
  const [offset, setOffset] = useState(0)
  const [total, setTotal] = useState(0)
  const [keyword, setKeyword] = useState('')
  const [sortBy, setSortBy] = useState('code')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')

  // Stats states
  const [stats, setStats] = useState<FundStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(false)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Detail Modal states
  const [detailVisible, setDetailVisible] = useState(false)
  const [selectedStock, setSelectedStock] = useState<any>(null)

  const getStockColorClass = (val: number) => {
    if (val > 0) return 'stock-up'
    if (val < 0) return 'stock-down'
    return 'stock-zero'
  }

  const formatNumber = (num: number, digits: number = 4) => {
    if (num === undefined || num === null) return '-'
    return num.toFixed(digits)
  }

  const formatWithSign = (num: number, digits: number = 2) => {
    if (num === undefined || num === null) return '-'
    const prefix = num > 0 ? '+' : ''
    return prefix + num.toFixed(digits)
  }

  // Fetch Fund list
  const fetchFunds = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('http://localhost:8080/api/funds')
      url.searchParams.append('_appver', '11.17.0')
      url.searchParams.append('limit', String(limit))
      url.searchParams.append('offset', String(offset))
      url.searchParams.append('sort_by', sortBy)
      url.searchParams.append('order', order)
      if (keyword) {
        url.searchParams.append('keyword', keyword)
      }

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      if (data.code === 0) {
        setFunds(data.data.list || [])
        setTotal(data.data.total || 0)
      } else {
        setError(data.msg || '获取基金数据失败')
      }
    } catch (err: any) {
      setError('无法连接到后端服务，请确认后端服务已运行')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  // Fetch Fund statistics
  const fetchStats = async () => {
    setStatsLoading(true)
    setStatsError(null)
    try {
      const url = new URL('http://localhost:8080/api/funds/stats')
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
    } catch (err: any) {
      setStatsError('无法连接到后端服务，请确认后端服务已运行')
      console.error(err)
    } finally {
      setStatsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'list') {
      fetchFunds()
    } else if (activeTab === 'stats') {
      fetchStats()
    }
  }, [limit, offset, keyword, sortBy, order, activeTab])

  // Table Columns Definition
  const columns: TableColumnsType<FundItem> = [
    {
      title: '基金代码',
      dataIndex: 'code',
      key: 'code',
      sorter: true,
      render: (code: string) => {
        const displayCode = code.replace(/^(sh|sz|of)/, '')
        return <span className="stock-code">{displayCode}</span>
      }
    },
    {
      title: '基金名称',
      dataIndex: 'name',
      key: 'name',
      sorter: true,
      render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>
    },
    {
      title: '单位净值',
      dataIndex: 'zxj',
      key: 'zxj',
      sorter: true,
      align: 'right',
      render: (val: number, record: FundItem) => (
        <span className={getStockColorClass(record.zd)} style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
          {formatNumber(val, 4)}
        </span>
      )
    },
    {
      title: '日增长额',
      dataIndex: 'zd',
      key: 'zd',
      sorter: true,
      align: 'right',
      render: (val: number) => (
        <span className={getStockColorClass(val)} style={{ fontFamily: 'var(--mono)' }}>
          {formatWithSign(val, 4)}
        </span>
      )
    },
    {
      title: '日增长率',
      dataIndex: 'zdf',
      key: 'zdf',
      sorter: true,
      align: 'right',
      render: (val: number) => (
        <span className={getStockColorClass(val)} style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
          {formatWithSign(val, 2)}%
        </span>
      )
    },
    {
      title: '累计净值',
      dataIndex: 'ljjz',
      key: 'ljjz',
      sorter: true,
      align: 'right',
      render: (val: number) => (
        <span style={{ fontFamily: 'var(--mono)' }}>
          {formatNumber(val, 4)}
        </span>
      )
    },
    {
      title: '净值日期',
      dataIndex: 'state',
      key: 'state',
      sorter: true,
      align: 'center',
      render: (val: string) => <span style={{ color: 'var(--text-muted)' }}>{val || '-'}</span>
    }
  ]

  const handleTableChange = (
    pagination: TablePaginationConfig,
    _filters: any,
    sorter: any
  ) => {
    if (pagination.current && pagination.pageSize) {
      setOffset((pagination.current - 1) * pagination.pageSize)
      setLimit(pagination.pageSize)
    }

    if (sorter.field) {
      setSortBy(sorter.field)
      setOrder(sorter.order === 'descend' ? 'desc' : 'asc')
    }
  }

  const handleSearch = (val: string) => {
    setKeyword(val)
    setOffset(0)
  }

  const openStockDetail = (record: FundItem) => {
    setSelectedStock({
      code: record.code,
      name: record.name,
      zxj: record.zxj,
      zd: record.zd,
      zdf: record.zdf,
      stock_type: 'FUND'
    })
    setDetailVisible(true)
  }

  const renderStatsDashboard = () => {
    if (!stats) return null

    const risePercent = stats.total > 0 ? ((stats.rise / stats.total) * 100).toFixed(1) : '0.0'
    const fallPercent = stats.total > 0 ? ((stats.fall / stats.total) * 100).toFixed(1) : '0.0'
    const flatPercent = stats.total > 0 ? (100 - parseFloat(risePercent) - parseFloat(fallPercent)).toFixed(1) : '0.0'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Row 1: Key Metrics */}
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} md={8}>
            <Card bordered className="dashboard-card" style={{ height: '100%' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>已同步基金总数</div>
              <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-h)' }}>
                {stats.total.toLocaleString()}
              </div>
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Card bordered className="dashboard-card" style={{ height: '100%' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>平均单位净值</div>
              <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'var(--mono)', color: 'var(--text-h)' }}>
                {formatNumber(stats.average_nav, 4)} <span style={{ fontSize: '14px', fontWeight: 400 }}>元</span>
              </div>
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card bordered className="dashboard-card" style={{ height: '100%' }}>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>基金多空情绪占比</div>
              <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', margin: '12px 0 8px 0', background: 'var(--border)' }}>
                <div style={{ width: `${risePercent}%`, background: 'var(--stock-up)', transition: 'width 0.5s ease' }} />
                <div style={{ width: `${flatPercent}%`, background: 'var(--stock-zero)', transition: 'width 0.5s ease' }} />
                <div style={{ width: `${fallPercent}%`, background: 'var(--stock-down)', transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                <span>上涨: {stats.rise} ({risePercent}%)</span>
                <span>平盘: {stats.flat} ({flatPercent}%)</span>
                <span>下跌: {stats.fall} ({fallPercent}%)</span>
              </div>
            </Card>
          </Col>
        </Row>

        {/* Row 2: Top Gainer & Loser */}
        <Row gutter={[24, 24]}>
          <Col xs={24} md={12}>
            <Card 
              bordered 
              className="dashboard-card" 
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--stock-up)' }}>
                  <ArrowUpOutlined />
                  <span style={{ fontWeight: 600 }}>今日领涨基金</span>
                </div>
              }
            >
              {stats.top_gainer ? (
                <div 
                  onClick={() => openStockDetail(stats.top_gainer!)}
                  style={{ cursor: 'pointer', padding: '16px', background: 'var(--social-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-h)' }}>{stats.top_gainer.name}</span>
                    <span className="stock-code">{stats.top_gainer.code.replace(/^(sh|sz|of)/, '').toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>当前单位净值</div>
                      <div className="stock-up" style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--mono)' }}>
                        {formatNumber(stats.top_gainer.zxj, 4)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>日增长率</div>
                      <div className="stock-up" style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--mono)' }}>
                        +{stats.top_gainer.zdf.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>暂无领涨数据</div>
              )}
            </Card>
          </Col>

          <Col xs={24} md={12}>
            <Card 
              bordered 
              className="dashboard-card" 
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--stock-down)' }}>
                  <ArrowDownOutlined />
                  <span style={{ fontWeight: 600 }}>今日领跌基金</span>
                </div>
              }
            >
              {stats.top_loser ? (
                <div 
                  onClick={() => openStockDetail(stats.top_loser!)}
                  style={{ cursor: 'pointer', padding: '16px', background: 'var(--social-bg)', borderRadius: '8px', border: '1px solid var(--border)' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-h)' }}>{stats.top_loser.name}</span>
                    <span className="stock-code">{stats.top_loser.code.replace(/^(sh|sz|of)/, '').toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>当前单位净值</div>
                      <div className="stock-down" style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--mono)' }}>
                        {formatNumber(stats.top_loser.zxj, 4)}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>日增长率</div>
                      <div className="stock-down" style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'var(--mono)' }}>
                        {stats.top_loser.zdf.toFixed(2)}%
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>暂无领跌数据</div>
              )}
            </Card>
          </Col>
        </Row>
      </div>
    )
  }

  const tabsItems = [
    { key: 'list', label: '基金列表' },
    { key: 'stats', label: '数据统计' }
  ]

  return (
    <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header Info */}
      <div className="cna-header" style={{ alignItems: 'center', marginBottom: 0 }}>
        <div className="cna-title">
          <h1>开放式基金</h1>
          <p>场外开放式基金净值与历史净值涨跌情况列表</p>
        </div>
        <Button 
          type="default" 
          icon={<ReloadOutlined spin={loading || statsLoading} />} 
          onClick={activeTab === 'list' ? fetchFunds : fetchStats}
          className="cna-btn-secondary"
          style={{ height: '38px', borderRadius: '8px' }}
        >
          刷新
        </Button>
      </div>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabsItems}
        style={{ marginBottom: 0 }}
      />

      {/* Tab Content 1: Fund List */}
      {activeTab === 'list' && (
        <>
          {error && (
            <Alert
              message="服务异常"
              description={error}
              type="error"
              showIcon
              closable
            />
          )}

          {/* Control Card */}
          <Card bordered={false} styles={{ body: { padding: '16px' } }} className="dashboard-card">
            <div style={{ maxWidth: '320px' }}>
              <Input.Search
                placeholder="搜索基金代码/名称..."
                allowClear
                enterButton
                onSearch={handleSearch}
                size="large"
              />
            </div>
          </Card>

          {/* Data Table */}
          <Card bordered={false} styles={{ body: { padding: 0 } }} style={{ flex: 1, display: 'flex', flexDirection: 'column' }} className="dashboard-card">
            <Spin spinning={loading} tip="正在加载基金列表...">
              <Table
                dataSource={funds}
                columns={columns}
                rowKey="code"
                pagination={{
                  total,
                  current: Math.floor(offset / limit) + 1,
                  pageSize: limit,
                  showSizeChanger: true,
                  pageSizeOptions: ['20', '50', '100', '200'],
                  showTotal: (totalCount) => `共 ${totalCount} 个基金`,
                  position: ['bottomRight']
                }}
                onChange={handleTableChange}
                onRow={(record) => ({
                  onClick: () => openStockDetail(record),
                  style: { cursor: 'pointer' }
                })}
                style={{ flex: 1 }}
              />
            </Spin>
          </Card>
        </>
      )}

      {/* Tab Content 2: Stats Dashboard */}
      {activeTab === 'stats' && (
        <Spin spinning={statsLoading} tip="正在获取基金统计数据...">
          {statsError && <Alert message={statsError} type="error" showIcon style={{ marginBottom: '24px' }} />}
          {!statsLoading && !statsError && renderStatsDashboard()}
        </Spin>
      )}

      {/* StockDetailModal */}
      <StockDetailModal
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        stock={selectedStock}
      />
    </div>
  )
}
