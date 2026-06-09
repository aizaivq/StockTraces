import { useState, useEffect } from 'react'
import { Card, Tabs, Tag, Button, Spin, Alert, Row, Col } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

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

interface IndicesData {
  common: IndexDetail[]
  america: IndexDetail[]
  europe: IndexDetail[]
  asia: IndexDetail[]
  other: IndexDetail[]
}

type TabType = 'common' | 'asia' | 'america' | 'europe' | 'other'

export default function Indices() {
  const [indices, setIndices] = useState<IndicesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('common')

  const fetchIndices = async () => {
    setLoading(true)
    setError(null)
    try {
      const url = new URL('http://localhost:8080/api/indices')
      url.searchParams.append('_appver', '11.17.0')

      const response = await fetch(url.toString())
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data = await response.json()
      if (data.code === 0) {
        setIndices(data.data)
      } else {
        setError(data.msg || '获取股指数据失败')
      }
    } catch (err: unknown) {
      setError('无法连接到后端服务，请确认后端服务运行在 http://localhost:8080')
      console.error('Fetch indices error:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIndices()
  }, [])

  const getZdfColorClass = (zdfStr: string) => {
    const val = parseFloat(zdfStr)
    if (isNaN(val)) return 'stock-zero'
    if (val > 0) return 'stock-up'
    if (val < 0) return 'stock-down'
    return 'stock-zero'
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

  const getActiveList = (): IndexDetail[] => {
    if (!indices) return []
    return indices[activeTab] || []
  }

  const tabItems = [
    { key: 'common', label: '常用主要' },
    { key: 'asia', label: '亚洲股指' },
    { key: 'america', label: '美洲股指' },
    { key: 'europe', label: '欧洲股指' },
    { key: 'other', label: '其他地区' }
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
      <Card bordered={false} style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'rgba(0,0,0,0.85)' }}>全球主要股指排行榜</h1>
            <p style={{ margin: '4px 0 0 0', color: 'rgba(0,0,0,0.45)', fontSize: '14px' }}>数据源由腾讯财经全球行情接口实时代理提供 (每分钟更新)</p>
          </div>
          <Button 
            type="primary" 
            icon={<ReloadOutlined />} 
            onClick={fetchIndices} 
            loading={loading}
          >
            刷新数据
          </Button>
        </div>
      </Card>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: '24px' }} />}

      <Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as TabType)}
          items={tabItems.map(tab => ({ key: tab.key, label: tab.label }))}
          style={{ marginBottom: '24px' }}
        />

        <Spin spinning={loading} tip="正在获取最新全球股指数据...">
          {!loading && !error && getActiveList().length === 0 && (
            <div style={{ padding: '48px', textAlign: 'center', color: 'rgba(0,0,0,0.45)' }}>
              该分类下暂无股指行情数据。
            </div>
          )}

          {!loading && !error && getActiveList().length > 0 && (
            <Row gutter={[20, 20]}>
              {getActiveList().map((item) => {
                const colorClass = getZdfColorClass(item.zdf)
                return (
                  <Col xs={24} sm={12} md={8} lg={6} key={item.qtcode || item.code}>
                    <Card 
                      hoverable 
                      style={{ borderRadius: '8px', border: '1px solid #f0f0f0' }}
                      styles={{ body: { padding: '16px' } }}
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
      </Card>
    </div>
  )
}
