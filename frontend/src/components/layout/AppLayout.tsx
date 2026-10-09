import { NavLink, Outlet } from 'react-router';

const navItems = [{ to: '/', label: 'Dashboard' }];

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:w-60 md:border-r md:border-b-0">
        <div className="px-6 py-4 text-lg font-bold tracking-tight">
          Profit<span className="text-emerald-600">HQ</span>
        </div>
        <nav aria-label="Main" className="flex gap-1 px-3 pb-3 md:flex-col md:pb-0">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `rounded-md px-3 py-2 text-sm font-medium ${
                  isActive
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-end border-b border-slate-200 bg-white px-6">
          {/* Sync status + user menu land here in later phases. */}
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
