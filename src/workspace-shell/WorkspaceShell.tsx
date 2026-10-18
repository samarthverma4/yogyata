import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { LogOut, Menu, User, X } from 'lucide-react';
import { BrandMark } from '../brand/BrandMark';
import '../founder-workspace/workspace.css';

export interface ShellNavItem<T extends string> {
  id: T;
  label: string;
  icon: ReactNode;
  badge?: number;
  amber?: boolean;
}

interface Props<T extends string> {
  /** Label under the wordmark, e.g. "Mentor workspace". */
  area: string;
  items: ShellNavItem<T>[];
  current: T;
  onChange: (tab: T) => void;
  title: string;
  sub: string;
  fullName: string;
  subtitle: string;
  onSignOut: () => void;
  children: ReactNode;
}

/** Sidebar, header and mobile drawer shared by the mentor and recruiter workspaces. */
export function WorkspaceShell<T extends string>({
  area,
  items,
  current,
  onChange,
  title,
  sub,
  fullName,
  subtitle,
  onSignOut,
  children,
}: Props<T>) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const go = (tab: T) => {
    onChange(tab);
    setOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="yw-app ws-root">
      <div className={`ws-sidebar-backdrop ${open ? 'is-open' : ''}`} onClick={() => setOpen(false)} aria-hidden="true" />
      <aside className={`ws-sidebar ${open ? 'is-open' : ''}`} aria-label={`${area} navigation`}>
        <div className="ws-sidebar-brand">
          <button type="button" className="ws-brand-btn" onClick={() => go(items[0].id)} aria-label={`${area} home`}>
            <BrandMark sub={area} />
          </button>
          <button type="button" className="ws-mobile-menu-btn" onClick={() => setOpen(false)} aria-label="Close sidebar navigation">
            <X size={18} />
          </button>
        </div>

        <nav className="ws-sidebar-nav">
          {items.map((item) => {
            const active = current === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`ws-nav-item ${active ? 'is-active' : ''}`}
                onClick={() => go(item.id)}
                aria-current={active ? 'page' : undefined}
              >
                <div className="ws-nav-item-left">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`ws-nav-badge ${item.amber ? 'badge-amber' : ''}`}>{item.badge}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="ws-sidebar-footer">
          <div className="ws-user-card">
            <div className="ws-user-avatar">
              <User size={16} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div className="ws-user-name" title={fullName}>
                {fullName}
              </div>
              <div className="ws-user-role" title={subtitle}>
                {subtitle}
              </div>
            </div>
          </div>
          <button type="button" className="ws-exit-home-btn" onClick={onSignOut} aria-label="Sign out" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      <div className="yw-main ws-main-wrapper">
        <header className="ws-header" role="banner">
          <div className="ws-header-left">
            <button type="button" className="ws-mobile-menu-btn" onClick={() => setOpen(true)} aria-label="Open sidebar navigation">
              <Menu size={20} />
            </button>
            <div className="ws-header-title-wrap">
              <h1 className="ws-header-title">{title}</h1>
              <span className="ws-header-sub">{sub}</span>
            </div>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
