const db = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);

const MODO_TESTE = true;

const LATITUDE = -18.456081409042635;
const LONGITUDE = -46.3682270038666;
const MINUTOS_PARA_ATUALIZAR = 30;

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

const campoNome = document.getElementById('usuarioNome');
const avatar = document.getElementById('usuarioFoto');
const botaoSair = document.getElementById('sair');
const graficoSvg = document.getElementById('grafico');
const listaPrevisao = document.getElementById('previsao');

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
  if (campoNome) campoNome.textContent = nome;

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

  elementoPerfil.textContent = data?.perfil || 'Perfil não cadastrado';
}

async function controlarMenuGestao() {
  const linkGestao = document.getElementById('linkGestao');

  if (!linkGestao) return;

  linkGestao.hidden = true;

  const { data: sessaoData, error: erroSessao } =
    await db.auth.getSession();

  if (erroSessao || !sessaoData.session) return;

  const { data: ehAdministrador, error } =
    await db.rpc('usuario_e_admin');

  if (error) {
    console.error('Erro ao verificar administrador:', error);
    return;
  }

  linkGestao.hidden = ehAdministrador !== true;
}

async function pedirNome() {
  const resposta = prompt('Como devemos chamar você? (nome completo)');
  const nome = resposta ? resposta.trim() : '';

  if (!nome) return null;

  const { error } = await db.auth.updateUser({
    data: { full_name: nome }
  });

  return error ? null : nome;
}

async function verificarLogin() {
  const { data, error } = await db.auth.getSession();
  const sessao = data?.session;

  if (error || !sessao) {
    if (MODO_TESTE) {
      mostrarUsuario('Visitante (teste)');
      const elementoPerfil = document.getElementById('usuarioPerfil');
      if (elementoPerfil) elementoPerfil.textContent = 'Modo de teste';
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

verificarLogin();

if (botaoSair) {
  botaoSair.addEventListener('click', async () => {
    await db.auth.signOut();
    window.location.href = 'login.html';
  });
}

const LARGURA = 500;
const ALTURA = 180;
const MARGEM = 14;

function criarLinha(valores, classe) {
  const menor = Math.min(...valores);
  const maior = Math.max(...valores);
  const diferenca = (maior - menor) || 1;

  const pontos = valores.map((valor, i) => {
    const x = (i / Math.max(valores.length - 1, 1)) * LARGURA;
    const y = ALTURA - MARGEM -
      ((valor - menor) / diferenca) * (ALTURA - MARGEM * 2);

    return `${x},${y}`;
  }).join(' ');

  return `<polyline class="linha ${classe}" points="${pontos}"/>`;
}

function desenharGrafico(temperaturas, umidades) {
  if (!graficoSvg) {
    return console.warn('Faltou o <svg id="grafico"> no painel.html');
  }

  let grade = '';

  for (let i = 0; i < 5; i++) {
    const y = (ALTURA / 4) * i;
    grade += `<line class="grade" x1="0" y1="${y}" x2="${LARGURA}" y2="${y}"/>`;
  }

  graficoSvg.innerHTML =
    grade +
    criarLinha(temperaturas, 'linha-ar') +
    criarLinha(umidades, 'linha-solo');
}

function desenharHoras(leituras) {
  const caixa = document.getElementById('graficoHoras');

  if (!caixa || !leituras.length) return;

  const horas = [0, 0.25, 0.5, 0.75, 1].map(parte => {
    const leitura = leituras[
      Math.round(parte * (leituras.length - 1))
    ];

    return new Date(leitura[COL.data]).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });
  });

  horas[4] = `Agora (${horas[4]})`;
  caixa.innerHTML = horas.map(h => `<span>${h}</span>`).join('');
}

function reduzir(lista, maximo = 60) {
  const passo = Math.ceil(lista.length / maximo);
  return lista.filter((_, i) => i % passo === 0 || i === lista.length - 1);
}

function numero(valor, casas = 1) {
  return valor == null || !Number.isFinite(valor)
    ? '--'
    : valor.toFixed(casas);
}

function definirSelo(id, texto, cor) {
  const selo = document.getElementById(id);

  if (!selo) {
    return console.warn(`Faltou o elemento #${id} no painel.html`);
  }

  selo.textContent = texto;
  selo.className = `selo ${cor}`;
}

function escrever(id, texto) {
  const elemento = document.getElementById(id);

  if (!elemento) {
    return console.warn(`Faltou o elemento #${id} no painel.html`);
  }

  elemento.textContent = texto;
}

function converterSolo(bruto) {
  const valor = Number(bruto);

  if (bruto == null || !Number.isFinite(valor)) return null;
  if (SOLO_SECO == null || SOLO_MOLHADO == null) return valor;

  const porcentagem =
    ((SOLO_SECO - valor) / (SOLO_SECO - SOLO_MOLHADO)) * 100;

  return Math.max(0, Math.min(100, porcentagem));
}

async function carregarLeituras() {
  const ha24h = new Date(
    Date.now() - 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: maisNovasPrimeiro, error } = await db
    .from(TABELA)
    .select('*')
    .gte(COL.data, ha24h)
    .order(COL.data, { ascending: false })
    .limit(1000);

  if (error) {
    console.log('Erro ao buscar leituras:', error.message);
    return;
  }

  if (!maisNovasPrimeiro || !maisNovasPrimeiro.length) {
    console.log('Nenhuma leitura nas últimas 24h.');
    return;
  }

  const data = [...maisNovasPrimeiro].reverse();
  const ultima = data[data.length - 1];

  console.log('Última leitura:', ultima);

  const tempAr = Number(ultima[COL.tempAr]);
  const umidAr = Number(ultima[COL.umidAr]);
  const umidSolo = converterSolo(ultima[COL.umidSolo]);
  const pressao = Number(ultima[COL.pressao]);
  const luz = Number(ultima[COL.luminosidade]);

  escrever('valorTempAr', numero(tempAr));
  escrever('valorUmidAr', numero(umidAr));
  escrever('valorUmidSolo', numero(umidSolo));
  escrever('valorPressao', numero(pressao));
  escrever('valorLuz', numero(luz, 0));

  let chovendo = false;
  let choveuNas24h = false;

  data.forEach(l => {
    const bruto = Number(l[COL.chuva]);

    if (!Number.isFinite(bruto)) return;

    if (bruto < CHUVA_INICIO_RAW) {
      chovendo = true;
      choveuNas24h = true;
    } else if (bruto > CHUVA_FIM_RAW) {
      chovendo = false;
    }
  });

  escrever('valorChuva', chovendo ? 'Sim' : 'Não');

  if (chovendo) definirSelo('seloChuva', 'Chovendo agora', 'azul');
  else if (choveuNas24h) definirSelo('seloChuva', 'Choveu', 'verde');
  else definirSelo('seloChuva', 'Sem chuva', 'ambar');

  if (tempAr >= 15 && tempAr <= 32) {
    definirSelo('seloTempAr', 'Faixa Ideal', 'verde');
  } else {
    definirSelo('seloTempAr', 'Fora da faixa', 'ambar');
  }

  if (umidSolo == null) {
    definirSelo('seloUmidSolo', 'Sem dado', 'azul');
  } else if (umidSolo >= 40) {
    definirSelo('seloUmidSolo', 'Solo Úmido (Excelente)', 'azul');
  } else if (umidSolo >= 25) {
    definirSelo('seloUmidSolo', 'Umidade Moderada', 'verde');
  } else {
    definirSelo('seloUmidSolo', 'Solo Seco', 'ambar');
  }

  if (umidAr >= 40 && umidAr <= 85) {
    definirSelo('seloUmidAr', 'Estável', 'azul');
  } else {
    definirSelo('seloUmidAr', 'Atenção', 'ambar');
  }

  const ha3h = Date.now() - 3 * 60 * 60 * 1000;
  const recentes = data.filter(
    l => new Date(l[COL.data]).getTime() >= ha3h
  );

  const referencia = recentes[0] || ultima;
  const variacao = pressao - Number(referencia[COL.pressao]);

  if (recentes.length < 2 || !Number.isFinite(variacao)) {
    definirSelo('seloPressao', 'Sem tendência', 'azul');
  } else if (variacao <= -1) {
    definirSelo('seloPressao', 'Em queda', 'ambar');
  } else if (variacao >= 1) {
    definirSelo('seloPressao', 'Em alta', 'verde');
  } else {
    definirSelo('seloPressao', 'Estável', 'azul');
  }

  if (luz >= 10000) {
    definirSelo('seloLuz', 'Sol Intenso', 'ambar');
  } else if (luz >= 1000) {
    definirSelo('seloLuz', 'Dia Claro', 'verde');
  } else {
    definirSelo('seloLuz', 'Pouca Luz', 'azul');
  }

  const ha12h = Date.now() - 12 * 60 * 60 * 1000;

  let pontos = data.filter(
    l => new Date(l[COL.data]).getTime() >= ha12h
  );

  if (pontos.length < 2) pontos = data.slice(-30);

  pontos = reduzir(pontos);

  const temperaturas = pontos
    .map(l => Number(l[COL.tempAr]))
    .filter(Number.isFinite);

  const umidades = pontos
    .map(l => converterSolo(l[COL.umidSolo]))
    .filter(v => v != null);

  console.log(`Leituras: ${data.length} | no gráfico: ${pontos.length}`);

  if (temperaturas.length >= 2 && umidades.length >= 2) {
    desenharGrafico(temperaturas, umidades);
    desenharHoras(pontos);
  }
}

carregarLeituras();
setInterval(carregarLeituras, 60 * 1000);

function iconePorCodigo(codigo) {
  if (codigo <= 1) return 'bi-sun';
  if (codigo === 2) return 'bi-cloud-sun';
  if (codigo === 3) return 'bi-cloud';
  if (codigo <= 48) return 'bi-cloud-fog';
  if (codigo <= 57) return 'bi-cloud-drizzle';
  if (codigo <= 67 || (codigo >= 80 && codigo <= 82)) return 'bi-cloud-rain';
  if (codigo <= 77) return 'bi-snow';
  if (codigo >= 95) return 'bi-cloud-lightning-rain';

  return 'bi-cloud';
}

async function carregarPrevisao() {
  const url = 'https://api.open-meteo.com/v1/forecast'
    + `?latitude=${LATITUDE}&longitude=${LONGITUDE}`
    + '&daily=weather_code,temperature_2m_max,precipitation_probability_max'
    + '&timezone=America%2FSao_Paulo&forecast_days=5';

  try {
    const resposta = await fetch(url);

    if (!resposta.ok) {
      throw new Error('Falha ao buscar a previsão');
    }

    const { daily } = await resposta.json();

    const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    if (!listaPrevisao) return;

    listaPrevisao.innerHTML = daily.time.map((data, i) => {
      const dia = diasSemana[
        new Date(data + 'T12:00:00').getDay()
      ];

      const chuva = daily.precipitation_probability_max[i] ?? 0;
      const textoChuva = chuva === 0 ? 'Sem Chuva' : `Chuva: ${chuva}%`;
      const icone = iconePorCodigo(daily.weather_code[i]);
      const temperatura = Math.round(daily.temperature_2m_max[i]);

      return `<li>
        <b>${dia}</b>
        <span><i class="bi ${icone} ambar"></i> ${textoChuva}</span>
        <strong>${temperatura}°</strong>
      </li>`;
    }).join('');

  } catch (erro) {
    if (listaPrevisao) {
      listaPrevisao.innerHTML =
        '<li class="aviso">Não foi possível carregar a previsão.</li>';
    }
  }
}

carregarPrevisao();
setInterval(carregarPrevisao, MINUTOS_PARA_ATUALIZAR * 60 * 1000);

