import { createRoot } from 'react-dom/client'
import { PrimitivesHarness } from './PrimitivesHarness'

const rootElement = document.getElementById('root')

if (rootElement) {
  createRoot(rootElement).render(<PrimitivesHarness />)
}
