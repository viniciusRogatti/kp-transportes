import ReactDOM from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { HashRouter } from 'react-router-dom';
import GlobalStyle from './globalStyles';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <HashRouter>
    <GlobalStyle />
    <App />
  </HashRouter>
);

reportWebVitals();
