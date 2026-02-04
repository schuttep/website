# Portfolio Manager

A full-stack portfolio management application built with React and Node.js/Express.

## Project Structure

```
PortfolioManager/
├── server/              # Express.js backend
│   ├── index.js        # Main server file
│   ├── package.json
│   ├── .env
│   └── .gitignore
├── client/             # React frontend
│   ├── src/
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   ├── public/
│   │   └── index.html
│   ├── package.json
│   └── .gitignore
├── package.json        # Root package.json for concurrently running both apps
└── README.md
```

## Setup Instructions

### Prerequisites
- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Install all dependencies:
```bash
npm run install-all
```

This will install dependencies for the root, server, and client simultaneously.

### Running the Application

**Development Mode (both server and client):**
```bash
npm run dev
```

This uses `concurrently` to run both the Express server and React app in parallel.

**Run Server Only:**
```bash
npm run server
```
Server runs on `http://localhost:5000`

**Run Client Only:**
```bash
npm run client
```
Client runs on `http://localhost:3000`

## API Endpoints

### Health Check
- **GET** `/api/health` - Returns server status

### Portfolio
- **GET** `/api/portfolio` - Returns all portfolios

## Features (Ready to Implement)

- [ ] User authentication
- [ ] Portfolio CRUD operations
- [ ] Asset management
- [ ] Portfolio performance tracking
- [ ] Price updates
- [ ] Portfolio allocation charts
- [ ] Transaction history

## Tech Stack

**Backend:**
- Express.js
- Node.js
- CORS
- dotenv

**Frontend:**
- React 18
- React Router v6
- Axios
- CSS3

## Development Notes

- Server uses port 5000 (configurable via `.env`)
- Client uses port 3000 (React default)
- Proxy is set in client's `package.json` to forward API calls to the server
- Environment variables for the server are in `server/.env`

## Next Steps

1. Implement user authentication
2. Set up database (MongoDB/PostgreSQL/Cosmos DB)
3. Add portfolio management routes
4. Create user dashboard
5. Implement real-time price updates
6. Add charting and visualization
