import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { LayoutDashboard, FileText, Upload, ShieldCheck, Users, History, RotateCcw } from 'lucide-react'

const links = [
  { path: '/', label: 'Panel', icon: LayoutDashboard },
  { path: '/invoices', label: 'Facturas', icon: FileText },
  { path: '/upload', label: 'Cargar factura', icon: Upload },
  { path: '/approvals', label: 'Aprobaciones', icon: ShieldCheck },
  { path: '/history', label: 'Historial', icon: History },
  { path: '/rules', label: 'Reglas y políticas', icon: RotateCcw },
  { path: '/beneficiaries', label: 'Beneficiarios', icon: Users },
]

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="logo">Orquídea Andina</div>
        <nav className="nav">
          {links.map((l) => {
            const Icon = l.icon
            return (
              <a
                key={l.path}
                href={l.path}
                onClick={(e) => {
                  e.preventDefault()
                  navigate(l.path)
                  setSidebarOpen(false)
                }}
                className={cn(l.path === window.location.pathname ? 'active' : '')}
              >
                <Icon size={18} />
                {l.label}
              </a>
            )
          })}
        </nav>
      </aside>
      <div className="content">
        <header className="page-header">
          <h1>{currentLabel()}</h1>
          <button className="btn btn-icon btn-outline" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Menú" />
        </header>
        <main>{<Outlet />}</main>
      </div>
    </div>
  )
}

function currentLabel(): string {
  const p = window.location.pathname
  const found = links.find((l) => p === l.path || p.startsWith(l.path + '/'))
  return found ? found.label : 'Agente de Facturas'
}

import { cn } from '../lib/utils'
