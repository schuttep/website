import React, { useState } from 'react';
import './PortfolioForm.css';
import axios from 'axios';
import { API_BASE_URL } from './config';

function PortfolioForm({ onPortfolioCreated }) {
    const [portfolioName, setPortfolioName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!portfolioName.trim()) {
            setError('Portfolio name cannot be empty');
            return;
        }

        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/portfolio`, {
                name: portfolioName
            });
            setPortfolioName('');
            onPortfolioCreated(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to create portfolio');
        } finally {
            setLoading(false);
        }
    };

    return (
        <form className="portfolio-form" onSubmit={handleSubmit}>
            <div className="form-group">
                <label htmlFor="portfolio-name">Portfolio Name:</label>
                <input
                    id="portfolio-name"
                    type="text"
                    value={portfolioName}
                    onChange={(e) => setPortfolioName(e.target.value)}
                    placeholder="e.g., Growth Portfolio, Conservative Portfolio"
                    disabled={loading}
                />
            </div>
            <button type="submit" disabled={loading} className="create-btn">
                {loading ? 'Creating...' : 'Create Portfolio'}
            </button>
            {error && <div className="form-error">{error}</div>}
        </form>
    );
}

export default PortfolioForm;
