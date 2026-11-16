Bus Stop — Desça no ponto certo.


Sobre o projeto

O **Bus Stop** surgiu com o objetivo de tornar o deslocamento por transporte público mais simples, prático e tranquilo.

Durante uma viagem de ônibus, é comum que passageiros precisem acompanhar constantemente sua localização para não perder o ponto de descida, especialmente em trajetos desconhecidos.

Pensando nisso, desenvolvemos uma aplicação que permite ao usuário pesquisar sua linha de ônibus, selecionar o ponto em que deseja descer e acompanhar a distância até o destino por meio do GPS do celular.

Ao se aproximar do ponto selecionado, o aplicativo emite alertas para ajudar o passageiro a se preparar para a descida.

**Nossa proposta é simples: você aproveita o trajeto, e o Bus Stop ajuda a lembrar onde descer.**

Funcionalidades

- **Busca de linhas:** pesquisa de linhas reais de ônibus da cidade de São Paulo.
- **Seleção do sentido:** escolha do sentido da linha desejada.
- **Consulta de pontos:** visualização dos pontos de ônibus associados à linha selecionada.
- **Definição do destino:** escolha do ponto em que o passageiro pretende descer.
- **Acompanhamento por GPS:** monitoramento da localização do usuário durante a viagem.
- **Distância até o destino:** exibição da distância aproximada, em metros ou quilômetros.
- **Alertas de proximidade:** avisos automáticos quando o usuário estiver próximo do ponto.
- **Notificações e vibração:** recursos para chamar a atenção do passageiro.
- **Teste de alerta:** botão que permite demonstrar o funcionamento do aviso.
- **Encerramento da viagem:** opção para interromper o monitoramento.

Tecnologias utilizadas

| Tecnologia | Utilização |
|---|---|
| React Native | Desenvolvimento da aplicação mobile |
| Expo | Ambiente de desenvolvimento e execução |
| JavaScript | Linguagem de programação |
| Node.js | Execução do backend |
| Express | Criação das rotas da API |
| API Olho Vivo — SPTrans | Consulta de linhas e pontos de ônibus |
| expo-location | Acesso à localização GPS |
| expo-notifications | Notificações locais |
| React Native Vibration | Alertas por vibração |

Integração com a SPTrans

O Bus Stop utiliza a **API Olho Vivo da SPTrans** para obter informações reais sobre linhas e pontos de ônibus de São Paulo.

Para realizar as consultas, foi desenvolvido um backend em Node.js com Express, responsável por autenticar as requisições e disponibilizar os dados ao aplicativo.

Endpoints do backend

**Pesquisar linhas**

```http
GET /linhas?busca=875A
```

Retorna as linhas correspondentes ao termo pesquisado.

**Consultar pontos de uma linha**

```http
GET /pontos/:codigoLinha
```

Retorna os pontos associados ao código da linha selecionada.

A chave de acesso à SPTrans permanece armazenada no backend, por meio de uma variável de ambiente.

Como funciona

O fluxo principal do aplicativo é composto por cinco etapas:

1. O passageiro pesquisa a linha de ônibus.
2. Seleciona o sentido da viagem.
3. Escolhe o ponto de descida.
4. Inicia o monitoramento da localização.
5. Recebe alertas ao se aproximar do destino.

Alertas de proximidade

O aplicativo utiliza as coordenadas GPS do usuário e do ponto selecionado para calcular a distância aproximada entre eles.

Foram configurados dois alertas:

- **500 metros:** aviso de aproximação do ponto.
- **200 metros:** aviso para o passageiro se preparar para descer.

Os alertas automáticos consideram a precisão estimada da localização e são enviados uma vez por viagem.

**Observação:** a distância é calculada em linha reta, e não pelo percurso das ruas. Portanto, os alertas são estimativas de proximidade, não uma previsão exata da chegada do ônibus.

Estrutura do projeto

```text
bus-stop/
├── API/
│   ├── server.js
│   ├── package.json
│   └── package-lock.json
├── assets/
├── App.js
├── index.js
├── app.json
├── package.json
├── package-lock.json
├── .gitignore
├── integrantes.txt
└── README.md
```

A pasta `API` contém o servidor de integração com a SPTrans.

O arquivo `App.js` reúne a interface e as principais funcionalidades do aplicativo.

Como executar o projeto

Pré-requisitos

Para executar o Bus Stop, é necessário ter:

- Node.js e npm instalados.
- Expo Go no celular para testes mobile.
- Acesso à internet.
- Token de acesso à API Olho Vivo da SPTrans.

1. Clonar o repositório

```bash
git clone URL_DO_REPOSITORIO
cd bus-stop
```

Substitua `URL_DO_REPOSITORIO` pelo endereço deste repositório no GitHub.

2. Instalar as dependências do aplicativo

Na pasta `bus-stop`, execute:

```bash
npm install
```

3. Configurar o backend

Entre na pasta `API`:

```bash
cd API
npm install
```

Crie um arquivo chamado `.env` dentro de `API` e adicione:

```env
SPTRANS_TOKEN=SUA_CHAVE_SPTRANS
```

Substitua `SUA_CHAVE_SPTRANS` pelo seu token da API Olho Vivo.

**Importante:** não publique o arquivo `.env` no GitHub.

4. Iniciar o backend

Ainda na pasta `API`, execute:

```bash
node server.js
```

O servidor ficará disponível na porta `3000`.

5. Configurar o acesso pelo celular

Para executar o aplicativo em um dispositivo físico, descubra o endereço IPv4 do computador.

No Windows:

```bash
ipconfig
```

No arquivo `App.js`, configure a constante:

```javascript
const IP_COMPUTADOR = 'SEU_IP_LOCAL';
```

O computador e o celular devem estar conectados à mesma rede Wi-Fi. A porta 3000 também precisa estar acessível na rede local.

6. Iniciar o aplicativo

Em outro terminal, na pasta principal `bus-stop`, execute:

```bash
npx expo start -c
```

Escaneie o QR Code usando o Expo Go ou a câmera do celular, conforme o dispositivo.

Para executar no navegador:

```bash
npm run web
```

O backend precisa permanecer em execução durante o uso do aplicativo.

Testes realizados

O aplicativo foi testado em um iPhone utilizando o Expo Go.

Foram verificados:

- Abertura da aplicação.
- Pesquisa de linhas reais.
- Seleção de sentido e ponto de descida.
- Acesso à localização GPS.
- Exibição da distância até o destino.
- Funcionamento do botão de teste de alerta e vibração.
- Encerramento do acompanhamento.

A execução em dispositivo físico permitiu verificar a integração entre o aplicativo React Native, o backend e os recursos nativos do celular.

Limitações e melhorias futuras

O Bus Stop é um protótipo acadêmico e possui algumas limitações:

- O monitoramento GPS é realizado com o aplicativo em primeiro plano.
- O cálculo de distância utiliza coordenadas geográficas em linha reta.
- A disponibilidade dos dados depende da API Olho Vivo.
- O aplicativo não identifica automaticamente se o usuário está dentro de um ônibus ou se a linha selecionada corresponde ao veículo embarcado.
- Os alertas podem variar conforme a precisão do GPS e o percurso realizado.

Como possibilidades de evolução, destacam