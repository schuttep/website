import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';
import PortfolioForm from './PortfolioForm';
import PortfolioDetail from './PortfolioDetail';
import { API_BASE_URL } from './config';

function App() {
    const [serverStatus, setServerStatus] = useState(null);
    const [portfolios, setPortfolios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [updateLoading, setUpdateLoading] = useState(false);
    const [selectedPortfolioId, setSelectedPortfolioId] = useState(null);

    useEffect(() => {
        fetchPortfolios();
    }, []);

    const fetchPortfolios = async () => {
        try {
            // Check server health
            const healthResponse = await axios.get(`${API_BASE_URL}/api/health`);
            setServerStatus(healthResponse.data);

            // Fetch portfolios
            const portfolioResponse = await axios.get(`${API_BASE_URL}/api/portfolio`);
            setPortfolios(portfolioResponse.data.portfolios);
        } catch (error) {
            console.error('Error fetching data:', error);
            setServerStatus({ status: 'Server is not running', error: error.message });
        } finally {
            setLoading(false);
        }
    };

    const handlePortfolioCreated = (newPortfolio) => {
        setPortfolios([...portfolios, newPortfolio]);
    };

    const handleDeletePortfolio = async (portfolioId) => {
        if (window.confirm('Are you sure you want to delete this portfolio?')) {
            try {
                await axios.delete(`${API_BASE_URL}/api/portfolio/${portfolioId}`);
                setPortfolios(portfolios.filter(p => p.id !== portfolioId));
                if (selectedPortfolioId === portfolioId) {
                    setSelectedPortfolioId(null);
                }
            } catch (error) {
                alert('Failed to delete portfolio');
                console.error('Error deleting portfolio:', error);
            }
        }
    };

    const handlePortfolioUpdated = (updatedPortfolio) => {
        setPortfolios(portfolios.map(p => p.id === updatedPortfolio.id ? updatedPortfolio : p));
    };

    const handleStockAdded = async () => {
        // Refresh the selected portfolio
        if (selectedPortfolioId) {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/portfolio/${selectedPortfolioId}`);
                handlePortfolioUpdated(response.data);
            } catch (error) {
                console.error('Error refreshing portfolio:', error);
            }
        }
    };

    const calculatePortfolioGainLoss = (portfolio) => {
        if (!portfolio.assets || portfolio.assets.length === 0) {
            return { amount: 0, percentage: 0 };
        }

        let totalPurchaseValue = 0;
        let totalCurrentValue = 0;

        portfolio.assets.forEach(asset => {
            if (asset.purchasePrice && asset.quantity) {
                totalPurchaseValue += asset.purchasePrice * asset.quantity;
                totalCurrentValue += (asset.currentPrice || asset.purchasePrice) * asset.quantity;
            }
        });

        const gainLoss = totalCurrentValue - totalPurchaseValue;
        const percentage = totalPurchaseValue > 0 ? (gainLoss / totalPurchaseValue) * 100 : 0;

        return { amount: gainLoss, percentage };
    };

    const handleUpdatePrices = async () => {
        setUpdateLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/refresh-prices`);
            if (response.data?.portfolios) {
                setPortfolios(response.data.portfolios);
            }
        } catch (error) {
            console.error('Error updating prices:', error);
            alert('Failed to update stock prices. Please try again.');
        } finally {
            setUpdateLoading(false);
        }
    };

    return (
        <div className="App">
            <header className="App-header">
                <div className="header-content">
                    <h1>Portfolio Manager</h1>
                    <div className="header-actions">
                        <nav className="header-links">
                            <a href="/">Main Site</a>
                            <a href="/calendar">Calendar</a>
                        </nav>
                        <button
                            className="update-btn"
                            onClick={handleUpdatePrices}
                            disabled={updateLoading}
                            title="Refresh all stock prices"
                        >
                            {updateLoading ? 'Updating...' : 'Update Stocks'}
                        </button>
                    </div>
                </div>
            </header>
            <main className="App-main">
                {loading ? (
                    <p>Loading...</p>
                ) : selectedPortfolioId ? (
                    <>
                        <button className="back-btn" onClick={() => setSelectedPortfolioId(null)}>
                            ← Back to Portfolios
                        </button>
                        <PortfolioDetail
                            portfolio={portfolios.find(p => p.id === selectedPortfolioId)}
                            onStockAdded={handleStockAdded}
                            onPortfolioUpdated={handlePortfolioUpdated}
                        />
                    </>
                ) : (
                    <>
                        <section className="status-section">
                            <h2>Server Status</h2>
                            <div className="status-card">
                                <p><strong>Status:</strong> {serverStatus?.status || 'Unknown'}</p>
                                {serverStatus?.timestamp && (
                                    <p><strong>Last Updated:</strong> {new Date(serverStatus.timestamp).toLocaleTimeString()}</p>
                                )}
                            </div>
                        </section>

                        <section className="portfolios-section">
                            <h2>Your Portfolios</h2>
                            <PortfolioForm onPortfolioCreated={handlePortfolioCreated} />
                            {portfolios.length > 0 ? (
                                <div className="portfolio-list">
                                    {portfolios.map((portfolio) => {
                                        const gainLoss = calculatePortfolioGainLoss(portfolio);
                                        const isGain = gainLoss.amount >= 0;

                                        return (
                                            <div
                                                key={portfolio.id}
                                                className="portfolio-card"
                                                onClick={() => setSelectedPortfolioId(portfolio.id)}
                                                style={{ cursor: 'pointer' }}
                                            >
                                                <div className="portfolio-header">
                                                    <h3>{portfolio.name}</h3>
                                                    <button
                                                        className="delete-btn"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeletePortfolio(portfolio.id);
                                                        }}
                                                        title="Delete this portfolio"
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                                <p><strong>Total Value:</strong> ${portfolio.totalValue.toFixed(2)}</p>
                                                <p className={`gain-loss-display ${isGain ? 'gain' : 'loss'}`}>
                                                    <strong>Net Gain/Loss:</strong> ${gainLoss.amount.toFixed(2)} ({gainLoss.percentage.toFixed(2)}%)
                                                </p>
                                                <p><strong>Assets:</strong> {portfolio.assets.length}</p>
                                                {portfolio.createdAt && (
                                                    <p className="portfolio-date">
                                                        <small>Created: {new Date(portfolio.createdAt).toLocaleDateString()}</small>
                                                    </p>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <p className="no-portfolios">No portfolios found. Create one to get started!</p>
                            )}
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}

export default App;
