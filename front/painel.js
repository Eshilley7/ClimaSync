
const db = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);

const MODO_TESTE = true;

const LATITUDE = -18.456081409042635;
const LONGITUDE = -46.3682270038666;
const MINUTOS_PARA_ATUALIZAR = 30;
const MINUTOS_LEITURA_ATUAL = 60;

const TABELA = 'leituras';

const COL = {
  data: 'criado_em',
  tempAr: 'temperatura_ar',
  umidAr: 'umidade_ar',
  umidSolo: 'umidade_solo_raw',
  pressao: 'pressao_hpa',
  luminosidade: 'luminosidade_lux',
  chuva: 'chuva_raw'
};

const SOLO_SECO = 4095;
const SOLO_MOLHADO = 1300;

const CHUVA_INICIO_RAW = 3900;
const CHUVA_FIM_RAW = 4000;

const LARGURA = 500;
const ALTURA = 180;
const MARGEM = 14;

const campoNome = document.getElementById('usuarioNome');
const avatar = document.getElementById('usuarioFoto');
const botaoSair = document.getElementById('sair');
const graficoSvg = document.getElementById('grafico');
const listaPrevisao = document.getElementById('previsao');

let ultimaMedicao = null;
let previsaoAtual = null;
let carregandoLeituras = false;

function nomeDoEmail(email) {
  return email
    .split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .split(' ')
    .filter(Boolean)
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ') || email;
}

function mostrarUsuario(nome, fotoUrl) {
  if (campoNome) {
    campoNome.textContent = nome;
  }

  if (avatar) {
    if (fotoUrl) {
      avatar.style.backgroundImage = `url("${fotoUrl}")`;
      avatar.textContent = '';
    } else {
      avatar.style.backgroundImage = '';
      avatar.textContent = nome.charAt(0).toUpperCase();
    }
  }
}

async function carregarPerfilUsuario(email) {
  const elementoPerfil = document.getElementById('usuarioPerfil');

  if (!elementoPerfil) return;

  elementoPerfil.textContent = 'Carregando perfil...';

  const { data, error } = await db
    .from('funcionarios')
    .select('perfil')
    .ilike('email', email)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar perfil:', error);
    elementoPerfil.textContent = 'Perfil indisponível';
    return;
  }

  elementoPerfil.textContent =
    data?.perfil || 'Perfil não cadastrado';
}

async function controlarMenuGestao() {
  const linkGestao = document.getElementById('linkGestao');

  if (!linkGestao) return;

  linkGestao.hidden = true;

  const { data: sessaoData, error: erroSessao } =
    await db.auth.getSession();

  if (erroSessao || !sessaoData?.session) return;

  const { data: ehAdministrador, error } =
    await db.rpc('usuario_e_admin');

  if (error) {
    console.error('Erro ao verificar administrador:', error);
    return;
  }

  linkGestao.hidden = ehAdministrador !== true;
}

async function pedirNome() {
  const resposta = prompt(
    'Como devemos chamar você? (nome completo)'
  );

  const nome = resposta ? resposta.trim() : '';

  if (!nome) return null;

  const { error } = await db.auth.updateUser({
    data: {
      full_name: nome
    }
  });

  return error ? null : nome;
}

async function verificarLogin() {
  const { data, error } = await db.auth.getSession();
  const sessao = data?.session;

  if (error || !sessao) {
    if (MODO_TESTE) {
      mostrarUsuario('Visitante (teste)');

      const elementoPerfil =
        document.getElementById('usuarioPerfil');

      if (elementoPerfil) {
        elementoPerfil.textContent = 'Modo de teste';
      }

      return;
    }

    window.location.href = 'login.html';
    return;
  }

  const usuario = sessao.user;
  const dados = usuario.user_metadata || {};
  const email = (usuario.email || '').toLowerCase();

  let nome = dados.full_name || nomeDoEmail(email);

  if (!dados.full_name && !nome.includes(' ')) {
    mostrarUsuario(nome, dados.avatar_url);

    const nomeInformado = await pedirNome();

    if (nomeInformado) {
      nome = nomeInformado;
    }
  }

  mostrarUsuario(nome, dados.avatar_url);

  await carregarPerfilUsuario(email);
  await controlarMenuGestao();
}

if (botaoSair) {
  botaoSair.addEventListener('click', async () => {
    await db.auth.signOut();
    window.location.href = 'login.html';
  });
}

function numeroSensor(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ''
  ) {
    return NaN;
  }

  const convertido = Number(valor);

  return Number.isFinite(convertido)
    ? convertido
    : NaN;
}

function numero(valor, casas = 1) {
  return Number.isFinite(valor)
    ? valor.toFixed(casas)
    : '--';
}

function escrever(id, texto) {
  const elemento = document.getElementById(id);

  if (elemento) {
    elemento.textContent = texto;
  }
}

function definirSelo(id, texto, cor) {
  const selo = document.getElementById(id);

  if (!selo) return;

  selo.textContent = texto;
  selo.className = `selo ${cor}`;
}

function converterSolo(bruto) {
  const valor = numeroSensor(bruto);

  if (!Number.isFinite(valor)) {
    return null;
  }

  const porcentagem =
    ((SOLO_SECO - valor) /
      (SOLO_SECO - SOLO_MOLHADO)) * 100;

  return Math.max(
    0,
    Math.min(100, porcentagem)
  );
}

function atualizarAvisoLeitura(
  mensagem,
  desatualizado = false
) {
  let aviso = document.getElementById('avisoAtualizacao');

  if (!aviso) {
    aviso = document.createElement('p');
    aviso.id = 'avisoAtualizacao';
    aviso.setAttribute('role', 'status');

    const referencia =
      document.querySelector('.secao-titulo') ||
      document.querySelector('.topo h1') ||
      document.querySelector('h1');

    if (referencia) {
      referencia.insertAdjacentElement('afterend', aviso);
    } else {
      document.body.prepend(aviso);
    }
  }

  aviso.textContent = mensagem;
  aviso.classList.toggle('desatualizado', desatualizado);
}

function leituraDesatualizada(data) {
  const instante = new Date(data).getTime();

  if (!Number.isFinite(instante)) {
    return true;
  }

  const diferenca = Date.now() - instante;

  return (
    diferenca < 0 ||
    diferenca > MINUTOS_LEITURA_ATUAL * 60 * 1000
  );
}

function formatarData(data) {
  const dataConvertida = new Date(data);

  if (Number.isNaN(dataConvertida.getTime())) {
    return 'Data desconhecida';
  }

  return dataConvertida.toLocaleString('pt-BR');
}

function reduzir(lista, maximo = 60) {
  if (lista.length <= maximo) {
    return lista;
  }

  const resultado = [];
  const ultimo = lista.length - 1;

  for (let i = 0; i < maximo; i++) {
    const indice = Math.round(
      (i / (maximo - 1)) * ultimo
    );

    resultado.push(lista[indice]);
  }

  return resultado;
}

function criarLinha(valores, classe, minimo, maximo) {
  if (valores.length < 2) {
    return '';
  }

  const diferenca = maximo - minimo || 1;

  const pontos = valores.map((valor, i) => {
    const x =
      (i / (valores.length - 1)) * LARGURA;

    const y =
      ALTURA -
      MARGEM -
      ((valor - minimo) / diferenca) *
      (ALTURA - MARGEM * 2);

    return `${x},${y}`;
  }).join(' ');

  return `<polyline class="linha ${classe}" points="${pontos}"/>`;
}

function desenharGrafico(temperaturas, umidades) {
  if (!graficoSvg) return;

  if (
    temperaturas.length < 2 ||
    umidades.length < 2
  ) {
    graficoSvg.innerHTML = '';
    return;
  }

  let grade = '';

  for (let i = 0; i < 5; i++) {
    const y = (ALTURA / 4) * i;

    grade += `
      <line
        class="grade"
        x1="0"
        y1="${y}"
        x2="${LARGURA}"
        y2="${y}"
      />
    `;
  }

  const minimoTemperatura = Math.min(...temperaturas);
  const maximoTemperatura = Math.max(...temperaturas);

  graficoSvg.innerHTML =
    grade +
    criarLinha(
      temperaturas,
      'linha-ar',
      minimoTemperatura,
      maximoTemperatura
    ) +
    criarLinha(
      umidades,
      'linha-solo',
      0,
      100
    );
}

function desenharHoras(leituras) {
  const caixa = document.getElementById('graficoHoras');

  if (!caixa) return;

  if (!leituras.length) {
    caixa.innerHTML = '';
    return;
  }

  const horas = [
    0,
    0.25,
    0.5,
    0.75,
    1
  ].map(parte => {
    const indice = Math.round(
      parte * (leituras.length - 1)
    );

    const data = new Date(
      leituras[indice][COL.data]
    );

    return data.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  horas[4] = `Última (${horas[4]})`;

  caixa.innerHTML = horas
    .map(hora => `<span>${hora}</span>`)
    .join('');
}

function atualizarGrafico(leituras) {
  const ha12h =
    Date.now() - 12 * 60 * 60 * 1000;

  let pontos = leituras.filter(leitura => {
    const instante =
      new Date(leitura[COL.data]).getTime();

    return instante >= ha12h;
  });

  if (pontos.length < 2) {
    pontos = leituras.slice(-30);
  }

  pontos = reduzir(pontos);

  const validos = pontos.filter(leitura => {
    const temperatura =
      numeroSensor(leitura[COL.tempAr]);

    const umidade =
      converterSolo(leitura[COL.umidSolo]);

    return (
      Number.isFinite(temperatura) &&
      umidade !== null
    );
  });

  if (validos.length < 2) {
    if (graficoSvg) {
      graficoSvg.innerHTML = '';
    }

    const caixa = document.getElementById('graficoHoras');

    if (caixa) {
      caixa.textContent = 'Dados insuficientes para o gráfico';
    }

    return;
  }

  const temperaturas = validos.map(leitura =>
    numeroSensor(leitura[COL.tempAr])
  );

  const umidades = validos.map(leitura =>
    converterSolo(leitura[COL.umidSolo])
  );

  desenharGrafico(temperaturas, umidades);
  desenharHoras(validos);
}

function atualizarIndicadores(leituras, desatualizado) {
  const ultima = leituras[leituras.length - 1];

  const tempAr = numeroSensor(ultima[COL.tempAr]);
  const umidAr = numeroSensor(ultima[COL.umidAr]);
  const umidSolo = converterSolo(ultima[COL.umidSolo]);
  const pressao = numeroSensor(ultima[COL.pressao]);
  const luz = numeroSensor(ultima[COL.luminosidade]);

  escrever('valorTempAr', numero(tempAr));
  escrever('valorUmidAr', numero(umidAr));
  escrever('valorUmidSolo', numero(umidSolo));
  escrever('valorPressao', numero(pressao));
  escrever('valorLuz', numero(luz, 0));

  let chovendo = null;
  let choveuNas24h = false;

  const ha24h =
    Date.now() - 24 * 60 * 60 * 1000;

  leituras.forEach(leitura => {
    const bruto =
      numeroSensor(leitura[COL.chuva]);

    if (!Number.isFinite(bruto)) {
      return;
    }

    if (bruto < CHUVA_INICIO_RAW) {
      chovendo = true;

      const instante =
        new Date(leitura[COL.data]).getTime();

      if (instante >= ha24h) {
        choveuNas24h = true;
      }
    } else if (bruto > CHUVA_FIM_RAW) {
      chovendo = false;
    }
  });

  escrever(
    'valorChuva',
    chovendo === null
      ? '--'
      : chovendo
        ? 'Sim'
        : 'Não'
  );

  if (chovendo === null) {
    definirSelo('seloChuva', 'Sem dado', 'ambar');
  } else if (chovendo) {
    definirSelo(
      'seloChuva',
      desatualizado
        ? 'Chuva na última leitura'
        : 'Chovendo agora',
      'azul'
    );
  } else if (choveuNas24h) {
    definirSelo(
      'seloChuva',
      'Choveu nas últimas 24h',
      'verde'
    );
  } else {
    definirSelo(
      'seloChuva',
      'Sem chuva na última leitura',
      'ambar'
    );
  }

  if (!Number.isFinite(tempAr)) {
    definirSelo('seloTempAr', 'Sem dado', 'ambar');
  } else if (tempAr >= 15 && tempAr <= 32) {
    definirSelo('seloTempAr', 'Faixa Ideal', 'verde');
  } else {
    definirSelo('seloTempAr', 'Fora da faixa', 'ambar');
  }

  if (umidSolo === null) {
    definirSelo('seloUmidSolo', 'Sem dado', 'ambar');
  } else if (umidSolo >= 80) {
    definirSelo(
      'seloUmidSolo',
      'Umidade Elevada',
      'ambar'
    );
  } else if (umidSolo >= 40) {
    definirSelo(
      'seloUmidSolo',
      'Solo Úmido',
      'azul'
    );
  } else if (umidSolo >= 25) {
    definirSelo(
      'seloUmidSolo',
      'Umidade Moderada',
      'verde'
    );
  } else {
    definirSelo(
      'seloUmidSolo',
      'Solo Seco',
      'ambar'
    );
  }

  if (!Number.isFinite(umidAr)) {
    definirSelo('seloUmidAr', 'Sem dado', 'ambar');
  } else if (umidAr >= 40 && umidAr <= 85) {
    definirSelo('seloUmidAr', 'Estável', 'azul');
  } else {
    definirSelo('seloUmidAr', 'Atenção', 'ambar');
  }

  const ha3h =
    Date.now() - 3 * 60 * 60 * 1000;

  const recentes = leituras.filter(leitura => {
    const instante =
      new Date(leitura[COL.data]).getTime();

    return (
      instante >= ha3h &&
      Number.isFinite(
        numeroSensor(leitura[COL.pressao])
      )
    );
  });

  if (
    recentes.length < 2 ||
    !Number.isFinite(pressao)
  ) {
    definirSelo(
      'seloPressao',
      'Sem tendência',
      'azul'
    );
  } else {
    const referencia =
      numeroSensor(recentes[0][COL.pressao]);

    const variacao = pressao - referencia;

    if (variacao <= -1) {
      definirSelo(
        'seloPressao',
        'Em queda',
        'ambar'
      );
    } else if (variacao >= 1) {
      definirSelo(
        'seloPressao',
        'Em alta',
        'verde'
      );
    } else {
      definirSelo(
        'seloPressao',
        'Estável',
        'azul'
      );
    }
  }

  if (!Number.isFinite(luz)) {
    definirSelo('seloLuz', 'Sem dado', 'ambar');
  } else if (luz >= 10000) {
    definirSelo(
      'seloLuz',
      'Sol Intenso',
      'ambar'
    );
  } else if (luz >= 1000) {
    definirSelo(
      'seloLuz',
      'Dia Claro',
      'verde'
    );
  } else {
    definirSelo(
      'seloLuz',
      'Pouca Luz',
      'azul'
    );
  }

  return {
    tempAr,
    umidAr,
    umidSolo,
    pressao,
    luz,
    chovendo
  };
}

function gerarRecomendacoes(
  umidadeSolo,
  temperaturaAr,
  chanceChuva = null,
  desatualizado = false
) {
  const campoIrrigacao =
    document.getElementById('recomendacaoIrrigacao');

  const campoSaude =
    document.getElementById('recomendacaoSaude');

  if (!campoIrrigacao || !campoSaude) {
    return;
  }

  const solo =
    umidadeSolo == null
      ? NaN
      : Number(umidadeSolo);

  const temperatura =
    temperaturaAr == null
      ? NaN
      : Number(temperaturaAr);

  const chuva =
    chanceChuva == null
      ? NaN
      : Number(chanceChuva);

  if (
    !Number.isFinite(solo) ||
    !Number.isFinite(temperatura)
  ) {
    campoIrrigacao.textContent =
      'Aguardando dados válidos dos sensores para avaliar a irrigação.';

    campoSaude.textContent =
      'Aguardando dados válidos para analisar as condições ambientais.';

    return;
  }

  let irrigacao = '';
  let saude = '';

  if (solo >= 80 && temperatura >= 32) {
    irrigacao =
      `A umidade do solo está elevada (${solo.toFixed(1)}%) e a temperatura do ar atingiu ${temperatura.toFixed(1)}°C. Avalie a necessidade de suspender temporariamente novas irrigações e verifique a drenagem.`;

    saude =
      'A combinação de solo muito úmido e temperatura elevada pode favorecer determinadas doenças e dificultar a oxigenação das raízes, dependendo da cultura. Acompanhe as condições das plantas.';

  } else if (solo >= 80) {
    irrigacao =
      `O solo apresenta umidade elevada (${solo.toFixed(1)}%). Verifique a drenagem e avalie se é necessário adiar a próxima irrigação.`;

    saude =
      'O excesso de água no solo pode reduzir a disponibilidade de oxigênio para as raízes. Monitore a umidade e observe possíveis sinais de estresse nas plantas.';

  } else if (solo <= 25 && temperatura >= 32) {
    irrigacao =
      `O solo apresenta baixa umidade (${solo.toFixed(1)}%) e a temperatura do ar está elevada (${temperatura.toFixed(1)}°C). Avalie a necessidade de irrigação conforme a cultura e seu estágio de desenvolvimento.`;

    saude =
      'A combinação de calor intenso e baixa umidade do solo pode aumentar o risco de estresse hídrico. Recomenda-se acompanhar as condições das plantas.';

  } else if (solo <= 25) {
    irrigacao =
      `A umidade do solo está baixa (${solo.toFixed(1)}%). Verifique a necessidade de irrigação para manter condições adequadas ao desenvolvimento da cultura.`;

    saude =
      'A baixa disponibilidade de água no solo pode limitar a absorção de nutrientes e afetar o desenvolvimento das plantas.';

  } else if (temperatura >= 35) {
    irrigacao =
      `A umidade do solo está em ${solo.toFixed(1)}%. Continue monitorando a disponibilidade de água, especialmente durante os períodos mais quentes.`;

    saude =
      `A temperatura do ar atingiu ${temperatura.toFixed(1)}°C. Temperaturas elevadas podem causar estresse térmico, dependendo da cultura.`;

  } else if (temperatura <= 10) {
    irrigacao =
      `A umidade do solo está em ${solo.toFixed(1)}%. Avalie a necessidade de irrigação considerando as condições climáticas atuais.`;

    saude =
      `A temperatura do ar está em ${temperatura.toFixed(1)}°C. Temperaturas baixas podem prejudicar determinadas culturas. Acompanhe a previsão meteorológica.`;

  } else {
    irrigacao =
      `A umidade do solo está em ${solo.toFixed(1)}%. Não foram identificados alertas pelos limites gerais configurados. Continue monitorando a irrigação.`;

    saude =
      `A temperatura do ar está em ${temperatura.toFixed(1)}°C. Não foram identificados alertas térmicos pelos limites gerais configurados.`;
  }

  if (Number.isFinite(chuva) && chuva >= 70) {
    irrigacao +=
      ` A previsão meteorológica indica ${chuva.toFixed(0)}% de probabilidade de chuva hoje. Considere essa informação antes de programar a irrigação.`;
  } else if (
    Number.isFinite(chuva) &&
    chuva >= 40
  ) {
    irrigacao +=
      ` Existe ${chuva.toFixed(0)}% de probabilidade de chuva hoje. Acompanhe a previsão antes de definir a irrigação.`;
  }

  if (desatualizado) {
    const aviso =
      ' Atenção: esta análise utiliza uma leitura desatualizada. Confirme as condições atuais antes de tomar decisões.';

    irrigacao += aviso;
    saude += aviso;
  }

  campoIrrigacao.textContent = irrigacao;
  campoSaude.textContent = saude;
}

function atualizarRecomendacoes() {
  if (!ultimaMedicao) {
    gerarRecomendacoes(null, null);
    return;
  }

  gerarRecomendacoes(
    ultimaMedicao.umidSolo,
    ultimaMedicao.tempAr,
    previsaoAtual?.chanceChuvaHoje ?? null,
    ultimaMedicao.desatualizado
  );
}

function limparIndicadores() {
  [
    'valorTempAr',
    'valorUmidAr',
    'valorUmidSolo',
    'valorPressao',
    'valorLuz',
    'valorChuva'
  ].forEach(id => escrever(id, '--'));

  [
    'seloChuva',
    'seloTempAr',
    'seloUmidSolo',
    'seloUmidAr',
    'seloPressao',
    'seloLuz'
  ].forEach(id => {
    definirSelo(id, 'Sem dados', 'ambar');
  });

  if (graficoSvg) {
    graficoSvg.innerHTML = '';
  }

  const caixaHoras =
    document.getElementById('graficoHoras');

  if (caixaHoras) {
    caixaHoras.innerHTML = '';
  }
}

async function carregarLeituras() {
  if (carregandoLeituras) {
    return;
  }

  carregandoLeituras = true;

  try {
    const { data: maisNovasPrimeiro, error } = await db
      .from(TABELA)
      .select('*')
      .order(COL.data, { ascending: false })
      .limit(1000);

    if (error) {
      throw error;
    }

    if (!maisNovasPrimeiro?.length) {
      ultimaMedicao = null;

      limparIndicadores();

      atualizarAvisoLeitura(
        'Sem dados: nenhuma leitura disponível.',
        true
      );

      atualizarRecomendacoes();
      return;
    }

    const leituras =
      [...maisNovasPrimeiro].reverse();

    const ultima =
      leituras[leituras.length - 1];

    const desatualizado =
      leituraDesatualizada(ultima[COL.data]);

    const mensagem = desatualizado
      ? `Dados desatualizados — última leitura: ${formatarData(ultima[COL.data])}`
      : `Dados atualizados — última leitura: ${formatarData(ultima[COL.data])}`;

    atualizarAvisoLeitura(
      mensagem,
      desatualizado
    );

    const indicadores =
      atualizarIndicadores(
        leituras,
        desatualizado
      );

    ultimaMedicao = {
      ...indicadores,
      data: ultima[COL.data],
      desatualizado
    };

    atualizarGrafico(leituras);
    atualizarRecomendacoes();

    console.log(
      'Última leitura do ClimaSync:',
      ultima
    );

  } catch (erro) {
    console.error(
      'Erro ao carregar leituras:',
      erro
    );

    atualizarAvisoLeitura(
      'Não foi possível atualizar as leituras do Supabase.',
      true
    );

    if (ultimaMedicao) {
      ultimaMedicao.desatualizado = true;
    }

    atualizarRecomendacoes();

  } finally {
    carregandoLeituras = false;
  }
}

function iconePorCodigo(codigo) {
  if (codigo <= 1) return 'bi-sun';
  if (codigo === 2) return 'bi-cloud-sun';
  if (codigo === 3) return 'bi-cloud';
  if (codigo <= 48) return 'bi-cloud-fog';
  if (codigo <= 57) return 'bi-cloud-drizzle';

  if (
    codigo <= 67 ||
    (codigo >= 80 && codigo <= 82)
  ) {
    return 'bi-cloud-rain';
  }

  if (codigo <= 77) return 'bi-snow';
  if (codigo >= 95) return 'bi-cloud-lightning-rain';

  return 'bi-cloud';
}

async function carregarPrevisao() {
  const url =
    'https://api.open-meteo.com/v1/forecast' +
    `?latitude=${LATITUDE}&longitude=${LONGITUDE}` +
    '&daily=weather_code,temperature_2m_max,precipitation_probability_max' +
    '&timezone=America%2FSao_Paulo&forecast_days=5';

  try {
    const resposta = await fetch(url);

    if (!resposta.ok) {
      throw new Error(
        'Falha ao buscar a previsão meteorológica'
      );
    }

    const { daily } = await resposta.json();

    if (!daily?.time?.length) {
      throw new Error(
        'Previsão meteorológica indisponível'
      );
    }

    const diasSemana = [
      'Dom',
      'Seg',
      'Ter',
      'Qua',
      'Qui',
      'Sex',
      'Sáb'
    ];

    const hoje = new Date().toLocaleDateString(
      'en-CA',
      {
        timeZone: 'America/Sao_Paulo'
      }
    );

    const indiceHoje = daily.time.indexOf(hoje);

    const chanceChuvaHoje =
      indiceHoje >= 0
        ? numeroSensor(
            daily.precipitation_probability_max[indiceHoje]
          )
        : NaN;

    previsaoAtual = {
      chanceChuvaHoje:
        Number.isFinite(chanceChuvaHoje)
          ? chanceChuvaHoje
          : null,
      atualizadaEm: new Date()
    };

    if (listaPrevisao) {
      listaPrevisao.innerHTML =
        daily.time.map((data, i) => {
          const dia = diasSemana[
            new Date(
              data + 'T12:00:00'
            ).getDay()
          ];

          const chuva =
            daily.precipitation_probability_max[i];

          const textoChuva =
            chuva == null
              ? 'Chuva: --'
              : chuva === 0
                ? 'Sem Chuva'
                : `Chuva: ${chuva}%`;

          const icone = iconePorCodigo(
            daily.weather_code[i]
          );

          const temperatura =
            numeroSensor(
              daily.temperature_2m_max[i]
            );

          const textoTemperatura =
            Number.isFinite(temperatura)
              ? `${Math.round(temperatura)}°`
              : '--';

          return `
            <li>
              <b>${dia}</b>
              <span>
                <i class="bi ${icone} ambar"></i>
                ${textoChuva}
              </span>
              <strong>${textoTemperatura}</strong>
            </li>
          `;
        }).join('');
    }

    atualizarRecomendacoes();

  } catch (erro) {
    console.error(
      'Erro ao carregar previsão:',
      erro
    );

    previsaoAtual = null;

    if (listaPrevisao) {
      listaPrevisao.innerHTML =
        '<li class="aviso">Não foi possível carregar a previsão.</li>';
    }

    atualizarRecomendacoes();
  }
}

async function iniciarPainel() {
  await verificarLogin();

  await Promise.all([
    carregarLeituras(),
    carregarPrevisao()
  ]);

  setInterval(
    carregarLeituras,
    60 * 1000
  );

  setInterval(
    carregarPrevisao,
    MINUTOS_PARA_ATUALIZAR * 60 * 1000
  );
}

iniciarPainel();