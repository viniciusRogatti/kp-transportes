import ReactDOM from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { HashRouter } from 'react-router-dom';
import GlobalStyle from './globalStyles';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

const basename = process.env.NODE_ENV === 'production' ? '/kp-transportes' : undefined;

root.render(
  <HashRouter basename={basename}>
    <GlobalStyle />
    <App />
  </HashRouter>
);

reportWebVitals();
