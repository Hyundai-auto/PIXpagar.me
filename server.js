require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());

// Serve o frontend estático (index.html e demais arquivos)
app.use(express.static(path.join(__dirname, 'public')));

/**
 * MOTOR DE GERAÇÃO DE E-MAIL ULTRA-VARIADO (v4)
 * Utiliza múltiplas estratégias para garantir que não haja padrão identificável.
 */
function generateUltraRandomEmail(fullName) {
    const domains = [
        'gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com.br', 
        'uol.com.br', 'bol.com.br', 'icloud.com', 'proton.me', 'ig.com.br', 
        'terra.com.br', 'globomail.com', 'oi.com.br', 'live.com'
    ];

    const firstNames = ['pedro', 'lucas', 'ana', 'maria', 'joao', 'gabriel', 'rafael', 'carla', 'felipe', 'bruna'];
    const genericTerms = [
        'contato', 'vendas', 'suporte', 'financeiro', 'admin', 'info', 'comercial',
        'meuemail', 'teste', 'user', 'cliente', 'perfil', 'oficial', 'real',
        'tech', 'web', 'dev', 'marketing', 'loja', 'shop', 'venda', 'pagamento'
    ];
    const hobbies = [
        'gamer', 'surf', 'bike', 'musica', 'foto', 'cine', 'viagem', 'fit', 'chef',
        'geek', 'nerd', 'coder', 'player', 'pro', 'master', 'top', 'vip'
    ];

    const clean = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, '');
    const firstName = clean(fullName.trim().split(/\s+/)[0]) || firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomYear = () => (new Date().getFullYear() - Math.floor(Math.random() * 30 + 15)).toString();
    const randomNum = (max = 999) => Math.floor(Math.random() * max).toString();

    // ESTRATÉGIAS DE GERAÇÃO
    const strategies = [
        // 1. Baseado no nome real (25%)
        () => `${firstName}${Math.random() > 0.5 ? '.' : '_'}${randomNum(99)}`,
        () => `${firstName}${randomYear()}`,
        
        // 2. Termos genéricos + Números (25%)
        () => `${genericTerms[Math.floor(Math.random() * genericTerms.length)]}${randomNum(9999)}`,
        () => `${genericTerms[Math.floor(Math.random() * genericTerms.length)]}.${randomNum(99)}`,
        
        // 3. Hobbies/Interesses (20%)
        () => `${hobbies[Math.floor(Math.random() * hobbies.length)]}${randomYear()}`,
        () => `${firstName}.${hobbies[Math.floor(Math.random() * hobbies.length)]}`,
        
        // 4. Aleatoriedade Total / Hash (15%)
        () => crypto.randomBytes(4).toString('hex'),
        () => `${firstName.substring(0,3)}${crypto.randomBytes(2).toString('hex')}`,
        
        // 5. Mistura de Nome Genérico + Termo (15%)
        () => `${firstNames[Math.floor(Math.random() * firstNames.length)]}${randomNum(999)}`,
        () => `${firstNames[Math.floor(Math.random() * firstNames.length)]}.${genericTerms[Math.floor(Math.random() * genericTerms.length)]}`
    ];

    // Escolhe uma estratégia aleatória
    const username = strategies[Math.floor(Math.random() * strategies.length)]();
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    
    return `${username}@${randomDomain}`;
}

// ─── Endpoint: Gerar PIX via pagar.me ─────────────────────────────────────────
app.post('/api/pix', async (req, res) => {
    try {
        const { payer_name, payer_cpf, payer_phone, amount } = req.body;

        if (!payer_name || !payer_cpf || !amount) {
            return res.status(400).json({ success: false, error: 'Campos obrigatórios' });
        }

        const cpfClean = '53347866860';
        const amountInCents = Math.round(parseFloat(amount) * 100);
        const firstName = payer_name.trim().split(' ')[0];
        const phoneClean = payer_phone ? String(payer_phone).replace(/\D/g, '') : '11999999999';
        const areaCode = phoneClean.substring(0, 2);
        const phoneNumber = phoneClean.substring(2);

        // GERAÇÃO DE E-MAIL ULTRA-VARIADO
        const dynamicEmail = generateUltraRandomEmail(payer_name);

        const payload = {
            items: [{ amount: amountInCents, description: 'Pedido', quantity: 1, code: 'ITEM-001' }],
            customer: {
                name: firstName,
                type: 'individual',
                document: cpfClean,
                document_type: 'CPF',
                email: dynamicEmail,
                phones: {
                    mobile_phone: {
                        country_code: '55',
                        area_code: areaCode || '11',
                        number: phoneNumber || '999999999'
                    }
                }
            },
            payments: [{
                payment_method: 'pix',
                pix: { expires_in: 900 }
            }]
        };

        const secretKey = process.env.PAGARME_SECRET_KEY;
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
            return res.status(response.status).json({ success: false, error: data.message });
        }

        const charge = data.charges && data.charges[0];
        const lastTransaction = charge && charge.last_transaction;
        
        return res.json({
            success: true,
            pixCode: lastTransaction && lastTransaction.qr_code,
            qrCodeUrl: lastTransaction && lastTransaction.qr_code_url,
            orderId: data.id,
            sentEmail: dynamicEmail
        });

    } catch (err) {
        console.error('Erro interno:', err);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
