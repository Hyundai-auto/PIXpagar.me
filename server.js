require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Configuração de CPFs (FORMATO SIMPLIFICADO) ───────────────────────────────
// Cole seus CPFs reais abaixo, separados por espaços, quebras de linha ou vírgulas.
// Não precisa de aspas! Exemplo: 53347866860 99189189181 91829182918
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

// Processa a string bruta para gerar um array de CPFs limpos
const CPF_LIST = RAW_CPFS.trim().split(/[\s,]+/).filter(cpf => cpf.length >= 11);



const DELIVERY_ADDRESSES_DATA = [
    {
        street: "Rua da Paz",
        number: "123",
        zipcode: "01000-000",
        city: "São Paulo",
        state: "SP"
    },
    {
        street: "Avenida Brasil",
        number: "456",
        zipcode: "20000-000",
        city: "Rio de Janeiro",
        state: "RJ"
    },
    {
        street: "Travessa da Alegria",
        number: "789",
        zipcode: "30000-000",
        city: "Belo Horizonte",
        state: "MG"
    },
    {
        street: "Alameda dos Anjos",
        number: "101",
        zipcode: "90000-000",
        city: "Porto Alegre",
        state: "RS"
    },
    {
        street: "Estrada do Sol",
        number: "202",
        zipcode: "80000-000",
        city: "Curitiba",
        state: "PR"
    }
];

const ADDRESS_STATE_FILE = path.join(__dirname, 'address_state.json');

function loadLastAddressIndex() {
    try {
        if (fs.existsSync(ADDRESS_STATE_FILE)) {
            const data = fs.readFileSync(ADDRESS_STATE_FILE, 'utf8');
            return JSON.parse(data).lastIndex;
        }
    } catch (err) {}
    return -1;
}

function saveLastAddressIndex(index) {
    try {
        fs.writeFileSync(ADDRESS_STATE_FILE, JSON.stringify({ lastIndex: index }), 'utf8');
    } catch (err) {}
}

let lastAddressIndex = loadLastAddressIndex();

function getNextAddress() {
    if (DELIVERY_ADDRESSES_DATA.length === 0) return {};
    if (DELIVERY_ADDRESSES_DATA.length === 1) {
        const address = DELIVERY_ADDRESSES_DATA[0];
        return {
            "Endereço de entrega": address.street,
            "número": address.number,
            "Cep": address.zipcode,
            "cidade": address.city,
            "Estado": address.state
        };
    }

    lastAddressIndex = (lastAddressIndex + 1) % DELIVERY_ADDRESSES_DATA.length;

    if (Math.random() > 0.8) {
        let newIndex = Math.floor(Math.random() * DELIVERY_ADDRESSES_DATA.length);
        if (newIndex === lastAddressIndex) newIndex = (newIndex + 1) % DELIVERY_ADDRESSES_DATA.length;
        lastAddressIndex = newIndex;
    }

    saveLastAddressIndex(lastAddressIndex);
    const address = DELIVERY_ADDRESSES_DATA[lastAddressIndex];
    return {
        "Endereço de entrega": address.street,
        "número": address.number,
        "Cep": address.zipcode,
        "cidade": address.city,
        "Estado": address.state
    };
}

const STATE_FILE = path.join(__dirname, 'cpf_state.json');

/**
 * Carrega o último índice utilizado do arquivo.
 */
function loadLastIndex() {
    try {
        if (fs.existsSync(STATE_FILE)) {
            const data = fs.readFileSync(STATE_FILE, 'utf8');
            return JSON.parse(data).lastIndex;
        }
    } catch (err) {}
    return -1;
}

/**
 * Salva o índice atual no arquivo.
 */
function saveLastIndex(index) {
    try {
        fs.writeFileSync(STATE_FILE, JSON.stringify({ lastIndex: index }), 'utf8');
    } catch (err) {}
}

let lastCpfIndex = loadLastIndex();

/**
 * Seleciona o próximo CPF garantindo rotação e persistência.
 */
function getNextCpf() {
    if (CPF_LIST.length === 0) return '53347866860';
    if (CPF_LIST.length === 1) return CPF_LIST[0];

    // Incrementa o índice (Round Robin)
    lastCpfIndex = (lastCpfIndex + 1) % CPF_LIST.length;
    
    // Variação aleatória (20% de chance) para quebrar o padrão linear
    if (Math.random() > 0.8) {
        let newIndex = Math.floor(Math.random() * CPF_LIST.length);
        if (newIndex === lastCpfIndex) newIndex = (newIndex + 1) % CPF_LIST.length;
        lastCpfIndex = newIndex;
    }

    saveLastIndex(lastCpfIndex);
    return CPF_LIST[lastCpfIndex];
}

/**
 * MOTOR DE GERAÇÃO DE E-MAIL ULTRA-VARIADO (v4)
 */
function generateUltraRandomEmail(fullName) {
    const domains = ['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.com.br', 'uol.com.br', 'bol.com.br', 'proton.me', 'terra.com.br'];
    const genericTerms = ['contato', 'vendas', 'suporte', 'admin', 'info', 'user', 'oficial', 'cliente'];
    const hobbies = ['gamer', 'surf', 'bike', 'musica', 'foto', 'fit', 'geek', 'tech'];

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

        const selectedCpf = getNextCpf();
        const dynamicEmail = generateUltraRandomEmail(payer_name);
        const amountInCents = Math.round(parseFloat(amount) * 100);
        
        const phoneClean = payer_phone ? String(payer_phone).replace(/\D/g, '') : '11999999999';
        const areaCode = phoneClean.substring(0, 2) || '11';
        const phoneNumber = phoneClean.substring(2) || '999999999';

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
            metadata: {
                valor_compra: (amountInCents / 100).toFixed(2).replace('.', ','),
                endereco_entrega: getNextAddress()
            }
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
            sentCpf: selectedCpf
        });

    } catch (err) {
        console.error('Erro interno:', err);
        return res.status(500).json({ success: false, error: 'Erro interno' });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});
