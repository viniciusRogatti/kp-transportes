import ReactDOM from 'react-dom/client';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { HashRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './tailwind.css';

const queryClient = new QueryClient();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <QueryClientProvider client={queryClient}>
    <HashRouter>
      <App />
    </HashRouter>
  </QueryClientProvider>
);

reportWebVitals();
