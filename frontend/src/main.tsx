import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../../shared/design-tokens.css';
import '@ola/classroom-ui/styles.css';
import '@ola/classroom-ui/assistant.css';
import './styles.css';
import './details.css';
import './social.css';
import './overrides.css';
import './live.css';

createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>);
