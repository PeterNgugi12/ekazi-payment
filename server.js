const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const admin = require('firebase-admin');
const serviceAccount = require('./config/firebase-service-account-key.json'); // Replace with your Firebase service account key file path

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://jobseeker-d26f9.firebaseio.com' // Replace with your Firebase database URLvisua
});

const db = admin.firestore();
const app = express();

const port = process.env.PORT || 3000;
const ipAddress = '192.168.0.105'; // Replace with your actual IP address

// Body parser middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Replace with your M-Pesa consumer key and consumer secret
const consumerKey = 'LrngqjZOA5Y3ems5WSAHpJrfclJSCl9cAguoyu797UKxdGo5';
const consumerSecret = 'Xfj0TxMKJAPxpzWbn6J24bytzUGiumXkA823gWVhGNhheaQXhgGp6d7hn9UW4AHs';

// Function to get M-Pesa access token
const getMpesaAccessToken = async () => {
    const auth = 'Basic ' + Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
    const response = await axios.get('https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials', {
        headers: {
            Authorization: auth
        }
    });
    return response.data.access_token;
};

// M-Pesa callback endpoint
app.post('/mpesa/callback', async (req, res) => {
    console.log('M-Pesa callback received:', req.body);
    const { Body } = req.body;
    const { stkCallback } = Body;
    const { ResultCode, ResultDesc, CheckoutRequestID } = stkCallback;

    // Update payment status in Firebase
    const paymentRef = db.collection('UserPayments').doc(CheckoutRequestID);
    await paymentRef.set({
        ResultCode,
        ResultDesc,
        paid: ResultCode === '0', // assuming ResultCode '0' means payment successful
    });

    res.status(200).end();
});

// M-Pesa STK push simulation endpoint
app.get('/mpesa/simulate', async (req, res) => {
    try {
        const accessToken = await getMpesaAccessToken();
        const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, -3);
        const shortCode = '4139123';
        const passKey = 'bd3286f9cd7d9cc00540312dc30d25463c1d3141d1e57c07cee8254861b1925c';
        const password = Buffer.from(`${shortCode}${passKey}${timestamp}`).toString('base64');

        const { phoneNumber, amount } = req.query;

        const transactionId = uuidv4(); // Generate a unique transaction ID

        const payload = {
            BusinessShortCode: shortCode,
            Password: password,
            Timestamp: timestamp,
            TransactionType: 'CustomerPayBillOnline',
            Amount: amount,
            PartyA: phoneNumber,
            PartyB: shortCode,
            PhoneNumber: phoneNumber,
            //CallBackURL: `http://${ipAddress}:${port}/mpesa/callback?transactionId=${transactionId}`,
            CallBackURL: `https://ekazi.co.ke/mpesa/callback?transactionId=${transactionId}`,
            AccountReference: '1328341127',
            TransactionDesc: 'Testing M-Pesa STK push',
        };

        const response = await axios.post('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', payload, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });

        // Save initial payment details in Firebase
        const paymentRef = db.collection('UserPayments').doc(transactionId);
        await paymentRef.set({
            amount,
            phoneNumber,
            status: 'initiated',
        });

        res.status(200).json({ ...response.data, transactionId });
    } catch (error) {
        console.error('Error simulating STK push:', error);
        res.status(500).send('Failed to simulate STK push');
    }
});

// M-Pesa payment status endpoint
app.get('/mpesa/status', async (req, res) => {
    try {
        const accessToken = await getMpesaAccessToken();
        const { transactionId } = req.query;

        const response = await axios.get(`https://api.safaricom.co.ke/mpesa/stkpushquery/v1/query?checkoutRequestID=${transactionId}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            }
        });

        // Update payment status in Firebase
        const paymentRef = db.collection('UserPayments').doc(transactionId);
        console.log('paymentRef');
        const paymentDoc = await paymentRef.get();
        if (paymentDoc.exists) {
            const paymentData = paymentDoc.data();
            const { ResponseCode, ResponseDescription } = response.data;
            if (ResponseCode === '0') {
                await paymentRef.update({ status: 'completed' });
                res.status(200).json({ success: true, message: 'Payment verified' });
            } else {
                await paymentRef.update({ status: 'failed', error: ResponseDescription });
                res.status(400).json({ success: false, message: ResponseDescription });
            }
        } else {
            res.status(404).json({ success: false, message: 'Transaction not found' });
        }
    } catch (error) {
        if (error.response) {
            console.error('Response data:', error.response.data);
            console.error('Response status:', error.response.status);
            console.error('Response headers:', error.response.headers);
            res.status(error.response.status).send(error.response.data);
        } else if (error.request) {
            console.error('No response received:', error.request);
            res.status(500).send('No response received from M-Pesa API');
        } else {
            console.error('Error setting up request:', error.message);
            res.status(500).send('Error setting up request to M-Pesa API');
        }
        console.error('Error config:', error.config);
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://${ipAddress}:${port}`);
});
