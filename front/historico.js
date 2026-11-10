const db = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);

function nomeDoEmail(email) {
  return email.split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .split(' ')
    .filter(Boolean)
    .map(palavra => palavra.charAt(0).toUpperCase() + palavra.slice(1))
    .join(' ') || email;
}

function mostrarUsuario(nome, fotoUrl) {
  const avatar = document.getElementById('usuarioFoto');
  const campoNome = document.getElementById('usuarioNome');

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

async function verificarLogin() {
  const { data, error } = await db.auth.getSession();
  const sessao = data?.session;

  if (error || !sessao) {
    window.location.href = 'login.html';
    return;
  }

  const usuario = sessao.user;
  const dados = usuario.user_metadata || {};
  const email = (usuario.email || '').toLowerCase();

  mostrarUsuario(
    dados.full_name || nomeDoEmail(email),
    dados.avatar_url
  );

  await carregarPerfilUsuario(email);
  await controlarMenuGestao();
}

verificarLogin();

document.getElementById('sair')?.addEventListener('click', async () => {
  await db.auth.signOut();
  window.location.href = 'login.html';
});

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

const TABELA_MANUAL = 'medicoes_manuais';
const ESTACAO_ID = 1;

const SOLO_SECO = 4095;
const SOLO_MOLHADO = 1300;
const CHUVA_INICIO_RAW = 3900;
const CHUVA_FIM_RAW = 4000;

const AGRUPAR_POR_HORA = true;
const MAX_LINHAS = 20000;

const campoInicial = document.getElementById('dataInicial');
const campoFinal = document.getElementById('dataFinal');
const campoSensor = document.getElementById('sensor');
const tabela = document.getElementById('tabela');
const formulario = document.getElementById('formulario');
const avisoForm = document.getElementById('avisoForm');

const agora = new Date();

function paraCampoDeData(data) {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

function formatarData(data) {
  return data.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  }).replace(',', '');
}

campoFinal.value = paraCampoDeData(agora);
campoInicial.value = paraCampoDeData(
  new Date(agora.getTime() - 3 * 24 * 60 * 60 * 1000)
);

const paraNumero = v => v == null ? null : Number(v);

function converterSolo(bruto) {
  const valor = Number(bruto);
  if (bruto == null || !Number.isFinite(valor)) return null;

  const porcentagem =
    ((SOLO_SECO - valor) / (SOLO_SECO - SOLO_MOLHADO)) * 100;

  return Math.max(0, Math.min(100, porcentagem));
}

function media(valores) {
  const validos = valores.filter(
    v => v != null && Number.isFinite(v)
  );

  if (!validos.length) return null;

  return validos.reduce((soma, v) => soma + v, 0) / validos.length;
}

function processarLeituras(linhas) {
  let chovendo = false;

  return linhas.map(l => {
    const bruto = Number(l[COL.chuva]);

    if (Number.isFinite(bruto)) {
      if (bruto < CHUVA_INICIO_RAW) chovendo = true;
      else if (bruto > CHUVA_FIM_RAW) chovendo = false;
    }

    return {
      data: new Date(l[COL.data]),
      tempAr: paraNumero(l[COL.tempAr]),
      umidAr: paraNumero(l[COL.umidAr]),
      umidSolo: converterSolo(l[COL.umidSolo]),
      pressao: paraNumero(l[COL.pressao]),
      luminosidade: paraNumero(l[COL.luminosidade]),
      chovendo
    };
  });
}

function agruparPorHora(leituras) {
  const grupos = new Map();

  leituras.forEach(l => {
    const hora = new Date(l.data);
    hora.setMinutes(0, 0, 0);
    const chave = hora.getTime();

    if (!grupos.has(chave)) {
      grupos.set(chave, { hora, itens: [] });
    }

    grupos.get(chave).itens.push(l);
  });

  return [...grupos.values()].map(({ hora, itens }) => ({
    data: hora,
    tempAr: media(itens.map(i => i.tempAr)),
    umidAr: media(itens.map(i => i.umidAr)),
    umidSolo: media(itens.map(i => i.umidSolo)),
    pressao: media(itens.map(i => i.pressao)),
    luminosidade: media(itens.map(i => i.luminosidade)),
    chovendo: itens.some(i => i.chovendo)
  }));
}

let medicoes = [];

async function buscarLeituras(inicio, fim) {
  let linhas = [];

  for (let de = 0; de < MAX_LINHAS; de += 1000) {
    const { data, error } = await db
      .from(TABELA)
      .select('*')
      .gte(COL.data, inicio.toISOString())
      .lte(COL.data, fim.toISOString())
      .order(COL.data, { ascending: true })
      .range(de, de + 999);

    if (error) throw error;

    linhas = linhas.concat(data || []);

    if (!data || data.length < 1000) break;
  }

  if (linhas.length >= MAX_LINHAS) {
    console.warn(
      `Limite de ${MAX_LINHAS} leituras atingido: escolha um período menor.`
    );
  }

  return linhas;
}

async function buscarManuais(inicio, fim) {
  const { data, error } = await db
    .from(TABELA_MANUAL)
    .select('*')
    .gte('criado_em', inicio.toISOString())
    .lte('criado_em', fim.toISOString());

  if (error) {
    console.warn('Lançamentos manuais indisponíveis:', error.message);
    return [];
  }

  return (data || []).map(l => ({
    data: new Date(l.criado_em),
    tempAr: paraNumero(l.temperatura_ar),
    umidAr: null,
    umidSolo: paraNumero(l.umidade_solo_pct),
    pressao: null,
    luminosidade: null,
    chovendo: Number(l.chuva_mm) > 0,
    manual: true
  }));
}

async function carregarMedicoes() {
  tabela.innerHTML =
    '<tbody><tr><td class="suave">Carregando medições...</td></tr></tbody>';

  const inicio = campoInicial.value
    ? new Date(campoInicial.value + 'T00:00:00')
    : new Date(0);

  const fim = campoFinal.value
    ? new Date(campoFinal.value + 'T23:59:59')
    : new Date();

  try {
    const [linhas, manuais] = await Promise.all([
      buscarLeituras(inicio, fim),
      buscarManuais(inicio, fim)
    ]);

    let leituras = processarLeituras(linhas);

    if (AGRUPAR_POR_HORA) {
      leituras = agruparPorHora(leituras);
    }

    medicoes = [...leituras, ...manuais]
      .sort((a, b) => b.data - a.data);

    desenharTabela();

  } catch (erro) {
    console.log('Erro ao buscar medições:', erro.message);

    tabela.innerHTML =
      '<tbody><tr><td class="suave">Não foi possível carregar as medições.</td></tr></tbody>';
  }
}

function formatar(valor, casas, sufixo) {
  return valor == null ? '—' : valor.toFixed(casas) + sufixo;
}

const colunas = [
  {
    titulo: 'Temp. Ar',
    grupo: 'temperatura',
    valor: m => formatar(m.tempAr, 1, '°C')
  },
  {
    titulo: 'Umid. Ar',
    grupo: 'umidade',
    valor: m => formatar(m.umidAr, 0, '%')
  },
  {
    titulo: 'Umid. Solo',
    grupo: 'umidade',
    valor: m => formatar(m.umidSolo, 0, '%')
  },
  {
    titulo: 'Pressão',
    grupo: 'pressao',
    valor: m => formatar(m.pressao, 1, ' hPa')
  },
  {
    titulo: 'Luminosidade',
    grupo: 'luz',
    valor: m => formatar(m.luminosidade, 0, ' lux')
  },
  {
    titulo: 'Chuva',
    grupo: 'chuva',
    valor: m => m.chovendo ? 'Sim' : 'Não'
  }
];

function estadoDaMedicao(m) {
  if (m.chovendo) {
    return { texto: 'Atenção (Chuva)', cor: 'ambar' };
  }

  if (m.umidSolo != null && m.umidSolo < 25) {
    return { texto: 'Solo Seco', cor: 'ambar' };
  }

  if (
    m.umidSolo != null &&
    m.umidSolo >= 40 &&
    (m.tempAr == null || m.tempAr <= 32)
  ) {
    return { texto: 'Excelente', cor: 'verde' };
  }

  return { texto: 'Estável', cor: 'azul' };
}

function colunasVisiveis() {
  const sensor = campoSensor.value;

  return colunas.filter(
    c => sensor === 'todos' || c.grupo === sensor
  );
}

function desenharTabela() {
  const visiveis = colunasVisiveis();

  const cabecalho =
    '<thead><tr><th>Data / Hora</th>' +
    visiveis.map(c => `<th>${c.titulo}</th>`).join('') +
    '<th>Estado</th></tr></thead>';

  const linhas = medicoes.map(m => {
    const estado = estadoDaMedicao(m);
    const marca = m.manual
      ? '<i class="bi bi-pencil marca-manual" title="Lançamento manual"></i>'
      : '';

    return '<tr>' +
      `<td>${formatarData(m.data)}${marca}</td>` +
      visiveis.map(c => `<td>${c.valor(m)}</td>`).join('') +
      `<td><span class="selo ${estado.cor}">${estado.texto}</span></td>` +
      '</tr>';
  }).join('');

  const semDados =
    `<tr><td colspan="${visiveis.length + 2}" class="suave">Nenhuma medição neste período.</td></tr>`;

  tabela.innerHTML = cabecalho + `<tbody>${linhas || semDados}</tbody>`;
}

campoInicial.addEventListener('change', carregarMedicoes);
campoFinal.addEventListener('change', carregarMedicoes);
campoSensor.addEventListener('change', desenharTabela);

carregarMedicoes();

function mostrarAviso(texto, comErro) {
  avisoForm.textContent = texto;
  avisoForm.classList.toggle('com-erro', comErro);
}

formulario.addEventListener('submit', async evento => {
  evento.preventDefault();

  const campoTemp = document.getElementById('tempAr');
  const campoUmid = document.getElementById('umidSolo');
  const campoChuva = document.getElementById('chuva');

  const tempAr = parseFloat(campoTemp.value);
  const umidSolo = parseFloat(campoUmid.value);
  const chuva = parseFloat(campoChuva.value) || 0;

  const tempInvalida = isNaN(tempAr);
  const umidInvalida =
    isNaN(umidSolo) || umidSolo < 0 || umidSolo > 100;

  campoTemp.classList.toggle('invalido', tempInvalida);
  campoUmid.classList.toggle('invalido', umidInvalida);

  if (tempInvalida || umidInvalida) {
    return mostrarAviso(
      'Informe a temperatura e a umidade do solo (0 a 100%).',
      true
    );
  }

  const botaoSalvar = formulario.querySelector('.botao-salvar');
  botaoSalvar.disabled = true;

  try {
    const { data: { user } } = await db.auth.getUser();

    if (!user) {
      return mostrarAviso(
        'Sessão expirada. Faça login novamente.',
        true
      );
    }

    const { error } = await db.from(TABELA_MANUAL).insert({
      estacao_id: ESTACAO_ID,
      temperatura_ar: tempAr,
      umidade_solo_pct: umidSolo,
      chuva_mm: chuva,
      observacoes: document
        .getElementById('observacoes')
        .value.trim()
    });

    if (error) {
      console.log('Erro ao salvar:', error);
      return mostrarAviso('Erro: ' + error.message, true);
    }

    formulario.reset();
    campoFinal.value = paraCampoDeData(new Date());
    mostrarAviso('Medição salva!', false);
    carregarMedicoes();

  } catch (erro) {
    console.log('Erro inesperado:', erro);
    mostrarAviso('Erro inesperado: ' + erro.message, true);

  } finally {
    botaoSalvar.disabled = false;
  }
});

document.getElementById('exportarPdf').addEventListener('click', () => {
  window.print();
});

document.getElementById('exportarCsv').addEventListener('click', () => {
  const visiveis = colunasVisiveis();

  const linhas = [
    ['Data / Hora', ...visiveis.map(c => c.titulo), 'Estado', 'Origem']
  ];

  medicoes.forEach(m => {
    linhas.push([
      formatarData(m.data),
      ...visiveis.map(c => c.valor(m)),
      estadoDaMedicao(m).texto,
      m.manual ? 'Manual' : 'Sensor'
    ]);
  });

  const csv = linhas
    .map(linha =>
      linha.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')
    )
    .join('\r\n');

  const arquivo = new Blob(
    ['\uFEFF' + csv],
    { type: 'text/csv;charset=utf-8' }
  );

  const link = document.createElement('a');
  link.href = URL.createObjectURL(arquivo);
  link.download = 'relatorio-medicoes.csv';
  link.click();

  URL.revokeObjectURL(link.href);
});

