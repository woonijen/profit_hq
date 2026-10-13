import { NavLink, Outlet } from 'react-router';
import { useAuth } from '@/features/auth/auth-context';
import { useActiveStore } from '@/features/stores/use-active-store';
import { SyncButton } from '@/features/sync/SyncButton';
import { SyncProvider } from '@/features/sync/SyncProvider';
import { SyncStatusIndicator } from '@/features/sync/SyncStatusIndicator';

const navItems = [{ to: '/', label: 'Dashboard' }];

export function AppLayout() {
  const { state, logout } = useAuth();
  const { store } = useActiveStore();

  return (
    <SyncProvider storeId={store?.id}>
      <div className="flex min-h-screen flex-col md:flex-row">
        <aside className="border-b border-line bg-card md:w-60 md:border-r md:border-b-0">
          <div className="px-6 py-4 text-lg font-bold tracking-tight">
            Profit<span className="text-accent">HQ</span>
          </div>
          <nav aria-label="Main" className="flex gap-1 px-3 pb-3 md:flex-col md:pb-0">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end
                className={({ isActive }) =>
                  `rounded-md px-3 py-2 text-sm font-medium ${
                    isActive ? 'bg-hover text-ink' : 'text-ink-muted hover:bg-hover hover:text-ink'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-card px-6 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <SyncButton />
              <SyncStatusIndicator />
            </div>
            {state.status === 'authenticated' && (
              <div className="flex min-w-0 items-center gap-3">
                <span className="hidden truncate text-sm text-ink-muted sm:inline">
                  {state.user.email}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-ink-muted hover:bg-hover"
                >
                  Log out
                </button>
              </div>
            )}
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </SyncProvider>
  );
}
