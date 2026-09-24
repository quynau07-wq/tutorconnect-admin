import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './styles.css';
import './modal.css';
import './admin-details.css';
import './management.css';
import './responsive.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode><App /></StrictMode>,
);
