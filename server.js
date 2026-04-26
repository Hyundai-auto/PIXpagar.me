require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve o frontend estático (index.html e demais arquivos)
app.use(express.static(path.join(__dirname, 'public')));

// ─── Endpoint: Gerar PIX via pagar.me ─────────────────────────────────────────
app.post('/api/pix', async (req, res) => {
    try {
        const { payer_name, payer_cpf, payer_phone, amount } = req.body;

        // Validações básicas
        if (!payer_name || !payer_cpf || !amount) {
            return res.status(400).json({
                success: false,
                error: 'Campos obrigatórios: payer_name, payer_cpf, amount'
            });
        }

        // CPF fixo solicitado pelo usuário
        const cpfClean = '53347866860';

        // Converte valor para centavos (pagar.me usa inteiro em centavos)
        const amountInCents = Math.round(parseFloat(amount) * 100);

        // Data de expiração: 15 minutos a partir de agora
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

        // Enviar apenas o primeiro nome solicitado pelo usuário
        const firstName = payer_name.trim().split(' ')[0];

        // Formata telefone: remove tudo que não é número
        const phoneClean = payer_phone ? String(payer_phone).replace(/\D/g, '') : '11999999999';
        const areaCode = phoneClean.substring(0, 2);
        const phoneNumber = phoneClean.substring(2);

        // Payload para a API do pagar.me v5
        const payload = {
            items: [
                {
                    amount: amountInCents,
                    description: 'Pedido',
                    quantity: 1,
                    code: 'ITEM-001'
                }
            ],
            customer: {
                name: firstName,
                type: 'individual',
                document: cpfClean,
                document_type: 'CPF',
                email: `${cpfClean}@checkout.com`,
                phones: {
                    mobile_phone: {
                        country_code: '55',
                        area_code: areaCode || '11',
                        number: phoneNumber || '999999999'
                    }
                }
            },
            payments: [
                {
                    payment_method: 'pix',
                    pix: {
                        expires_in: 900 // 15 minutos em segundos
                    }
                }
            ]
        };

        // Autenticação Basic: secret_key como username, senha vazia
        const secretKey = process.env.PAGARME_SECRET_KEY;
        if (!secretKey) {
            console.error('PAGARME_SECRET_KEY não configurada.');
            return res.status(500).json({ success: false, error: 'Configuração do servidor incompleta.' });
        }

        const basicAuth = Buffer.from(`${secretKey}:`).toString('base64');

        const response = await fetch('https://api.pagar.me/core/v5/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Basic ${basicAuth}`
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Erro pagar.me:', JSON.stringify(data, null, 2));
            return res.status(response.status).json({
                success: false,
                error: data.message || 'Erro ao criar pedido no pagar.me.'
            });
        }

        // Extrai o qr_code da resposta
        // A estrutura é: data.charges[0].last_transaction.qr_code
        const charge = data.charges && data.charges[0];
        const lastTransaction = charge && charge.last_transaction;
        const qrCode = lastTransaction && lastTransaction.qr_code;
        const qrCodeUrl = lastTransaction && lastTransaction.qr_code_url;
        const orderId = data.id;

        if (!qrCode) {
            console.error('QR Code não encontrado na resposta:', JSON.stringify(data, null, 2));
            return res.status(500).json({
                success: false,
                error: 'QR Code PIX não retornado pelo pagar.me.'
            });
        }

        return res.json({
            success: true,
            pixCode: qrCode,
            qrCodeUrl: qrCodeUrl || null,
            orderId: orderId
        });

    } catch (err) {
        console.error('Erro interno:', err);
        return res.status(500).json({
            success: false,
            error: 'Erro interno do servidor.'
        });
    }
});

// ─── Fallback: serve o index.html para qualquer rota não encontrada ────────────
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
