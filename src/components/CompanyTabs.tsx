import { COMPANY_LABELS, COMPANY_TAB_ORDER } from '../utils/companyTabs';

type CompanyTabsProps = {
  activeTab: string;
  onChange: (companyCode: string) => void;
  includeAll?: boolean;
};

function CompanyTabs({ activeTab, onChange, includeAll = true }: CompanyTabsProps) {
  const tabs = includeAll ? [...COMPANY_TAB_ORDER, 'all'] : [...COMPANY_TAB_ORDER];

  return (
    <div className="mb-s4 flex w-full justify-start">
      <div className="relative inline-flex max-w-full flex-wrap items-end rounded-t-xl border border-border bg-card px-1 pt-1 shadow-soft">
        {tabs.map((companyCode) => {
          const isActive = activeTab === companyCode;

          return (
            <button
              key={companyCode}
              type="button"
              onClick={() => onChange(companyCode)}
              className={`relative -mb-px rounded-t-[10px] border px-4 py-2 text-sm font-semibold transition ${
                isActive
                  ? 'border-border border-b-transparent bg-card text-text shadow-soft'
                  : 'border-transparent bg-surface-2 text-muted hover:bg-surface hover:text-text'
              }`}
            >
              {COMPANY_LABELS[companyCode] || companyCode}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default CompanyTabs;
