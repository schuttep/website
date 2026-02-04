import React, { useState } from 'react';
import './PortfolioDetail.css';
import axios from 'axios';
import StockSearch from './StockSearch';
import { API_BASE_URL } from './config';

function PortfolioDetail({ portfolio, onStockAdded, onPortfolioUpdated }) {
    const [refreshing, setRefreshing] = useState(false);
    const [editingStockId, setEditingStockId] = useState(null);
    const [editingDate, setEditingDate] = useState('');
    const [updatingDate, setUpdatingDate] = useState(false);
    const [editingPriceStockId, setEditingPriceStockId] = useState(null);
    const [editingPrice, setEditingPrice] = useState('');
    const [updatingPrice, setUpdatingPrice] = useState(false);

    const handleRemoveStock = async (stockId) => {
        if (window.confirm('Remove this stock from the portfolio?')) {
            try {
                const response = await axios.delete(`${API_BASE_URL}/api/portfolio/${portfolio.id}/stocks/${stockId}`);
                onPortfolioUpdated(response.data.portfolio);
            } catch (error) {
                alert('Failed to remove stock');
                console.error('Error removing stock:', error);
            }
        }
    };

    const handleRefreshPrices = async () => {
        setRefreshing(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/refresh-prices`);
            // Update portfolios with new data
            if (response.data.portfolios) {
                const updatedPortfolio = response.data.portfolios.find(p => p.id === portfolio.id);
                if (updatedPortfolio) {
                    onPortfolioUpdated(updatedPortfolio);
                }
            }
            alert(`Prices updated! (${response.data.count} stocks)`);
        } catch (error) {
            alert('Failed to refresh prices');
            console.error('Error refreshing prices:', error);
        } finally {
            setRefreshing(false);
        }
    };

    const handleEditDate = (stock) => {
        setEditingStockId(stock.id);
        const dateStr = new Date(stock.purchaseDate).toISOString().split('T')[0];
        setEditingDate(dateStr);
    };

    const handleSaveDateChange = async (stockId) => {
        if (!editingDate) {
            alert('Please select a date');
            return;
        }

        setUpdatingDate(true);
        try {
            const response = await axios.put(
                `${API_BASE_URL}/api/portfolio/${portfolio.id}/stocks/${stockId}/purchase-date`,
                { purchaseDate: editingDate }
            );
            onPortfolioUpdated(response.data);
            setEditingStockId(null);
            setEditingDate('');
            alert('Purchase date updated with historical price!');
        } catch (error) {
            alert('Failed to update purchase date');
            console.error('Error updating date:', error);
        } finally {
            setUpdatingDate(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingStockId(null);
        setEditingDate('');
    };

    const handleEditPrice = (stock) => {
        setEditingPriceStockId(stock.id);
        setEditingPrice(stock.purchasePrice.toString());
    };

    const handleSavePriceChange = async (stockId) => {
        if (!editingPrice || isNaN(parseFloat(editingPrice))) {
            alert('Please enter a valid price');
            return;
        }

        setUpdatingPrice(true);
        try {
            const response = await axios.put(
                `${API_BASE_URL}/api/portfolio/${portfolio.id}/stocks/${stockId}/purchase-price`,
                { purchasePrice: parseFloat(editingPrice) }
            );
            onPortfolioUpdated(response.data);
            setEditingPriceStockId(null);
            setEditingPrice('');
            alert('Purchase price updated!');
        } catch (error) {
            alert('Failed to update purchase price');
            console.error('Error updating price:', error);
        } finally {
            setUpdatingPrice(false);
        }
    };

    const handleCancelPriceEdit = () => {
        setEditingPriceStockId(null);
        setEditingPrice('');
    };

    const calculateGainLoss = (stock) => {
        if (!stock.purchasePrice) return { amount: 0, percentage: 0 };
        const purchaseTotal = stock.purchasePrice * stock.quantity;
        const currentTotal = (stock.currentPrice || stock.purchasePrice) * stock.quantity;
        const gainLoss = currentTotal - purchaseTotal;
        const percentage = (gainLoss / purchaseTotal) * 100;
        return { amount: gainLoss, percentage };
    };

    return (
        <div className="portfolio-detail">
            <div className="portfolio-detail-header">
                <div>
                    <h2>{portfolio.name}</h2>
                    <p className="portfolio-total">Total Value: ${portfolio.totalValue.toFixed(2)}</p>
                </div>
                <button
                    className="refresh-prices-btn"
                    onClick={handleRefreshPrices}
                    disabled={refreshing}
                    title="Refresh all stock prices from AlphaVantage"
                >
                    {refreshing ? '⟳ Updating...' : '⟳ Refresh Prices'}
                </button>
            </div>

            <StockSearch portfolioId={portfolio.id} onStockAdded={onStockAdded} />

            {portfolio.assets && portfolio.assets.length > 0 ? (
                <div className="stocks-section">
                    <h3>Holdings</h3>
                    <div className="stocks-list">
                        {portfolio.assets.map((stock) => {
                            const gainLoss = calculateGainLoss(stock);
                            const isGain = gainLoss.amount >= 0;
                            const isEditing = editingStockId === stock.id;

                            return (
                                <div key={stock.id} className="stock-item">
                                    <div className="stock-details">
                                        <div className="stock-header">
                                            <h4>{stock.symbol}</h4>
                                            <button
                                                className="remove-stock-btn"
                                                onClick={() => handleRemoveStock(stock.id)}
                                                title="Remove from portfolio"
                                            >
                                                ✕
                                            </button>
                                        </div>
                                        <p className="stock-name">{stock.name}</p>
                                        {stock.purchaseDate && (
                                            <div className="purchase-date-section">
                                                {isEditing ? (
                                                    <div className="date-edit-controls">
                                                        <input
                                                            type="date"
                                                            value={editingDate}
                                                            onChange={(e) => setEditingDate(e.target.value)}
                                                            className="date-input"
                                                        />
                                                        <button
                                                            className="date-save-btn"
                                                            onClick={() => handleSaveDateChange(stock.id)}
                                                            disabled={updatingDate}
                                                        >
                                                            {updatingDate ? 'Saving...' : 'Save'}
                                                        </button>
                                                        <button
                                                            className="date-cancel-btn"
                                                            onClick={handleCancelEdit}
                                                        >
                                                            Cancel
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="purchase-date">
                                                        <p>
                                                            Purchased: {new Date(stock.purchaseDate).toLocaleDateString()}
                                                            <button
                                                                className="edit-date-btn"
                                                                onClick={() => handleEditDate(stock)}
                                                                title="Edit purchase date"
                                                            >
                                                                ✎
                                                            </button>
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                    <div className="stock-stats">
                                        <div className="stat">
                                            <span className="stat-label">Quantity</span>
                                            <span className="stat-value">{stock.quantity}</span>
                                        </div>
                                        <div className="stat">
                                            <span className="stat-label">Purchase Price</span>
                                            <span className="stat-value">
                                                ${stock.purchasePrice ? stock.purchasePrice.toFixed(2) : 'N/A'}
                                                <button
                                                    className="edit-price-btn"
                                                    onClick={() => handleEditPrice(stock)}
                                                    title="Edit purchase price"
                                                >
                                                    ✎
                                                </button>
                                            </span>
                                            {editingPriceStockId === stock.id && (
                                                <div className="price-edit-controls">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        min="0"
                                                        value={editingPrice}
                                                        onChange={(e) => setEditingPrice(e.target.value)}
                                                        className="price-input"
                                                        placeholder="Enter price"
                                                    />
                                                    <button
                                                        className="price-save-btn"
                                                        onClick={() => handleSavePriceChange(stock.id)}
                                                        disabled={updatingPrice}
                                                    >
                                                        {updatingPrice ? 'Saving...' : 'Save'}
                                                    </button>
                                                    <button
                                                        className="price-cancel-btn"
                                                        onClick={handleCancelPriceEdit}
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="stat">
                                            <span className="stat-label">Current Price</span>
                                            <span className="stat-value">${(stock.currentPrice || stock.purchasePrice || 0).toFixed(2)}</span>
                                        </div>
                                        <div className={`stat gain-loss ${isGain ? 'gain' : 'loss'}`}>
                                            <span className="stat-label">Gain/Loss</span>
                                            <span className="stat-value">
                                                ${gainLoss.amount.toFixed(2)} ({gainLoss.percentage.toFixed(2)}%)
                                            </span>
                                        </div>
                                        <div className="stat highlight">
                                            <span className="stat-label">Total Value</span>
                                            <span className="stat-value">${stock.totalValue.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="no-stocks">
                    <p>No stocks in this portfolio yet. Search and add some above!</p>
                </div>
            )}
        </div>
    );
}

export default PortfolioDetail;
