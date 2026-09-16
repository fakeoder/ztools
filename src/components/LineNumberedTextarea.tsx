import { useMemo, useRef, type TextareaHTMLAttributes, type UIEvent } from 'react'

type Props = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value'> & {
  value: string
}

export default function LineNumberedTextarea({ value, className = 'json-input', ...rest }: Props) {
  const gutterRef = useRef<HTMLDivElement>(null)
  const lineCount = useMemo(() => (value.length === 0 ? 1 : value.split('\n').length), [value])

  const handleScroll = (event: UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) {
      gutterRef.current.style.transform = `translateY(${-event.currentTarget.scrollTop}px)`
    }
  }

  return (
    <div className="line-numbered">
      <div className="line-gutter" aria-hidden="true">
        <div className="line-gutter-inner" ref={gutterRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div className="line-gutter-num" key={i}>
              {i + 1}
            </div>
          ))}
        </div>
      </div>
      <textarea className={className} value={value} onScroll={handleScroll} wrap="off" {...rest} />
    </div>
  )
}
