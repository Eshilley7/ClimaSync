
const db = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);

const $ = id => document.getElementById(id);

let registros = [];
let selecionado = null;

const formatar = data => {
  if (!data) return 'Não informado';

  const dataConvertida = new Date(data);

  if (Number.isNaN(dataConvertida.getTime())) {
    return 'Data inválida';
  }

  return dataConvertida.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

function nomeDoEmail(email) {
  return email.split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\d+/g, '')
    .split(' ')
    .filter(Boolean)
    .map(palavra =>
      palavra.charAt(0).toUpperCase() + palavra.slice(1)
    )
    .join(' ') || email;
}

function mostrarAdministrador(nome, fotoUrl) {
  const avatar = $('avatarAdmin');
  const campoNome = $('nomeAdmin');
  const campoPerfil = $('perfilAdmin');

  if (campoNome) {
    campoNome.textContent = nome;
  }

  if (campoPerfil) {
    campoPerfil.textContent = 'Administrador';
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

function criar(tag, classe = '', texto) {
  const elemento = document.createElement(tag);
  elemento.className = classe;

  if (texto !== undefined && texto !== null) {
    elemento.textContent = String(texto);
  }

  return elemento;
}

function obterIniciais(nome) {
  return String(nome || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(parte => parte.charAt(0))
    .join('')
    .toUpperCase();
}

function obterDataLocal(data) {
  if (!data) return '';

  const valor = new Date(data);

  if (Number.isNaN(valor.getTime())) return '';

  const ano = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, '0');
  const dia = String(valor.getDate()).padStart(2, '0');

  return `${ano}-${mes}-${dia}`;
}

function obterFiltros() {
  return {
    busca: $('buscarSol')?.value.trim().toLowerCase() || '',
    status: $('filtrarStatus')?.value || 'todos',
    perfil: $('filtrarPerfil')?.value || 'todos',
    dataInicio: $('dataInicio')?.value || '',
    dataFim: $('dataFim')?.value || ''
  };
}

async function iniciar() {
  const { data, error: erroSessao } =
    await db.auth.getSession();

  const session = data?.session;

  if (erroSessao || !session) {
    location.replace('login.html');
    return;
  }

  const { data: admin, error } =
    await db.rpc('usuario_e_admin');

  if (error || admin !== true) {
    location.replace('painel.html');
    return;
  }

  const usuario = session.user;
  const dados = usuario.user_metadata || {};
  const email = (usuario.email || '').toLowerCase();

  mostrarAdministrador(
    dados.full_name || nomeDoEmail(email),
    dados.avatar_url || dados.picture
  );

  await carregar();
}

async function carregar() {
  const { data, error } = await db
    .from('solicitacoes_acesso')
    .select('*')
    .order('criado_em', { ascending: false });

  if (error) {
    $('listaSolicitacoes').textContent =
      'Erro ao carregar: ' + error.message;

    $('feedbackAdmin').textContent =
      'Não foi possível carregar as solicitações.';

    return;
  }

  registros = data || [];

  const pendentes = registros.filter(
    x => x.status === 'pendente'
  ).length;

  const aprovadas = registros.filter(
    x => x.status === 'aprovada'
  ).length;

  $('totalPendentes').textContent =
    String(pendentes).padStart(2, '0');

  $('totalAprovadas').textContent =
    String(aprovadas).padStart(2, '0');

  if ($('badgePendentes')) {
    $('badgePendentes').textContent = pendentes;
  }

  if ($('atualizadoEm')) {
    $('atualizadoEm').textContent =
      'Atualizado em ' + formatar(new Date());
  }

  const filtroPerfil = $('filtrarPerfil');

  if (filtroPerfil) {
    const perfilAtual = filtroPerfil.value;

    const perfis = [
      ...new Set(
        registros
          .map(x => x.perfil)
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b, 'pt-BR'));

    filtroPerfil.replaceChildren(
      new Option('Todos os perfis', 'todos'),
      ...perfis.map(perfil => new Option(perfil, perfil))
    );

    filtroPerfil.value = perfis.includes(perfilAtual)
      ? perfilAtual
      : 'todos';
  }

  if (
    selecionado !== null &&
    !registros.some(x => String(x.id) === String(selecionado))
  ) {
    selecionado = null;
  }

  renderizar();

  if (selecionado !== null) {
    const registro = registros.find(
      x => String(x.id) === String(selecionado)
    );

    if (registro) {
      detalhar(registro);
    }
  }
}

function renderizar() {
  const {
    busca,
    status,
    perfil,
    dataInicio,
    dataFim
  } = obterFiltros();

  const filtrados = registros.filter(x => {
    const texto = `${x.nome || ''} ${x.email || ''}`
      .toLowerCase();

    const dataRegistro = obterDataLocal(x.criado_em);

    const correspondeBusca = texto.includes(busca);

    const correspondeStatus =
      status === 'todos' || x.status === status;

    const correspondePerfil =
      perfil === 'todos' || x.perfil === perfil;

    const correspondeInicio =
      !dataInicio || (dataRegistro && dataRegistro >= dataInicio);

    const correspondeFim =
      !dataFim || (dataRegistro && dataRegistro <= dataFim);

    return (
      correspondeBusca &&
      correspondeStatus &&
      correspondePerfil &&
      correspondeInicio &&
      correspondeFim
    );
  });

  const lista = $('listaSolicitacoes');
  lista.replaceChildren();

  if (!filtrados.length) {
    lista.append(
      criar('p', 'vazio-sol', 'Nenhuma solicitação encontrada.')
    );
  }

  for (const x of filtrados) {
    const item = criar(
      'button',
      'item-sol' +
      (String(selecionado) === String(x.id) ? ' ativo' : '')
    );

    item.type = 'button';

    const pessoa = criar('div', 'pessoa-sol');

    const info = criar('div', 'info-pessoa-sol');

    info.append(
      criar('b', '', x.nome || 'Nome não informado'),
      criar('small', '', x.perfil || 'Perfil não informado')
    );

    pessoa.append(info);

    item.append(
      pessoa,
      criar('span', 'data-sol', formatar(x.criado_em)),
      criar(
        'span',
        'status-sol ' + (x.status || ''),
        x.status || 'Não informado'
      )
    );

    item.addEventListener('click', () => {
      selecionado = x.id;
      renderizar();
      detalhar(x);

      if ($('feedbackAdmin')) {
        $('feedbackAdmin').textContent = '';
      }
    });

    lista.append(item);
  }

  $('rodapeLista').textContent =
    `Exibindo ${filtrados.length} de ${registros.length} solicitações`;

  const selecionadoVisivel = filtrados.some(
    x => String(x.id) === String(selecionado)
  );

  if (!selecionadoVisivel) {
    selecionado = null;

    $('codigoSolicitacao').textContent = '—';

    $('detalhesSolicitacao').replaceChildren(
      criar(
        'p',
        'vazio-sol',
        'Selecione uma solicitação na lista.'
      )
    );
  }
}

function detalhar(x) {
  $('codigoSolicitacao').textContent =
    '#' + String(x.id).slice(0, 8);

  const area = $('detalhesSolicitacao');
  area.replaceChildren();

  const cabecalho = criar('div', 'cabecalho-detalhe');

  const avatar = criar(
    'div',
    'avatar-detalhe',
    obterIniciais(x.nome)
  );

  const identificacao = criar(
    'div',
    'identificacao-detalhe'
  );

  identificacao.append(
    criar('h3', '', x.nome || 'Nome não informado'),
    criar('p', '', x.email || 'E-mail não informado')
  );

  cabecalho.append(avatar, identificacao);

  const meta = criar('div', 'meta-detalhe');

  meta.append(
    criar(
      'span',
      'status-sol ' + (x.status || ''),
      x.status || 'Não informado'
    ),
    criar(
      'span',
      'data-detalhe',
      formatar(x.criado_em)
    )
  );

  const grade = criar('div', 'informacoes-detalhe');

  const campos = [
    ['Perfil solicitado', x.perfil || 'Não informado'],
    ['Telefone', x.telefone || 'Não informado'],
    ['Recebida em', formatar(x.criado_em)],
    ['Situação', x.status || 'Não informado']
  ];

  for (const [rotulo, valor] of campos) {
    const bloco = criar('div', 'info-detalhe');

    bloco.append(
      criar('small', '', rotulo),
      criar('strong', '', valor)
    );

    grade.append(bloco);
  }

  const blocoMotivo = criar('div', 'bloco-motivo');

  blocoMotivo.append(
    criar('h4', '', 'Motivo da solicitação'),
    criar(
      'div',
      'texto-motivo',
      x.motivo || 'Motivo não informado.'
    )
  );

  area.append(
    cabecalho,
    meta,
    grade,
    blocoMotivo
  );

  if (x.status === 'pendente') {
    const acoes = criar('div', 'acoes-detalhe');

    const recusar = criar(
      'button',
      'btn-recusar',
      '✕ Recusar'
    );

    const aprovar = criar(
      'button',
      'btn-aprovar',
      '✓ Aprovar acesso'
    );

    recusar.type = 'button';
    aprovar.type = 'button';

    recusar.addEventListener('click', () => {
      decidir(x, 'recusada');
    });

    aprovar.addEventListener('click', () => {
      decidir(x, 'aprovada');
    });

    acoes.append(recusar, aprovar);
    area.append(acoes);

  } else if (x.analisado_em) {
    area.append(
      criar(
        'p',
        'data-detalhe',
        'Analisada em ' + formatar(x.analisado_em)
      )
    );
  }
}

async function decidir(solicitacao, status) {
  const acao = status === 'aprovada'
    ? 'Aprovar'
    : 'Recusar';

  if (!confirm(
    `${acao} a solicitação de ${solicitacao.nome}?`
  )) {
    return;
  }

  const feedback = $('feedbackAdmin');

  feedback.textContent = 'Salvando decisão...';

  const botoes = document.querySelectorAll(
    '.acoes-detalhe button'
  );

  botoes.forEach(botao => {
    botao.disabled = true;
  });

  try {
    const { error } = await db.rpc(
      'decidir_solicitacao',
      {
        p_id: solicitacao.id,
        p_decisao: status
      }
    );

    if (error) {
      throw error;
    }

    feedback.textContent =
      'Decisão registrada com sucesso.';

    selecionado = solicitacao.id;

    await carregar();

  } catch (erro) {
    console.error('Erro ao registrar decisão:', erro);

    feedback.textContent =
      'Erro ao registrar decisão: ' + erro.message;

    botoes.forEach(botao => {
      botao.disabled = false;
    });
  }
}

if ($('buscarSol')) {
  $('buscarSol').addEventListener('input', renderizar);
}

if ($('filtrarStatus')) {
  $('filtrarStatus').addEventListener('change', renderizar);
}

if ($('filtrarPerfil')) {
  $('filtrarPerfil').addEventListener('change', renderizar);
}

if ($('dataInicio')) {
  $('dataInicio').addEventListener('change', renderizar);
}

if ($('dataFim')) {
  $('dataFim').addEventListener('change', renderizar);
}

if ($('limparFiltros')) {
  $('limparFiltros').addEventListener('click', () => {
    if ($('buscarSol')) {
      $('buscarSol').value = '';
    }

    if ($('filtrarStatus')) {
      $('filtrarStatus').value = 'todos';
    }

    if ($('filtrarPerfil')) {
      $('filtrarPerfil').value = 'todos';
    }

    if ($('dataInicio')) {
      $('dataInicio').value = '';
    }

    if ($('dataFim')) {
      $('dataFim').value = '';
    }

    renderizar();
  });
}

if ($('sairSolicitacoes')) {
  $('sairSolicitacoes').addEventListener(
    'click',
    async () => {
      const { error } = await db.auth.signOut();

      if (error) {
        console.error('Erro ao sair:', error);
        return;
      }

      location.replace('login.html');
    }
  );
}

iniciar();