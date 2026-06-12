import { useState, useEffect } from 'react'
import { Table, Input, Card, Alert, Tag, Button, Spin, Row, Col, Tabs, Empty } from 'antd'
import type { TableColumnsType } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

interface ExchangeRate {
	code: string
	name: string
	zxj: number
	zd: number
	zdf: number
	high: number
	low: number
	open: number
	prev_close: number
	updated_at: string
}

export default function Forex() {
	const [rates, setRates] = useState<ExchangeRate[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [keyword, setKeyword] = useState('')
	const [activeTab, setActiveTab] = useState('all')

	const fetchRates = async () => {
		setLoading(true)
		setError(null)
		try {
			const url = new URL('http://localhost:8080/api/exchange-rates')
			url.searchParams.append('_appver', '11.17.0')
			const response = await fetch(url.toString())
			if (!response.ok) {
				throw new Error(`HTTP error: ${response.status}`)
			}
			const data = await response.json()
			if (data.code === 0) {
				setRates(data.data || [])
			} else {
				setError(data.msg || '获取汇率数据失败')
			}
		} catch (err) {
			setError('无法连接到后端服务，请确认后端服务已启动。')
			console.error('Fetch exchange rates error:', err)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchRates()
	}, [])

	const getPriceColorClass = (val: number) => {
		if (val > 0) return 'stock-up'
		if (val < 0) return 'stock-down'
		return 'stock-zero'
	}

	const formatNumber = (num: number, digits: number = 4) => {
		if (num === undefined || num === null) return '-'
		return num.toFixed(digits)
	}

	const formatWithSign = (num: number, digits: number = 4) => {
		if (num === undefined || num === null) return '-'
		const prefix = num > 0 ? '+' : ''
		return prefix + num.toFixed(digits)
	}

	const formatZdfWithSign = (num: number) => {
		if (num === undefined || num === null) return '-'
		const prefix = num > 0 ? '+' : ''
		return `${prefix}${num.toFixed(2)}%`
	}

	const formatTime = (timeStr: string) => {
		if (!timeStr) return '-'
		try {
			const date = new Date(timeStr)
			return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
		} catch (e) {
			return timeStr
		}
	}

	// Filter rates based on search keyword and active filter tab
	const filteredRates = rates.filter((rate) => {
		const matchesKeyword =
			rate.code.toLowerCase().includes(keyword.toLowerCase()) ||
			rate.name.includes(keyword)

		if (!matchesKeyword) return false

		if (activeTab === 'major') {
			// Major USD, EUR, GBP, CNY, JPY, HKD exchange rates
			const majorSymbols = ['USDCNY', 'EURUSD', 'GBPUSD', 'USDJPY', 'USDHKD', 'AUDUSD', 'HKDCNY']
			return majorSymbols.includes(rate.code)
		}

		if (activeTab === 'cross') {
			// Cross rates (non-USD base pairings)
			return !rate.code.startsWith('USD') && !rate.code.endsWith('USD')
		}

		return true
	})

	// Select top 4 major exchange rates for the overview cards
	const majorOverviewSymbols = ['USDCNY', 'EURUSD', 'GBPUSD', 'USDJPY']
	const overviewRates = rates.filter((rate) => majorOverviewSymbols.includes(rate.code))

	const columns: TableColumnsType<ExchangeRate> = [
		{
			title: '代码',
			dataIndex: 'code',
			key: 'code',
			sorter: (a, b) => a.code.localeCompare(b.code),
			render: (code: string) => <span className="stock-code">{code}</span>,
		},
		{
			title: '名称',
			dataIndex: 'name',
			key: 'name',
			render: (name: string) => <span style={{ fontWeight: 500 }}>{name}</span>,
		},
		{
			title: '最新价',
			dataIndex: 'zxj',
			key: 'zxj',
			sorter: (a, b) => a.zxj - b.zxj,
			align: 'right',
			render: (val: number, record: ExchangeRate) => (
				<span className={getPriceColorClass(record.zd)} style={{ fontWeight: 600, fontFamily: 'ui-monospace, Consolas, monospace' }}>
					{formatNumber(val, 4)}
				</span>
			),
		},
		{
			title: '涨跌额',
			dataIndex: 'zd',
			key: 'zd',
			sorter: (a, b) => a.zd - b.zd,
			align: 'right',
			render: (val: number) => (
				<span className={getPriceColorClass(val)} style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>
					{formatWithSign(val, 4)}
				</span>
			),
		},
		{
			title: '涨跌幅',
			dataIndex: 'zdf',
			key: 'zdf',
			sorter: (a, b) => a.zdf - b.zdf,
			align: 'right',
			render: (val: number) => (
				<span className={getPriceColorClass(val)} style={{ fontWeight: 600, fontFamily: 'ui-monospace, Consolas, monospace' }}>
					{formatZdfWithSign(val)}
				</span>
			),
		},
		{
			title: '昨收价',
			dataIndex: 'prev_close',
			key: 'prev_close',
			align: 'right',
			render: (val: number) => <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{formatNumber(val, 4)}</span>,
		},
		{
			title: '开盘价',
			dataIndex: 'open',
			key: 'open',
			align: 'right',
			render: (val: number) => <span style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>{formatNumber(val, 4)}</span>,
		},
		{
			title: '最高价',
			dataIndex: 'high',
			key: 'high',
			align: 'right',
			render: (val: number) => <span style={{ color: 'var(--stock-up)', fontFamily: 'ui-monospace, Consolas, monospace' }}>{formatNumber(val, 4)}</span>,
		},
		{
			title: '最低价',
			dataIndex: 'low',
			key: 'low',
			align: 'right',
			render: (val: number) => <span style={{ color: 'var(--stock-down)', fontFamily: 'ui-monospace, Consolas, monospace' }}>{formatNumber(val, 4)}</span>,
		},
		{
			title: '更新时间',
			dataIndex: 'updated_at',
			key: 'updated_at',
			align: 'center',
			render: (val: string) => <span style={{ color: 'rgba(0,0,0,0.45)', fontSize: '13px' }}>{formatTime(val)}</span>,
		},
	]

	const filterTabs = [
		{ key: 'all', label: '全部汇率' },
		{ key: 'major', label: '主要汇率' },
		{ key: 'cross', label: '交叉汇率' },
	]

	return (
		<div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
			{/* Title Card */}
			<Card bordered={false} style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
					<div>
						<h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'rgba(0,0,0,0.85)' }}>全球汇率中心</h1>
						<p style={{ margin: '4px 0 0 0', color: 'rgba(0,0,0,0.45)', fontSize: '14px' }}>
							提供实时外汇汇率以及主流货币对、贵金属最新价格行情
						</p>
					</div>
					<Button type="primary" icon={<ReloadOutlined />} onClick={fetchRates} loading={loading}>
						刷新数据
					</Button>
				</div>
			</Card>

			{/* Major Exchange Rates Cards Overview */}
			{!loading && overviewRates.length > 0 && (
				<Row gutter={[20, 20]} style={{ marginBottom: '24px' }}>
					{overviewRates.map((item) => {
						const colorClass = getPriceColorClass(item.zd)
						return (
							<Col xs={24} sm={12} md={6} key={item.code}>
								<Card
									hoverable
									style={{ borderRadius: '8px', border: '1px solid #f0f0f0', transition: 'all 0.3s ease' }}
									styles={{ body: { padding: '16px' } }}
								>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
										<span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(0,0,0,0.45)' }}>{item.code}</span>
										<Tag color={item.zd >= 0 ? 'red' : 'green'} style={{ border: 'none', fontWeight: 600 }}>
											{item.name}
										</Tag>
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '12px' }}>
										<span className={colorClass} style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
											{formatNumber(item.zxj, 4)}
										</span>
										<span className={colorClass} style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'ui-monospace, Consolas, monospace' }}>
											{formatZdfWithSign(item.zdf)}
										</span>
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(0,0,0,0.35)', marginTop: '8px', borderTop: '1px dashed #f0f0f0', paddingTop: '8px' }}>
										<span>开盘: {formatNumber(item.open, 4)}</span>
										<span>最高: {formatNumber(item.high, 4)}</span>
									</div>
								</Card>
							</Col>
						)
					})}
				</Row>
			)}

			<Card bordered={false} style={{ borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
				{/* Filters & Search bar */}
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
					<Tabs activeKey={activeTab} onChange={(key) => setActiveTab(key)} items={filterTabs.map((t) => ({ key: t.key, label: t.label }))} style={{ flex: 1 }} />
					<Input.Search
						placeholder="搜索货币名称或代码..."
						onSearch={(val) => setKeyword(val.trim())}
						onChange={(e) => setKeyword(e.target.value.trim())}
						enterButton
						style={{ maxWidth: '300px' }}
						allowClear
					/>
				</div>

				{error && <Alert message={error} type="error" showIcon style={{ marginBottom: '24px' }} />}

				{/* Detailed Exchange Rate Table */}
				<Spin spinning={loading} tip="正在加载最新汇率行情...">
					{!loading && filteredRates.length === 0 ? (
						<Empty description="暂无匹配的汇率数据。" />
					) : (
						<Table
							dataSource={filteredRates}
							columns={columns}
							rowKey="code"
							loading={loading}
							scroll={{ x: 'max-content' }}
							pagination={{
								defaultPageSize: 200,
								showSizeChanger: true,
								pageSizeOptions: ['50', '100', '200', '500'],
								showTotal: (total) => `共 ${total} 条汇率记录`,
								style: { marginTop: '24px' },
							}}
						/>
					)}
				</Spin>
			</Card>
		</div>
	)
}
