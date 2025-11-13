# Kulmis Pharmacy Backend API

Backend server for Kulmis Pharmacy & Laboratory Management System.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file (copy from `.env.example`):
```env
PORT=5000
NODE_ENV=development
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:5173
```

3. Start the server:
```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (protected)

### Laboratory
- `GET /api/lab/patients` - Get all patients
- `POST /api/lab/patients` - Create patient
- `GET /api/lab/tests` - Get lab tests catalog
- `POST /api/lab/orders` - Create lab order
- `GET /api/lab/orders` - Get all orders
- `POST /api/lab/results` - Save lab results
- `GET /api/invoices` - Get invoices

### Pharmacy
- `GET /api/medicines` - Get medicines
- `POST /api/medicines` - Create medicine
- `POST /api/sales` - Create sale
- `GET /api/debts` - Get debts
- `GET /api/expenses` - Get expenses

## MongoDB Collections

- users
- patients
- lab_tests
- lab_orders
- lab_results
- invoices
- medicines
- transactions
- debts
- expenses

