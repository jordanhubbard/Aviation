import ReactDOM from 'react-dom/client';
import App from './App';
import { installFrontendMacErrorReporting } from './utils/macReporting';

installFrontendMacErrorReporting();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
