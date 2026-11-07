import { useI18n } from '../lib/i18n'
import type { Scope } from '../lib/types'
import { useStore } from '../state/store'

export function ScopeDialog() {
  const { t } = useI18n()
  const pending = useStore((state) => state.pendingScope)
  const confirmScope = useStore((state) => state.confirmScope)
  const cancelScope = useStore((state) => state.cancelScope)
  if (!pending) return null
  const ruleOnly = !pending.allowOne

  const choose = (scope: Scope) => confirmScope(scope)

  return (
    <div className="modal-back">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="scope-title">
        <h2 id="scope-title">{t('repeatScopeTitle')}</h2>
        <p>{ruleOnly ? t('repeatRuleBody') : t('repeatScopeBody')}</p>
        <div className="modal-actions stack">
          {pending.allowOne && (
            <button type="button" className="text-btn" onClick={() => choose('one')}>
              {t('scopeOne')}
            </button>
          )}
          <button type="button" className="text-btn" onClick={() => choose('following')}>
            {t('scopeFollowing')}
          </button>
          <button type="button" className="primary" onClick={() => choose('all')}>
            {t('scopeAll')}
          </button>
          <button type="button" className="text-btn" onClick={cancelScope}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  )
}
