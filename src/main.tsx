import {createRoot} from 'react-dom/client';
import './index.css';

const root = createRoot(document.getElementById('root')!);
if (window.location.pathname.replace(/\/+$/, '') === '/order') {
  // Public order page: no login, no access to the rest of the app.
  import('./components/PublicOrderPage').then(({ PublicOrderPage }) => root.render(<PublicOrderPage />));
} else {
  import('./App.tsx').then(({ default: App }) => root.render(<App />));
}
