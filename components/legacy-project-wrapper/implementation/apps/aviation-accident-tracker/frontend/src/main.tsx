import ReactDOM from 'react-dom/client';
import App from './App';
import { installFrontendIssueErrorReporting } from './utils/issueReporting';

installFrontendIssueErrorReporting();

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <App />
);
