import { ReactNode } from 'react'

type DisplayShellProps = {
  title: string
  className?: string
  children: ReactNode
}

export const DisplayShell = ({ title, className, children }: DisplayShellProps) => {
  const classes = ['panel', 'display-shell', className].filter(Boolean).join(' ')

  return (
    <section className={classes}>
      <h2 className="panel__title">{title}</h2>
      <div className="display-shell__body">
        <canvas className="display-shell__canvas" aria-hidden="true" />
        <div className="display-shell__content">{children}</div>
      </div>
    </section>
  )
}
