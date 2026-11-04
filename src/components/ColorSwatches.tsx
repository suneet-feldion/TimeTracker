import { PALETTE, type ColorId } from '../lib/types'
import { useI18n } from '../lib/i18n'

export function ColorSwatches({ value, onChange }: { value: ColorId; onChange: (color: ColorId) => void }) {
  const { t } = useI18n()
  return (
    <div className="swatches" role="group" aria-label={t('color')}>
      {PALETTE.map((color) => (
        <button
          key={color.id}
          type="button"
          className={color.id === value ? 'swatch selected' : 'swatch'}
          style={{ background: color.solid }}
          aria-label={color.id}
          aria-pressed={color.id === value}
          onClick={() => onChange(color.id)}
        />
      ))}
    </div>
  )
}
