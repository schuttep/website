import React, { useState } from 'react';
import './StockSearch.css';
import axios from 'axios';
import { API_BASE_URL } from './config';

function StockSearch({ portfolioId, onStockAdded }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [selectedStock, setSelectedStock] = useState(null);
    const [quantity, setQuantity] = useState(1);
    const [adding, setAdding] = useState(false);

    const handleSearch = async (e) => {
        const query = e.target.value;
        setSearchQuery(query);
        setError('');
        setSelectedStock(null);

        if (query.length < 1) {
            setSearchResults([]);
            return;
        }

        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/api/stocks/search`, {
                params: { q: query }
            });
            setSearchResults(response.data.stocks);
        } catch (err) {
            setError('Failed to search stocks');
            setSearchResults([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectStock = (stock) => {
        setSelectedStock(stock);
        setQuantity(1);
    };

    const handleAddStock = async () => {
        if (!selectedStock || quantity <= 0) {
            setError('Please select a stock and enter a valid quantity');
            return;
        }

        setAdding(true);
        setError('');
        try {
            await axios.post(`${API_BASE_URL}/api/portfolio/${portfolioId}/stocks`, {
                symbol: selectedStock.symbol,
                quantity: parseInt(quantity)
            });
            setSearchQuery('');
            setSearchResults([]);
            setSelectedStock(null);
            setQuantity(1);
            onStockAdded();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to add stock');
        } finally {
            setAdding(false);
        }
    };

    return (
        <div className="stock-search">
            <h3>Add Stock to Portfolio</h3>
            <div className="search-container">
                <input
                    type="text"
                    placeholder="Search stock by symbol or name (e.g., AAPL, Apple)"
                    value={searchQuery}
                    onChange={handleSearch}
                    disabled={adding}
                />
                {loading && <span className="loading">Searching...</span>}
            </div>

            {error && <div className="search-error">{error}</div>}

            {searchResults.length > 0 && !selectedStock && (
                <div className="search-results">
                    {searchResults.map((stock) => (
                        <button
                            key={stock.symbol}
                            className="stock-result-item"
                            onClick={() => handleSelectStock(stock)}
                            disabled={adding}
                        >
                            <div className="stock-info">
                                <strong>{stock.symbol}</strong>
                                <span className="stock-name">{stock.name}</span>
                            </div>
                            <div className="stock-price">${stock.price.toFixed(2)}</div>
                        </button>
                    ))}
                </div>
            )}

            {selectedStock && (
                <div className="selected-stock">
                    <div className="selected-stock-info">
                        <h4>{selectedStock.symbol}</h4>
                        <p>{selectedStock.name}</p>
                        <p className="price">Price: ${selectedStock.price.toFixed(2)}</p>
                    </div>
                    <div className="quantity-input">
                        <label htmlFor="quantity">Quantity:</label>
                        <input
                            id="quantity"
                            type="number"
                            min="1"
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            disabled={adding}
                        />
                        <div className="total-value">
                            Total: ${(selectedStock.price * quantity).toFixed(2)}
                        </div>
                    </div>
                    <div className="selected-stock-actions">
                        <button
                            className="btn-add"
                            onClick={handleAddStock}
                            disabled={adding}
                        >
                            {adding ? 'Adding...' : 'Add to Portfolio'}
                        </button>
                        <button
                            className="btn-cancel"
                            onClick={() => {
                                setSelectedStock(null);
                                setSearchQuery('');
                                setQuantity(1);
                            }}
                            disabled={adding}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default StockSearch;
