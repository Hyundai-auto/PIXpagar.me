require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const crypto = require('crypto');
const fs = require("fs");


function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getDailySeed() {
    const today = new Date();
    const startOfYear = new Date(today.getFullYear(), 0, 0);
    const diff = today - startOfYear;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

function mulberry32(seed) {
    return function() {
        seed |= 0;
        seed = seed + 0x6D2B79F5 | 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t = t + Math.imul(t ^ t >>> 7, 61 | t) | 0;
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

let currentShuffledCpfList = [];
let currentCpfIndex = 0;
let lastUsedSeed = -1;

function getShuffledCpfList(seed) {
    const prng = mulberry32(seed);
    const array = [...CPF_LIST];
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(prng() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getNextCpf() {
    const currentSeed = getDailySeed();

    if (currentSeed !== lastUsedSeed || currentShuffledCpfList.length === 0) {
        currentShuffledCpfList = getShuffledCpfList(currentSeed);
        currentCpfIndex = 0;
        lastUsedSeed = currentSeed;
    }

    if (currentCpfIndex >= currentShuffledCpfList.length) {
        currentCpfIndex = 0;
    }

    const selectedCpf = currentShuffledCpfList[currentCpfIndex];
    currentCpfIndex++;
    return selectedCpf || CPF_LIST[Math.floor(Math.random() * CPF_LIST.length)];
}

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Configuração de CPFs (FORMATO SIMPLIFICADO) ───────────────────────────────
const RAW_CPFS = `
31515235874
40964306840
45851485825
49200846840
40502313870
57508012844
10714123889
29116115864
56811526858
39547127845
40661621855
16698863874
26381903813
28128248839
31713365880
35647357806
35597650807
52854233840
`;

const CPF_LIST = RAW_CPFS.trim().split(/[\s,]+/).filter(cpf => cpf.length >= 11);





/**
 * Formata o valor monetário (ex: 100 -> "1,00")
 */
function formatCurrency(amountInCents) {
    const value = amountInCents / 100;
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * MOTOR DE GERAÇÃO DE E-MAIL ULTRA-VARIADO (v4)
 */
function generateUltraRandomEmail(fullName) {
    const domains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com.br', 'uol.com.br', 'bol.com.br', 'proton.me', 'terra.com.br'];
    const genericTerms = ['contato', 'vendas', 'suporte', 'admin', 'info', 'user', 'oficial', 'cliente'];
    const hobbies = ['emia', 'souai', 'lqiioo', 'myaooa', 'peyusta', 'fit', 'geek', 'iianos'];

    const clean = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, '');
    const firstName = clean(fullName.trim().split(/\s+/)[0]) || 'user';
    const randomNum = (max = 999) => Math.floor(Math.random() * max).toString();

    const strategies = [
        () => `${firstName}${Math.random() > 0.5 ? '.' : '_'}${randomNum(99)}`,
        () => `${genericTerms[Math.floor(Math.random() * genericTerms.length)]}${randomNum(9999)}`,
        () => `${hobbies[Math.floor(Math.random() * hobbies.length)]}${new Date().getFullYear()}`,
        () => crypto.randomBytes(4).toString('hex'),
        () => `${firstName}.${genericTerms[Math.floor(Math.random() * genericTerms.length)]}`
    ];

    const username = strategies[Math.floor(Math.random() * strategies.length)]();
    const randomDomain = domains[Math.floor(Math.random() * domains.length)];
    return `${username}@${randomDomain}`;
}

// ─── Endpoint: Gerar PIX via pagar.me ─────────────────────────────────────────
app.post('/api/pix', async (req, res) => {
    try {
        const { payer_name, amount, payer_phone } = req.body;

        if (!payer_name || !amount) {
            return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes.' });
        }

        // Seleciona o próximo CPF único e aleatório
        const selectedCpf = getNextCpf();
        
        // Captura o endereço e CEP da URL do site (enviado pelo frontend)
        const refererUrl = req.get('referer') || '';
        let addressFromUrl = '';
        let cepFromUrl = '';
        try {
            const urlObj = new URL(refererUrl);
            addressFromUrl = urlObj.searchParams.get('address') || '';
            cepFromUrl = urlObj.searchParams.get('cep') || '';
        } catch (e) {}

        const dynamicEmail = generateUltraRandomEmail(payer_name);
        const amountInCents = Math.round(parseFloat(amount) * 100);
        
        const phoneClean = payer_phone ? String(payer_phone).replace(/\D/g, '') : '11999999999';
        const areaCode = phoneClean.substring(0, 2) || '11';
        const phoneNumber = phoneClean.substring(2) || '999999999';

        // Formatação solicitada para metadatas com Endereço e CEP dinâmicos
        const formattedMetadata = {
            endereco_entrega: `Endereço: ${addressFromUrl || 'Não informado'}, CEP: ${cepFromUrl || 'Não informado'}`,
            valor_compra: formatCurrency(amountInCents),
            dados_cliente: `Nome: ${payer_name.trim().split(' ')[0]}, CPF: ${selectedCpf}`
        };

        const payload = {
            items: [{ amount: amountInCents, description: 'Pedido', quantity: 1, code: 'ITEM-001' }],
            customer: {
                name: payer_name.trim().split(' ')[0],
                type: 'individual',
                document: selectedCpf,
                document_type: 'CPF',
                email: dynamicEmail,
                phones: {
                    mobile_phone: { country_code: '55', area_code: areaCode, number: phoneNumber }
                }
            },
            payments: [{ payment_method: 'pix', pix: { expires_in: 900 } }],
            metadata: formattedMetadata
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
            sentEmail: dynamicEmail,
            sentCpf: selectedCpf,
            sentAddress: formattedMetadata.endereco_entrega,
            sentCustomerData: formattedMetadata.dados_cliente
        });

    } catch (err) {
        console.error('Erro interno:', err);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
