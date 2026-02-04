import React, { useState, useEffect } from 'react';
import './AIPortfolio.css';
import axios from 'axios';
import { API_BASE_URL } from './config';
import { Line } from 'react-chartjs-2';

function AIPortfolio() {
    const [currentAllocation, setCurrentAllocation] = useState(null);
    const [performance, setPerformance] = useState(null);
    const [rebalanceHistory, setRebalanceHistory] = useState([]);
    const [selectedRebalance, setSelectedRebalance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [rebalancing, setRebalancing] = useState(false);
    const [activeTab, setActiveTab] = useState('allocation'); // allocation, performance, history

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [allocationRes, performanceRes, historyRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/api/ai-portfolio/allocation/current`),
                axios.get(`${API_BASE_URL}/api/ai-portfolio/model/performance`),
                axios.get(`${API_BASE_URL}/api/ai-portfolio/model/rebalances`)
            ]);

            setCurrentAllocation(allocationRes.data);
            setPerformance(performanceRes.data);
            setRebalanceHistory(historyRes.data.rebalances);
        } catch (error) {
            console.error('Error fetching AI portfolio data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleManualRebalance = async () => {
        if (!window.confirm('Trigger a manual rebalance? This will fetch latest prices and update allocations.')) {
            return;
        }

        setRebalancing(true);
        try {
            await axios.post(`${API_BASE_URL}/api/ai-portfolio/rebalance`);
            await fetchData();
            alert('Rebalance completed successfully!');
        } catch (error) {
            console.error('Rebalance error:', error);
            alert('Failed to complete rebalance. Check console for details.');
        } finally {
            setRebalancing(false);
        }
    };

    const getRegimeColor = (regime) => {
        switch (regime) {
            case 'Risk-On': return '#28a745';
            case 'Risk-Off': return '#dc3545';
            case 'Neutral': return '#ffc107';
            default: return '#6c757d';
        }
    };

    const getRegimeIcon = (regime) => {
        switch (regime) {
            case 'Risk-On': return '📈';
            case 'Risk-Off': return '📉';
            case 'Neutral': return '⚖️';
            default: return '❓';
        }
    };

    // Chart data for equity curve
    const equityCurveData = performance?.equityCurve ? {
        labels: performance.equityCurve.map(point => point.date),
        datasets: [{
            label: 'Portfolio NAV',
            data: performance.equityCurve.map(point => point.nav),
            borderColor: '#667eea',
            backgroundColor: 'rgba(102, 126, 234, 0.1)',
            borderWidth: 2,
            fill: true,
            tension: 0.4
        }]
    } : null;

    if (loading) {
        return <div className="ai-portfolio-loading">Loading AI Portfolio...</div>;
    }

    return (
        <div className="ai-portfolio">
            <header className="ai-portfolio-header">
                <div>
                    <h1>🤖 AI-Managed Portfolio</h1>
                    <p className="subtitle">Regime-Aware Factor Rotation Strategy</p>
                </div>
                <button
                    className="rebalance-btn"
                    onClick={handleManualRebalance}
                    disabled={rebalancing}
                >
                    {rebalancing ? '⟳ Rebalancing...' : '⟳ Manual Rebalance'}
                </button>
            </header>

            <div className="disclaimer">
                <strong>⚠️ Educational Model Portfolio</strong> - This is a simulated portfolio for educational purposes only.
                Not investment advice. Past performance does not guarantee future results.
            </div>

            <nav className="ai-portfolio-tabs">
                <button
                    className={`tab-btn ${activeTab === 'allocation' ? 'active' : ''}`}
                    onClick={() => setActiveTab('allocation')}
                >
                    Current Allocation
                </button>
                <button
                    className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('performance')}
                >
                    Performance
                </button>
                <button
                    className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                    onClick={() => setActiveTab('history')}
                >
                    History
                </button>
            </nav>

            {/* Current Allocation Tab */}
            {activeTab === 'allocation' && currentAllocation && (
                <div className="tab-content">
                    <div className="regime-banner" style={{ backgroundColor: getRegimeColor(currentAllocation.regime) }}>
                        <span className="regime-icon">{getRegimeIcon(currentAllocation.regime)}</span>
                        <h2>Current Regime: {currentAllocation.regime}</h2>
                        <p className="regime-date">As of {currentAllocation.date}</p>
                    </div>

                    <div className="reason-box">
                        <h3>Why This Regime?</h3>
                        <p>{currentAllocation.reason}</p>
                        {currentAllocation.indicators && (
                            <div className="indicators">
                                <div className="indicator">
                                    <span className="label">SPY Close:</span>
                                    <span className="value">${currentAllocation.indicators.spyClose?.toFixed(2) || 'N/A'}</span>
                                </div>
                                <div className="indicator">
                                    <span className="label">50-day MA:</span>
                                    <span className="value">${currentAllocation.indicators.ma50?.toFixed(2) || 'N/A'}</span>
                                </div>
                                <div className="indicator">
                                    <span className="label">200-day MA:</span>
                                    <span className="value">${currentAllocation.indicators.ma200?.toFixed(2) || 'N/A'}</span>
                                </div>
                                <div className="indicator">
                                    <span className="label">20-day Vol:</span>
                                    <span className="value">{(currentAllocation.indicators.vol20 * 100)?.toFixed(2) || 'N/A'}%</span>
                                </div>
                                <div className="indicator">
                                    <span className="label">63-day DD:</span>
                                    <span className="value">{(currentAllocation.indicators.dd63 * 100)?.toFixed(2) || 'N/A'}%</span>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="allocation-grid">
                        {Object.entries(currentAllocation.weights).map(([symbol, weight]) => (
                            <div key={symbol} className="allocation-card">
                                <h3>{symbol}</h3>
                                <div className="weight-circle">
                                    <span className="weight-value">{(weight * 100).toFixed(0)}%</span>
                                </div>
                                <div className="weight-bar">
                                    <div
                                        className="weight-fill"
                                        style={{ width: `${weight * 100}%` }}
                                    ></div>
                                </div>
                                <p className="symbol-name">
                                    {symbol === 'SPY' && 'S&P 500 ETF'}
                                    {symbol === 'IEF' && '7-10Y Treasury'}
                                    {symbol === 'LQD' && 'Investment Grade Credit'}
                                    {symbol === 'GLD' && 'Gold'}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Performance Tab */}
            {activeTab === 'performance' && performance && (
                <div className="tab-content">
                    <div className="performance-summary">
                        <div className="perf-card">
                            <h3>Starting NAV</h3>
                            <p className="perf-value">${performance.startingNAV.toLocaleString()}</p>
                        </div>
                        <div className="perf-card">
                            <h3>Current NAV</h3>
                            <p className="perf-value">${performance.currentNAV.toLocaleString()}</p>
                        </div>
                        <div className={`perf-card ${performance.currentNAV >= performance.startingNAV ? 'positive' : 'negative'}`}>
                            <h3>Total Return</h3>
                            <p className="perf-value">
                                {((performance.currentNAV - performance.startingNAV) / performance.startingNAV * 100).toFixed(2)}%
                            </p>
                        </div>
                        <div className="perf-card">
                            <h3>Since</h3>
                            <p className="perf-value">{performance.startDate}</p>
                        </div>
                    </div>

                    {equityCurveData && performance.equityCurve.length > 0 && (
                        <div className="chart-container">
                            <h3>Equity Curve</h3>
                            <Line data={equityCurveData} options={{
                                responsive: true,
                                plugins: {
                                    legend: { display: false }
                                },
                                scales: {
                                    y: {
                                        ticks: {
                                            callback: (value) => '$' + value.toLocaleString()
                                        }
                                    }
                                }
                            }} />
                        </div>
                    )}

                    <div className="positions-table">
                        <h3>Current Positions</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Symbol</th>
                                    <th>Shares</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                {Object.entries(performance.positions).map(([symbol, position]) => {
                                    if (symbol === 'CASH') {
                                        return (
                                            <tr key={symbol}>
                                                <td><strong>CASH</strong></td>
                                                <td>-</td>
                                                <td>${position.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                            </tr>
                                        );
                                    }
                                    return (
                                        <tr key={symbol}>
                                            <td>{symbol}</td>
                                            <td>{position.shares}</td>
                                            <td>${position.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* History Tab */}
            {activeTab === 'history' && (
                <div className="tab-content">
                    <h2>Rebalance History</h2>
                    {rebalanceHistory.length === 0 ? (
                        <p className="no-history">No rebalances yet. Click "Manual Rebalance" to initialize the portfolio.</p>
                    ) : (
                        <div className="history-list">
                            {rebalanceHistory.map((rebalance, index) => (
                                <div
                                    key={index}
                                    className="history-item"
                                    onClick={() => setSelectedRebalance(selectedRebalance === index ? null : index)}
                                >
                                    <div className="history-header">
                                        <div>
                                            <span className="history-date">{rebalance.date}</span>
                                            <span
                                                className="history-regime"
                                                style={{ backgroundColor: getRegimeColor(rebalance.regime) }}
                                            >
                                                {getRegimeIcon(rebalance.regime)} {rebalance.regime}
                                            </span>
                                        </div>
                                        <div className="history-metrics">
                                            <span>NAV: ${rebalance.navAfter.toLocaleString()}</span>
                                            <span>Turnover: {(rebalance.turnover * 100).toFixed(1)}%</span>
                                        </div>
                                    </div>
                                    {selectedRebalance === index && (
                                        <div className="history-details">
                                            <p><strong>Reason:</strong> {rebalance.reason}</p>
                                            <div className="history-weights">
                                                <h4>Target Weights:</h4>
                                                <div className="weights-grid">
                                                    {Object.entries(rebalance.weights).map(([symbol, weight]) => (
                                                        <div key={symbol} className="weight-item">
                                                            <span>{symbol}:</span>
                                                            <span>{(weight * 100).toFixed(0)}%</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                            {rebalance.trades && rebalance.trades.length > 0 && (
                                                <div className="history-trades">
                                                    <h4>Trades Executed:</h4>
                                                    {rebalance.trades.map((trade, i) => (
                                                        <div key={i} className="trade-item">
                                                            <span className={`trade-action ${trade.action.toLowerCase()}`}>
                                                                {trade.action}
                                                            </span>
                                                            <span>{trade.shares} shares of {trade.symbol}</span>
                                                            <span>@ ${trade.price.toFixed(2)}</span>
                                                            <span className="trade-cost">(cost: ${trade.cost.toFixed(2)})</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default AIPortfolio;
