import { BrowserRouter as Router, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { Layout, Menu } from 'antd'
import type { MenuProps } from 'antd'
import Home from './pages/Home'
import CnA from './pages/CnA'
import Indices from './pages/Indices'
import './App.css'

const { Header, Content } = Layout

function AppContent() {
  const navigate = useNavigate()
  const location = useLocation()

  const items: MenuProps['items'] = [
    { key: '/', label: '首页' },
    { key: '/cn_a', label: 'A股' },
    { key: '/indices', label: '股票指数' }
  ]

  const handleMenuClick: MenuProps['onClick'] = (e) => {
    navigate(e.key)
  }

  // Determine current active path
  const currentKey = location.pathname

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Header style={{ display: 'flex', alignItems: 'center', padding: '0 24px', background: '#fff', borderBottom: '1px solid #f0f0f0', position: 'sticky', top: 0, zIndex: 1000 }}>
        <div 
          onClick={() => navigate('/')} 
          style={{ fontSize: '20px', fontWeight: 'bold', marginRight: '48px', cursor: 'pointer', color: '#aa3bff' }}
        >
          StockTraces
        </div>
        <Menu
          mode="horizontal"
          selectedKeys={[currentKey]}
          items={items}
          onClick={handleMenuClick}
          style={{ flex: 1, minWidth: 0, borderBottom: 'none' }}
        />
      </Header>
      <Content style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#f5f5f5' }}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/cn_a" element={<CnA />} />
          <Route path="/indices" element={<Indices />} />
        </Routes>
      </Content>
    </Layout>
  )
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  )
}

export default App
