import { Icon, type IconName } from './icons';
import styles from './TabBar.module.scss';

export type TabId = 'termine' | 'lieder' | 'mehr';

const TAB_META: Record<TabId, { label: string; icon: IconName }> = {
  termine: { label: 'Termine', icon: 'calendar' },
  lieder: { label: 'Lieder', icon: 'music' },
  mehr: { label: 'Mehr', icon: 'cog-fill' },
};

interface TabBarProps {
  active: TabId;
  /** Sichtbare Tabs (rechteabhängig zusammengestellt). */
  tabs: TabId[];
  onChange: (tab: TabId) => void;
}

/** Untere Navigationsleiste im ChurchTools-Stil. */
export function TabBar({ active, tabs, onChange }: TabBarProps) {
  return (
    <div className={styles.tabbar}>
      {tabs.map((id) => {
        const meta = TAB_META[id];
        const on = active === id;
        return (
          <button
            key={id}
            className={`${styles.tab}${on ? ' ' + styles.on : ''}`}
            onClick={() => onChange(id)}
          >
            <Icon name={meta.icon} size={24} stroke={1.9} />
            <span>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
