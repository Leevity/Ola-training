import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import '../../shared/design-tokens.css';
import '@ola/classroom-ui/styles.css';
import './styles.css';
import '../../shared/desktop-system.css';
createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
