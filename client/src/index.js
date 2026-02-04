import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './index.css';
import App from './App';
import AIPortfolio from './AIPortfolio';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <BrowserRouter basename="/portfolio">
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/aiportfolio" element={<AIPortfolio />} />
            </Routes>
        </BrowserRouter>
    </React.StrictMode>
);
