import { useI18n } from '../lib/i18n'
import { useStore } from '../state/store'

export function ConfirmDialog() {
  const { t } = useI18n()
  const confirmCopy = useStore((state) => state.confirmCopy)
  const confirmCopyPreviousWeek = useStore((state) => state.confirmCopyPreviousWeek)
  const cancelCopyPreviousWeek = useStore((state) => state.cancelCopyPreviousWeek)
  if (!confirmCopy) return null

  return (
    <div className="modal-back">
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="replace-title">
        <h2 id="replace-title">{t('replaceWeekTitle')}</h2>
        <p>{t('replaceWeekBody')}</p>
        <div className="modal-actions">
          <button type="button" className="text-btn" onClick={cancelCopyPreviousWeek} autoFocus>
            {t('cancel')}
          </button>
          <button type="button" className="primary" onClick={confirmCopyPreviousWeek}>
            {t('replace')}
          </button>
        </div>
      </div>
    </div>
  )
}
