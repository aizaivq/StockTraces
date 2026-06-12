import { useState, useEffect } from 'react'
import { Table, Input, Card, Alert, Tag, Button, Spin, Row, Col, Tabs, Empty } from 'antd'
import type { TableColumnsType } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'

interface Future {
	code: string
	name: string
	category: string // forex, precious_metal, basic_metal, agriculture, energy
	zxj: number
	zd: number
	zdf: number
	location: string
	state: string
	img: string
	qtcode: string
	updated_at: string
}

export default function Futures() {
	const [futures, setFutures] = useState<Future[]>([])
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState<string | null>(null)
	const [keyword, setKeyword] = useState('')
	const [activeTab, setActiveTab] = useState('all')

	const fetchFutures = async () => {
		setLoading(true)
		setError(null)
		try {
			const url = new URL('http://localhost:8080/api/futures')
			url.searchParams.append('_appver', '11.17.0')
			const response = await fetch(url.toString())
			if (!response.ok) {
				throw new Error(`HTTP error: ${response.status}`)
			}
			const data = await response.json()
			if (data.code === 0) {
				setFutures(data.data || [])
			} else {
				setError(data.msg || '获取期货数据失败')
			}
		} catch (err) {
			setError('无法连接到后端服务，请确认后端服务已启动。')
			console.error('Fetch futures error:', err)
		} finally {
			setLoading(false)
		}
	}

	useEffect(() => {
		fetchFutures()
	}, [])

	const getPriceColorClass = (val: number) => {
		if (val > 0) return 'stock-up'
		if (val < 0) return 'stock-down'
		return 'stock-zero'
	}

	const formatNumber = (num: number, category: string) => {
		if (num === undefined || num === null) return '-'
		// Forex futures usually have more decimal places
		const digits = category === 'forex' ? 5 : 2
		return num.toFixed(digits)
	}

	const formatWithSign = (num: number, category: string) => {
		if (num === undefined || num === null) return '-'
		const prefix = num > 0 ? '+' : ''
		const digits = category === 'forex' ? 5 : 2
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

	// Filter futures based on search keyword and active filter tab
	const filteredFutures = futures.filter((future) => {
		const matchesKeyword =
			future.code.toLowerCase().includes(keyword.toLowerCase()) ||
			future.name.includes(keyword) ||
			future.location.includes(keyword)

		if (!matchesKeyword) return false

		if (activeTab !== 'all') {
			return future.category === activeTab
		}

		return true
	})

	// Select key commodity overview cards (COMEX Gold, WTI Crude, COMEX Copper, CBOT Soybeans)
	const overviewCodes = ['GC', 'CL', 'HG', 'ZS']
	const overviewRates = futures.filter((f) => overviewCodes.includes(f.code))

	const columns: TableColumnsType<Future> = [
		{
			title: '代码',
			dataIndex: 'code',
			key: 'code',
			sorter: (a, b) => a.code.localeCompare(b.code),
			render: (code: string, record: Future) => (
				<div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
					{record.img && (
						<img
							src={record.img}
							alt={record.name}
							style={{ width: '20px', height: '20px', borderRadius: '50%', objectFit: 'cover' }}
							onError={(e) => {
								(e.target as HTMLImageElement).style.display = 'none'
							}}
						/>
					)}
					<span className="stock-code">{code}</span>
				</div>
			),
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
			render: (val: number, record: Future) => (
				<span className={getPriceColorClass(record.zd)} style={{ fontWeight: 600, fontFamily: 'ui-monospace, Consolas, monospace' }}>
					{formatNumber(val, record.category)}
				</span>
			),
		},
		{
			title: '涨跌额',
			dataIndex: 'zd',
			key: 'zd',
			sorter: (a, b) => a.zd - b.zd,
			align: 'right',
			render: (val: number, record: Future) => (
				<span className={getPriceColorClass(val)} style={{ fontFamily: 'ui-monospace, Consolas, monospace' }}>
					{formatWithSign(val, record.category)}
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
			title: '交易场所',
			dataIndex: 'location',
			key: 'location',
			render: (location: string) => <span style={{ color: 'rgba(0,0,0,0.65)' }}>{location}</span>,
		},
		{
			title: '交易通道',
			dataIndex: 'qtcode',
			key: 'qtcode',
			render: (qtcode: string) => <span style={{ fontFamily: 'ui-monospace, Consolas, monospace', color: 'rgba(0,0,0,0.45)' }}>{qtcode}</span>,
		},
		{
			title: '交易状态',
			dataIndex: 'state',
			key: 'state',
			align: 'center',
			render: (state: string) => (
				<Tag color={state === 'open' ? 'success' : 'default'} style={{ border: 'none', borderRadius: '4px' }}>
					{state === 'open' ? '交易中' : '已收盘'}
				</Tag>
			),
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
		{ key: 'all', label: '全部期货' },
		{ key: 'forex', label: '外汇期货' },
		{ key: 'precious_metal', label: '贵金属' },
		{ key: 'basic_metal', label: '基本金属' },
		{ key: 'agriculture', label: '农产品' },
		{ key: 'energy', label: '能源期货' },
	]

	return (
		<div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
			{/* Title Card */}
			<Card bordered={false} style={{ marginBottom: '24px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
					<div>
						<h1 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: 'rgba(0,0,0,0.85)' }}>国际期货中心</h1>
						<p style={{ margin: '4px 0 0 0', color: 'rgba(0,0,0,0.45)', fontSize: '14px' }}>
							提供实时全球商品期货、汇率期货和大宗商品行情看板
						</p>
					</div>
					<Button type="primary" icon={<ReloadOutlined />} onClick={fetchFutures} loading={loading}>
						刷新数据
					</Button>
				</div>
			</Card>

			{/* Commodities Overview Cards */}
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
										<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
											{item.img && (
												<img
													src={item.img}
													alt={item.name}
													style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }}
													onError={(e) => {
														(e.target as HTMLImageElement).style.display = 'none'
													}}
												/>
											)}
											<span style={{ fontSize: '14px', fontWeight: 600, color: 'rgba(0,0,0,0.45)' }}>{item.code}</span>
										</div>
										<Tag color={item.zd >= 0 ? 'red' : 'green'} style={{ border: 'none', fontWeight: 600 }}>
											{item.name}
										</Tag>
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '12px' }}>
										<span className={colorClass} style={{ fontSize: '24px', fontWeight: 700, fontFamily: 'ui-monospace, Consolas, monospace' }}>
											{formatNumber(item.zxj, item.category)}
										</span>
										<span className={colorClass} style={{ fontSize: '13px', fontWeight: 600, fontFamily: 'ui-monospace, Consolas, monospace' }}>
											{formatZdfWithSign(item.zdf)}
										</span>
									</div>
									<div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'rgba(0,0,0,0.35)', marginTop: '8px', borderTop: '1px dashed #f0f0f0', paddingTop: '8px' }}>
										<span>交易所: {item.location}</span>
										<Tag color={item.state === 'open' ? 'success' : 'default'} style={{ border: 'none', height: '18px', lineHeight: '18px', fontSize: '10px' }}>
											{item.state === 'open' ? '交易中' : '已收盘'}
										</Tag>
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
						placeholder="搜索期货名称、代码或交易所..."
						onSearch={(val) => setKeyword(val.trim())}
						onChange={(e) => setKeyword(e.target.value.trim())}
						enterButton
						style={{ maxWidth: '300px' }}
						allowClear
					/>
				</div>

				{error && <Alert message={error} type="error" showIcon style={{ marginBottom: '24px' }} />}

				{/* Detailed Futures Table */}
				<Spin spinning={loading} tip="正在加载最新期货行情...">
					{!loading && filteredFutures.length === 0 ? (
						<Empty description="暂无匹配的期货数据。" />
					) : (
						<Table
							dataSource={filteredFutures}
							columns={columns}
							rowKey="code"
							loading={loading}
							scroll={{ x: 'max-content' }}
							pagination={{
								defaultPageSize: 200,
								showSizeChanger: true,
								pageSizeOptions: ['50', '100', '200', '500'],
								showTotal: (total) => `共 ${total} 条期货记录`,
								style: { marginTop: '24px' },
							}}
						/>
					)}
				</Spin>
			</Card>
		</div>
	)
}
