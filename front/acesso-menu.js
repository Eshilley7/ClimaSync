const dbMenu = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);


async function controlarAcessoGestao() {

  const linkGestao =
    document.getElementById('linkGestao');

  const linkSolicitacoes =
    document.getElementById('linkSolicitacoes');

  if (linkGestao) {
    linkGestao.hidden = true;
  }

  if (linkSolicitacoes) {
    linkSolicitacoes.hidden = true;
  }

  try {

    const { data, error } =
      await dbMenu.auth.getSession();

    if (error || !data.session) {
      return;
    }

    const {
      data: ehAdministrador,
      error: erroPermissao
    } = await dbMenu.rpc('usuario_e_admin');

    if (erroPermissao) {
      console.error(
        'Não foi possível verificar a permissão:',
        erroPermissao
      );
      return;
    }

    if (ehAdministrador === true) {

      if (linkGestao) {
        linkGestao.hidden = false;
      }

      if (linkSolicitacoes) {
        linkSolicitacoes.hidden = false;
      }

      return;
    }

    if (linkGestao) {
      linkGestao.hidden = true;
    }

    if (linkSolicitacoes) {
      linkSolicitacoes.hidden = true;
    }

    const paginaAtual =
      window.location.pathname
        .split('/')
        .pop()
        .toLowerCase();

    if (
      paginaAtual === 'gestao.html' ||
      paginaAtual === 'solicitacoes.html'
    ) {
      window.location.replace('painel.html');
    }

  } catch (erro) {
    console.error(
      'Erro ao verificar acesso administrativo:',
      erro
    );
  }
}

if (document.readyState === 'loading') {
  document.addEventListener(
    'DOMContentLoaded',
    controlarAcessoGestao
  );
} else {
  controlarAcessoGestao();
}
