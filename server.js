const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const MANGOFY_API_URL = 'https://checkout.mangofy.com.br/api/v1/payment';
const API_KEY = process.env.MANGOFY_API_KEY;
const STORE_CODE = process.env.MANGOFY_STORE_CODE;

app.post('/api/create-pix', async (req, res) => {
    try {
        const { customer, payment_amount, items } = req.body;

        const payload = {
            store_code: STORE_CODE,
            external_code: `ORDER-${Date.now()}`,
            payment_method: 'pix',
            payment_format: 'regular',
            installments: 1,
            payment_amount: payment_amount, // em centavos
            customer: {
                name: customer.name,
                email: customer.email,
                document: customer.document.replace(/\D/g, ''),
                phone: customer.phone.replace(/\D/g, ''),
                ip: req.ip || '127.0.0.1'
            },
            items: items || [
                {
                    code: '1',
                    name: 'Produto Checkout',
                    amount: payment_amount,
                    total: payment_amount
                }
            ],
            pix: {
                expires_in_days: 1
            }
        };

        const response = await axios.post(MANGOFY_API_URL, payload, {
            headers: {
                'Authorization': API_KEY,
                'Store-Code': STORE_CODE,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            }
        });

        res.json(response.data);
    } catch (error) {
        console.error('Erro ao criar PIX:', error.response ? error.response.data : error.message);
        res.status(500).json({
            error: 'Erro ao processar pagamento',
            details: error.response ? error.response.data : error.message
        });
    }
});

// Endpoint para verificar status do pagamento (opcional para polling no frontend)
app.get('/api/payment-status/:code', async (req, res) => {
    try {
        const { code } = req.params;
        const response = await axios.get(`${MANGOFY_API_URL}/${code}`, {
            headers: {
                'Authorization': API_KEY,
                'Store-Code': STORE_CODE,
                'Accept': 'application/json'
            }
        });
        res.json(response.data);
    } catch (error) {
        res.status(500).json({ error: 'Erro ao consultar status' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
