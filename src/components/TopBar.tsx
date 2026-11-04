import { useI18n } from '../lib/i18n'
import { formatWeekRange, previousWeek } from '../lib/schedule'
import { useStore } from '../state/store'
import { IconArrow } from './icons'

export function TopBar() {
  const { t, language, setLanguage } = useI18n()
  const settings = useStore((state) => state.settings)
  const entries = useStore((state) => state.entries)
  const shiftWeek = useStore((state) => state.shiftWeek)
  const setTracking = useStore((state) => state.setTracking)
  const requestCopyPreviousWeek = useStore((state) => state.requestCopyPreviousWeek)
  const canCopy = entries.some((entry) => entry.weekStart === previousWeek(settings.weekStart))

  return (
    <header className="topbar">
      <div className="week-nav">
        <button type="button" className="icon-btn" aria-label={t('previousWeek')} onClick={() => shiftWeek(-1)}>
          <IconArrow direction="left" />
        </button>
        <p className="week-label">{formatWeekRange(settings.weekStart, language)}</p>
        <button type="button" className="icon-btn" aria-label={t('nextWeek')} onClick={() => shiftWeek(1)}>
          <IconArrow direction="right" />
        </button>
      </div>
      <button
        type="button"
        className="text-btn"
        disabled={!canCopy}
        title={canCopy ? undefined : t('nothingToCopy')}
        onClick={requestCopyPreviousWeek}
      >
        {t('copyPreviousWeek')}
      </button>
      <div className="top-actions">
        <div className="lang" role="group" aria-label={t('language')}>
          <button type="button" aria-pressed={language === 'de'} onClick={() => setLanguage('de')}>
            DE
          </button>
          <button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>
            EN
          </button>
        </div>
        <button
          type="button"
          className={settings.trackingMode ? 'switch on' : 'switch'}
          role="switch"
          aria-checked={settings.trackingMode}
          aria-label={t('tracking')}
          onClick={() => setTracking(!settings.trackingMode)}
        >
          <span className="switch-track" aria-hidden="true">
            <span className="switch-thumb" />
          </span>
          <span>{settings.trackingMode ? t('planAndActual') : t('plan')}</span>
        </button>
      </div>
    </header>
  )
}
