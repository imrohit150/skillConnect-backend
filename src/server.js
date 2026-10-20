require('dotenv').config();

const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');

const healthRoutes = require('./routes/health.routes');
const authRoutes = require('./routes/auth.routes');
const connectDB = require('./config/database');

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(express.json());

app.use('/api/v1', healthRoutes);
app.use('/api/v1', authRoutes);
app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the SkillConnect API' });
});

const PORT = process.env.PORT || 5000;

const startServer = async () => {
    try {
        await connectDB();
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('Failed to start the server:', error.message);
        process.exit(1);
    }
}

startServer();