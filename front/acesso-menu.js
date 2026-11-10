
const dbMenu = window.supabase.createClient(
  'https://ygkvynojfoejztrlsujf.supabase.co',
  'sb_publishable_HDorc-migsMoX-S4nNarkQ_t_aej_3K'
);

async function controlarAcessoGestao() {
  const linkGestao = document.getElementById('linkGestao');
  if (!linkGestao) return;

  linkGestao.hidden = true;

  const { data, error } = await dbMenu.auth.getSession();

  if (error || !data.session) return;

  const { data: ehAdministrador, error: erroPermissao } =
    await dbMenu.rpc('usuario_e_admin');

  if (erroPermissao) {
    console.error('Não foi possível verificar a permissão:', erroPermissao);
    return;
  }

  if (ehAdministrador === true) {
    linkGestao.hidden = false;
    return;
  }

  if (
    window.location.pathname.toLowerCase().endsWith('/gestao.html') ||
    window.location.pathname.toLowerCase().endsWith('gestao.html')
  ) {
    window.location.replace('painel.html');
  }
}

controlarAcessoGestao();
