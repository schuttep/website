import React, { useState, useMemo } from 'react';
import './PortfolioDetail.css';
import axios from 'axios';
import StockSearch from './StockSearch';
import { API_BASE_URL } from './config';
import {
    Chart as ChartJS,
    ArcElement,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import { Pie, Bar, Line } from 'react-chartjs-2';

ChartJS.register(
    ArcElement,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend
);

function PortfolioDetail({ portfolio, onStockAdded, onPortfolioUpdated }) {
    const [refreshing, setRefreshing] = useState(false);
    const [editingStockId, setEditingStockId] = useState(null);
    const [editingDate, setEditingDate] = useState('');
    const [updatingDate, setUpdatingDate] = useState(false);
    const [editingPriceStockId, setEditingPriceStockId] = useState(null);
    const [editingPrice, setEditingPrice] = useState('');
    const [updatingPrice, setUpdatingPrice] = useState(false);
    const [sortBy, setSortBy] = useState('value'); // value, symbol, gainLoss, percentage
    const [sortOrder, setSortOrder] = useState('desc'); // asc, desc

    // Calculate portfolio metrics
    const portfolioMetrics = useMemo(() => {
        if (!portfolio.assets || portfolio.assets.length === 0) {
            return {
                totalValue: 0,
                totalGainLoss: 0,
                totalGainLossPercentage: 0,
                bestPerformer: null,
                worstPerformer: null,
                totalInvested: 0
            };
        }

        let totalInvested = 0;
        let totalCurrentValue = 0;
        let bestPerformer = portfolio.assets[0];
        let worstPerformer = portfolio.assets[0];

        portfolio.assets.forEach(stock => {
            const invested = stock.purchasePrice * stock.quantity;
            const current = (stock.currentPrice || stock.purchasePrice) * stock.quantity;
            totalInvested += invested;
            totalCurrentValue += current;

            const stockGainLossPercentage = ((current - invested) / invested) * 100;
            const bestPerformancePercentage = ((bestPerformer.currentPrice * bestPerformer.quantity - bestPerformer.purchasePrice * bestPerformer.quantity) / (bestPerformer.purchasePrice * bestPerformer.quantity)) * 100;
            const worstPerformancePercentage = ((worstPerformer.currentPrice * worstPerformer.quantity - worstPerformer.purchasePrice * worstPerformer.quantity) / (worstPerformer.purchasePrice * worstPerformer.quantity)) * 100;

            if (stockGainLossPercentage > bestPerformancePercentage) {
                bestPerformer = stock;
            }
            if (stockGainLossPercentage < worstPerformancePercentage) {
                worstPerformer = stock;
            }
        });

        const totalGainLoss = totalCurrentValue - totalInvested;
        const totalGainLossPercentage = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

        return {
            totalValue: totalCurrentValue,
            totalGainLoss,
            totalGainLossPercentage,
            bestPerformer,
            worstPerformer,
            totalInvested
        };
    }, [portfolio.assets]);

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

    const handleAdjustInvestment = async () => {
        const amountStr = prompt('Enter amount to add (positive) or withdraw (negative):\nExample: 5000 to add $5,000 or -2000 to withdraw $2,000');

        if (amountStr === null) return; // User cancelled

        const amount = parseFloat(amountStr);
        if (isNaN(amount)) {
            alert('Please enter a valid number');
            return;
        }

        try {
            const response = await axios.put(
                `${API_BASE_URL}/api/portfolio/${portfolio.id}/adjust-investment`,
                { amount }
            );
            onPortfolioUpdated(response.data.portfolio);
            alert(response.data.message + `\nTotal Invested: $${response.data.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to adjust investment');
            console.error('Error adjusting investment:', error);
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

    // Sorted stocks
    const sortedStocks = useMemo(() => {
        if (!portfolio.assets) return [];

        const stocks = [...portfolio.assets];
        stocks.sort((a, b) => {
            let comparison = 0;
            switch (sortBy) {
                case 'symbol':
                    comparison = a.symbol.localeCompare(b.symbol);
                    break;
                case 'value':
                    comparison = a.totalValue - b.totalValue;
                    break;
                case 'gainLoss':
                    const aGain = (a.currentPrice * a.quantity) - (a.purchasePrice * a.quantity);
                    const bGain = (b.currentPrice * b.quantity) - (b.purchasePrice * b.quantity);
                    comparison = aGain - bGain;
                    break;
                case 'percentage':
                    const aPercentage = calculateGainLoss(a).percentage;
                    const bPercentage = calculateGainLoss(b).percentage;
                    comparison = aPercentage - bPercentage;
                    break;
                default:
                    comparison = 0;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
        return stocks;
    }, [portfolio.assets, sortBy, sortOrder]);

    // Chart data
    const pieChartData = {
        labels: portfolio.assets?.map(stock => stock.symbol) || [],
        datasets: [{
            data: portfolio.assets?.map(stock => stock.totalValue) || [],
            backgroundColor: [
                '#667eea', '#764ba2', '#f093fb', '#4facfe',
                '#43e97b', '#fa709a', '#fee140', '#30cfd0',
                '#a8edea', '#fed6e3'
            ],
            borderWidth: 2,
            borderColor: '#fff'
        }]
    };

    const barChartData = {
        labels: portfolio.assets?.map(stock => stock.symbol) || [],
        datasets: [{
            label: 'Gain/Loss ($)',
            data: portfolio.assets?.map(stock => {
                const gainLoss = calculateGainLoss(stock);
                return gainLoss.amount;
            }) || [],
            backgroundColor: portfolio.assets?.map(stock => {
                const gainLoss = calculateGainLoss(stock);
                return gainLoss.amount >= 0 ? '#28a745' : '#dc3545';
            }) || [],
            borderRadius: 6
        }]
    };

    const performanceChartData = {
        labels: portfolio.assets?.map(stock => stock.symbol) || [],
        datasets: [{
            label: 'Gain/Loss %',
            data: portfolio.assets?.map(stock => {
                const gainLoss = calculateGainLoss(stock);
                return gainLoss.percentage;
            }) || [],
            backgroundColor: portfolio.assets?.map(stock => {
                const gainLoss = calculateGainLoss(stock);
                return gainLoss.amount >= 0 ? 'rgba(40, 167, 69, 0.2)' : 'rgba(220, 53, 69, 0.2)';
            }) || [],
            borderColor: portfolio.assets?.map(stock => {
                const gainLoss = calculateGainLoss(stock);
                return gainLoss.amount >= 0 ? '#28a745' : '#dc3545';
            }) || [],
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }]
    };

    const handleSort = (newSortBy) => {
        if (sortBy === newSortBy) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(newSortBy);
            setSortOrder('desc');
        }
    };

    return (
        <div className="portfolio-detail">
            {/* Dashboard Summary Cards */}
            <div className="dashboard-cards">
                <div className="dashboard-card total-value">
                    <div className="card-icon">💰</div>
                    <div className="card-content">
                        <h3>Total Value</h3>
                        <p className="card-value">${(portfolioMetrics.totalValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <span className="card-subtitle">Current Portfolio Value</span>
                    </div>
                </div>
                <div className={`dashboard-card gain-loss ${portfolioMetrics.totalGainLoss >= 0 ? 'positive' : 'negative'}`}>
                    <div className="card-icon">{portfolioMetrics.totalGainLoss >= 0 ? '📈' : '📉'}</div>
                    <div className="card-content">
                        <h3>Total Gain/Loss</h3>
                        <p className="card-value">
                            {portfolioMetrics.totalGainLoss >= 0 ? '+' : ''}${(Math.abs(portfolioMetrics.totalGainLoss) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <span className="card-subtitle">
                            {portfolioMetrics.totalGainLossPercentage >= 0 ? '+' : ''}{(portfolioMetrics.totalGainLossPercentage || 0).toFixed(2)}%
                        </span>
                    </div>
                </div>
                <div className="dashboard-card best-performer">
                    <div className="card-icon">🔥</div>
                    <div className="card-content">
                        <h3>Best Performer</h3>
                        <p className="card-value">{portfolioMetrics.bestPerformer?.symbol || 'N/A'}</p>
                        <span className="card-subtitle">
                            {portfolioMetrics.bestPerformer ? `+${calculateGainLoss(portfolioMetrics.bestPerformer).percentage.toFixed(2)}%` : 'Add stocks'}
                        </span>
                    </div>
                </div>
                <div className="dashboard-card worst-performer">
                    <div className="card-icon">📊</div>
                    <div className="card-content">
                        <h3>Total Invested</h3>
                        <p className="card-value">${(portfolioMetrics.totalInvested || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                        <span className="card-subtitle">{portfolio.assets?.length || 0} Holdings</span>
                    </div>
                </div>
            </div>

            {/* Charts Section */}
            {portfolio.assets && portfolio.assets.length > 0 && (
                <div className="charts-section">
                    <div className="chart-container">
                        <h3>Portfolio Allocation</h3>
                        <div className="chart-wrapper">
                            <Pie data={pieChartData} options={{ maintainAspectRatio: true, plugins: { legend: { position: 'bottom' } } }} />
                        </div>
                    </div>
                    <div className="chart-container">
                        <h3>Gain/Loss by Stock</h3>
                        <div className="chart-wrapper">
                            <Bar data={barChartData} options={{ maintainAspectRatio: true, plugins: { legend: { display: false } } }} />
                        </div>
                    </div>
                    <div className="chart-container full-width">
                        <h3>Performance Trend (%)</h3>
                        <div className="chart-wrapper">
                            <Line data={performanceChartData} options={{
                                maintainAspectRatio: true,
                                scales: {
                                    y: {
                                        ticks: {
                                            callback: function (value) {
                                                return value + '%';
                                            }
                                        }
                                    }
                                }
                            }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Action Buttons */}
            <div className="portfolio-actions">
                <StockSearch portfolioId={portfolio.id} onStockAdded={onStockAdded} />
                <button
                    className="refresh-prices-btn"
                    onClick={handleRefreshPrices}
                    disabled={refreshing}
                    title="Refresh all stock prices"
                >
                    {refreshing ? '⟳ Updating...' : '⟳ Refresh Prices'}
                </button>
                <button
                    className="adjust-investment-btn"
                    onClick={handleAdjustInvestment}
                    title="Add or withdraw investment capital"
                >
                    💰 Adjust Investment
                </button>
            </div>

            {/* Holdings Table */}
            {portfolio.assets && portfolio.assets.length > 0 ? (
                <div className="stocks-section">
                    <div className="stocks-header">
                        <h3>Holdings</h3>
                        <div className="sort-controls">
                            <span>Sort by:</span>
                            <button
                                className={`sort-btn ${sortBy === 'symbol' ? 'active' : ''}`}
                                onClick={() => handleSort('symbol')}
                            >
                                Symbol {sortBy === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </button>
                            <button
                                className={`sort-btn ${sortBy === 'value' ? 'active' : ''}`}
                                onClick={() => handleSort('value')}
                            >
                                Value {sortBy === 'value' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </button>
                            <button
                                className={`sort-btn ${sortBy === 'gainLoss' ? 'active' : ''}`}
                                onClick={() => handleSort('gainLoss')}
                            >
                                Gain/Loss {sortBy === 'gainLoss' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </button>
                            <button
                                className={`sort-btn ${sortBy === 'percentage' ? 'active' : ''}`}
                                onClick={() => handleSort('percentage')}
                            >
                                % {sortBy === 'percentage' && (sortOrder === 'asc' ? '↑' : '↓')}
                            </button>
                        </div>
                    </div>
                    <div className="stocks-list">
                        {sortedStocks.map((stock) => {
                            const gainLoss = calculateGainLoss(stock);
                            const isGain = gainLoss.amount >= 0;
                            const isEditing = editingStockId === stock.id;
                            const allocation = (stock.totalValue / portfolioMetrics.totalValue) * 100;

                            return (
                                <div key={stock.id} className="stock-item">
                                    <div className="stock-details">
                                        <div className="stock-header">
                                            <div>
                                                <h4>{stock.symbol}</h4>
                                                <p className="stock-name">{stock.name}</p>
                                            </div>
                                            <div className="stock-badges">
                                                {gainLoss.percentage > 20 && <span className="badge hot">🔥 Hot</span>}
                                                {gainLoss.percentage < -10 && <span className="badge declining">📉 Down</span>}
                                                <span className="badge allocation">{allocation.toFixed(1)}%</span>
                                            </div>
                                        </div>
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
                                        <div className="performance-bar">
                                            <div
                                                className={`performance-fill ${isGain ? 'gain' : 'loss'}`}
                                                style={{ width: `${Math.min(Math.abs(gainLoss.percentage), 100)}%` }}
                                            ></div>
                                        </div>
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
                                                {isGain ? '+' : ''}${gainLoss.amount.toFixed(2)} ({isGain ? '+' : ''}{gainLoss.percentage.toFixed(2)}%)
                                            </span>
                                        </div>
                                        <div className="stat highlight">
                                            <span className="stat-label">Total Value</span>
                                            <span className="stat-value">${stock.totalValue.toFixed(2)}</span>
                                        </div>
                                        <button
                                            className="remove-stock-btn"
                                            onClick={() => handleRemoveStock(stock.id)}
                                            title="Remove from portfolio"
                                        >
                                            ✕ Remove
                                        </button>
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
