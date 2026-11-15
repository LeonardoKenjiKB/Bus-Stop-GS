
import React, { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';

import {
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';

// Substitua pelo IP do computador ao testar no celular.
const IP_COMPUTADOR = '192.168.15.13';

const API_URL = Platform.OS === 'web'
  ? 'http://localhost:3000'
  : `http://${IP_COMPUTADOR}:3000`;

// Configuração das notificações
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

// Calcula a distância entre duas coordenadas em metros
function calcularDistancia(lat1, lon1, lat2, lon2) {
  const rad = Math.PI / 180;
  const deltaLat = (lat2 - lat1) * rad;
  const deltaLon = (lon2 - lon1) * rad;

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1 * rad) *
    Math.cos(lat2 * rad) *
    Math.sin(deltaLon / 2) ** 2;

  return 6371000 * 2 *
    Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Consulta o backend com limite de tempo
async function consultar(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const resposta = await fetch(url, {
      signal: controller.signal,
    });

    if (!resposta.ok) {
      throw new Error(`HTTP ${resposta.status}`);
    }

    return await resposta.json();
  } finally {
    clearTimeout(timeout);
  }
}

export default function App() {
  const [busca, setBusca] = useState('');
  const [linhas, setLinhas] = useState([]);
  const [linha, setLinha] = useState(null);
  const [pontos, setPontos] = useState([]);
  const [ponto, setPonto] = useState(null);

  const [carregando, setCarregando] = useState(false);
  const [monitorando, setMonitorando] = useState(false);
  const [distancia, setDistancia] = useState(null);
  const [precisao, setPrecisao] = useState(null);
  const [erro, setErro] = useState('');

  const gps = useRef(null);
  const notificacaoPermitida = useRef(false);
  const avisos = useRef({
    perto: false,
    chegada: false,
  });
  const viagemAtiva = useRef(false);

  // Exibe mensagens no navegador ou celular
  function mostrarMensagem(mensagem) {
    if (Platform.OS === 'web') {
      window.alert(mensagem);
    } else {
      Alert.alert('Bus Stop', mensagem);
    }
  }

  // Envia notificação e vibração
  async function enviarAlerta(mensagem) {
    if (Platform.OS === 'web') {
      window.alert(mensagem);
      return;
    }

    Vibration.vibrate(600);

    if (notificacaoPermitida.current) {
      try {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: 'Bus Stop',
            body: mensagem,
            sound: 'default',
          },
          trigger: null,
        });
      } catch (error) {
        console.log('Erro ao notificar:', error);
      }
    }

    Alert.alert('Bus Stop', mensagem);
  }

  // Busca as linhas reais da SPTrans
  async function buscarLinhas() {
    if (!busca.trim() || carregando) return;

    setCarregando(true);
    setErro('');
    setLinhas([]);
    setLinha(null);
    setPontos([]);
    setPonto(null);

    try {
      const dados = await consultar(
        `${API_URL}/linhas?busca=${encodeURIComponent(busca.trim())}`
      );

      if (!Array.isArray(dados)) {
        throw new Error('Formato de linhas inválido');
      }

      setLinhas(dados);
    } catch (error) {
      console.log('Erro na busca:', error);
      setErro(
        'Não foi possível buscar linhas. Verifique se a API está ligada.'
      );
    } finally {
      setCarregando(false);
    }
  }

  // Carrega os pontos da linha selecionada
  async function selecionarLinha(item) {
    if (carregando) return;

    setCarregando(true);
    setErro('');
    setLinha(null);
    setPonto(null);
    setPontos([]);

    try {
      const dados = await consultar(
        `${API_URL}/pontos/${item.cl}`
      );

      if (!Array.isArray(dados)) {
        throw new Error('Formato de pontos inválido');
      }

      const pontosValidos = dados
        .filter((p) =>
          p.py != null &&
          p.px != null &&
          Number.isFinite(Number(p.py)) &&
          Number.isFinite(Number(p.px))
        )
        .map((p) => ({
          codigo: p.cp,
          nome: p.np,
          endereco: p.ed,
          latitude: Number(p.py),
          longitude: Number(p.px),
        }));

      setLinha(item);
      setPontos(pontosValidos);
    } catch (error) {
      console.log('Erro nos pontos:', error);
      setErro(
        'Não foi possível carregar os pontos dessa linha.'
      );
    } finally {
      setCarregando(false);
    }
  }

  // Atualiza a distância do passageiro até o destino
  function atualizarLocalizacao(posicao, destino) {
    if (!viagemAtiva.current) return;

    const { latitude, longitude, accuracy } = posicao.coords;

    const metros = calcularDistancia(
      latitude,
      longitude,
      destino.latitude,
      destino.longitude
    );

    setDistancia(Math.round(metros));
    setPrecisao(accuracy);

    // Não envia alertas com GPS pouco preciso
    if (accuracy == null || accuracy > 80) return;

    // Alerta de chegada
    if (metros <= 200 && !avisos.current.chegada) {
      avisos.current.chegada = true;
      avisos.current.perto = true;

      enviarAlerta(
        'Seu ponto está chegando! Prepare-se para descer.'
      );

    // Alerta de aproximação
    } else if (metros <= 500 && !avisos.current.perto) {
      avisos.current.perto = true;

      enviarAlerta(
        'Você está a menos de 500 metros do ponto de descida!'
      );
    }
  }

  // Inicia o acompanhamento por GPS
  async function iniciarViagem() {
    if (!ponto || carregando) return;

    setCarregando(true);
    setErro('');

    try {
      // Solicita permissão para acessar o GPS
      const permissaoGPS =
        await Location.requestForegroundPermissionsAsync();

      if (permissaoGPS.status !== 'granted') {
        mostrarMensagem(
          'Permita o acesso à localização para iniciar a viagem.'
        );
        return;
      }

      // Solicita permissão para notificações
      notificacaoPermitida.current = false;

      if (Platform.OS !== 'web') {
        try {
          if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync(
              'bus-stop',
              {
                name: 'Alertas de descida',
                importance:
                  Notifications.AndroidImportance.HIGH,
              }
            );
          }

          const permissao =
            await Notifications.requestPermissionsAsync();

          notificacaoPermitida.current = permissao.granted;

        } catch (error) {
          console.log(
            'Notificações indisponíveis:',
            error
          );
        }
      }

      avisos.current = {
        perto: false,
        chegada: false,
      };

      // Identifica a localização inicial
      const posicao =
        await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

      viagemAtiva.current = true;
      setMonitorando(true);

      atualizarLocalizacao(posicao, ponto);

      // Acompanha o deslocamento continuamente
      gps.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 3000,
        },
        (novaPosicao) => {
          atualizarLocalizacao(novaPosicao, ponto);
        },
        (mensagem) => {
          console.log(
            'Erro no acompanhamento:',
            mensagem
          );
          setErro(
            'O GPS não conseguiu atualizar a localização.'
          );
        }
      );

    } catch (error) {
      console.log('Erro ao iniciar GPS:', error);

      viagemAtiva.current = false;
      setMonitorando(false);

      if (gps.current) {
        gps.current.remove();
        gps.current = null;
      }

      setErro(
        'Não foi possível iniciar o acompanhamento por GPS.'
      );
    } finally {
      setCarregando(false);
    }
  }

  // Encerra a viagem
  function encerrarViagem() {
    viagemAtiva.current = false;

    if (gps.current) {
      gps.current.remove();
      gps.current = null;
    }

    setMonitorando(false);
    setDistancia(null);
    setPrecisao(null);

    avisos.current = {
      perto: false,
      chegada: false,
    };
  }

  // Interrompe o GPS ao desmontar o componente
  useEffect(() => {
    return () => {
      viagemAtiva.current = false;

      if (gps.current) {
        gps.current.remove();
      }
    };
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.conteudo}
    >
      <Text style={styles.logo}>bus stop.</Text>

      <Text style={styles.titulo}>
        Desça no ponto certo.
      </Text>

      <Text style={styles.descricao}>
        Escolha sua linha e o ponto de descida.
        Nós avisamos quando estiver chegando.
      </Text>

      {!monitorando ? (
        <View>
          <Text style={styles.label}>
            Qual é sua linha?
          </Text>

          <TextInput
            style={styles.input}
            placeholder="Ex.: 875A"
            value={busca}
            onChangeText={(texto) => {
              setBusca(texto);
              setLinhas([]);
              setLinha(null);
              setPontos([]);
              setPonto(null);
              setErro('');
            }}
          />

          <TouchableOpacity
            style={styles.botao}
            onPress={buscarLinhas}
            disabled={carregando}
          >
            <Text style={styles.textoBotao}>
              Buscar linha
            </Text>
          </TouchableOpacity>

          {carregando && (
            <ActivityIndicator
              color="#F97316"
              style={styles.espaco}
            />
          )}

          {linhas.length > 0 && !linha && (
            <View>
              <Text style={styles.label}>
                Selecione o sentido
              </Text>

              {linhas.map((item) => (
                <TouchableOpacity
                  key={String(item.cl)}
                  style={styles.opcao}
                  onPress={() => selecionarLinha(item)}
                  disabled={carregando}
                >
                  <Text style={styles.opcaoTitulo}>
                    {item.lt}-{item.tl}
                  </Text>

                  <Text style={styles.textoSecundario}>
                    Sentido {item.sl} — {item.tp} / {item.ts}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {linha && (
            <View>
              <Text style={styles.destaque}>
                Linha selecionada: {linha.lt}-{linha.tl}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setLinha(null);
                  setPonto(null);
                  setPontos([]);
                }}
              >
                <Text style={styles.link}>
                  Trocar sentido
                </Text>
              </TouchableOpacity>

              <Text style={styles.label}>
                Onde você vai descer?
              </Text>

              {pontos.length === 0 && !carregando && (
                <Text style={styles.textoSecundario}>
                  Nenhum ponto disponível para esta opção.
                </Text>
              )}

              {pontos.map((item) => (
                <TouchableOpacity
                  key={String(item.codigo)}
                  style={[
                    styles.opcao,
                    ponto?.codigo === item.codigo &&
                      styles.opcaoAtiva,
                  ]}
                  onPress={() => setPonto(item)}
                >
                  <Text style={styles.opcaoTitulo}>
                    {item.nome}
                  </Text>

                  <Text style={styles.textoSecundario}>
                    {item.endereco}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {ponto && (
            <TouchableOpacity
              style={styles.botao}
              onPress={iniciarViagem}
              disabled={carregando}
            >
              <Text style={styles.textoBotao}>
                {carregando
                  ? 'Localizando...'
                  : 'Iniciar viagem'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitulo}>
            Viagem em andamento
          </Text>

          <Text style={styles.textoSecundario}>
            Linha: {linha.lt}-{linha.tl}
          </Text>

          <Text style={styles.textoSecundario}>
            Destino: {ponto.nome}
          </Text>

          <Text style={styles.distancia}>
            {distancia === null
              ? 'Localizando...'
              : distancia >= 1000
                ? `${(distancia / 1000).toFixed(2)} km`
                : `${distancia} m`}
          </Text>

          <Text style={styles.textoSecundario}>
            Distância aproximada em linha reta
          </Text>

          {precisao != null && (
            <Text style={styles.textoSecundario}>
              Precisão estimada do GPS: {Math.round(precisao)} m
            </Text>
          )}

          <TouchableOpacity
            style={styles.botaoTeste}
            onPress={() =>
              enviarAlerta('Teste: seu ponto está chegando!')
            }
          >
            <Text style={styles.textoBotao}>
              Testar alerta
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.botaoEncerrar}
            onPress={encerrarViagem}
          >
            <Text style={styles.textoEncerrar}>
              Encerrar viagem
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {!!erro && (
        <Text style={styles.erro}>
          {erro}
        </Text>
      )}

      <Text style={styles.rodape}>
        Dados de transporte: SPTrans
      </Text>
    </ScrollView>
  );
}

// ESTILOS DO APLICATIVO
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF9F4',
  },

  conteudo: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    justifyContent: 'center',
    padding: 28,
  },

  logo: {
    color: '#EA580C',
    fontSize: 25,
    fontWeight: 'bold',
    marginBottom: 30,
  },

  titulo: {
    fontSize: 34,
    fontWeight: 'bold',
    color: '#292524',
    marginBottom: 15,
  },

  descricao: {
    fontSize: 15,
    color: '#78716C',
    lineHeight: 24,
    marginBottom: 28,
  },

  label: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#44403C',
    marginTop: 20,
    marginBottom: 10,
  },

  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    padding: 15,
    fontSize: 15,
  },

  botao: {
    backgroundColor: '#F97316',
    padding: 17,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 15,
  },

  textoBotao: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },

  opcao: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FED7AA',
    borderRadius: 10,
    padding: 15,
    marginBottom: 10,
  },

  opcaoAtiva: {
    backgroundColor: '#FFEDD5',
    borderColor: '#F97316',
  },

  opcaoTitulo: {
    color: '#292524',
    fontSize: 15,
    fontWeight: 'bold',
  },

  textoSecundario: {
    color: '#78716C',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 5,
  },

  destaque: {
    color: '#EA580C',
    fontWeight: 'bold',
    marginTop: 18,
  },

  link: {
    color: '#EA580C',
    fontSize: 13,
    marginTop: 10,
    textDecorationLine: 'underline',
  },

  card: {
    backgroundColor: '#FFEDD5',
    padding: 22,
    borderRadius: 15,
    marginTop: 15,
  },

  cardTitulo: {
    color: '#9A3412',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },

  distancia: {
    color: '#EA580C',
    fontSize: 36,
    fontWeight: 'bold',
    marginTop: 25,
    marginBottom: 10,
  },

  botaoTeste: {
    backgroundColor: '#F97316',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 25,
  },

  botaoEncerrar: {
    borderWidth: 1,
    borderColor: '#EA580C',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 12,
  },

  textoEncerrar: {
    color: '#C2410C',
    fontWeight: 'bold',
  },

  espaco: {
    marginTop: 20,
  },

  erro: {
    color: '#B91C1C',
    marginTop: 20,
    fontSize: 13,
  },

  rodape: {
    color: '#A8A29E',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 35,
  },
});
