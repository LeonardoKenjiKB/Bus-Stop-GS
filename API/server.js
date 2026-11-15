
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

app.use(cors());
app.use(express.json());

const PORT = 3000;
const BASE_URL = 'https://api.olhovivo.sptrans.com.br/v2.1';
const TOKEN = process.env.SPTRANS_TOKEN?.trim();

let cookieSessao = '';

// AUTENTICAÇÃO NA SPTRANS
async function autenticar() {
  if (!TOKEN) {
    throw new Error('Token da SPTrans não configurado.');
  }

  const resposta = await fetch(
    `${BASE_URL}/Login/Autenticar?token=${encodeURIComponent(TOKEN)}`,
    {
      method: 'POST',
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!resposta.ok) {
    throw new Error(`Erro na autenticação: HTTP ${resposta.status}`);
  }

  const autenticado = await resposta.json();

  if (autenticado !== true) {
    throw new Error('A SPTrans recusou a autenticação.');
  }

  const cookies = resposta.headers.get('set-cookie');

  if (!cookies) {
    throw new Error('Cookie de sessão não recebido.');
  }

  cookieSessao = cookies.split(';')[0];

  console.log('Autenticação realizada com sucesso!');
}

// CONSULTAS À SPTRANS
async function consultarAPI(endpoint) {
  if (!cookieSessao) {
    await autenticar();
  }

  let resposta = await fetch(BASE_URL + endpoint, {
    headers: {
      Cookie: cookieSessao,
    },
    signal: AbortSignal.timeout(15000),
  });

  // Renova a sessão se a SPTrans negar o acesso.
  if (resposta.status === 401 || resposta.status === 403) {
    cookieSessao = '';
    await autenticar();

    resposta = await fetch(BASE_URL + endpoint, {
      headers: {
        Cookie: cookieSessao,
      },
      signal: AbortSignal.timeout(15000),
    });
  }

  if (!resposta.ok) {
    throw new Error(`Erro na consulta: HTTP ${resposta.status}`);
  }

  return await resposta.json();
}

// TRATAMENTO DE ERROS
function tratarErro(res, erro) {
  console.error('Erro na API:', erro.message);

  const timeout =
    erro.name === 'TimeoutError' ||
    erro.name === 'AbortError';

  res.status(timeout ? 504 : 500).json({
    erro: timeout
      ? 'A SPTrans demorou muito para responder.'
      : 'Não foi possível consultar a SPTrans.',
  });
}

// BUSCAR LINHAS
app.get('/linhas', async (req, res) => {
  try {
    const busca = String(req.query.busca || '').trim();

    if (!busca) {
      return res.status(400).json({
        erro: 'Informe uma linha para pesquisar.',
      });
    }

    console.log('Buscando linha:', busca);

    const linhas = await consultarAPI(
      `/Linha/Buscar?termosBusca=${encodeURIComponent(busca)}`
    );

    res.json(linhas);
  } catch (erro) {
    tratarErro(res, erro);
  }
});

// BUSCAR PONTOS DE UMA LINHA
app.get('/pontos/:codigoLinha', async (req, res) => {
  try {
    const codigoLinha = Number(req.params.codigoLinha);

    if (!Number.isInteger(codigoLinha) || codigoLinha <= 0) {
      return res.status(400).json({
        erro: 'Código da linha inválido.',
      });
    }

    console.log('Buscando pontos da linha:', codigoLinha);

    const pontos = await consultarAPI(
      `/Parada/BuscarParadasPorLinha?codigoLinha=${codigoLinha}`
    );

    res.json(pontos);
  } catch (erro) {
    tratarErro(res, erro);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor Bus Stop rodando na porta ${PORT}`);
});
