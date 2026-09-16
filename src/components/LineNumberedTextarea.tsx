import { useLayoutEffect, useMemo, useRef, useState, type TextareaHTMLAttributes, type UIEvent } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> & {
  value: string
}

type Metrics = { fontSize: string; lineHeight: string }

export default function LineNumberedTextarea({ value, className = 'json-input', ...rest }: Props) {
  const gutterRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const lineCount = useMemo(() => (value.length === 0 ? 1 : value.split('\n').length), [value])

  useLayoutEffect(() => {
    const el = textareaRef.current
    if (!el) return
    const style = getComputedStyle(el)
    setMetrics({ fontSize: style.fontSize, lineHeight: style.lineHeight })
  }, [className])

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.style.transform = `translateY(${-event.currentTarget.scrollTop}px)`
    }
  }

  return (
    <div className="line-numbered">
      <div
        className="line-gutter"
        aria-hidden="true"
        style={metrics ? { fontSize: metrics.fontSize, lineHeight: metrics.lineHeight } : undefined}
      >
        <div className="line-gutter-inner" ref={gutterRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div className="line-gutter-num" key={i}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>
      <textarea ref={textareaRef} className={className} value={value} onScroll={handleScroll} wrap="off" {...rest} />
    </div>
  )
}
