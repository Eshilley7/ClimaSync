const db = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);

const TABELA_FUNCIONARIOS = 'funcionarios';

const PERFIS = [
  'Administrador',
  'Agrônomo Responsável',
  'Técnico de Campo',
  'Operador de Estação',
  'Pesquisador Climatologista',
  'Analista de Solo'
];

const tabela = document.getElementById('tabela');
const campoBusca = document.getElementById('busca');
const botaoConvidar = document.getElementById('convidar');
const avisoPagina = document.getElementById('aviso');
const avisoDialogo = document.getElementById('avisoDialogo');
const dialogo = document.getElementById('dialogo');
const dialogoTitulo = document.getElementById('dialogoTitulo');
const formulario = document.getElementById('formulario');
const campoNome = document.getElementById('campoNome');
const campoEmail = document.getElementById('campoEmail');
const campoPerfil = document.getElementById('campoPerfil');
const botaoSalvar = document.getElementById('salvar');

let funcionarios = [];
let editandoId = null;
let emailLogado = '';
let ehAdmin = false;

campoPerfil.innerHTML = PERFIS.map(p =>
  `<option value="${p}">${p}</option>`
).join('');

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

function mostrarUsuario(nome, fotoUrl) {
  const avatar = document.getElementById('usuarioFoto');
  const campoUsuarioNome = document.getElementById('usuarioNome');

  if (campoUsuarioNome) campoUsuarioNome.textContent = nome;

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

async function carregarPerfilUsuario() {
  const elementoPerfil = document.getElementById('usuarioPerfil');

  if (!elementoPerfil || !emailLogado) return;

  elementoPerfil.textContent = 'Carregando perfil...';

  const { data, error } = await db
    .from(TABELA_FUNCIONARIOS)
    .select('perfil')
    .ilike('email', emailLogado)
    .maybeSingle();

  if (error) {
    console.error('Erro ao carregar perfil:', error);
    elementoPerfil.textContent = 'Perfil indisponível';
    return;
  }

  elementoPerfil.textContent = data?.perfil || 'Perfil não cadastrado';
}

async function verificarLogin() {
  const linkGestao = document.getElementById('linkGestao');

  if (linkGestao) linkGestao.hidden = true;

  const { data, error } = await db.auth.getSession();

  if (error || !data.session) {
    window.location.href = 'login.html';
    return;
  }

  const usuario = data.session.user;
  const dados = usuario.user_metadata || {};

  emailLogado = (usuario.email || '').toLowerCase();

  mostrarUsuario(
    dados.full_name || nomeDoEmail(usuario.email),
    dados.avatar_url
  );

  await carregarPerfilUsuario();

  const { data: admin, error: erroAdmin } =
    await db.rpc('usuario_e_admin');

  if (erroAdmin) {
    console.error('Erro ao verificar administrador:', erroAdmin);
    ehAdmin = false;
  } else {
    ehAdmin = admin === true;
  }

  if (linkGestao) {
    linkGestao.hidden = !ehAdmin;
  }

  if (botaoConvidar) {
    botaoConvidar.hidden = !ehAdmin;
  }

  if (!ehAdmin) {
    window.location.replace('painel.html');
    return;
  }

  const { error: erroAcesso } =
    await db.rpc('registrar_ultimo_acesso');

  if (erroAcesso) {
    console.log(
      'Não foi possível registrar o acesso:',
      erroAcesso.message
    );
  }

  desenharTabela();
}

document.getElementById('sair')?.addEventListener('click', async () => {
  await db.auth.signOut();
  window.location.href = 'login.html';
});

function escapar(texto) {
  const mapa = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };

  return String(texto ?? '').replace(/[&<>"']/g, c => mapa[c]);
}

function formatarAcesso(valor) {
  if (!valor) return 'Nunca acessou';

  const data = new Date(valor);
  const minutos = Math.floor(
    (Date.now() - data.getTime()) / 60000
  );

  if (minutos < 5) return 'Online agora';
  if (minutos < 60) return `Há ${minutos} minutos`;

  const horas = Math.floor(minutos / 60);

  if (horas < 24) {
    return `Há ${horas} ${horas === 1 ? 'hora' : 'horas'}`;
  }

  const ontem = new Date();
  ontem.setDate(ontem.getDate() - 1);

  const hora = data.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (data.toDateString() === ontem.toDateString()) {
    return `Ontem, às ${hora}`;
  }

  const dias = Math.floor(horas / 24);

  if (dias < 7) {
    return `Há ${dias} ${dias === 1 ? 'dia' : 'dias'}`;
  }

  return data.toLocaleDateString('pt-BR');
}

function mostrarAviso(texto, comErro) {
  avisoPagina.textContent = texto;
  avisoPagina.classList.toggle('com-erro', comErro);
}

function mostrarAvisoDialogo(texto, comErro) {
  avisoDialogo.textContent = texto;
  avisoDialogo.classList.toggle('com-erro', comErro);
}

function filtrar() {
  const termo = campoBusca.value.trim().toLowerCase();

  if (!termo) return funcionarios;

  return funcionarios.filter(f =>
    [f.nome, f.email, f.perfil].some(v =>
      String(v ?? '').toLowerCase().includes(termo)
    )
  );
}

function atualizarResumo() {
  const ativos = funcionarios.filter(f => f.ativo).length;

  document.getElementById('totalAtivos').textContent =
    `${ativos} ${ativos === 1 ? 'Usuário Ativo' : 'Usuários Ativos'} no Sistema`;

  const admin = funcionarios.find(
    f => f.perfil === 'Administrador' && f.ativo
  );

  document.getElementById('adminPrincipal').textContent =
    admin ? `${admin.nome} (Admin Principal)` : '—';
}

function desenharTabela() {
  const lista = filtrar();

  const cabecalho = '<thead><tr>' +
    '<th>Nome / E-mail</th>' +
    '<th>Perfil de Acesso</th>' +
    '<th>Status</th>' +
    '<th>Último Acesso</th>' +
    '<th class="direita">Ações</th>' +
    '</tr></thead>';

  const linhas = lista.map(f => {
    const foto = f.foto_url
      ? ` style="background-image:url('${escapar(f.foto_url)}')"`
      : '';

    const inicial = f.foto_url
      ? ''
      : escapar(String(f.nome || '?').charAt(0).toUpperCase());

    const selo = f.ativo
      ? '<span class="selo verde">Ativo</span>'
      : '<span class="selo vermelho">Inativo</span>';

    const iconeBloqueio = f.ativo ? 'bi-lock' : 'bi-unlock';

    const tituloBloqueio = f.ativo
      ? 'Bloquear acesso'
      : 'Liberar acesso';

    const botoesAcoes = ehAdmin
      ? '<td class="direita"><div class="acoes">' +
        `<button class="acao" type="button" data-acao="editar" data-id="${f.id}" title="Editar" aria-label="Editar"><i class="bi bi-pencil-square"></i></button>` +
        `<button class="acao perigo" type="button" data-acao="bloquear" data-id="${f.id}" title="${tituloBloqueio}" aria-label="${tituloBloqueio}"><i class="bi ${iconeBloqueio}"></i></button>` +
        '</div></td>'
      : '<td class="direita"></td>';

    return '<tr>' +
      '<td><div class="pessoa">' +
      `<div class="avatar"${foto}>${inicial}</div>` +
      `<div><strong>${escapar(f.nome)}</strong><span>${escapar(f.email)}</span></div>` +
      '</div></td>' +
      `<td>${escapar(f.perfil)}</td>` +
      `<td>${selo}</td>` +
      `<td>${formatarAcesso(f.ultimo_acesso)}</td>` +
      botoesAcoes +
      '</tr>';
  }).join('');

  const vazio =
    '<tr><td colspan="5" class="suave">Nenhum funcionário encontrado.</td></tr>';

  tabela.innerHTML = cabecalho + `<tbody>${linhas || vazio}</tbody>`;

  document.getElementById('contagem').innerHTML =
    `Mostrando <strong>${lista.length}</strong> de <strong>${funcionarios.length}</strong> usuários autorizados nesta estação.`;
}

async function carregarFuncionarios() {
  tabela.innerHTML =
    '<tbody><tr><td class="suave">Carregando funcionários...</td></tr></tbody>';

  const { data, error } = await db
    .from(TABELA_FUNCIONARIOS)
    .select('*')
    .order('nome', { ascending: true });

  if (error) {
    console.log('Erro ao buscar funcionários:', error);

    tabela.innerHTML =
      '<tbody><tr><td class="suave">Não foi possível carregar os funcionários.</td></tr></tbody>';

    mostrarAviso('Erro: ' + error.message, true);
    return;
  }

  funcionarios = data || [];

  atualizarResumo();
  desenharTabela();
}

function abrirDialogo(funcionario) {
  if (!ehAdmin) return;

  editandoId = funcionario ? funcionario.id : null;

  dialogoTitulo.textContent = funcionario
    ? 'Editar Funcionário'
    : 'Convidar Operador';

  campoNome.value = funcionario ? funcionario.nome : '';
  campoEmail.value = funcionario ? funcionario.email : '';

  campoPerfil.value = funcionario
    ? funcionario.perfil
    : 'Operador de Estação';

  campoNome.classList.remove('invalido');
  campoEmail.classList.remove('invalido');

  mostrarAvisoDialogo('', false);

  dialogo.showModal();
  campoNome.focus();
}

async function alternarAcesso(id) {
  if (!ehAdmin) return;

  const funcionario = funcionarios.find(f => f.id === id);
  if (!funcionario) return;

  if (
    funcionario.ativo &&
    String(funcionario.email).toLowerCase() === emailLogado
  ) {
    return mostrarAviso(
      'Você não pode bloquear o seu próprio acesso.',
      true
    );
  }

  const { error } = await db
    .from(TABELA_FUNCIONARIOS)
    .update({ ativo: !funcionario.ativo })
    .eq('id', id);

  if (error) {
    console.log('Erro ao alterar acesso:', error);
    return mostrarAviso('Erro: ' + error.message, true);
  }

  mostrarAviso(
    funcionario.ativo
      ? 'Acesso bloqueado.'
      : 'Acesso liberado.',
    false
  );

  await carregarFuncionarios();
}

campoBusca.addEventListener('input', desenharTabela);

botaoConvidar.addEventListener('click', () => {
  if (!ehAdmin) return;
  abrirDialogo(null);
});

document.getElementById('cancelar').addEventListener('click', () => {
  dialogo.close();
});

tabela.addEventListener('click', evento => {
  const botao = evento.target.closest('button[data-acao]');

  if (!botao || !ehAdmin) return;

  const id = Number(botao.dataset.id);

  if (botao.dataset.acao === 'editar') {
    abrirDialogo(funcionarios.find(f => f.id === id));
  } else if (botao.dataset.acao === 'bloquear') {
    alternarAcesso(id);
  }
});

formulario.addEventListener('submit', async evento => {
  evento.preventDefault();

  if (!ehAdmin) {
    return mostrarAvisoDialogo(
      'Você não tem permissão para realizar esta operação.',
      true
    );
  }

  const nome = campoNome.value.trim();
  const email = campoEmail.value.trim().toLowerCase();
  const perfil = campoPerfil.value;

  const nomeInvalido = !nome;
  const emailInvalido =
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  campoNome.classList.toggle('invalido', nomeInvalido);
  campoEmail.classList.toggle('invalido', emailInvalido);

  if (nomeInvalido || emailInvalido) {
    return mostrarAvisoDialogo(
      'Informe o nome e um e-mail válido.',
      true
    );
  }

  botaoSalvar.disabled = true;

  const edicao = editandoId !== null;

  try {
    const dados = {
      nome,
      email,
      perfil
    };

    const { error } = edicao
      ? await db
          .from(TABELA_FUNCIONARIOS)
          .update(dados)
          .eq('id', editandoId)
      : await db
          .from(TABELA_FUNCIONARIOS)
          .insert({
            ...dados,
            ativo: true
          });

    if (error) {
      console.log('Erro ao salvar funcionário:', error);

      return mostrarAvisoDialogo(
        'Erro: ' + error.message,
        true
      );
    }

    dialogo.close();

    mostrarAviso(
      edicao
        ? 'Funcionário atualizado!'
        : 'Operador cadastrado!',
      false
    );

    await carregarFuncionarios();

  } catch (erro) {
    console.log('Erro inesperado:', erro);

    mostrarAvisoDialogo(
      'Erro inesperado: ' + erro.message,
      true
    );

  } finally {
    botaoSalvar.disabled = false;
  }
});

async function iniciarPagina() {
  await verificarLogin();

  if (emailLogado && ehAdmin) {
    await carregarFuncionarios();
  }
}

iniciarPagina();

